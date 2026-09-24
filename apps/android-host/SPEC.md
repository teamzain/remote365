# Remote 365 — Android Host (greenfield, native Kotlin)

Unattended-first mobile host. Registers as a device in the existing fleet, streams its
screen over WebRTC/H.264 to the existing desktop viewer, and accepts remote input.

Backend is **unchanged** — this app implements the existing wire protocol verbatim.

---

## 1. Provisioning tiers (READ THIS FIRST)

True unattended Android is **not** achievable with app-store-installable APIs alone.
Screen-capture consent is per-session since Android 14, the `MediaProjection` token is
single-use, and there is **no device-owner / DPC / enterprise exemption in AOSP**.

Every path that removes the per-session tap requires one of: a one-time ADB grant, an OEM
enterprise hook, or a privileged/preinstalled build. The app ships **three tiers** and must
be honest in the UI about which tier a device is on.

| Tier | Unattended | Setup | Scope | Durability |
|---|---|---|---|---|
| **A — ADB grant (recommended)** | Yes (except locked) | One-time in-app wireless-debugging pairing | Any Android 11+ | Survives reboot; **lost on reinstall** |
| **B — OEM enterprise** | Yes | EMM enrollment + signed add-on | Samsung (managed only) / Zebra | Shrinking — see §1.2 |
| **C — attended fallback** | No | Zero | Any | Always works |

### 1.1 Tier A — the one-time ADB grant

The AOSP bypass is real and still present in `main`. `MediaProjectionManagerService`:

```java
hasPermission |= checkPermission(packageName, Manifest.permission.CAPTURE_VIDEO_OUTPUT)
        || mAppOps.noteOpNoThrow(AppOpsManager.OP_PROJECT_MEDIA, processUid, packageName)
                == AppOpsManager.MODE_ALLOWED;
```

`MediaProjectionPermissionActivity` checks this first and **skips the dialog** when true.

```
adb shell appops set <pkg> PROJECT_MEDIA allow          # silent, dialog-free capture
adb shell settings put secure enabled_accessibility_services <pkg>/<svc>
adb shell pm grant <pkg> android.permission.WRITE_SECURE_SETTINGS
```

App ops persist across reboot. Lost on uninstall/reinstall. `WRITE_SECURE_SETTINGS` lets
the app re-enable its own accessibility service later without user help.

**No PC required**: pair from inside the app over Developer options → Wireless debugging
(the LADB / Shizuku pattern). This is the "one-time setup" the product promises.
AnyDesk and droidVNC-NG both document this same command officially.

### 1.2 Tier B — OEM, and why it is a depreciating asset

- **Samsung**: from Android 15 / Knox 3.11, Knox remote control is restricted to apps under
  **Android Enterprise management**. Authorization needs an EMM pushing Knox Service Plugin
  → *Add applications for accessing the Knox SDK* → package name + signature, scope
  `REMOTE CONTROL`. `RemoteDesktop` deprecated at API 35. DeX injection deprecated at API 39
  and **absent on Android 16+**. Splashtop's own customer notice says unattended "may no
  longer work reliably" on Samsung and advises falling back to attended.
- **Zebra**: the clean one. MX `AccessMgr` binds a signed package to
  `com.zebra.eventinjectionservice` (input) + `com.zebra.remotedisplayservice` (capture).
  No per-session prompt. MX 10+.
- **Android Enterprise device owner alone gives kiosk, silent install, and permission
  grants — but NOT capture consent.**

### 1.3 The lock screen (hard constraint)

On **Android 15 QPR1+, in-progress projection is stopped automatically when the device
locks** if a PIN/password/biometric is set ("Stopped MediaProjection due to keyguard lock").
No workaround, no exemption. The consent dialog also cannot be shown over the keyguard.

Required sequence: wake (`setTurnScreenOn` + wake lock) → unlock via keyguard node taps with
a stored PIN → **then** start projection → re-arm on every `MediaProjection.Callback.onStop()`.
With Tier A's app-op grant that restart is silent; without it, consent is needed every cycle.

**Bootstrap idea worth prototyping**: `AccessibilityService.takeScreenshot()` needs no
MediaProjection and is completely silent, but is rate-capped at 333 ms (~3 fps) and returns
`ERROR_TAKE_SCREENSHOT_SECURE_WINDOW` on secure surfaces. Useless for control, possibly
enough to *see the lock screen while typing the PIN* — which solves the blind-unlock problem.

### 1.4 Compliance constraints

- **Play accessibility policy (enforced 2026-01-28)**: prohibits autonomous action. Human-driven
  remote control is defensible; **auto-tapping the system capture-consent dialog is not**.
  Keep any auto-tap out of a Play build.
- **Android 17.2 Advanced Protection Mode**: refuses *and revokes* accessibility grants for
  apps not classified as accessibility tools. User cannot override. Also blocks sideloading.
- **Android 16**: app components can opt out of accepting AccessibilityService input
  (banking/DRM apps will). Accessibility grants denied during active calls.
- **Android 13+ restricted settings**: sideloaded apps need App info → "Allow restricted
  settings" before accessibility can be enabled. Real onboarding cliff.
- **Sideload developer verification**: BR/ID/SG/TH Sept 2026, global 2027.

---

## 2. Wire protocol contract

Reference implementation of the same protocol: `apps/mobile-native-host/src/hostStore.ts`.

### 2.1 Endpoints

| Purpose | Endpoint |
|---|---|
| Signaling | `wss://<host>/api/signal` |
| Self-registration | `POST /api/devices/self-register` |
| Login / refresh | `POST /api/auth/login`, `POST /api/auth/refresh` |
| ICE (optional direct) | `GET /api/auth/ice-servers` |

Signaling carries **no auth in headers or query** — the token travels in the first
`register` message.

Env selection via `BuildConfig` (mobile defaults to **preprod**, unlike desktop):

```
API_BASE_URL   debug=https://pp.remote365.ai   release=https://remote365.ai
SIGNALING_URL  debug=wss://pp.remote365.ai/api/signal
```

### 2.2 Registration

```json
POST /api/devices/self-register
{ "accessKey": "<cached 9-digit, omit on first run>", "name": "Android Host",
  "deviceType": "ANDROID", "password": "...", "passwordRequired": true,
  "fingerprint": "<sha256 hex>", "hostSecret": "<base64url 32B>" }
→ { "id", "access_key", "name", "has_password", "password_required", "auto_password?" }
```

Hard rules:
- `fingerprint` must match `/^[a-f0-9]{16,128}$/i`, lowercased. Server derives a stable
  access key from it, so **the phone keeps the same 9-digit ID across reinstall/wipe**.
  Source: `ANDROID_ID` + Widevine `PROPERTY_DEVICE_UNIQUE_ID`, SHA-256 hex.
- `deviceType: "ANDROID"` **requires** `hostSecret` or create returns 400.
- Mismatched `hostSecret` on an existing row → **403 `Invalid host credential`**.
  Generate once (32 random bytes, Base64 URL-safe, no padding, `/^[A-Za-z0-9_-]{43,128}$/`),
  persist in secure storage, **never rotate**.
- Send `password`/`passwordRequired` **only on first registration** — resending rotates the
  server hash and deletes all `trustedDevice` rows.

### 2.3 Presence

- Redis `presence:<accessKey>` = `"online"`, `EX 90`.
- Send `{"type":"heartbeat"}` every **25 s**.
- Server sends `{"type":"ping"}` every 20 s → must answer `{"type":"pong"}`.
  **3 unanswered pings → `ws.terminate()`.**

### 2.4 Session lifecycle — the HOST creates the offer

Server-side `canForwardRemoteSignal` rejects `answer` from a host; a viewer may only send
`request-offer` / `answer` / `ice-candidate`.

```jsonc
// 1. host → server
{ "type":"register", "role":"host", "accessKey":"123456789", "token":"<JWT|omit>",
  "hostSecret":"...", "clientKind":"android-host", "appVersion":"1.0.0", "platform":"android" }
// → {"type":"registered","sessionId":"<accessKey>","connectionId":"<uuid>"}
// → or {"type":"registration-error","error":"..."}

// 2. server → host, approval path only
{ "type":"viewer-request", "viewerId":"<uuid>", "viewerClientId":"...",
  "viewerName":"Jane Doe", "viewerDeviceId":"987654321" }
// host replies {"type":"join-approve","viewerId":"...","trustDevice":true} | {"type":"join-deny",...}
// auto-denied after 30 s; may be cancelled by {"type":"viewer-request-cancelled",...}

// 3. server → host
{ "type":"viewer-joined", "viewerId":"<uuid>", "viewerClientId":"...", "viewerName":"...",
  "viewerDeviceId":"...", "iceServers":[...], "remoteSessionId":"<uuid>", "expiresAt":"..." }
// MUST reject the session with host-stopped if remoteSessionId or expiresAt is missing.

// 4. host → server
{ "type":"offer", "targetId":"<viewerId>", "sdp":"<sdp>", "hostType":"android" }

// 5. viewer → host
{ "type":"answer", "sdp":"<sdp>", "sessionId":"123456789", "targetId":"<hostConnectionId>" }

// both directions
{ "type":"ice-candidate", "targetId":"<peer>", "candidate":"candidate:...",
  "sdpMid":"0", "sdpMLineIndex":0 }
```

Relay re-emits `{type, senderId:<origin connectionId>, ...data}` — use `senderId` to learn
the peer id. Viewer may send `{"type":"request-offer"}`; host must rebuild and re-offer to
`message.senderId`.

Teardown: host `{"type":"host-stopped","targetId":"<viewerId>"}`; server
`{"type":"viewer-left","viewerId":...}`; grant expiry `remote-session-expiring`
(`secondsRemaining`) then `remote-session-expired`.

### 2.5 Media

**H.264 as a codec *preference*, not a restriction** — `setCodecPreferences` puts all H.264
first, leaves VP8/VP9 behind. No profile pinned (Android hw encoders are typically Level 3.1,
~0.9 Mpx — scale resolution rather than forcing profile).

Seed bitrate by appending to the H.264 `a=fmtp:` lines only:
`;x-google-start-bitrate=<60% tier>;x-google-min-bitrate=<25%>;x-google-max-bitrate=<tier>` (kbps)

| tier | bitrate | fps | maxLongEdge |
|---|---|---|---|
| smooth | 2.5 Mbps | 30 | 1280 |
| balanced | 4.5 Mbps | 30 | 1600 |
| sharp | 6.5 Mbps | 30 | 1920 |
| ultra | 9 Mbps | 30 | 2160 |

Viewer aliases: `auto|high|quality|ultra→ultra`, `medium|balanced→balanced`, `sharp→sharp`,
`low|speed|smooth→smooth`. Resolution via `scaleResolutionDownBy`.

**Data channels — all three created by the HOST:**

| name | config | carries |
|---|---|---|
| `control` | reliable ordered, `arraybuffer` | clipboard, file transfer, commands |
| `input` | `{ordered:false, maxPacketLifeTime:100}` | `mousemove`, `wheel` |
| `input-critical` | reliable ordered | clicks, keys, composed text |

**Do NOT send `{"type":"input-capabilities","compactV1":true}`** unless the binary format in
`apps/desktop/src/shared/inputProtocol.ts` is also implemented (magic `0x52 0x33 0x49`,
LE float32 coords). Without it the viewer sends plain JSON, which is what we want at first.

Input JSON (coords normalized 0.0–1.0, clamped):

```jsonc
{"type":"mousedown","button":0,"x":0.5,"y":0.5}     // aliases: touch-start/move/end
{"type":"mousemove","button":0,"x":0.5,"y":0.5}
{"type":"mouseup","button":0,"x":0.5,"y":0.5}
{"type":"wheel","deltaX":0,"deltaY":-120,"x":0.5,"y":0.5}
{"type":"typeText","text":"hello"}                   // alias: text
{"type":"pasteText","text":"..."}                    // viewer prefers this on mobile
{"type":"keydown","key":"a","keyCode":65,"shiftKey":false,"ctrlKey":false,"altKey":false,"metaKey":false}
{"type":"tap","x":0.5,"y":0.5,"duration":80}
{"type":"swipe","startX":0.5,"startY":0.8,"endX":0.5,"endY":0.2,"duration":180}
{"type":"globalAction","action":2}
{"type":"action","action":"home|recents|wake|volume_up|volume_down|lock|reboot"}
{"type":"shortcut","key":"notifications|control-center"}
{"type":"request-keyframe"}
{"type":"stream-quality","mode":"auto|speed|quality|ultra|balanced|sharp|smooth"}
{"type":"clipboard-sync","id":"...","origin":"desktop","text":"..."}
```

Behaviors to mirror: taps at `y >= 0.925` route to nav-bar global actions unless the keyguard
is showing; drag starts only past a distance threshold then streams gestures throttled ~35/s.

File transfer over `control` is binary:
`uint32 headerLength (LE) || JSON header || chunk bytes`, header
`{type:"file-chunk", transferId, name, mimeType, chunkIndex, totalChunks, totalSize}`.

### 2.6 ICE / TURN

**The host never fetches ICE servers** — they arrive in `viewer-joined` / `request-offer` and
go straight into `RTCPeerConnection`. Fallback if empty:
`[{urls:"stun:stun.l.google.com:19302"}]`.

Server order: Cloudflare anycast TURN first (when configured), then 2× Google STUN, then
coturn udp/tcp. Optional direct endpoint `GET /api/auth/ice-servers` authenticates for
unattended hosts via headers `x-device-key: <accessKey>` + `x-host-secret: <hostSecret>`,
returning HMAC-SHA1 REST creds (`username=<unixExpiry>:<identity>`).

### 2.7 Device model

`enum DeviceType { WINDOWS MACOS LINUX IOS ANDROID }` — **there is no `capabilities` or
`platform` column**; `deviceType` is the only signal.

Registering as `ANDROID` makes the existing UI do the right thing automatically: phone icon
in the device list, viewer window opens in **mobile shell/portrait**, and mobile input
semantics engage (hover-move suppression, `pasteText` over `typeText`, containment mapping).

Known cosmetic gap: `SnowOrgDetail.tsx` `DeviceIcon` matches substrings `phone`/`mobile`/`tv`/
`server`, so `"android"` falls through to a laptop icon in that one org view.

---

## 3. Build order

1. **M1** — capture → WebRTC → desktop viewer (attended, view-only)
2. **M2** — input injection via AccessibilityService `dispatchGesture`
3. **M3** — unattended: binding, warm socket, primed capture, boot/update receivers,
   battery exemption, watchdog, OTA self-update
4. **M3b** — Tier A ADB-grant wizard (wireless pairing) + Tier B Knox where available
5. **M4** — iOS view-only host (ReplayKit broadcast extension)

## 4. Toolchain (verified on this machine)

```
ANDROID_HOME  D:\Android\Sdk        platforms: android-31/34/36
JDK           17 (Temurin + MS)     build-tools: 34/35/36, NDK 27+28
```

**Gradle gotcha**: JDK 17 on this machine fails with a "loopback connection" error unless
`TMP`/`TEMP` are short — set `TMP=D:\tmpjava` and `TEMP=D:\tmpjava` before any Gradle build.

## 5. To verify on real hardware before committing

- Does `appops set <pkg> PROJECT_MEDIA allow` still bypass the dialog on target Android
  15/16/17 including Samsung One UI? (OEM SystemUI forks sometimes diverge.)
- Does projection survive lock on 16/17, or is the QPR1 keyguard stop universal?
- Which target apps opt out of accessibility input (Android 16 change)? Test banking apps.
- Does `takeScreenshot()` return `ERROR_TAKE_SCREENSHOT_SECURE_WINDOW` on the keyguard
  specifically? That would kill the low-fps unlock-bootstrap idea.
