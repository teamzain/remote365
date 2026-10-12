// "Lean desktop" while this machine is being viewed: no wallpaper, no window
// animations, outline-only window dragging.
//
// A photographic wallpaper is the most expensive thing on a desktop to encode:
// every window move or minimise uncovers a slab of it, and a slideshow or an
// animated one repaints the whole screen with nobody touching the machine.
// Animations and full-content dragging turn one click into dozens of
// full-motion frames. On a thin link those are exactly the bursts that queue
// up and freeze the picture, and none of them carry information the remote
// user needs.
//
// Everything is changed for the LIVE session only (SystemParametersInfo with
// no SPIF_UPDATEINIFILE): nothing is written to the user's profile, so a
// sign-out, a reboot or a crash of this app can never leave the machine
// without its wallpaper. The previous values are still kept on disk, so the
// next start of the app puts them back if this process died mid-session.
import { app } from 'electron';
import { spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import log from 'electron-log';

interface LeanDesktopState {
  wallpaper: string;
  clientAreaAnimation: boolean;
  dragFullWindows: boolean;
  minAnimate: boolean;
}

const statePath = () => join(app.getPath('userData'), 'lean-desktop-restore.json');
const enabled = () => process.platform === 'win32'
  && process.env.REMOTE365_LEAN_DESKTOP !== '0'
  // The pre-logon instance runs as SYSTEM on the sign-in screen: no user
  // desktop, no wallpaper, and nobody's settings to borrow.
  && !process.argv.includes('--prelogon');

let applied = false;
let restoreTimer: NodeJS.Timeout | null = null;
// One PowerShell at a time, in order: a restore must never overtake its apply.
let queue: Promise<unknown> = Promise.resolve();

const P_INVOKE = `
Add-Type -Namespace R365 -Name Spi -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool SystemParametersInfo(uint action, uint param, System.Text.StringBuilder value, uint flags);
[DllImport("user32.dll", EntryPoint = "SystemParametersInfo", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool SetString(uint action, uint param, string value, uint flags);
[DllImport("user32.dll", EntryPoint = "SystemParametersInfo", SetLastError = true)]
public static extern bool GetBool(uint action, uint param, ref bool value, uint flags);
[DllImport("user32.dll", EntryPoint = "SystemParametersInfo", SetLastError = true)]
public static extern bool SetBool(uint action, uint param, System.IntPtr value, uint flags);
[StructLayout(LayoutKind.Sequential)] public struct ANIMATIONINFO { public uint cbSize; public int iMinAnimate; }
[DllImport("user32.dll", EntryPoint = "SystemParametersInfo", SetLastError = true)]
public static extern bool Anim(uint action, uint param, ref ANIMATIONINFO value, uint flags);
'@
$SEND = 2  # SPIF_SENDCHANGE only: the live session, never the profile
function Get-Anim { $a = New-Object R365.Spi+ANIMATIONINFO; $a.cbSize = 8; [void][R365.Spi]::Anim(0x48, 8, [ref]$a, 0); $a.iMinAnimate -ne 0 }
function Set-Anim($on) { $a = New-Object R365.Spi+ANIMATIONINFO; $a.cbSize = 8; $a.iMinAnimate = [int][bool]$on; [void][R365.Spi]::Anim(0x49, 8, [ref]$a, $SEND) }
function Set-Flag($action, $on) { [void][R365.Spi]::SetBool($action, 0, [System.IntPtr][int][bool]$on, $SEND) }
`;

const READ_AND_APPLY = `${P_INVOKE}
$wp = New-Object System.Text.StringBuilder 520
[void][R365.Spi]::SystemParametersInfo(0x73, 520, $wp, 0)           # SPI_GETDESKWALLPAPER
$caa = $false; [void][R365.Spi]::GetBool(0x1042, 0, [ref]$caa, 0)    # SPI_GETCLIENTAREAANIMATION
$drag = $false; [void][R365.Spi]::GetBool(0x26, 0, [ref]$drag, 0)    # SPI_GETDRAGFULLWINDOWS
$min = Get-Anim
[void][R365.Spi]::SetString(0x14, 0, '', $SEND)                      # SPI_SETDESKWALLPAPER: none
Set-Flag 0x1043 $false                                               # SPI_SETCLIENTAREAANIMATION
[void][R365.Spi]::SetBool(0x25, 0, [System.IntPtr]::Zero, $SEND)     # SPI_SETDRAGFULLWINDOWS off (uiParam)
Set-Anim $false
@{ wallpaper = $wp.ToString(); clientAreaAnimation = $caa; dragFullWindows = $drag; minAnimate = $min } | ConvertTo-Json -Compress
`;

const restoreScript = (state: LeanDesktopState) => `${P_INVOKE}
[void][R365.Spi]::SetString(0x14, 0, ${psString(state.wallpaper)}, $SEND)
Set-Flag 0x1043 $${state.clientAreaAnimation}
[void][R365.Spi]::SetBool(0x25, ${state.dragFullWindows ? 1 : 0}, [System.IntPtr]::Zero, $SEND)
Set-Anim $${state.minAnimate}
'ok'
`;

const psString = (value: string) => `'${String(value || '').replace(/'/g, "''")}'`;

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { try { child.kill(); } catch { /* gone */ } reject(new Error('timed out')); }, 15_000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim()); else reject(new Error(err.trim().slice(0, 300) || `exit ${code}`));
    });
    child.stdin.end(script);
  });
}

function readSavedState(): LeanDesktopState | null {
  try {
    if (!existsSync(statePath())) return null;
    const state = JSON.parse(readFileSync(statePath(), 'utf8'));
    return {
      wallpaper: String(state.wallpaper || ''),
      clientAreaAnimation: state.clientAreaAnimation !== false,
      dragFullWindows: state.dragFullWindows !== false,
      minAnimate: state.minAnimate !== false,
    };
  } catch {
    return null;
  }
}

/** A viewer connected: strip the desktop down. Safe to call for every viewer. */
export function applyLeanDesktop(reason: string) {
  if (!enabled()) return;
  if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
  if (applied) return;
  applied = true;
  queue = queue.then(async () => {
    // A leftover file means the desktop is ALREADY lean (this process, or one
    // that died, applied it): reading "the current values" now would save the
    // lean ones over the user's real settings.
    if (readSavedState()) return;
    const raw = await runPowerShell(READ_AND_APPLY);
    const state = JSON.parse(raw.slice(raw.lastIndexOf('{')));
    writeFileSync(statePath(), JSON.stringify(state));
    log.info(`[Host] Lean desktop on (${reason}): wallpaper and window animations hidden for the session.`);
  }).catch((err: any) => {
    applied = false;
    log.warn(`[Host] Lean desktop could not be applied: ${err?.message || err}`);
  });
}

function restoreNow(reason: string) {
  applied = false;
  queue = queue.then(async () => {
    const state = readSavedState();
    if (!state) return;
    await runPowerShell(restoreScript(state));
    try { unlinkSync(statePath()); } catch { /* already gone */ }
    log.info(`[Host] Lean desktop off (${reason}): wallpaper and animations restored.`);
  }).catch((err: any) => {
    // The file stays, so the next session end or app start tries again.
    log.warn(`[Host] Lean desktop could not be restored: ${err?.message || err}`);
  });
  return queue;
}

/** The last viewer left. Waits a moment first: a viewer that is only
 *  reconnecting must not make the wallpaper flash back for five seconds. */
export function restoreLeanDesktop(reason: string, stillInSession: () => boolean, delayMs = 8000) {
  if (!enabled()) return;
  if (restoreTimer) clearTimeout(restoreTimer);
  restoreTimer = setTimeout(() => {
    restoreTimer = null;
    if (stillInSession()) return;
    void restoreNow(reason);
  }, delayMs);
}

/** App start (after a crash mid-session) and app quit. */
export function recoverLeanDesktop(reason: string) {
  if (!enabled()) return Promise.resolve();
  if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
  if (!applied && !readSavedState()) return Promise.resolve();
  return restoreNow(reason);
}
