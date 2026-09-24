/** Unchanged pixels need only a heartbeat when an IDR can be requested on demand.
 * Legacy encoders retain their shorter cadence so periodic IDRs arrive promptly. */
export function staticFrameInterval(onDemand: boolean, override?: string): number {
  const configured = Number(override);
  return override?.trim() && Number.isFinite(configured) && configured >= 50 && configured <= 1000
    ? configured : onDemand ? 500 : 100;
}

export function shouldWriteFrame(writes: number, changed: boolean, keyframe: boolean, elapsedMs: number, heartbeatMs: number): boolean {
  return writes < 2 || changed || keyframe || elapsedMs >= heartbeatMs;
}

/** Allocate only what capture actually needs. Never reuse a frame while the pipe
 * or encoder still owns its bytes, or while it is the last unchanged image. */
export class RawFramePool {
  private readonly buffers: Buffer[] = [];
  constructor(private readonly bytes: number, seed?: Buffer | null) {
    if (seed?.length === bytes) this.buffers.push(seed);
  }

  acquire(lastFrame: Buffer | null, inFlight: ReadonlySet<Buffer>): Buffer | undefined {
    const reusable = this.buffers.find(buffer => buffer !== lastFrame && !inFlight.has(buffer));
    if (reusable) return reusable;
    if (this.bytes <= 0 || this.buffers.length >= 3) return undefined;
    const buffer = Buffer.allocUnsafe(this.bytes);
    this.buffers.push(buffer);
    return buffer;
  }
}
