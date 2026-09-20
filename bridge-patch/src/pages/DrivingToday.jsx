import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { PendingDriverNotice } from "@/components/PendingDriverNotice";
import { TodayModeToggle } from "@/components/TodayModeToggle";
import { DriverEventAvailability } from "@/components/DriverEventAvailability";
import { PageLoader } from "@/components/PageLoader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { toast } from "@/components/ui/use-toast";
import { invokeRideTransition } from "@/lib/invokeRideTransition";
import { maybeNotifyReturnNeeded } from "@/lib/notifyReturnNeeded";
import { driverArriveAtChurch } from "@/lib/driverArriveAtChurch";
import { isOperationalRideVisible } from "@/lib/rideVisibility";
import { cacheActiveRideSnapshot } from "@/lib/pwa";
import {
  getDriverActionLabel,
  getDriverSelfNextStatus,
  getNextReturnStatus,
  isBatchArriveEligible,
  isReturnLegActive,
  canDriverReleaseRide,
} from "@/lib/rideConstants";
import { cn } from "@/lib/utils";
import { ReleaseRideSheet } from "@/components/ReleaseRideSheet";
import { StatusUpdateReminder } from "@/components/driver/StatusUpdateReminder";
import {
  Car,
  Check,
  ChevronRight,
  Church,
  Loader2,
  MapPin,
  Navigation,
  UserX,
  Users,
} from "lucide-react";

const ACTIVE_STATUSES = new Set([
  "claimed",
  "on_the_way",
  "picked_up",
  "arrived",
  "return_needed",
  "returning",
]);

function statusLabel(ride) {
  if (!ride) return "";
  if (isReturnLegActive(ride)) {
    const rs = ride.return_status;
    if (rs === "claimed") return "Return claimed";
    if (rs === "on_the_way") return "Heading home";
    if (rs === "picked_up") return "Taking them home";
    return "Return in progress";
  }
  const map = {
    claimed: "Claimed — ready to go",
    on_the_way: "On the way",
    picked_up: "Got them — heading to church",
    arrived: ride.return_ride_needed
      ? (ride.return_timing === "flexible"
          ? "At church — return (flexible)"
          : "At church — return after service")
      : "At church",
    return_needed: "At church — waiting for return",
    returning: "Return in progress",
  };
  return map[ride.status] || String(ride.status || "").replace(/_/g, " ");
}

function rideTitle(ride) {
  if (ride?.is_group_request) {
    return ride.school_name || ride.rider_name || "Group ride";
  }
  return ride?.rider_name || "Rider";
}

/**
 * Active trips for the current driver — per-row + batch status taps.
 * Availability (“I’m driving today”) stays secondary on this screen.
 */
export default function DrivingToday() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [batchBusy, setBatchBusy] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [releaseRide, setReleaseRide] = useState(null);

  function notifyRider(rideId, eventType) {
    base44.functions
      .invoke("notifyRiderUpdate", {
        ride_request_id: rideId,
        event_type: eventType,
      })
      .catch((e) => console.error(e));
  }

  const loadRides = useCallback(async () => {
    setLoadError("");
    try {
      const res = await base44.functions.invoke("listMyDriverRides", {});
      const payload = res?.data || res || {};
      if (payload.error) throw new Error(payload.error);
      let data = Array.isArray(payload.rides) ? payload.rides : [];
      if (!data.length && user?.id) {
        try {
          const direct = await base44.entities.RideRequest.filter(
            { driver_id: user.id },
            "-created_date",
            100
          );
          data = direct || [];
        } catch (_) {
          /* keep empty */
        }
      }
      setRides(data || []);
      const active = (data || []).find((r) => ACTIVE_STATUSES.has(r.status));
      cacheActiveRideSnapshot(active || null);
    } catch (e) {
      console.error(e);
      const msg =
        e?.message || e?.response?.data?.error || "Could not load your trips.";
      setLoadError(msg);
      toast({ title: "Couldn't load trips", description: msg });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) loadRides();
  }, [user?.id, loadRides]);

  const activeTrips = useMemo(() => {
    return (rides || []).filter(
      (r) => ACTIVE_STATUSES.has(r.status) && isOperationalRideVisible(r)
    );
  }, [rides]);

  const claimedForBatch = useMemo(
    () => activeTrips.filter((r) => r.status === "claimed"),
    [activeTrips]
  );
  const batchArriveRides = useMemo(
    () => activeTrips.filter(isBatchArriveEligible),
    [activeTrips]
  );

  async function advanceRide(ride) {
    if (!ride?.id || updatingId || batchBusy) return;
    const toStatus = getDriverSelfNextStatus(ride);
    if (!toStatus) {
      if (ride.status === "return_needed" && !isReturnLegActive(ride)) {
        toast({
          title: "Return not claimed yet",
          description: "Claim the return on Return Queue, then finish from Trips.",
        });
      }
      return;
    }

    setUpdatingId(ride.id);
    try {
      if (toStatus === "completed" && isReturnLegActive(ride)) {
        const nextReturn = getNextReturnStatus(ride.return_status) || "completed";
        const updates = { return_status: nextReturn };
        if (nextReturn === "completed") updates.status = "completed";
        await base44.entities.RideRequest.update(ride.id, updates);
        if (nextReturn === "completed") notifyRider(ride.id, "completed");
        await loadRides();
        toast({ title: "Took them home" });
        return;
      }

      if (toStatus === "on_the_way" && !ride.driver_confirmed) {
        await invokeRideTransition({
          ride_request_id: ride.id,
          action: "confirm_assignment",
        });
      }

      await invokeRideTransition({
        ride_request_id: ride.id,
        to_status: toStatus,
      });
      maybeNotifyReturnNeeded(ride, toStatus);
      if (toStatus === "on_the_way") notifyRider(ride.id, "on_the_way");
      if (toStatus === "completed") notifyRider(ride.id, "completed");
      await loadRides();
    } catch (e) {
      console.error(e);
      toast({
        title: "Couldn't update",
        description: e.message || "Please try again.",
      });
      await loadRides();
    } finally {
      setUpdatingId(null);
    }
  }

  async function batchOnTheWay() {
    const list = claimedForBatch;
    if (list.length < 2 || batchBusy || updatingId) return;
    setBatchBusy("on_the_way");
    let ok = 0;
    try {
      for (const ride of list) {
        try {
          if (!ride.driver_confirmed) {
            await invokeRideTransition({
              ride_request_id: ride.id,
              action: "confirm_assignment",
            });
          }
          await invokeRideTransition({
            ride_request_id: ride.id,
            to_status: "on_the_way",
          });
          notifyRider(ride.id, "on_the_way");
          ok += 1;
        } catch (e) {
          console.error(e);
        }
      }
      toast({
        title: ok ? "On the way" : "Couldn't update",
        description:
          ok === list.length
            ? `Marked ${ok} rides on the way.`
            : ok
              ? `Updated ${ok} of ${list.length}. Check rows that failed.`
              : "Please try again on each ride.",
      });
      await loadRides();
    } finally {
      setBatchBusy(null);
    }
  }

  async function batchArriveAtChurch() {
    const list = batchArriveRides;
    if (list.length < 2 || batchBusy || updatingId) return;
    setBatchBusy("arrived");
    try {
      const data = await driverArriveAtChurch({
        rides: list,
        notifyRider: (rideId, eventType) => notifyRider(rideId, eventType),
      });
      const n = data.count || 0;
      toast({
        title: n ? "At church" : "Nothing to update",
        description:
          data.message ||
          (n === 1 ? "1 rider marked at church." : `${n} riders marked at church.`),
      });
      await loadRides();
    } catch (e) {
      console.error(e);
      toast({
        title: "Couldn't mark at church",
        description: e.message || "Please try again.",
      });
      await loadRides();
    } finally {
      setBatchBusy(null);
    }
  }

  if (user?.role === "driver" && user?.driver_approved === false) {
    return <PendingDriverNotice />;
  }

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-lg px-5 py-6 lg:px-8">
      <PullToRefresh onRefresh={loadRides} />

      <header className="mb-6 space-y-1">
        <p className="bridge-kicker">Assigned rides</p>
        <h1 className="bridge-title">Trips</h1>
        <p className="text-[15px] text-muted-foreground leading-snug">
          Everyone you&apos;re driving right now. Tap the next step on each row — no need to bounce
          in and out.
        </p>
      </header>

      {loadError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {loadError}
        </div>
      ) : null}

      <StatusUpdateReminder rides={activeTrips} className="mb-4" hideCta />

      {(claimedForBatch.length > 1 || batchArriveRides.length > 1) && (
        <div className="mb-4 space-y-2">
          {claimedForBatch.length > 1 ? (
            <button
              type="button"
              disabled={!!batchBusy || !!updatingId}
              onClick={batchOnTheWay}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-[#231D1A] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {batchBusy === "on_the_way" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              On the way (all · {claimedForBatch.length})
            </button>
          ) : null}
          {batchArriveRides.length > 1 ? (
            <button
              type="button"
              disabled={!!batchBusy || !!updatingId}
              onClick={batchArriveAtChurch}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
            >
              {batchBusy === "arrived" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Church className="h-4 w-4" />
              )}
              We&apos;re at church ({batchArriveRides.length})
            </button>
          ) : null}
        </div>
      )}

      {activeTrips.length === 0 ? (
        <div className="mb-6 bridge-panel text-center space-y-3">
          <Car className="mx-auto h-6 w-6 text-[#6B645F]" />
          <p className="bridge-section">No active trips</p>
          <p className="text-[15px] text-muted-foreground">
            Claim open rides on Home — tap a request card there. They show up here so you can run the
            whole car.
          </p>
          <Link
            to="/driver"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#231D1A] px-5 text-[15px] font-semibold text-white"
          >
            Go to Home
          </Link>
        </div>
      ) : (
        <ul className="mb-6 space-y-3">
          {activeTrips.map((ride) => {
            const next = getDriverSelfNextStatus(ride);
            const actionLabel = getDriverActionLabel(ride, next);
            const busy = updatingId === ride.id;
            const waitingReturn =
              ride.status === "return_needed" && !isReturnLegActive(ride);

            return (
              <li
                key={ride.id}
                className="bridge-panel p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-tight text-foreground">
                      {rideTitle(ride)}
                    </p>
                    {ride.is_group_request && Number(ride.student_count) > 0 ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#B30000]">
                        <Users className="h-3.5 w-3.5" />
                        {Math.floor(Number(ride.student_count))} students · one tap advances all
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {statusLabel(ride)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ride.event_title || "Service"}
                    </p>
                    {ride.pickup_address ? (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="line-clamp-2">{ride.pickup_address}</span>
                      </p>
                    ) : null}
                  </div>
                  <Link
                    to={`/trip-focus/${ride.id}`}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                    aria-label={`Trip details for ${rideTitle(ride)}`}
                  >
                    Details
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {waitingReturn ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Return ride is queued. Claim it on Return Queue when you&apos;re ready.
                    </p>
                    <Link
                      to="/return-queue"
                      className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground"
                    >
                      Open return queue
                    </Link>
                  </div>
                ) : actionLabel ? (
                  <button
                    type="button"
                    disabled={!!updatingId || !!batchBusy}
                    onClick={() => advanceRide(ride)}
                    className={cn(
                      "mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold text-white disabled:opacity-60",
                      next === "arrived" || next === "completed"
                        ? "bg-[#1F7A4D]"
                        : "bg-[#231D1A]"
                    )}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
                  </button>
                ) : (
                  <div className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 text-sm font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Check className="h-4 w-4" />
                    Waiting on next step
                  </div>
                )}

                {canDriverReleaseRide(ride, user?.id) ? (
                  <button
                    type="button"
                    disabled={!!updatingId || !!batchBusy}
                    onClick={() => setReleaseRide(ride)}
                    className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Can't fulfill — release
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <details className="rounded-2xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          I&apos;m driving today — set availability
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Mark which services you can cover. This is separate from running your active trips
            above.
          </p>
          <TodayModeToggle />
          <DriverEventAvailability />
        </div>
      </details>

      <ReleaseRideSheet
        ride={releaseRide}
        open={!!releaseRide}
        onClose={() => setReleaseRide(null)}
        onReleased={loadRides}
      />
    </div>
  );
}
