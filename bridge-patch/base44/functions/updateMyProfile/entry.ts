import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { validatePersonName } from "./personName.js";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) {}
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const patch = {};

    // Platform User.full_name is read-only — store the editable name on legal_name.
    if (body.full_name != null || body.legal_name != null) {
      const raw = body.legal_name != null ? body.legal_name : body.full_name;
      const nameCheck = validatePersonName(raw, { email: user.email });
      if (!nameCheck.ok) {
        return Response.json({ error: nameCheck.error }, { status: 400 });
      }
      patch.legal_name = nameCheck.name;
    }
    if (body.baptism_name != null) {
      patch.baptism_name = String(body.baptism_name).trim().slice(0, 80);
    }
    if (body.phone != null) patch.phone = String(body.phone).trim().slice(0, 40);

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
    if (typeof body.notify_new_rides === "boolean") patch.notify_new_rides = body.notify_new_rides;
    if (typeof body.notify_return_queue === "boolean") patch.notify_return_queue = body.notify_return_queue;
    if (typeof body.notify_status_reminders === "boolean") {
      patch.notify_status_reminders = body.notify_status_reminders;
    }

    if (patch.vehicle_make || patch.vehicle_model || patch.vehicle_color) {
      const color = patch.vehicle_color ?? user.vehicle_color ?? "";
      const make = patch.vehicle_make ?? user.vehicle_make ?? "";
      const model = patch.vehicle_model ?? user.vehicle_model ?? "";
      const label = [color, make, model].filter(Boolean).join(" ").trim();
      if (label && !patch.vehicle_description) patch.vehicle_description = label;
    }

    if (!Object.keys(patch).length) {
      return Response.json({ error: "No valid fields" }, { status: 400 });
    }

    const updated = await svc.entities.User.update(user.id, patch);

    // Keep linked Rider.name in sync when legal_name changes
    if (patch.legal_name) {
      try {
        const riders = await svc.entities.Rider.filter({ user_id: user.id });
        for (const r of riders || []) {
          await svc.entities.Rider.update(r.id, {
            name: patch.legal_name,
            ...(patch.baptism_name != null ? { baptism_name: patch.baptism_name } : {}),
          });
        }
      } catch (e) {}
    }

    // Echo display name as full_name for clients that still read that key from the response.
    const userOut = updated
      ? { ...updated, full_name: updated.legal_name || updated.full_name }
      : updated;

    return Response.json({ ok: true, user: userOut });
  } catch (err) {
    return Response.json({ error: err?.message || "Failed" }, { status: 500 });
  }
});
