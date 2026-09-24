# Remote 365 — Android Host: The Unattended System (no Knox)

_Research + design, 2026-08-01. Companion to [SPEC.md](SPEC.md) and [STATUS.md](STATUS.md)._

This document answers one question: **how do we deliver truly unattended remote control on
any Android phone, without a Samsung Knox licence, as a genuinely unique system?**

It is grounded in AOSP source, four independent commercial products, and hands-on reports —
every load-bearing claim below has a source. Read §0 first; it is the honest verdict.

---

## 0. The verdict (read this first)

**"Install it and it works unattended with zero user action, on any phone" does not exist on
Android and cannot be built by anyone — us, TeamViewer, or Google's own partners — for a
self-installed app.** Silent screen capture is a `signature`-level power reserved for apps
signed with the platform key or preinstalled in `/system/priv-app`. There is **no
device-owner, no MDM, no QR-enrollment, no kiosk, and no AMAPI exemption** — this was
confirmed by reading the AOSP `MediaProjectionPermissionActivity` source directly, and by the
existence of Google's own "won't fix / working as intended" ticket for an enterprise exemption
([issuetracker 306452726](https://issuetracker.google.com/issues/306452726)).

So "totally unattended, no Knox" reduces to exactly one honest promise:

> **One-time setup of ~45 seconds, done entirely on the phone with no PC and no cable — then
> unattended forever, on every brand.**

That one-time step is unavoidable **but it is also our moat.** The system that delivers it as
a polished in-app flow — instead of "go run these ADB commands from a laptop" (AnyDesk) or "buy
a Knox licence" (TeamViewer) or "tap approve every session" (RustDesk) — is the unique product.
The rest of this document specifies it.

---

## 1. Why the wall exists, and the one door through it

Two OS gates block silent operation on a stock, non-rooted, non-Samsung phone:

1. **Screen capture** → `MediaProjection`, which since Android 10 shows a consent dialog and
   since **Android 14** requires **fresh consent per session** (the token is single-use).
2. **Input injection** → only an **AccessibilityService** can inject taps without root, and
   enabling it normally needs a manual Settings toggle.

The one door: **both gates can be opened by a shell-UID (ADB) actor, once.** The grant then
persists.

### 1.1 The capture bypass is real and current (confirmed)

`MediaProjectionManagerService` skips the consent dialog when the `PROJECT_MEDIA` app-op is
`MODE_ALLOWED`. The exact AOSP check, still present in current branches:

```java
hasPermission |= checkPermission(packageName, CAPTURE_VIDEO_OUTPUT)
    || mAppOps.noteOpNoThrow(AppOpsManager.OP_PROJECT_MEDIA, uid, packageName)
       == AppOpsManager.MODE_ALLOWED;
```

`MediaProjectionPermissionActivity.onCreate()` calls this **before** inflating the dialog and
finishes silently when it returns true.
([AOSP manager service](https://android.googlesource.com/platform/frameworks/base/+/6720be4/services/core/java/com/android/server/media/projection/MediaProjectionManagerService.java),
[AOSP permission activity](https://android.googlesource.com/platform/frameworks/base/+/9450179a6182/packages/SystemUI/src/com/android/systemui/media/MediaProjectionPermissionActivity.java))

The grant is set with:

```
adb shell cmd appops set <pkg> PROJECT_MEDIA allow
```

Three shipping products document this verbatim as their unattended path, all with current
(2024–2025) docs:
- **AnyDesk** — `appops set com.anydesk.anydeskandroid PROJECT_MEDIA allow` ([docs](https://support.anydesk.com/docs/anydesk-for-android))
- **TSplus RemoteSupport** — states "this change will survive after device reboot" ([docs](https://docs.tsplus.net/remote-support-v3/android-permanently-enable-project-media-permission/))
- **droidVNC-NG** (OSS, maintained, works on Android 14) ([README](https://github.com/bk138/droidVNC-NG/blob/master/README.md))

**Critical nuance that our code already gets right:** Android 14 made each projection *token*
single-use. The app-op removes the *dialog*, not the *request* — the host must still call
`createScreenCaptureIntent()` **per session**, it just returns instantly and invisibly. This is
exactly what [`HostService.onViewerJoined`](app/src/main/java/ai/remote365/host/service/HostService.kt)
→ `ProjectionRequestActivity` already does. The A05s field test (STATUS.md: "no dialog shown")
is our own confirmation on One UI 7 / Android 15.

> Earlier research suggested the app-op was "moot" since Android 14. That was a conflation of
> the single-use *token* rule (real) with dialog *suppression* (still works). Resolved:
> **the bypass works on AOSP 14/15/16**; Samsung One UI evidence is positive-by-absence
> (no vendor doc certifies One UI 7, but nothing reports it broken, and our A05s proves it).

### 1.2 Everything that is NOT a door (so we stop looking)

| Path | Gives unattended capture? | Why not |
|---|---|---|
| Device Owner / DPC (QR, zero-touch) | **No** | No DPM capture exemption in AOSP; `setPermissionGrantState` reaches runtime perms only, never the `PROJECT_MEDIA` app-op |
| Android Management API / managed config | **No** | No `Policy` field enables capture |
| Kiosk / COSU / lock-task | **No** | Zero projection privilege on stock AOSP |
| `CAPTURE_VIDEO_OUTPUT` + `VirtualDisplay` | **No** | `signature`-only since Android 10; not even priv-apps get it; requires platform-key signing or `/system/priv-app` preinstall |
| OEM add-ons (non-Samsung) | **Mostly dead** | Android 15 removed remote-control on Datalogic, Honeywell, Lenovo, Crosscall, M3, Ulefone, Unitech, Urovo, Doogee, Athesi. Only **Samsung, Zebra, Motorola** survive ([TinyMDM](https://www.tinymdm.net/features/remote-control/)) |

Device Owner is **not** a capture path — but it is a strong *accelerant* for the other grants
(see §4.3): it can silently install, set the default IME, disable keyguard, exempt Doze, and
auto-grant runtime perms. It just can't do the two that matter (capture app-op + accessibility).

---

## 2. The unique system: "Self-Pair + Triple-Tier Capture"

Three ideas, none of which any competitor ships together:

1. **Self-Pair** — an in-app ADB client that pairs to the phone's *own* wireless-debugging
   daemon over loopback and applies every grant. No PC, no cable, ~45 s, any brand.
2. **Triple-Tier Capture** — capture degrades gracefully instead of dying: full-rate
   MediaProjection → silent low-fps accessibility screenshots → attended consent. The screen is
   never fully lost, even on a keyguard-killed or un-granted device.
3. **Self-Heal Persistence** — the grants survive reboot and OTA automatically, and the app
   re-arms itself; a manual re-pair is only ever needed after a full uninstall.

### 2.1 Self-Pair — the hero flow

Shizuku and LADB both prove the primitive: **Android 11+ Wireless Debugging** runs a full
`adbd` reachable on the loopback interface, so an in-process ADB client can connect to
`127.0.0.1:<port>` and execute shell commands with **shell UID (2000)** privileges — no PC, no
root. ([Shizuku setup](https://shizuku.rikka.app/guide/setup/), [LADB](https://github.com/tytydraco/LADB))

The user's one-time tap sequence (identical shape on Android 11–16):

1. Settings → About phone → tap **Build number** ×7 (unlock Developer Options).
2. Developer Options → enable **Wireless debugging** (device on Wi-Fi).
3. In our app, tap **"Set up unattended access."**
4. Developer Options → Wireless debugging → **Pair device with pairing code** (shows a 6-digit
   code + port).
5. Type the code into our app.

Our embedded ADB client then, in one shell session, runs the full grant set (§3) and the phone
is unattended forever. We can deep-link steps 1–2–4 to the exact Settings screens
(`ACTION_APPLICATION_DEVELOPMENT_SETTINGS` is already wired in
[`MainActivity`](app/src/main/java/ai/remote365/host/ui/MainActivity.kt)), turning "6 taps
across three screens" into a guided, near-foolproof wizard.

**What cannot be automated (be honest in the UI):** the 6-digit code is generated by `adbd` and
must be typed by a human — there is **no API, intent, or deep link** to inject it. The pairing
itself is a mandatory manual action, by design. Everything *after* the first pair is scriptable.

**Implementation note:** embed a minimal ADB-over-TLS client (the Android 11+ pairing handshake
is Spake2 + TLS). Options: port a small Kotlin/Java ADB client, or vendor the approach LADB uses.
This is the one substantial new dependency; budget for it.

### 2.2 Triple-Tier Capture — the screen never fully dies

| Tier | Mechanism | Rate | Silent? | Works on secure/lock screen? | When used |
|---|---|---|---|---|---|
| **1 — Projection** | `MediaProjection` + `PROJECT_MEDIA` app-op | Full (30 fps) | Yes (dialog suppressed) | Capture stops on keyguard (A15 QPR1) | Primary, whenever granted |
| **2 — Glance** | `AccessibilityService.takeScreenshot()` | **~3 fps** (333 ms cap) | **Fully** (no dialog, no icon) | **Blanked** on `FLAG_SECURE`/DRM/keyguard | Fallback: pre-grant, or while Tier 1 is keyguard-killed |
| **3 — Attended** | `MediaProjection` with the real consent dialog | Full | No (user taps) | n/a | No grant + no accessibility |

Tier 2 is the genuinely novel differentiator. `takeScreenshot()` (API 30+) is **completely
silent** — no dialog, no persistent cast icon — and the **accessibility grant we already need
for input doubles as the capture grant**, so one permission covers both. Its hard limits are
real: a `333 ms` interval constant caps it at ~3 fps
(`ERROR_TAKE_SCREENSHOT_INTERVAL_TIME_SHORT`), and it returns
`ERROR_TAKE_SCREENSHOT_SECURE_WINDOW` on secure surfaces
([AOSP AccessibilityService.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/java/android/accessibilityservice/AccessibilityService.java)).

Nobody productizes Tier 2 as a fallback. It gives us two things competitors don't have:
- A **"glance + control" mode with zero capture consent ever** — useful for low-bandwidth or
  privacy-sensitive fleets that accept 3 fps.
- **Something on screen during the keyguard gap.** When Android 15 kills Tier 1 on lock, we can
  show Tier 2 (except on the secure PIN pad itself) instead of a black screen while we re-acquire.

### 2.3 Self-Heal Persistence

Already partly built ([`AccessibilitySelfHeal`](app/src/main/java/ai/remote365/host/provisioning/AccessibilitySelfHeal.kt)):
`WRITE_SECURE_SETTINGS` (granted during Self-Pair) lets the app re-enable its own accessibility
service after an OTA silently strips it. Extend the same principle to the whole grant set and
tie it to the durability rules in §5.

---

## 3. The grant sequence (updated for Android 15/16)

The current [`provision.ps1`](provision.ps1) runs from a dev PC. The Self-Pair wizard runs the
**same commands** over loopback ADB. One important addition vs. today's script:

```sh
# 1. Silent capture — the core grant
cmd appops set <pkg> PROJECT_MEDIA allow

# 2. Self-heal + IME switching + settings writes
pm grant <pkg> android.permission.WRITE_SECURE_SETTINGS
pm grant <pkg> android.permission.POST_NOTIFICATIONS

# 3. Clipboard read (phone -> desktop sync)
cmd appops set <pkg> READ_CLIPBOARD allow

# 4. Battery: never Dozed
dumpsys deviceidle whitelist +<pkg>

# 5. Headless IME (type-anywhere; NOT behind Enhanced Confirmation Mode -> durable)
ime enable <pkg>/.input.HostImeService

# 6. NEW — clear the restricted-settings lock BEFORE enabling accessibility.
#    Android 15/16 Enhanced Confirmation Mode blocks the raw settings write for
#    sideloaded apps ("Skipping enabling service disallowed by device admin policy").
cmd appops set <pkg> ACCESS_RESTRICTED_SETTINGS allow

# 7. Input: enable the accessibility service
settings put secure enabled_accessibility_services <pkg>/.input.HostAccessibilityService
settings put secure accessibility_enabled 1
```

**Why step 6 is new and matters:** research on Android 15 shows the raw `settings put secure
enabled_accessibility_services` write is silently rejected under Enhanced Confirmation Mode
(ECM) for sideloaded apps. Setting the `ACCESS_RESTRICTED_SETTINGS` app-op first clears the
lock. This is reliable on 13/14, **mixed on 15/16** (some builds re-block at service-start), so
it must be **validated per-OEM/per-version** — flag it in the wizard's post-check.
([Coxxs, Android 15 accessibility](https://dev.moe/en/3030),
[Android Police, ECM](https://www.androidpolice.com/android-15-enhanced-confirmation-mode-sideloading/))

**Input reliability ranking (design consequence):** the **IME path (step 5) is the durable one**
for text/keys — it is *not* behind ECM. The **accessibility path (steps 6–7) is the fragile
one** on modern Samsung/Pixel — it's needed for taps/gestures/global nav, so we can't drop it,
but we should prefer the IME for typing and treat accessibility enablement as best-effort with a
clear status readout.

`provision.ps1` should also gain step 6 so USB provisioning matches the wizard.

---

## 4. Provisioning vectors — one system, three front doors

The grant set is identical; only *who runs it* differs by customer type.

### 4.1 Consumer / self-install → **Self-Pair** (no PC) — the default
The §2.1 in-app flow. Any brand, ~45 s, once. This is the flagship.

### 4.2 Fleet with a technician PC → **USB auto-provision** (zero taps on phone)
Fold `provision.ps1` into the **Remote 365 desktop app**: plug the phone in, click "Provision
this device," the desktop pushes the grant set over USB ADB. Zero taps on the phone, ideal for a
staging bench imaging dozens of devices. USB debugging must be enabled once (still a Settings
tap, but no per-device code typing). This survives even if Google restricts loopback ADB (§6).

### 4.3 Managed / corporate → **Device Owner (QR) + one-time ADB touch**
Enroll as Device Owner via QR/zero-touch. The DPC then **silently**: installs the host, sets our
IME as default (`setSecureSetting(DEFAULT_INPUT_METHOD)`), disables the keyguard, exempts Doze,
and auto-grants runtime perms — and, because DO-installed apps are **not "sideloaded,"** it
escapes the restricted-settings gate entirely. The **only** things it cannot do are the capture
app-op and accessibility enable, which still need one ADB touch (Self-Pair or USB). Net for
managed fleets: everything is silent except a single ~15 s grant step.

---

## 5. Durability — what survives what

| Event | `PROJECT_MEDIA` app-op | Accessibility / `WRITE_SECURE_SETTINGS` | Action needed |
|---|---|---|---|
| **Reboot** | ✅ survives | ✅ survives | None (capture app-op is disk-persisted, not process-bound) |
| **App update, same signature (OTA)** | ✅ survives | ⚠️ accessibility stripped → self-healed by `WRITE_SECURE_SETTINGS` | None if self-heal holds |
| **Uninstall + reinstall** | ❌ lost (new UID) | ❌ lost | **Re-pair** (or USB re-provision) |
| **OS major upgrade (15→16)** | ⚠️ usually survives, not guaranteed | ⚠️ usually survives | Verify post-upgrade; re-grant if needed |
| **Factory reset** | ❌ lost | ❌ lost | Full setup |

**The design rule this dictates:** **never uninstall/reinstall in the field — always OTA-update
in place** (same signing key), which preserves the capture app-op. This aligns with the existing
desktop OTA-update discipline. The reinstall case is the one that forces a human back to the
phone; make it rare by policy, and make re-pair painless when it happens (the wireless-debug
*pairing record* persists across reboot, so recovery is often a reconnect, not a fresh pair).

**Optional advanced hardening — a "grant keeper":** a boot-time routine that flips
`adb_wifi_enabled`, reconnects to the already-paired loopback `adbd`, and re-applies grants —
recovering even a reinstall without a fresh pair. This is the Shizuku-community pattern and is
**not 100% hands-off on non-root devices**; treat it as a nice-to-have, not the primary story.

---

## 6. Threat register (what could break this, and the mitigation)

| Threat | Status | Severity | Mitigation |
|---|---|---|---|
| **Keyguard stops projection** (A15 QPR1, "Stopped MediaProjection due to keyguard lock") | **Live, confirmed** | Critical | Already handled: wake + silent re-acquire in `HostService.onClosed`. Add Tier 2 glance to cover the gap. ([Google docs](https://developer.android.com/media/grow/media-projection)) |
| **Enhanced Confirmation Mode** blocks accessibility enable on A15+ | **Live** | High | `ACCESS_RESTRICTED_SETTINGS` app-op pre-clear (§3 step 6); prefer IME for typing; per-OEM validate |
| **Advanced Protection Mode** (shipped A16) blocks sideloading; accessibility-revoke is WIP | **Live (sideload block); WIP (a11y revoke)** | Critical if it spreads | Opt-in & rare today (journalists/activists). No workaround if enabled — detect and report honestly. Watch for default-on/enterprise-forced. ([Android Authority](https://www.androidauthority.com/android-advanced-protection-mode-accessibility-apk-teardown-3640742/)) |
| **On-device ADB restricted to `wlan0`** (proposed post **CVE-2026-0073**) | **Proposal, no timeline** | Critical to Self-Pair | The single biggest strategic risk. If it lands, loopback self-pair dies → fall back to USB provisioning (§4.2), which is unaffected. ([writeup](https://kitsumed.github.io/blog/posts/android-may-soon-restrict-on-device-adb/)) |
| **Play accessibility "autonomous action" ban** (enforced 2026-01-28) | **Live, Play-scoped** | Medium | We're sideloaded → outside Play *review*, but Play Protect scans on-device. Our app-op path is *cleaner* than auto-tapping a dialog — capture is genuinely dialog-free, we never auto-tap a consent gate. Keep it that way. ([policy](https://support.google.com/googleplay/android-developer/answer/16550159)) |
| **Sideload developer verification** (BR/ID/SG/TH Sep 30 2026; global 2027) | **Confirmed** | Medium | Register as a verified Google developer + register the host's package/signing keys. ADB install is an **explicit exemption**, so Self-Pair/USB provisioning survive. ([Google](https://android-developers.googleblog.com/2026/06/android-developer-verification.html)) |
| **Android 16 `accessibilityDataSensitive`** redacts node reads for non-tool services | **Live** | Low–Medium | Affects *reading* hardened apps (banking/DRM), not our *input injection*. Screen still visible via Tier 1 unless the app is also `FLAG_SECURE`. |
| **Android 13+ restricted settings** gate | **Live** | Handled | Self-Pair grants accessibility directly over ADB, bypassing the manual toggle entirely |

---

## 7. Build plan (mapped to existing code)

The host is already architected for this — the missing piece is the front door. In priority order:

1. **Self-Pair wizard (§2.1)** — the flagship. ✅ **BUILT & VERIFIED END-TO-END ON HARDWARE**
   (Samsung A05s / Android 15 / One UI 7, 2026-08-01). From a clean slate the app paired to its own
   `adbd` over wireless debugging (SPAKE2), connected, and applied every grant silently — verified:
   `PROJECT_MEDIA=allow`, `WRITE_SECURE_SETTINGS` granted, accessibility enabled, IME enabled,
   `ACCESS_RESTRICTED_SETTINGS=allow`, `READ_CLIPBOARD=allow`, battery whitelisted. No PC.
   Package `provisioning/selfpair/`: `AdbTransport` (interface) → `LibAdbTransport` (libadb-android,
   the only file touching the library) + `AdbKeyStore` (durable RSA identity, Bouncy Castle cert) +
   `PairingPortScanner` (mDNS port auto-discovery) + `LocalNetwork` (Wi-Fi IP) + `GrantSequence`
   (the §3 commands) + `SelfPairController` (state machine). UI:
   [`SelfPairActivity`](app/src/main/java/ai/remote365/host/ui/SelfPairActivity.kt).
   **Device-test findings baked in:** (a) `adbd` refuses **loopback** for pairing on One UI —
   the host must be the device's **Wi-Fi IP** (`LocalNetwork.wifiIpv4()`), not `127.0.0.1`;
   (b) `NsdManager` mDNS for `_adb-tls-pairing._tcp` **resolves once a `WifiManager` multicast lock
   is held** (Samsung drops inbound multicast otherwise) — verified auto-discovering
   `host=192.168.2.105, port=41631`, so the wizard auto-fills **both** host and port and the user
   types **only the 6-digit code**; (c) libadb throws `IOException("Stream closed")` at EOF for
   zero-output commands — `exec` treats that as end-of-stream. **The 6-digit code cannot be
   auto-captured** — it's the SPAKE2 secret shown only on the system dialog, readable by no app
   without an already-enabled AccessibilityService (chicken-and-egg at first run); typed once, never
   again. **Still to verify:** the wizard's on-screen field entry by a real user (transport, grants,
   and discovery are all proven via debug broadcast triggers), and whether One UI keeps the pairing
   server alive when our app is foregrounded (the broadcast test kept the pair dialog in front).
2. **Grant sequence update (§3 step 6)** — ✅ **DONE.** `ACCESS_RESTRICTED_SETTINGS` added to both
   `GrantSequence` and `provision.ps1`.
3. **Tier 2 Glance capture (§2.2)** — a `takeScreenshot()` source in
   [`HostAccessibilityService`](app/src/main/java/ai/remote365/host/input/HostAccessibilityService.kt),
   fed into the existing WebRTC track as a ~3 fps fallback. Wire it as the keyguard-gap filler
   and the no-app-op fallback.
4. **USB auto-provision in desktop (§4.2)** — port `provision.ps1` into the desktop app's device
   flow. Reuses proven commands; unaffected by the CVE-2026-0073 risk.
5. **Device Owner accelerant (§4.3)** — DPC receiver + QR-provisioning payload, for managed
   customers. Larger effort; do after the consumer story is solid.
6. **Grant keeper (§5, optional)** — boot-time reconnect + re-grant. Advanced hardening.

Broaden the device matrix throughout — everything so far is verified on one A05s (Android 15 /
One UI 7). Pixel (stock A15/16, where ECM and AAPM bite hardest) is the most important next test.

---

## 8. How we compare after this ships

| | Non-Samsung unattended | Setup | Apps to install |
|---|---|---|---|
| **TeamViewer** | Only via Samsung Knox (deprecating) | Knox licence / MDM | 2 (host + add-on) |
| **AnyDesk** | ADB `PROJECT_MEDIA` from a **PC**, mouse-only without an OEM plugin | Run ADB yourself from a laptop | 1–2 |
| **RustDesk** | No — per-session tap, can't type on lock screen | Per session | 1 |
| **Splashtop / Zoho** | OEM allow-list only | Per-OEM add-on / MDM | 1–2 |
| **Remote 365 (this design)** | **Yes, any brand** | **~45 s in-app, no PC, once** | **1** |

The honest limit remains: that ~45 s exists and cannot be removed for a self-install app. But
delivering it as one guided in-app flow, on one app, on any brand — with a silent glance tier
that keeps working when projection can't — is a product none of the above offers.

---

## 9. Sources

Capture bypass & AOSP: [manager service](https://android.googlesource.com/platform/frameworks/base/+/6720be4/services/core/java/com/android/server/media/projection/MediaProjectionManagerService.java) ·
[permission activity](https://android.googlesource.com/platform/frameworks/base/+/9450179a6182/packages/SystemUI/src/com/android/systemui/media/MediaProjectionPermissionActivity.java) ·
[per-session consent ticket](https://issuetracker.google.com/issues/306452726) ·
[AnyDesk](https://support.anydesk.com/docs/anydesk-for-android) ·
[TSplus](https://docs.tsplus.net/remote-support-v3/android-permanently-enable-project-media-permission/) ·
[droidVNC-NG](https://github.com/bk138/droidVNC-NG/blob/master/README.md)
Device Owner / signature limits: [restricted screen reading](https://source.android.com/docs/core/permissions/restricted-screen-reading) ·
[privapp allowlist](https://source.android.com/docs/core/permissions/perms-allowlist) ·
[setPermissionGrantState](https://learn.microsoft.com/en-us/dotnet/api/android.app.admin.devicepolicymanager.setpermissiongrantstate) ·
[TinyMDM OEM breakage](https://www.tinymdm.net/features/remote-control/)
Self-Pair / ADB: [Shizuku setup](https://shizuku.rikka.app/guide/setup/) ·
[LADB](https://github.com/tytydraco/LADB) ·
[reconnect pattern](https://github.com/RikkaApps/Shizuku/discussions/462) ·
[CVE-2026-0073 / wlan0 proposal](https://kitsumed.github.io/blog/posts/android-may-soon-restrict-on-device-adb/)
Accessibility screenshot: [AOSP AccessibilityService.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/java/android/accessibilityservice/AccessibilityService.java)
Threats: [A15 keyguard stop](https://developer.android.com/media/grow/media-projection) ·
[ECM on A15](https://dev.moe/en/3030) ·
[Advanced Protection Mode](https://www.androidauthority.com/android-advanced-protection-mode-accessibility-apk-teardown-3640742/) ·
[Play accessibility policy](https://support.google.com/googleplay/android-developer/answer/16550159) ·
[developer verification](https://android-developers.googleblog.com/2026/06/android-developer-verification.html)
