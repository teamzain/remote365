/**
 * "Send files" / "Get files" for the web viewer, over the host's protocol-v1
 * file messages on the `control` data channel (the browser has no disk
 * access for the desktop's streamed v2 transfers):
 *
 *   send:  binary frames [u32 LE header length][JSON header][bytes] with
 *          header { type:'file-chunk', transferId, name, totalSize,
 *          chunkIndex, totalChunks }. The host answers per file with
 *          'file-transfer-progress' (direction 'send'), 'file-sent' or
 *          'file-transfer-error'. A file is only "Done" once the host says
 *          it is saved — the old code showed 100% the moment the browser
 *          had queued the bytes, even when the host dropped them.
 *   get:   {type:'ft:host-pick'} makes the host open its own file picker on
 *          its screen. Chosen files arrive as 'file-transfer-start' + the
 *          same binary frames, and are handed to the browser as a download.
 *   limit: the host announces this viewer's per-file plan cap with
 *          {type:'file-transfer-limit', maxBytes} when the channel opens
 *          (desktop >= 1.2.139). An oversized file is refused here before a
 *          byte moves; the host enforces the same cap either way.
 *   cancel: {type:'file-transfer-cancel', transferId, direction}. Sending
 *          stops here at once and the host deletes its partial copy; a
 *          download stops being collected here and the host stops sending
 *          (desktop >= 1.2.142 — an older host ignores the message and sends
 *          the rest, which is dropped on arrival).
 */

/** "500 MB" / "2 GB", the way the desktop app words the plan cap. */
export const describeFileLimit = (bytes: number): string => bytes >= 1024 ** 3
  ? `${Math.round(bytes / 1024 ** 3)} GB`
  : `${Math.round(bytes / 1024 ** 2)} MB`;

export type WebTransferState = 'waiting' | 'active' | 'done' | 'error' | 'cancelled';

export type WebTransfer = {
  id: string;
  direction: 'send' | 'receive';
  name: string;
  totalBytes: number;
  transferredBytes: number;
  state: WebTransferState;
  message: string;
  /** Placeholder while the host's picker is open ("Get files"). */
  hostPick?: boolean;
  startedAt: number;
};

type Listener = (transfers: WebTransfer[]) => void;

const CHUNK_SIZE = 64 * 1024;
const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;
const HOST_CONFIRM_TIMEOUT_MS = 60_000;

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Receive side: chunks collect in `parts` and are folded into a Blob every
// FOLD_BYTES, so a large file ends up in the browser's blob store (which can
// spill to disk) instead of sitting in the JS heap until the last chunk.
const FOLD_BYTES = 8 * 1024 * 1024;
// A card update per chunk re-rendered the whole viewer hundreds of times a
// second during a transfer; the progress bar needs a few a second.
const PROGRESS_INTERVAL_MS = 150;

type Incoming = {
  id: string; name: string; totalSize: number; totalChunks: number;
  blobs: Blob[]; parts: Uint8Array[]; partBytes: number;
  received: number; bytes: number; lastEmitAt: number;
  /** Next chunkIndex expected; anything lower has already been stored. */
  nextIndex: number;
};

const newIncoming = (id: string, name: string, totalSize: number, totalChunks: number): Incoming =>
  ({ id, name, totalSize, totalChunks, blobs: [], parts: [], partBytes: 0, received: 0, bytes: 0, lastEmitAt: 0, nextIndex: 0 });

export class WebFileTransfer {
  private transfers = new Map<string, WebTransfer>();
  private incoming = new Map<string, Incoming>();
  private hostWaiters = new Map<string, { resolve: (ok: boolean, message?: string) => void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Set<Listener>();
  /** Downloads the viewer cancelled: chunks still on their way are dropped. */
  private cancelledIncoming = new Set<string>();
  /** Per-file cap the host announced for this viewer; null until it does. */
  private maxFileBytes: number | null = null;

  constructor(
    private getChannel: () => RTCDataChannel | null,
    private onLimit?: (maxBytes: number | null) => void,
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.list());
    return () => { this.listeners.delete(listener); };
  }

  list(): WebTransfer[] {
    return [...this.transfers.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  dismiss(id: string): void {
    const t = this.transfers.get(id);
    if (!t || t.state === 'active' || t.state === 'waiting') return;
    this.transfers.delete(id);
    this.emit();
  }

  /** Stop a transfer that is waiting or running. Finished ones are dismissed instead. */
  cancel(id: string): void {
    const t = this.transfers.get(id);
    if (!t || (t.state !== 'active' && t.state !== 'waiting')) return;
    if (t.hostPick) {
      // Only the placeholder: the picker on the remote screen is closed there.
      this.transfers.delete(id);
      this.emit();
      return;
    }
    const wasActive = t.state === 'active';
    if (t.direction === 'receive') {
      this.incoming.delete(id);
      this.cancelledIncoming.add(id);
    } else {
      const waiter = this.hostWaiters.get(id);
      if (waiter) { clearTimeout(waiter.timer); this.hostWaiters.delete(id); waiter.resolve(false); }
    }
    // A queued upload has sent nothing, so there is nothing to tell the host.
    if (wasActive) {
      const channel = this.getChannel();
      if (channel?.readyState === 'open') {
        try { channel.send(JSON.stringify({ type: 'file-transfer-cancel', transferId: id, direction: t.direction })); } catch { /* closing */ }
      }
    }
    this.upsert(id, { state: 'cancelled', message: '' });
  }

  private isCancelled(id: string): boolean {
    return this.transfers.get(id)?.state === 'cancelled';
  }

  private emit(): void {
    const snapshot = this.list();
    for (const listener of this.listeners) listener(snapshot);
  }

  private upsert(id: string, patch: Partial<WebTransfer>): void {
    const existing = this.transfers.get(id);
    this.transfers.set(id, existing
      ? { ...existing, ...patch }
      : { id, direction: 'send', name: '', totalBytes: 0, transferredBytes: 0, state: 'waiting', message: '', startedAt: Date.now(), ...patch });
    this.emit();
  }

  private async drain(channel: RTCDataChannel): Promise<void> {
    if (channel.bufferedAmount <= HIGH_WATER) return;
    channel.bufferedAmountLowThreshold = LOW_WATER;
    await new Promise<void>((resolve) => {
      const done = () => { channel.removeEventListener('bufferedamountlow', done); clearTimeout(timer); resolve(); };
      const timer = setTimeout(done, 4000);
      channel.addEventListener('bufferedamountlow', done);
    });
  }

  /* ---------------- send (browser -> host) ---------------- */

  async sendFiles(files: File[]): Promise<void> {
    const limit = this.maxFileBytes;
    const queued: Array<{ id: string; file: File }> = [];
    for (const file of files) {
      const id = newId('w');
      if (limit !== null && file.size > limit) {
        this.upsert(id, {
          direction: 'send', name: file.name, totalBytes: file.size, state: 'error',
          message: `${file.name} is over your plan's ${describeFileLimit(limit)} per-file limit and was not sent.`,
        });
        continue;
      }
      this.upsert(id, { direction: 'send', name: file.name, totalBytes: file.size, state: 'waiting', message: 'Waiting…' });
      queued.push({ id, file });
    }
    // One at a time: the host writes v1 files sequentially per channel.
    for (const { id, file } of queued) {
      if (this.isCancelled(id)) continue;
      await this.sendOne(id, file);
    }
  }

  private async sendOne(id: string, file: File): Promise<void> {
    const channel = this.getChannel();
    if (!channel || channel.readyState !== 'open') {
      this.upsert(id, { state: 'error', message: 'Not connected to the remote computer.' });
      return;
    }
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    this.upsert(id, { state: 'active', message: '' });
    const confirmed = new Promise<{ ok: boolean; message?: string }>((resolve) => {
      const timer = setTimeout(() => {
        this.hostWaiters.delete(id);
        resolve({ ok: false, message: 'The remote computer did not confirm the file. It may not have been saved.' });
      }, HOST_CONFIRM_TIMEOUT_MS + totalChunks * 50);
      this.hostWaiters.set(id, { resolve: (ok, message) => resolve({ ok, message }), timer });
    });
    // The host can refuse mid-stream (over the limit, disk error): stop
    // uploading the rest of a file it has already turned down.
    const host = { refused: false };
    void confirmed.then((result) => { if (!result.ok) host.refused = true; });
    try {
      const encoder = new TextEncoder();
      for (let i = 0; i < totalChunks; i++) {
        if (host.refused || this.isCancelled(id)) break;
        const live = this.getChannel();
        if (!live || live.readyState !== 'open') throw new Error('The connection dropped while sending.');
        const start = i * CHUNK_SIZE;
        const bytes = new Uint8Array(await file.slice(start, Math.min(start + CHUNK_SIZE, file.size)).arrayBuffer());
        const header = encoder.encode(JSON.stringify({ type: 'file-chunk', transferId: id, name: file.name, totalSize: file.size, chunkIndex: i, totalChunks }));
        const frame = new Uint8Array(4 + header.length + bytes.length);
        new DataView(frame.buffer).setUint32(0, header.length, true);
        frame.set(header, 4);
        frame.set(bytes, 4 + header.length);
        await this.drain(live);
        if (this.isCancelled(id)) break;
        live.send(frame);
      }
    } catch (err: any) {
      const waiter = this.hostWaiters.get(id);
      if (waiter) { clearTimeout(waiter.timer); this.hostWaiters.delete(id); }
      if (!this.isCancelled(id)) this.upsert(id, { state: 'error', message: err?.message || 'Sending failed.' });
      return;
    }
    if (this.isCancelled(id)) return;
    if (!host.refused) this.upsert(id, { message: 'Waiting for the remote computer to save it…' });
    const result = await confirmed;
    if (this.isCancelled(id)) return;
    this.upsert(id, result.ok
      ? { state: 'done', transferredBytes: file.size, message: '' }
      : { state: 'error', message: result.message || 'The remote computer could not save the file.' });
  }

  /* ---------------- get (host -> browser) ---------------- */

  requestHostPick(deviceName: string): void {
    for (const t of this.transfers.values()) if (t.hostPick && t.state === 'waiting') return;
    const channel = this.getChannel();
    if (!channel || channel.readyState !== 'open') return;
    const reqId = newId('p');
    this.upsert(reqId, {
      direction: 'receive', name: 'Choose files', hostPick: true, state: 'waiting',
      message: `A file picker opened on ${deviceName}'s screen. Choose the files there.`,
    });
    channel.send(JSON.stringify({ type: 'ft:host-pick', reqId }));
  }

  private clearPickPlaceholders(): void {
    let changed = false;
    for (const [id, t] of this.transfers) {
      if (t.hostPick && t.state === 'waiting') { this.transfers.delete(id); changed = true; }
    }
    if (changed) this.emit();
  }

  /** Feed every JSON message from the control channel. True = consumed. */
  handleJson(data: any): boolean {
    switch (data?.type) {
      case 'file-transfer-limit': {
        const bytes = Number(data.maxBytes);
        this.maxFileBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : null;
        this.onLimit?.(this.maxFileBytes);
        return true;
      }
      case 'ft:host-pick-result': {
        const placeholder = this.transfers.get(String(data.reqId || ''));
        if (!placeholder || data.chosen) return true;
        if (data.error) this.upsert(placeholder.id, { state: 'error', message: String(data.error) });
        else { this.transfers.delete(placeholder.id); this.emit(); }
        return true;
      }
      case 'file-transfer-start': {
        if (data.direction !== 'receive') return true;
        this.clearPickPlaceholders();
        const id = String(data.transferId || newId('r'));
        this.incoming.set(id, newIncoming(id, String(data.name || 'file'), Number(data.totalSize) || 0, Number(data.totalChunks) || 0));
        this.upsert(id, { direction: 'receive', name: String(data.name || 'file'), totalBytes: Number(data.totalSize) || 0, state: 'active', message: '' });
        return true;
      }
      case 'file-transfer-progress': {
        if (data.direction === 'send' && this.transfers.has(String(data.transferId))) {
          this.upsert(String(data.transferId), { transferredBytes: Number(data.transferredBytes) || 0 });
        }
        return true;
      }
      case 'file-sent': {
        const waiter = this.hostWaiters.get(String(data.transferId || ''));
        if (waiter) { clearTimeout(waiter.timer); this.hostWaiters.delete(String(data.transferId)); waiter.resolve(true); }
        return true;
      }
      case 'file-transfer-error': {
        const id = String(data.transferId || '');
        if (this.isCancelled(id)) return true;
        const waiter = this.hostWaiters.get(id);
        if (waiter) { clearTimeout(waiter.timer); this.hostWaiters.delete(id); waiter.resolve(false, data.message); return true; }
        if (this.incoming.has(id)) { this.incoming.delete(id); this.upsert(id, { state: 'error', message: String(data.message || 'The remote computer could not send the file.') }); }
        else if (data.message) {
          // A refusal with no transfer (e.g. file transfer is turned off there).
          this.clearPickPlaceholders();
          this.upsert(newId('e'), { direction: 'receive', name: 'File transfer', state: 'error', message: String(data.message) });
        }
        return true;
      }
      case 'file-transfer-cancelled': {
        this.clearPickPlaceholders();
        // The host confirming a cancel, or stopping a send of its own accord.
        const id = String(data.transferId || '');
        const t = id ? this.transfers.get(id) : undefined;
        if (t && (t.state === 'active' || t.state === 'waiting')) {
          this.incoming.delete(id);
          this.cancelledIncoming.add(id);
          this.upsert(id, { state: 'cancelled', message: '' });
        }
        return true;
      }
      default:
        return false;
    }
  }

  /** Feed binary frames from the control channel. True = it was a file chunk. */
  handleBinary(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 4) return false;
    const headerLength = new DataView(buffer).getUint32(0, true);
    if (headerLength <= 0 || 4 + headerLength > buffer.byteLength) return false;
    let header: any;
    try { header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength))); } catch { return false; }
    if (header?.type !== 'file-chunk') return false;
    const id = String(header.transferId || '');
    if (this.cancelledIncoming.has(id)) return true;
    let job = this.incoming.get(id);
    if (!job) {
      // Chunks without a start message (older host): start the job here.
      job = newIncoming(id, String(header.name || 'file'), Number(header.totalSize) || 0, Number(header.totalChunks) || 0);
      this.incoming.set(id, job);
      this.clearPickPlaceholders();
    }
    // Hosts 1.2.139-1.2.141 re-sent a chunk whenever the channel queued it,
    // so the same chunk could arrive several times on a slow link. The channel
    // is ordered: an index already passed is a repeat, not new data.
    const chunkIndex = Number(header.chunkIndex);
    if (Number.isInteger(chunkIndex)) {
      if (chunkIndex < job.nextIndex) return true;
      job.nextIndex = chunkIndex + 1;
    }
    // A view, not a copy: every message arrives in its own ArrayBuffer.
    const chunk = new Uint8Array(buffer, 4 + headerLength);
    job.parts.push(chunk);
    job.partBytes += chunk.length;
    job.bytes += chunk.length;
    job.received++;
    if (job.partBytes >= FOLD_BYTES) {
      job.blobs.push(new Blob(job.parts as BlobPart[]));
      job.parts = [];
      job.partBytes = 0;
    }
    const finished = Boolean(job.totalChunks) && job.received >= job.totalChunks;
    const now = Date.now();
    if (!finished && now - job.lastEmitAt >= PROGRESS_INTERVAL_MS) {
      job.lastEmitAt = now;
      this.upsert(id, { direction: 'receive', name: job.name, totalBytes: job.totalSize, transferredBytes: job.bytes, state: 'active', message: '' });
    }
    if (finished) {
      this.incoming.delete(id);
      this.saveDownload(job);
      this.upsert(id, { direction: 'receive', name: job.name, totalBytes: job.totalSize, transferredBytes: job.bytes, state: 'done', message: '' });
    }
    return true;
  }

  private saveDownload(job: Incoming): void {
    const url = URL.createObjectURL(new Blob([...job.blobs, ...job.parts] as BlobPart[]));
    const link = document.createElement('a');
    link.href = url;
    link.download = job.name.replace(/[\\/]/g, '_') || 'file';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  dispose(): void {
    for (const waiter of this.hostWaiters.values()) clearTimeout(waiter.timer);
    this.hostWaiters.clear();
    this.incoming.clear();
    this.cancelledIncoming.clear();
    this.transfers.clear();
    this.listeners.clear();
  }
}
