/**
 * Viewer-side file transfer (protocol v2).
 *
 * The old viewer could move exactly one file per user action, and it received
 * by collecting every chunk into an array and concatenating at the end — so a
 * large file was a large allocation, and a slow one was a stalled UI with no
 * way out. This replaces that with jobs:
 *
 *   a job = an ordered list of files with relative paths + a destination
 *
 * A folder is just a job with more entries, which is what makes recursive
 * transfers fall out for free in both directions. Bytes are streamed to disk
 * via main (files:open-write / write-chunk / close-write), never buffered
 * whole, and every job is cancellable.
 *
 * Sending uses the data channel's own bufferedAmount for flow control. The
 * previous implementation slept between chunks, which both throttles the link
 * and does nothing to stop the send buffer filling.
 *
 * Reconnects (Sep 2026): a job whose channels vanish is PAUSED, not lost.
 * When the session comes back the job continues — a pull from the byte the
 * last file stopped at, a push from the file that was interrupted. Each
 * resumed segment gets a fresh wire id (the host sees a new job; the old
 * one is dead on its side), mapped back to the same job in the tray.
 */

export type TransferDirection = 'send' | 'receive';
export type JobState = 'preparing' | 'active' | 'paused' | 'done' | 'error' | 'cancelled';

export type TransferJob = {
  id: string;
  direction: TransferDirection;
  label: string;
  destDir: string;
  fileCount: number;
  filesDone: number;
  totalBytes: number;
  transferredBytes: number;
  currentName: string;
  state: JobState;
  message: string;
  bytesPerSecond: number;
  etaSeconds: number;
  startedAt: number;
  /** Mirrored from a protocol-v1 transfer (host dock "Send File"); no cancel, no byte counts. */
  legacy?: boolean;
  /** The HOST started this transfer (its dock's Send Files). */
  hostInitiated?: boolean;
  /** Files left out of the job, each with a one-line reason (over the plan limit, unreadable…). */
  skipped?: Array<{ name: string; reason: string }>;
  /** Files saved under a "(2)"-style name because the original already existed. */
  renamedCount?: number;
  /** How many times the job continued after a lost connection. */
  resumes?: number;
};

export type SkippedFile = { name: string; reason: string };

type WalkedFile = { relPath: string; absPath: string; size: number };

type ElectronFiles = {
  walk: (paths: string[]) => Promise<{
    files: WalkedFile[];
    totalBytes: number;
    truncated: boolean;
    skipped?: Array<{ relPath: string; reason: string }>;
  }>;
  readChunk: (path: string, offset: number, length: number) => Promise<Uint8Array | { data: number[] }>;
  openWrite: (destDir: string, relPath: string, options?: { append?: boolean }) => Promise<{ handle: number; path: string; renamed?: boolean }>;
  writeChunk: (handle: number, data: Uint8Array) => Promise<number>;
  closeWrite: (handle: number) => Promise<{ path: string }>;
  abortWrite: (handle: number) => Promise<boolean>;
  defaultReceiveDir: () => Promise<string>;
};

// Matches the host: 64KB messages, ~1MB in flight.
const CHUNK_SIZE = 64 * 1024;
const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;
// Read a megabyte per IPC round trip and slice it locally — one IPC call per
// 64KB chunk would be ~800 calls a second on a fast link.
const READ_BLOCK = 1024 * 1024;
// A paused job that has not seen a link again after this long is failed, so
// the tray never shows "waiting" forever.
const PAUSE_GIVE_UP_MS = 5 * 60 * 1000;

const filesApi = (): ElectronFiles | null => (window as any).electronAPI?.files || null;

/**
 * Send diagnostics to the MAIN log, not just the renderer console. This engine
 * runs in the renderer with no devtools open on a live session, so a stalled
 * transfer used to leave no trace anywhere the support agent could read — the
 * exact blind spot that made the last stall impossible to diagnose. Every
 * milestone and every stall now lands in the shared main.log.
 */
function report(message: string): void {
  try { (window as any).electronAPI?.log?.(`[FileTransfer] ${message}`); } catch { /* no bridge */ }
  console.log(`[FileTransfer] ${message}`);
}

const toBytes = (value: any): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (value?.data) return new Uint8Array(value.data);
  return new Uint8Array(value || []);
};

const newWireId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

import { describeLimit, maxFileBytesForPlan } from './transferLimits';
import { getSessionFileChannel } from './sessionControlBus';

/**
 * The active per-file cap. The panel sets this from the license store when it
 * opens; a session that never learns a plan enforces TRIAL's cap (tightest).
 */
let perFileLimit: number | null = maxFileBytesForPlan(undefined);

export function setTransferPlan(plan: string | undefined | null): void {
  perFileLimit = maxFileBytesForPlan(plan);
}

/** [4-byte LE header length][JSON header][payload] — the shape main expects. */
function frame(header: object, payload: Uint8Array): Uint8Array {
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(4 + headerBytes.length + payload.byteLength);
  new DataView(out.buffer).setUint32(0, headerBytes.length, true);
  out.set(headerBytes, 4);
  out.set(payload, 4 + headerBytes.length);
  return out;
}

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
};

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const isRunning = (state: JobState) => state === 'active' || state === 'preparing';

export class FileTransferEngine {
  private jobs = new Map<string, TransferJob>();
  private receiveHandles = new Map<string, number>();
  private writeChains = new Map<string, Promise<unknown>>();
  // Size verification for receives: what the host said each file is, and
  // what actually reached disk. A short file is a failure, not a "Done".
  private expectedFileBytes = new Map<string, number>();
  private fileBytesWritten = new Map<string, number>();
  private renamedCount = new Map<string, number>();
  private cancelled = new Set<string>();
  private rateWindow = new Map<string, { at: number; bytes: number }>();
  private disposed = false;
  // Per-job wire counters + last-activity clock, for the stall watchdog and
  // the diagnostic log. A stall is "job active, but no chunk/progress landed
  // for STALL_MS" — which is exactly the state that used to freeze silently.
  private chunksIn = new Map<string, number>();
  private bytesWritten = new Map<string, number>();
  private lastActivityAt = new Map<string, number>();
  private stalledJobs = new Set<string>();
  private watchdog: ReturnType<typeof setInterval> | null = null;
  // ACK flow control. Pulls: we ack what is actually ON DISK every ACK_EVERY
  // bytes so the host can stop running ahead of a slow disk. Pushes: the
  // host's ft:push-progress is the ack; we pause once we are PUSH_WINDOW
  // ahead of what it confirms. Both sides no-op against pre-ack peers.
  private ackSentBytes = new Map<string, number>();
  private hostConfirmedBytes = new Map<string, number>();
  private static readonly ACK_EVERY = 2 * 1024 * 1024;
  private static readonly PUSH_WINDOW = 16 * 1024 * 1024;

  // ---- resume bookkeeping ----
  // Wire id (what the host sees) → job id (what the tray shows). A resumed
  // segment is a new job to the host, the same job to the user.
  private wireToJob = new Map<string, string>();
  private jobToWire = new Map<string, string>();
  private pullSpecs = new Map<string, { paths: string[]; destDir: string }>();
  private pullFileIndex = new Map<string, number>();
  private pushSpecs = new Map<string, { files: WalkedFile[]; destDir: string }>();
  // Bytes confirmed before the current push segment (files the previous host
  // job finished); the new host counts from zero.
  private pushSegmentBase = new Map<string, number>();
  private pausedAt = new Map<string, number>();
  private resumingPulls = new Set<string>();

  constructor(
    /** Puts a JSON object or a binary frame on the control channel. */
    private sendFallback: (payload: any) => void,
    /** Live handle on the control channel, for flow control on old hosts. */
    private getFallbackChannel: () => RTCDataChannel | null,
    private readonly onChange: (jobs: TransferJob[]) => void,
  ) {}

  /**
   * All engine traffic prefers the dedicated file channel; the control
   * channel is only the compatibility path for hosts that never open one.
   * On the shared channel a transfer's own progress messages queued behind
   * its own chunks, which is how a healthy transfer read as frozen.
   */
  private getChannel(): RTCDataChannel | null {
    return getSessionFileChannel() || this.getFallbackChannel();
  }

  private linkUp(): boolean {
    const channel = this.getChannel();
    return Boolean(channel && channel.readyState === 'open');
  }

  private send(payload: any): void {
    const fileChannel = getSessionFileChannel();
    if (fileChannel) {
      try {
        fileChannel.send(payload instanceof Uint8Array ? (payload as any) : JSON.stringify(payload));
        return;
      } catch (err: any) {
        report(`file-channel send failed, falling back: ${err?.message || err}`);
      }
    }
    this.sendFallback(payload);
  }

  /** Map a wire id from the host back to the job the user is watching. */
  private jobIdFor(wireId: string): string {
    return this.wireToJob.get(wireId) || wireId;
  }

  private wireIdFor(jobId: string): string {
    return this.jobToWire.get(jobId) || jobId;
  }

  private bindWire(jobId: string, wireId: string): void {
    this.wireToJob.set(wireId, jobId);
    this.jobToWire.set(jobId, wireId);
  }

  /* ---------------- stall / link watchdog ---------------- */

  private touch(jobId: string): void {
    this.lastActivityAt.set(jobId, Date.now());
    if (this.stalledJobs.delete(jobId)) {
      report(`job ${jobId} recovered from stall`);
    }
    this.ensureWatchdog();
  }

  private ensureWatchdog(): void {
    if (this.watchdog) return;
    // 3s tick is fine — a stall is judged over STALL_MS, and progress messages
    // arrive every ~200ms when healthy.
    this.watchdog = setInterval(() => this.checkStalls(), 3000);
  }

  private checkStalls(): void {
    const STALL_MS = 8000;
    const now = Date.now();
    const linkUp = this.linkUp();
    let anyLive = false;
    for (const job of this.jobs.values()) {
      if (job.state === 'paused') {
        anyLive = true;
        if (linkUp) {
          this.resumeJob(job.id);
        } else if (now - (this.pausedAt.get(job.id) || now) > PAUSE_GIVE_UP_MS) {
          this.upsert(job.id, { state: 'error', message: 'The connection did not come back. Start the transfer again.' });
          this.pausedAt.delete(job.id);
        }
        continue;
      }
      if (!isRunning(job.state) || job.legacy) continue;
      anyLive = true;
      if (!linkUp) {
        this.pauseJob(job.id);
        continue;
      }
      const last = this.lastActivityAt.get(job.id) || job.startedAt;
      if (now - last >= STALL_MS && !this.stalledJobs.has(job.id)) {
        this.stalledJobs.add(job.id);
        const channel = this.getChannel();
        report(`STALL: job ${job.id} (${job.direction}) no activity for ${Math.round((now - last) / 1000)}s — `
          + `bytes=${job.transferredBytes}/${job.totalBytes} chunksIn=${this.chunksIn.get(job.id) || 0} `
          + `written=${this.bytesWritten.get(job.id) || 0} channel=${channel?.readyState ?? 'null'} buffered=${channel?.bufferedAmount ?? -1}`);
        this.upsert(job.id, {
          bytesPerSecond: 0,
          etaSeconds: 0,
          message: 'Stalled — nothing has arrived for a few seconds. Waiting on the connection.',
        });
      }
    }
    if (!anyLive && this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }

  /** The session's channels are gone: hold the job instead of letting it rot. */
  private pauseJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.state === 'paused') return;
    this.pausedAt.set(jobId, Date.now());
    report(`job ${jobId} PAUSED — connection lost at ${job.transferredBytes}/${job.totalBytes} bytes`);
    this.upsert(jobId, {
      state: 'paused',
      bytesPerSecond: 0,
      etaSeconds: 0,
      message: 'Connection lost — the transfer will continue when the session is back.',
    });
  }

  /** The channels are back: continue where the job stopped. */
  private resumeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== 'paused' || this.cancelled.has(jobId)) return;
    this.pausedAt.delete(jobId);
    this.stalledJobs.delete(jobId);
    // Pushes resume from inside their own send loop (see sendPaths), which
    // watches linkUp(), re-announces the job to the new host and flips the
    // state itself.
    if (job.direction === 'send') return;
    this.upsert(jobId, { state: 'active', resumes: (job.resumes || 0) + 1, message: 'Connection back — continuing…' });
    this.touch(jobId);
    this.resumePull(jobId);
  }

  private resumePull(jobId: string): void {
    const spec = this.pullSpecs.get(jobId);
    const job = this.jobs.get(jobId);
    if (!spec || !job) return;
    // Everything before the current file is on disk in full; the current file
    // continues from the bytes that reached disk (the write handle stays
    // open across the pause, so nothing is re-written).
    const skipFiles = this.pullFileIndex.get(jobId) ?? 0;
    const offset = this.receiveHandles.has(jobId) ? (this.fileBytesWritten.get(jobId) || 0) : 0;
    if (!this.receiveHandles.has(jobId)) this.fileBytesWritten.set(jobId, 0);
    const wireId = newWireId('r');
    this.bindWire(jobId, wireId);
    this.resumingPulls.add(jobId);
    report(`pull ${jobId} RESUME as ${wireId}: skip ${skipFiles} file(s), offset ${offset}`);
    this.send({
      type: 'ft:pull',
      jobId: wireId,
      paths: spec.paths,
      destDir: spec.destDir,
      maxFileBytes: perFileLimit,
      resume: { skipFiles, offset },
    });
  }

  /* ---------------- job bookkeeping ---------------- */

  private emit(): void {
    if (this.disposed) return;
    this.onChange([...this.jobs.values()].sort((a, b) => b.startedAt - a.startedAt));
  }

  private upsert(id: string, patch: Partial<TransferJob>): TransferJob {
    const existing = this.jobs.get(id);
    const job: TransferJob = existing
      ? { ...existing, ...patch }
      : {
        id,
        direction: 'send',
        label: '',
        destDir: '',
        fileCount: 0,
        filesDone: 0,
        totalBytes: 0,
        transferredBytes: 0,
        currentName: '',
        state: 'preparing',
        message: '',
        bytesPerSecond: 0,
        etaSeconds: 0,
        startedAt: Date.now(),
        ...patch,
      };
    this.jobs.set(id, job);
    this.emit();
    return job;
  }

  /**
   * Smoothed throughput. An instantaneous rate off two progress messages
   * 200ms apart jitters badly enough to be useless as a readout, so blend.
   */
  private recordRate(id: string, transferredBytes: number): void {
    const job = this.jobs.get(id);
    if (!job) return;
    const now = Date.now();
    const previous = this.rateWindow.get(id);
    this.rateWindow.set(id, { at: now, bytes: transferredBytes });
    if (!previous) return;
    const elapsed = (now - previous.at) / 1000;
    if (elapsed <= 0) return;
    const instant = Math.max(0, transferredBytes - previous.bytes) / elapsed;
    const smoothed = job.bytesPerSecond ? job.bytesPerSecond * 0.7 + instant * 0.3 : instant;
    const remaining = Math.max(0, job.totalBytes - transferredBytes);
    job.bytesPerSecond = smoothed;
    job.etaSeconds = smoothed > 0 ? remaining / smoothed : 0;
  }

  getJobs(): TransferJob[] {
    return [...this.jobs.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  clearFinished(): void {
    for (const [id, job] of this.jobs) {
      if (job.state === 'done' || job.state === 'error' || job.state === 'cancelled') this.jobs.delete(id);
    }
    this.emit();
  }

  cancel(id: string): void {
    this.cancelled.add(id);
    this.send({ type: 'ft:cancel', jobId: this.wireIdFor(id) });
    const handle = this.receiveHandles.get(id);
    if (handle !== undefined) {
      this.receiveHandles.delete(id);
      void filesApi()?.abortWrite(handle).catch(() => {});
    }
    this.pausedAt.delete(id);
    this.upsert(id, { state: 'cancelled', message: 'Cancelled.' });
  }

  dispose(): void {
    this.disposed = true;
    if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; }
    for (const handle of this.receiveHandles.values()) void filesApi()?.abortWrite(handle).catch(() => {});
    this.receiveHandles.clear();
    this.jobs.clear();
    this.chunksIn.clear();
    this.bytesWritten.clear();
    this.lastActivityAt.clear();
    this.stalledJobs.clear();
    this.ackSentBytes.clear();
    this.hostConfirmedBytes.clear();
    this.wireToJob.clear();
    this.jobToWire.clear();
    this.pullSpecs.clear();
    this.pushSpecs.clear();
    this.pausedAt.clear();
  }

  /* ---------------- flow control ---------------- */

  private async waitForDrain(): Promise<void> {
    const channel = this.getChannel();
    if (!channel || channel.bufferedAmount < HIGH_WATER) return;
    channel.bufferedAmountLowThreshold = LOW_WATER;
    await new Promise<void>((resolveWait) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        channel.removeEventListener('bufferedamountlow', finish);
        resolveWait();
      };
      // If the channel closes mid-wait the event never fires; a stuck job is
      // worse than one extra chunk in the buffer.
      const timer = setTimeout(finish, 4_000);
      channel.addEventListener('bufferedamountlow', finish);
    });
  }

  /**
   * Block a push loop while the session has no channels. Resolves when the
   * link is back; throws if the job was cancelled or given up on meanwhile.
   */
  private async waitForLink(jobId: string): Promise<void> {
    if (this.linkUp()) return;
    this.pauseJob(jobId);
    this.ensureWatchdog();
    while (!this.linkUp()) {
      if (this.cancelled.has(jobId)) throw new Error('Cancelled.');
      const job = this.jobs.get(jobId);
      if (!job || job.state === 'error') throw new Error('The connection did not come back. Start the transfer again.');
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  /* ---------------- sending (viewer -> host) ---------------- */

  async sendPaths(paths: string[], destDir: string): Promise<void> {
    const files = filesApi();
    if (!files || !paths.length) return;
    const jobId = newWireId('s');
    this.bindWire(jobId, jobId);
    const label = paths.length === 1 ? (paths[0].split(/[\\/]/).pop() || paths[0]) : `${paths.length} items`;
    this.upsert(jobId, { direction: 'send', label, destDir, state: 'preparing', message: 'Reading Selection…' });

    let walked;
    try {
      walked = await files.walk(paths);
    } catch (err: any) {
      this.upsert(jobId, { state: 'error', message: err?.message || 'Could not read that selection.' });
      return;
    }
    if (this.cancelled.has(jobId)) return;
    if (!walked.files.length) {
      this.upsert(jobId, { state: 'error', message: 'Nothing to send — the selection is empty.' });
      return;
    }

    // Everything left out of the job is listed BY NAME with a reason — a job
    // that says "Done" after quietly dropping files was a top complaint.
    const skipped: SkippedFile[] = (walked.skipped || []).map((entry) => ({ name: entry.relPath, reason: entry.reason }));
    // Per-file plan limit, enforced BEFORE any bytes move: a refused transfer
    // that already spent ten minutes uploading is the worst of both worlds.
    let sendable = walked.files;
    if (perFileLimit !== null) {
      const limitText = describeLimit(perFileLimit);
      for (const file of walked.files) {
        if (file.size > perFileLimit) skipped.push({ name: file.relPath, reason: `Over your plan's ${limitText} per-file limit` });
      }
      sendable = walked.files.filter((file) => file.size <= perFileLimit!);
      const skippedOverLimit = walked.files.length - sendable.length;
      if (skippedOverLimit > 0) {
        report(`push ${jobId}: ${skippedOverLimit} file(s) over the ${limitText} plan limit`);
      }
      if (!sendable.length) {
        this.upsert(jobId, {
          state: 'error',
          skipped: skipped.slice(0, 50),
          message: `Too large — your plan allows up to ${limitText} per file.`,
        });
        return;
      }
    }
    const sendableBytes = sendable.reduce((sum, file) => sum + file.size, 0);
    walked = { ...walked, files: sendable, totalBytes: sendableBytes };
    this.pushSpecs.set(jobId, { files: walked.files, destDir });

    const skippedNote = skipped.length > 0
      ? `${skipped.length} file${skipped.length === 1 ? '' : 's'} skipped — see the list below.`
      : '';
    this.upsert(jobId, {
      fileCount: walked.files.length,
      totalBytes: walked.totalBytes,
      state: 'active',
      skipped: skipped.slice(0, 50),
      message: skippedNote || (walked.truncated ? 'Selection was very large; sending the first 20,000 files.' : ''),
      startedAt: Date.now(),
    });
    report(`push ${jobId} starting: ${walked.files.length} file(s), ${walked.totalBytes} bytes -> ${destDir || 'default dir'}`);

    // One "segment" per host job: the first announcement, and one more after
    // every reconnect (a new host peer knows nothing about the old job).
    let wireId = jobId;
    let segmentSent = 0;      // bytes handed to the CURRENT host job
    let sentBytes = 0;        // bytes of files fully sent, plus the current file, for the UI
    let lastUiUpdateAt = 0;
    const announce = (resume: boolean) => {
      this.send({
        type: 'ft:push-begin',
        jobId: wireId,
        destDir,
        fileCount: walked.files.length,
        totalBytes: walked.totalBytes,
        resume,
      });
    };
    announce(false);

    try {
      for (let index = 0; index < walked.files.length; index++) {
        if (this.cancelled.has(jobId)) break;
        const file = walked.files[index];
        let attempt = 0;
        // Loop until this file goes through on ONE live host job. A link loss
        // mid-file restarts the file from zero on the new host, replacing the
        // partial copy it left behind.
        for (;;) {
          if (this.cancelled.has(jobId)) break;
          const wasDown = !this.linkUp();
          await this.waitForLink(jobId);
          if (wasDown || this.jobs.get(jobId)?.state === 'paused') {
            // New host peer: fresh wire id, fresh counters, re-announce.
            wireId = newWireId('s');
            this.bindWire(jobId, wireId);
            this.hostConfirmedBytes.delete(jobId);
            segmentSent = 0;
            const base = walked.files.slice(0, index).reduce((sum, entry) => sum + entry.size, 0);
            this.pushSegmentBase.set(jobId, base);
            sentBytes = base;
            report(`push ${jobId} RESUME as ${wireId} from file ${index} (${base} bytes already on the host)`);
            announce(true);
            this.upsert(jobId, { state: 'active', resumes: (this.jobs.get(jobId)?.resumes || 0) + 1, message: 'Connection back — continuing…' });
            this.touch(jobId);
          }
          this.upsert(jobId, { currentName: file.relPath, filesDone: index });
          this.send({ type: 'ft:push-file', jobId: wireId, index, relPath: file.relPath, size: file.size, replace: attempt > 0 });

          let offset = 0;
          let fileSent = 0;
          let linkLost = false;
          while (offset < file.size) {
            if (this.cancelled.has(jobId)) break;
            if (!this.linkUp()) { linkLost = true; break; }
            const block = toBytes(await files.readChunk(file.absPath, offset, Math.min(READ_BLOCK, file.size - offset)));
            if (!block.byteLength) break; // file shrank or vanished mid-send
            offset += block.byteLength;
            for (let cursor = 0; cursor < block.byteLength; cursor += CHUNK_SIZE) {
              if (this.cancelled.has(jobId)) break;
              if (!this.linkUp()) { linkLost = true; break; }
              const slice = block.subarray(cursor, Math.min(cursor + CHUNK_SIZE, block.byteLength));
              await this.waitForDrain();
              // Ack window: never run more than PUSH_WINDOW ahead of what the
              // host confirms is written. Only engages once the first progress
              // message has arrived, so a host that never reports (or a stream
              // that dies before reporting) behaves exactly as before.
              const confirmedFloor = this.hostConfirmedBytes.get(jobId);
              if (confirmedFloor !== undefined && segmentSent - confirmedFloor > FileTransferEngine.PUSH_WINDOW) {
                const blockedAt = Date.now();
                while (!this.cancelled.has(jobId)
                  && segmentSent - (this.hostConfirmedBytes.get(jobId) || 0) > FileTransferEngine.PUSH_WINDOW) {
                  if (!this.linkUp()) { linkLost = true; break; }
                  if (Date.now() - blockedAt > 30_000) throw new Error('The remote computer stopped confirming received data.');
                  await new Promise((r) => setTimeout(r, 50));
                }
                if (linkLost) break;
              }
              if (this.cancelled.has(jobId)) break;
              this.send(frame({ type: 'ft:push-chunk', jobId: wireId, index }, slice));
              segmentSent += slice.byteLength;
              fileSent += slice.byteLength;
              this.recordRate(jobId, sentBytes + fileSent);
              // Throttled: an upsert per 64KB chunk is a React render per chunk,
              // hundreds a second on a fast link.
              const now = Date.now();
              if (now - lastUiUpdateAt >= 150) {
                lastUiUpdateAt = now;
                this.upsert(jobId, { transferredBytes: sentBytes + fileSent });
              }
            }
            if (linkLost) break;
          }
          if (this.cancelled.has(jobId)) break;
          if (linkLost) {
            attempt++;
            report(`push ${jobId}: link lost during ${file.relPath} at ${fileSent} bytes — will restart that file`);
            continue;
          }
          this.send({ type: 'ft:push-file-done', jobId: wireId, index, relPath: file.relPath });
          sentBytes += file.size;
          break;
        }
        if (this.cancelled.has(jobId)) break;
      }

      if (this.cancelled.has(jobId)) {
        this.upsert(jobId, { state: 'cancelled', message: 'Cancelled.' });
        return;
      }
      this.send({ type: 'ft:push-end', jobId: wireId });
      this.upsert(jobId, { filesDone: walked.files.length, transferredBytes: walked.totalBytes, message: 'Finishing…' });
    } catch (err: any) {
      this.send({ type: 'ft:cancel', jobId: wireId });
      this.upsert(jobId, { state: 'error', message: err?.message || 'The transfer failed.' });
    }
  }

  /* ---------------- receiving (host -> viewer) ---------------- */

  pullPaths(paths: string[], destDir: string): void {
    if (!paths.length) return;
    const jobId = newWireId('r');
    this.bindWire(jobId, jobId);
    const label = paths.length === 1 ? (paths[0].split(/[\\/]/).pop() || paths[0]) : `${paths.length} items`;
    this.upsert(jobId, {
      direction: 'receive',
      label,
      destDir,
      state: 'preparing',
      message: 'Asking The Remote Computer…',
      startedAt: Date.now(),
    });
    // '' means "our received-files folder". Resolve it up front so the tray
    // can say where the files went and offer Open Folder when they arrive.
    const files = filesApi();
    const resolveDest: Promise<string> = destDir
      ? Promise.resolve(destDir)
      : (files?.defaultReceiveDir ? files.defaultReceiveDir().catch(() => '') : Promise.resolve(''));
    void resolveDest.then((dir) => {
      if (this.cancelled.has(jobId)) return;
      if (dir) this.upsert(jobId, { destDir: dir });
      this.pullSpecs.set(jobId, { paths, destDir: dir });
      report(`pull ${jobId} requested: ${paths.length} path(s) -> ${dir || 'default dir'} (limit ${describeLimit(perFileLimit)})`);
      // The host walks the remote files, so it enforces the per-file cap during
      // that walk — oversized files are skipped and reported, not half-sent.
      this.send({ type: 'ft:pull', jobId, paths, destDir: dir, maxFileBytes: perFileLimit });
    });
  }

  /**
   * Serialise disk writes PER JOB: chunks arrive faster than IPC completes,
   * but two concurrent receives must not queue behind each other (one global
   * chain used to turn parallel gets into a serial one).
   */
  private queueWrite(jobId: string, work: () => Promise<unknown>): void {
    const chain = (this.writeChains.get(jobId) || Promise.resolve()).then(work).catch(() => { /* reported on the job */ });
    this.writeChains.set(jobId, chain);
  }

  /** Feed every `ft:`-prefixed JSON message from the host in here. */
  handleMessage(data: any): boolean {
    const type = String(data?.type || '');
    if (!type.startsWith('ft:')) return false;
    const wireId = String(data.jobId || '');
    const jobId = this.jobIdFor(wireId);
    const files = filesApi();

    switch (type) {
      case 'ft:pull-start': {
        report(`pull ${jobId} started: ${data.fileCount} file(s), ${data.totalBytes} bytes${data.skippedOverLimit ? ` (${data.skippedOverLimit} over limit)` : ''}${data.fromHost ? ' (host-initiated)' : ''}`);
        if (!this.jobs.has(jobId)) {
          // The HOST started this transfer (its dock's Send Files). Same
          // stream as a pull we asked for; it just needs a job to land in.
          this.bindWire(jobId, wireId);
          this.upsert(jobId, {
            direction: 'receive',
            label: String(data.label || 'Files from the remote computer'),
            destDir: '',
            hostInitiated: true,
            state: 'preparing',
            startedAt: Date.now(),
          });
          if (files?.defaultReceiveDir) {
            this.queueWrite(jobId, async () => {
              const dir = await files.defaultReceiveDir().catch(() => '');
              if (dir) this.upsert(jobId, { destDir: dir });
            });
          }
        }
        this.touch(jobId);
        if (this.resumingPulls.delete(jobId)) {
          // A resumed segment: the host describes only what is left, but the
          // user's job keeps its original totals.
          this.upsert(jobId, { state: 'active' });
          return true;
        }
        // Newer hosts list every skipped file with a reason; older ones only
        // count the over-limit ones.
        const skipped: SkippedFile[] = Array.isArray(data.skipped)
          ? data.skipped.map((entry: any) => ({ name: String(entry?.name || ''), reason: String(entry?.reason || 'Skipped') })).filter((entry: SkippedFile) => entry.name)
          : [];
        const skippedOverLimit = Number(data.skippedOverLimit) || 0;
        const skippedCount = skipped.length || skippedOverLimit;
        this.upsert(jobId, {
          state: 'active',
          fileCount: Number(data.fileCount) || 0,
          totalBytes: Number(data.totalBytes) || 0,
          startedAt: Date.now(),
          skipped: skipped.slice(0, 50),
          message: skippedCount > 0
            ? (skipped.length
              ? `${skippedCount} file${skippedCount === 1 ? '' : 's'} skipped — see the list below.`
              : `${skippedCount} file(s) skipped — over your plan's ${describeLimit(perFileLimit)} per-file limit.`)
            : data.truncated ? 'Selection was very large; receiving the first 20,000 files.' : '',
        });
        return true;
      }

      case 'ft:pull-file': {
        const job = this.jobs.get(jobId);
        if (!job || !files) return true;
        const index = Number(data.index) || 0;
        const startAt = Number(data.startAt) || 0;
        this.pullFileIndex.set(jobId, index);
        this.upsert(jobId, { currentName: String(data.relPath || ''), filesDone: index });
        this.queueWrite(jobId, async () => {
          if (this.cancelled.has(jobId)) return;
          // A resumed file continues on the handle that stayed open through
          // the pause: nothing to reopen, nothing re-written.
          if (startAt > 0 && this.receiveHandles.has(jobId)) return;
          // Reset inside the chain: chunk counting is queued behind this.
          this.expectedFileBytes.set(jobId, Number(data.size) || 0);
          this.fileBytesWritten.set(jobId, startAt);
          const dest = this.jobs.get(jobId)?.destDir ?? job.destDir;
          const opened = await files.openWrite(dest, String(data.relPath || ''), startAt > 0 ? { append: true } : undefined);
          if (opened.renamed) this.renamedCount.set(jobId, (this.renamedCount.get(jobId) || 0) + 1);
          this.receiveHandles.set(jobId, opened.handle);
        });
        return true;
      }

      case 'ft:pull-file-done':
        this.queueWrite(jobId, async () => {
          const handle = this.receiveHandles.get(jobId);
          if (handle === undefined || !files) return;
          this.receiveHandles.delete(jobId);
          // Size check: every chunk for this file has been written by now
          // (same chain). A short file is deleted and the job fails loudly —
          // a truncated copy that looks complete is worse than no copy.
          const expected = this.expectedFileBytes.get(jobId);
          const written = this.fileBytesWritten.get(jobId) || 0;
          if (expected !== undefined && written !== expected && !this.cancelled.has(jobId)) {
            report(`pull ${jobId}: ${data.relPath} arrived short (${written} of ${expected} bytes)`);
            await files.abortWrite(handle).catch(() => {});
            this.cancelled.add(jobId);
            this.send({ type: 'ft:cancel', jobId: wireId });
            this.upsert(jobId, {
              state: 'error',
              message: `${String(data.relPath || 'A file')} arrived incomplete (${formatBytes(written)} of ${formatBytes(expected)}). Try again.`,
            });
            return;
          }
          await files.closeWrite(handle);
        });
        return true;

      case 'ft:pull-progress': {
        const transferred = Number(data.sentBytes) || 0;
        this.touch(jobId);
        this.recordRate(jobId, transferred);
        this.upsert(jobId, { transferredBytes: transferred });
        return true;
      }

      case 'ft:pull-done':
        // Wait for the write chain: the last chunks are still in flight to
        // disk when the host says it finished sending.
        this.queueWrite(jobId, async () => {
          const job = this.jobs.get(jobId);
          const written = this.bytesWritten.get(jobId) || 0;
          const expectedTotal = Number(data.totalBytes) || 0;
          report(`pull ${jobId} done: chunksIn=${this.chunksIn.get(jobId) || 0} written=${written} of ${expectedTotal}`);
          if (job?.state === 'error' || this.cancelled.has(jobId)) return;
          if (expectedTotal > 0 && written < expectedTotal) {
            this.upsert(jobId, {
              state: 'error',
              message: `The transfer ended early — ${formatBytes(written)} of ${formatBytes(expectedTotal)} arrived. Try again.`,
            });
            return;
          }
          const renamed = this.renamedCount.get(jobId) || 0;
          this.pullSpecs.delete(jobId);
          this.upsert(jobId, {
            state: 'done',
            filesDone: job?.fileCount || 0,
            transferredBytes: expectedTotal || job?.totalBytes || 0,
            renamedCount: renamed,
            message: renamed > 0
              ? `${renamed} file${renamed === 1 ? ' was' : 's were'} saved under a new name because the original name was already taken.`
              : '',
          });
        });
        return true;

      case 'ft:push-ready':
        report(`push ${jobId} ready: host dir ${data.destDir}`);
        this.touch(jobId);
        this.upsert(jobId, { destDir: String(data.destDir || ''), state: 'active' });
        return true;

      case 'ft:push-progress': {
        // The host's count is authoritative for a send: it reflects bytes
        // actually written on the far side, not bytes we handed to SCTP. A
        // resumed segment's host counts from zero, so add what earlier hosts
        // had already confirmed.
        const confirmed = Number(data.receivedBytes) || 0;
        this.touch(jobId);
        this.hostConfirmedBytes.set(jobId, Math.max(this.hostConfirmedBytes.get(jobId) || 0, confirmed));
        const absolute = (this.pushSegmentBase.get(jobId) || 0) + confirmed;
        this.recordRate(jobId, absolute);
        this.upsert(jobId, { transferredBytes: absolute });
        return true;
      }

      case 'ft:push-done': {
        const job = this.jobs.get(jobId);
        report(`push ${jobId} done: ${data.fileCount} file(s), ${data.totalBytes} bytes confirmed by host`);
        const renamed = Number(data.renamed) || 0;
        this.pushSpecs.delete(jobId);
        this.pushSegmentBase.delete(jobId);
        this.upsert(jobId, {
          state: 'done',
          filesDone: job?.fileCount || Number(data.fileCount) || 0,
          transferredBytes: job?.totalBytes || Number(data.totalBytes) || 0,
          destDir: String(data.destDir || job?.destDir || ''),
          renamedCount: renamed,
          message: renamed > 0
            ? `${renamed} file${renamed === 1 ? ' was' : 's were'} saved under a new name because the original name was already taken.`
            : '',
        });
        return true;
      }

      case 'ft:cancelled':
        this.upsert(jobId, { state: 'cancelled', message: 'Cancelled.' });
        return true;

      case 'ft:error':
        report(`job ${jobId} ERROR from host: ${data.message}`);
        this.upsert(jobId, { state: 'error', message: String(data.message || 'The transfer failed.') });
        return true;

      default:
        // list/walk results are handled by the browser panes, not here.
        return false;
    }
  }

  /** Replace the fallback transport when a session reconnects. */
  retarget(send: (payload: any) => void, getChannel: () => RTCDataChannel | null): void {
    this.sendFallback = send;
    this.getFallbackChannel = getChannel;
  }

  /** For transfers that did not start here (protocol v1) — see reportLegacyTransfer. */
  upsertExternal(id: string, patch: Partial<TransferJob>): void {
    this.upsert(id, patch);
  }

  /** Feed binary frames whose header type is `ft:pull-chunk` in here. */
  handleChunk(header: any, chunk: Uint8Array): boolean {
    if (header?.type !== 'ft:pull-chunk') return false;
    const wireId = String(header.jobId || '');
    const jobId = this.jobIdFor(wireId);
    if (this.cancelled.has(jobId)) return true;
    const files = filesApi();
    if (!files) return true;
    this.touch(jobId);
    const count = (this.chunksIn.get(jobId) || 0) + 1;
    this.chunksIn.set(jobId, count);
    if (count === 1) report(`pull ${jobId}: first chunk received (${chunk.byteLength} bytes)`);
    // Copy: the underlying buffer is reused by the transport once we return.
    const bytes = new Uint8Array(chunk);
    this.queueWrite(jobId, async () => {
      const handle = this.receiveHandles.get(jobId);
      if (handle === undefined) return; // chunk for a file we already closed
      await files.writeChunk(handle, bytes);
      const written = (this.bytesWritten.get(jobId) || 0) + bytes.byteLength;
      this.bytesWritten.set(jobId, written);
      this.fileBytesWritten.set(jobId, (this.fileBytesWritten.get(jobId) || 0) + bytes.byteLength);
      // Ack what is genuinely on disk, not what merely arrived.
      if (written - (this.ackSentBytes.get(jobId) || 0) >= FileTransferEngine.ACK_EVERY) {
        this.ackSentBytes.set(jobId, written);
        this.send({ type: 'ft:ack', jobId: wireId, receivedBytes: written });
      }
    });
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Session-scoped singleton                                            */
/* ------------------------------------------------------------------ */

/**
 * The engine outlives the file manager panel on purpose. Closing the panel
 * must not abandon a running transfer — that was the old behaviour and it
 * silently lost half-copied files. The panel is a window onto this; the
 * session owns it, and only leaving the session tears it down.
 */
let sharedEngine: FileTransferEngine | null = null;
const jobListeners = new Set<(jobs: TransferJob[]) => void>();

export function getFileTransferEngine(
  send: (payload: any) => void,
  getChannel: () => RTCDataChannel | null,
): FileTransferEngine {
  if (!sharedEngine) {
    sharedEngine = new FileTransferEngine(send, getChannel, (jobs) => {
      for (const listener of jobListeners) listener(jobs);
    });
  } else {
    // A reconnect hands us a new channel; existing jobs keep their history.
    sharedEngine.retarget(send, getChannel);
  }
  return sharedEngine;
}

export function subscribeTransferJobs(listener: (jobs: TransferJob[]) => void): () => void {
  jobListeners.add(listener);
  listener(sharedEngine?.getJobs() || []);
  return () => { jobListeners.delete(listener); };
}

export type LegacyTransferStatus = {
  direction: 'send' | 'receive';
  name?: string;
  progress?: number;
  state: 'waiting' | 'transferring' | 'complete' | 'error' | 'cancelled';
  message?: string;
  path?: string;
} | null;

/**
 * Protocol-v1 transfers (the host's dock "Send File" button on older hosts,
 * the web and phone viewers) have no engine job of their own. Mirror their
 * status into the same job list so the tray is the one place a transfer ever
 * shows up — they used to get an unrelated all-caps modal.
 */
export function reportLegacyTransfer(status: LegacyTransferStatus): void {
  if (!status || !sharedEngine) return;
  const name = status.name || 'File';
  const id = `legacy:${status.direction}:${name}`;
  const state: JobState = status.state === 'complete' ? 'done'
    : status.state === 'error' ? 'error'
      : status.state === 'cancelled' ? 'cancelled'
        : 'active';
  const destDir = status.path ? status.path.replace(/[\\/][^\\/]*$/, '') : '';
  sharedEngine.upsertExternal(id, {
    direction: status.direction,
    label: name,
    currentName: name,
    legacy: true,
    state,
    fileCount: 1,
    filesDone: state === 'done' ? 1 : 0,
    totalBytes: 100,
    transferredBytes: state === 'done' ? 100 : Math.max(0, Math.min(100, Number(status.progress) || 0)),
    destDir,
    message: state === 'done' ? '' : String(status.message || ''),
  });
}

export function disposeFileTransferEngine(): void {
  sharedEngine?.dispose();
  sharedEngine = null;
  jobListeners.clear();
}
