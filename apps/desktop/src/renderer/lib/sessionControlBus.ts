/**
 * A tiny pub/sub for control-channel traffic.
 *
 * The session's RTCDataChannel is owned by App.tsx, but the features that care
 * about individual message families (the file manager, the camera) live in
 * their own components. Rather than growing App's already-large message
 * handler by a branch per feature, App forwards everything here and features
 * subscribe.
 *
 * Handlers return true to claim a message. App stops processing a claimed
 * message, so a subscriber must only claim what it genuinely owns — returning
 * true for anything else silently breaks unrelated session features.
 */

type JsonHandler = (data: any) => boolean;
type ChunkHandler = (header: any, chunk: Uint8Array) => boolean;

const jsonHandlers = new Set<JsonHandler>();
const chunkHandlers = new Set<ChunkHandler>();

export function subscribeControlJson(handler: JsonHandler): () => void {
  jsonHandlers.add(handler);
  return () => { jsonHandlers.delete(handler); };
}

export function subscribeControlChunk(handler: ChunkHandler): () => void {
  chunkHandlers.add(handler);
  return () => { chunkHandlers.delete(handler); };
}

export function dispatchControlJson(data: any): boolean {
  for (const handler of jsonHandlers) {
    try {
      if (handler(data)) return true;
    } catch {
      // A throwing subscriber must not take the session's message loop with it.
    }
  }
  return false;
}

export function dispatchControlChunk(header: any, chunk: Uint8Array): boolean {
  for (const handler of chunkHandlers) {
    try {
      if (handler(header, chunk)) return true;
    } catch {
      // As above — keep the loop alive.
    }
  }
  return false;
}

/**
 * The dedicated file-transfer channel, when the host offered one. Bulk file
 * bytes and their progress/acks ride here so they never contend with input,
 * chat or the camera on the control channel. Registered by App when the
 * channel arrives; consumers must fall back to the control channel when this
 * is null (older hosts never create it).
 */
let sessionFileChannel: RTCDataChannel | null = null;

export function setSessionFileChannel(channel: RTCDataChannel | null): void {
  sessionFileChannel = channel;
}

export function getSessionFileChannel(): RTCDataChannel | null {
  return sessionFileChannel && sessionFileChannel.readyState === 'open' ? sessionFileChannel : null;
}
