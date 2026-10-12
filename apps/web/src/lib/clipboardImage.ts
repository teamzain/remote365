// Clipboard IMAGES between host and viewer (a Snipping Tool capture, Print
// Screen, a copied picture). Clipboard sync used to be plain text only, so a
// snip taken on one machine simply was not there to paste on the other.
//
// An image is sent as PNG, base64, in ordered chunks on the control channel:
//   { type: 'clipboard-image-chunk', id, origin, chunkIndex, totalChunks, data }
// Pure helpers only, so both ends (main process for the host, renderer for the
// viewer) share one tested implementation of the splitting and reassembly.

/** Largest PNG that is synced. A full 4K snip is 2-6 MB; beyond this it is a
 *  file, and file transfer is the right tool. */
export const CLIPBOARD_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
/** Base64 characters per message: far below the data channel's message limit. */
export const CLIPBOARD_IMAGE_CHUNK_CHARS = 48 * 1024;
const MAX_CHUNKS = Math.ceil((CLIPBOARD_IMAGE_MAX_BYTES * 4 / 3) / CLIPBOARD_IMAGE_CHUNK_CHARS) + 2;
const STALE_MS = 120_000;

export interface ClipboardImageChunk {
  type: 'clipboard-image-chunk';
  id: string;
  origin: string;
  chunkIndex: number;
  totalChunks: number;
  data: string;
}

/** Split a base64 PNG into the messages to send. Empty when it is too large. */
export function splitClipboardImage(pngBase64: string, id: string, origin: string): ClipboardImageChunk[] {
  const value = String(pngBase64 || '');
  if (!value || value.length > CLIPBOARD_IMAGE_MAX_BYTES * 4 / 3 + 4) return [];
  const totalChunks = Math.ceil(value.length / CLIPBOARD_IMAGE_CHUNK_CHARS);
  const chunks: ClipboardImageChunk[] = [];
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    chunks.push({
      type: 'clipboard-image-chunk', id, origin, chunkIndex, totalChunks,
      data: value.slice(chunkIndex * CLIPBOARD_IMAGE_CHUNK_CHARS, (chunkIndex + 1) * CLIPBOARD_IMAGE_CHUNK_CHARS),
    });
  }
  return chunks;
}

interface Pending { chunks: string[]; received: number; total: number; origin: string; startedAt: number }

/** Collects chunks; returns the whole base64 PNG when the last one arrives. */
export function createClipboardImageAssembler() {
  const pending = new Map<string, Pending>();
  return {
    add(message: Partial<Record<keyof ClipboardImageChunk, unknown>> | null | undefined, now: number): { pngBase64: string; origin: string } | null {
      const id = String(message?.id || '');
      const total = Number(message?.totalChunks);
      const index = Number(message?.chunkIndex);
      const data = typeof message?.data === 'string' ? message.data : '';
      if (!id || !Number.isInteger(total) || total <= 0 || total > MAX_CHUNKS) return null;
      if (!Number.isInteger(index) || index < 0 || index >= total) return null;
      if (!data || data.length > CLIPBOARD_IMAGE_CHUNK_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
      let entry = pending.get(id);
      if (!entry) {
        // Forget images a peer never finished, and never hold more than a few.
        for (const [key, value] of pending) if (now - value.startedAt > STALE_MS) pending.delete(key);
        if (pending.size >= 4) pending.delete(pending.keys().next().value as string);
        entry = { chunks: new Array(total).fill(''), received: 0, total, origin: String(message?.origin || 'remote'), startedAt: now };
        pending.set(id, entry);
      }
      if (entry.total !== total) return null;
      if (!entry.chunks[index]) { entry.chunks[index] = data; entry.received++; }
      if (entry.received < entry.total) return null;
      pending.delete(id);
      return { pngBase64: entry.chunks.join(''), origin: entry.origin };
    },
    get size() { return pending.size; },
  };
}
