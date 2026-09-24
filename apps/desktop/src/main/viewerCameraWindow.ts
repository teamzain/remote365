/**
 * The viewer's camera, shown on the HOST machine as a circular badge.
 *
 * A floating, always-on-top tile so the person being helped can see and hear
 * whoever is driving their computer. It is a separate BrowserWindow rather
 * than something drawn into the app: during a session the host's app is
 * minimised and the host is looking at their own desktop, so anything rendered
 * inside the app window would be invisible.
 *
 * Round, and therefore transparent: the window is a square with a circular
 * canvas in it, so the corners must not paint. Controls only appear on hover
 * to keep the resting state to just a face.
 *
 * Decoding happens in this window, not in main. Main has no decoder — it holds
 * a node-datachannel peer that deals in bytes — whereas this window is
 * Chromium and has WebCodecs. Main's whole job is to relay frames it never
 * looks at.
 *
 * Diagnosability was added the hard way: the first version showed a permanent
 * "Waiting for camera…" whenever the decoder failed to configure, which is
 * indistinguishable from "the sender never started". Every failure path now
 * says what happened, on screen and in the main log.
 */

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

let cameraWindow: BrowserWindow | null = null;
let collapsed = false;
let handlersBound = false;

type Notifier = (payload: any) => void;
let notifyViewer: Notifier = () => {};
let logLine: (message: string) => void = () => {};

// Square windows; the circle is inscribed. Collapsing shrinks the badge
// rather than hiding the picture — a round tile has no "title bar" to keep.
const EXPANDED = { width: 232, height: 232 };
const COLLAPSED = { width: 116, height: 116 };

function boundsFor(isCollapsed: boolean) {
  const size = isCollapsed ? COLLAPSED : EXPANDED;
  const display = screen.getPrimaryDisplay().workArea;
  return {
    // Top-right, clear of the host dock which lives along the top-centre.
    x: Math.max(display.x, display.x + display.width - size.width - 28),
    y: display.y + 96,
    width: size.width,
    height: size.height,
  };
}

function cameraHtml(viewerName: string): string {
  const safeName = viewerName.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html>
<head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%; width: 100%;
    background: transparent;      /* the window corners must not paint */
    overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif;
    -webkit-user-select: none;
  }
  #badge {
    -webkit-app-region: drag;
    position: relative;
    height: 100%; width: 100%;
    border-radius: 50%;
    overflow: hidden;
    background: #1A1D21;
    border: 3px solid #FF8A00;
    box-shadow: 0 10px 30px rgba(0,0,0,.45);
  }
  canvas {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    /* Mirrored so the host sees the viewer the way a mirror would, which is
       what every video-call product trains people to expect. */
    transform: scaleX(-1);
  }
  #status {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 0 18px;
    font-size: 11px; line-height: 15px; color: rgba(255,255,255,.72);
  }
  #status.err { color: #FFB4AB; }
  #name {
    position: absolute; left: 0; right: 0; bottom: 10px;
    text-align: center; font-size: 10px; font-weight: 600; color: #fff;
    text-shadow: 0 1px 3px rgba(0,0,0,.9);
    pointer-events: none;
    transition: opacity .15s;
  }
  #controls {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: 42%;
    display: flex; align-items: flex-end; justify-content: center; gap: 10px;
    padding-bottom: 12px;
    background: linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,0));
    opacity: 0; transition: opacity .15s;
  }
  #badge:hover #controls { opacity: 1; }
  #badge:hover #name { opacity: 0; }
  button {
    -webkit-app-region: no-drag;
    background: rgba(255,255,255,.16); border: 0; color: #fff; cursor: pointer;
    width: 26px; height: 26px; border-radius: 50%; font-size: 12px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
  }
  button:hover { background: rgba(255,255,255,.32); }
  button.off { background: #FF8A00; }
  body.collapsed #controls, body.collapsed #name { display: none; }
  body.collapsed #status { font-size: 9px; padding: 0 8px; }
</style>
</head>
<body>
  <div id="badge">
    <canvas id="view"></canvas>
    <div id="status">Waiting For Camera&hellip;</div>
    <div id="name">${safeName}</div>
    <div id="controls">
      <button id="mute" title="Mute">&#128266;</button>
      <button id="fold" title="Shrink">&#8722;</button>
      <button id="close" title="Close">&#10005;</button>
    </div>
  </div>
<script>
  const { ipcRenderer } = require('electron');
  const canvas = document.getElementById('view');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  let muted = false;
  let framesDecoded = 0;

  const report = (msg) => ipcRenderer.send('viewer-camera:log', msg);

  // The whole feature depends on WebCodecs, which is only present in a secure
  // context. Check for it EXPLICITLY, first thing: probing codecs against a
  // missing API turns a ReferenceError into "unsupported" inside every catch,
  // which reads as a codec problem and sent this investigation down three
  // wrong paths. Say the real thing.
  if (typeof VideoDecoder !== 'function') {
    report('FATAL: WebCodecs unavailable (VideoDecoder undefined). secureContext=' + window.isSecureContext + ' origin=' + location.origin + ' protocol=' + location.protocol);
    setStatus('Video decoding is unavailable in this window.', true);
  }

  // Tell the sender what this machine can actually decode, so it encodes
  // something we can play instead of both ends independently assuming a codec.
  (async () => {
    const decodable = [];
    if (typeof VideoDecoder !== 'function') {
      ipcRenderer.send('viewer-camera:codecs', decodable);
      return;
    }
    for (const codec of ['vp8', 'vp09.00.10.08', 'avc1.42E01F']) {
      try {
        const support = await VideoDecoder.isConfigSupported({ codec: codec, optimizeForLatency: true });
        if (support && support.supported) decodable.push(codec);
      } catch (e) { /* treat as unsupported */ }
    }
    report('this PC can decode: ' + (decodable.join(', ') || 'nothing'));
    ipcRenderer.send('viewer-camera:codecs', decodable);
  })();
  const setStatus = (text, isError) => {
    statusEl.textContent = text;
    statusEl.style.display = text ? 'flex' : 'none';
    statusEl.classList.toggle('err', Boolean(isError));
  };

  /* ---------- video ---------- */
  let decoder = null;
  let needKey = true;

  let framesReceived = 0;
  // Announced by the viewer in cam:start. Empty until we hear it: building the
  // decoder on a GUESSED codec was a real bug — the announcement and the first
  // video frame race over IPC, video won by ~1ms, and the decoder came up as
  // H.264 while the stream was VP8. Every frame then failed with "key frame
  // required" (an H.264 decoder finding no H.264 keyframe in VP8 bytes).
  let streamCodec = '';
  // Older viewers never announce a codec and were always H.264. Give them a
  // moment to announce before assuming.
  const LEGACY_CODEC = 'avc1.42E01F';
  const LEGACY_ASSUME_AFTER_MS = 1500;
  let firstFrameAt = 0;
  // Which codec the live decoder was actually built for, so a late or changed
  // announcement can be compared against reality rather than against a default.
  let decoderCodec = '';
  // idle -> configuring -> ready | dead. configure() reports an unsupported
  // config ASYNCHRONOUSLY via the error callback, never as a synchronous
  // throw, so a try/catch chain around it silently "succeeds" and then dies.
  // isConfigSupported is the real negotiation API.
  let decoderState = 'idle';

  const setupDecoder = async (width, height) => {
    decoderState = 'configuring';
    canvas.width = width; canvas.height = height;
    // Decode what the viewer said it sent. Guessing H.264 was what stranded
    // this on GPU-less hosts, where Chromium reports no H.264 decoder at all.
    // The software/hardware variants remain as a fallback for the same codec.
    const attempts = [
      { codec: streamCodec, optimizeForLatency: true },
      { codec: streamCodec, optimizeForLatency: true, hardwareAcceleration: 'prefer-software' },
      { codec: streamCodec, optimizeForLatency: true, hardwareAcceleration: 'prefer-hardware' },
    ];
    for (const config of attempts) {
      const label = config.hardwareAcceleration || 'default';
      try {
        const support = await VideoDecoder.isConfigSupported(config);
        if (!support || !support.supported) { report('decoder config unsupported (' + label + ')'); continue; }
        const dec = new VideoDecoder({
          output: (frame) => {
            if (framesDecoded === 0) { setStatus('', false); report('first frame decoded'); }
            framesDecoded++;
            try { ctx.drawImage(frame, 0, 0, canvas.width, canvas.height); }
            finally { frame.close(); }
          },
          error: (err) => {
            report('decoder error: ' + (err && err.message ? err.message : err));
            try { dec.close(); } catch (e) {}
            decoder = null;
            decoderState = 'idle';   // rebuild on the next frame
            needKey = true;
            if (framesDecoded === 0) setStatus('Cannot decode their video on this PC.', true);
            ipcRenderer.send('viewer-camera:need-keyframe');
          },
        });
        dec.configure(support.config || config);
        decoder = dec;
        decoderCodec = streamCodec;
        decoderState = 'ready';
        needKey = true;
        // Log the codec, not just the acceleration mode: its absence here is
        // exactly how a wrong-codec decoder hid in plain sight.
        report('decoder ready ' + streamCodec + ' (' + label + ') ' + width + 'x' + height);
        // The frames that arrived while we were configuring are gone; ask for
        // a fresh keyframe so the picture starts now rather than in 2s.
        ipcRenderer.send('viewer-camera:need-keyframe');
        return;
      } catch (e) {
        report('decoder attempt failed (' + label + '): ' + (e && e.message ? e.message : e));
      }
    }
    decoderState = 'dead';
    setStatus('This PC cannot decode ' + streamCodec + ' video.', true);
  };

  ipcRenderer.on('viewer-camera:video', (_e, payload) => {
    if (++framesReceived === 1) {
      firstFrameAt = Date.now();
      report('first frame received from viewer (' + payload.width + 'x' + payload.height + ')');
    }
    if (decoderState === 'dead' || decoderState === 'configuring') return;
    if (decoderState === 'idle') {
      // Do not build until we know the codec. Frames arriving before the
      // announcement are simply dropped; the sender will keyframe again.
      if (!streamCodec) {
        if (Date.now() - firstFrameAt >= LEGACY_ASSUME_AFTER_MS) {
          streamCodec = LEGACY_CODEC;
          report('no codec announced after ' + LEGACY_ASSUME_AFTER_MS + 'ms — assuming legacy ' + LEGACY_CODEC);
        } else {
          return;
        }
      }
      setupDecoder(payload.width, payload.height);
      return;
    }
    // Feeding a delta frame to a fresh decoder produces garbage; wait for the
    // first keyframe and ask for one if it is slow to arrive.
    if (needKey && !payload.key) { ipcRenderer.send('viewer-camera:need-keyframe'); return; }
    if (payload.key) needKey = false;
    try {
      decoder.decode(new EncodedVideoChunk({
        type: payload.key ? 'key' : 'delta',
        timestamp: payload.ts || 0,
        data: new Uint8Array(payload.data),
      }));
    } catch (e) {
      needKey = true;
      report('decode threw: ' + (e && e.message ? e.message : e));
    }
  });

  /* ---------- audio ---------- */
  let audioCtx = null;
  let audioDecoder = null;
  // Playback clock. Scheduling every buffer "now" would overlap them; this
  // keeps a small rolling cushion so speech stays continuous.
  let playAt = 0;

  const ensureAudio = () => {
    if (audioDecoder && audioDecoder.state === 'configured') return audioDecoder;
    audioCtx = audioCtx || new AudioContext({ sampleRate: 48000 });
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    audioDecoder = new AudioDecoder({
      output: (audioData) => {
        try {
          if (muted || !audioCtx) return;
          const channels = audioData.numberOfChannels;
          const frames = audioData.numberOfFrames;
          const buffer = audioCtx.createBuffer(channels, frames, audioData.sampleRate);
          for (let c = 0; c < channels; c++) {
            const target = new Float32Array(frames);
            audioData.copyTo(target, { planeIndex: c, format: 'f32-planar' });
            buffer.copyToChannel(target, c);
          }
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          const now = audioCtx.currentTime;
          // 60ms cushion: rides out normal jitter, still feels live.
          if (playAt < now + 0.02) playAt = now + 0.06;
          source.start(playAt);
          playAt += buffer.duration;
        } catch (e) {} finally { audioData.close(); }
      },
      error: (err) => {
        report('audio decoder error: ' + (err && err.message ? err.message : err));
        try { audioDecoder.close(); } catch (e) {}
        audioDecoder = null;
      },
    });
    try {
      audioDecoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1 });
    } catch (e) {
      report('audio configure failed: ' + (e && e.message ? e.message : e));
      audioDecoder = null;
    }
    return audioDecoder;
  };

  ipcRenderer.on('viewer-camera:audio', (_e, payload) => {
    if (muted) return;
    const dec = ensureAudio();
    if (!dec) return;
    try {
      dec.decode(new EncodedAudioChunk({
        type: 'key', timestamp: payload.ts || 0, data: new Uint8Array(payload.data),
      }));
    } catch (e) {}
  });

  /* ---------- mode + watchdog ---------- */
  let audioOnly = false;
  ipcRenderer.on('viewer-camera:mode', (_e, mode) => {
    const hasVideo = mode && typeof mode === 'object' ? mode.hasVideo : mode;
    if (mode && typeof mode === 'object' && mode.codec) {
      streamCodec = mode.codec;
      report('viewer announced codec ' + streamCodec);
      // If a decoder already exists for a DIFFERENT codec (the announcement
      // lost the race, or the viewer renegotiated mid-session), tear it down.
      // The next frame rebuilds it for the right one and asks for a keyframe.
      if (decoder && decoderCodec && decoderCodec !== streamCodec) {
        report('rebuilding decoder: was ' + decoderCodec + ', stream is ' + streamCodec);
        try { decoder.close(); } catch (e) {}
        decoder = null;
        decoderCodec = '';
        decoderState = 'idle';
        needKey = true;
      }
    }
    audioOnly = !hasVideo;
    if (audioOnly) {
      canvas.style.display = 'none';
      setStatus('Microphone Only', false);
    }
  });

  // If cam:start arrived but no picture followed, say which half is missing
  // instead of leaving "Waiting for camera…" up forever.
  setTimeout(() => {
    if (audioOnly || framesDecoded > 0 || decoderState === 'dead') return;
    // Which half failed matters: nothing arriving points at the sender or the
    // transport, whereas frames arriving but not decoding points at this PC.
    if (framesReceived === 0) {
      setStatus('Their camera is on, but no video is reaching this PC.', true);
      report('watchdog: 0 frames received after 6s — sender or transport');
    } else {
      setStatus('Video is arriving but will not decode here.', true);
      report('watchdog: ' + framesReceived + ' frames received, 0 decoded after 6s — decoder state=' + decoderState);
    }
  }, 6000);

  /* ---------- controls ---------- */
  document.getElementById('mute').addEventListener('click', (e) => {
    muted = !muted;
    e.currentTarget.innerHTML = muted ? '&#128263;' : '&#128266;';
    e.currentTarget.classList.toggle('off', muted);
    e.currentTarget.title = muted ? 'Unmute' : 'Mute';
    if (muted) playAt = 0;
  });
  document.getElementById('fold').addEventListener('click', () => ipcRenderer.send('viewer-camera:toggle-collapse'));
  document.getElementById('close').addEventListener('click', () => ipcRenderer.send('viewer-camera:close'));
  ipcRenderer.on('viewer-camera:collapsed', (_e, isCollapsed) => {
    document.body.classList.toggle('collapsed', isCollapsed);
    const fold = document.getElementById('fold');
    fold.innerHTML = isCollapsed ? '&#9633;' : '&#8722;';
    fold.title = isCollapsed ? 'Enlarge' : 'Shrink';
  });
</script>
</body>
</html>`;
}

/**
 * Write the tile's HTML to disk so it can be loaded over file:. Rewritten on
 * every open (the viewer name is baked in). Lives under the app's own userData
 * rather than the shared OS temp dir so a locked-down profile cannot block it.
 */
function writeCameraPage(viewerName: string): string {
  const dir = join(app.getPath('userData'), 'camera-tile');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'viewer-camera.html');
  writeFileSync(path, cameraHtml(viewerName), 'utf8');
  return path;
}

function bindHandlers(): void {
  if (handlersBound) return;
  handlersBound = true;

  ipcMain.on('viewer-camera:toggle-collapse', () => {
    if (!cameraWindow || cameraWindow.isDestroyed()) return;
    collapsed = !collapsed;
    cameraWindow.setBounds(boundsFor(collapsed), true);
    cameraWindow.webContents.send('viewer-camera:collapsed', collapsed);
  });

  ipcMain.on('viewer-camera:close', () => {
    // Tell the viewer to stop capturing: leaving their camera running with
    // nothing rendering it is both a privacy surprise and wasted uplink.
    notifyViewer({ type: 'cam:window-closed' });
    hideViewerCameraWindow();
  });

  ipcMain.on('viewer-camera:need-keyframe', () => {
    notifyViewer({ type: 'cam:need-keyframe' });
  });

  ipcMain.on('viewer-camera:codecs', (_event, codecs: string[]) => {
    logLine(`[ViewerCamera] host decodable codecs: ${(codecs || []).join(', ') || 'none'}`);
    notifyViewer({ type: 'cam:host-codecs', codecs: codecs || [] });
  });

  // The tile is a frameless always-on-top window with no devtools in front of
  // it; without this its diagnostics would be invisible.
  ipcMain.on('viewer-camera:log', (_event, message: string) => {
    logLine(`[ViewerCamera] ${message}`);
  });
}

export function setViewerCameraNotifier(notifier: Notifier, log?: (message: string) => void): void {
  notifyViewer = notifier;
  if (log) logLine = log;
}

export function showViewerCameraWindow(viewerName: string, hasVideo = true, codec = 'avc1.42E01F'): void {
  bindHandlers();
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    if (!cameraWindow.isVisible()) cameraWindow.showInactive();
    try { cameraWindow.webContents.send('viewer-camera:mode', { hasVideo, codec }); } catch { /* reloading */ }
    return;
  }
  collapsed = false;
  cameraWindow = new BrowserWindow({
    ...boundsFor(false),
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    // Round tile: the square window's corners have to be see-through.
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    title: 'Remote365 Camera',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  // screen-saver level keeps it above full-screen apps, matching the dock.
  cameraWindow.setAlwaysOnTop(true, 'screen-saver');
  cameraWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // MUST be a file: URL, not data:. WebCodecs (VideoDecoder/AudioDecoder) is
  // only exposed in secure contexts, and a data: URL is an opaque origin that
  // is NOT one — the API is simply undefined there. That was the whole camera
  // failure: every decoder attempt hit "VideoDecoder is not defined" and the
  // tile could never render a frame regardless of codec. The dock and chat
  // windows get away with data: only because they use no such API. file: is a
  // secure context, so the page is written to disk and loaded from there.
  cameraWindow.loadFile(writeCameraPage(viewerName || 'Remote Viewer'))
    .catch((err: any) => logLine(`[ViewerCamera] failed to load page: ${err?.message || err}`));
  cameraWindow.webContents.once('did-finish-load', () => {
    try { cameraWindow?.webContents.send('viewer-camera:mode', { hasVideo, codec }); } catch { /* closed */ }
  });
  cameraWindow.once('ready-to-show', () => {
    // Never steal focus — the host is working underneath this.
    cameraWindow?.showInactive();
  });
  cameraWindow.on('closed', () => { cameraWindow = null; });
}

export function hideViewerCameraWindow(): void {
  if (!cameraWindow || cameraWindow.isDestroyed()) {
    cameraWindow = null;
    return;
  }
  cameraWindow.close();
  cameraWindow = null;
}

export const isViewerCameraWindowOpen = (): boolean =>
  Boolean(cameraWindow && !cameraWindow.isDestroyed());

/**
 * Relay one encoded frame. Main never decodes: it forwards bytes and lets the
 * window's WebCodecs do the work.
 */
export function deliverViewerCameraFrame(header: any, chunk: Buffer, width: number, height: number): void {
  if (!cameraWindow || cameraWindow.isDestroyed()) return;
  const channel = header.type === 'cam:a' ? 'viewer-camera:audio' : 'viewer-camera:video';
  try {
    cameraWindow.webContents.send(channel, {
      key: Boolean(header.key),
      ts: Number(header.ts) || 0,
      width,
      height,
      data: chunk,
    });
  } catch {
    // Window torn down between the check and the send.
  }
}
