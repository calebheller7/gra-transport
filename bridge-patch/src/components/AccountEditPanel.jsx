import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BottomSheetSelect } from "@/components/BottomSheetSelect";
import { zoneOptions, VEHICLE_COLORS, VEHICLE_CAPACITY_OPTIONS } from "@/lib/rideConstants";
import { VEHICLE_MAKES, vehicleModelOptions } from "@/lib/vehicleData";
import { toast } from "@/components/ui/use-toast";
import { validatePersonName, getUserDisplayName } from "@/lib/personName";
import { Loader2, Save, X, Crown, PauseCircle } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import { canManageFavoriteRiders } from "@/lib/roles";
import { useAuth } from "@/lib/AuthContext";

const OWNER_EMAIL = "caleb.heller13@gmail.com";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "driver", label: "Driver" },
  { value: "rider", label: "Rider" },
];

const MODE_OPTIONS = [
  { value: "driving", label: "Driving today" },
  { value: "riding", label: "Need a ride today" },
];

function looksLikeUsername(name, email) {
  const check = validatePersonName(name, { email });
  return !check.ok;
}

export function AccountEditPanel({ account, zones = [], onClose, onSaved }) {
  const { user: me } = useAuth();
  const isOwner = (account?.email || "").toLowerCase() === OWNER_EMAIL;
  const canFavorite =
    canManageFavoriteRiders(me) &&
    account?.id &&
    account.id !== me?.id &&
    (account.role === "rider" || !!account.phone);
  const [saving, setSaving] = useState(false);
  const [suggestedName, setSuggestedName] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    baptism_name: "",
    phone: "",
    role: "rider",
    assigned_zone: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_color: "",
    vehicle_capacity: "4",
    is_active_driver: false,
    driver_approved: true,
    notify_new_rides: false,
    notify_return_queue: false,
    notify_web_push: false,
    notify_status_reminders: true,
    today_mode: "driving",
    account_disabled: false,
    account_disabled_reason: "",
    sunday_rides_only: false,
    mega_exploits_only: false,
  });

  useEffect(() => {
    if (!account) return;
    setForm({
      full_name: getUserDisplayName(account, ""),
      baptism_name: account.baptism_name || "",
      phone: account.phone || "",
      role: account.role || "rider",
      assigned_zone: account.assigned_zone || "",
      vehicle_make: account.vehicle_make || "",
      vehicle_model: account.vehicle_model || "",
      vehicle_color: account.vehicle_color || "",
      vehicle_capacity: String(account.vehicle_capacity || 4),
      is_active_driver: !!account.is_active_driver,
      driver_approved: account.driver_approved !== false,
      notify_new_rides: account.notify_new_rides === true,
      notify_return_queue: account.notify_return_queue === true,
      notify_web_push: !!account.notify_web_push,
      notify_status_reminders: account.notify_status_reminders !== false,
      today_mode: account.today_mode === "riding" ? "riding" : "driving",
      account_disabled: !!account.account_disabled,
      account_disabled_reason: account.account_disabled_reason || "",
      sunday_rides_only: !!account.sunday_rides_only,
      mega_exploits_only: !!account.mega_exploits_only,
    });
    setSuggestedName("");

    let cancelled = false;
    (async () => {
      try {
        let rides = [];
        try {
          rides = await base44.entities.RideRequest.filter(
            { user_id: account.id },
            "-created_date",
            10
          );
        } catch {
          rides = [];
        }
        // Fallback: match by email on recent rides (admin list)
        if (!rides?.length && account.email) {
          try {
            const recent = await base44.entities.RideRequest.list("-created_date", 100);
            const email = String(account.email).toLowerCase();
            rides = (recent || []).filter(
              (r) => String(r.rider_email || "").toLowerCase() === email || r.user_id === account.id
            );
          } catch {
            rides = [];
          }
        }
        const fromRide = (rides || []).find((r) => {
          const n = String(r.rider_name || "").trim();
          return n && validatePersonName(n, { email: account.email }).ok;
        });
        if (!cancelled && fromRide?.rider_name) {
          setSuggestedName(String(fromRide.rider_name).trim());
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  const modelOptions = useMemo(() => vehicleModelOptions(form.vehicle_make), [form.vehicle_make]);
  const zoneOpts = useMemo(
    () => [{ value: "", label: "No zone" }, ...zoneOptions(zones)],
    [zones]
  );
  const canDrive = form.role === "driver" || form.role === "admin";
  const nameIsBad = looksLikeUsername(form.full_name, account?.email);

  if (!account) return null;

  function setField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "role" && value === "rider") {
        next.today_mode = "riding";
        next.is_active_driver = false;
      }
      return next;
    });
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    if (isOwner && form.role !== "admin") {
      toast({ title: "Owner stays admin", description: "Don't demote the app owner account." });
      return;
    }
    const nameCheck = validatePersonName(form.full_name, { email: account.email });
    if (!nameCheck.ok) {
      toast({
        title: "Need a real first and last name",
        description:
          nameCheck.error +
          (suggestedName ? ` Tip: tap “Use ${suggestedName}”.` : " Example: Mya Bennett"),
      });
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("adminUpdateUser", {
        user_id: account.id,
        full_name: nameCheck.name,
        baptism_name: form.baptism_name,
        phone: form.phone,
        role: form.role || "rider",
        assigned_zone: form.assigned_zone,
        vehicle_make: form.vehicle_make,
        vehicle_model: form.vehicle_model,
        vehicle_color: form.vehicle_color,
        vehicle_capacity: Number(form.vehicle_capacity) || 4,
        is_active_driver: canDrive ? form.is_active_driver : false,
        driver_approved: canDrive ? form.driver_approved : form.driver_approved,
        notify_new_rides: canDrive ? form.notify_new_rides : false,
        notify_return_queue: canDrive ? form.notify_return_queue : false,
        notify_web_push: form.notify_web_push,
        notify_status_reminders: canDrive ? form.notify_status_reminders : false,
        today_mode: canDrive ? form.today_mode : "riding",
        account_disabled: isOwner ? false : form.account_disabled,
        account_disabled_reason: form.account_disabled_reason,
        sunday_rides_only: isOwner ? false : form.sunday_rides_only,
        mega_exploits_only: canDrive ? form.mega_exploits_only : false,
      });
      const updated =
        res?.data?.user ||
        res?.user ||
        { ...account, ...form, full_name: nameCheck.name, role: form.role || "rider", vehicle_capacity: Number(form.vehicle_capacity) || 4 };
      toast({
        title: form.account_disabled ? "Account paused" : "Profile saved",
        description: form.account_disabled
          ? `${nameCheck.name || account.email} can't request rides until you restore access.`
          : nameCheck.name,
      });
      onSaved?.(updated);
    } catch (err) {
      console.error(err);
      const serverMsg =
        err?.data?.error ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Please try again.";
      toast({
        title: "Couldn't save profile",
        description: serverMsg,
      });
    } finally {
      setSaving(false);
    }
  }

  async function applySuggestedNameAndSave() {
    if (!suggestedName) return;
    const nameCheck = validatePersonName(suggestedName, { email: account.email });
    if (!nameCheck.ok) {
      toast({ title: "Suggested name still invalid", description: nameCheck.error });
      return;
    }
    setForm((prev) => ({ ...prev, full_name: nameCheck.name, role: prev.role || "rider" }));
    // Save on next tick so form state is applied
    setSaving(true);
    try {
      const res = await base44.functions.invoke("adminUpdateUser", {
        user_id: account.id,
        full_name: nameCheck.name,
        phone: form.phone,
        role: form.role || "rider",
        assigned_zone: form.assigned_zone,
        today_mode: "riding",
        is_active_driver: false,
      });
      const updated =
        res?.data?.user ||
        res?.user ||
        { ...account, full_name: nameCheck.name, role: form.role || "rider", phone: form.phone };
      toast({ title: "Profile saved", description: nameCheck.name });
      onSaved?.(updated);
    } catch (err) {
      console.error(err);
      toast({
        title: "Couldn't save profile",
        description: err?.data?.error || err?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${account.full_name || account.email}`}
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <ProfileAvatar photoUrl={account.profile_photo} name={account.full_name || account.email} size="h-9 w-9" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">{account.full_name || "Edit account"}</h2>
                <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                {canFavorite && (
                  <div className="mt-1.5">
                    <FavoriteToggle riderUserId={account.id} size="sm" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Close editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {isOwner && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <Crown className="h-3.5 w-3.5" />
              App owner — role cannot be demoted
            </div>
          )}

          {nameIsBad && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">Fix the name before saving</p>
              <p className="mt-1 text-xs opacity-90">
                This account still uses an email username (`{account.full_name || "…"}`). Enter a real first and last
                name (letters only), then tap Save. Role is already set when you pick Rider.
              </p>
              {suggestedName ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={applySuggestedNameAndSave}
                  className="mt-2 inline-flex items-center rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-amber-50 dark:bg-amber-200 dark:text-amber-950"
                >
                  {saving ? "Saving…" : `Use “${suggestedName}” and save`}
                </button>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit_full_name">Legal / full name</Label>
            <Input
              id="edit_full_name"
              value={form.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              placeholder={suggestedName || "First and last name"}
              autoComplete="name"
            />
            <p className="text-xs text-muted-foreground">
              Must be first and last name — not an email username. Example: Mya Bennett
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_baptism_name">Baptism name (optional)</Label>
            <Input
              id="edit_baptism_name"
              value={form.baptism_name}
              onChange={(e) => setField("baptism_name", e.target.value)}
              placeholder="If different from legal name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_phone">Phone</Label>
            <Input
              id="edit_phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="(443) 555-0100"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            {isOwner ? (
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium capitalize">
                Admin (owner)
              </div>
            ) : (
              <BottomSheetSelect
                value={form.role}
                onChange={(v) => setField("role", v)}
                title="Set role"
                options={ROLE_OPTIONS}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Assigned zone</Label>
            <BottomSheetSelect
              value={form.assigned_zone}
              onChange={(v) => setField("assigned_zone", v)}
              title="Assigned zone"
              options={zoneOpts}
              searchable
            />
          </div>

          {!isOwner && (
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PauseCircle className="h-4 w-4" />
                Account access
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm">Pause account</div>
                  <p className="text-xs text-muted-foreground">
                    Keeps their profile but blocks ride requests and app use. They see a calm paused screen — not your
                    private note.
                  </p>
                </div>
                <Switch
                  checked={form.account_disabled}
                  onCheckedChange={(v) => setField("account_disabled", v)}
                />
              </div>
              {form.account_disabled && (
                <div className="space-y-2">
                  <Label htmlFor="edit_pause_reason">Private reason (admins only)</Label>
                  <Input
                    id="edit_pause_reason"
                    value={form.account_disabled_reason}
                    onChange={(e) => setField("account_disabled_reason", e.target.value)}
                    placeholder="e.g. Family asked — Sundays only / stay home for now"
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <div>
                  <div className="text-sm">Sundays only</div>
                  <p className="text-xs text-muted-foreground">
                    Can request rides for Sunday services only — no midweek, revival, conference, or other special
                    events.
                  </p>
                </div>
                <Switch
                  checked={form.sunday_rides_only}
                  onCheckedChange={(v) => setField("sunday_rides_only", v)}
                  disabled={form.account_disabled}
                />
              </div>
            </div>
          )}

          {canDrive && (
            <div className="space-y-2">
              <Label>Today mode</Label>
              <BottomSheetSelect
                value={form.today_mode}
                onChange={(v) => setField("today_mode", v)}
                title="Today mode"
                options={MODE_OPTIONS}
              />
            </div>
          )}

          {canDrive && (
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="text-sm font-semibold text-foreground">Driver settings</div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm">Driver approved</div>
                  <p className="text-xs text-muted-foreground">Required before claiming rides</p>
                </div>
                <Switch
                  checked={form.driver_approved}
                  onCheckedChange={(v) => setField("driver_approved", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm">Mega Exploits only</div>
                  <p className="text-xs text-muted-foreground">
                    Available Rides shows only Mega Exploits nights (Oct 15–18) — not Sunday 1st/2nd/3rd.
                  </p>
                </div>
                <Switch
                  checked={form.mega_exploits_only}
                  onCheckedChange={(v) => setField("mega_exploits_only", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm">Available to drive</div>
                  <p className="text-xs text-muted-foreground">Shows in dispatch matching</p>
                </div>
                <Switch
                  checked={form.is_active_driver}
                  onCheckedChange={(v) => setField("is_active_driver", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Make</Label>
                <BottomSheetSelect
                  value={form.vehicle_make}
                  onChange={(v) => setForm((prev) => ({ ...prev, vehicle_make: v, vehicle_model: "" }))}
                  title="Vehicle make"
                  searchable
                  options={VEHICLE_MAKES}
                  placeholder="Select make"
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <BottomSheetSelect
                  value={form.vehicle_model}
                  onChange={(v) => setField("vehicle_model", v)}
                  title="Vehicle model"
                  searchable
                  options={modelOptions}
                  placeholder={form.vehicle_make ? "Select model" : "Select make first"}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <BottomSheetSelect
                  value={VEHICLE_COLORS.some((c) => c.value === form.vehicle_color) ? form.vehicle_color : (form.vehicle_color ? "Other" : "")}
                  onChange={(v) => setField("vehicle_color", v === "Other" ? "Other" : v)}
                  title="Vehicle color"
                  searchable
                  options={VEHICLE_COLORS}
                />
                {(form.vehicle_color === "Other" || (form.vehicle_color && !VEHICLE_COLORS.some((c) => c.value === form.vehicle_color))) && (
                  <Input
                    className="h-12"
                    placeholder="Type vehicle color"
                    value={form.vehicle_color === "Other" ? "" : form.vehicle_color}
                    onChange={(e) => setField("vehicle_color", e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Seat capacity</Label>
                <BottomSheetSelect
                  value={form.vehicle_capacity}
                  onChange={(v) => setField("vehicle_capacity", v)}
                  title="Seat capacity"
                  options={VEHICLE_CAPACITY_OPTIONS}
                />
                <p className="text-xs text-muted-foreground">
                  Vans: select up to 15 passenger seats for large group claims.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="text-sm font-semibold text-foreground">Notifications</div>
            {canDrive && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">New ride emails</div>
                  <Switch
                    checked={form.notify_new_rides}
                    onCheckedChange={(v) => setField("notify_new_rides", v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">Return queue emails</div>
                  <Switch
                    checked={form.notify_return_queue}
                    onCheckedChange={(v) => setField("notify_return_queue", v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">Remind to update trip status</div>
                  <Switch
                    checked={form.notify_status_reminders}
                    onCheckedChange={(v) => setField("notify_status_reminders", v)}
                  />
                </div>
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">Web push</div>
              <Switch
                checked={form.notify_web_push}
                onCheckedChange={(v) => setField("notify_web_push", v)}
              />
            </div>
          </div>

          <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3">
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 gap-2" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
            {nameIsBad && (
              <p className="mt-2 text-center text-[0.7rem] text-amber-700 dark:text-amber-200">
                Change the name to first + last (or tap the yellow button above) to enable Save.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
