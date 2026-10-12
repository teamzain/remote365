import assert from 'node:assert/strict';
import test from 'node:test';
import { CLIPBOARD_IMAGE_CHUNK_CHARS, CLIPBOARD_IMAGE_MAX_BYTES, createClipboardImageAssembler, splitClipboardImage } from './clipboardImage.ts';

const b64 = (bytes) => Buffer.alloc(bytes, 7).toString('base64');

test('a snip survives the round trip, in any arrival order', () => {
  const image = Buffer.from(Array.from({ length: 300_000 }, (_, i) => (i * 31) % 251)).toString('base64');
  const chunks = splitClipboardImage(image, 'a1', 'host');
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.data.length <= CLIPBOARD_IMAGE_CHUNK_CHARS && c.totalChunks === chunks.length));
  const asm = createClipboardImageAssembler();
  let done = null;
  for (const c of [...chunks].reverse()) done = asm.add(JSON.parse(JSON.stringify(c)), 1000) || done;
  assert.equal(done.pngBase64, image);
  assert.equal(done.origin, 'host');
  assert.equal(asm.size, 0);
});

test('a repeated chunk does not complete or corrupt the image', () => {
  const chunks = splitClipboardImage(b64(120_000), 'a2', 'desktop');
  const asm = createClipboardImageAssembler();
  assert.equal(asm.add(chunks[0], 1), null);
  assert.equal(asm.add(chunks[0], 2), null);
  let done = null;
  for (const c of chunks.slice(1)) done = asm.add(c, 3) || done;
  assert.equal(done.pngBase64, chunks.map((c) => c.data).join(''));
});

test('an oversized image is not sent at all', () => {
  assert.deepEqual(splitClipboardImage(b64(CLIPBOARD_IMAGE_MAX_BYTES + 100_000), 'big', 'host'), []);
  assert.deepEqual(splitClipboardImage('', 'empty', 'host'), []);
});

test('malformed or hostile chunks are ignored', () => {
  const asm = createClipboardImageAssembler();
  const ok = { type: 'clipboard-image-chunk', id: 'x', origin: 'host', chunkIndex: 0, totalChunks: 2, data: 'AAAA' };
  assert.equal(asm.add({ ...ok, totalChunks: 10_000_000 }, 1), null);
  assert.equal(asm.add({ ...ok, chunkIndex: 5 }, 1), null);
  assert.equal(asm.add({ ...ok, chunkIndex: -1 }, 1), null);
  assert.equal(asm.add({ ...ok, data: '<script>' }, 1), null);
  assert.equal(asm.add({ ...ok, data: 'A'.repeat(CLIPBOARD_IMAGE_CHUNK_CHARS + 1) }, 1), null);
  assert.equal(asm.add({ ...ok, id: '' }, 1), null);
  assert.equal(asm.add(null, 1), null);
  assert.equal(asm.size, 0);
});

test('unfinished images do not pile up', () => {
  const asm = createClipboardImageAssembler();
  for (let i = 0; i < 20; i++) asm.add({ type: 'clipboard-image-chunk', id: `p${i}`, origin: 'host', chunkIndex: 0, totalChunks: 3, data: 'AAAA' }, i);
  assert.ok(asm.size <= 4);
  asm.add({ type: 'clipboard-image-chunk', id: 'late', origin: 'host', chunkIndex: 0, totalChunks: 3, data: 'AAAA' }, 10 * 60 * 1000);
  assert.equal(asm.size, 1);
});
