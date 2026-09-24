// Host-side input bridge (Milestone M1 of the elevated input service).
//
// Prefers the elevated `Remote365InputSvc` over a named pipe so injected input can
// reach Task Manager / UAC / the secure desktop. When that service isn't installed
// or running (the common case today) every call transparently falls back to the
// in-process `@remotelink/native-input` addon — i.e. exactly today's behavior, with
// zero regression. See docs/elevated-input-service.md for the full design.
//
// This module is a drop-in replacement for `@remotelink/native-input`: it exports the
// same injection functions, so callers only change their import.

import net from 'net';
import * as native from '@remotelink/native-input';

const PIPE_PATH = '\\\\.\\pipe\\remote365-input';
// Retry quickly so that when the elevated injector / service starts (or is started after
// the host), the host picks it up within a couple of seconds instead of a 30s dead window.
const RECONNECT_MS = 2_000;

let pipe: net.Socket | null = null;
let connected = false;
let connecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pendingMove: { t: 'move'; x: number; y: number } | null = null;
let moveWriteInFlight = false;

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, RECONNECT_MS);
}

function connect() {
  if (connected || connecting) return;
  connecting = true;
  let sock: net.Socket;
  try {
    sock = net.connect(PIPE_PATH);
  } catch {
    connecting = false;
    scheduleReconnect();
    return;
  }
  sock.on('connect', () => { connected = true; connecting = false; pipe = sock; });
  sock.on('error', () => {
    connecting = false;
    connected = false;
    pipe = null;
    pendingMove = null;
    moveWriteInFlight = false;
    scheduleReconnect();
  });
  sock.on('close', () => {
    connected = false;
    pipe = null;
    pendingMove = null;
    moveWriteInFlight = false;
    scheduleReconnect();
  });
  sock.on('data', () => { /* service acks/state — ignored for M1 */ });
}

// Attempt once at load. Harmless if the service isn't present (ENOENT -> fallback).
connect();

// If this much is sitting unflushed in the socket the service is wedged, not
// merely busy — hundreds of queued events. Drop the pipe and use the addon.
const PIPE_WEDGED_BYTES = 64 * 1024;

// Length-prefixed JSON frame. Returns false only when the frame was NOT handed
// to the pipe (not ready / wedged / write threw), so callers fall back to the
// native addon. A backpressured-but-queued write still returns true: the frame
// WILL reach the service, and falling back too would inject the event twice —
// once now via the addon and once again when the pipe drains.
function send(obj: Record<string, unknown>, onFlushed?: () => void): boolean {
  if (!connected || !pipe || pipe.destroyed) return false;
  if (pipe.writableLength > PIPE_WEDGED_BYTES) {
    pipe.destroy(); // 'close' handler clears state and schedules a reconnect
    return false;
  }
  try {
    const json = Buffer.from(JSON.stringify(obj), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(json.length, 0);
    pipe.write(Buffer.concat([len, json]), onFlushed);
    return true;
  } catch {
    return false;
  }
}

function flushPendingMove(): void {
  const move = pendingMove;
  pendingMove = null;
  if (!move) return;
  if (!send(move)) native.injectMouseMove(move.x, move.y);
}

function writeLatestMove(move: { t: 'move'; x: number; y: number }): boolean {
  moveWriteInFlight = true;
  const accepted = send(move, () => {
    moveWriteInFlight = false;
    const latest = pendingMove;
    pendingMove = null;
    if (latest && connected && pipe && !pipe.destroyed) writeLatestMove(latest);
  });
  if (!accepted) moveWriteInFlight = false;
  return accepted;
}

/** True when input is being routed through the elevated service. */
export function isElevatedConnected(): boolean {
  return connected;
}

export function injectMouseMove(x: number, y: number): void {
  // Mouse movement is latest-wins. If the service pipe is backpressured,
  // retaining every intermediate coordinate makes the remote cursor replay
  // stale movement after the user's hand has already stopped. Keep at most one
  // pending point and flush it when the pipe drains. Critical button/key events
  // flush this point first so clicks still land at the newest coordinate.
  if (connected && pipe && !pipe.destroyed && moveWriteInFlight) {
    pendingMove = { t: 'move', x, y };
    return;
  }
  if (writeLatestMove({ t: 'move', x, y })) return;
  native.injectMouseMove(x, y);
}

export function injectMouseAction(button: string, action: 'down' | 'up'): void {
  flushPendingMove();
  if (send({ t: 'btn', button, down: action === 'down' })) return;
  native.injectMouseAction(button as 'left' | 'right' | 'middle', action);
}

export function injectMouseScroll(deltaX: number, deltaY: number): void {
  flushPendingMove();
  if (send({ t: 'scroll', dx: deltaX, dy: deltaY })) return;
  native.injectMouseScroll(deltaX, deltaY);
}

export function injectKeyAction(keyCode: number, action: 'down' | 'up'): void {
  flushPendingMove();
  if (send({ t: 'key', vk: keyCode, down: action === 'down' })) return;
  native.injectKeyAction(keyCode, action);
}

export function injectText(text: string): void {
  if (send({ t: 'text', s: text })) return;
  native.injectText(text);
}

// Read-only toggle-state probe (CapsLock sync) — always in-process; the pipe
// is injection-only. Without this passthrough, index.ts's `input.isKeyToggled`
// was undefined and CapsLock state sync silently never ran.
export function isKeyToggled(vk: number): boolean {
  try { return Boolean((native as any).isKeyToggled?.(vk)); } catch { return false; }
}

// Read-only UIA probe — always in-process (the service is only for injection).
// Resolves false on any failure, including an older prebuilt binary without
// the export or the secure desktop where UIA can't reach the focused element.
export function focusIsEditable(): Promise<boolean> {
  try {
    return Promise.resolve((native as any).focusIsEditable()).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

// ---- Viewer-side system-key hook (WH_KEYBOARD_LL) — always in-process. ----
// Nothing to do with injection: it CAPTURES the local Win / Alt+Tab / Alt+F4 /
// Ctrl+Esc / PrintScreen chords while the viewer window is in the foreground
// so they can be sent to the remote machine instead of acting locally. Every
// call tolerates an older prebuilt binary without the exports.
export type HookKeyEvent = native.HookKeyEvent;

export function startKeyboardHook(callback: (event: HookKeyEvent) => void): boolean {
  try { return Boolean((native as any).startKeyboardHook?.(callback)); } catch { return false; }
}

export function stopKeyboardHook(): void {
  try { (native as any).stopKeyboardHook?.(); } catch { /* not installed */ }
}

export function setKeyboardHookEnabled(enabled: boolean): void {
  try { (native as any).setKeyboardHookEnabled?.(Boolean(enabled)); } catch { /* not installed */ }
}

export function setKeyboardHookTarget(hwnd: number): void {
  try { (native as any).setKeyboardHookTarget?.(hwnd); } catch { /* not installed */ }
}

/** Stop reconnect timers and release the named-pipe handle before app update/quit. */
export function shutdown(): void {
  stopKeyboardHook();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  pendingMove = null;
  moveWriteInFlight = false;
  connecting = false;
  connected = false;
  const activePipe = pipe;
  pipe = null;
  try { activePipe?.destroy(); } catch { /* already closed */ }
}
