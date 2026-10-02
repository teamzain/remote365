/**
 * Host-side file transfer engine (protocol v2, the `ft:` messages).
 *
 * What was wrong with v1, and why this exists:
 *
 *  - Throughput. The old host->viewer send had no flow control at all: it slept
 *    10ms every 5 chunks of 16KB, which hard-caps the link at ~8MB/s no matter
 *    how fast the network is, and sleeping between sends is precisely the
 *    anti-pattern for SCTP. This module uses 64KB chunks (the recommended
 *    maximum for a data channel message) and real backpressure off
 *    bufferedAmount / onBufferedAmountLow, so it goes as fast as the pipe
 *    allows and no faster.
 *  - One file, no folders. v1 could move a single file per user action. This
 *    speaks in jobs: a job is an ordered list of files with relative paths, so
 *    a whole folder tree is just a job with more entries.
 *  - Memory. Both ends streamed nothing; the viewer buffered whole files in
 *    RAM. Here every byte goes straight to a write stream.
 *  - No cancel. Jobs are cancellable at any point, and a cancel closes the
 *    partial file instead of leaving a stream open.
 *
 * v1 is deliberately still handled in index.ts. Web and mobile viewers speak
 * it, and they must keep working while only the desktop viewer speaks v2.
 */

import { createWriteStream, createReadStream, WriteStream } from 'fs';
import { promises as fs } from 'fs';
import { basename, join, resolve, dirname, extname, relative, isAbsolute } from 'path';

/** The subset of node-datachannel's DataChannel this module needs. */
export type TransferChannel = {
  isOpen: () => boolean;
  sendMessage: (message: string) => unknown;
  sendMessageBinary: (data: Buffer) => unknown;
  bufferedAmount?: () => number;
  setBufferedAmountLowThreshold?: (bytes: number) => void;
  onBufferedAmountLow?: (callback: () => void) => void;
};

export type FileTransferDeps = {
  /** Where pushed files land when the viewer does not name a destination. */
  defaultReceiveDir: () => string;
  log: { info: (message: string) => void; error: (message: string) => void };
  /** openPath: clicking the notification opens this folder. */
  notify?: (title: string, body: string, openPath?: string) => void;
};

// 64KB is the recommended ceiling for a single data-channel message; larger
// messages get fragmented by the SCTP stack and stall other traffic on the
// same association for longer.
const CHUNK_SIZE = 64 * 1024;
// Keep roughly a bandwidth-delay product in flight (1MB covers 80Mbps at
// 100ms RTT) — enough to saturate a fast link, small enough that a chat
// message queued behind a transfer is not delayed by seconds.
const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;
const PROGRESS_INTERVAL_MS = 200;
// Guard rails for a recursive walk: a viewer that points at C:\ should get a
// clear "too large" rather than the host enumerating for ten minutes.
const MAX_WALK_FILES = 20_000;
const MAX_WALK_DEPTH = 32;
const IDLE_TIMEOUT_MS = 120_000;

/* ------------------------------------------------------------------ */
/* Backpressure                                                        */
/* ------------------------------------------------------------------ */

type Waiter = () => void;
const drainWaiters = new WeakMap<TransferChannel, Set<Waiter>>();
const blindChannels = new WeakSet<TransferChannel>();

/**
 * node-datachannel keeps exactly ONE onBufferedAmountLow callback per channel,
 * so every sender that wants to know the pipe drained has to share a single
 * registration. This installs it once and fans out.
 */
function armDrainSignal(channel: TransferChannel): Set<Waiter> {
  const existing = drainWaiters.get(channel);
  if (existing) return existing;
  const waiters = new Set<Waiter>();
  drainWaiters.set(channel, waiters);
  try {
    channel.setBufferedAmountLowThreshold?.(LOW_WATER);
    channel.onBufferedAmountLow?.(() => {
      for (const waiter of [...waiters]) {
        waiters.delete(waiter);
        waiter();
      }
    });
  } catch {
    // Binding without the low-watermark API: whenDrained still makes progress
    // via its safety timeout, just less efficiently.
  }
  return waiters;
}

/**
 * Put one file chunk on the channel.
 *
 * sendMessageBinary returns FALSE when the message was QUEUED behind earlier
 * ones instead of written at once. It is still delivered, in order; a real
 * failure throws. (Measured on libdatachannel 0.24: 300 messages, 281 false
 * returns, 300 delivered, none twice.) The return value used to be read as
 * "dropped" and the chunk sent again, up to 20 times. On a fast link the queue
 * is empty by the next chunk, so nothing showed; on a slow one every chunk
 * queues, so every chunk was duplicated into the file and the transfer then
 * gave up with "The connection stopped accepting data."
 */
export function sendChunk(channel: TransferChannel, data: Buffer): void {
  channel.sendMessageBinary(data);
}

export function whenDrained(channel: TransferChannel, log?: FileTransferDeps['log']): Promise<void> {
  const buffered = typeof channel.bufferedAmount === 'function' ? channel.bufferedAmount() : -1;
  if (buffered === -1) {
    // No bufferedAmount on this channel wrapper: flow control is BLIND. Say
    // so once rather than flooding the pipe silently.
    if (!blindChannels.has(channel)) {
      blindChannels.add(channel);
      log?.error('[FileTransfer] channel exposes no bufferedAmount — sending without backpressure');
    }
    return Promise.resolve();
  }
  if (buffered < HIGH_WATER) return Promise.resolve();
  const waiters = armDrainSignal(channel);
  return new Promise<void>((resolveWait) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      waiters.delete(finish);
      resolveWait();
    };
    // If the channel closes mid-wait the callback never fires. A transfer that
    // hangs forever is worse than one that briefly pushes too hard.
    const timer = setTimeout(finish, 4_000);
    waiters.add(finish);
  });
}

/* ------------------------------------------------------------------ */
/* Wire helpers                                                        */
/* ------------------------------------------------------------------ */

function send(channel: TransferChannel, payload: object): void {
  if (!channel?.isOpen?.()) return;
  try { channel.sendMessage(JSON.stringify(payload)); } catch { /* channel died mid-job */ }
}

/** [4-byte LE header length][JSON header][raw bytes] — same shape as v1. */
function frame(header: object, payload: Buffer): Buffer {
  const headerBuffer = Buffer.from(JSON.stringify(header));
  const out = Buffer.allocUnsafe(4 + headerBuffer.length + payload.length);
  out.writeUInt32LE(headerBuffer.length, 0);
  headerBuffer.copy(out, 4);
  payload.copy(out, 4 + headerBuffer.length);
  return out;
}

/* ------------------------------------------------------------------ */
/* Path safety                                                         */
/* ------------------------------------------------------------------ */

/**
 * The relative path inside a job is chosen by the REMOTE side. Untreated, it
 * is a path-traversal primitive: "..\..\Windows\System32\x.dll" would escape
 * the destination folder entirely. Strip separators-turned-parents, drive
 * letters and absolute roots, and keep only plain segments.
 */
export function sanitizeRelPath(relPath: string): string {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..' && !/^[a-zA-Z]:$/.test(segment))
    // Windows reserves these characters; a name carrying them cannot be created
    // and would fail the whole job late instead of early.
    .map((segment) => segment.replace(/[<>:"|?*\u0000-\u001f]/g, '_'))
    .join('/');
}

/** Belt-and-braces: confirm the resolved target really is under the root. */
function isInside(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/* ------------------------------------------------------------------ */
/* Recursive enumeration                                               */
/* ------------------------------------------------------------------ */

export type WalkEntry = { relPath: string; absPath: string; size: number };
export type WalkSkipped = { relPath: string; reason: string };
type WalkResult = { files: WalkEntry[]; totalBytes: number; truncated: boolean; skipped: WalkSkipped[] };
const MAX_WALK_SKIPPED = 50;

export async function walkPaths(rootPaths: string[]): Promise<WalkResult> {
  const files: WalkEntry[] = [];
  // Whatever the walk leaves out is reported by name so the job never says
  // "Done" while silently missing files the user selected.
  const skipped: WalkSkipped[] = [];
  const skip = (relPath: string, reason: string) => { if (skipped.length < MAX_WALK_SKIPPED) skipped.push({ relPath, reason }); };
  let totalBytes = 0;
  let truncated = false;

  const visit = async (absPath: string, relPath: string, depth: number): Promise<void> => {
    if (truncated || files.length >= MAX_WALK_FILES) {
      truncated = true;
      return;
    }
    if (depth > MAX_WALK_DEPTH) { skip(relPath, 'Folder is nested too deep'); return; }
    let stat;
    try {
      // lstat, not stat: following a symlink can leave the tree the user
      // pointed at (and can loop).
      stat = await fs.lstat(absPath);
    } catch (err: any) {
      skip(relPath, err?.code === 'EACCES' || err?.code === 'EPERM' ? 'No permission to read it' : 'Could not be read');
      return;
    }
    if (stat.isSymbolicLink()) { skip(relPath, 'Shortcut — the file it points to was not copied'); return; }
    if (stat.isFile()) {
      files.push({ relPath, absPath, size: stat.size });
      totalBytes += stat.size;
      return;
    }
    if (!stat.isDirectory()) return;
    let entries: string[];
    try {
      entries = await fs.readdir(absPath);
    } catch (err: any) {
      // unreadable folder (permissions) — skip rather than fail the job, but say so
      skip(relPath, err?.code === 'EACCES' || err?.code === 'EPERM' ? 'No permission to open this folder' : 'Folder could not be read');
      return;
    }
    for (const entry of entries) {
      await visit(join(absPath, entry), `${relPath}/${entry}`, depth + 1);
      if (truncated) return;
    }
  };

  for (const rootPath of rootPaths) {
    if (!rootPath) continue;
    await visit(rootPath, basename(rootPath) || rootPath, 0);
  }
  return { files, totalBytes, truncated, skipped };
}

/**
 * "report.pdf" → "report (2).pdf" → "report (3).pdf" … until a free name is
 * found. Nothing a transfer writes ever overwrites a file that was there
 * before; the job reports how many files were renamed.
 */
export async function uniquePath(target: string): Promise<string> {
  const exists = async (candidate: string) => { try { await fs.access(candidate); return true; } catch { return false; } };
  if (!(await exists(target))) return target;
  const dir = dirname(target);
  const ext = extname(target);
  const stem = basename(target, ext);
  for (let n = 2; n < 1000; n++) {
    const candidate = join(dir, `${stem} (${n})${ext}`);
    if (!(await exists(candidate))) return candidate;
  }
  return join(dir, `${stem} (${Date.now()})${ext}`);
}

/* ------------------------------------------------------------------ */
/* Pull: host -> viewer                                                */
/* ------------------------------------------------------------------ */

type PullJob = {
  jobId: string;
  channel: TransferChannel;
  cancelled: boolean;
  // ACK window. SCTP guarantees delivery to the peer's transport, but not
  // that the receiver has actually WRITTEN the bytes — a slow disk lets the
  // sender run arbitrarily far ahead, ballooning the receiver's write queue.
  // Receivers that speak acks bound that: we pause once sent-acked exceeds
  // the window. ackSeen gates the whole mechanism so a 1.2.97-era viewer
  // that never acks is streamed to exactly as before.
  ackedBytes: number;
  ackSeen: boolean;
};
const pullJobs = new Map<string, PullJob>();

const ACK_WINDOW = 8 * 1024 * 1024;
// A receiver that stops acking for this long while we are window-blocked has
// died or hung; erroring beats waiting forever.
const ACK_STALL_LIMIT_MS = 30_000;

export type PullOptions = {
  /** Set when the HOST started the transfer (dock "Send Files"): the viewer creates a job for it. */
  announce?: { fromHost?: boolean; label?: string };
  /** Continue an interrupted pull: files before skipFiles are already on the viewer's disk, the next one from `offset`. */
  resume?: { skipFiles: number; offset: number };
};

/** The host's own "send these files to the viewer" — a pull the host starts. */
export function startHostPull(
  jobId: string,
  paths: string[],
  channel: TransferChannel,
  deps: FileTransferDeps,
  announce: { fromHost: true; label: string },
  // The viewer's plan cap when the viewer asked for these files ("Get
  // files"); null when the host chose to send on its own.
  maxFileBytes: number | null = null,
): void {
  void runPullJob(jobId, paths, channel, deps, maxFileBytes, { announce });
}

async function runPullJob(
  jobId: string,
  requestedPaths: string[],
  channel: TransferChannel,
  deps: FileTransferDeps,
  maxFileBytes?: number | null,
  options: PullOptions = {},
): Promise<void> {
  const job: PullJob = { jobId, channel, cancelled: false, ackedBytes: 0, ackSeen: false };
  const previous = pullJobs.get(jobId);
  if (previous) previous.cancelled = true; // a resumed segment reusing an id supersedes the old loop
  pullJobs.set(jobId, job);
  try {
    const walked = await walkPaths(requestedPaths);
    let files = walked.files;
    const truncated = walked.truncated;
    // Per-file plan limit, applied where the sizes are known — here, during
    // the walk. Oversized files are skipped and REPORTED, never half-sent.
    let skippedOverLimit = 0;
    if (typeof maxFileBytes === 'number' && maxFileBytes > 0) {
      const allowed = files.filter((file) => file.size <= maxFileBytes);
      skippedOverLimit = files.length - allowed.length;
      files = allowed;
    }
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    // Every file left out, by name, with a reason — the viewer lists them.
    const skipped: Array<{ name: string; reason: string }> = walked.skipped.map((entry) => ({ name: entry.relPath, reason: entry.reason }));
    if (typeof maxFileBytes === 'number' && maxFileBytes > 0) {
      for (const file of walked.files) {
        if (file.size > maxFileBytes && skipped.length < 50) skipped.push({ name: file.relPath, reason: 'Over the per-file limit of your plan' });
      }
    }
    if (!files.length) {
      send(channel, {
        type: 'ft:error',
        jobId,
        message: skippedOverLimit > 0
          ? 'Too large — that file is over your plan’s per-file transfer limit.'
          : 'Nothing to send — the selection is empty or unreadable.',
      });
      return;
    }
    send(channel, {
      type: 'ft:pull-start', jobId, fileCount: files.length, totalBytes, truncated, skippedOverLimit, skipped,
      ...(options.announce?.fromHost ? { fromHost: true, label: options.announce.label || '' } : {}),
    });
    deps.log.info(`[FileTransfer] Pull ${jobId}: ${files.length} file(s), ${totalBytes} bytes${skippedOverLimit ? ` (${skippedOverLimit} over plan limit, skipped)` : ''}${options.resume ? ` (resume: skip ${options.resume.skipFiles}, offset ${options.resume.offset})` : ''}`);

    // Resume: the walk is deterministic, so "skip N files, start the next at
    // byte X" continues exactly where the viewer's disk stopped. Byte counts
    // stay ABSOLUTE so the viewer's progress and size checks line up.
    const skipFiles = Math.max(0, Math.min(files.length, Number(options.resume?.skipFiles) || 0));
    let resumeOffset = Math.max(0, Number(options.resume?.offset) || 0);
    let sentBytes = files.slice(0, skipFiles).reduce((sum, file) => sum + file.size, 0);
    let lastProgressAt = 0;

    for (let index = skipFiles; index < files.length; index++) {
      if (job.cancelled) break;
      const file = files[index];
      const startAt = index === skipFiles ? Math.min(resumeOffset, file.size) : 0;
      resumeOffset = 0;
      send(channel, { type: 'ft:pull-file', jobId, index, relPath: file.relPath, size: file.size, startAt });
      sentBytes += startAt;

      // An empty file has no chunks at all — it exists purely as a
      // file/file-done pair, which is why the receiver must create the file on
      // ft:pull-file and not on the first chunk.
      if (file.size > startAt) {
        const stream = createReadStream(file.absPath, { highWaterMark: CHUNK_SIZE, start: startAt });
        try {
          for await (const piece of stream) {
            if (job.cancelled || !channel.isOpen?.()) break;
            // A readable stream can hand back more than highWaterMark; never
            // put an oversized message on the wire.
            let offset = 0;
            const buffer = piece as Buffer;
            while (offset < buffer.length) {
              if (job.cancelled) break;
              const slice = buffer.subarray(offset, offset + CHUNK_SIZE);
              offset += slice.length;
              await whenDrained(channel, deps.log);
              if (job.cancelled || !channel.isOpen?.()) break;
              sendChunk(channel, frame({ type: 'ft:pull-chunk', jobId, index }, slice));
              sentBytes += slice.length;
              // Ack window (see PullJob): pause when too far ahead of what
              // the receiver confirms is on disk.
              if (job.ackSeen && sentBytes - job.ackedBytes > ACK_WINDOW) {
                const blockedAt = Date.now();
                while (!job.cancelled && sentBytes - job.ackedBytes > ACK_WINDOW) {
                  if (Date.now() - blockedAt > ACK_STALL_LIMIT_MS) {
                    throw new Error('The other side stopped confirming received data.');
                  }
                  await new Promise((r) => setTimeout(r, 50));
                }
              }
              const now = Date.now();
              if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
                lastProgressAt = now;
                send(channel, { type: 'ft:pull-progress', jobId, index, sentBytes, totalBytes });
              }
            }
          }
        } finally {
          stream.destroy();
        }
      }

      if (job.cancelled) break;
      send(channel, { type: 'ft:pull-file-done', jobId, index, relPath: file.relPath });
    }

    if (job.cancelled) {
      send(channel, { type: 'ft:cancelled', jobId });
      deps.log.info(`[FileTransfer] Pull ${jobId} cancelled`);
      return;
    }
    send(channel, { type: 'ft:pull-progress', jobId, index: files.length - 1, sentBytes, totalBytes });
    send(channel, { type: 'ft:pull-done', jobId, fileCount: files.length, totalBytes: sentBytes });
    deps.log.info(`[FileTransfer] Pull ${jobId} complete`);
  } catch (err: any) {
    deps.log.error(`[FileTransfer] Pull ${jobId} failed: ${err?.message || err}`);
    send(channel, { type: 'ft:error', jobId, message: err?.message || 'The remote computer could not send those files.' });
  } finally {
    pullJobs.delete(jobId);
  }
}

/* ------------------------------------------------------------------ */
/* Push: viewer -> host                                                */
/* ------------------------------------------------------------------ */

type PushJob = {
  jobId: string;
  channel: TransferChannel;
  destDir: string;
  totalBytes: number;
  receivedBytes: number;
  fileCount: number;
  filesDone: number;
  index: number;
  stream: WriteStream | null;
  currentPath: string;
  /** Name of the first file written — what a one-file notification should say. */
  firstName: string;
  /** Declared size of the file being written and the bytes seen for it so far. */
  currentSize: number;
  currentFileBytes: number;
  /** Files saved under a "(2)"-style name because the original already existed. */
  renamed: number;
  // Serialises writes so an SCTP burst cannot interleave chunks on disk.
  writeChain: Promise<void>;
  lastProgressAt: number;
  idleTimer: NodeJS.Timeout | null;
};
const pushJobs = new Map<string, PushJob>();
// "destDir|relPath" → the file a push is (or was, before a lost connection)
// writing there. Lets a resumed push overwrite ONLY its own partial copy.
const partialPushTargets = new Map<string, string>();

function armIdleTimer(job: PushJob, deps: FileTransferDeps): void {
  if (job.idleTimer) clearTimeout(job.idleTimer);
  job.idleTimer = setTimeout(() => {
    deps.log.error(`[FileTransfer] Push ${job.jobId} timed out`);
    abortPushJob(job.jobId, 'The transfer stalled and was cancelled.', deps);
  }, IDLE_TIMEOUT_MS);
}

function abortPushJob(jobId: string, message: string, deps: FileTransferDeps): void {
  const job = pushJobs.get(jobId);
  if (!job) return;
  if (job.idleTimer) clearTimeout(job.idleTimer);
  try { job.stream?.destroy(); } catch { /* already gone */ }
  pushJobs.delete(jobId);
  send(job.channel, { type: 'ft:error', jobId, message });
  deps.log.error(`[FileTransfer] Push ${jobId} aborted: ${message}`);
}

/** Append to the current file, keeping writes strictly ordered. */
function queueWrite(job: PushJob, chunk: Buffer): void {
  job.writeChain = job.writeChain.then(() => new Promise<void>((resolveWrite, rejectWrite) => {
    const stream = job.stream;
    if (!stream) return resolveWrite();
    // write() returning false means the OS buffer is full; waiting for
    // 'drain' is what keeps a fast network from ballooning heap.
    const ok = stream.write(chunk, (err) => { if (err) rejectWrite(err); });
    if (ok) resolveWrite();
    else stream.once('drain', resolveWrite);
  })).catch(() => { /* surfaced by the stream error handler */ });
}

/* ------------------------------------------------------------------ */
/* Message handling                                                    */
/* ------------------------------------------------------------------ */

/**
 * Handle a JSON control message. Returns true when the message belonged to
 * this module, so the caller knows not to process it further.
 */
export function handleFileTransferCommand(
  event: any,
  channel: TransferChannel,
  deps: FileTransferDeps,
  listFilesystem: (path?: string, options?: { showHidden?: boolean; offset?: number; limit?: number; query?: string }) => Promise<any>,
  options: {
    /** Per-file cap the SERVER stamped on this viewer's session (their plan). Wins over anything the viewer sends. */
    maxFileBytes?: number | null;
  } = {},
): boolean {
  const type = String(event?.type || '');
  if (!type.startsWith('ft:')) return false;
  const serverCap = typeof options.maxFileBytes === 'number' && options.maxFileBytes > 0 ? options.maxFileBytes : null;

  switch (type) {
    case 'ft:list': {
      listFilesystem(event.path, {
        showHidden: Boolean(event.showHidden),
        offset: Number(event.offset) || 0,
        limit: Number(event.limit) || undefined,
        query: typeof event.query === 'string' ? event.query : '',
      })
        .then((listing) => send(channel, { type: 'ft:list-result', reqId: event.reqId, ...listing }))
        .catch((err: any) => send(channel, {
          type: 'ft:list-error',
          reqId: event.reqId,
          message: err?.message || 'Could not open that folder on the remote computer.',
        }));
      return true;
    }

    case 'ft:default-dirs': {
      send(channel, { type: 'ft:default-dirs', reqId: event.reqId, receiveDir: deps.defaultReceiveDir() });
      return true;
    }

    case 'ft:walk': {
      // Lets the viewer show "113 files, 2.4 GB" before committing to a pull.
      const paths = Array.isArray(event.paths) ? event.paths.map(String) : [];
      walkPaths(paths)
        .then(({ files, totalBytes, truncated }) => send(channel, {
          type: 'ft:walk-result',
          reqId: event.reqId,
          fileCount: files.length,
          totalBytes,
          truncated,
        }))
        .catch((err: any) => send(channel, {
          type: 'ft:list-error',
          reqId: event.reqId,
          message: err?.message || 'Could not read that selection.',
        }));
      return true;
    }

    case 'ft:pull': {
      const jobId = String(event.jobId || '');
      const paths = Array.isArray(event.paths) ? event.paths.map(String) : [];
      if (!jobId || !paths.length) return true;
      const viewerCap = Number.isFinite(Number(event.maxFileBytes)) && Number(event.maxFileBytes) > 0
        ? Number(event.maxFileBytes)
        : null;
      // The server-stamped cap is authoritative; the viewer's own figure only
      // applies when the server did not provide one (older signaling).
      const maxFileBytes = serverCap ?? viewerCap;
      const resume = event.resume && typeof event.resume === 'object'
        ? { skipFiles: Number(event.resume.skipFiles) || 0, offset: Number(event.resume.offset) || 0 }
        : undefined;
      void runPullJob(jobId, paths, channel, deps, maxFileBytes, { resume });
      return true;
    }

    case 'ft:mkdir': {
      const parent = String(event.path || '');
      const name = sanitizeRelPath(String(event.name || ''));
      const target = join(parent, name);
      if (!name || !isInside(parent, target)) {
        send(channel, { type: 'ft:list-error', reqId: event.reqId, message: 'Invalid folder name.' });
        return true;
      }
      fs.mkdir(target, { recursive: true })
        .then(() => listFilesystem(parent, { showHidden: Boolean(event.showHidden) }))
        .then((listing) => send(channel, { type: 'ft:list-result', reqId: event.reqId, ...listing }))
        .catch((err: any) => send(channel, {
          type: 'ft:list-error',
          reqId: event.reqId,
          message: err?.message || 'Could not create that folder.',
        }));
      return true;
    }

    case 'ft:ack': {
      const job = pullJobs.get(String(event.jobId || ''));
      if (job) {
        job.ackSeen = true;
        job.ackedBytes = Math.max(job.ackedBytes, Number(event.receivedBytes) || 0);
      }
      return true;
    }

    case 'ft:cancel': {
      const jobId = String(event.jobId || '');
      const pull = pullJobs.get(jobId);
      if (pull) {
        pull.cancelled = true;
        deps.log.info(`[FileTransfer] Pull ${jobId} cancel requested`);
      }
      const push = pushJobs.get(jobId);
      if (push) {
        if (push.idleTimer) clearTimeout(push.idleTimer);
        try { push.stream?.destroy(); } catch { /* already gone */ }
        // Remove the half-written file: a truncated copy that looks complete
        // is worse than no copy.
        if (push.currentPath) void fs.unlink(push.currentPath).catch(() => {});
        pushJobs.delete(jobId);
        send(channel, { type: 'ft:cancelled', jobId });
        deps.log.info(`[FileTransfer] Push ${jobId} cancelled`);
      }
      return true;
    }

    case 'ft:push-begin': {
      const jobId = String(event.jobId || '');
      if (!jobId) return true;
      const requestedDir = String(event.destDir || '').trim();
      const destDir = requestedDir || deps.defaultReceiveDir();
      const job: PushJob = {
        jobId,
        channel,
        destDir,
        totalBytes: Number(event.totalBytes) || 0,
        receivedBytes: 0,
        fileCount: Number(event.fileCount) || 0,
        filesDone: 0,
        index: -1,
        stream: null,
        currentPath: '',
        firstName: '',
        currentSize: 0,
        currentFileBytes: 0,
        renamed: 0,
        writeChain: Promise.resolve(),
        lastProgressAt: 0,
        idleTimer: null,
      };
      pushJobs.set(jobId, job);
      armIdleTimer(job, deps);
      fs.mkdir(destDir, { recursive: true })
        .then(() => send(channel, { type: 'ft:push-ready', jobId, destDir }))
        .catch((err: any) => abortPushJob(jobId, err?.message || 'Could not open the destination folder.', deps));
      deps.log.info(`[FileTransfer] Push ${jobId}: ${job.fileCount} file(s) -> ${destDir}`);
      return true;
    }

    case 'ft:push-file': {
      const job = pushJobs.get(String(event.jobId || ''));
      if (!job) return true;
      armIdleTimer(job, deps);
      const relPath = sanitizeRelPath(String(event.relPath || ''));
      if (!relPath) {
        abortPushJob(job.jobId, 'A file in that transfer had an unusable name.', deps);
        return true;
      }
      const target = join(job.destDir, relPath);
      if (!isInside(job.destDir, target)) {
        abortPushJob(job.jobId, 'That transfer tried to write outside the destination folder.', deps);
        return true;
      }
      job.index = Number(event.index);
      job.currentPath = target;
      job.currentSize = Number(event.size) || 0;
      job.currentFileBytes = 0;
      if (serverCap !== null && job.currentSize > serverCap) {
        abortPushJob(job.jobId, `${basename(target)} is over the per-file limit of the sender's plan.`, deps);
        return true;
      }
      // `replace` = the viewer is re-sending a file that a lost connection cut
      // short. Only the partial copy WE wrote may be overwritten, and it may
      // live under a "(2)" name. Overwriting `target` itself used to clobber
      // the user's pre-existing file whenever the first attempt was renamed.
      const partialKey = `${job.destDir}|${relPath}`;
      const ourPartial = Boolean(event.replace) ? partialPushTargets.get(partialKey) : undefined;
      // Chain the open so it cannot race the first chunk's write.
      job.writeChain = job.writeChain
        .then(() => fs.mkdir(dirname(target), { recursive: true }))
        .then(async () => {
          // Never overwrite a file that was there before: ours gets "(2)".
          const finalTarget = ourPartial || await uniquePath(target);
          if (finalTarget !== target) job.renamed++;
          job.currentPath = finalTarget;
          partialPushTargets.set(partialKey, finalTarget);
          if (!job.firstName) job.firstName = basename(finalTarget);
          const stream = createWriteStream(finalTarget, { flags: ourPartial ? 'w' : 'wx' });
          stream.on('error', (err: any) => abortPushJob(job.jobId, `Could not save ${basename(finalTarget)}: ${err.message}`, deps));
          job.stream = stream;
        })
        .catch((err: any) => abortPushJob(job.jobId, err?.message || 'Could not create the destination file.', deps));
      return true;
    }

    case 'ft:push-file-done': {
      const job = pushJobs.get(String(event.jobId || ''));
      if (!job) return true;
      armIdleTimer(job, deps);
      const stream = job.stream;
      job.stream = null;
      job.filesDone++;
      const expected = job.currentSize;
      const seen = job.currentFileBytes;
      const path = job.currentPath;
      job.writeChain = job.writeChain.then(() => new Promise<void>((resolveEnd) => {
        if (!stream) return resolveEnd();
        stream.end(() => resolveEnd());
      })).then(async () => {
        // Size check against what the viewer declared for this file. A short
        // file is removed and the job fails loudly instead of saying Done.
        if (expected > 0 && seen !== expected && pushJobs.has(job.jobId)) {
          await fs.unlink(path).catch(() => {});
          abortPushJob(job.jobId, `${basename(path)} arrived incomplete (${seen} of ${expected} bytes). Ask the sender to try again.`, deps);
          return;
        }
        // Complete: it is no longer a partial a resume may overwrite.
        for (const [key, value] of partialPushTargets) {
          if (value === path) partialPushTargets.delete(key);
        }
      });
      return true;
    }

    case 'ft:push-end': {
      const job = pushJobs.get(String(event.jobId || ''));
      if (!job) return true;
      // Everything queued must be flushed before we claim the job is done.
      void job.writeChain.then(() => {
        if (job.idleTimer) clearTimeout(job.idleTimer);
        // A size check that failed while flushing aborts the job, which
        // removes it from the map. Check BEFORE deleting: the order used to
        // be reversed, so every push returned here and the viewer never got
        // ft:push-done — each send sat on "Finishing…" and then "Stalled".
        if (!pushJobs.has(job.jobId)) return;
        pushJobs.delete(job.jobId);
        send(channel, {
          type: 'ft:push-done',
          jobId: job.jobId,
          destDir: job.destDir,
          fileCount: job.filesDone,
          totalBytes: job.receivedBytes,
          renamed: job.renamed,
        });
        deps.log.info(`[FileTransfer] Push ${job.jobId} complete: ${job.filesDone} file(s) -> ${job.destDir}`);
        deps.notify?.(
          'Files received',
          job.filesDone === 1
            ? `${job.firstName || basename(job.currentPath) || '1 file'} was saved to ${basename(job.destDir)}. Click to open the folder.`
            : `${job.filesDone} files were saved to ${basename(job.destDir)}. Click to open the folder.`,
          job.destDir,
        );
      });
      return true;
    }

    default:
      // An unknown ft: message is still ours — swallow it rather than let it
      // fall through to the input handler.
      return true;
  }
}

/**
 * Handle a binary frame. Returns true when the frame belonged to this module.
 */
export function handleFileTransferChunk(
  header: any,
  chunk: Buffer,
  channel: TransferChannel,
  deps: FileTransferDeps,
): boolean {
  if (header?.type !== 'ft:push-chunk') return false;
  const job = pushJobs.get(String(header.jobId || ''));
  if (!job) return true; // late chunk from a cancelled job
  armIdleTimer(job, deps);
  if (job.receivedBytes === 0) {
    deps.log.info(`[FileTransfer] Push ${job.jobId}: first chunk received (${chunk.length} bytes)`);
  }
  queueWrite(job, chunk);
  job.receivedBytes += chunk.length;
  job.currentFileBytes += chunk.length;
  const now = Date.now();
  if (now - job.lastProgressAt >= PROGRESS_INTERVAL_MS) {
    job.lastProgressAt = now;
    send(channel, {
      type: 'ft:push-progress',
      jobId: job.jobId,
      index: job.index,
      receivedBytes: job.receivedBytes,
      totalBytes: job.totalBytes,
    });
  }
  return true;
}

/** Tear everything down when a session ends. */
export function cancelAllFileTransfers(): void {
  for (const job of pullJobs.values()) job.cancelled = true;
  pullJobs.clear();
  for (const job of pushJobs.values()) {
    if (job.idleTimer) clearTimeout(job.idleTimer);
    try { job.stream?.destroy(); } catch { /* already gone */ }
  }
  pushJobs.clear();
}
