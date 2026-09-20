import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY =
  "BEpN4VwkecemlQQgzFvkPyV3K7MaMQZALstOnB0XTkiUl1geB19LS6Lzbqg4S6VmK2kHkz1C97tEA9Ys4aQdZRU";
const VAPID_PRIVATE_KEY = "6mdaK1zXcGhoNWpr5z0G0uAO00ShSRf3IcO-a-vcMZc";
const VAPID_SUBJECT = "mailto:transport@godsremnantassembly.org";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const OPEN = ["claimed", "on_the_way", "picked_up"];
const THROTTLE_MINUTES = 40;
const QUIET_START_HOUR = 23; // 11pm ET
const QUIET_END_HOUR = 6; // 6am ET

function parseSubscription(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
}

function minutesSince(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return (now.getTime() - t.getTime()) / 60000;
}

function parseEventDateTime(eventDate, serviceTime) {
  if (!eventDate) return null;
  const d = String(eventDate).slice(0, 10);
  let time = String(serviceTime || "10:00").trim();
  const ampm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let hh;
  let mm;
  if (ampm) {
    hh = Number(ampm[1]);
    mm = Number(ampm[2]);
    const ap = ampm[3].toUpperCase();
    if (ap === "PM" && hh < 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
  } else {
    const parts = time.split(":");
    hh = Number(parts[0]);
    mm = Number(parts[1] || 0);
  }
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const iso = `${d}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** ET hour 0–23 via America/New_York. */
function etHour(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    return Number.isFinite(h) ? h % 24 : now.getUTCHours();
  } catch (e) {
    return now.getUTCHours();
  }
}

function inQuietHours(now = new Date()) {
  const h = etHour(now);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/**
 * Whether this ride needs a driver status tap soon enough to nudge.
 * claimed → On the way; on_the_way → Got them; picked_up → At church.
 */
function needsStatusNudge(ride, event, now = new Date()) {
  if (!ride?.driver_id || !OPEN.includes(ride.status)) return null;

  const age = minutesSince(ride.updated_date || ride.created_date, now);
  const eventDt = parseEventDateTime(
    ride.event_date || event?.date,
    event?.service_time || ride.service_time
  );
  const hoursUntil =
    eventDt != null ? (eventDt.getTime() - now.getTime()) / 3600000 : null;

  if (ride.status === "claimed") {
    // Nudge when event is within 3h (or just started), after a short grace.
    const eventSoon =
      hoursUntil != null && hoursUntil <= 3 && hoursUntil > -1.5;
    const aged = age != null && age >= 12;
    if (eventSoon || (aged && hoursUntil != null && hoursUntil <= 6)) {
      return {
        nextLabel: "I'm on the way",
        reason: eventSoon
          ? "claimed_before_event"
          : "claimed_stale",
      };
    }
  }

  if (ride.status === "on_the_way" && age != null && age >= 25) {
    return { nextLabel: "I've got them", reason: "on_the_way_stale" };
  }

  if (ride.status === "picked_up" && age != null && age >= 40) {
    return { nextLabel: "We're at church", reason: "picked_up_stale" };
  }

  return null;
}

function actionCopy(status) {
  if (status === "claimed") return "tap I'm on the way";
  if (status === "on_the_way") return "tap I've got them";
  if (status === "picked_up") return "tap We're at church";
  return "update trip status";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {}

    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run === true;
    const force = body.force === true;

    // Workflows invoke as service (no user). Admins may dry-run / force.
    if (user && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const now = new Date();

    if (!force && inQuietHours(now)) {
      return Response.json({
        ok: true,
        skipped: "quiet_hours",
        reminded: 0,
      });
    }

    const all = await svc.entities.RideRequest.list("-updated_date", 400);
    const open = (all || []).filter(
      (r) => r?.driver_id && OPEN.includes(r.status)
    );

    const events = await svc.entities.Event.list("-date", 80);
    const eventsById = {};
    for (const ev of events || []) eventsById[ev.id] = ev;

    /** @type {Map<string, { rides: object[], nextLabel: string }>} */
    const byDriver = new Map();

    for (const ride of open) {
      const nudge = needsStatusNudge(
        ride,
        ride.event_id ? eventsById[ride.event_id] : null,
        now
      );
      if (!nudge) continue;
      const id = String(ride.driver_id);
      if (!byDriver.has(id)) {
        byDriver.set(id, { rides: [], nextLabel: nudge.nextLabel });
      }
      byDriver.get(id).rides.push(ride);
    }

    let reminded = 0;
    let skipped_opt_out = 0;
    let skipped_no_push = 0;
    let skipped_throttle = 0;
    let failed = 0;
    const details = [];

    for (const [driverId, bundle] of byDriver.entries()) {
      let driver = null;
      try {
        driver = await svc.entities.User.get(driverId);
      } catch (e) {}
      if (!driver) continue;

      // Default ON unless explicitly false
      if (driver.notify_status_reminders === false) {
        skipped_opt_out += 1;
        continue;
      }
      if (driver.notify_web_push === false) {
        skipped_no_push += 1;
        continue;
      }

      const sub = parseSubscription(driver.push_subscription);
      if (!sub?.endpoint) {
        skipped_no_push += 1;
        continue;
      }

      const sinceLast = minutesSince(driver.status_reminder_sent_at, now);
      if (!force && sinceLast != null && sinceLast < THROTTLE_MINUTES) {
        skipped_throttle += 1;
        continue;
      }

      const count = bundle.rides.length;
      const first = bundle.rides[0];
      const rider =
        first?.rider_name ||
        first?.school_name ||
        (count > 1 ? `${count} riders` : "your rider");
      const next = actionCopy(first?.status);
      const title =
        count === 1
          ? "Update trip status"
          : `Update ${count} trip statuses`;
      const pushBody =
        count === 1
          ? `${rider}: ${next}`
          : `${count} claimed rides still need a status tap — open Trips.`;

      if (dry_run) {
        details.push({
          driver_id: driverId,
          dry_run: true,
          ride_ids: bundle.rides.map((r) => r.id),
          title,
          body: pushBody,
        });
        reminded += 1;
        continue;
      }

      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({
            title,
            body: pushBody,
            url: "/driving",
          })
        );
        try {
          await svc.entities.User.update(driverId, {
            status_reminder_sent_at: now.toISOString(),
          });
        } catch (e) {}
        try {
          await svc.entities.SystemLog.create({
            action: "driver_status_reminder",
            summary: `Status reminder → ${driver.legal_name || driver.full_name || driver.email || driverId} (${count} ride(s))`,
            details: JSON.stringify({
              driver_id: driverId,
              ride_ids: bundle.rides.map((r) => r.id),
              statuses: bundle.rides.map((r) => r.status),
            }),
            actor_id: user?.id || "system",
            actor_name: user?.legal_name || user?.full_name || "system",
            actor_role: user?.role || "system",
            entity_type: "User",
            entity_id: driverId,
            zone: "",
          });
        } catch (e) {}
        reminded += 1;
        details.push({
          driver_id: driverId,
          sent: true,
          ride_ids: bundle.rides.map((r) => r.id),
        });
      } catch (err) {
        failed += 1;
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          try {
            await svc.entities.User.update(driverId, { push_subscription: "" });
          } catch (e) {}
        }
        console.error("remindDriverStatusUpdates push", err?.message || err);
        details.push({
          driver_id: driverId,
          sent: false,
          error: err?.message || "send_failed",
        });
      }
    }

    return Response.json({
      ok: true,
      dry_run,
      checked: open.length,
      drivers_needing: byDriver.size,
      reminded,
      skipped_opt_out,
      skipped_no_push,
      skipped_throttle,
      failed,
      details: details.slice(0, 40),
    });
  } catch (error) {
    console.error("remindDriverStatusUpdates", error);
    return Response.json({ error: error?.message || "Failed" }, { status: 500 });
  }
});
