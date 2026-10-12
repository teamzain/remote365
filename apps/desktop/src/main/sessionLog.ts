// One retained log file per remote session, named after the two device IDs.
//
// main.log is a single 1 MB file with one rotation: on a busy machine that is
// a few hours, with every session interleaved. By the time someone reports "it
// froze this morning" the evidence has usually been overwritten, and what is
// left cannot be split by session. This writes everything the app logs while a
// session is open into that session's own file as well:
//
//   logs/sessions/20261003-101302_viewer_me-977962099_to-699300048.log
//   logs/sessions/20261003-101302_host_me-699300048_from-977962099.log
//
// The stream statistics (round trip, loss, tier, route) and the host's media
// health lines are already logged every 5 s, so a session file is a complete
// timeline of that session and nothing else. Files are kept for 30 days and
// 300 MB at most, oldest removed first. Nothing here leaves the machine.
import { app } from 'electron';
import { appendFile, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import log from 'electron-log';

export interface ActiveSession {
  /** Stable for the life of the session, e.g. "viewer:699300048". */
  key: string;
  role: 'viewer' | 'host';
  /** Device ID (or name) at the other end. */
  remote: string;
}

const KEEP_DAYS = Math.max(1, Number(process.env.REMOTE365_SESSION_LOG_DAYS) || 30);
const KEEP_BYTES = Math.max(10, Number(process.env.REMOTE365_SESSION_LOG_MB) || 300) * 1024 * 1024;
/** A session that drops and reconnects inside this window keeps its file: the
 *  drop and the recovery are exactly what the file is for. */
const CLOSE_AFTER_IDLE_MS = 60_000;
const FLUSH_MS = 1000;

const dir = () => join(app.getPath('userData'), 'logs', 'sessions');
const safe = (value: string) => String(value || 'unknown').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40) || 'unknown';
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const lineTime = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

interface OpenFile { path: string; lastActiveAt: number; pending: string[] }
const open = new Map<string, OpenFile>();
let getActive: () => ActiveSession[] = () => [];
let getOwnId: () => string = () => '';
let installed = false;
let lastSyncAt = 0;

function render(data: any[]): string {
  return data.map((part) => {
    if (typeof part === 'string') return part;
    if (part instanceof Error) return part.stack || part.message;
    try { return JSON.stringify(part); } catch { return String(part); }
  }).join(' ');
}

function sync(now: number) {
  let active: ActiveSession[] = [];
  try { active = getActive(); } catch { /* never let logging break the app */ }
  for (const session of active) {
    let file = open.get(session.key);
    if (!file) {
      const name = `${stamp(new Date(now))}_${session.role}_me-${safe(getOwnId())}_${session.role === 'viewer' ? 'to' : 'from'}-${safe(session.remote)}.log`;
      file = { path: join(dir(), name), lastActiveAt: now, pending: [] };
      file.pending.push(`[${lineTime(new Date(now))}] [info]  [SessionLog] ${session.role} session opened. app=${app.getVersion()} me=${getOwnId() || 'unknown'} remote=${session.remote}\n`);
      open.set(session.key, file);
    }
    file.lastActiveAt = now;
  }
  for (const [key, file] of open) {
    if (now - file.lastActiveAt > CLOSE_AFTER_IDLE_MS) {
      file.pending.push(`[${lineTime(new Date(now))}] [info]  [SessionLog] session closed.\n`);
      flush(file);
      open.delete(key);
    }
  }
}

function flush(file: OpenFile) {
  if (file.pending.length === 0) return;
  const chunk = file.pending.join('');
  file.pending = [];
  appendFile(file.path, chunk, () => { /* a full disk must not take the app down */ });
}

function prune() {
  try {
    const files = readdirSync(dir())
      .filter((name) => name.endsWith('.log'))
      .map((name) => { const path = join(dir(), name); const s = statSync(path); return { path, size: s.size, mtime: s.mtimeMs }; })
      .sort((a, b) => b.mtime - a.mtime);
    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    let total = 0;
    for (const file of files) {
      total += file.size;
      if (file.mtime < cutoff || total > KEEP_BYTES) {
        try { unlinkSync(file.path); } catch { /* in use or already gone */ }
      }
    }
  } catch { /* directory missing or unreadable: nothing to prune */ }
}

/** Call once at startup. `active` is polled; it must be cheap and must not log. */
export function installSessionLog(active: () => ActiveSession[], ownId: () => string) {
  if (installed || process.env.REMOTE365_SESSION_LOG === '0') return;
  installed = true;
  getActive = active;
  getOwnId = ownId;
  try { if (!existsSync(dir())) mkdirSync(dir(), { recursive: true }); } catch { return; }
  prune();
  setInterval(prune, 6 * 60 * 60 * 1000).unref?.();
  setInterval(() => {
    sync(Date.now());
    for (const file of open.values()) flush(file);
  }, FLUSH_MS).unref?.();
  // Every line bound for main.log also goes to the files of the sessions that
  // are open right now. The message itself is passed through untouched.
  log.hooks.push((message: any, transport: any) => {
    try {
      if (transport !== log.transports.file) return message;
      // Pick up a session that has just started without waiting for the timer,
      // so its first lines are not lost.
      const now = Date.now();
      if (now - lastSyncAt > 200) { lastSyncAt = now; sync(now); }
      if (open.size === 0) return message;
      const line = `[${lineTime(message.date || new Date())}] [${message.level}]  ${render(message.data || [])}\n`;
      for (const file of open.values()) file.pending.push(line);
    } catch { /* never let logging break the app */ }
    return message;
  });
}
