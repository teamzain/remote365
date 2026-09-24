# Remote 365 — Backlog

> **Superseded 2026-07-29 — tracking moved to Linear.**
> Project: **Remote 365 — Fleet Reliability** (team `ZAI`)
> https://linear.app/zain-ul-abidden/project/remote-365-fleet-reliability-991100fff61a
>
> Every item below now lives as a Linear issue (`ZAI-5` … `ZAI-14`). Update
> Linear, not this file. Kept only as a snapshot of how the list started.

**Conventions**
- Status: `TODO` · `IN PROGRESS` · `BLOCKED` · `DONE` (move to Done log, newest first)
- Priority: `P0` drop-everything · `P1` this week · `P2` soon · `P3` someday
- Keep one line per item plus a *why it matters* — an item nobody can act on is noise.
- Dates are absolute (YYYY-MM-DD). Last updated: 2026-07-29.

---

## P0 — Validate what just shipped

### 1. Pre-logon reboot test (v1.2.64/65) — `TODO`
Never run on real hardware. Sign in once with the app running, confirm
`C:\ProgramData\Remote365\unattended-host.json` exists, reboot, leave at the
Windows sign-in screen, confirm the device reports **Online** and is connectable.
*Why:* the entire point of the 2026-07-29 work. Until this passes, "devices come
back after a reboot" is a claim, not a fact. Evidence lives in
`C:\ProgramData\Remote365InputSvc.log` (`[prelogon] host started`) and the
SYSTEM-profile app log.

### 2. Service-supervised relaunch test (v1.2.65) — `TODO`
Kill the app, confirm the service brings it back within ~60s and logs
`[supervise] app was not running — relaunched in session N`.
*Why:* this is PV1's only viable recovery path — its scheduled task can't be
created by the app at all.

---

## P1 — Fleet reliability

### 3. Why does PV1 block `schtasks` from the app? — `TODO`
`[KeepAlive] Failed to arm task: spawn EPERM` survived a full uninstall, wiped
`%APPDATA%`, and a fresh 1.2.64 install. Identify the AV/EDR product or policy.
A vendor exclusion would fix the whole fleet at once.
*Why:* if task creation is banned fleet-wide, the v1.2.65 service supervisor is
load-bearing rather than a nice-to-have — worth knowing which.

### 4. Unidentified elevated Remote 365 process on PV1 — `TODO`
PID 14804 survived `Stop-Process -Force` from the user's own shell, held the
install directory, and blocked every update. Cleared by the reinstall before we
captured its owner. If another appears, grab
`Get-CimInstance Win32_Process | Invoke-CimMethod GetOwner` before killing it.
*Why:* if something launches the app elevated or as SYSTEM on this fleet, it will
recur and silently block updates again.

### 5. Machine-credential file can't be rewritten by non-admin users — `TODO`
`unattendedHost.ts` hardens `unattended-host.json` to SYSTEM+Administrators via
icacls. On a machine where the signed-in user is *not* a local admin, a later
rewrite (device key change, app moved by an update) fails and pre-logon silently
keeps a stale credential.
*Why:* latent bug; fleets with standard-user accounts are exactly the managed
ones. Fix: write via a temp file the service promotes, or relax to grant the
installing user write access.

### 6. Prod backend + desktop are far behind preprod — `TODO`
Prod serves desktop **1.1.68** while preprod is on **1.2.65**; prod's backend
predates the meeting waiting-room and the host-credential work entirely.
*Why:* every fix from the last month — update reliability, pre-logon, recording
policies, chat — is invisible to prod users. Needs a planned upgrade, not a drip.

---

## P2 — Mobile host

### 7. Re-clear `FLAG_SECURE` on focus change — `TODO`
One UI sets `FLAG_SECURE` on our own window whenever a password field has focus,
which blanks the *whole* capture. We only clear it at `onCreate`, `onResume` and
session start, so a mid-session focus leaves the viewer black until the next
resume.
*Why:* this is our bug and it's cheap — `window.clearFlags()` costs nothing, so
re-clear on `onWindowFocusChanged` plus a light timer while capture is live.
Blocked on the Gradle/APK build issue (#9).

### 8. Blind control of secure screens via accessibility — `TODO`
Other apps' `FLAG_SECURE` windows (Developer options, banking, PIN pad) are black
in the stream and always will be without an OEM add-on — but the a11y node tree
is fully readable. Surface the on-screen controls to the viewer so they can act
by name while the video is black.
*Why:* the only meaningful improvement available without a manufacturer deal.
Same idea would let a viewer type a PIN to unlock remotely.

### 9. Android builds blocked — Java NIO loopback — `BLOCKED`
Gradle can't run on the dev box (Selector/Pipe loopback intercepted). Needs a
winsock reset or reboot.
*Why:* blocks every mobile fix including #7.

---

## P3 — Housekeeping

### 10. Commit the pre-logon + supervisor work — `TODO`
`apps/desktop/src/main/unattendedHost.ts` (new), `index.ts`, and
`service/Remote365InputSvc/main.cpp` are uncommitted, sitting in a ~297-file
dirty tree. Only the backend half reached `main` (commit `a251bda`).
*Why:* the shipped 1.2.64/65 behaviour exists only on one machine's disk.
Note: never push `codex/env-split-preprod`; local commit only.

---

## Done log

- **2026-07-29** — Published desktop **1.2.65**: service-supervised app relaunch
  (M5), for fleets where endpoint security blocks `schtasks`.
- **2026-07-29** — Published desktop **1.2.64**: pre-logon unattended host (M4)
  + keep-alive now kills an installer wedged >30 min instead of never recovering.
- **2026-07-29** — Backend host-credential support deployed to preprod and pushed
  to `main` (`a251bda`): `POST /api/devices/host-credential`, `hostSecret`
  accepted in `canRegisterHost`, header auth on `/api/auth/ice-servers`.
- **2026-07-29** — PV1 fully recovered: complete uninstall, cleaned 290 MB of
  stacked install leftovers, fresh 1.2.64, service restored.
