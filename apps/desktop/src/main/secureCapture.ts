// Pulls raw BGRA frames of the CURRENT input desktop — including the Windows
// lock / UAC / PIN screen — from the elevated Remote365InputSvc SYSTEM agent
// over a named pipe. The host's own DXGI screen capture runs in the user
// session and goes blank the moment the machine locks (the secure desktop is
// off-limits to user-session processes), which is why a viewer sees a frozen
// wallpaper and never the PIN field. This fills that gap: while DXGI is blank
// the capture loop pulls frames from here instead and feeds them into the same
// FFmpeg pipeline, so the viewer can see and type the PIN remotely.
//
// Pull model: we ask the agent for a frame at the exact width x height the
// FFmpeg input expects; the agent BitBlts the secure desktop and StretchBlts it
// to that size, replying [u32 len][BGRA bytes] (len == width*height*4, or 0 if
// the grab failed this tick). Only active while DXGI is blank, so it costs
// nothing when the machine is unlocked. No-op if the service isn't installed
// (net.connect just keeps failing and we retry quietly).

import net from 'net';
import { SecureFrameReader } from './secureFrameReader';

const CAPTURE_PIPE = '\\\\.\\pipe\\remote365-capture';
const FRAME_INTERVAL_MS = 66;   // ~15fps — plenty for a mostly-static lock screen
const RECONNECT_MS = 500;

export class SecureDesktopCapture {
  private sock: net.Socket | null = null;
  private active = false;
  private inFlight = false;
  private width = 0;
  private height = 0;
  private reader: SecureFrameReader | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private framesRcvd = 0;
  private readonly log: (msg: string) => void;
  /** Most recent full BGRA frame (width*height*4 bytes), or null. */
  latest: Buffer | null = null;

  constructor(log?: (msg: string) => void) {
    this.log = log || (() => { /* no-op */ });
  }

  /** Begin pulling frames at width x height. Idempotent; a size change reconnects. */
  activate(width: number, height: number): void {
    if (this.active && this.width === width && this.height === height) return;
    this.log(`activate ${width}x${height} (pulling lock-screen frames from the agent)`);
    this.width = width;
    this.height = height;
    this.active = true;
    this.framesRcvd = 0;
    this.latest = null;
    this.reset();
    this.ensure();
  }

  /** Stop pulling and drop the fallback frame (machine unlocked / stream ended). */
  deactivate(): void {
    if (!this.active && !this.sock) return;
    this.log('deactivate (DXGI recovered / stream ended)');
    this.active = false;
    this.latest = null;
    this.reset();
  }

  private reset(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const socket = this.sock;
    this.sock = null;
    if (socket) { try { socket.destroy(); } catch { /* already gone */ } }
    this.reader = null;
    this.inFlight = false;
  }

  private ensure(): void {
    if (this.sock || !this.active) return;
    let s: net.Socket;
    try { s = net.connect(CAPTURE_PIPE); } catch (e: any) { this.log(`connect threw: ${e?.message || e}`); this.retry(); return; }
    this.sock = s;
    s.on('connect', () => { if (this.sock !== s) return; this.log('connected to agent capture pipe'); this.request(); });
    s.on('data', (d) => { if (this.sock === s) this.onData(d); });
    s.on('error', (e: any) => { if (this.sock !== s) return; this.log(`pipe error (agent not running?): ${e?.message || e}`); this.retry(); });
    s.on('close', () => { if (this.sock === s) this.retry(); });
  }

  private retry(): void {
    this.reset();
    if (this.active) this.timer = setTimeout(() => { this.timer = null; this.ensure(); }, RECONNECT_MS);
  }

  private request(): void {
    if (!this.sock || this.inFlight || !this.active) return;
    this.inFlight = true;
    this.reader = new SecureFrameReader(this.width * this.height * 4);
    const req = Buffer.alloc(8);
    req.writeUInt32LE(this.width >>> 0, 0);
    req.writeUInt32LE(this.height >>> 0, 4);
    try { this.sock.write(req); } catch { this.retry(); }
  }

  private onData(chunk: Buffer): void {
    if (!this.inFlight || !this.reader) return;
    try {
      const frame = this.reader.push(chunk);
      if (frame === undefined) return;
      if (frame) {
        // Identical lock-screen pixels keep their identity, so the encoder can
        // skip them. Comparing bytes is cheaper than copying/converting/encoding.
        if (!this.latest || !frame.equals(this.latest)) this.latest = frame;
        if (this.framesRcvd === 0) this.log(`first secure-desktop frame received (${frame.length} bytes)`);
        this.framesRcvd++;
      }
      this.finishFrame();
    } catch (error: any) {
      this.log(`invalid capture response: ${error?.message || error}`);
      this.retry();
    }
  }

  private finishFrame(): void {
    this.reader = null;
    this.inFlight = false;
    if (this.active) this.timer = setTimeout(() => { this.timer = null; this.request(); }, FRAME_INTERVAL_MS);
  }
}
