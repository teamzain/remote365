// Main-process client for the stream utilityProcess (capture/encode decoupling).
//
// Forks dist-electron/stream/hostStream.worker.js, relays start/stop, and delivers the
// worker's encoded H.264 output (evt:'nal') back to a callback so the existing NAL/RTP path
// can consume it. Gated behind CONNECT_X_STREAM_WORKER=1 — default builds never fork it.
// See docs/capture-service-decoupling.md.

import { utilityProcess } from 'electron';
import { join } from 'path';
import log from 'electron-log';

let child: Electron.UtilityProcess | null = null;
let nalCb: ((data: Uint8Array) => void) | null = null;
let eventCb: ((evt: string, msg: any) => void) | null = null;
let workerDisabled = false;   // set after a worker failure -> fall back to in-process capture

export function isStreamWorkerEnabled(): boolean {
  // Worker mode is now ON by default (capture/encode off the main thread so the host window
  // stays responsive). Set CONNECT_X_STREAM_WORKER=0 to force the legacy in-process path.
  // Auto-fallback (disableWorkerFallback) covers any worker failure at runtime.
  return process.env.CONNECT_X_STREAM_WORKER !== '0' && !workerDisabled;
}

/** Permanently fall back to the in-process capture path for this run (after a worker failure). */
export function disableWorkerFallback(): void {
  if (!workerDisabled) { workerDisabled = true; log.warn('[StreamWorker] disabled for this run — using in-process capture'); }
}

/** Encoded H.264 chunks from the worker's FFmpeg stdout. */
export function onWorkerNal(cb: (data: Uint8Array) => void): void { nalCb = cb; }
/** Lifecycle events from the worker (started/stopped/ffmpeg-exit/error). */
export function onWorkerEvent(cb: (evt: string, msg: any) => void): void { eventCb = cb; }

export function startStreamWorker(): void {
  if (!isStreamWorkerEnabled() || child) return;
  // index.js lives in dist-electron/main; the worker is in dist-electron/stream.
  const modulePath = join(__dirname, '../stream/hostStream.worker.js');
  try {
    child = utilityProcess.fork(modulePath, [], { stdio: 'pipe' });
    child.on('message', (msg: any) => {
      if (msg?.evt === 'nal') { if (nalCb && msg.data) nalCb(msg.data); return; }  // hot path: no logging
      // Hang-detector echo: answering proves main's event loop is alive. If
      // these answers stop, the worker records evidence (see hostStream.worker).
      if (msg?.evt === 'watchdog-ping') { child?.postMessage({ cmd: 'watchdog-pong' }); return; }
      if (msg?.evt === 'ready') child?.postMessage({ cmd: 'ping' });
      if (msg?.evt !== 'pong') log.info(`[StreamWorker] <- ${msg?.evt}${msg?.message ? ' ' + msg.message : ''}${msg?.line ? ' ' + msg.line : ''}`);
      if (eventCb && msg?.evt) eventCb(msg.evt, msg);
    });
    child.on('exit', (code: number) => { log.warn(`[StreamWorker] process exited code=${code}`); child = null; });
    child.stdout?.on('data', (d: Buffer) => log.info(`[StreamWorker out] ${d.toString().trim()}`));
    child.stderr?.on('data', (d: Buffer) => log.warn(`[StreamWorker err] ${d.toString().trim()}`));
    log.info(`[StreamWorker] forked from ${modulePath}`);
  } catch (e: any) {
    log.error(`[StreamWorker] fork failed: ${e?.message || e}`);
    child = null;
  }
}

/** Tell the worker to start capture+encode with the given ffmpeg plan.
 *  firstFrame primes the capture loop so a static screen still produces output
 *  (raw BGRA at width×height; structured-clone delivers it as a Uint8Array). */
export function startWorkerStream(opts: {
  ffmpegPath: string; ffmpegArgs: string[]; displayIndex: number; fps: number; width?: number; height?: number;
  /** Feed FFmpeg IVF-framed frames so keyframes can be requested on demand. */
  ivf?: boolean;
  firstFrame?: Buffer | Uint8Array;
}): void {
  if (!child) startStreamWorker();
  child?.postMessage({ cmd: 'start', opts });
}

/** Ask the worker to make the NEXT encoded frame a keyframe (IVF input mode
 *  only — a no-op for a pipeline started without `ivf: true`). */
export function requestWorkerKeyframe(): void {
  child?.postMessage({ cmd: 'keyframe' });
}

/** Tell the worker to stop capture+encode (keeps the process alive for reuse). */
export function stopWorkerStream(): void {
  child?.postMessage({ cmd: 'stop' });
}

/** Force (or release) secure-desktop capture in the worker — driven by the OS
 *  lock state (powerMonitor), since DXGI keeps returning the frozen wallpaper
 *  while locked and never signals blank on its own. */
export function setWorkerSecureForce(active: boolean): void {
  child?.postMessage({ cmd: 'secure-force', active });
}

export function stopStreamWorker(): void {
  if (child) { try { child.kill(); } catch { /* already gone */ } child = null; }
}
