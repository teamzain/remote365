# Remote 365 — Full-System Latency & Architecture Audit

**Date:** 2026-07-26 · **Tree:** `codex/env-split-preprod`, working tree version 1.2.40 · **Method:** current-working-tree code audit (host capture/encode, viewer, input injection, backend/signaling, transport), current desktop-log analysis, build verification, and source-backed competitor architecture review. Timings are explicitly marked **measured**, **calculated from code/config**, or **estimated**. This audit did not have synchronized physical access to two endpoint machines, so true click-to-photon and capture/encode/decode stage timings remain unmeasured until §8 instrumentation is implemented.

---

## 0. Implementation status after the audit

The following P0/P1 changes are now implemented and build-verified in the
current working tree:

- **Striped/barcode video corruption:** removed the timed H.264 access-unit
  flush that could emit a picture before all encoder slices arrived. Access
  units now leave the host only at a safe AUD/SPS boundary. The first raw frame
  is primed twice so a static desktop still reaches that boundary without
  reintroducing partial-frame output.
- **Device-specific encoder failure:** if QSV/MFX, NVENC, or AMF passes the
  small capability probe but fails at real stream settings, the worker now
  immediately selects `libx264` and restarts after 150 ms. It no longer retries
  an unsupported hardware encoder indefinitely. Capture resolution/DPI changes
  also restart the pipeline instead of feeding wrongly sized frames.
- **Codec negotiation:** SDP advertises the Chromium-compatible H.264
  Constrained Baseline capability (`42e01f`). An attempted unconditional High
  profile advertisement (`640c1f`) prevented Chromium viewers from answering
  the offer and was rolled back in the emergency 1.2.42 release. Encoder
  profile selection must remain separate until both endpoints explicitly
  negotiate a higher profile.
- **Input responsiveness:** mouse movement is latest-wins at the elevated-pipe
  boundary; wheel events accumulate on a 16 ms cadence; Unicode text injection
  is one batched `SendInput` call; extended/scancode keys cover system
  shortcuts. Critical button/key events flush the latest pointer position
  first, preserving click ordering without replaying stale movement.
- **Media queueing:** send-buffer admission is 64 KB rather than 128 KB, and
  capture begins immediately rather than after a fixed 200 ms startup delay.
- **Adaptation/render overhead:** receiver stats run at 500 ms, playout delay is
  calculated from interval deltas, quality recovery requires a stable 3 s, and
  the large React connection-health state updates at most once per second.
- **Network routing:** an automatically selected relay repair is now fresh for
  at most ten minutes and consumed by one reconnect. It can no longer pin every
  later LAN/Wi-Fi/VPN session to TURN for six hours.
- **Signaling/backend:** WebSocket messages are JSON-parsed once; heartbeat
  handling shares that listener; typing authorization uses a bounded 30 s
  participant cache. Duplicate desktop host starts now share one hardware
  probe and retain one signaling connection instead of closing the first
  socket and paying a reconnect delay.
- **Profiling:** five-second worker aggregates report capture time, writes,
  late ticks, and backpressure. Input acknowledgements record bounded p50/p95
  click-to-injected RTT and viewer click-to-next-presented-frame upper bounds.
  Main and capture-worker event-loop p95/max delay are now measured separately;
  the host also logs request-to-offer, request-to-connected, and
  connected-to-first-frame session waterfall durations. The viewer now carries
  signaling/ICE/track timestamps to the media element and uses
  `requestVideoFrameCallback` to log the first frame Chromium actually presents,
  separating offer/connection delay from decode-and-render delay.
- **Viewer pointer hot path:** video/canvas bounds and intrinsic dimensions are
  cached through `ResizeObserver` and video/window resize events. Mousemove no
  longer forces a synchronous `getBoundingClientRect()` layout flush at 60 Hz.
- **Raw capture allocation:** the native DXGI addon accepts an exact-sized
  caller buffer and the stream worker uses a three-buffer ownership ring. At
  1920x1080 this replaces one fresh 8,294,400-byte allocation per changed frame
  (about 498 MB/s of allocation churn at 60 fps) while never overwriting data
  still owned by FFmpeg stdin. The native ownership test returned
  `reused=true`; the existing 60-frame DXGI test completed at 1920x1080 with a
  40.45 ms observed changed-frame acquisition average on this workstation.
- **Input serialization:** desktop viewer and host now share a compact,
  magic-prefixed binary format for mouse movement/buttons, accumulated wheel,
  and key transitions. JSON remains the fallback for unsupported commands,
  older builds, and web/mobile clients. Round-trip tests measured 13 vs 57 bytes
  for mousemove (77% smaller), 17 vs 50-66 bytes for buttons (66-74%), 20 vs 63
  bytes for wheel (68%), and 7 vs 123-124 bytes for key transitions (94%).
  This also removes JSON stringify/parse and short-lived string allocation from
  the highest-frequency desktop input path. Activation is capability-negotiated
  over the control channel: new-viewer/old-host sessions stay on JSON, and older
  viewers simply ignore the new host advertisement, so staggered upgrades do
  not lose input.
- **File receive isolation:** host-bound file chunks now stream directly to a
  sanitized destination filename instead of retaining every chunk, allocating
  a second full-file `Buffer.concat`, and then writing it. Ordered-index checks,
  duplicate suppression, asynchronous disk writes, and a 120 s inactivity
  cleanup bound both memory and malformed/incomplete transfers while the
  dedicated critical-input channel stays independent.
- **Access verification setup time:** `/verify-access` now decodes the viewer
  JWT once and runs viewer permissions/email, owner security settings, Redis
  presence, and trusted-device status in one `Promise.all` after the device
  lookup. This removes three serialized backend round-trip slots from every
  connection without weakening role, block/allow-list, online, trust, password,
  or lockout enforcement. Auth-service TypeScript build passes; live request
  timing still requires deployment telemetry.
- **Auto-update uninstall reliability:** update-triggered app shutdown now
  terminates the capture utility process, FFmpeg, signaling sockets, elevated
  input pipe, and open receive streams before Electron hands control to NSIS.
  The installer uses an early `customInit` hook to remove stale same-user
  `Remote 365.exe` and app-owned FFmpeg processes before old-version removal,
  addressing NSIS error 2 ("Failed to uninstall old application files"). The
  hook was moved out of the gitignored `build/` directory into the tracked
  `installer/` directory. A complete one-click x64 preprod NSIS package
  compiled successfully with the hook inserted.
- **Renderer freeze detection:** removed the periodic
  `drawImage`/`getImageData` black-frame probe, which synchronously read a
  hardware-decoded GPU frame back to the renderer thread and falsely classified
  legitimate black content. A recurring `requestVideoFrameCallback` heartbeat
  now detects presentation stalls without pixel readback. After five seconds
  without a presented frame it requests urgent recovery; the host rate-limits
  an encoder-only restart that preserves the WebRTC peer/track and immediately
  emits fresh SPS/PPS/IDR. Encoder restarts also discard any partial Annex-B
  tail/access unit so old and new bitstreams cannot be spliced together.
- **Post-rollout input/startup corrections:** the elevated input bridge now
  advances latest-wins mouse delivery from socket write completion rather than
  waiting for a `drain` event that may never fire. Button transitions cancel
  stale viewer-side trailing moves so an old drag coordinate cannot replay
  after mouse-up. Automatic quality changes are held until Chromium presents
  the first frame, preventing a startup encoder restart from discarding the
  initial SPS/PPS/IDR; live 1.2.42 telemetry had exposed track-to-present
  outliers of 2.8-7.0 seconds on this path.
- **Resource/log profiling:** active sessions now report aggregate Remote 365
  process CPU, working-set memory, GPU-process memory, throughput, peers, and
  event-loop delay. ICE topology is logged only when the selected route changes
  rather than whenever its sampled RTT changes, removing a 500 ms
  renderer-to-main logging loop.
- **Static-frame RTP timing:** the worker intentionally sends unchanged-screen
  keepalives every 500 ms, but RTP previously advanced each keepalive by only
  one 30/60-fps tick. The receiver therefore interpreted the remaining gap as
  network jitter; live samples showed playout-buffer spikes of 200-435 ms.
  Frame gaps beyond 2.5 target intervals now resynchronize to wall time while
  active-motion frames retain stable content cadence.
- **Desktop startup/UI parsing:** billing, admin settings, members, analytics,
  chat, meetings, and the super-admin console now load as route-level chunks.
  The immediate renderer bundle fell from 1,798.74 KB to 1,151.27 KB minified
  and from 463.75 KB to 310.53 KB gzip (36.0% and 33.0% reductions). The remote
  viewer/host controls remain eager, so entering a session never waits on a
  route chunk.
- **Additional route isolation:** devices, remote support, premium settings,
  organizations, profile/settings, support, meeting home, and organization
  detail are also deferred. The eager bundle is now 829.73 KB minified /
  244.71 KB gzip: 53.9% / 47.2% below the original 1,798.74 KB / 463.75 KB.
- **Deterministic decoder bootstrap:** live 1.2.46 telemetry measured
  4,143 ms from WebRTC connected to the first presented frame. Inspection
  showed that a slow ICE/DTLS handshake could evict the encoder's only startup
  SPS/PPS/IDR from the three-frame prebuffer; on a static desktop, the following
  P-frames were accepted by RTP but could not be decoded. The host now retains
  the latest fully assembled random-access access unit separately and sends it
  to each newly connected media track before any queued delta frames. The cache
  is cleared on encoder restart/geometry change and is populated only after the
  safe AU boundary used by the striped-frame fix.
- **Per-device automatic updates:** the update switch is no longer hydrated
  from or written to the account profile. Its value is persisted in each
  Windows profile's Electron user-data directory and loaded by the main process
  before the startup feed check. Multiple PCs signed into one account can
  therefore independently enable/disable automatic installation and compare
  their own installed app version with the current feed.

Verification on 2026-07-26:

- Desktop preprod renderer/main/preload/stream-worker build: passed (2,145
  renderer modules).
- Desktop one-click x64 preprod NSIS installer compile: passed.
- Preprod release 1.2.41 was withdrawn after live fleet logs showed successful
  signaling and media-track delivery but no SDP answer/ICE transition. The
  corrected 1.2.42 manifest, installer, and blockmap return HTTP 200. The remote
  installer is 137,040,330 bytes and its SHA-256 matches the local package:
  `3d3ec5e6296de23452931b7d0d64cd5946d7eed3e5ccfd845b64752e4227e7b1`.
- Live recovery verification: devices `310024695` and `641741486` registered as
  1.2.42. A fresh 1.2.42 viewer connection to `310024695` transitioned from
  `connecting` to `connected` in 993 ms, confirming recovery from the
  fleet-wide "Connection Fault" regression. Device `556440029` remains on
  1.2.41 and repeatedly exits shortly after startup; that is tracked as the
  remaining updater/install recovery case.
- Follow-up releases 1.2.43 and 1.2.44 were published atomically after the
  recovery. The final 1.2.44 installer is 137,041,497 bytes with SHA-256
  `f7516abdb2a0012445d99c8ac1fdebae64eb10f213efe4db2e959ec695612a11`;
  manifest, installer, and blockmap return HTTP 200. Hosts `310024695`,
  `556440029`, `641741486`, `100551567`, and `421442173` all upgraded and
  re-registered as 1.2.44. In particular, the former uninstall-failure device
  `556440029` completed two successive unattended upgrades (1.2.42 to 1.2.43
  to 1.2.44) without returning to its prior restart loop.
- UI code splitting shipped as 1.2.45. Its installer is 137,055,276 bytes with
  SHA-256
  `abf94899606970f4bbbe58a988c72274cca537ac9a53c24a662455dbbe6f44c4`;
  manifest, installer, and blockmap return HTTP 200. The same five observed
  hosts all upgraded and re-registered as 1.2.45.
- Release 1.2.46 extended route isolation and shipped the static-frame RTP
  timing correction. In a real session its playout buffer stayed at 5-31 ms
  rather than the earlier 200-435 ms spikes. Ten input samples measured
  injection RTT p50/p95 of 361/543 ms and input-to-next-present p50/p95 of
  396/624 ms; the 231-385 ms network RTT dominated those values. That session
  also exposed the remaining startup bootstrap defect: connected-to-present was
  4,143 ms despite a healthy media connection.
- Release 1.2.48 contains the deterministic decoder bootstrap, duplicate
  bootstrap suppression, and device-local update policy. The final installer is
  137,071,359 bytes with SHA-256
  `8db6d0f6039664d362115ce4d939f39456bd913d3383424e8143a958365a770a`;
  the server-side assembled checksum matches, and manifest, installer, and
  blockmap return HTTP 200. The same six observed devices independently
  upgraded through the preceding 1.2.47 package, proving the updater path; the
  final 1.2.48 rollout then re-registered hosts `310024695`, `556440029`,
  `641741486`, `100551567`, and `421442173`. Device `194572487` had exited
  before the final feed was published and will consume 1.2.48 on its next app
  launch. A controlled connected-to-present waterfall is still required on an
  affected host.
- Auth, signaling, and session TypeScript builds: passed.
- Native input addon rebuilt successfully; the elevated Windows input service
  was recompiled and installed by the running development app.
- Live preprod startup: one hardware probe, one signaling socket, successful
  registration, and duplicate host-start ignored. Before the guard, the same
  startup produced two probes, closed its own first socket, and waited about
  six seconds to reconnect.

The striped-frame fix is code- and build-verified, but still needs a controlled
session on the affected QSV/MFX device to claim hardware-specific visual
verification. The competitor and true click-to-photon benchmark matrix in
section 11 also remains required; build success is not a substitute for those
measurements.

## 1. Executive summary

The architecture is fundamentally sound — WebRTC H.264 media track, P2P after signaling, tiered input channels, tuned receiver jitter buffer, capture/encode in a utilityProcess. The backend is **not** on the media/input hot path, so migrating it to Go/Rust/Python would buy nothing. The gap to Parsec/AnyDesk comes from five system-level problems:

| # | Problem | Standing cost |
|---|---|---|
| 1 | **Open-loop congestion control**: fixed CBR, adaptation via 1.5 s stats polling + full FFmpeg restart, 3–4.5 s reaction; drops corrupt the picture for up to 500 ms because keyframe requests are a no-op | freeze-then-burst cycles; 100–500 ms corruption per loss event |
| 2 | **Relay geography**: prod TURN is London-only (Cloudflare anycast live on preprod only); web viewers *never* receive Cloudflare ICE servers | +150–350 ms RTT for relayed sessions far from UK |
| 3 | **Structural pipeline latency on the host**: +33 ms AU holdback, ~16 ms capture staleness, CPU readback+swscale copies, 128 KB send buffer (≈157 ms of permissible queueing) | ~70 ms nominal host-side, up to ~220 ms congested |
| 4 | **Input backlog risk remains**: mouse moves are not latest-wins coalesced at the host/elevated-pipe boundary. File-transfer progress throttling and per-click service logging have already been fixed in this working tree. | rubber-band cursor after a host/input-service stall |
| 5 | **Renderer housekeeping remains partly unbounded**: translation DOM walking and large unmemoized session components can compete with input dispatch. The prior 1 Hz ping update, background throttling, and missing power blocker are already fixed. | estimated 1–10 ms intermittent stalls; requires a renderer trace |

**Measured current preprod sample (139 log samples, forced relay/UDP):** RTT p50 **301 ms**, p95 **739 ms**; reported receive playout accumulation p50 **76 ms**, p95 **248 ms**; current network-plus-playout estimate p50 **263 ms**, p95 **471 ms**. All 451 selected-route observations were `relay/udp → srflx/udp`. This is not click-to-photon: the current metric excludes host injection, OS response, capture, encode, decode, and presentation. It nevertheless proves that relay path length and receiver queue growth alone make a local-feeling session impossible in the captured runs.

**Calculated direct-path structural floor (NVENC, 30 fps):** approximately **90–180 ms + network RTT**, depending mainly on actual receiver buffering and host copy/encode cost. This is a model, not a benchmark. The P0+P1 plan removes avoidable queueing and input stalls; P2 is required to measureably approach native-app competitors.

---

## 2. End-to-end pipeline ledger (click → photon)

| Stage | Where | Today (nominal) | Congested | After plan |
|---|---|---|---|---|
| Viewer input capture | 16 ms throttle avg +8 ms, JSON, DC send (`VideoPlayer.tsx:925-958`) | ~9 ms | + renderer stalls 2–10 ms | ~5 ms |
| Network (viewer→host) | WebRTC DC, unordered/100 ms lifetime | RTT/2 | +relay detour via London | RTT/2 (nearby relay) |
| Host inject | main-loop dispatch → named pipe → SendInput | ~1 ms | 20–200 ms (file transfer / stale-move replay / per-click fflush) | ~1 ms bounded |
| OS executes + screen updates | — | ~10–30 ms (app-dependent) | — | — |
| Capture sampling | 30 fps timer pacing (`hostStream.worker.ts:106-136`) | ~16 ms avg | — | ~8 ms (60 fps) → ~2 ms (damage-driven) |
| Readback + copies | GPU→CPU memcpy ×3–4 (`native-capture/main.cpp:159-187`) | 5–15 ms | 15–40 ms @4K | ~0 (GPU zero-copy, P2) |
| Convert + encode | swscale BGRA→YUV + NVENC (`index.ts:3033, 2653-2694`) | 8–15 ms | x264 fallback +15–20 ms | 3–8 ms |
| AU holdback | splitter waits for next AU's AUD (`index.ts:2847-2905`) | +33 ms @30fps | — | ~0–8 ms |
| Send buffer | 128 KB drop threshold (`index.ts:3305`) | 0 | up to 157 ms @6.5 Mbps | ≤ 64 ms cap + drop-to-IDR |
| Network (host→viewer) | RTP over WebRTC | RTT/2 | loss → 500 ms corruption (no PLI) | RTT/2, ≤ 100 ms recovery |
| Jitter buffer / playout | target adapts 30–95 ms (`App.tsx:981-999`), but logged accumulated delay is higher | **measured p50 76 ms** | **measured p95 248 ms** | 15–60 ms target only after closed-loop CC and verified queue control |
| Decode + present | HW decode, `<video>` vsync | 10–20 ms | disableGpu toggle → 10–30 ms/frame SW | 10–20 ms |

---

## 3. Verified bottleneck inventory (root cause · impact · fix)

### A. Transport & congestion (biggest structural issue)
1. **No transport-level feedback loop** — libdatachannel track has no TWCC/REMB/NACK/RTX; `request-keyframe` logs "IDR will arrive on next GOP" and does nothing (`index.ts:4169-4189`). Root cause: FFmpeg CLI can't accept runtime commands, so the app can neither force an IDR nor retarget bitrate without a restart. Impact: every adaptation is a ~1 s visible disturbance, so hysteresis must be slow (3–4.5 s), so CBR oversends into congestion → freeze-then-burst; every loss burst → up to 500 ms corruption.
2. **Frame-drop recovery is bounded but incomplete**: the cap is 64 KB and
drop-until-IDR exists behind `REMOTE365_DROP_TO_IDR=1`. It remains off by
default because the CLI encoder cannot force an IDR; enabling it converts
corruption into a freeze lasting until the next ~500 ms GOP.
3. **64 KB buffer threshold ≈ 81 ms of queueing** at 6.5 Mbps before drops
engage (`REMOTE365_TRACK_BUFFER_LIMIT`, env-overridable).
4. **ICE never re-evaluates mid-session**: a bad direct path (comments record 450 ms direct vs 162 ms relay) persists until the next session's 6 h relay pin (`App.tsx:1070-1131, 3151-3181`).
5. **Web viewer on the same LAN as a desktop host relays via TURN**: browsers emit mDNS candidates the libdatachannel host can't resolve; the Electron viewer fixes this with a Chromium switch (`main/index.ts:158`) but the web app can't. +100–300 ms for that pairing.
6. Web viewer ICE-config race: PC built with Google STUN only, real servers applied via `setConfiguration` when `joined` arrives (`SessionViewer.tsx:442, 464-471`).

### B. Relay geography (biggest WAN issue)
7. **Prod serves London-only TURN** — Cloudflare anycast code exists (`auth.ts:1000-1051`) and is live on preprod, but `/root/.env.production` on 159.65.84.190 lacks `CLOUDFLARE_TURN_KEY_ID`/`CLOUDFLARE_TURN_API_TOKEN`. +150–350 ms media RTT for relayed non-UK sessions.
8. **Web clients never get Cloudflare**: `createMeetingIceServers()` (`signaling-service/index.ts:527-545`) returns Google STUN + London coturn only; all six call sites (joined/viewer-joined/meetings) use it.
9. `/api/auth/ice-servers` does an **uncached HTTPS POST to Cloudflare per request** (50–200 ms, worst 2.5 s) — no server-side credential cache (`auth.ts:1017-1032`).

### C. Host video pipeline
10. **Full CPU readback, 3–4 copies per frame, no dirty rects** (`native-capture/main.cpp:108-187`): GPU CopyResource → Map+memcpy into a *freshly allocated* Napi::Buffer → 8.3 MB (1080p) stdin pipe write → FFmpeg pipe read; DXGI dirty/move rects ignored. 5–15 ms @1080p, 15–40 ms @4K + memory-bandwidth pressure.
11. **+1-frame AU holdback**: the splitter emits AU *N* only when AU *N+1*'s AUD arrives — fixed +33 ms @30 fps (`index.ts:2847-2905`). ⚠️ The v1.2.30 lesson stands: only *completed* AUs may ever be flushed (truncated-slice streaking); the safe fix is length-prefixed AU framing from the encoder side, which the FFmpeg-stdout architecture cannot provide — another reason for P2.
12. **CPU swscale every frame** including re-fed static duplicates (`index.ts:3033`): 3–10 ms.
13. **Quality change = full FFmpeg restart** (`index.ts:4046-4064`): 200–500 ms freeze per adaptation.
14. **Timer-paced capture** adds avg ½-frame staleness (~16 ms @30 fps) vs damage-driven acquire; default tiers are 30 fps (sharp/ultra are 60, HW-only).
15. **libx264 fallback** (no GPU encoder): 10–25 ms/frame @1080p on the same CPU doing the copy chain.
16. **Compatibility decision:** SDP advertises interoperable Constrained
Baseline `42e01f`. Unconditionally advertising High `640c1f` in 1.2.41
prevented Chromium from answering and caused the fleet-wide Connection Fault.
Higher profiles require explicit two-ended negotiation.

### D. Host input path
17. **Fixed:** host-bound file chunks stream to disk with ordered-index and
duplicate checks, throttled progress, inactivity cleanup, and no whole-file
`Buffer.concat` memory peak.
18. **Fixed:** elevated-pipe movement is one-write-in-flight/latest-wins and
advances via write completion rather than an unreliable `drain` wait. Critical
buttons/keys flush the latest point first; viewer button transitions cancel
stale trailing-move timers.
19. **Fixed in source — verify deployed service version**: button logging is now gated by `g_verbose` (`service/Remote365InputSvc/main.cpp:220`). Installed hosts still need the rebuilt service executable.
20. In-process capture fallback (worker OFF) puts 8 MB writes on the input loop → 10–50 ms jitter (`index.ts:3126-3170`).
21. Clipboard poll every 500 ms on the main thread — occasional tens-of-ms spikes on clipboard contention (`index.ts:3754-3766`).
22. **Mostly fixed:** addon and service use scancode/extended-key flags,
`typeText` batches one `SendInput` array, wheel deltas accumulate at the viewer,
and system shortcuts have explicit mappings. True SendSAS/Ctrl+Alt+Del remains
a privileged Windows-policy task.

### E. Viewer renderer
23. **Partly fixed**: ping handling intentionally performs no state update (`App.tsx:3525-3528`). Connection-health/elapsed state and large unmemoized session components still require a React Profiler trace before assigning a millisecond cost.
24. **Fixed:** English performs one initial restoration pass with no interval or
MutationObserver. Other languages pause both translation mechanisms while a
remote stream is active.
25. **Fixed in the current tree**: viewer/session windows use `backgroundThrottling: false` and session lifecycle owns an Electron `powerSaveBlocker` (`main/index.ts:233-237, 1992, 2070, 4895`). Keep an occluded-window regression test.
26. **No `navigator.keyboard.lock()` / pointer lock** — Alt+Tab, Win, Alt+F4 never reach the host except via menu.
27. **Fixed:** high-resolution wheel deltas accumulate into a 16 ms trailing
flush and desktop input uses capability-negotiated compact binary frames.
28. **Fixed:** the synchronous `getImageData` GPU readback probe was replaced by
a `requestVideoFrameCallback` presentation heartbeat and urgent recovery.
29. **Input RTT profiling now exists**: clicks carry a sequence, the host acks after injection, and `VideoPlayer` reports click-to-injected RTT (`VideoPlayer.tsx:143-167, 451-464`; `main/index.ts:4149-4153`). This is useful, but it is not click-to-photon.
30. `disableGpu` user toggle → software decode disaster (10–30 ms/frame); first thing to check in "it's slow" support cases (`main/index.ts:144-145`).

### F. Backend (control plane only)
31. **Improved:** independent `/verify-access` permission, security, presence,
and trusted-device queries now run in parallel after one device lookup. WAN
setup still pays auth-service/database RTT and bcrypt when trust/password
checks require it.
32. Chat workload shares the signaling event loop: a DB query per `chat-typing` event (`signaling/index.ts:999-1002`), 4–5 queries per chat message — can head-of-line-block SDP/ICE relay under load.
33. **Fixed:** signaling uses one message parse/listener with shared heartbeat
handling; SDP relay no longer pays the former duplicate parse path.
34. Clean (keep as-is): pure in-memory Map relay for signals, no DB/Redis per signal, no per-message JWT, media/input cannot transit the WS, LAN Direct bypasses the backend entirely.

---

## 4. Architecture review & recommendation

**Keep:** Node/TypeScript backend (it's off the hot path — a Go/Rust/Python rewrite is irrelevant to latency; this confirms the July finding), WebRTC as transport (UDP+DTLS-SRTP with ICE/TURN fallback is exactly what QUIC/raw-UDP alternatives would rebuild, minus NAT traversal maturity), the media-track + tiered-data-channel design, LAN Direct, the utilityProcess split, the tuned jitter buffer.

**Change (the recommended target architecture):**
1. **Media plane stays P2P WebRTC, but the host encoder moves in-process**: extend `native-capture` into a capture+encode addon — DXGI texture → NVENC/AMF/QSV via D3D11 zero-copy (no readback, no swscale, no pipes, no AU-boundary guessing). This single change removes findings 10, 11, 12, 13 *and* unlocks runtime bitrate retargeting + IDR-on-demand, which is the prerequisite for real congestion control. FFmpeg stays as the no-GPU fallback.
2. **Closed-loop rate control at the app level** (no protocol change): viewer already polls `getStats` at 1.5 s — tighten to 250–500 ms, send deltas to the host, host adjusts encoder bitrate/fps *without restart* (needs #1) using delay-gradient + loss (GCC-style). Target: adaptation in <500 ms, no visible tier flips, and the jitter buffer can then float lower.
3. **Recovery semantics**: PLI/`request-keyframe` → force IDR (needs #1). Until then: after any send-side frame drop, drop *all* frames until the next IDR (converts 500 ms corruption into ~250 ms freeze — strictly better).
4. **Relay fabric**: Cloudflare anycast TURN everywhere (prod env vars + web parity) — this is the TeamViewer "nearest PoP" equivalent for a fraction of the effort. London coturn stays as fallback.
5. **Signaling**: keep in Node; move chat handling off the signaling process (or at least off its event loop) as scale grows; single parse per message.
6. **Input protocol**: define once in `packages/shared` (binary-packed: ~12-byte move frames vs ~80-byte JSON), latest-wins coalescing at both ends, wheel delta accumulation. Not a transport change — the channels are already right.

**Competitive positioning** (details in §5): every sub-50 ms competitor pairs mandatory HW encode with near-zero receiver dejitter and damage-aware capture. Items 1–3 above are precisely that gap. Dirty-rect *encoding* (AnyDesk DeskRT-style) is a codec-level moonshot — not recommended; dirty-rect-*informed capture/fps* (skip static frames, drop to low fps when nothing changed) gives most of the benefit for 5 % of the work.

## 5. Competitor architecture comparison (not a head-to-head benchmark)

No competing client was instrumented on the same hosts/network during this audit. Therefore this table records published capabilities and observable architectural gaps, not invented “typical latency” numbers.

| Product | Published / inspectable evidence | Gap relevant to Remote 365 |
|---|---|---|
| Parsec | Official overview documents P2P BUD reliable UDP, rapid loss/congestion adjustment, zero-copy GPU capture-to-encoder, hardware encode/decode, and frame-timing optimization. Its overlay exposes encode, decode, network, bitrate, codec, resolution and chroma metrics. | We lack zero-copy host encode, runtime rate control/IDR, and comparable per-stage telemetry. |
| AnyDesk | Vendor publishes DeskRT, 60 fps, efficient low-bandwidth behavior, and a claimed `<16 ms` LAN latency. Treat the latency figure as a vendor claim, not an independent result. | We use whole-frame video and ignore DXGI damage; DeskRT is content-aware/proprietary. |
| RustDesk | Open-source tree separates capture (`scrap`), codecs/networking (`hbb_common`), platform input (`enigo`), and peer services; supports codec/quality/FPS choices. | Rust itself is not the advantage; native ownership of capture/codec/network paths and fewer JS hot-path allocations are. |
| TeamViewer | Published material confirms UDP with TCP fallback and a globally operated connection infrastructure, but does not expose codec internals or reproducible latency figures. | Relay reach/geography is the actionable comparison; avoid claiming proprietary internals we cannot verify. |
| Splashtop | Vendor material advertises up to 60 fps, minimal latency/variance, and adjustable fidelity, without enough public detail for an implementation-level comparison. | Use as a product acceptance target; architecture claims require black-box testing. |
| Chrome Remote Desktop | Google states it uses WebRTC. Public product documentation does not establish its encoder mode or latency floor. | It validates WebRTC as a viable transport choice; it does not prove our current pipeline is faster. |
| Microsoft RDP | Microsoft documents UDP Shortpath with active network monitoring/rate control, direct STUN, TURN relay fallback, and migration of graphics/input/device channels to the chosen low-latency path; AVC444 traffic data shows workload-aware bandwidth behavior. | Mature path racing/rate control and graphics semantics are missing; RDP’s command/graphics remoting is not directly comparable to our pixel-video path. |

Sources: Parsec [architecture](https://support.parsec.app/hc/en-us/articles/32361354307348-Overview) and [overlay metrics](https://support.parsec.app/hc/en-us/articles/32381603663636-Stream-Overlay-Stats-and-Logging); AnyDesk [performance claims](https://anydesk.com/en/performance); RustDesk [source tree](https://github.com/rustdesk/rustdesk); TeamViewer [UDP/TCP connection material](https://static.teamviewer.com/resources/2021/06/TeamViewer-Remote-Management-Solution-Brochure_EN.pdf); Splashtop [published 60-fps/minimal-latency case material](https://www.splashtop.com/api/assets/es/39AruCfS2PDHag4Bm1fAbS/Warner-Bros-Case-Study.pdf); Chrome Remote Desktop [WebRTC statement](https://remotedesktop.google.com/); Microsoft [RDP Shortpath](https://learn.microsoft.com/en-us/azure/virtual-desktop/rdp-shortpath) and [RDP graphics bandwidth](https://learn.microsoft.com/en-us/azure/virtual-desktop/rdp-bandwidth).

Takeaways: (a) WebRTC remains a defensible transport; the measured failure is path selection/relay distance plus queue growth, not “WebRTC” in isolation; (b) every well-documented low-latency design exposes stage telemetry and closes the congestion-control loop; (c) local cursor rendering is already correct (`RemoteSessionChrome.tsx`); (d) zero-copy native capture/encode is the clearest long-term media-plane gap.

## 6. Advanced optimizations verdict (task 6)

**Adopt:** NVENC/AMF/QuickSync (have it — make it in-process/zero-copy), GPU decode (have it — guard the disableGpu toggle), dynamic FPS via damage detection (static screen → 5–10 fps, motion → 60), adaptive bitrate without restart, double-buffered capture (staging-texture ring instead of per-frame alloc), dirty-rect-informed *capture skip*.
**Already have, keep:** multi-threaded pipeline (utilityProcess), zero-copy viewer rendering (`srcObject`), local cursor.
**Skip for now:** frame prediction (complexity ≫ benefit at our RTTs), full tile/region streaming and custom codecs (DeskRT clone), triple buffering (adds latency by definition), B-frames/lookahead (correctly disabled everywhere).

## 7. Networking verdict (task 7)

TCP vs UDP vs QUIC: already correct — media/input ride UDP (SRTP/SCTP) with TURN-TCP/TLS fallback; TCP_NODELAY concerns don't apply to the hot path; QUIC is disabled in Chromium (`disable-quic`) only for signaling fetches, irrelevant. Keep-alives are sane (20 s WS ping / 90 s presence TTL / 10 s host heartbeat). The actionable network items are: buffer cap 128 KB→64 KB with drop-to-IDR (finding 2–3), packet-size hygiene via binary input frames (finding 6/§4-6), congestion control (§4-2), and relay proximity (§4-4). Retransmission tuning (NACK/RTX) arrives with the in-process encoder + a real RTCP path, or is approximated by drop-to-IDR + shorter effective recovery.

## 8. Profiling to add (task 9) — replace estimates with measurements

### Existing measurements captured in this audit

Source: `C:\Users\Zain Ul Abidden\AppData\Roaming\Remote 365\logs\main.log`, current preprod runs on 2026-07-26. The viewer metric is `RTT/2 + average jitterBufferDelay`; it is a network-plus-receiver estimate, **not** end-to-end latency.

| Metric | Samples | Min | p50 | p95 | Max | Mean |
|---|---:|---:|---:|---:|---:|---:|
| selected-pair RTT | 139 | 245 ms | 301 ms | 739 ms | 3,284 ms | 396.2 ms |
| packet loss delta | 139 | 0% | 0% | 10.7% | 40.3% | 2.0% |
| decoded FPS | 139 | 0 | 37 | 59 | 71 | 30.6 |
| configured jitter target | 139 | 45 ms | 50 ms | 95 ms | 95 ms | 58.5 ms |
| reported accumulated playout | 139 | 0 ms | 76 ms | 248 ms | 253 ms | 99.4 ms |
| current network+playout estimate | 139 | 133 ms | 263 ms | 471 ms | 1,702 ms | 297.8 ms |

Route evidence: 451/451 parsed selected-pair lines were `local=relay/udp remote=srflx/udp`. The test profile had `r365_force_relay` enabled, so this proves the forced-relay profile is unacceptable for latency; it does not prove normal `iceTransportPolicy=all` always relays. Session waterfall examples show connect→`joined` around 0.8–2.6 s and connect→ICE `connected` around 2.0–7.3 s, but “first frame” is not presently timestamped.

The current `playoutBuf` calculation is cumulative average jitter-buffer residence time, not instantaneous queue depth. Its climb toward ~250 ms is still a real symptom of persistent receiver delay, but the new HUD must also report interval deltas and presentation timestamps to distinguish accumulated historical average from current queueing.

1. **E2E input-to-photon**: viewer stamps `t0` + seq on mousedown; host echoes `{seq, tInject}` on `input-critical`; viewer records `t2` at next `requestVideoFrameCallback` after the echo → three-segment breakdown (network, inject, video RTT). Surface p50/p95 in the health chip (the `latency` display is currently hardwired 0 — finding 29).
2. **Host stage marks** (worker): capture-acquire → readback → stdin-write → first-NAL-out → AU-emit → track-send; 5 s aggregates over the existing health log.
3. **Viewer**: `requestVideoFrameCallback` presentation cadence (real FPS + inter-frame jitter), `getStats` jitterBufferDelay/framesDropped/PLI count already available — log deltas.
4. **Event-loop lag gauges**: 100 ms setInterval drift on host main and worker (>10 ms drift = contention alarm; catches findings 17/20).
5. **Session-start waterfall**: timestamp verify-access → WS open → joined → offer → answer → ICE connected → first frame (catches finding 31 regressions).
6. Keep all of it behind a `r365_perf_hud`-style flag; per-event logging in hot paths remains banned.

## 9. Prioritized implementation plan

### P0 — hours-to-days, config + small diffs (est. combined: relayed sessions −150–350 ms RTT; input lag spikes largely eliminated)
1. Add `CLOUDFLARE_TURN_KEY_ID`/`CLOUDFLARE_TURN_API_TOKEN` to `/root/.env.production` + recreate auth-service (procedure proven on preprod). *(needs user authorization for prod)*
2. Web parity: make `createMeetingIceServers()` async and include Cloudflare (share auth-service's logic or an internal endpoint); server-side CF credential cache (~5 min TTL) fixes finding 9 at the same time.
3. **Source complete; deployment verification remains:** ship the rebuilt service containing verbose-gated button logging.
4. **Complete in the current tree:** file progress is throttled to ~250 ms; next change is streaming writes instead of retaining/concatenating the entire file.
5. **Complete in the current tree:** ping no longer updates React state and click-to-injected RTT is displayed.
6. **Complete:** translation observation/interval pauses while a session is
active; English has no ongoing sweep.
7. **Complete in the current tree:** `backgroundThrottling: false` + `powerSaveBlocker` for viewer session windows.

### P1 — days-to-2-weeks, in-place fixes (est.: −30–60 ms steady-state; corruption 500 ms → ~250 ms freeze; smoother scroll/drag)
8. Drop-to-IDR policy: after any send-side frame drop, discard until next keyframe (index.ts:3306-3309).
9. Track buffer cap 128 KB → 64 KB (env exists: `REMOTE365_TRACK_BUFFER_LIMIT`) — measure with the new HUD first.
10. Host-side latest-wins mousemove slot (one pending move max); drop elevated-pipe backlog on reconnect instead of replaying (elevatedInput.ts:52-64).
11. Viewer wheel delta accumulation with 16 ms flush (VideoPlayer.tsx:914-923).
12. `React.memo` VideoPlayer + RemoteSessionChrome; move `connectionHealth`/`elapsed` consumers into leaf components.
13. `navigator.keyboard.lock()` in fullscreen sessions (Alt+Tab/Win reach the host).
14. Default more tiers to 60 fps when HW-encode present (halves sampling + holdback latency; July round already did sharp/ultra).
15. Parallelize independent `verify-access` queries; drop the fixed 200 ms handover delay to ~50 ms or event-driven (devices.ts, index.ts:3594-3598).
16. Fix SDP profile-level-id to match High profile output (index.ts:3700); single JSON.parse in signaling (dedupe the two message handlers); batched `SendInput(N, arr)` for typeText; unify addon/service scancode+wheel behavior.
17. Extend the existing click-to-injected RTT probe into true E2E instrumentation (§8); ship with P1 so P2 is measured, not guessed.

### P2 — 1–2 months, the architecture step (est.: host-side ~70 ms → ~25–35 ms; congestion behavior transformed; 4K viable)
18. **In-process capture+encode addon**: D3D11 → NVENC (then AMF/QSV) zero-copy, staging ring buffer, damage-driven acquire with dynamic FPS, runtime bitrate/IDR APIs, length-prefixed AU output (kills the +33 ms holdback safely — the v1.2.30 truncated-slice trap can't occur with explicit framing). FFmpeg path remains as fallback for no-GPU machines.
19. **Closed-loop rate control**: 250–500 ms viewer feedback → runtime encoder retarget, no restarts; then lower jitter-buffer floor toward 15–30 ms on clean links.
20. Real PLI → forced IDR; shorten GOP to 1–2 s (periodic IDRs become less critical once on-demand exists — reclaims CBR budget).
21. Binary input protocol in `packages/shared`, shared by desktop/web/host.
22. Mid-session ICE re-evaluation (restartIce toward relay when the direct path is measurably worse — the data collection already exists in route-repair).

### P3 — exploratory
23. AV1 screen-content encode (NVENC AV1 on 40-series+, SVT-AV1 rt) behind capability negotiation; 4:4:4/lossless text mode; web-viewer mDNS workaround (host-side ICE-lite or TURN-priority tuning for browser peers); regional signaling PoP if setup time matters after P1-15.

## 9b. P3 outcomes (2026-07-26 evening pass)

**Shipped:**
- **Web-on-LAN mDNS fix** (`addRemoteCandidateSafe`, main/index.ts): browser viewers' unresolvable `.local` candidates are now dropped before they reach libjuice (they stalled resolution / could throw, which pushed same-LAN web sessions onto the TURN relay, ~+100–300ms). Direct LAN pairing works via **peer-reflexive discovery**: the viewer's connectivity checks toward our real-IP candidates reveal its true address and ICE forms the pair from that. All remote-candidate adds are now also guarded so one malformed candidate can't abort the handler.
- **AV1 capability discovery** (`detectAv1Capability`): background probe for `av1_nvenc` (RTX 40+) / `av1_qsv` (Arc/Xe) / `av1_amf` (RX 7000+), logged and surfaced on the 5s media-health line (`av1cap=`). No streaming behavior change — this is the fleet-survey step that decides whether the full AV1 pipeline is worth scheduling.

**AV1 pipeline — remaining work (spec):** node-datachannel 0.32.1 already ships `AV1RtpPacketizer`, so the transport is ready. Still needed: (1) an **OBU temporal-unit splitter** — the current AU splitter is H.264 Annex-B/AUD-specific; AV1's low-overhead bitstream has no start codes, so framing must parse OBU headers (or use IVF and strip per-frame headers); (2) FFmpeg arg set for `av1_nvenc` (`-tune ull`-equivalent: `-preset p1..p4 -delay 0 -g fps*2`), screen-content tools where exposed; (3) SDP: `Video.addAV1Codec` media description + payload negotiation; (4) viewer capability gate: browsers advertise AV1 via `RTCRtpReceiver.getCapabilities('video')` — viewer sends `supportsAv1` in `request-offer`, host requires flag+capability+probe before switching; H264 stays the universal fallback. Decode caveat: browser AV1 decode is often software (dav1d) unless the viewer GPU has AV1 hw decode — gate on that too or the viewer pays 10–20ms/frame.

**4:4:4 / lossless text mode — not feasible on the current path (documented, not built):** browser WebRTC H.264 decoders accept 4:2:0 profiles only (CB/Main/High); High 4:4:4 Predictive is not decodable in `<video>` via RTP, so a 4:4:4 mode requires either the AV1 path (AV1 supports 4:4:4 in profile 1, same browser-support caveats) or a WebCodecs-based viewer pipeline — i.e., after P2, not before. Chroma-smeared text today is mitigated by resolution (sharp/ultra tiers stream native res), which is the practical ceiling for now.

**Regional PoP options (infra decision, costed):** the London droplet hosts everything incl. coturn. Options, cheapest first: (a) **Cloudflare anycast TURN** — already live on preprod, pending on prod; covers relay proximity globally at $0.05/GB with zero new infra — this substantially IS the regional-PoP fix for media; (b) a second coturn droplet in DO `blr1` (Bangalore, ~$6–12/mo) added to the ICE list for Gulf/South-Asia fallback when Cloudflare is unreachable; (c) regional *signaling* replicas only matter for session-setup time (5–7 RTTs) — a later optimization after P1-15 (parallelized verify-access) lands, since media never touches signaling after setup. Recommendation: (a) now, (b) only if Cloudflare cost/availability disappoints, (c) defer.

## 10. What's already good (do not regress)

### 2026-07-27 H.264 corruption follow-up

Live session `556440029` presented its first frame after a startup interval
containing 6.9% RTP packet loss, then continued decoding a persistent
black/multicolour block-and-stripe mosaic. The remote desktop itself was not
corrupted; Chromium had lost part of an H.264 reference picture.

The code inspection found that the native sender installed only
`H264RtpPacketizer`. It did not chain `RtcpNackResponder`, so packets requested
by the browser through RTCP NACK could not be retransmitted. Version 1.2.50
adds `RtcpSrReporter` plus a 2,048-packet NACK history to every video track.
At 12 Mbps this retains roughly 1.6 seconds of RTP payload, comfortably beyond
the measured 268-400 ms long-haul RTT.

Two recovery defects were fixed at the same time:

- The viewer now requests an urgent fresh SPS/PPS/IDR when interval packet loss
  can have poisoned the decoder reference chain, including any startup loss.
- Every keyframe request now restarts only capture/encode (with a three-second
  cooldown) while preserving the WebRTC connection. Waiting for the nominal
  `-g fps/2` boundary was not actually a half-second guarantee: GOP is counted
  in encoded frames, and a static damage-driven desktop may emit only two
  frames per second, stretching recovery to about 15 seconds.

Expected impact: ordinary isolated packet loss is recovered by NACK without a
visible reset; unrecoverable loss is bounded by the stats interval plus encoder
restart instead of persisting indefinitely. This must be validated on the
affected host/viewer pair after both endpoints install 1.2.50.

#### 1.2.50 live validation and correction

Validation on the affected `556440029` pair disproved the assumption that loss
was isolated. The selected relay/UDP path measured roughly 248-400 ms RTT and
reported repeated interval loss bursts of 40-93%. The new four-second
loss-triggered recovery then restarted the encoder repeatedly; each restart
created another large IDR packet burst. The three-second quality upshift
hysteresis also climbed back toward `ultra` after only a few clean samples,
causing a restart/IDR/loss feedback loop. The second corruption screenshot is
the direct result.

Version 1.2.51 therefore changes the control system, not just the decoder:

- `PacingHandler(14 Mbps, 5 ms)` is chained between RTP packetization and NACK
  history so a keyframe is spread across the network rather than emitted as an
  instantaneous UDP microburst.
- Automatic sessions start at balanced 1080p/4.5 Mbps. Smooth, sharp and ultra
  are capped at 2.5, 7 and 10 Mbps respectively (12 Mbps for very wide capture).
- RTT of 180 ms or higher caps automatic quality at sharp. Any loss blocks an
  upshift for 20 seconds, and each tier then requires ten clean seconds.
  Severe loss downshifts on the first sample.
- Loss marks decoder recovery as pending; one urgent IDR is requested only
  after two clean seconds and with a 20-second viewer cooldown. Host encoder
  restarts accept only urgent requests and have a 15-second cooldown.
- Static-screen keepalive is shortened from 500 to 100 ms, making GOP progress
  wall-clock-bounded without forcing encoder restarts on ordinary startup
  probes.

NVENC flags near-optimal (`-tune ull -delay 0`, bf 0, no lookahead, `-async_depth 1` QSV); single-frame-in-flight backpressure with drain-wait; encoded-only data across the process boundary (transferred ArrayBuffers); content-cadence RTP timestamps with drift resync; `timeBeginPeriod(1)`; tiered input channels + never-drop-critical guard; adaptive jitter buffer; ICE prefetch/cache; disconnect grace periods; local cursor with no RTT dependency; mDNS disabled on Electron (LAN direct-path fix); LAN Direct reusing the identical WebRTC path; in-memory signaling relay with no per-message DB/JWT.

## 11. Verification and measurement limits

- Desktop renderer/main/preload/stream-worker preprod build passed on
  2026-07-26: 2,146 renderer modules. After route-level splitting, the eager
  renderer bundle is 830 KB minified / 245 KB gzip; deferred screens are
  emitted as independent chunks. This improves startup/parse work and
  does not alter the active media hot path.
- TypeScript builds passed independently for signaling, auth, and session services.
- The current log dataset is a real remote-session dataset, but it was generated with `r365_force_relay`; it is suitable for proving relay-path and receiver-delay problems, not for characterizing normal direct/LAN performance.
- CPU, GPU, memory, capture-stage, encode-stage, decode-stage, presentation, and click-to-photon distributions cannot be honestly supplied from current telemetry. Existing code records click-to-injected RTT and fallback capture averages, but the log sample did not contain synchronized, full-pipeline marks. Implement §8, then run the benchmark matrix below before accepting latency claims.

Required benchmark matrix after instrumentation:

1. LAN direct, same switch: 1080p30, 1080p60, 1440p60; static UI, scrolling, drag, typing, video.
2. WAN direct under controlled `tc`/Clumsy profiles: RTT 20/50/100/200 ms, jitter 0/10/30 ms, loss 0/0.5/2/5%, bandwidth 3/6/12/25 Mbps.
3. TURN relay through each production region with the same profiles.
4. NVENC, AMF, QSV, and x264 fallback; hardware and software decode.
5. At least 30 minutes and 10,000 input samples per cell; report p50/p95/p99 for click-to-injected, click-to-photon, capture, encode, network, decode, present, FPS, frame-time variance, dropped frames, CPU/GPU/RSS, and throughput.
6. Run Parsec, AnyDesk, RustDesk, TeamViewer, Splashtop, Chrome Remote Desktop, and Microsoft RDP on the identical host/viewer/network harness. Until this is done, competitor numbers remain published claims or architecture comparisons, not Remote 365 benchmark results.
