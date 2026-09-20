import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Phone, Car, Bell, Save, Loader2, CheckCircle2, Trash2, Camera } from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { PageLoader } from "@/components/PageLoader";
import { BottomSheetSelect } from "@/components/BottomSheetSelect";
import { ProfilePhotoPicker } from "@/components/ProfilePhotoPicker";
import {
  VEHICLE_TYPES,
  VEHICLE_COLORS,
  VEHICLE_CAPACITY_OPTIONS,
  formatVehicleDescription,
  parseVehicleDescription,
} from "@/lib/rideConstants";
import { VEHICLE_MAKES, vehicleModelOptions } from "@/lib/vehicleData";
import { toast } from "@/components/ui/use-toast";
import { PushOptInCard } from "@/components/PushOptInCard";
import { DriverPreferencesPanel } from "@/components/DriverPreferencesPanel";
import { useAuth } from "@/lib/AuthContext";
import { validatePersonName, PERSON_NAME_HINT, getUserDisplayName } from "@/lib/personName";

export default function DriverProfile() {
  const { user, checkUserAuth } = useAuth();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    baptism_name: "",
    phone: "",
    vehicle_type: "",
    vehicle_color: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_capacity: "4",
    is_active_driver: true,
    notify_new_rides: false,
    notify_return_queue: false,
    notify_status_reminders: true,
  });

  const modelOptions = useMemo(() => vehicleModelOptions(form.vehicle_make), [form.vehicle_make]);
  const previewLabel = formatVehicleDescription({
    color: form.vehicle_color,
    make: form.vehicle_make,
    model: form.vehicle_model,
    type: form.vehicle_type,
  });

  async function handlePhotoUpload(file) {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      if (result?.file_url) {
        await base44.auth.updateMe({ profile_photo: result.file_url });
        await checkUserAuth?.();
        toast({ title: "Photo updated" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Photo upload failed", description: "Please try again." });
    } finally {
      setPhotoUploading(false);
    }
  }

  useEffect(() => {
    loadUser();
    base44.entities.Zone.list("name", 200).then(setZones).catch(() => {});
  }, []);

  async function loadUser() {
    try {
      const me = await base44.auth.me();
      const parsed = parseVehicleDescription(me.vehicle_description);
      const make = me.vehicle_make || parsed.make || "";
      const model = me.vehicle_model || parsed.model || "";
      const color = me.vehicle_color || parsed.color || "";
      setForm({
        full_name: getUserDisplayName(me, ""),
        baptism_name: me.baptism_name || "",
        phone: me.phone || "",
        vehicle_type: parsed.type || "",
        vehicle_color: color,
        vehicle_make: make,
        vehicle_model: model,
        vehicle_capacity: String(me.vehicle_capacity || 4),
        is_active_driver: me.is_active_driver ?? true,
        notify_new_rides: me.notify_new_rides === true,
        notify_return_queue: me.notify_return_queue === true,
        notify_status_reminders: me.notify_status_reminders !== false,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const nameCheck = validatePersonName(form.full_name, { email: user?.email });
    if (!nameCheck.ok) {
      toast({
        title: "Need a real first and last name",
        description: nameCheck.error || PERSON_NAME_HINT,
      });
      return;
    }
    const colorOk =
      form.vehicle_color &&
      form.vehicle_color !== "Other" &&
      String(form.vehicle_color).trim();
    const makeOk =
      form.vehicle_make &&
      form.vehicle_make !== "Other" &&
      String(form.vehicle_make).trim();
    const modelOk =
      form.vehicle_model &&
      form.vehicle_model !== "Other" &&
      String(form.vehicle_model).trim();
    if (!makeOk || !modelOk || !colorOk) {
      toast({
        title: "Vehicle details required",
        description:
          !colorOk && form.vehicle_color === "Other"
            ? "Please type your car color (Other is selected)."
            : "Please select make, model, and color so riders can recognize your car.",
      });
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const vehicle_description = formatVehicleDescription({
        type: form.vehicle_type,
        color: form.vehicle_color,
        make: form.vehicle_make,
        model: form.vehicle_model,
      });
      // full_name is platform-readonly; updateMyProfile persists legal_name + vehicle fields.
      const res = await base44.functions.invoke("updateMyProfile", {
        full_name: nameCheck.name,
        baptism_name: form.baptism_name,
        phone: form.phone,
        vehicle_capacity: Number(form.vehicle_capacity) || 4,
        vehicle_make: form.vehicle_make,
        vehicle_model: form.vehicle_model,
        vehicle_color: form.vehicle_color,
        vehicle_description,
        is_active_driver: form.is_active_driver,
        notify_new_rides: form.notify_new_rides,
        notify_return_queue: form.notify_return_queue,
        notify_status_reminders: form.notify_status_reminders,
      });
      const errMsg = res?.data?.error || res?.error;
      if (errMsg) {
        toast({ title: "Couldn't save", description: String(errMsg) });
        return;
      }
      // Non-name prefs that updateMe still owns (updateMyProfile covers the critical fields above)
      try {
        await base44.auth.updateMe({
          baptism_name: form.baptism_name,
          phone: form.phone,
          vehicle_capacity: Number(form.vehicle_capacity) || 4,
          vehicle_make: form.vehicle_make,
          vehicle_model: form.vehicle_model,
          vehicle_color: form.vehicle_color,
          vehicle_description,
          is_active_driver: form.is_active_driver,
          notify_new_rides: form.notify_new_rides,
          notify_return_queue: form.notify_return_queue,
          notify_status_reminders: form.notify_status_reminders,
        });
      } catch (prefErr) {
        console.warn("updateMe vehicle prefs", prefErr);
      }
      setForm((prev) => ({ ...prev, full_name: nameCheck.name }));
      try { await checkUserAuth?.(); } catch (e) {}
      setSaved(true);
      toast({ title: "Profile saved", description: nameCheck.name });
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
      const serverMsg =
        e?.data?.error ||
        e?.response?.data?.error ||
        e?.message ||
        "Please try again.";
      toast({ title: "Couldn't save", description: String(serverMsg) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await base44.functions.invoke("deleteMyAccount", {});
      await base44.auth.logout("/");
    } catch (e) {
      console.error(e);
      alert("Could not delete your account. Please contact an administrator to remove it.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:py-8">
      <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update your contact details, vehicle info, and notification preferences.
      </p>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Profile photo</h2>
          </div>
          <ProfilePhotoPicker
            photoUrl={user?.profile_photo}
            name={form.full_name || user?.full_name}
            uploading={photoUploading}
            onFile={handlePhotoUpload}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Contact</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="First and last name"
                required
              />
              <p className="text-xs text-muted-foreground">{PERSON_NAME_HINT}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="baptism_name">Baptism name (optional)</Label>
              <Input
                id="baptism_name"
                value={form.baptism_name}
                onChange={(e) => setForm({ ...form, baptism_name: e.target.value })}
                placeholder="Spiritual / baptism name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(443) 555-0100"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Vehicle</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Riders see your car details when you pick them up — make, model, and color are required.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Make *</Label>
              <BottomSheetSelect
                value={VEHICLE_MAKES.some((m) => m.value === form.vehicle_make) ? form.vehicle_make : (form.vehicle_make ? "Other" : "")}
                onChange={(v) => setForm({ ...form, vehicle_make: v === "Other" ? "Other" : v, vehicle_model: "" })}
                placeholder="Search make..."
                title="Select make"
                searchable
                options={VEHICLE_MAKES}
              />
              {(form.vehicle_make === "Other" || (form.vehicle_make && !VEHICLE_MAKES.some((m) => m.value === form.vehicle_make))) && (
                <Input
                  className="h-12"
                  placeholder="Type your vehicle make"
                  value={form.vehicle_make === "Other" ? "" : form.vehicle_make}
                  onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Model *</Label>
              <BottomSheetSelect
                value={modelOptions.some((m) => m.value === form.vehicle_model) ? form.vehicle_model : (form.vehicle_model ? "Other" : "")}
                onChange={(v) => setForm({ ...form, vehicle_model: v === "Other" ? "Other" : v })}
                placeholder={form.vehicle_make ? "Search model..." : "Select make first"}
                title={form.vehicle_make ? `${form.vehicle_make} models` : "Select model"}
                searchable
                options={modelOptions}
              />
              {(form.vehicle_model === "Other" || (form.vehicle_model && form.vehicle_make && !modelOptions.some((m) => m.value === form.vehicle_model))) && (
                <Input
                  className="h-12"
                  placeholder="Type your vehicle model"
                  value={form.vehicle_model === "Other" ? "" : form.vehicle_model}
                  onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Color *</Label>
              <BottomSheetSelect
                value={VEHICLE_COLORS.some((c) => c.value === form.vehicle_color) ? form.vehicle_color : (form.vehicle_color ? "Other" : "")}
                onChange={(v) => setForm({ ...form, vehicle_color: v === "Other" ? "Other" : v })}
                placeholder="Select color"
                title="Vehicle color"
                searchable
                options={VEHICLE_COLORS}
              />
              {(form.vehicle_color === "Other" || (form.vehicle_color && !VEHICLE_COLORS.some((c) => c.value === form.vehicle_color))) && (
                <Input
                  className="h-12"
                  placeholder="Type your vehicle color"
                  value={form.vehicle_color === "Other" ? "" : form.vehicle_color}
                  onChange={(e) => setForm({ ...form, vehicle_color: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Vehicle type</Label>
              <BottomSheetSelect
                value={form.vehicle_type}
                onChange={(v) => setForm({ ...form, vehicle_type: v })}
                placeholder="Select vehicle type"
                title="Vehicle type"
                options={VEHICLE_TYPES}
              />
            </div>
            <div className="space-y-2">
              <Label>Seat capacity (excluding driver)</Label>
              <BottomSheetSelect
                value={form.vehicle_capacity}
                onChange={(v) => setForm({ ...form, vehicle_capacity: v })}
                placeholder="Select capacity"
                title="Seat capacity"
                options={VEHICLE_CAPACITY_OPTIONS}
              />
              <p className="text-xs text-muted-foreground">
                Cars are usually 3–7 seats. Driving a van? Choose up to 15 so you can claim large group rides.
              </p>
            </div>
            {previewLabel && (
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Riders will see</div>
                <div className="mt-0.5 text-sm font-semibold text-foreground">{previewLabel}</div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label>Available to drive</Label>
                <p className="text-xs text-muted-foreground">Toggle off if you're temporarily unavailable</p>
              </div>
              <Switch
                checked={form.is_active_driver}
                onCheckedChange={(v) => setForm({ ...form, is_active_driver: v })}
              />
            </div>
          </div>
        </Card>

        <DriverPreferencesPanel
          user={user}
          zones={zones}
          onSaved={() => checkUserAuth?.()}
        />

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>New ride request emails</Label>
                <p className="text-xs text-muted-foreground">Optional email — web push is preferred when enabled</p>
              </div>
              <Switch
                checked={form.notify_new_rides}
                onCheckedChange={(v) => setForm({ ...form, notify_new_rides: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Return queue emails</Label>
                <p className="text-xs text-muted-foreground">Optional email for return rides in your zone</p>
              </div>
              <Switch
                checked={form.notify_return_queue}
                onCheckedChange={(v) => setForm({ ...form, notify_return_queue: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Remind me to update trip status</Label>
                <p className="text-xs text-muted-foreground">
                  Push nudge when a claimed ride still needs On the way / Got them / At church. Turn on Web push below.
                </p>
              </div>
              <Switch
                checked={form.notify_status_reminders}
                onCheckedChange={(v) => setForm({ ...form, notify_status_reminders: v })}
              />
            </div>
          </div>
          <div className="mt-4">
            <PushOptInCard compact />
          </div>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving} className="h-11">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save changes
              </>
            )}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 font-medium dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              Saved!
            </span>
          )}
        </div>
      </form>

      <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-500/10">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-300" />
          <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Delete Account</h2>
        </div>
        <p className="mt-1 text-sm text-red-600 dark:text-red-300">
          Permanently delete your account, driver profile, and personal info from past rides, then sign out. This action cannot be undone.
        </p>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4" type="button">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account, remove your profile data, and scrub your name and contact info from your ride history, then sign you out. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
