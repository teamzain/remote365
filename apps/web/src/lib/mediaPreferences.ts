import { MEETING_PREF_KEYS } from '../components/MeetingPreviewModal';

/**
 * Audio/video hardware preferences shared between Settings → Audio and video,
 * the meeting preview modal and live meetings. Device choices live under the
 * same MEETING_PREF_KEYS the meeting UI already consumes, so picking a mic or
 * camera in Settings applies to the next media acquisition everywhere.
 */

export const readPreferredDevice = (key: string): string => {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
};

export const writePreferredDevice = (key: string, deviceId: string) => {
  try {
    if (deviceId && deviceId !== 'default') localStorage.setItem(key, deviceId);
    else localStorage.removeItem(key);
  } catch {}
};

export const getPreferredMicId = () => readPreferredDevice(MEETING_PREF_KEYS.mic);
export const getPreferredCameraId = () => readPreferredDevice(MEETING_PREF_KEYS.cam);
export const getPreferredSpeakerId = () => readPreferredDevice(MEETING_PREF_KEYS.speaker);

export const isNoiseSuppressionEnabled = () => localStorage.getItem('pref_noise_suppression') !== 'false';
export const isSpeakerMuted = () => localStorage.getItem('pref_speaker_muted') === 'true';

export const getOutputVolume = (): number => {
  const v = Number(localStorage.getItem('pref_output_volume') ?? 60);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v / 100)) : 0.6;
};

/** Audio constraints honoring the preferred mic + noise suppression toggle. */
export const preferredAudioConstraints = (): MediaTrackConstraints => {
  const micId = getPreferredMicId();
  return {
    ...(micId ? { deviceId: { ideal: micId } } : {}),
    noiseSuppression: isNoiseSuppressionEnabled(),
    echoCancellation: true,
  };
};

/**
 * Route a media element's audio through the preferred speaker at the chosen
 * output volume. Used on remote participant tiles; local previews stay muted.
 */
export const applyAudioOutputPrefs = async (el: HTMLMediaElement) => {
  try {
    const sink = getPreferredSpeakerId();
    if (sink && typeof (el as any).setSinkId === 'function') await (el as any).setSinkId(sink);
  } catch {} // device unplugged or sink unsupported — fall back to default output
  el.volume = getOutputVolume();
  el.muted = isSpeakerMuted();
};
