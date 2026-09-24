# Auto-Update Reliability — why devices went offline and the three defense layers

## The incident

After publishing a release, some fleet PCs showed

> **Remote 365 Setup** — Failed to uninstall old application files. Please try
> running the installer again.: 2

and stayed **offline** until a human clicked OK and relaunched the app. Other
PCs went offline after updates with no dialog at all.

## Root-cause chain (verified against app-builder-lib 24.13.3 NSIS templates)

1. During an update, the new installer runs the **already-installed old
   uninstaller** (`/S /KEEP_APP_DATA --updated _?=$INSTDIR`).
2. The old uninstaller's `un.atomicRMDir` renames **every** file in `$INSTDIR`
   aside; if a **single file is locked**, it rolls all renames back and
   `Abort`s → **exit code 2** (that's the ": 2"). Real lockers seen on the
   fleet, none of which a NON-elevated per-user updater can kill:
   - a **legacy `Remote365InputSvc`/agent registered from
     `$INSTDIR\resources`** — SYSTEM-owned, and the service supervisor
     *respawns* the `--agent` process after any kill;
   - orphaned `resources\ffmpeg.exe` (when the PowerShell path-filtered kill
     is unavailable);
   - transient AV / Search-indexer locks.
3. electron-builder's `uninstallOldVersion` retries 5×, then
   `handleUninstallResult` shows a **`MessageBox` with NO `/SD` flag** — it
   pops up **even in fully silent background updates** — and `Quit`s the
   installer. electron-updater already quit the app before this, so the device
   is offline behind a modal nobody can click.
4. Separately, `autoInstallOnAppQuit` fired the installer during **Windows
   shutdown**; Windows kills the installer mid-swap → half-updated install
   that never comes back (the no-dialog offline cases).

## Defense layers (all shipped together)

### 1. Installer tolerates a failed old-uninstall — `installer/installer.nsh`

`customUnInstallCheck` / `customUnInstallCheckCurrentUser` replace
electron-builder's modal+Quit entirely (see `handleUninstallResult` in
app-builder-lib `installUtil.nsh`). On old-uninstaller failure we log, run one
more process sweep, and **continue installing over the existing files**. The
abort rolled everything back, so extraction simply overwrites in place; NSIS's
silent extraction fallback (`Nsis7z::Extract`) skips the odd still-locked file
instead of dying. A stale leftover file is cosmetic; a dead host is not.

This macro lives in the **new** installer, so the whole fleet is protected the
first time it updates **to** this build — old machines download the new
installer fresh.

### 2. Future uninstallers can't abort — `customRemoveFiles`

Same atomic move as stock, but on a locked file it **restores and returns
success** instead of `Abort`(2). From this release on, the "old uninstaller"
that future updates invoke cannot produce the error at all.

### 3. Relaunch watchdog + no shutdown-time installs — `src/main/index.ts`

- `spawnUpdateRelaunchWatchdog()` — armed immediately **before**
  `quitAndInstall`. A detached `cmd.exe` script in `%TEMP%` (survives the app,
  holds no lock in the install dir, immune to PowerShell execution policy):
  waits 60 s, then every 20 s for ~10 min: app running → stand down; installer
  running → keep waiting; app gone → relaunch `--hidden`; exe missing
  (installer killed mid-swap) → re-run the downloaded silent installer
  **once**. Uses `ping -n` for sleeps — `timeout` breaks with stdin=NUL and
  would collapse every wait to 0 s.
- `autoUpdater.autoInstallOnAppQuit = false` — updates apply **only** through
  the controlled idle-restart path, never during an OS shutdown race.
- Background installs get 3 strikes, then defer to the next app launch.

## Rollout note

Machines *currently* stuck behind the dialog have an intact old install: one
reboot (login item) or manual launch brings them online; the 60 s poll then
picks up the fixed installer and that update succeeds even against their
locked files. No hands-on reinstall needed.

## Testing done

- `npx tsc --noEmit`: no errors in `src/main` (pre-existing renderer errors
  unchanged); `vite build` clean.
- Full `electron-builder` NSIS compile of both hook macros: clean.
- Watchdog script: all three branches exercised with shortened timers —
  stand-down when app is present, relaunch loop when gone, installer re-run
  exactly once (`/S --force-run`) when the exe is missing; self-deletes.

## If it ever regresses

Grep the machine's `%LOCALAPPDATA%\remote-365-updater\` logs plus
`sc.exe qc Remote365InputSvc` — a `BINARY_PATH_NAME` inside the app install
dir means the legacy service lock is present; the app's
`ensureElevatedInputService` migrates it to `C:\ProgramData\Remote365` on the
next elevated repair.
