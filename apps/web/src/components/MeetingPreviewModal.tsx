import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, Check, ChevronDown } from 'lucide-react';
import logo from '../assets/logo.png';

/**
 * Pre-join "Meeting preview" dialog (Figma: join meeting preview, 854 x 390).
 * Two columns: a live camera preview with Audio / Video toggles on the left,
 * and microphone / camera / speaker pickers on the right. Every choice is
 * persisted to localStorage so {@link SnowMeeting} joins with the same
 * devices and the mic muted / camera off when they were turned off here.
 */

export const MEETING_PREF_KEYS = {
  mic: 'remote365_meeting_pref_mic',
  cam: 'remote365_meeting_pref_cam',
  speaker: 'remote365_meeting_pref_speaker',
  audio: 'remote365_meeting_pref_audio_enabled',
  video: 'remote365_meeting_pref_video_enabled',
} as const;

interface MeetingPreviewModalProps {
  open: boolean;
  mode: 'join' | 'create';
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const readPref = (key: string, fallback = '') => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const writePref = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage failures */
  }
};

export const MeetingPreviewModal: React.FC<MeetingPreviewModalProps> = ({
  open,
  mode,
  busy = false,
  error,
  onCancel,
  onConfirm,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [audioOn, setAudioOn] = useState(() => readPref(MEETING_PREF_KEYS.audio) !== 'false');
  const [videoOn, setVideoOn] = useState(() => readPref(MEETING_PREF_KEYS.video) !== 'false');
  const [mediaError, setMediaError] = useState('');
  // Device pickers — persisted immediately so the meeting (and the next
  // preview) acquires the same hardware. Empty string = browser default.
  const [micId, setMicId] = useState(() => readPref(MEETING_PREF_KEYS.mic));
  const [camId, setCamId] = useState(() => readPref(MEETING_PREF_KEYS.cam));
  const [speakerId, setSpeakerId] = useState(() => readPref(MEETING_PREF_KEYS.speaker));
  const [devices, setDevices] = useState<{ mics: MediaDeviceInfo[]; cams: MediaDeviceInfo[]; speakers: MediaDeviceInfo[] }>({
    mics: [],
    cams: [],
    speakers: [],
  });

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Device labels are only revealed after a getUserMedia grant, so this runs
  // after each (re-)acquisition of the preview stream.
  const refreshDevices = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        mics: list.filter((d) => d.kind === 'audioinput'),
        cams: list.filter((d) => d.kind === 'videoinput'),
        speakers: list.filter((d) => d.kind === 'audiooutput'),
      });
    } catch {
      /* enumeration unavailable — pickers just show Default */
    }
  };

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
      throw lastError ?? new DOMException('No media', 'NotFoundError');
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
      await refreshDevices();
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

  // Escape to cancel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const persistAndConfirm = () => {
    // Audio/video enabled state is always carried into the call — SnowMeeting
    // reads these keys when acquiring media and joins muted / camera-off.
    writePref(MEETING_PREF_KEYS.audio, String(audioOn));
    writePref(MEETING_PREF_KEYS.video, String(videoOn));
    // The preview stream is released by the close effect once the modal
    // actually closes, so the live preview persists during "Starting…".
    onConfirm();
  };

  const pickMic = (value: string) => { setMicId(value); writePref(MEETING_PREF_KEYS.mic, value); };
  const pickCam = (value: string) => { setCamId(value); writePref(MEETING_PREF_KEYS.cam, value); };
  const pickSpeaker = (value: string) => { setSpeakerId(value); writePref(MEETING_PREF_KEYS.speaker, value); };

  const confirmLabel = mode === 'create' ? 'Create' : 'Join';

  const devicePicker = (
    icon: React.ReactNode,
    label: string,
    value: string,
    options: MediaDeviceInfo[],
    onChange: (value: string) => void,
  ) => (
    <div className="relative flex h-10 w-full items-center gap-2.5 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 dark:border-white/20 dark:bg-transparent">
      <span className="shrink-0 text-[#111315] dark:text-white">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-full w-full flex-1 cursor-pointer appearance-none truncate bg-transparent pr-6 text-[14px] font-medium leading-5 text-[#111315] outline-none dark:text-white [&>option]:text-[#111315]"
      >
        <option value="">Default {label.toLowerCase()}</option>
        {options.map((device, index) => (
          <option key={device.deviceId || index} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-4 text-[#111315] dark:text-white" />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div className="flex w-full max-w-[854px] flex-col items-start gap-9 rounded-[12px] bg-white px-4 pb-8 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#101010]">
        {/* Header */}
        <div className="flex h-10 w-full items-center gap-2 py-[5px]">
          <img src={logo} alt="Remote365" className="h-6 w-6 rounded object-contain" />
          <span className="px-[5px] text-[14px] font-medium leading-5 text-[#111315] dark:text-white">
            Remote365 - Meeting preview
          </span>
        </div>

        {/* Body: preview left, device pickers right */}
        <div className="flex w-full flex-col items-stretch gap-[22px] lg:flex-row">
          {/* Camera preview */}
          <div className="relative h-[220px] w-full shrink-0 overflow-hidden rounded-[4px] bg-[#F3F4F6] dark:bg-white/5 sm:h-[282px] lg:w-[400px]">
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
                <span className="text-[11px] font-medium">Camera is off</span>
              </div>
            )}

            {/* Preview controls */}
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2">
              <button
                type="button"
                onClick={() => setAudioOn((v) => !v)}
                className="flex h-[50px] w-16 flex-col items-center justify-center gap-1 rounded-[4px] bg-white py-1.5 text-[10px] leading-[14px] text-black shadow-sm transition hover:bg-white/90 dark:bg-[#1c1c1c] dark:text-white"
              >
                {audioOn ? <Mic size={20} /> : <MicOff size={20} className="text-[#FF3B30]" />}
                Audio
              </button>
              <button
                type="button"
                onClick={() => setVideoOn((v) => !v)}
                className="flex h-[50px] w-16 flex-col items-center justify-center gap-1 rounded-[4px] bg-white py-1.5 text-[10px] leading-[14px] text-black shadow-sm transition hover:bg-white/90 dark:bg-[#1c1c1c] dark:text-white"
              >
                {videoOn ? <Video size={20} /> : <VideoOff size={20} className="text-[#FF3B30]" />}
                Video
              </button>
            </div>
          </div>

          {/* Right column: device pickers, note, actions */}
          <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
            <div className="flex flex-col gap-8 lg:gap-[56px]">
              <div className="flex flex-col gap-3">
                {devicePicker(<Mic size={16} />, 'Microphone', micId, devices.mics, pickMic)}
                {devicePicker(<Video size={16} />, 'Camera', camId, devices.cams, pickCam)}
                {devicePicker(<Volume2 size={16} />, 'Speaker', speakerId, devices.speakers, pickSpeaker)}
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] bg-gradient-to-b from-[#FF8A00] to-[#FFB347]">
                  <Check size={11} className="text-white" strokeWidth={3} />
                </span>
                <span className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#D1D1D1]">
                  Your audio and video choices are kept when you join
                </span>
              </div>
            </div>

            {(error || mediaError) && (
              <p className="-mt-3 text-[12px] font-medium text-red-500">{error || mediaError}</p>
            )}

            {/* Actions */}
            <div className="mt-auto flex w-full items-center gap-2">
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
                {busy ? 'Starting…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
