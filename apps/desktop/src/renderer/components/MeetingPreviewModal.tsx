import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';
import logo from '../../logo.png';

/**
 * Pre-join "Meeting Preview" dialog (Figma: join meeting preview, 854 x 390).
 * Two columns: a live camera preview with Audio / Video tiles on the left, and
 * microphone / camera / speaker pickers on the right. Both the on/off state
 * and the chosen devices persist to localStorage, and {@link SnowMeeting}
 * reads the same keys when it acquires media — so the meeting starts exactly
 * as previewed.
 */

export const MEETING_PREF_KEYS = {
  mic: 'remote365_meeting_pref_mic',
  cam: 'remote365_meeting_pref_cam',
  speaker: 'remote365_meeting_pref_speaker',
  audio: 'remote365_meeting_pref_audio_enabled',
  video: 'remote365_meeting_pref_video_enabled',
} as const;

/**
 * Separate keys for the in-session camera. Sharing your face on a remote
 * session and joining a meeting are different decisions, so turning the
 * camera off in one must not silently change how the other starts.
 */
export const SESSION_CAMERA_PREF_KEYS = {
  mic: 'remote365_session_cam_pref_mic',
  cam: 'remote365_session_cam_pref_cam',
  speaker: 'remote365_session_cam_pref_speaker',
  audio: 'remote365_session_cam_pref_audio_enabled',
  video: 'remote365_session_cam_pref_video_enabled',
} as const;

/** Structural, not `typeof MEETING_PREF_KEYS` — that pins the literal key
 *  strings and rejects any other key set. */
export type PreviewPrefKeys = Record<'mic' | 'cam' | 'speaker' | 'audio' | 'video', string>;

interface MeetingPreviewModalProps {
  open: boolean;
  /** Drives the default confirm label. Omit when passing confirmLabel. */
  mode?: 'join' | 'create';
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Header text after "Remote365 - ". */
  title?: string;
  /** Overrides the mode-derived confirm button label. */
  confirmLabel?: string;
  /** Reassurance line under the pickers. */
  note?: string;
  /** Hidden where playback happens on the far end (the session camera). */
  showSpeaker?: boolean;
  /** Which localStorage keys this instance reads and writes. */
  prefKeys?: PreviewPrefKeys;
}

const readPref = (key: string, fallback = '') => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

// Mirrors writePreferredDevice in lib/mediaPreferences (not imported to avoid
// a circular module dependency): empty/default selections clear the key so
// media acquisition falls back to the OS default device.
const writePref = (key: string, value: string) => {
  try {
    if (value && value !== 'default') localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore storage failures */
  }
};

export const MeetingPreviewModal: React.FC<MeetingPreviewModalProps> = ({
  open,
  mode = 'join',
  busy = false,
  error,
  onCancel,
  onConfirm,
  title = 'Meeting Preview',
  confirmLabel,
  note = 'Your audio and video choices are kept when you join',
  showSpeaker = true,
  prefKeys = MEETING_PREF_KEYS,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [audioOn, setAudioOn] = useState(() => readPref(prefKeys.audio) !== 'false');
  const [videoOn, setVideoOn] = useState(() => readPref(prefKeys.video) !== 'false');
  const [micId, setMicId] = useState(() => readPref(prefKeys.mic));
  const [camId, setCamId] = useState(() => readPref(prefKeys.cam));
  const [speakerId, setSpeakerId] = useState(() => readPref(prefKeys.speaker));
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [mediaError, setMediaError] = useState('');
  const [openPicker, setOpenPicker] = useState<'mic' | 'cam' | 'speaker' | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Device labels are only populated once a stream has been granted, so this
  // runs after acquisition and again on every OS-level device change. The
  // "default"/"communications" pseudo-entries Windows adds are dropped — the
  // picker offers its own single Default option instead.
  const refreshDevices = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const real = list.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
      setMics(real.filter((d) => d.kind === 'audioinput'));
      setCams(real.filter((d) => d.kind === 'videoinput'));
      setSpeakers(real.filter((d) => d.kind === 'audiooutput'));
    } catch {
      /* device list stays empty — pickers show the Default option */
    }
  };

  useEffect(() => {
    if (!open) return;
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
  }, [open]);

  // Acquire / re-acquire the preview stream whenever the modal opens, video is
  // toggled back on, or a different mic/camera is picked.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // Only open the camera when the user actually wants video on — acquiring it
    // just to disable the track leaves the webcam light on. Audio is always
    // requested so unmuting is instant. Falling back to a single kind means a
    // missing mic never blocks the camera preview, and vice-versa.
    const acquire = async () => {
      const videoConstraint = videoOn ? (camId ? { deviceId: { ideal: camId } } : true) : false;
      const audioConstraint: MediaTrackConstraints | boolean = {
        ...(micId ? { deviceId: { ideal: micId } } : {}),
        noiseSuppression: localStorage.getItem('pref_noise_suppression') !== 'false',
        echoCancellation: true,
      };
      const attempts: MediaStreamConstraints[] = [{ video: videoConstraint, audio: audioConstraint }];
      if (videoConstraint) attempts.push({ video: videoConstraint, audio: false });
      attempts.push({ video: false, audio: audioConstraint });

      let lastError: unknown;
      for (const constraints of attempts) {
        if (!constraints.video && !constraints.audio) continue;
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError ?? new DOMException('No Media', 'NotFoundError');
    };

    const start = async () => {
      stopStream();
      try {
        const stream = await acquire();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        stream.getAudioTracks().forEach((t) => (t.enabled = audioOn));
        stream.getVideoTracks().forEach((t) => (t.enabled = videoOn));
        if (videoRef.current) videoRef.current.srcObject = stream;
        setMediaError('');
      } catch {
        if (!cancelled) setMediaError('Camera or microphone unavailable — you can still join.');
      }
      refreshDevices();
    };

    start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoOn, micId, camId]);

  // Reflect audio toggle changes onto the live preview track. Video toggles are
  // handled by the acquire effect above (it re-opens / releases the camera).
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = audioOn));
  }, [audioOn]);

  // Stop the preview when the modal closes so the meeting can claim the camera.
  useEffect(() => {
    if (!open) stopStream();
    return () => stopStream();
  }, [open]);

  // Escape closes an open device picker first, then cancels the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openPicker) {
        setOpenPicker(null);
        return;
      }
      if (!busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel, openPicker]);

  // Click anywhere outside a picker closes it.
  useEffect(() => {
    if (!openPicker) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-device-picker]')) setOpenPicker(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openPicker]);

  // Reset the picker state whenever the dialog closes.
  useEffect(() => {
    if (!open) setOpenPicker(null);
  }, [open]);

  if (!open) return null;

  const selectMic = (id: string) => { setMicId(id); writePref(prefKeys.mic, id); };
  const selectCam = (id: string) => { setCamId(id); writePref(prefKeys.cam, id); };
  const selectSpeaker = (id: string) => { setSpeakerId(id); writePref(prefKeys.speaker, id); };

  const persistAndConfirm = () => {
    // Audio/video enabled state is always carried into the call — SnowMeeting
    // reads these keys when acquiring media and joins muted / camera-off.
    writePref(prefKeys.audio, String(audioOn));
    writePref(prefKeys.video, String(videoOn));
    // The preview stream is released by the close effect once the modal
    // actually closes, so the live preview persists during "Starting…".
    onConfirm();
  };

  const resolvedConfirmLabel = confirmLabel || (mode === 'create' ? 'Create' : 'Join');

  // Custom dropdown (native <select> option lists can't be styled): trigger
  // row per the Figma input spec, with a rounded popover list underneath.
  const devicePicker = (
    kind: 'mic' | 'cam' | 'speaker',
    icon: React.ReactNode,
    value: string,
    onChange: (id: string) => void,
    options: MediaDeviceInfo[],
    defaultLabel: string,
  ) => {
    const isOpen = openPicker === kind;
    const selected = options.find((d) => d.deviceId === value);
    const triggerLabel = selected ? (selected.label || defaultLabel) : defaultLabel;
    const items = [{ deviceId: '', label: defaultLabel }, ...options.map((d, idx) => ({ deviceId: d.deviceId, label: d.label || `${defaultLabel} ${idx + 1}` }))];
    return (
      <div className="relative w-full" data-device-picker>
        <button
          type="button"
          onClick={() => setOpenPicker(isOpen ? null : kind)}
          aria-expanded={isOpen}
          className={`flex h-10 w-full items-center gap-2.5 rounded border bg-white px-4 text-left transition-colors dark:bg-transparent ${isOpen ? 'border-[#FF8A00]' : 'border-[#1A1D21]/30 hover:border-[#1A1D21]/50 dark:border-white/20 dark:hover:border-white/40'}`}
        >
          <span className="shrink-0 text-[#111315] dark:text-white">{icon}</span>
          <span className="flex-1 truncate text-[14px] font-medium leading-5 text-[#111315] dark:text-white">{triggerLabel}</span>
          <ChevronDown size={16} className={`shrink-0 text-[#111315] transition-transform dark:text-white ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-[176px] overflow-y-auto rounded-lg border border-black/10 bg-white p-1 shadow-[0_12px_32px_rgba(17,19,21,0.16)] animate-in fade-in slide-in-from-top-1 duration-150 dark:border-white/10 dark:bg-[#1A1A1A]">
            {items.map((item) => {
              const isSelected = (item.deviceId || '') === (value || '');
              return (
                <button
                  key={item.deviceId || '__default'}
                  type="button"
                  onClick={() => { onChange(item.deviceId); setOpenPicker(null); }}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] leading-5 transition-colors ${isSelected ? 'bg-[#FFF4E5] font-semibold text-[#B54708] dark:bg-[#FF8A00]/15 dark:text-[#FFB347]' : 'text-[#111315] hover:bg-black/5 dark:text-white dark:hover:bg-white/10'}`}
                >
                  <span className="flex w-4 shrink-0 justify-center">{isSelected && <Check size={14} strokeWidth={3} />}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div className="flex w-[854px] max-w-[calc(100vw-32px)] flex-col items-start gap-9 rounded-[12px] bg-white px-4 pb-8 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#101010]">
        {/* Header */}
        <div className="flex h-10 w-full items-center gap-2 py-[5px]">
          <img src={logo} alt="Remote365" className="h-6 w-6 rounded object-contain" />
          <span className="px-[5px] text-[14px] font-medium leading-5 text-[#111315] dark:text-white">
            Remote365 - {title}
          </span>
        </div>

        {/* Body: preview | device pickers */}
        <div className="flex w-full flex-col items-center gap-[22px] lg:flex-row lg:items-start">
          {/* Camera preview */}
          <div className="relative h-[282px] w-[400px] max-w-full shrink-0 overflow-hidden rounded bg-[#F3F4F6] dark:bg-white/5">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover ${videoOn ? '' : 'hidden'}`}
            />
            {!videoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[#111315]/50 dark:text-white/40">
                <VideoOff size={22} />
                <span className="text-[11px] font-medium">Camera Is Off</span>
              </div>
            )}

            {/* Preview controls */}
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2">
              <button
                type="button"
                onClick={() => setAudioOn((v) => !v)}
                className="flex h-[50px] w-16 flex-col items-center justify-center gap-1 rounded bg-white py-1.5 text-[10px] leading-[14px] text-black shadow-sm transition hover:bg-white/90 dark:bg-[#1c1c1c] dark:text-white"
              >
                {audioOn ? <Mic size={20} /> : <MicOff size={20} className="text-[#FF3B30]" />}
                Audio
              </button>
              <button
                type="button"
                onClick={() => setVideoOn((v) => !v)}
                className="flex h-[50px] w-16 flex-col items-center justify-center gap-1 rounded bg-white py-1.5 text-[10px] leading-[14px] text-black shadow-sm transition hover:bg-white/90 dark:bg-[#1c1c1c] dark:text-white"
              >
                {videoOn ? <Video size={20} /> : <VideoOff size={20} className="text-[#FF3B30]" />}
                Video
              </button>
            </div>
          </div>

          {/* Device pickers + note + actions */}
          <div className="flex min-h-[282px] w-[400px] max-w-full flex-col">
            <div className="flex w-full flex-col gap-3">
              {devicePicker('mic', <Mic size={16} />, micId, selectMic, mics, 'Default Microphone')}
              {devicePicker('cam', <Video size={16} />, camId, selectCam, cams, 'Default Camera')}
              {showSpeaker && devicePicker('speaker', <Volume2 size={16} />, speakerId, selectSpeaker, speakers, 'Default Speakers')}
            </div>

            <div className="mt-10 flex items-center gap-3">
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] bg-gradient-to-b from-[#FF8A00] to-[#FFB347]">
                <Check size={11} className="text-white" strokeWidth={3} />
              </span>
              <span className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#D1D1D1]">
                {note}
              </span>
            </div>

            {(error || mediaError) && (
              <p className="mt-2 text-[12px] font-medium text-red-500">{error || mediaError}</p>
            )}

            {/* Actions */}
            <div className="mt-auto flex w-full items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => !busy && onCancel()}
                disabled={busy}
                className="flex h-10 flex-1 items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={persistAndConfirm}
                disabled={busy}
                className="flex h-10 flex-1 items-center justify-center rounded-[32px] text-[14px] font-medium leading-5 text-white transition hover:brightness-105 disabled:opacity-60"
                style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
              >
                {busy ? 'Starting…' : resolvedConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
