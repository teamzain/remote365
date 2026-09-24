// Coordination between the updater and the two out-of-process layers that
// exist to relaunch this app when it dies: the per-user "Remote365 KeepAlive"
// Scheduled Task (fires every 5 minutes) and the update relaunch watchdog.
//
// The problem this file solves (fleet report, Aug 2026 — PUREVOIP-4 sat on
// 1.2.65 through SEVEN consecutive installs of 1.2.66): during an update the
// app is *deliberately* not running while NSIS swaps $INSTDIR. Both recovery
// layers only saw "app is dead" and relaunched it, and a relaunched app holds
// `Remote 365.exe`, `app.asar` and the .pak files open for the rest of the
// install. NSIS then skips every locked file (installer.nsh deliberately
// tolerates a busy $INSTDIR rather than aborting), exits 0, and the machine
// comes back running the OLD build — silently, forever.
//
// Their only guard was `tasklist | find "Remote 365 Setup"`, which is a race,
// not a lock: it is blind during the gap between electron-updater quitting the
// app and the installer process actually appearing, and it depends on the
// installer's file name. This replaces that with an explicit marker file the
// app owns.
//
// Design constraints that shaped this:
//   - The consumers are .cmd scripts, so the protocol has to be readable with
//     `if exist` alone. The file's CONTENT is diagnostic only; its EXISTENCE is
//     the signal.
//   - A lock that can outlive a dead installer would be far worse than the bug
//     it fixes: the keep-alive would refuse to relaunch and the machine would
//     stay offline forever. So the scripts break the lock after a bounded
//     number of consecutive sightings, and the app clears it on every boot.
import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import log from 'electron-log';

export function updateLockPath(): string {
  return join(app.getPath('userData'), 'update-in-progress');
}

// Written immediately before the app quits for an install. Kept human-readable
// so a support engineer reading userData can tell what the machine was doing.
export function armUpdateLock(target: string): void {
  try {
    writeFileSync(updateLockPath(), JSON.stringify({ target, at: Date.now(), pid: process.pid }), 'utf8');
    log.info(`[UpdateGuard] Update lock armed for ${target} — keep-alive and watchdog will not relaunch during the swap.`);
  } catch (err: any) {
    // Never block an update because the marker could not be written; the
    // scripts simply fall back to their old (racy) setup-process check.
    log.warn('[UpdateGuard] Could not arm update lock:', err?.message || err);
  }
}

// Called on every boot. Reaching this code means an app instance is alive, so
// whatever the lock was protecting is over — either the install finished or it
// died and something relaunched us. Either way the recovery layers must be
// free to do their job again.
export function clearUpdateLock(reason: string): void {
  try {
    if (!existsSync(updateLockPath())) return;
    let held = '';
    try {
      const raw = JSON.parse(readFileSync(updateLockPath(), 'utf8'));
      if (raw?.at) held = ` (held ${Math.round((Date.now() - Number(raw.at)) / 1000)}s)`;
    } catch { /* content is diagnostic only — a corrupt marker still gets cleared */ }
    unlinkSync(updateLockPath());
    log.info(`[UpdateGuard] Update lock cleared${held}: ${reason}.`);
  } catch (err: any) {
    log.warn('[UpdateGuard] Could not clear update lock:', err?.message || err);
  }
}
