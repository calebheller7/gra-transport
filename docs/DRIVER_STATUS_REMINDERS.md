# Driver trip status reminders

Shipped in Bridge GRA (Base44 app `6a5ee47965b6ed96aa85b292`) so drivers like Jane get nudged to tap **On the way / I've got them / We're at church**.

## How Jane turns it on

1. Open **Driver Profile** (`/driver-profile`).
2. Under **Notifications**, leave **Remind me to update trip status** on (default).
3. Turn on **Ride alerts** (web push) in the same section — allow notifications when the browser asks.
4. Install Bridge / Add to Home Screen when possible so push works reliably on phones.

## What she receives

- **In-app banner** on Driver Home and Trips whenever she has claimed rides that still need a status tap (dismissible for 2 hours).
- **Push notification** every ~20 minutes (6am–11pm ET) when she has rides needing a tap, throttled to at most once per 40 minutes, linking to `/driving`. Quiet hours 11pm–6am ET. Subsequent stale `on_the_way` / `picked_up` also nudge.

## Turn off

Toggle **Remind me to update trip status** off on Driver Profile (or an admin can via Account edit).

## Implementation

- User fields: `notify_status_reminders` (default true), `status_reminder_sent_at`
- Backend: `remindDriverStatusUpdates`
- Workflow: `Driver Status Reminders` (`*/20 6-22 * * *` America/New_York)
- UI: `StatusUpdateReminder` on DriverDashboard + DrivingToday; toggle on DriverProfile + AccountEditPanel

Checkpoint: `6ab02f6cfcbebd62dafe0bf1` (status reminders). Production redeployed 2026-09-20 to https://bridge-gra.base44.app — Jane can use it after a refresh / re-open of the app.
