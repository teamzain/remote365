/**
 * Remote audio, host side: capture what this machine is playing and stream it
 * to the viewer, so someone driving the PC remotely hears the YouTube video,
 * the Teams call, the error beep.
 *
 * Why capture lives in the renderer rather than the FFmpeg worker that handles
 * video: Windows has no system-audio input device that FFmpeg can open. `dshow`
 * needs "Stereo Mix" (absent on most machines) or a virtual-cable driver we
 * would have to ship and sign. Chromium's loopback capture needs neither, and
 * this app already proves it works — the meeting screen-share path answers
 * `getDisplayMedia` with `audio: 'loopback'` (see setDisplayMediaRequestHandler
 * in main). So: capture and encode here, hand Opus frames to main, and main
 * puts them on the same peer connection as video.
 *
 * The video track that comes back with the loopback stream is stopped
 * immediately — screen pixels already have their own pipeline, and keeping a
 * second capture alive would cost real CPU for nothing.
 */

const OPUS_SAMPLE_RATE = 48000;
const OPUS_CHANNELS = 2;
// 20ms frames — the Opus default and what every WebRTC jitter buffer expects.
const FRAME_SAMPLES = OPUS_SAMPLE_RATE / 50;

type Api = {
  sendHostAudioChunk?: (data: Uint8Array, samples: number) => void;
};

let stream: MediaStream | null = null;
let encoder: any = null;
let reader: any = null;
let starting = false;

const api = (): Api => (window as any).electronAPI || {};

/**
 * Send diagnostics to the MAIN log file, not just the renderer console.
 * The host window is minimized for the whole session and nobody has devtools
 * open on it, so a console.warn here is invisible — which is exactly how the
 * first silent-audio failure went unnoticed.
 */
function report(message: string) {
  try { (window as any).electronAPI?.log?.(`[HostAudio] ${message}`); } catch { /* no bridge */ }
  console.log(`[HostAudio] ${message}`);
}

/**
 * Get a stream carrying this machine's speaker output.
 *
 * Order matters. getDisplayMedia() requires *transient user activation* in
 * Chromium, and capture starts from an IPC message when a viewer connects —
 * there is no click behind it — so that call throws before it ever reaches
 * main's loopback handler. Electron's older `chromeMediaSource: 'desktop'`
 * constraint has no such requirement, so it goes first.
 */
async function acquireLoopbackStream(): Promise<MediaStream | null> {
  try {
    // Desktop-source audio MUST be requested alongside a desktop video track in
    // Electron — `video: false` is an invalid shape that can hard-crash the
    // renderer on Windows (CHECK failure in the media-stream dispatcher). The
    // crash presented as the host app turning permanently white the moment any
    // session started. The video track is stopped immediately below; screen
    // pixels already have their own pipeline.
    const viaGum = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop' } },
      video: { mandatory: { chromeMediaSource: 'desktop' } },
    } as any);
    viaGum.getVideoTracks().forEach((t) => t.stop());
    if (viaGum.getAudioTracks().length > 0) {
      report('capturing via getUserMedia(chromeMediaSource: desktop)');
      return viaGum;
    }
    viaGum.getTracks().forEach((t) => t.stop());
    report('getUserMedia returned no audio track');
  } catch (err: any) {
    report(`getUserMedia loopback failed: ${err?.name || ''} ${err?.message || err}`);
  }

  try {
    const viaDisplay = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    viaDisplay.getVideoTracks().forEach((t) => t.stop());
    if (viaDisplay.getAudioTracks().length > 0) {
      report('capturing via getDisplayMedia loopback');
      return viaDisplay;
    }
    viaDisplay.getTracks().forEach((t) => t.stop());
    report('getDisplayMedia returned no audio track');
  } catch (err: any) {
    report(`getDisplayMedia failed: ${err?.name || ''} ${err?.message || err}`);
  }
  return null;
}

/** Is the browser new enough for the WebCodecs path? Electron 28 = Chromium 120. */
export const isHostAudioSupported = (): boolean =>
  typeof (window as any).AudioEncoder === 'function'
  && typeof (window as any).MediaStreamTrackProcessor === 'function';

export async function startHostAudioCapture(): Promise<boolean> {
  // Both guards matter: `starting` covers the await window, `stream` covers the
  // steady state. Main fires the start once per viewer, so this runs often.
  if (stream || starting) return true;
  if (!isHostAudioSupported()) {
    report('WebCodecs/MediaStreamTrackProcessor unavailable; remote audio disabled.');
    return false;
  }
  starting = true;
  try {
    const captured = await acquireLoopbackStream();
    if (!captured) {
      report('no loopback source available; session continues without sound.');
      starting = false;
      return false;
    }
    const audioTrack = captured.getAudioTracks()[0];
    stream = captured;

    const send = api().sendHostAudioChunk;
    if (!send) report('preload bridge missing sendHostAudioChunk; audio cannot be forwarded.');
    let framesOut = 0;
    encoder = new (window as any).AudioEncoder({
      output: (chunk: any) => {
        if (!send) return;
        const buffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buffer);
        send(buffer, FRAME_SAMPLES);
        // One line when sound starts flowing, then silence. Enough to tell
        // "capture never started" apart from "capture works, transport doesn't".
        if (++framesOut === 25) report('encoder producing Opus frames (first 25 sent).');
      },
      error: (err: any) => report(`encoder error: ${err?.message || err}`),
    });
    encoder.configure({
      codec: 'opus',
      sampleRate: OPUS_SAMPLE_RATE,
      numberOfChannels: OPUS_CHANNELS,
      bitrate: 96_000,
    });

    const processor = new (window as any).MediaStreamTrackProcessor({ track: audioTrack });
    reader = processor.readable.getReader();

    // Read until the track ends. Each AudioData is closed explicitly: they hold
    // non-GC memory, and leaking them at 50/s exhausts the pool within minutes.
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          try {
            if (encoder && encoder.state === 'configured') encoder.encode(value);
          } finally {
            value.close();
          }
        }
      } catch (err: any) {
        if (stream) console.warn('[HostAudio] Capture loop ended:', err?.message || err);
      }
    })();

    // The user can revoke sharing from Windows' own capture bar.
    audioTrack.addEventListener('ended', () => stopHostAudioCapture());
    console.log('[HostAudio] Sharing this machine’s audio with the viewer.');
    starting = false;
    return true;
  } catch (err: any) {
    // Denied permission or no loopback device: the session continues silently.
    console.warn('[HostAudio] Could not start capture:', err?.message || err);
    starting = false;
    await stopHostAudioCapture();
    return false;
  }
}

export async function stopHostAudioCapture(): Promise<void> {
  try { await reader?.cancel?.(); } catch { /* already closed */ }
  reader = null;
  try {
    if (encoder && encoder.state !== 'closed') encoder.close();
  } catch { /* already closed */ }
  encoder = null;
  stream?.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* already stopped */ }
  });
  stream = null;
}

/**
 * Subscribe to main's start/stop requests. Returns an unsubscribe function, so
 * callers can wire it up in a single effect.
 */
export function subscribeHostAudioCapture(): () => void {
  const onCapture = (window as any).electronAPI?.onHostAudioCapture;
  if (!onCapture) return () => {};
  const unsubscribe = onCapture((active: boolean) => {
    if (active) void startHostAudioCapture();
    else void stopHostAudioCapture();
  });
  return () => {
    unsubscribe?.();
    void stopHostAudioCapture();
  };
}
