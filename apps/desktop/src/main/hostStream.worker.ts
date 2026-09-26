// hostStream.worker.ts — Electron utilityProcess that offloads the CPU-heavy media path
// (native-capture DXGI grab + FFmpeg encode) off the main thread, so the main process's
// window stays responsive during a session. See docs/capture-service-decoupling.md.
//
// P2.1: the worker owns capture + FFmpeg. Main builds the ffmpeg args (unchanged encoder
// detection stays in main) and sends them here via 'start'; the worker runs the capture loop
// and streams FFmpeg's (small, encoded) stdout back to main via 'nal'. Main feeds those into
// its existing NAL/RTP path. WebRTC + signaling + input remain in main for now.
//
// Runs in a Node context (no DOM). Communicates over process.parentPort.

import { spawn, ChildProcess } from 'child_process';
import { monitorEventLoopDelay, performance } from 'perf_hooks';
import { appendFileSync } from 'fs';
import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import { SecureDesktopCapture } from './secureCapture';
import { RawFramePool, staticFrameInterval, shouldWriteFrame } from './rawFramePolicy';

const parentPort: any = (process as any).parentPort;
const workerEventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
workerEventLoopDelay.enable();

function send(msg: any, transfer?: any[]): void {
  try { transfer ? parentPort?.postMessage(msg, transfer) : parentPort?.postMessage(msg); } catch { /* parent gone */ }
}

// Native capture addon (same resolution strategy as main; external at build time).
let capture: any = null;
function loadCapture(): boolean {
  if (capture?.captureFrame) return true;
  try { capture = require('@remotelink/native-capture'); } catch { capture = null; }
  return !!capture?.captureFrame;
}

let ffmpeg: ChildProcess | null = null;
let captureTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
// Last real frame, kept across pipeline restarts (quality changes restart ffmpeg
// in this same process). DXGI only yields a frame when the screen CHANGES, so a
// fresh pipeline on a static desktop would otherwise feed ffmpeg nothing — no
// SPS/PPS/IDR is emitted and the viewer sits on a black screen until the host
// desktop repaints. Keyed on display+size so a monitor switch invalidates it.
let seedFrame: Buffer | null = null;
let seedKey = '';
// Secure-desktop fallback: when the machine locks, pull the lock/PIN screen from
// the elevated SYSTEM agent so the viewer can log in. Logs go to stdout, which
// main relays into the app log as "[StreamWorker out]".
const secureCapture = new SecureDesktopCapture((m) => console.log(`[SecureCapture] ${m}`));
// Set by main from powerMonitor lock/unlock. When locked, DXGI keeps returning
// the frozen Default-desktop wallpaper (it never goes blank), so we must PREFER
// the agent's secure-desktop frame regardless of what DXGI hands back.
let forceSecure = false;

// ---- Keyframes on demand ----
// FFmpeg's CLI has no "force a keyframe now" control, but its keyframe
// EXPRESSION can see each frame's timestamp — and we write the timestamps. So
// when main asks for a keyframe, frames are fed inside a minimal IVF container
// (32-byte file header, then 12 bytes per frame: size u32le + pts u64le) and
// the request is signalled by SKIPPING ONE TIMESTAMP TICK. Main launches FFmpeg
// with `-force_key_frames expr:gt(round(t*FPS)-n,n_forced)`: "ticks seen so far
// minus frames seen so far" is the number of skips, and a keyframe is forced
// whenever that exceeds the keyframes already forced. Measured Sep 2026 on the
// bundled FFmpeg 6.1.1 (NVENC and libx264): with no request the output is
// BYTE-IDENTICAL to the old rawvideo input, a requested keyframe lands on
// exactly the requested frame ~10 ms later, and startup is no slower.
let pendingKeyframe = false;
function ivfFileHeader(width: number, height: number, fps: number): Buffer {
  const h = Buffer.alloc(32);
  h.write('DKIF', 0, 'ascii');
  h.writeUInt16LE(0, 4);            // version
  h.writeUInt16LE(32, 6);           // header length
  h.write('BGRA', 8, 'ascii');      // fourcc -> rawvideo decoder picks bgra from it
  h.writeUInt16LE(width, 12);
  h.writeUInt16LE(height, 14);
  h.writeUInt32LE(fps, 16);         // timebase denominator: one tick per frame
  h.writeUInt32LE(1, 20);           // timebase numerator
  return h;
}

function stopPipeline(): void {
  running = false;
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
  try { capture?.setHighResTimers?.(false); } catch { /* older binary */ }
  // Free the DXGI duplication + D3D11 device while this process is healthy,
  // never at process exit (see releaseMainCapture in main/index.ts).
  try { capture?.release?.(); } catch { /* older binary */ }
  secureCapture.deactivate();
  if (ffmpeg) {
    try { ffmpeg.stdin?.end(); } catch { /* noop */ }
    try { ffmpeg.kill(); } catch { /* noop */ }
    ffmpeg = null;
  }
}

// opts: { ffmpegPath, ffmpegArgs: string[], displayIndex: number, fps: number }
function startPipeline(opts: any): void {
  stopPipeline();
  if (!loadCapture()) { send({ evt: 'error', where: 'capture', message: 'native-capture unavailable in worker' }); return; }

  const { ffmpegPath, ffmpegArgs, displayIndex = 0, fps = 30, width = 0, height = 0, firstFrame = null } = opts || {};
  // IVF framing (keyframes on demand) needs the exact frame size up front.
  const useIvf = Boolean(opts?.ivf) && width > 0 && height > 0 && width <= 0xffff && height <= 0xffff;
  pendingKeyframe = false;
  let ivfFrameIndex = 0;   // frames written so far
  let ivfTickSkips = 0;    // keyframe requests signalled so far
  const pipeKey = `${displayIndex}:${width}x${height}`;
  // 1ms Windows timer resolution while streaming — without it, setTimeout ticks
  // quantize to ~15.6ms and the capture loop samples the screen at alternating
  // ~31/47ms intervals (visible judder). Released again in stopPipeline.
  try { capture?.setHighResTimers?.(true); } catch { /* older binary */ }
  console.log(`[SecureCapture] pipeline start: fallback size ${width}x${height} — ${width > 0 && height > 0 ? 'lock-screen fallback ARMED' : 'DISABLED (no size passed)'}`);
  try {
    ffmpeg = spawn(ffmpegPath, ffmpegArgs);
  } catch (e: any) {
    send({ evt: 'error', where: 'spawn', message: String(e?.message || e) });
    return;
  }
  running = true;
  // Every handler below is bound to THIS process. A pipeline restart kills the
  // old FFmpeg and spawns the new one back to back, and the old one can take
  // longer to die than the new one takes to start (QSV: ~13 ms in the field
  // log of Sep 18 2026). Its late 'exit' then saw running === true — the NEW
  // pipeline's flag — so it (a) switched the new capture loop off and (b) told
  // main the new encoder had crashed, which main answered with "h264_qsv failed
  // with real stream settings; falling back to libx264". QSV never failed. Same
  // guard on stdout: a dying encoder's last bytes must not be spliced into the
  // new stream.
  const proc = ffmpeg;

  proc.on('error', (e: any) => { if (ffmpeg === proc) send({ evt: 'error', where: 'ffmpeg', message: String(e?.message || e) }); });
  proc.on('exit', (code: number | null, signal: string | null) => {
    if (ffmpeg !== proc) return;   // a previous pipeline's process finishing late
    const wasRunning = running;   // running still true == crashed, not a clean stop/restart
    running = false;
    send({ evt: 'ffmpeg-exit', code, signal, unexpected: wasRunning });
  });
  // Swallow stdin/stdout pipe errors (EOF/EPIPE) that fire when ffmpeg exits mid-write —
  // otherwise they surface as an unhandled 'error' event and crash the worker.
  ffmpeg.stdin?.on('error', () => { /* ignore broken-pipe on shutdown/quality-restart */ });
  if (useIvf) {
    try { ffmpeg.stdin?.write(ivfFileHeader(width, height, Math.max(1, Math.round(fps)))); } catch { /* exit handler reports it */ }
    console.log('[StreamWorker] IVF input framing ON — keyframes on demand.');
  }
  ffmpeg.stdout?.on('error', () => { /* ignore */ });
  // Encoded H.264 out -> relay to main (copy into a fresh buffer; chunks are small).
  ffmpeg.stdout?.on('data', (chunk: Buffer) => {
    if (ffmpeg !== proc) return;   // stale output from a pipeline that was replaced
    const u8 = new Uint8Array(chunk.length);
    u8.set(chunk);
    send({ evt: 'nal', data: u8 }, [u8.buffer]);
  });
  ffmpeg.stderr?.on('data', (d: Buffer) => {
    const s = d.toString().trim();
    if (s && !s.includes('kB time=') && !s.includes('fps=')) send({ evt: 'ffmpeg-log', line: s });
  });

  // Capture loop (mirrors main's captureTick): DXGI grab -> ffmpeg.stdin, paced to fps.
  const frameInterval = 1000 / Math.max(15, fps);
  let nextFrameAt = performance.now();
  // Prime the loop so ffmpeg gets fed from tick one even on a static screen:
  // prefer the probe frame main captured, else the last frame of the previous
  // pipeline run (same display+size only).
  let lastFrame: Buffer | null = null;
  const expectedBytes = width * height * 4;
  if (firstFrame && expectedBytes > 0 && (firstFrame.byteLength ?? firstFrame.length) === expectedBytes) {
    lastFrame = Buffer.from(firstFrame.buffer, firstFrame.byteOffset, firstFrame.byteLength);
    console.log('[StreamWorker] primed with first frame from main');
  } else if (seedFrame && seedKey === pipeKey) {
    lastFrame = seedFrame;
    console.log('[StreamWorker] primed with previous pipeline frame');
  }
  let waitingForDrain = false;
  // Count consecutive DXGI THROWS (can't initialize duplication = secure desktop,
  // e.g. a UAC prompt). A plain null is just a static screen (DXGI WAIT_TIMEOUT)
  // and must NOT count — otherwise the source flip-flops between DXGI and the
  // agent on any still screen and the picture appears to zoom in and out.
  let dxgiThrowStreak = 0;
  const DXGI_THROW_SECURE_THRESHOLD = 5;
  // One geometry-mismatch report per pipeline run — main restarts us with fresh
  // bounds, and the restart gives a new worker state.
  let geometryMismatchReported = false;
  // Keep static desktops warm at 2fps; periodic-IDR fallback retains 10fps.
  const STATIC_KEEPALIVE_MS = staticFrameInterval(useIvf, process.env.REMOTE365_STATIC_KEEPALIVE_MS);
  let lastWriteAt = 0;
  let writesSinceStart = 0;
  let metricStartedAt = performance.now();
  let metricCaptureMs = 0;
  let metricCaptureSamples = 0;
  let metricLateTicks = 0;
  let metricBackpressure = 0;
  let metricWrites = 0;
  // Prime buffers are already ours after IPC; reuse them and grow only as needed.
  const captureBufferPool = new RawFramePool(expectedBytes, lastFrame);
  const stdinBuffersInFlight = new Set<Buffer>();

  const schedule = () => {
    captureTimer = setTimeout(tick, Math.max(0, nextFrameAt - performance.now()));
  };
  const tick = () => {
    captureTimer = null;
    if (!running || ffmpeg !== proc || !proc.stdin?.writable || proc.stdin.writableEnded) return;
    nextFrameAt += frameInterval;
    const now = performance.now();
    if (nextFrameAt < now - frameInterval) {
      metricLateTicks++;
      nextFrameAt = now + frameInterval;
    }
    let gotDxgi = false;
    let dxgiThrew = false;
    // True when THIS tick produced genuinely new pixels (DXGI damage or a fresh
    // secure-desktop grab). Drives the static-screen throttle below.
    let frameIsNew = false;
    const captureStartedAt = performance.now();
    try {
      const captureTarget = forceSecure ? undefined : captureBufferPool.acquire(lastFrame, stdinBuffersInFlight);
      // Skip desktop duplication entirely when the OS says the desktop is locked.
      // Backpressure also skips capture rather than overwriting in-flight bytes.
      const result = forceSecure || (expectedBytes > 0 && !captureTarget)
        ? null : capture.captureFrame(displayIndex, captureTarget);
      if (result?.data) {
        // Geometry guard. FFmpeg was launched with a fixed
        // `-video_size WxH -pixel_format bgra` for THIS pipeline; a frame of any
        // other size means the desktop geometry changed under us (resolution or
        // DPI switch, display swap, RDP/console reconnect). Feeding it anyway
        // makes FFmpeg read the raw stream at the wrong stride: the picture
        // keeps the rows it got and the shortfall encodes as uninitialized
        // YUV — the solid GREEN BAND across the bottom of the viewer.
        // Report once and let main restart the pipeline with the new bounds.
        const bytes = result.data.byteLength ?? result.data.length;
        if (expectedBytes > 0 && bytes !== expectedBytes) {
          if (!geometryMismatchReported) {
            geometryMismatchReported = true;
            send({
              evt: 'geometry-mismatch',
              expectedBytes,
              actualBytes: bytes,
              declared: `${width}x${height}`,
              actual: result.width && result.height ? `${result.width}x${result.height}` : 'unknown',
            });
          }
          // Do NOT write a mismatched frame; hold the last good one until the
          // restart lands (a stale frame beats a corrupt one).
          gotDxgi = true;
        } else {
          lastFrame = result.data;
          gotDxgi = true;
          frameIsNew = true;   // real damage — encode it now
          seedFrame = result.data;
          seedKey = pipeKey;
        }
      }
    } catch { dxgiThrew = true; /* DXGI can't init = secure desktop */ }
    metricCaptureMs += performance.now() - captureStartedAt;
    metricCaptureSamples++;
    // Only two things switch us to the agent's secure-desktop capture:
    //  1. forceSecure — the OS reported the session is LOCKED (powerMonitor). This
    //     is the authoritative signal; DXGI still hands back the frozen wallpaper.
    //  2. DXGI *throwing* for a sustained run = a secure desktop with no lock event
    //     (a UAC prompt). A plain null is a static screen — it must NOT trigger a
    //     switch, or the view flip-flops DXGI<->agent and appears to zoom.
    if (dxgiThrew) dxgiThrowStreak++; else if (gotDxgi) dxgiThrowStreak = 0;
    const useSecure = width > 0 && height > 0 && (forceSecure || dxgiThrowStreak >= DXGI_THROW_SECURE_THRESHOLD);
    if (useSecure) {
      secureCapture.activate(width, height);
      // The pipe reader preserves identity for unchanged pixels. Encode a new
      // response once, instead of upsampling its 15fps capture to 30/60fps.
      if (secureCapture.latest) { frameIsNew = lastFrame !== secureCapture.latest; lastFrame = secureCapture.latest; }
    } else {
      secureCapture.deactivate();   // idempotent; no-op unless it was active
    }
    // Static-screen throttle. This used to write EVERY tick even when DXGI
    // reported no damage, so an idle desktop still cost a full-frame
    // BGRA->YUV420p convert + H.264 encode at 30-60fps forever. On a host with
    // no hardware encoder that pins a CPU core continuously and starves the
    // event loop that injects input — the machine feels laggy while literally
    // nothing is happening on screen. (RustDesk/HopToDesk-class tools send
    // nothing on a static screen, which is why they stay smooth on the same PC.)
    // A new frame goes out immediately; duplicates only keep the pipeline warm
    // at STATIC_KEEPALIVE_MS.
    const nowMs = Date.now();
    // A requested keyframe must not wait out the static-screen keepalive.
    const shouldWrite = shouldWriteFrame(writesSinceStart, frameIsNew, pendingKeyframe, nowMs - lastWriteAt, STATIC_KEEPALIVE_MS);
    if (lastFrame && !waitingForDrain && shouldWrite) {
      lastWriteAt = nowMs;
      try {
        const frameBeingWritten = lastFrame;
        if (useIvf) {
          // Frame header: payload size + timestamp. One tick per frame; a
          // pending keyframe request skips a tick (see "Keyframes on demand").
          if (pendingKeyframe) { pendingKeyframe = false; ivfTickSkips++; }
          const frameHeader = Buffer.allocUnsafe(12);
          frameHeader.writeUInt32LE(frameBeingWritten.length, 0);
          frameHeader.writeBigUInt64LE(BigInt(ivfFrameIndex + ivfTickSkips), 4);
          ivfFrameIndex++;
          ffmpeg.stdin.write(frameHeader);
        }
        stdinBuffersInFlight.add(frameBeingWritten);
        const ok = ffmpeg.stdin.write(frameBeingWritten, () => {
          stdinBuffersInFlight.delete(frameBeingWritten);
        });
        writesSinceStart++;
        metricWrites++;
        if (!ok) {
          metricBackpressure++;
          waitingForDrain = true;
          proc.stdin.once('drain', () => { waitingForDrain = false; if (running && ffmpeg === proc && !captureTimer) schedule(); });
        }
      } catch { return; }
    }
    const metricNow = performance.now();
    if (metricNow - metricStartedAt >= 5000) {
      send({
        evt: 'metrics',
        windowMs: Math.round(metricNow - metricStartedAt),
        avgCaptureMs: metricCaptureSamples ? metricCaptureMs / metricCaptureSamples : 0,
        captureSamples: metricCaptureSamples,
        writes: metricWrites,
        lateTicks: metricLateTicks,
        backpressureWaits: metricBackpressure,
        targetFps: fps,
        eventLoopP95Ms: workerEventLoopDelay.percentile(95) / 1e6,
        eventLoopMaxMs: workerEventLoopDelay.max / 1e6,
      });
      workerEventLoopDelay.reset();
      metricStartedAt = metricNow;
      metricCaptureMs = 0;
      metricCaptureSamples = 0;
      metricLateTicks = 0;
      metricBackpressure = 0;
      metricWrites = 0;
    }
    if (!waitingForDrain) schedule();
  };
  schedule();

  send({ evt: 'started', pid: process.pid });
}

parentPort?.on('message', (e: any) => {
  const msg = e?.data ?? e;
  if (!msg || typeof msg !== 'object') return;
  switch (msg.cmd) {
    case 'ping':  send({ evt: 'pong', t: Date.now() }); break;
    case 'start': startPipeline(msg.opts); break;
    case 'stop':  stopPipeline(); send({ evt: 'stopped' }); break;
    case 'watchdog-pong': lastMainPongAt = Date.now(); break;
    case 'keyframe':
      // Picked up by the next frame write (at most one frame interval away).
      pendingKeyframe = true;
      break;
    case 'secure-force':
      forceSecure = Boolean(msg.active);
      console.log(`[SecureCapture] forceSecure=${forceSecure} (from powerMonitor lock state)`);
      break;
    default: break;
  }
});

// Main-process hang detector. This worker outlives individual sessions (main
// keeps it for reuse), so if main's event loop freezes — heartbeats stop, the
// signaling watchdog dies, the host silently drops offline with its socket
// half-open — this is the only place left that can leave evidence. Main answers
// every ping (see hostStreamClient); when answers stop while this process is
// still alive, write a marker file that main reports into its log on the next
// launch (reportPriorMainHangs).
let lastMainPongAt = Date.now();
let lastHangReportAt = 0;
setInterval(() => {
  send({ evt: 'watchdog-ping' });
  const silentMs = Date.now() - lastMainPongAt;
  if (silentMs > 120_000 && Date.now() - lastHangReportAt > 300_000) {
    lastHangReportAt = Date.now();
    try {
      appendFileSync(
        joinPath(tmpdir(), 'remote365-main-hang.log'),
        `${new Date().toISOString()} main process unresponsive for ${Math.round(silentMs / 1000)}s (stream worker still alive, pid=${process.pid})\n`
      );
    } catch { /* evidence is best-effort */ }
  }
}, 30_000);

send({ evt: 'ready', pid: process.pid });
