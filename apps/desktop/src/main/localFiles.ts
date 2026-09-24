/**
 * Local-disk IPC for the file manager, viewer side.
 *
 * The viewer runs in the renderer, so every byte it sends or receives has to
 * cross an IPC boundary. The shape of these handlers is what keeps a transfer
 * from being a memory event:
 *
 *  - readChunk() hands back a block at an offset instead of a whole file. The
 *    old path called files:read-local-file and materialised the entire file as
 *    one array in the renderer — a 2GB ISO was a 2GB allocation.
 *  - openWrite/writeChunk/closeWrite stream received bytes to disk as they
 *    arrive, replacing the old "collect every chunk in a Map, concatenate at
 *    the end" receive.
 *
 * Write handles are integers rather than paths so a renderer can never be
 * tricked into appending to an arbitrary file: it can only write to a stream
 * this module opened, at a path this module resolved and bounds-checked.
 */

import { app, dialog, ipcMain, shell } from 'electron';
import { createWriteStream, WriteStream } from 'fs';
import { promises as fs } from 'fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path';
import { sanitizeRelPath, uniquePath, walkPaths } from './fileTransfer';

type OpenWrite = { stream: WriteStream; path: string };

const openWrites = new Map<number, OpenWrite>();
let nextWriteHandle = 1;

function isInside(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** Normalise whatever the renderer hands us into a Buffer we can write. */
function toBuffer(data: any): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (data?.data) return Buffer.from(data.data); // structured-clone round trip
  return Buffer.from(data || []);
}

export function registerLocalFileHandlers(defaultReceiveDir: () => string): void {
  ipcMain.handle('files:walk-local', async (_event, paths: string[]) => {
    const { files, totalBytes, truncated, skipped } = await walkPaths(Array.isArray(paths) ? paths.map(String) : []);
    return { files, totalBytes, truncated, skipped };
  });

  ipcMain.handle('files:read-chunk', async (_event, path: string, offset: number, length: number) => {
    const handle = await fs.open(String(path), 'r');
    try {
      const buffer = Buffer.alloc(Math.max(0, Number(length) || 0));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, Math.max(0, Number(offset) || 0));
      // subarray, not slice: no second copy of a megabyte on every read.
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  });

  ipcMain.handle('files:open-write', async (_event, destDir: string, relPath: string, options?: { append?: boolean }) => {
    const root = String(destDir || '').trim() || defaultReceiveDir();
    const safeRel = sanitizeRelPath(String(relPath || ''));
    if (!safeRel) throw new Error('That file has an unusable name.');
    const requested = join(root, safeRel);
    if (!isInside(root, requested)) throw new Error('Refusing to write outside the destination folder.');
    await fs.mkdir(dirname(requested), { recursive: true });
    // Never overwrite: an existing file keeps its name, the new one gets "(2)".
    // `append` continues a file this session was writing when the link dropped.
    const append = Boolean(options?.append);
    const target = append ? requested : await uniquePath(requested);
    const stream = createWriteStream(target, { flags: append ? 'a' : 'wx' });
    await new Promise<void>((resolveOpen, rejectOpen) => {
      stream.once('open', () => resolveOpen());
      stream.once('error', rejectOpen);
    });
    const handle = nextWriteHandle++;
    openWrites.set(handle, { stream, path: target });
    return { handle, path: target, renamed: target !== requested };
  });

  ipcMain.handle('files:write-chunk', async (_event, handle: number, data: any) => {
    const entry = openWrites.get(Number(handle));
    if (!entry) throw new Error('That transfer is no longer open.');
    const buffer = toBuffer(data);
    await new Promise<void>((resolveWrite, rejectWrite) => {
      // Honour the stream's own backpressure so a fast link cannot outrun the
      // disk and grow the process heap instead.
      const ok = entry.stream.write(buffer, (err) => { if (err) rejectWrite(err); });
      if (ok) resolveWrite();
      else entry.stream.once('drain', resolveWrite);
    });
    return buffer.length;
  });

  ipcMain.handle('files:close-write', async (_event, handle: number) => {
    const entry = openWrites.get(Number(handle));
    if (!entry) return { path: '' };
    openWrites.delete(Number(handle));
    await new Promise<void>((resolveEnd) => entry.stream.end(() => resolveEnd()));
    return { path: entry.path };
  });

  ipcMain.handle('files:abort-write', async (_event, handle: number) => {
    const entry = openWrites.get(Number(handle));
    if (!entry) return false;
    openWrites.delete(Number(handle));
    try { entry.stream.destroy(); } catch { /* already closed */ }
    // A half-written file that looks complete is worse than no file.
    await fs.unlink(entry.path).catch(() => {});
    return true;
  });

  ipcMain.handle('files:mkdir-local', async (_event, parent: string, name: string) => {
    const root = String(parent || '');
    const safeName = sanitizeRelPath(String(name || ''));
    if (!safeName) throw new Error('Invalid folder name.');
    const target = join(root, safeName);
    if (!isInside(root, target)) throw new Error('Invalid folder name.');
    await fs.mkdir(target, { recursive: true });
    return target;
  });

  ipcMain.handle('files:default-receive-dir', async () => defaultReceiveDir());

  ipcMain.handle('files:reveal', async (_event, path: string) => {
    const target = String(path || '');
    if (!target) return false;
    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) await shell.openPath(target);
      else shell.showItemInFolder(target);
      return true;
    } catch {
      // Fall back to the parent folder — the file may have been moved since.
      await shell.openPath(dirname(target)).catch(() => {});
      return false;
    }
  });

  ipcMain.handle('files:pick-files', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Send To The Remote Computer',
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle('files:pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Send A Folder To The Remote Computer',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return '';
    return result.filePaths[0];
  });
}

/** Drop any streams left open by a session that ended mid-transfer. */
export function closeAllLocalWrites(): void {
  for (const [handle, entry] of openWrites) {
    try { entry.stream.destroy(); } catch { /* already closed */ }
    void fs.unlink(entry.path).catch(() => {});
    openWrites.delete(handle);
  }
}

/** Exposed for the manager's "open containing folder" affordance. */
export const describeDownloadDir = (): string => app.getPath('downloads');
export const fileLabel = (path: string): string => basename(path);
