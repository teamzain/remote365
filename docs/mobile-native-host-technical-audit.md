# Mobile Native Host Technical Audit

Audit target: `apps/mobile-native-host`

Status: implementation and build verification complete; physical-device verification pending.
This document records confirmed findings only; unmeasured device behavior is not presented
as a result.

## Architecture map

| Area | Current owner |
| --- | --- |
| React Native entry and lifecycle | `index.js`, `src/App.tsx`, `src/headlessPresence.ts` |
| Host state, registration, signaling and WebRTC | `src/hostStore.ts` |
| REST authentication and device registration | `src/api.ts` |
| Native bridge | `src/native.ts`, `ConnectXModule.kt` |
| Input injection | `RemoteLinkAccessibilityService.kt` |
| Foreground/background presence | `BackgroundService.kt`, `BootReceiver.kt`, `KeepAliveScheduler.kt` |
| MediaProjection foreground declaration | `MediaProjectionService.kt` and `react-native-webrtc` |
| Managed configuration | `ConnectXModule.kt`, `res/xml/app_restrictions.xml` |
| Private updates | `src/updater.ts`, `src/autoUpdate.ts`, `UpdateBanner.tsx`, `ConnectXModule.kt` |
| Responsive layout | `src/useResponsive.ts` and screen-level flex/scroll layouts |

## Confirmed findings and fixes

| Severity | Symptom | Confirmed root cause | Fix | Verification |
| --- | --- | --- | --- | --- |
| Critical | Update flow could bypass Android approval | Accessibility code searched the package installer and clicked positive buttons, including `Install anyway` | Removed installer automation. Android owns the approval prompt | Source audit; Kotlin compile |
| Critical | Untrusted/corrupt APK could reach installer | Manifest did not require a checksum; URL allowed arbitrary HTTP(S); no signing-certificate check | Require HTTPS and configured-server origin, SHA-256, matching package/signing certificate, and increasing version code | TypeScript and Kotlin compile; negative device tests pending |
| Critical | Android registration and signaling could be spoofed with its public access key | `/self-register` allowed access-key-only mutation and signaling accepted tokenless registration for unowned devices | Generate a 256-bit native host credential, retain it in Android SecureStore, store only its SHA-256 digest, require it for Android REST mutation and signaling, and permit legacy enrollment only with the row's matching hardware fingerprint | Prisma generation; auth/signaling/mobile builds; adversarial integration test pending |
| High | Viewer departure could leave capture active | `viewer-left` closed only the peer connection | Route departure through full session teardown: peer, MediaProjection, wake lock, grant, timers | TypeScript build; device lifecycle test pending |
| High | Registration failure could leave the device permanently offline | Socket stayed open after `registration-error`; the supervisor treated any open socket as healthy | Refresh authentication or re-register identity, replace socket, and retry with bounded exponential backoff | TypeScript build; network test pending |
| High | Input could wait behind clipboard/file data | Input shared a reliable ordered data channel | Dedicated unreliable short-lived movement channel and reliable critical-input channel | Source/contract audit; packet-loss device test pending |
| High | Video remained at an expensive tier during congestion | WebRTC stats were logged but never fed back into sender parameters; sessions started at `ultra` | Start at balanced HD, measure actual FPS/bitrate/RTT/loss/limitation reason, downgrade after two bad samples, upgrade after five healthy samples, enforce a 15-second cooldown and viewer-selected ceiling | Policy tests; TypeScript build; constrained-network device test pending |
| High | Drag response occurred only on release | Move events accumulated until a final swipe | Stream continued Accessibility gesture segments while dragging | Kotlin compile; physical test pending |
| High | Cleartext transport was permitted by the Android application | Manifest set `usesCleartextTraffic=true` | Disabled cleartext traffic; configured endpoints use HTTPS/WSS | Manifest audit; Kotlin compile |
| Medium | Rotation/tablet behavior was blocked at Activity level | Manifest forced portrait orientation | Removed forced orientation; responsive hook caps and centers tablet content | Manifest audit; emulator matrix pending |
| Medium | Optional permissions blocked hosting | Overlay, notification display, and battery exemption were treated as mandatory | Only connected Accessibility control blocks remote control; other capabilities remain guided/recommended | TypeScript build; permission matrix pending |
| High | UI-started foreground presence acquired a duplicate unbounded wake lock | `BackgroundService` added its own permanent lock even when React Native was already active | Limit the app-owned lock to the 60-second startup/recovery window. Boot-time `HeadlessJsTaskService` still retains its framework lock while its JavaScript socket runs; this is required for Doze reliability and is documented rather than hidden | Kotlin compile; headless battery profiling pending |
| Medium | Accessibility created a redundant foreground service | The OS-managed Accessibility service created its own notification and `specialUse` foreground promotion | Removed the duplicate foreground promotion; the dedicated presence service remains the single foreground-service owner | Manifest/Kotlin compile |
| Medium | Malformed signaling payload could reject the async handler | `JSON.parse` and message awaits were unguarded | Validate JSON and contain handler failures with actionable state/logs | TypeScript build |
| Medium | API typecheck failed and request failures were weakly controlled | Broken Axios installation and implicitly typed interceptor | Replaced with a typed fetch client, eight-second abort timeout, JSON/error normalization, and SecureStore bearer injection | TypeScript build |
| High | Optional releases triggered the installer automatically | Headless updater did not inspect the mandatory flag | Optional releases now download/verify only; mandatory releases may open the OS installer | Update policy tests; TypeScript build |
| High | Returning from “Install unknown apps” lost update progress | Installer rejection discarded the verified APK path | Persist pending update metadata, re-verify the APK, and resume only a user-initiated permission handoff | TypeScript build; physical permission test pending |
| Medium | Update failures were invisible | Update banner swallowed check errors and disappeared without a manifest | Render actionable check/download/install errors and retry state | TypeScript build; UI test pending |
| Medium | Update FileProvider exposed the full cache tree | Provider paths used `path="."` | Restrict provider access to the dedicated `cache/updates/` directory | Android resource/Kotlin build |
| High | A release APK could be mistaken for production while carrying the public debug certificate | Gradle silently fell back to `debug.keystore` when release credentials were absent | Release artifact tasks now fail before execution unless all four external signing properties exist; R8 and resource shrinking default on | Negative `assembleRelease` gate returned the expected signing error |
| Medium | Expo regeneration could restore portrait-only mode and permissions already removed from the native manifest | `app.json` remained out of sync with the audited native project | Set orientation to `default`, block microphone/audio/camera/storage permissions, and remove obsolete special-use foreground permission at the Expo source of truth | `expo config`; main-manifest audit |
| Low | Best-effort cleanup and telemetry failures were hidden | Seven empty catch blocks suppressed peer, capture, clipboard, metrics, grant and prompt errors | Emit scoped, non-sensitive failure events for every catch path | Forbidden-pattern scan, lint and typecheck |
| High | A clean native build failed while cached incremental builds passed | The app's `resolvedRepoRoot` pointed at the workspace package, so React Native codegen searched a nonexistent app-local `node_modules` tree | Resolve the repository root explicitly and publish the hoisted React Native directory to native subprojects | Forced gesture-handler codegen task and release-manifest generation |
| High | Start Hosting still refused to proceed without optional permissions | The screen duplicated an obsolete all-permissions gate even though the host store required only connected Accessibility | Remove notification, overlay and battery exemption as hidden preconditions; keep them as skippable setup guidance | Typecheck, lint and screen-flow audit |
| Medium | OEM background restrictions had only generic guidance | Setup did not distinguish vendor battery managers | Show manufacturer-specific instructions for Samsung, Xiaomi/Redmi/Poco, Oppo/Realme/OnePlus, Vivo/iQOO, Huawei/Honor, Tecno/Infinix and standard Android | Typecheck and manufacturer-branch audit |
| Medium | The primary screen hid detailed connection transitions | `statusText` was maintained in state but never rendered | Render live-region status details and distinguish Connecting and Stopping from Online | Typecheck and UI source audit |
| High | Optimized Windows release builds failed for 32-bit Android | New-Architecture generated C++ object paths exceeded Windows' 260-character limit | Relocate persistent external-native staging to the shorter repository-level `.cxx/mobile-native-host` path and ignore that generated tree | Full four-ABI optimized release build with R8 |
| Critical | Published update manifests were rejected and the publisher could upload a debug-signed APK | The release script omitted `sha256`, checked only byte length, and did not pin the signing certificate | Require the production certificate digest, verify APK signature locally, verify remote SHA-256 after upload, escape release notes, validate the mandatory flag and publish the complete manifest last | Shell syntax audit; client manifest/security tests; live publication intentionally not performed |

## Affected-file index

This supplements the root-cause table with the authoritative implementation locations.

| Finding | Affected files |
| --- | --- |
| Installer approval bypass | `RemoteLinkAccessibilityService.kt` |
| APK origin, checksum, signature and downgrade verification | `src/updatePolicy.ts`, `src/updater.ts`, `src/autoUpdate.ts`, `ConnectXModule.kt`, `update_file_paths.xml` |
| Host registration impersonation | `src/hostStore.ts`, `src/native.ts`, `ConnectXModule.kt`, `apps/auth-service/src/routes/devices.ts`, `apps/signaling-service/src/index.ts`, `packages/shared/src/host-credential.ts`, Prisma schema and migration |
| Session teardown and capture cleanup | `src/hostStore.ts` |
| Socket replacement, heartbeat and reconnection | `src/hostStore.ts`, `src/headlessPresence.ts` |
| Input queueing and continuous drag | `src/hostStore.ts`, `RemoteLinkAccessibilityService.kt` |
| Adaptive video and keyframe recovery | `src/hostStore.ts`, `src/videoQualityPolicy.ts` |
| Transport and Android permission hardening | `AndroidManifest.xml`, `app.json`, `android/gradle.properties`, `android/app/build.gradle` |
| Foreground/background service ownership | `BackgroundService.kt`, `BootReceiver.kt`, `KeepAliveScheduler.kt`, `HostPrefs.kt`, `index.js` |
| Responsive behavior | `src/useResponsive.ts`, `src/responsivePolicy.ts`, all files under `src/screens`, `SetPasswordModal.tsx` |
| API failure handling | `src/api.ts` |
| User-visible update state | `src/components/UpdateBanner.tsx`, `src/App.tsx` |
| Hoisted-workspace native codegen | `android/app/build.gradle`, `android/build.gradle` |

## Final architecture flows

1. **Startup:** `index.js` registers the UI and headless presence task. `App.tsx`
   initializes SecureStore state, managed configuration, permission state and update
   recovery. The native boot receiver schedules foreground/headless recovery only when
   the persisted auto-online intent is enabled.
2. **Host registration:** Android derives its stable hardware fingerprint, creates a
   256-bit host credential with `SecureRandom`, and retains the credential in SecureStore.
   The auth service derives or recovers the public nine-digit ID and stores only the
   credential digest. Existing legacy Android rows can enroll once only with the matching
   hardware fingerprint.
3. **Connection establishment:** one supervised WSS socket registers using the public ID,
   host credential and account token when available. The signaling service validates the
   host before publishing presence. Heartbeats, silence detection, bounded exponential
   backoff and generation checks prevent stale or duplicate sockets.
4. **Screen capture:** capture starts lazily after an authorized viewer arrives. Android's
   own MediaProjection consent UI remains authoritative. A single local stream and peer
   connection are owned by the session teardown path.
5. **Video encoding and delivery:** WebRTC owns buffer lifetime, packetization, jitter
   handling and hardware codec integration. H.264 is preferred when supported. Sender
   statistics drive bitrate, frame-rate and resolution tiers with hysteresis; explicit
   refresh requests recover the decoder without adding an application frame queue.
6. **Remote input:** critical actions use a reliable dedicated RTC data channel; high-rate
   movement uses a short-lived unordered channel. Accessibility injects taps, keys and
   continuous gestures and records native completion/cancellation latency.
7. **Reconnection:** socket error, close, silence, registration failure, network recovery
   and foreground recovery converge on the same socket replacement path. A generation ID
   invalidates callbacks from replaced sockets.
8. **Background operation:** one data-sync foreground service owns persistent availability.
   Boot/package receivers and WorkManager recover intent. Wake locks are bounded to the
   startup/recovery window. React Native's boot-time headless task retains its own
   framework partial wake lock while the JavaScript heartbeat is active; stopping
   hosting destroys the service and releases it. Session screen locks are released
   during teardown.
9. **Updates:** the app polls the configured HTTPS origin, validates manifest semantics,
   downloads with progress/retry/resume support, verifies checksum/package/signing
   certificate/version code, and opens Android's installer only after user action or a
   mandatory-update handoff. Pending state survives the unknown-sources settings round trip.

## Test matrix status

| Scenario | Current evidence |
| --- | --- |
| First install / existing Android credential migration | Code-path and policy tests; physical install pending |
| Mandatory and optional update policy | Automated policy tests pass |
| Failed download / retry / partial resume | Implemented error and retry paths; server/device fault injection pending |
| Invalid checksum, origin, manifest or downgrade | Automated policy rejection plus native verifier compile; APK instrumentation pending |
| Missing installation permission / restart during update | Persisted handoff code and build verification; device lifecycle test pending |
| Wi-Fi, mobile data, switching networks, outage, server restart | Supervised reconnect implementation; physical/network fault injection pending |
| Device restart / app background / screen lock | Boot, foreground and headless paths compile; OEM device tests pending |
| Socket disconnection / duplicate-session prevention | Generation and teardown source audit; live signaling fault test pending |
| Slow network, packet loss, high latency | Adaptive policy tests pass; controlled network measurements pending |
| Encoder failure and codec fallback | WebRTC connection-state recovery and H.264 preference compile; device codec fault test pending |
| Portrait, landscape, phones and tablet | Pure layout policy tests pass for the requested dimensions; rendered device checks pending |
| Keyboard and large font scale | Scroll/keyboard avoidance and font caps audited; rendered input test pending |

## Runtime performance evidence now emitted

- `signaling:registered`: connection setup and reconnection milliseconds.
- `latency:capture-start` / `latency:capture-ready`: MediaProjection setup milliseconds.
- `latency:offer-sent` / `latency:peer-connected`: offer construction and negotiation milliseconds.
- `latency:input-received`: critical input arrival and estimated sender-to-host transport time
  when a trustworthy sender timestamp is present.
- Android `Remote365Latency`: tap/swipe completion or cancellation time from native receipt.
- `performance:video`: frames encoded/sent, current FPS, bytes sent, average encode milliseconds
  per frame, WebRTC quality-limitation reason, and selected-pair round-trip time.

These logs establish the measurement mechanism. Before/after device numbers require the same
physical phone, viewer, network condition, and interaction script; they have not yet been
collected and will not be fabricated.

### Before/after measurement status

| Metric requested | Baseline | Optimized result | Current evidence |
| --- | --- | --- | --- |
| Connection time | Not captured before this audit | Awaiting attached device | `signaling:registered` timer implemented |
| Input latency | Not captured before this audit | Awaiting attached device/viewer | sender timestamp, host receipt and native execution timers implemented |
| Capture time | Not captured before this audit | Awaiting attached device | capture start/ready timer implemented |
| Encoding time | Not captured before this audit | Awaiting attached device | WebRTC cumulative encode time and encoded-frame delta emitted |
| Frame-send time | Not captured before this audit | Awaiting attached device/viewer | bytes/frame send deltas and sampling interval emitted; receiver acknowledgement requires viewer instrumentation |
| Frame rate | Not captured before this audit | Awaiting attached device | actual encoded FPS emitted |
| Bitrate | Not captured before this audit | Awaiting attached device | actual outbound bitrate emitted |
| CPU usage | Not captured before this audit | Awaiting profiling build/device | adaptive quality limitation reason is emitted but is not a CPU percentage |
| Memory usage | Not captured before this audit | Awaiting profiling build/device | no defensible device measurement available |
| Reconnection time | Not captured before this audit | Awaiting network fault injection | reconnect scheduling and registration completion timers implemented |

## Android platform limits

- Standard MediaProjection requires user approval for each new capture session on current
  Android versions. Signaling cannot grant or reuse that OS permission.
- A normal sideloaded APK cannot silently install its own replacement. The app may download,
  verify, and open Android's installer. Silent installation requires an authorized Device
  Owner/Android Enterprise/MDM, OEM privilege, system signing, or root.
- `FLAG_SECURE`, DRM surfaces, banking/password-manager security screens, and some system UI
  may be intentionally excluded from MediaProjection.
- OEM battery managers can still stop third-party processes. Foreground service, boot/package
  receivers, bounded reconnect, and user-guided battery settings reduce but cannot eliminate
  this vendor-controlled behavior.
- Continuous headless JavaScript presence uses React Native's partial wake lock so Doze
  does not suspend WebSocket heartbeats. Its real battery cost is device/firmware dependent
  and must be profiled against the desired unattended-availability SLA.

## Verification completed

- `npm run typecheck -w mobile-native-host`
- `npm run lint -w mobile-native-host`
- `npm run build -w @remotelink/auth-service`
- `npm run build -w @remotelink/signaling-service`
- `npm test -w @remotelink/shared` (RBAC, permission overrides and host-credential
  format/hash/mismatch rejection)
- `apps/mobile-native-host/android/gradlew.bat :app:compileDebugKotlin --no-daemon`
- `npm test -w mobile-native-host` (version, manifest integrity, HTTPS/origin policy, adaptive-video hysteresis and static-screen behavior)
- Responsive policy tests cover 320x568, 360x640, 360x800, 390x844,
  412x915, 480x960, landscape safe areas, and a 1280x800 Android tablet.
- `NODE_ENV=production gradlew.bat :app:assembleDebug --no-daemon --max-workers=2`
  completed successfully (clean build: 7m 5s; final codegen/path rebuild: 1m 29s). Artifact:
  `android/app/build/outputs/apk/debug/app-debug.apk` (225,814,720 bytes,
  SHA-256 `1EEC54BC2CF1AFE5B98C7A23C193BA2CE4BA69BFF8EBDB6CC4914BA94B8F0D22`).
- The current merged release manifest was generated and inspected: cleartext is
  disabled, portrait is not forced, and camera, microphone, audio-modification
  and legacy external-storage permissions are absent.
- An unsigned `assembleRelease` was intentionally attempted and rejected before
  artifact execution with the required release-signing error.
- The complete optimized release pipeline was then exercised with an explicitly
  supplied **test-only debug keystore**. JavaScript bundling, four-ABI CMake,
  Kotlin/Java compilation, lint-vital, R8, resource shrinking, packaging and APK
  signature verification all completed in 5m 33s. The resulting non-production
  test artifact is `android/app/build/outputs/apk/release/app-release.apk`
  (119,774,438 bytes; SHA-256
  `42A459AB20713CE0805D417A462B6F0BAD6B927ACA2956E01127938620F256A6`).
  `apksigner` confirms APK Signature Scheme v2 and the Android Debug certificate,
  so this artifact must not be distributed as production.

`npm audit` currently reports one critical advisory in `tar` used by Expo CLI/native
build tooling. It is not packaged into the Android APK or reachable at app runtime.
The fixed `tar` release cannot be forced globally without violating the `tar@6` contract
used by this monorepo's older node-gyp/electron-builder toolchain. Resolve it through a
coordinated Expo/native build-tool and desktop builder upgrade rather than an unsafe
transitive override.

## Verification still required

- Apply `20260728000000_add_device_host_secret` before deploying the matching auth
  and signaling service versions. The migration is additive and nullable for a
  rolling deployment, but the services must not be released before the column exists.
- Signed release APK assembly using the production keystore.
- REST/signaling integration tests that attempt Android mutation and host registration
  with a missing, malformed, and incorrect host credential.
- Instrumented update negative cases (checksum, signature, downgrade and interrupted download).
- Physical Android connection, network-switch, screen-lock, rotation and encoder-failure tests.
- Representative small-phone, tablet and font-scale visual tests.
- Controlled before/after performance capture on at least one low-end and one modern Android device.

No ADB device was attached during this audit pass, so physical-device claims remain explicitly
unverified.
