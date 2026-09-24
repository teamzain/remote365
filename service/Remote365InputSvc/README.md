# Remote365InputSvc (M2)

Elevated input injector for Remote 365. Reads the host's input frames from
`\\.\pipe\remote365-input` and replays them with `SendInput`, so input reaches
**Task Manager** and other elevated windows (UIPI). See
`apps/desktop/docs/elevated-input-service.md`.

The host bridge (`apps/desktop/src/main/elevatedInput.ts`) already prefers this pipe and
falls back to the in-process `native-input` addon when it's absent — so nothing changes
until you run this.

## Build (MSVC)

Open a **Developer Command Prompt for VS** (x64) and:

```bat
cl /EHsc /O2 /std:c++17 main.cpp /Fe:Remote365InputSvc.exe
```

(No external deps — just Win32. CMake/MSBuild also fine if you prefer.)

## Test M2 — Task Manager control (console mode)

This is the milestone test. It does **not** need the service installed.

1. On the **host** machine, build `Remote365InputSvc.exe` (above).
2. Run it **as Administrator** (elevated) in your interactive session:
   ```bat
   Remote365InputSvc.exe --console
   ```
   It prints `console mode. Pipe: \\.\pipe\remote365-input` and waits.
3. Start the Remote 365 **host** app (so its bridge connects to the pipe — it retries
   every 30s, or just (re)start the host after step 2).
4. From the **viewer**, connect and request control. Open **Task Manager** on the host.
5. You should now be able to **move/click/close Task Manager** from the viewer. 🎉
   (Without the elevated injector, those clicks were silently dropped by UIPI.)

> If control still fails on Task Manager, confirm step 2 was **elevated** — a non-elevated
> `--console` run can't drive elevated windows either.

## Run as a service — auto-start, no manual console (M3a)

Now the service actually injects: the supervisor (session 0) launches the injector as
**SYSTEM inside the active console session** (`--agent` on `winsta0\default`), so its
`SendInput` reaches Task Manager. It restarts the agent on logon / session switch / crash.

```bat
:: run these in an ELEVATED (admin) cmd, from the folder with the exe
Remote365InputSvc.exe --install     :: LocalSystem, auto-start + starts now
Remote365InputSvc.exe --uninstall   :: stop + remove
```

After `--install` you do **not** run anything by hand — open the Remote 365 host and test.
**Stop the `--console` instance first** if it's still running (only one can own the pipe).

**Log file:** `C:\ProgramData\Remote365InputSvc.log` — both the supervisor and the agent
write here. You should see, in order:
```
=== service supervisor starting ===
agent started: session=1 desktop=winsta0\default pid=####
=== agent starting (session=1) ===
[+] host connected
  btn  left down        <- appears when you click from the viewer
```

### Test M3a
1. `--uninstall` is harmless if not installed; then build, then `--install` (elevated).
2. Reboot **or** just open the Remote 365 host app.
3. From the viewer, control the laptop and close Task Manager — should work with **no**
   console window open and **no** manual "Run as administrator".
4. Read `C:\ProgramData\Remote365InputSvc.log` and tell me what it shows.

### M3b — secure desktop (UAC / lock screen)

The SYSTEM agent now **follows the active input desktop**: before each injected frame it
re-attaches its thread to whatever desktop is current (`OpenInputDesktop` + `SetThreadDesktop`),
so input reaches the **Default** desktop *and* the **Winlogon** secure desktop (UAC consent,
Ctrl-Alt-Del, lock screen). The log prints `[desktop] injecting on 'Winlogon'` when it switches.

### M3d — secure desktop **capture** (see the lock / PIN screen)

The agent now also **captures** the secure desktop, closing the old M3b caveat (input
reached the lock screen but the viewer couldn't *see* it). A second pipe
`\\.\pipe\remote365-capture` serves GDI-grabbed frames of whatever desktop is current
(incl. Winlogon / the PIN screen). Pull model: the host writes `[u32 width][u32 height]`
(the exact size its FFmpeg input expects) and the agent replies `[u32 len][BGRA bytes]`.

The host's normal DXGI capture runs in the user session and goes blank the instant the
machine locks; the host detects that (5 consecutive blank grabs) and pulls the lock/PIN
screen from this pipe instead, feeding it into the same encoder — so the viewer sees the
PIN field and, with input already reaching the secure desktop (M3b), can log in remotely.
Host side: `apps/desktop/src/main/secureCapture.ts` (pipe client) + the capture loops in
`hostStream.worker.ts` / `index.ts`. Costs nothing while unlocked (only pulled when DXGI
is blank).

**Install/update:** the desktop app installs/updates this service automatically on first
host-start per version (one UAC prompt; `ensureElevatedInputService` in `index.ts`), or
trigger it from the renderer via the `system:installSecureDesktopService` IPC. Manual path
is still `--uninstall` then `--install` (elevated).

> UAC-specific note: capture now shows the UAC/secure desktop, so the
> `PromptOnSecureDesktop=0` workaround is no longer required. Still pending: **M3c**
> `SendSAS` so the viewer can *trigger* Ctrl+Alt+Del.

### M4 — online after a reboot, before anyone signs in

Until now the device came back only when a **user logged into Windows**: the app is a
per-user program, so both its autostart (HKCU Run) and its keep-alive task need a
session. A PC that rebooted and stopped at the sign-in screen read **Offline** until
someone walked over to it — the most common "why is my device offline" report.

This service is the only piece that runs at boot, so it now owns that gap. The
supervisor watches the console session and, whenever it has **no signed-in user**,
launches the app as SYSTEM with `--prelogon`:

```
[prelogon] host started: session=1 pid=#### exe=C:\Users\...\Remote 365.exe
```

The moment someone signs in it kills that instance (`[prelogon] host stopped`) and the
user's own copy takes over, so the device is never registered twice. Locked-but-signed-in
(Win+L) counts as signed in — that session's app keeps running and is left alone.

**Credential.** The pre-logon instance can't use the signed-in user's access token
(safeStorage/DPAPI is per Windows profile). Instead the app writes a machine-scoped
credential to `C:\ProgramData\Remote365\unattended-host.json` — device access key plus a
host secret from `POST /api/devices/host-credential` — locked down to SYSTEM +
Administrators. The service reads only `exePath` from it; the app reads the rest. So
**the app must run once, signed in, on a build that has this feature** before pre-logon
hosting can work on that machine. Until then the log says:

```
[prelogon] no machine credential yet — sign in once with Remote 365 running to enable pre-logon hosting
```

**Video.** DXGI can't see the sign-in screen, so the pre-logon instance streams through
the same M3d capture pipe as the lock screen, from the first frame. Input already
reaches Winlogon via M3b — so a viewer can watch the sign-in screen and type the
password to log the machine in remotely.

**Backend requirement.** Needs the auth-service and signaling-service changes that accept
a device host credential (`hostSecretMatches` in `canRegisterHost`, the
`/devices/host-credential` endpoint, and header auth on `/auth/ice-servers`). Without
them the device registers as Offline, or comes online but can't relay.

### Updating the service to a new build

The running service locks the exe, so replace it like this (elevated cmd):
```bat
Remote365InputSvc.exe --uninstall      :: stops + removes, unlocks the exe
:: ...copy the freshly-built Remote365InputSvc.exe over the old one...
Remote365InputSvc.exe --install        :: installs + starts the new build
```

## What I need from you

I can't build or run Win32 here — you're the compiler + tester. For each round:
1. Build (`cl` line above) on a Windows box; paste any compile errors.
2. Install the service (`--install`, elevated) and open the host.
3. Send me `C:\ProgramData\Remote365InputSvc.log` + whether Task Manager was controllable.

If the service path misbehaves, the elevated **`--console`** mode (M2) still works as a
reliable fallback while we iterate.
