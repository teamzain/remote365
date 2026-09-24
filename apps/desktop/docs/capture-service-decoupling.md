# Capture/Stream Decoupling — Architecture & Plan

## Problem

The host does **screen capture + FFmpeg piping + WebRTC RTP + input injection all on the
Electron main process's thread**. The hot path is a synchronous native DXGI grab:

- `apps/desktop/src/main/index.ts` → `captureTick()` → `capture.captureFrame()` (~8 MB BGRA,
  synchronous, 30–60×/s), then `ffmpegProcess.stdin.write(frame)`.

Because that loop runs on the main thread, the main process's window message pump is starved
while streaming. Result: **the Remote 365 host window itself can't service (injected or
physical) clicks during a live session** — while every *other* app (Task Manager, cmd, …),
being a separate idle process, takes remote input fine.

TeamViewer/AnyDesk/RustDesk avoid this by running capture/encode as a **separate background
component** from their UI window. This doc specifies doing the same.

## Target architecture

```
┌──────────────────────────────┐   MessagePort (control + signaling only)   ┌───────────────────────────┐
│ Electron main (browser proc) │  ◄──────────────────────────────────────►  │ Stream utilityProcess     │
│  - BrowserWindow / UI / tray  │   start/stop, quality, viewer-approve,      │  - native-capture (DXGI)  │
│  - auth / updates             │   SDP offer/answer, ICE, status             │  - FFmpeg encode          │
│  - host signaling WebSocket   │                                             │  - node-datachannel (PC + │
│  - relays SDP/ICE <-> worker  │                                             │    data channels)         │
│  - IDLE per-frame -> window    │                                             │  - input injection (pipe) │
│    stays responsive            │                                             │  - cursor / stats loops   │
└──────────────────────────────┘                                             └───────────────────────────┘
```

Key rule: **no per-frame data crosses the process boundary.** The entire media path (capture →
encode → RTP) and the data channels (which carry viewer input) live *together* in the worker,
so the boundary only carries infrequent control/signaling messages. That keeps the main thread
free (window responsive) without adding IPC overhead per frame.

- **Main** keeps the host **signaling WebSocket** (it drives the approval UI and session
  lifecycle) and just **relays** SDP/ICE between the backend and the worker.
- **Worker** owns the RTCPeerConnection, its `video` track + `input`/`input-critical`/`control`
  data channels, the capture+ffmpeg loop, and injects viewer input (it already goes through the
  ACL'd pipe to `Remote365InputSvc`, so it works the same from the worker).

## Build

`vite.config.ts` gains a third `electron([...])` entry building `src/main/hostStream.worker.ts`
→ `dist-electron/stream/hostStream.worker.js`, with the same `external` list (ws, node-datachannel,
native-capture, native-input, bufferutil, utf-8-validate). Main spawns it with
`utilityProcess.fork(<path>)`. The native addons load from `node_modules` at runtime exactly as
they do in main today (asarUnpack already covers them).

## Phases

1. **P1 — Foundation (additive, zero behavior change).** Add the build entry + a
   `hostStream.worker.ts` skeleton that forks, does a `ready`/`ping` handshake with main, and can
   be started/stopped. Gated behind `CONNECT_X_STREAM_WORKER=1` so default builds are untouched.
   Test = app still works normally; with the flag, the worker process appears and handshakes.
2. **P2 — Move the media+data pipeline into the worker (the big move).** Relocate
   startStreaming/captureTick/FFmpeg + the node-datachannel PeerConnection + data channels +
   input injection into the worker. Main relays signaling and forwards control. This is the step
   that frees the main thread. Verify: video + input still work, **and the host window is now
   clickable/minimizable remotely during a session.**
3. **P3 — Polish.** Move cursor loop, adaptive quality, stats, reconnection into the worker;
   trim the now-dead code from main; crash-restart the worker; surface worker health in the UI.

## Risks / notes

- This refactors the **working** core stream path — highest-risk change in the app. Every phase
  must be built + tested on a real host↔viewer pair before the next. P1 is safe (additive); P2 is
  the risky one and should be validated behind the flag before becoming the default.
- `utilityProcess` is a Node (no DOM) env; the worker must not touch Electron `screen`/`app` for
  display geometry — pass display bounds in from main at start, or query via the native module.
- Keep the current in-main path intact behind the flag until P2 is proven, so we can fall back.

## Status
- **P1 — in progress** (build entry + skeleton). P2/P3 pending.
