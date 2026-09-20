import React, { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { subscribeWebPush, unsubscribeWebPush } from "@/lib/pwa";

/** Opt-in browser push for ride updates (works best after installing the app). */
export function PushOptInCard({ compact = false }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const pushOk =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!pushOk) {
        if (!cancelled) setSupported(false);
        return;
      }
      try {
        const me = await base44.auth.me();
        if (!cancelled) setEnabled(!!me.notify_web_push && !!me.push_subscription);
      } catch (e) {}
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next) {
    setBusy(true);
    try {
      if (next) {
        const sub = await subscribeWebPush();
        await base44.auth.updateMe({
          notify_web_push: true,
          push_subscription: JSON.stringify(sub),
        });
        setEnabled(true);
        toast({
          title: "Alerts on",
          description: "We'll notify you about ride assignments and pickup updates.",
        });
      } else {
        await unsubscribeWebPush();
        await base44.auth.updateMe({
          notify_web_push: false,
          push_subscription: "",
        });
        setEnabled(false);
        toast({ title: "Alerts off" });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Couldn't update alerts",
        description: e?.message || "Try again from your browser settings.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    if (compact) return null;
    return (
      <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        Web push isn't available in this browser. Install the app on Android, or use Add to Home Screen on iPhone for quicker access (iOS push support varies by version).
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border bg-card ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {enabled ? (
            <Bell className="mt-0.5 h-4 w-4 text-gold-dark" />
          ) : (
            <BellOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <div className="text-sm font-semibold text-foreground">Ride alerts</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Browser notifications for ride updates — and reminders to tap On the way when you have a claimed trip.
            </p>
          </div>
        </div>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch checked={enabled} onCheckedChange={toggle} aria-label="Toggle ride alerts" />
        )}
      </div>
    </div>
  );
}
