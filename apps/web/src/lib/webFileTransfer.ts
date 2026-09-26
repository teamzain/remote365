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
 */

export type WebTransferState = 'waiting' | 'active' | 'done' | 'error';

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

type Incoming = { id: string; name: string; totalSize: number; totalChunks: number; parts: Uint8Array[]; received: number };

export class WebFileTransfer {
  private transfers = new Map<string, WebTransfer>();
  private incoming = new Map<string, Incoming>();
  private hostWaiters = new Map<string, { resolve: (ok: boolean, message?: string) => void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Set<Listener>();

  constructor(private getChannel: () => RTCDataChannel | null) {}

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
    const queued = files.map((file) => {
      const id = newId('w');
      this.upsert(id, { direction: 'send', name: file.name, totalBytes: file.size, state: 'waiting', message: 'Waiting…' });
      return { id, file };
    });
    // One at a time: the host writes v1 files sequentially per channel.
    for (const { id, file } of queued) await this.sendOne(id, file);
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
    try {
      const encoder = new TextEncoder();
      for (let i = 0; i < totalChunks; i++) {
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
        live.send(frame);
      }
    } catch (err: any) {
      const waiter = this.hostWaiters.get(id);
      if (waiter) { clearTimeout(waiter.timer); this.hostWaiters.delete(id); }
      this.upsert(id, { state: 'error', message: err?.message || 'Sending failed.' });
      return;
    }
    this.upsert(id, { message: 'Waiting for the remote computer to save it…' });
    const result = await confirmed;
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
        this.incoming.set(id, { id, name: String(data.name || 'file'), totalSize: Number(data.totalSize) || 0, totalChunks: Number(data.totalChunks) || 0, parts: [], received: 0 });
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
      case 'file-transfer-cancelled':
        this.clearPickPlaceholders();
        return true;
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
    let job = this.incoming.get(id);
    if (!job) {
      // Chunks without a start message (older host): start the job here.
      job = { id, name: String(header.name || 'file'), totalSize: Number(header.totalSize) || 0, totalChunks: Number(header.totalChunks) || 0, parts: [], received: 0 };
      this.incoming.set(id, job);
      this.clearPickPlaceholders();
    }
    job.parts.push(new Uint8Array(buffer.slice(4 + headerLength)));
    job.received++;
    const bytes = job.parts.reduce((sum, part) => sum + part.length, 0);
    this.upsert(id, { direction: 'receive', name: job.name, totalBytes: job.totalSize, transferredBytes: bytes, state: 'active', message: '' });
    if (job.totalChunks && job.received >= job.totalChunks) {
      this.incoming.delete(id);
      this.saveDownload(job);
      this.upsert(id, { state: 'done', transferredBytes: bytes, message: '' });
    }
    return true;
  }

  private saveDownload(job: Incoming): void {
    const url = URL.createObjectURL(new Blob(job.parts as BlobPart[]));
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
    this.transfers.clear();
    this.listeners.clear();
  }
}
