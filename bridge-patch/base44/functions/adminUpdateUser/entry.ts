import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { validatePersonName } from './personName.js';

const OWNER_EMAIL = "caleb.heller13@gmail.com";
const ROLES = new Set(["admin", "driver", "rider"]);
const TODAY_MODES = new Set(["driving", "riding"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let admin = null;
    try {
      admin = await base44.auth.me();
    } catch (e) {}
    if (!admin) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (admin.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id || "").trim();
    if (!userId) return Response.json({ error: "user_id required" }, { status: 400 });

    const svc = base44.asServiceRole;
    let target = null;
    try {
      target = await svc.entities.User.get(userId);
    } catch (e) {}
    if (!target) return Response.json({ error: "User not found" }, { status: 404 });

    const isOwner = String(target.email || "").toLowerCase() === OWNER_EMAIL;
    const patch = {};

    if (body.full_name != null || body.legal_name != null) {
      const raw = body.legal_name != null ? body.legal_name : body.full_name;
      const incoming = String(raw || "").trim().replace(/\s+/g, " ");
      const current = String(target.legal_name || target.full_name || "").trim().replace(/\s+/g, " ");
      // Don't block Sundays-only / pause toggles when the account still has a legacy username as full_name.
      // Platform full_name is read-only — persist on legal_name.
      if (incoming && incoming !== current) {
        const nameCheck = validatePersonName(raw, { email: target.email });
        if (!nameCheck.ok) {
          return Response.json({ error: nameCheck.error }, { status: 400 });
        }
        patch.legal_name = nameCheck.name;
      }
    }
    if (body.baptism_name != null) patch.baptism_name = String(body.baptism_name).trim().slice(0, 80);
    if (body.phone != null) patch.phone = String(body.phone).trim().slice(0, 40);
    if (body.assigned_zone != null) patch.assigned_zone = String(body.assigned_zone).trim().slice(0, 80);
    if (body.vehicle_make != null) patch.vehicle_make = String(body.vehicle_make).trim().slice(0, 60);
    if (body.vehicle_model != null) patch.vehicle_model = String(body.vehicle_model).trim().slice(0, 60);
    if (body.vehicle_color != null) patch.vehicle_color = String(body.vehicle_color).trim().slice(0, 40);
    if (body.vehicle_description != null) {
      patch.vehicle_description = String(body.vehicle_description).trim().slice(0, 120);
    }
    if (body.vehicle_capacity != null) {
      const cap = Number(body.vehicle_capacity);
      if (Number.isFinite(cap) && cap >= 1 && cap <= 15) patch.vehicle_capacity = cap;
    }
    if (typeof body.is_active_driver === "boolean") patch.is_active_driver = body.is_active_driver;
    if (typeof body.driver_approved === "boolean") patch.driver_approved = body.driver_approved;
    if (typeof body.notify_new_rides === "boolean") patch.notify_new_rides = body.notify_new_rides;
    if (typeof body.notify_admin_new_rides === "boolean") patch.notify_admin_new_rides = body.notify_admin_new_rides;
    if (typeof body.notify_return_queue === "boolean") patch.notify_return_queue = body.notify_return_queue;
    if (typeof body.notify_web_push === "boolean") patch.notify_web_push = body.notify_web_push;
    if (typeof body.notify_status_reminders === "boolean") {
      patch.notify_status_reminders = body.notify_status_reminders;
    }
    if (typeof body.account_disabled === "boolean") {
      if (isOwner && body.account_disabled) {
        return Response.json({ error: "Cannot pause the app owner account." }, { status: 403 });
      }
      if (userId === admin.id && body.account_disabled) {
        return Response.json({ error: "You can't pause your own account." }, { status: 403 });
      }
      patch.account_disabled = body.account_disabled;
      if (body.account_disabled) {
        patch.account_disabled_at = new Date().toISOString();
        patch.account_disabled_by = admin.id;
        if (body.account_disabled_reason != null) {
          patch.account_disabled_reason = String(body.account_disabled_reason).trim().slice(0, 500);
        }
        // Stop driving notifications / availability while paused
        patch.is_active_driver = false;
      } else {
        patch.account_disabled_at = "";
        patch.account_disabled_by = "";
        if (body.account_disabled_reason != null) {
          patch.account_disabled_reason = String(body.account_disabled_reason).trim().slice(0, 500);
        } else {
          patch.account_disabled_reason = "";
        }
      }
    } else if (body.account_disabled_reason != null && target.account_disabled) {
      patch.account_disabled_reason = String(body.account_disabled_reason).trim().slice(0, 500);
    }
    if (typeof body.sunday_rides_only === "boolean") {
      if (isOwner && body.sunday_rides_only) {
        return Response.json({ error: "Cannot restrict the app owner account." }, { status: 403 });
      }
      patch.sunday_rides_only = body.sunday_rides_only;
    }
    if (typeof body.mega_exploits_only === "boolean") {
      patch.mega_exploits_only = body.mega_exploits_only;
    }
    if (body.today_mode != null) {
      const mode = String(body.today_mode);
      if (TODAY_MODES.has(mode)) patch.today_mode = mode;
    }
    if (body.role != null) {
      const role = String(body.role);
      if (!ROLES.has(role)) return Response.json({ error: "Invalid role" }, { status: 400 });
      if (isOwner && role !== "admin") {
        return Response.json({ error: "Cannot demote the app owner." }, { status: 403 });
      }
      patch.role = role;
    }

    // Keep vehicle_description in sync when make/model/color change
    if (patch.vehicle_make || patch.vehicle_model || patch.vehicle_color) {
      const color = patch.vehicle_color ?? target.vehicle_color ?? "";
      const make = patch.vehicle_make ?? target.vehicle_make ?? "";
      const model = patch.vehicle_model ?? target.vehicle_model ?? "";
      const label = [color, make, model].filter(Boolean).join(" ").trim();
      if (label && !patch.vehicle_description) patch.vehicle_description = label;
    }

    if (!Object.keys(patch).length) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await svc.entities.User.update(userId, patch);

    // Keep claimed/open ride cards callable — sync phone/name from the account.
    if (patch.phone != null || patch.legal_name != null) {
      try {
        const openStatuses = ["pending", "claimed", "on_the_way", "picked_up", "arrived", "return_needed", "returning"];
        const rides = await svc.entities.RideRequest.filter({ user_id: userId }, "-created_date", 100);
        const set = {};
        if (patch.phone != null && String(patch.phone).replace(/\D/g, "").length >= 10) {
          set.rider_phone = String(patch.phone).trim();
        }
        if (patch.legal_name != null) set.rider_name = String(patch.legal_name).trim();
        if (Object.keys(set).length) {
          for (const ride of rides || []) {
            if (!ride?.id || !openStatuses.includes(String(ride.status || ""))) continue;
            await svc.entities.RideRequest.update(ride.id, set);
          }
        }
      } catch (syncErr) {
        console.error("adminUpdateUser ride sync", syncErr?.message || syncErr);
      }
    }

    // When pausing: cancel open pending requests so they don't stay in the queue
    if (patch.account_disabled === true) {
      try {
        const open = await svc.entities.RideRequest.filter({ user_id: userId, status: "pending" });
        const phoneDigits = String(target.phone || "").replace(/\D/g, "");
        let byPhone = [];
        if (phoneDigits.length >= 10) {
          const recent = await svc.entities.RideRequest.filter({ status: "pending" }, "-created_date", 200);
          const np = phoneDigits.length === 11 && phoneDigits.startsWith("1") ? phoneDigits.slice(1) : phoneDigits;
          byPhone = (recent || []).filter((r) => {
            const d = String(r.rider_phone || "").replace(/\D/g, "");
            const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
            return n === np;
          });
        }
        const seen = new Set();
        for (const ride of [...(open || []), ...byPhone]) {
          if (!ride?.id || seen.has(ride.id)) continue;
          seen.add(ride.id);
          if (ride.status !== "pending") continue;
          await svc.entities.RideRequest.update(ride.id, {
            status: "cancelled",
            notes: [ride.notes, "[Cancelled: account paused]"].filter(Boolean).join(" ").trim(),
          });
        }
      } catch (cancelErr) {
        console.error("pause cancel pending", cancelErr?.message || cancelErr);
      }
    }

    // Notify when a driver is newly approved
    if (patch.driver_approved === true && target.driver_approved !== true) {
      try {
        const email = target.email;
        const name = patch.legal_name || target.legal_name || target.full_name || "there";
        const safeName = String(name).replace(/[&<>"']/g, (c) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
        if (email) {
          await svc.integrations.Core.SendEmail({
            to: email,
            subject: "You're approved to drive — Bridge",
            body: `<p>Hi ${safeName},</p><p>An admin approved you as a driver. You can now claim rides in Available Rides.</p><p>Thank you for serving!</p>`,
            from_name: "Bridge",
          });
        }
        if (target.notify_web_push !== false && target.push_subscription) {
          try {
            const { default: webpush } = await import("npm:web-push@3.6.7");
            webpush.setVapidDetails(
              "mailto:transport@godsremnantassembly.org",
              "BEpN4VwkecemlQQgzFvkPyV3K7MaMQZALstOnB0XTkiUl1geB19LS6Lzbqg4S6VmK2kHkz1C97tEA9Ys4aQdZRU",
              "6mdaK1zXcGhoNWpr5z0G0uAO00ShSRf3IcO-a-vcMZc",
            );
            const sub = JSON.parse(target.push_subscription);
            await webpush.sendNotification(sub, JSON.stringify({
              title: "Driver approved",
              body: "You can now claim rides. Thank you for serving!",
              url: "/rides",
            }));
          } catch (pushErr) {
            console.error("approval push", pushErr?.message || pushErr);
          }
        }
      } catch (notifyErr) {
        console.error("approval notify", notifyErr?.message || notifyErr);
      }
    }

    try {
      await svc.entities.SystemLog.create({
        action: "other",
        summary: `Admin ${patch.account_disabled === true ? "paused" : patch.account_disabled === false ? "restored" : "updated"} account ${target.legal_name || target.full_name || target.email || userId}`,
        details: `Fields: ${Object.keys(patch).join(", ")} · by ${admin.legal_name || admin.full_name || admin.email}`,
        entity_type: "User",
        entity_id: userId,
        actor_id: admin.id,
        actor_name: admin.legal_name || admin.full_name || admin.email,
        actor_role: "admin",
        zone: patch.assigned_zone || target.assigned_zone || "",
      });
    } catch (e) {
      console.error("SystemLog", e?.message || e);
    }

    return Response.json({
      ok: true,
      user: updated
        ? { ...updated, full_name: updated.legal_name || updated.full_name }
        : updated,
    });
  } catch (err) {
    console.error("adminUpdateUser", err);
    return Response.json({ error: err?.message || "Failed" }, { status: 500 });
  }
});
