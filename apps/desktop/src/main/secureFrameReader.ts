/** One response on the secure capture pipe: uint32 length + tightly packed BGRA.
 * Copy each chunk once into an exact-sized frame rather than repeatedly joining
 * an ever-growing accumulator (quadratic copying for multi-megabyte frames). */
export class SecureFrameReader {
  private readonly header = Buffer.alloc(4);
  private headerBytes = 0;
  private payload: Buffer | null = null;
  private payloadBytes = 0;
  private complete = false;

  constructor(private readonly expectedBytes: number) {}

  push(chunk: Buffer): Buffer | null | undefined {
    if (this.complete) throw new Error('Unexpected data after capture response');
    let offset = 0;
    if (this.headerBytes < 4) {
      const bytes = Math.min(4 - this.headerBytes, chunk.length);
      chunk.copy(this.header, this.headerBytes, 0, bytes);
      this.headerBytes += bytes;
      offset += bytes;
      if (this.headerBytes < 4) return undefined;
      const length = this.header.readUInt32LE(0);
      if (length === 0) {
        if (offset !== chunk.length) throw new Error('Unexpected data after empty capture');
        this.complete = true;
        return null;
      }
      if (length !== this.expectedBytes) throw new Error(`Capture size ${length} differs from ${this.expectedBytes}`);
      this.payload = Buffer.allocUnsafe(length);
    }
    const frame = this.payload!;
    const available = chunk.length - offset;
    if (available > frame.length - this.payloadBytes) throw new Error('Capture response exceeds frame size');
    chunk.copy(frame, this.payloadBytes, offset);
    this.payloadBytes += available;
    if (this.payloadBytes !== frame.length) return undefined;
    this.complete = true;
    this.payload = null;
    return frame;
  }
}
