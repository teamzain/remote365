# Elevated Input Service — Architecture & Plan

## Problem

Remote 365's host runs as a normal (medium-integrity) user process. Windows **UIPI**
(User Interface Privilege Isolation) forbids a medium-integrity process from sending
mouse/keyboard input — or even `WM_CLOSE` — to a **higher-integrity** window. So the
viewer cannot interact with:

- **Task Manager**, registry editor, or anything launched "as administrator"
- **UAC consent prompts** (these live on the **secure desktop**, `Winlogon`)
- The **Ctrl+Alt+Del / lock** screen

This is not fixable in the renderer or in the existing `native-input` addon while the
host stays non-elevated. TeamViewer/AnyDesk solve it with a **background service running
as `LocalSystem`** that performs the injection. This document specifies that service.

## High-level design

```
┌─────────────────────────┐        named pipe (ACL'd)        ┌──────────────────────────┐
│ Remote 365 host (user)  │  ───────────────────────────►    │ Remote365InputSvc        │
│  - capture + WebRTC      │   {move,down,up,key,combo,...}   │  (Windows service, SYSTEM)│
│  - receives viewer input │  ◄───────────────────────────   │  - SendInput / injection  │
│  - forwards to service   │        ack / desktop state       │  - desktop switching      │
└─────────────────────────┘                                   └──────────────────────────┘
```

- The **service** runs as `LocalSystem`, `Automatic` start. It is the only component that
  injects input, so it always has the integrity level needed for elevated windows.
- The **host app** keeps doing capture/encode/WebRTC and control-event receipt. Instead of
  injecting directly, it **forwards** each control event to the service over a named pipe.
- The service injects on the **currently active input desktop**, switching to the
  **secure desktop** (`Winlogon`) when UAC/Ctrl-Alt-Del is up so those can be driven too.

### Why a service (not just "run elevated")

Running the whole app `requireAdministrator` (the quick option) gets a UAC prompt *every*
launch, can't auto-start at boot before login, and still can't touch the **secure desktop**
(a normal elevated process is on the default desktop, not Winlogon). The service is the only
way to also handle UAC prompts and the logon screen.

## Components to build

1. **`Remote365InputSvc`** — native service binary (C++ or C# .NET worker service).
   - Service control handler (start/stop), runs as `LocalSystem`.
   - Named-pipe server: `\\.\pipe\remote365-input` with a DACL allowing only the
     installing user + SYSTEM (deny network sid). Validate every message.
   - Input injection: `SendInput` for mouse/keyboard. For the secure desktop, call
     `OpenInputDesktop`/`SetThreadDesktop` to the active desktop before `SendInput`
     (the service must run in **session 1+**, not session 0 — use a session-aware
     helper that the service spawns into the active console session via
     `WTSGetActiveConsoleSessionId` + `CreateProcessAsUser` with the user token, OR
     keep injection in a per-session "agent" the service launches).
   - Coordinate mapping identical to the current `mapRemotePointToVirtualDesktop`.

2. **Per-session injector agent** (recommended) — because services live in session 0 and
   cannot inject into the user's interactive session directly. The service:
   - Detects the active console session, gets its user token (`WTSQueryUserToken`),
     and launches `Remote365InputAgent.exe` **in that session, on the input desktop**
     via `CreateProcessAsUser` (with `lpDesktop = "winsta0\\default"`; re-launch on the
     secure desktop when UAC appears). The agent does the actual `SendInput` and talks
     back to the service.

3. **Host-app bridge** (`apps/desktop/src/main/elevatedInput.ts`) — a thin client:
   - Connect to `\\.\pipe\remote365-input`. If absent (service not installed/running),
     **fall back to the current in-process `native-input`** (today's behavior) so nothing
     regresses for non-elevated targets.
   - Marshal the existing control-event shapes (`mousemove`, `mousedown/up`, `keydown/up`,
     `keyCombo`, `typeText`) to the pipe protocol.
   - A capability ping so the UI can show "Elevated control: on/off".

4. **Installer integration** (`electron-builder` NSIS `include` script):
   - Install the service binary + agent to `%ProgramFiles%\Remote 365\service\`.
   - `sc create Remote365InputSvc binPath= "..." start= auto obj= LocalSystem` (or use
     the .NET `sc`/WiX). Start it. On uninstall: `sc stop` + `sc delete`.
   - This step requires the **installer** to be elevated (NSIS `RequestExecutionLevel admin`)
     — a one-time UAC at install, not per launch. ✅

## Pipe protocol (v1)

Length-prefixed JSON, one object per message:

```jsonc
// host → service
{ "t": "move",  "x": 0.0, "y": 0.0 }          // normalized to virtual desktop
{ "t": "btn",   "button": "left", "down": true }
{ "t": "key",   "vk": 65, "down": true }
{ "t": "combo", "vk": [0x11,0x12,0x2E] }       // e.g. Ctrl+Alt+Del (see note)
{ "t": "text",  "s": "hello" }
{ "t": "ping" }
// service → host
{ "t": "pong", "secureDesktop": false, "ver": 1 }
{ "t": "ack",  "ok": true }
```

> **Ctrl+Alt+Del** specifically cannot be injected even by SYSTEM (`SAS` is reserved). To
> *send* it, register the service to use `SendSAS()` (from `sas.dll`), gated by the
> `SoftwareSASGeneration` policy. This is the supported path.

## Security

- Pipe DACL: allow `LocalSystem` + the interactive user only; **deny** `NT AUTHORITY\NETWORK`.
- The service accepts input **only** while the host app has an authenticated, active remote
  session (host passes a short-lived per-session token the service validates; service drops
  the pipe when the session ends).
- Rate-limit + bounds-check every coordinate/keycode. No arbitrary command execution over
  the pipe — input primitives only.
- Sign the service + agent binaries (same cert as the app) so SmartScreen/driver-block
  policies don't quarantine them.

## Milestones

1. **M1 — Bridge + fallback (no service yet).** Add `elevatedInput.ts` that *tries* the pipe
   and falls back to `native-input`. Route all host injection through it. (Renderer/host
   unchanged; zero behavior change until the service exists.) ← safe to land first.
2. **M2 — Service skeleton.** `Remote365InputSvc` that creates the ACL'd pipe, logs messages,
   and injects on the **default** desktop via the per-session agent. Manual `sc create` for
   dev. Validate Task Manager becomes controllable.
3. **M3 — Secure desktop + SAS.** Desktop switching for UAC; `SendSAS` for Ctrl+Alt+Del.
4. **M4 — Installer.** NSIS register/unregister + signed binaries + auto-start.
5. **M5 — UI.** "Elevated control" indicator; reconnect logic; health telemetry.

## Files this introduces

```
apps/desktop/src/main/elevatedInput.ts          # host-side bridge (M1)
service/Remote365InputSvc/                       # native/.NET service (M2-M3)
service/Remote365InputAgent/                     # per-session injector (M2)
build/installer/install-input-service.nsh        # NSIS hooks (M4)
```

## Status / next action

- **M1 — DONE.** `apps/desktop/src/main/elevatedInput.ts` is a drop-in for
  `@remotelink/native-input`: it connects to `\\.\pipe\remote365-input` when present and
  otherwise falls back to the native addon. `apps/desktop/src/main/index.ts` now imports
  injection from this bridge (one-line change), so **all host input already flows through
  it** with zero behavior change until the service exists. `isElevatedConnected()` is
  exported for a future "Elevated control: on" indicator.
- **M2 next** — the native `Remote365InputSvc` + per-session agent that opens the pipe and
  injects (default desktop first; Task Manager becomes controllable). This is C++/.NET +
  Win32 (CreateProcessAsUser, OpenInputDesktop, SendInput, SendSAS) and **must be built and
  tested on a real machine** — it cannot be validated here.
