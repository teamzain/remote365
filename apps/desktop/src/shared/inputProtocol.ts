/**
 * Compact desktop input protocol.
 *
 * File-transfer binary messages already use the data channels, so input packets
 * carry a three-byte magic before their type. Unknown events deliberately fall
 * back to JSON, keeping mixed-version desktop and web sessions compatible.
 */
const MAGIC_0 = 0x52; // R
const MAGIC_1 = 0x33; // 3
const MAGIC_2 = 0x49; // I

const enum InputPacketType {
  MouseMove = 1,
  MouseDown = 2,
  MouseUp = 3,
  Wheel = 4,
  KeyDown = 5,
  KeyUp = 6,
}

function putPoint(view: DataView, offset: number, value: unknown) {
  const numeric = Number(value);
  view.setFloat32(offset, Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0, true);
}

export function encodeCompactInput(event: any): Uint8Array | null {
  if (!event || typeof event !== 'object') return null;
  let type = 0;
  let size = 0;
  switch (event.type) {
    case 'mousemove': type = InputPacketType.MouseMove; size = 13; break;
    case 'mousedown': type = InputPacketType.MouseDown; size = 17; break;
    case 'mouseup': type = InputPacketType.MouseUp; size = 17; break;
    case 'wheel': type = InputPacketType.Wheel; size = 20; break;
    case 'keydown': type = InputPacketType.KeyDown; size = 7; break;
    case 'keyup': type = InputPacketType.KeyUp; size = 7; break;
    default: return null;
  }

  const packet = new Uint8Array(size);
  packet[0] = MAGIC_0;
  packet[1] = MAGIC_1;
  packet[2] = MAGIC_2;
  packet[3] = type;
  const view = new DataView(packet.buffer);

  if (type === InputPacketType.MouseMove || type === InputPacketType.MouseDown || type === InputPacketType.MouseUp) {
    putPoint(view, 4, event.x);
    putPoint(view, 8, event.y);
    packet[12] = Number(event.button) & 0xff;
    if (type !== InputPacketType.MouseMove) view.setUint32(13, Number(event.seq) >>> 0, true);
  } else if (type === InputPacketType.Wheel) {
    view.setFloat32(4, Number(event.deltaX) || 0, true);
    view.setFloat32(8, Number(event.deltaY) || 0, true);
    putPoint(view, 12, event.x);
    putPoint(view, 16, event.y);
  } else {
    view.setUint16(4, Number(event.keyCode) & 0xffff, true);
    packet[6] =
      (event.shiftKey ? 1 : 0) |
      (event.ctrlKey ? 2 : 0) |
      (event.altKey ? 4 : 0) |
      (event.metaKey ? 8 : 0) |
      (event.capsLock ? 16 : 0) |
      (event.repeat ? 32 : 0);
  }
  return packet;
}

export function isCompactInput(data: Uint8Array): boolean {
  return data.byteLength >= 4 &&
    data[0] === MAGIC_0 &&
    data[1] === MAGIC_1 &&
    data[2] === MAGIC_2 &&
    data[3] >= InputPacketType.MouseMove &&
    data[3] <= InputPacketType.KeyUp;
}

export function decodeCompactInput(data: Uint8Array): any | null {
  if (!isCompactInput(data)) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const type = data[3] as InputPacketType;

  if (type === InputPacketType.MouseMove && data.byteLength === 13) {
    return { type: 'mousemove', x: view.getFloat32(4, true), y: view.getFloat32(8, true), button: data[12] };
  }
  if ((type === InputPacketType.MouseDown || type === InputPacketType.MouseUp) && data.byteLength === 17) {
    return {
      type: type === InputPacketType.MouseDown ? 'mousedown' : 'mouseup',
      x: view.getFloat32(4, true),
      y: view.getFloat32(8, true),
      button: data[12],
      seq: view.getUint32(13, true),
    };
  }
  if (type === InputPacketType.Wheel && data.byteLength === 20) {
    return {
      type: 'wheel',
      deltaX: view.getFloat32(4, true),
      deltaY: view.getFloat32(8, true),
      x: view.getFloat32(12, true),
      y: view.getFloat32(16, true),
    };
  }
  if ((type === InputPacketType.KeyDown || type === InputPacketType.KeyUp) && data.byteLength === 7) {
    const flags = data[6];
    return {
      type: type === InputPacketType.KeyDown ? 'keydown' : 'keyup',
      keyCode: view.getUint16(4, true),
      shiftKey: Boolean(flags & 1),
      ctrlKey: Boolean(flags & 2),
      altKey: Boolean(flags & 4),
      metaKey: Boolean(flags & 8),
      capsLock: Boolean(flags & 16),
      repeat: Boolean(flags & 32),
    };
  }
  return null;
}
