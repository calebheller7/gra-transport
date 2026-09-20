import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { ChevronRight, UserRound, Car } from "lucide-react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { PendingDriverNotice } from "@/components/PendingDriverNotice";
import { PageLoader } from "@/components/PageLoader";
import { cacheActiveRideSnapshot } from "@/lib/pwa";
import { isOperationalRideVisible } from "@/lib/rideVisibility";
import { hasProfileGaps } from "@/lib/roles";
import { ClaimBoard } from "@/components/driver/ClaimBoard";
import { StatusUpdateReminder } from "@/components/driver/StatusUpdateReminder";

const ACTIVE_STATUSES = new Set([
  "claimed",
  "on_the_way",
  "picked_up",
  "arrived",
  "return_needed",
  "returning",
]);

export default function DriverDashboard() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [claimRefreshKey, setClaimRefreshKey] = useState(0);

  async function loadRides() {
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
        } catch (e2) {
          /* keep empty */
        }
      }
      setRides(data || []);
      const active = (data || []).find((r) => ACTIVE_STATUSES.has(r.status));
      cacheActiveRideSnapshot(active || null);
    } catch (e) {
      console.error(e);
      const msg =
        e?.message || e?.response?.data?.error || "Could not load your assignments.";
      setLoadError(msg);
      toast({ title: "Couldn't load assignments", description: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.id) loadRides();
  }, [user]);

  async function refreshHome() {
    await loadRides();
    setClaimRefreshKey((k) => k + 1);
  }

  const activeCount = (rides || []).filter(
    (r) => ACTIVE_STATUSES.has(r.status) && isOperationalRideVisible(r)
  ).length;

  if (loading) {
    return <PageLoader />;
  }

  if (user?.role === "driver" && user?.driver_approved === false) {
    return <PendingDriverNotice />;
  }

  return (
    <div>
      <PullToRefresh onRefresh={refreshHome} />
      {hasProfileGaps(user) && (
        <div className="mx-auto max-w-lg px-4 pt-4">
          <Link
            to="/driver-profile"
            className="mb-2 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 dark:border-amber-500/40 dark:bg-amber-950/40"
          >
            <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-800 dark:text-amber-200" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
                Complete your driver profile
              </p>
              <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
                Add photo, zone, or vehicle so riders can recognize you.
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-amber-800/70 dark:text-amber-200/70" />
          </Link>
        </div>
      )}
      {loadError && (
        <div className="mx-auto max-w-lg px-4 pt-2">
          <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {loadError}
          </div>
        </div>
      )}
      <div className="mx-auto max-w-lg px-4 pt-3">
        <StatusUpdateReminder rides={rides} className="mb-2" />
      </div>
      {activeCount > 0 ? (
        <div className="mx-auto max-w-lg px-4 pt-0">
          <Link
            to="/driving"
            className="mb-2 flex items-center gap-3 rounded-2xl border border-[#E7E2DC] bg-[#231D1A] px-5 py-4 text-white"
          >
            <Car className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">
                {activeCount === 1
                  ? "1 active trip"
                  : `${activeCount} active trips`}
              </p>
              <p className="text-[13px] text-white/70">Open Trips to advance pickups</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/70" />
          </Link>
        </div>
      ) : null}
      <ClaimBoard
        variant="page"
        refreshKey={claimRefreshKey}
        hidePullToRefresh
        title={`Hi ${user?.full_name?.split(" ")[0] || "driver"}`}
      />
    </div>
  );
}
