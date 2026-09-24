import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, Volume1, Volume2, Video, Settings as SettingsIcon, Check } from 'lucide-react';
import { MEETING_PREF_KEYS } from './MeetingPreviewModal';

/**
 * In-meeting "Settings" panel (Figma: Settings, 400px docked).
 * Microphone / Speaker / Video device configuration with live camera preview,
 * a mic level test and a speaker test tone. Device choices persist to
 * {@link MEETING_PREF_KEYS} and apply the next time media is acquired.
 */

interface MeetingSettingsPanelProps {
  stream: MediaStream | null;
  cameraOff: boolean;
  onClose: () => void;
  onOpenAdvanced: () => void;
}

const readPref = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};
const writePref = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

export const MeetingSettingsPanel: React.FC<MeetingSettingsPanelProps> = ({
  stream,
  cameraOff,
  onClose,
  onOpenAdvanced,
}) => {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState(() => readPref(MEETING_PREF_KEYS.mic));
  const [speakerId, setSpeakerId] = useState(() => readPref(MEETING_PREF_KEYS.speaker));
  const [camId, setCamId] = useState(() => readPref(MEETING_PREF_KEYS.cam));

  const [micVolume, setMicVolume] = useState(70);
  const [speakerVolume, setSpeakerVolume] = useState(70);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [followFace, setFollowFace] = useState(false);

  const [testingMic, setTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Populate device lists (labels available once the call has media permission).
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (cancelled) return;
        setMics(all.filter((d) => d.kind === 'audioinput'));
        setSpeakers(all.filter((d) => d.kind === 'audiooutput'));
        setCams(all.filter((d) => d.kind === 'videoinput'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror the live local stream into the camera preview.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, cameraOff]);

  // Live mic level meter while "Test" is active.
  useEffect(() => {
    if (!testingMic || !stream || stream.getAudioTracks().length === 0) {
      setMicLevel(0);
      return;
    }
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
      setMicLevel(Math.min(1, peak / 90));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close().catch(() => {});
      setMicLevel(0);
    };
  }, [testingMic, stream]);

  const selectMic = (id: string) => { setMicId(id); writePref(MEETING_PREF_KEYS.mic, id); };
  const selectSpeaker = (id: string) => { setSpeakerId(id); writePref(MEETING_PREF_KEYS.speaker, id); };
  const selectCam = (id: string) => { setCamId(id); writePref(MEETING_PREF_KEYS.cam, id); };

  const playTestSound = () => {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 528;
    gain.gain.value = Math.max(0.0001, (speakerMuted ? 0 : speakerVolume / 100) * 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => ctx.close().catch(() => {});
  };

  const litBars = Math.round(micLevel * 9);

  return (
    <div className="absolute right-0 top-0 bottom-0 z-10 flex w-[400px] max-w-[calc(100%-1rem)] flex-col overflow-hidden bg-white font-['Mona_Sans',system-ui,sans-serif] shadow-[-8px_0_24px_rgba(0,0,0,0.06)] animate-in fade-in duration-150">
      {/* Header */}
      <div className="relative flex flex-shrink-0 items-center justify-center border-b border-[#1A1D21]/10 px-6 py-4">
        <h3 className="text-[16px] font-semibold leading-[23px] text-black">Settings</h3>
        <button
          onClick={onClose}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-[#111315] transition-opacity hover:opacity-60"
          aria-label="Close Settings"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        {/* Microphone */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            title="Microphone"
            subtitle="Configure all the required settings so that the end user can hear you."
          />
          <Field label="Input Device">
            <Select value={micId} onChange={selectMic} options={mics} placeholder="Default Microphone" />
          </Field>
          <VolumeSlider value={micVolume} onChange={setMicVolume} />

          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h4 className="text-[16px] font-semibold leading-[23px] text-black">Test Microphone</h4>
              <p className="text-[14px] leading-5 text-black">Say something to test your input.</p>
            </div>
            <button
              onClick={() => setTestingMic((v) => !v)}
              className="h-10 flex-shrink-0 rounded border border-[#1A1D21]/30 px-4 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
            >
              {testingMic ? 'Stop' : 'Test'}
            </button>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className={`h-10 flex-1 rounded-[2px] border-[0.5px] border-[#1A1D21]/20 transition-colors ${
                  i < litBars ? 'bg-[#FF8A00]' : 'bg-[#F3F4F6]'
                }`}
              />
            ))}
          </div>

          <ToggleRow
            title="Noise Suppression"
            subtitle="Reduces background noise during sessions."
            on={noiseSuppression}
            onChange={setNoiseSuppression}
          />
        </section>

        <div className="h-px bg-[#1A1D21]/20" />

        {/* Speaker */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            title="Speaker"
            subtitle="Configure all the required settings so that you can hear the end user."
          />
          <Field label="Output Device">
            <Select value={speakerId} onChange={selectSpeaker} options={speakers} placeholder="Default Speaker" />
          </Field>
          <VolumeSlider value={speakerVolume} onChange={setSpeakerVolume} />

          <div className="flex items-center justify-between gap-4">
            <h4 className="text-[16px] font-semibold leading-[23px] text-black">Play Test Sound</h4>
            <button
              onClick={playTestSound}
              className="h-10 flex-shrink-0 rounded border border-[#1A1D21]/30 px-4 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
            >
              Play
            </button>
          </div>

          <ToggleRow title="Mute" on={speakerMuted} onChange={setSpeakerMuted} />
        </section>

        <div className="h-px bg-[#1A1D21]/20" />

        {/* Video */}
        <section className="flex flex-col gap-4">
          <SectionHeading
            title="Video"
            subtitle="Configure all the required settings for the best video experience."
          />
          <div className="flex flex-col gap-1">
            <h4 className="text-[16px] font-semibold leading-[23px] text-black">Camera Preview</h4>
            <p className="text-[14px] leading-5 text-black">Live camera preview here.</p>
          </div>
          <div className="relative h-[200px] w-full overflow-hidden rounded bg-[#F3F4F6]">
            {stream && !cameraOff ? (
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="absolute bottom-2 left-2 text-[#1A1D21]/30">
                <Video size={24} />
              </div>
            )}
          </div>
          <Field label="Camera">
            <Select value={camId} onChange={selectCam} options={cams} placeholder="Default Camera" />
          </Field>
          <ToggleRow
            title="Follow My Face"
            subtitle="The camera will keep your face in center."
            on={followFace}
            onChange={setFollowFace}
          />
        </section>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-[#1A1D21]/10 px-6 py-4">
        <button
          onClick={onOpenAdvanced}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#F3F4F6] text-[14px] font-medium text-[#111315] transition-colors hover:bg-[#E9EAEC]"
        >
          <SettingsIcon size={16} />
          Advanced Settings
        </button>
      </div>
    </div>
  );
};

const SectionHeading: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col gap-1">
    <h3 className="text-[16px] font-semibold leading-[23px] text-black">{title}</h3>
    <p className="text-[14px] leading-5 text-black">{subtitle}</p>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[14px] leading-5 text-[#111315]">{label}</span>
    {children}
  </div>
);

const VolumeSlider: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <Volume1 size={22} className="flex-shrink-0 text-[#1A1D21]" />
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[#1A1D21]/30 accent-[#FF8A00]"
    />
    <Volume2 size={22} className="flex-shrink-0 text-[#111315]" />
  </div>
);

const ToggleRow: React.FC<{ title: string; subtitle?: string; on: boolean; onChange: (v: boolean) => void }> = ({
  title,
  subtitle,
  on,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex flex-col gap-0.5">
      <h4 className="text-[16px] font-semibold leading-[23px] text-black">{title}</h4>
      {subtitle && <p className="text-[14px] leading-5 text-black">{subtitle}</p>}
    </div>
    <Toggle on={on} onChange={onChange} />
  </div>
);

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
      on ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFB347]' : 'bg-[#1A1D21]/30'
    }`}
    aria-pressed={on}
  >
    <span
      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-all ${
        on ? 'left-[18px]' : 'left-[2px]'
      }`}
    />
  </button>
);

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: MediaDeviceInfo[];
  placeholder: string;
}

const Select: React.FC<SelectProps> = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const label = (d: MediaDeviceInfo, i: number) => d.label || `${placeholder} ${i + 1}`;
  const selected = options.find((d) => d.deviceId === value && value);
  const triggerLabel = selected ? label(selected, options.indexOf(selected)) : placeholder;

  return (
    <div ref={ref} className={`relative ${open ? 'z-20' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded border border-[#1A1D21]/30 bg-white px-4 text-left transition-colors hover:border-[#FF8A00]/60"
      >
        <span className="truncate text-[14px] leading-5 text-[#111315]">{triggerLabel}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-[#111315] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] max-h-52 overflow-y-auto rounded-lg border border-[#1A1D21]/15 bg-white p-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          <Option active={!value} label={placeholder} onClick={() => { onChange(''); setOpen(false); }} />
          {options.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-[#111315]/50">No Devices Found</div>
          )}
          {options.map((d, i) => (
            <Option
              key={d.deviceId || i}
              active={d.deviceId === value}
              label={label(d, i)}
              onClick={() => { onChange(d.deviceId); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Option: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[14px] font-medium transition-colors ${
      active ? 'bg-[#FF8A00]/10 text-[#FF8A00]' : 'text-[#111315] hover:bg-black/5'
    }`}
  >
    <span className="truncate">{label}</span>
    {active && <Check size={15} className="flex-shrink-0" />}
  </button>
);
