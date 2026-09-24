// Unattended (pre-logon) hosting support.
//
// Why this exists: the desktop host authenticates to signaling with the signed-in
// user's access token, which Electron stores with safeStorage — DPAPI, scoped to
// one Windows profile. So the host can only be online while that user is signed
// in. After a reboot the machine sits at the Windows sign-in screen with nobody
// logged on, nothing starts the app, and the device reads Offline until a human
// walks over and signs in. That was the #1 "why is my PC offline" report.
//
// The fix has two halves:
//   1. This module: a MACHINE-scoped credential (device access key + a host
//      secret issued by POST /api/devices/host-credential) stored under
//      %ProgramData%, outside every user profile, so a process running as
//      SYSTEM can read it. Written whenever a signed-in user hosts, so the
//      machine always carries a current credential.
//   2. Remote365InputSvc (already LocalSystem + auto-start): when the console
//      session has no logged-on user it launches this app with --prelogon,
//      which registers using the credential below and streams the sign-in
//      screen through the service's existing secure-desktop capture.
//
// The secret is a bearer credential for THIS device's host registration, so the
// file is locked down to SYSTEM + Administrators (see hardenAcl). Anyone with
// those rights already owns the machine.

import { execFile } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import log from 'electron-log';

export type UnattendedCredential = {
  accessKey: string;
  hostSecret: string;
  serverHost: string;
  /** Full path of the installed app, so the service knows what to launch. */
  exePath: string;
  deviceName?: string;
  updatedAt?: string;
};

// Deliberately NOT app.getPath('userData') — that is per-Windows-profile and
// invisible to the SYSTEM-launched instance. ProgramData is machine-wide and
// survives user profile resets and per-user reinstalls.
const CREDENTIAL_DIR = join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Remote365');
const CREDENTIAL_PATH = join(CREDENTIAL_DIR, 'unattended-host.json');

export const getUnattendedCredentialPath = () => CREDENTIAL_PATH;

/**
 * Restrict the credential to SYSTEM + Administrators. ProgramData's default ACL
 * lets any local user read a file created there, which would expose the host
 * secret to every account on the machine. icacls is fire-and-forget: it needs no
 * elevation to change the DACL of a file we just created (we're the owner), and
 * a failure only means the file keeps ProgramData's inherited (weaker) ACL.
 */
function hardenAcl(path: string) {
  if (process.platform !== 'win32') return;
  execFile(
    'icacls.exe',
    [path, '/inheritance:r', '/grant:r', '*S-1-5-18:F', '*S-1-5-32-544:F'],
    { windowsHide: true },
    (err) => {
      if (err) log.warn(`[Unattended] Could not harden credential ACL: ${err.message}`);
    }
  );
}

// Supervision intent, read by Remote365InputSvc.
//
// The per-user Scheduled Task is not always available: on locked-down fleets
// endpoint security blocks the app from spawning schtasks.exe entirely
// (`[KeepAlive] Failed to arm task: spawn EPERM`, observed on PureVoip PV1),
// so those machines — the ones most in need of recovery — silently have none.
// The service can do the same job, and a signed service starting a process is
// ordinary behaviour no heuristic objects to. This flag is how the app tells it
// whether being closed was intentional: "1" keep me alive, "0" I was quit.
//
// Deliberately just a flag, never a path: the service derives the exe from the
// logged-on user's own profile instead of trusting this file, because anything
// writable by a normal user must not be able to choose what SYSTEM launches.
const SUPERVISE_FLAG_PATH = join(CREDENTIAL_DIR, 'app-supervise.flag');

export function setAppSupervision(enabled: boolean): void {
  if (process.platform !== 'win32') return;
  try {
    mkdirSync(CREDENTIAL_DIR, { recursive: true });
    writeFileSync(SUPERVISE_FLAG_PATH, enabled ? '1' : '0', 'utf8');
  } catch (err: any) {
    log.warn(`[Unattended] Could not record supervision intent: ${err?.message || err}`);
  }
}

export function readUnattendedCredential(): UnattendedCredential | null {
  try {
    if (!existsSync(CREDENTIAL_PATH)) return null;
    const parsed = JSON.parse(readFileSync(CREDENTIAL_PATH, 'utf8'));
    if (!parsed?.accessKey || !parsed?.hostSecret) return null;
    return parsed as UnattendedCredential;
  } catch (err: any) {
    log.warn(`[Unattended] Failed to read credential: ${err?.message || err}`);
    return null;
  }
}

function writeUnattendedCredential(credential: UnattendedCredential): boolean {
  try {
    mkdirSync(CREDENTIAL_DIR, { recursive: true });
    writeFileSync(
      CREDENTIAL_PATH,
      JSON.stringify({ ...credential, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
    hardenAcl(CREDENTIAL_PATH);
    return true;
  } catch (err: any) {
    // A locked-down machine may deny ProgramData writes. Unattended hosting is
    // then unavailable, but normal (signed-in) hosting must not be affected.
    log.warn(`[Unattended] Failed to store credential: ${err?.message || err}`);
    return false;
  }
}

/**
 * Make sure this machine holds a usable unattended credential for `accessKey`.
 *
 * Called on every authenticated host start. Cheap and idempotent: it re-issues
 * only when something material changed (no credential yet, the device identity
 * changed, or the app moved/upgraded to a new path), so a normal start does no
 * network I/O at all. Never throws — unattended hosting is an enhancement and
 * must never be able to break a normal host start.
 */
export async function ensureUnattendedCredential(opts: {
  accessKey: string;
  token: string;
  serverOrigin: string;
  serverHost: string;
  exePath: string;
  fingerprint: string;
  deviceName?: string;
}): Promise<UnattendedCredential | null> {
  if (process.platform !== 'win32') return null;
  const accessKey = String(opts.accessKey || '').replace(/\s/g, '');
  if (!accessKey || !opts.token) return null;

  const existing = readUnattendedCredential();
  const stillValid =
    existing?.accessKey === accessKey &&
    existing?.exePath === opts.exePath &&
    existing?.serverHost === opts.serverHost;
  if (stillValid) return existing;

  try {
    const res = await fetch(`${opts.serverOrigin}/api/devices/host-credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
      body: JSON.stringify({ accessKey, fingerprint: opts.fingerprint }),
    });
    if (!res.ok) {
      log.warn(`[Unattended] Host credential request failed (HTTP ${res.status}) — pre-logon hosting stays off.`);
      return null;
    }
    const body: any = await res.json();
    const hostSecret = String(body?.host_secret || '');
    if (!hostSecret) return null;

    const credential: UnattendedCredential = {
      accessKey,
      hostSecret,
      serverHost: opts.serverHost,
      exePath: opts.exePath,
      deviceName: opts.deviceName,
    };
    if (!writeUnattendedCredential(credential)) return null;
    log.info(`[Unattended] Machine credential stored for device ${accessKey} — this PC can now come online before anyone signs in.`);
    return credential;
  } catch (err: any) {
    log.warn(`[Unattended] Could not provision host credential: ${err?.message || err}`);
    return null;
  }
}
