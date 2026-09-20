import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Navigation, X } from "lucide-react";
import { getDriverActionLabel, getDriverSelfNextStatus } from "@/lib/rideConstants";
import { isOperationalRideVisible } from "@/lib/rideVisibility";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "bridge_status_reminder_dismissed_until";
const DISMISS_MS = 2 * 60 * 60 * 1000; // 2 hours

const NUDGE_STATUSES = new Set(["claimed", "on_the_way", "picked_up"]);

function isDismissed() {
  try {
    const until = Number(sessionStorage.getItem(DISMISS_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function dismissForSession() {
  try {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
  } catch {
    /* ignore */
  }
}

/**
 * In-app nudge when the driver has claimed rides that still need
 * On the way / Got them / At church taps.
 */
export function StatusUpdateReminder({
  rides = [],
  className,
  compact = false,
  /** When true, skip the Open Trips CTA (already on Trips). */
  hideCta = false,
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isDismissed());
  }, []);

  const needing = useMemo(() => {
    return (rides || []).filter((r) => {
      if (!r || !NUDGE_STATUSES.has(r.status)) return false;
      if (!isOperationalRideVisible(r)) return false;
      return !!getDriverSelfNextStatus(r);
    });
  }, [rides]);

  if (hidden || needing.length === 0) return null;

  const first = needing[0];
  const next = getDriverSelfNextStatus(first);
  const action = getDriverActionLabel(first, next) || "Update status";
  const name =
    first?.is_group_request
      ? first.school_name || first.rider_name || "Group ride"
      : first?.rider_name || "your rider";

  const title =
    needing.length === 1
      ? `Still need to tap status for ${name}`
      : `${needing.length} rides still need a status update`;
  const body =
    needing.length === 1
      ? `Open Trips and tap “${action}” so riders get notified.`
      : `Start with “${action}” on Trips — riders rely on these taps.`;

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3.5 dark:border-amber-500/40 dark:bg-amber-950/40",
        className
      )}
      role="status"
    >
      <button
        type="button"
        aria-label="Dismiss reminder"
        onClick={() => {
          dismissForSession();
          setHidden(true);
        }}
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-amber-900/60 hover:bg-amber-100 dark:text-amber-100/70 dark:hover:bg-amber-900/40"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        {compact ? (
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200" />
        ) : (
          <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-amber-800 dark:text-amber-200" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">{title}</p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">{body}</p>
          {!hideCta ? (
            <Link
              to="/driving"
              className="mt-2.5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#231D1A] px-4 text-sm font-semibold text-white"
            >
              Open Trips
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default StatusUpdateReminder;
