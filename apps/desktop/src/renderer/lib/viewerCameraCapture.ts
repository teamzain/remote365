/**
 * Viewer camera + microphone, streamed to the host machine.
 *
 * Direction matters here: everything else in a session flows host -> viewer
 * (screen pixels, host speakers). This is the one path going the other way, so
 * the person being helped can see and hear the person helping them.
 *
 * Why WebCodecs over a data channel rather than a second media track:
 * the host's peer connection is node-datachannel in the MAIN process, which
 * hands us raw RTP. Receiving a real video track there would mean writing a
 * jitter buffer and an H.264 depacketiser and then feeding FFmpeg — a lot of
 * moving parts for a webcam thumbnail. Both ends are Chromium, so encoding
 * here and decoding in the host's camera window costs one data channel and no
 * new media plumbing. It mirrors what hostAudioCapture.ts already does for
 * host audio, just in reverse.
 *
 * Realtime discipline: when the channel is backed up (a file transfer, a bad
 * link) frames are DROPPED, never queued. Queueing video behind a megabyte of
 * file bytes turns a live face into a slideshow that runs minutes late.
 */

// A webcam tile on someone's desktop does not need to be large, and this
// stream competes with screen pixels for the same uplink.
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 360;
const FRAME_RATE = 20;
const VIDEO_BITRATE = 500_000;
// Voice, not music: mono at 32kbps is clear and cheap.
const AUDIO_BITRATE = 32_000;
const AUDIO_SAMPLE_RATE = 48_000;
// Recover from a dropped frame within a couple of seconds without a round trip.
const KEYFRAME_INTERVAL_MS = 2_000;
// Past this much queued on the channel the picture is already stale.
const DROP_THRESHOLD = 256 * 1024;

export type CameraState = {
  active: boolean;
  cameraOn: boolean;
  micOn: boolean;
  error: string;
  /** Non-fatal explanation, e.g. running mic-only because there is no camera. */
  notice: string;
  /** False when we fell back to microphone-only. */
  hasVideo: boolean;
  stream: MediaStream | null;
};

/**
 * getUserMedia rejects with DOM error names that mean nothing to the person
 * reading them — "Requested device not found" was showing up verbatim on a
 * machine with no webcam. Say what happened and what to do about it.
 */
function describeMediaError(err: any): string {
  const name = String(err?.name || '');
  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone is connected to this computer.';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access is blocked. Allow it in Windows Settings → Privacy & security → Camera, then try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera is already in use by another app (Teams, Zoom, the Camera app). Close it and try again.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'This camera does not support the video format we asked for.';
    case 'SecurityError':
      return 'Camera access is disabled by a security policy on this computer.';
    case 'AbortError':
      return 'The camera could not be started. Unplug and reconnect it, then try again.';
    default:
      return err?.message ? `Could not start the camera: ${err.message}` : 'Could not start the camera.';
  }
}

type Listener = (state: CameraState) => void;

let stream: MediaStream | null = null;
let videoEncoder: any = null;
let audioEncoder: any = null;
let videoReader: any = null;
let audioReader: any = null;
let lastKeyframeAt = 0;
let starting = false;
/** Codec settled by negotiation; announced to the host in cam:start. */
let activeCodec = '';
/** What the host reported it can decode. Null until it tells us. */
let hostCodecs: string[] | null = null;

let sendFn: ((payload: any) => void) | null = null;
let channelFn: (() => RTCDataChannel | null) | null = null;

const state: CameraState = {
  active: false, cameraOn: false, micOn: false, error: '', notice: '', hasVideo: false, stream: null,
};

const AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/**
 * What the consent dialog decided. Without these the capture always grabbed
 * the OS default devices, so picking a camera in the dialog would preview one
 * webcam and then broadcast a different one.
 */
export type CameraStartOptions = {
  cameraId?: string;
  micId?: string;
  /** Start with the mic muted (the dialog's Audio toggle was off). */
  micEnabled?: boolean;
  /** Share microphone only, because the dialog's Video toggle was off. */
  videoEnabled?: boolean;
};

/**
 * Ask for camera + mic, and fall back to mic alone when there is no usable
 * camera. A machine without a webcam is a normal case for a support session —
 * failing the whole feature there loses the voice channel too, which is the
 * more useful half.
 */
async function acquireStream(options: CameraStartOptions = {}): Promise<{ stream: MediaStream; hasVideo: boolean; notice: string }> {
  const audioConstraints = options.micId
    ? { ...AUDIO_CONSTRAINTS, deviceId: { ideal: options.micId } }
    : AUDIO_CONSTRAINTS;
  // The dialog can ask for microphone only; honour that instead of opening the
  // camera and disabling it, which leaves the webcam light on for nothing.
  if (options.videoEnabled === false) {
    const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    return { stream: audioOnly, hasVideo: false, notice: 'Sharing your microphone only.' };
  }
  try {
    const full = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: VIDEO_WIDTH },
        height: { ideal: VIDEO_HEIGHT },
        frameRate: { ideal: FRAME_RATE },
        ...(options.cameraId ? { deviceId: { ideal: options.cameraId } } : {}),
      },
      audio: audioConstraints,
    });
    if (full.getVideoTracks().length) return { stream: full, hasVideo: true, notice: '' };
    return { stream: full, hasVideo: false, notice: 'No camera found — sharing your microphone only.' };
  } catch (err: any) {
    const name = String(err?.name || '');
    const cameraMissingOrBusy = name === 'NotFoundError' || name === 'DevicesNotFoundError'
      || name === 'NotReadableError' || name === 'TrackStartError'
      || name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError';
    if (!cameraMissingOrBusy) throw err;
    // Retry without video. If this also fails there is genuinely no input
    // device (or no permission), and the original error is the honest one.
    try {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      return {
        stream: audioOnly,
        hasVideo: false,
        notice: name === 'NotReadableError' || name === 'TrackStartError'
          ? 'Your camera is in use by another app — sharing your microphone only.'
          : 'No camera found — sharing your microphone only.',
      };
    } catch {
      throw err;
    }
  }
}
const listeners = new Set<Listener>();

const emit = () => { for (const listener of listeners) listener({ ...state }); };

/**
 * Send diagnostics to the MAIN log, not just the renderer console. When this
 * path fails it fails silently — the host just shows an empty tile — and
 * nobody has devtools open on a live support session.
 */
function report(message: string): void {
  try { (window as any).electronAPI?.log?.(`[ViewerCamera] ${message}`); } catch { /* no bridge */ }
  console.log(`[ViewerCamera] ${message}`);
}

export function subscribeCameraState(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => { listeners.delete(listener); };
}

export const getCameraState = (): CameraState => ({ ...state });

/** Wire the transport once, when a session starts. */
export function configureCameraTransport(
  send: (payload: any) => void,
  getChannel: () => RTCDataChannel | null,
): void {
  sendFn = send;
  channelFn = getChannel;
  // Capabilities belong to the host we are connected to; carrying them into a
  // session with a different machine would pick a codec on stale evidence.
  hostCodecs = null;
}

export const isViewerCameraSupported = (): boolean =>
  typeof (window as any).VideoEncoder === 'function'
  && typeof (window as any).MediaStreamTrackProcessor === 'function';

function frame(header: object, payload: Uint8Array): Uint8Array {
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(4 + headerBytes.length + payload.byteLength);
  new DataView(out.buffer).setUint32(0, headerBytes.length, true);
  out.set(headerBytes, 4);
  out.set(payload, 4 + headerBytes.length);
  return out;
}

/** True when the channel has room; false means drop this frame. */
function hasHeadroom(): boolean {
  const channel = channelFn?.();
  if (!channel || channel.readyState !== 'open') return false;
  return channel.bufferedAmount < DROP_THRESHOLD;
}

export async function startViewerCamera(options: CameraStartOptions = {}): Promise<boolean> {
  if (state.active || starting) return true;
  if (!isViewerCameraSupported()) {
    state.error = 'This build cannot encode camera video (WebCodecs unavailable).';
    emit();
    return false;
  }
  if (!sendFn) {
    state.error = 'No active session to send the camera to.';
    emit();
    return false;
  }
  starting = true;
  try {
    const acquired = await acquireStream(options);
    stream = acquired.stream;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    const settings = videoTrack?.getSettings?.() || {};
    const width = Number(settings.width) || VIDEO_WIDTH;
    const height = Number(settings.height) || VIDEO_HEIGHT;

    /* ---- video ---- */
    // cam:start is sent AFTER codec negotiation below, so it can tell the host
    // which codec to decode. Announcing before we know is how the host ended
    // up guessing H.264 and failing.
    if (acquired.hasVideo && videoTrack) {
    let chunksOut = 0;
    let chunksDropped = 0;
    let framesRead = 0;
    videoEncoder = new (window as any).VideoEncoder({
      output: (chunk: any) => {
        // Never drop a keyframe: the host cannot start (or recover) its
        // decoder without one, so shedding it turns a brief congestion blip
        // into a permanently blank tile.
        if (chunk.type !== 'key' && !hasHeadroom()) {
          chunksDropped++;
          // Report the FIRST drop, not just every 100th. A stream that is 100%
          // dropped from frame one looks identical to one that never encoded.
          if (chunksDropped === 1 || chunksDropped % 100 === 0) {
            const channel = channelFn?.();
            report(`dropped ${chunksDropped} frame(s): channel=${channel?.readyState ?? 'null'} buffered=${channel?.bufferedAmount ?? -1}`);
          }
          return;
        }
        const payload = new Uint8Array(chunk.byteLength);
        chunk.copyTo(payload);
        sendFn?.(frame({ type: 'cam:v', key: chunk.type === 'key', ts: chunk.timestamp }, payload));
        if (++chunksOut === 1) report('first encoded frame sent');
        else if (chunksOut === 50) report('50 frames sent — encode/transport healthy');
      },
      error: (err: any) => {
        report(`encoder error: ${err?.message || err}`);
        state.error = `Could not encode your camera: ${err?.message || err}`;
        emit();
      },
    });

    const commonConfig = {
      width,
      height,
      bitrate: VIDEO_BITRATE,
      framerate: FRAME_RATE,
      latencyMode: 'realtime',
    };
    // VP8 FIRST, deliberately. H.264 was the original choice and it stranded
    // the feature on cloud VMs: Chromium only offers WebCodecs H.264 decode
    // where a hardware decoder exists, so a GPU-less host answered
    // isConfigSupported with "no H.264 decoder" for every variant. libvpx is
    // compiled into every Chromium build and needs no GPU and no proprietary
    // codec, so VP8 works on any machine either end. At 640x360@20fps the
    // quality difference is irrelevant for a webcam tile.
    //
    // configure() does NOT throw for an unsupported config — WebCodecs reports
    // that asynchronously on the error callback — so isConfigSupported is the
    // only reliable way to choose.
    const codecCandidates = [
      { ...commonConfig, codec: 'vp8' },
      { ...commonConfig, codec: 'vp09.00.10.08' },
      // annexb carries its own parameter sets inline, so the decoder needs no
      // out-of-band `description`.
      { ...commonConfig, codec: 'avc1.42E01F', avc: { format: 'annexb' } },
    ];
    // Prefer something the host has told us it can decode. Encoding a codec
    // the far end cannot play is the failure this whole path kept hitting.
    const supportedByHost = hostCodecs?.length
      ? codecCandidates.filter((config) => hostCodecs!.includes(config.codec))
      : [];
    const ordered = supportedByHost.length ? supportedByHost : codecCandidates;
    if (hostCodecs?.length) report(`host decodes: ${hostCodecs.join(', ')}`);

    let chosenCodec = '';
    for (const config of ordered) {
      try {
        const support = await (window as any).VideoEncoder.isConfigSupported(config);
        if (!support?.supported) { report(`encoder codec unsupported: ${config.codec}`); continue; }
        videoEncoder.configure(support.config || config);
        chosenCodec = config.codec;
        report(`encoder configured ${config.codec} ${width}x${height}`);
        break;
      } catch (err: any) {
        report(`encoder configure failed (${config.codec}): ${err?.message || err}`);
      }
    }
    if (!chosenCodec) throw new Error('This computer cannot encode video from the camera.');
    activeCodec = chosenCodec;

    // Now that a codec is settled, tell the host what is coming.
    sendFn({
      type: 'cam:start',
      width,
      height,
      hasAudio: Boolean(audioTrack),
      hasVideo: true,
      codec: chosenCodec,
    });

    const videoProcessor = new (window as any).MediaStreamTrackProcessor({ track: videoTrack });
    videoReader = videoProcessor.readable.getReader();
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await videoReader.read();
          if (done) { report('capture loop ended: track closed'); break; }
          if (!value) continue;
          if (++framesRead === 1) report('first camera frame captured');
          try {
            if (videoEncoder?.state === 'configured') {
              const now = Date.now();
              // Deliberately NOT gated on channel headroom. Skipping the encode
              // when the pipe looks busy was a silent path: it produced zero
              // frames AND zero log lines, which is indistinguishable from the
              // camera never starting. Encoding 640x360 is cheap; congestion is
              // handled (and logged) at the output callback instead.
              const keyFrame = now - lastKeyframeAt >= KEYFRAME_INTERVAL_MS;
              if (keyFrame) lastKeyframeAt = now;
              videoEncoder.encode(value, { keyFrame });
            } else if (framesRead % 100 === 1) {
              report(`encoder not configured (state=${videoEncoder?.state ?? 'null'}) — frames discarded`);
            }
          } finally {
            // VideoFrame holds non-GC memory; leaking these at 20/s exhausts
            // the pool within a minute and capture dies silently.
            value.close();
          }
        }
      } catch (err: any) {
        // Was a bare `catch {}`. If anything in the loop threw — a stale
        // channel getter, an encoder in the wrong state — capture stopped dead
        // with no frames and no trace, which is exactly the failure that was
        // impossible to diagnose.
        report(`capture loop aborted: ${err?.message || err}`);
      }
    })();
    } else {
      // Mic-only: no codec to negotiate, but the host still needs to know the
      // session started so it can show the audio-only badge.
      sendFn({
        type: 'cam:start',
        width,
        height,
        hasAudio: Boolean(audioTrack),
        hasVideo: false,
      });
    }

    /* ---- audio ---- */
    if (audioTrack && typeof (window as any).AudioEncoder === 'function') {
      audioEncoder = new (window as any).AudioEncoder({
        output: (chunk: any) => {
          const channel = channelFn?.();
          if (!channel || channel.readyState !== 'open') return;
          const payload = new Uint8Array(chunk.byteLength);
          chunk.copyTo(payload);
          sendFn?.(frame({ type: 'cam:a', ts: chunk.timestamp }, payload));
        },
        error: (err: any) => { state.error = String(err?.message || err); emit(); },
      });
      audioEncoder.configure({
        codec: 'opus',
        sampleRate: AUDIO_SAMPLE_RATE,
        numberOfChannels: 1,
        bitrate: AUDIO_BITRATE,
      });
      const audioProcessor = new (window as any).MediaStreamTrackProcessor({ track: audioTrack });
      audioReader = audioProcessor.readable.getReader();
      void (async () => {
        try {
          for (;;) {
            const { value, done } = await audioReader.read();
            if (done) break;
            if (!value) continue;
            try {
              if (audioEncoder?.state === 'configured') audioEncoder.encode(value);
            } finally {
              value.close();
            }
          }
        } catch {
          // As above.
        }
      })();
    }

    // The user can revoke camera access from the OS at any time.
    videoTrack?.addEventListener('ended', () => { void stopViewerCamera(); });

    state.active = true;
    state.cameraOn = acquired.hasVideo;
    state.hasVideo = acquired.hasVideo;
    if (audioTrack && options.micEnabled === false) audioTrack.enabled = false;
    state.micOn = Boolean(audioTrack) && options.micEnabled !== false;
    state.error = '';
    state.notice = acquired.notice;
    state.stream = stream;
    starting = false;
    emit();
    report(`started: video=${acquired.hasVideo} audio=${Boolean(audioTrack)} ${width}x${height}`);
    return true;
  } catch (err: any) {
    starting = false;
    // stopViewerCamera clears state, so record the reason afterwards.
    await stopViewerCamera(false);
    state.error = describeMediaError(err);
    emit();
    return false;
  }
}

/** Dismiss the error card without touching capture. */
export function clearCameraError(): void {
  state.error = '';
  emit();
}

export async function stopViewerCamera(notifyHost = true): Promise<void> {
  if (notifyHost && state.active) sendFn?.({ type: 'cam:stop' });
  try { await videoReader?.cancel?.(); } catch { /* already closed */ }
  try { await audioReader?.cancel?.(); } catch { /* already closed */ }
  videoReader = null;
  audioReader = null;
  try { if (videoEncoder && videoEncoder.state !== 'closed') videoEncoder.close(); } catch { /* already closed */ }
  try { if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close(); } catch { /* already closed */ }
  videoEncoder = null;
  audioEncoder = null;
  stream?.getTracks().forEach((track) => { try { track.stop(); } catch { /* already stopped */ } });
  stream = null;
  lastKeyframeAt = 0;
  // Renegotiate on the next start: a different camera may support a different
  // codec, and a stale value would be announced to the host as fact.
  activeCodec = '';
  state.active = false;
  state.cameraOn = false;
  state.hasVideo = false;
  state.micOn = false;
  state.notice = '';
  state.stream = null;
  emit();
}

/**
 * Mute/unmute the microphone without dropping the video. Disabling the track
 * keeps the encoder fed with silence rather than tearing the pipeline down,
 * so unmuting is instant.
 */
export function setViewerMicEnabled(enabled: boolean): void {
  const track = stream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = enabled;
  state.micOn = enabled;
  emit();
}

/** The host asked for a fresh keyframe (its decoder started or recovered). */
export function requestCameraKeyframe(): void {
  lastKeyframeAt = 0;
}

/** Called when the host closes the camera window on its side. */
export function handleCameraControlMessage(data: any): boolean {
  const type = String(data?.type || '');
  if (type === 'cam:need-keyframe') {
    requestCameraKeyframe();
    return true;
  }
  if (type === 'cam:host-codecs') {
    const codecs = Array.isArray(data.codecs) ? data.codecs.map(String) : [];
    hostCodecs = codecs;
    report(`host can decode: ${codecs.join(', ') || 'nothing'}`);
    // If we are already sending something it cannot play, switch rather than
    // stream into a void. Restart (rather than reconfigure in place) so the
    // encoder, the keyframe state and the host's decoder all reset together;
    // notifyHost=false keeps the host's tile open across the swap.
    if (state.active && state.hasVideo && activeCodec && codecs.length && !codecs.includes(activeCodec)) {
      report(`renegotiating: host cannot decode ${activeCodec}`);
      void (async () => {
        await stopViewerCamera(false);
        await startViewerCamera();
      })();
    }
    return true;
  }
  if (type === 'cam:window-closed') {
    void stopViewerCamera(false);
    return true;
  }
  return false;
}
