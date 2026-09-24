/**
 * Meeting audio, decoupled from the video tiles.
 *
 * Why this exists: every participant's sound used to come out of their <video>
 * tile, which quietly made "can I hear everyone?" a question about LAYOUT. In
 * the spotlight/screen-share layout only two remotes ever get a tile — the big
 * one and the first side tile — and everyone past that collapses into a "+N"
 * badge with no element at all. An unmounted media element is not merely
 * invisible: Chromium tears its WebMediaPlayer down, so those participants'
 * voices were never rendered. That is the "only one person can be heard" bug,
 * and it also meant a voice cut out whenever someone started screen sharing
 * and the layout reshuffled.
 *
 * The fix is to stop making sound a property of the grid. Every participant
 * gets one <audio> element here, alive for as long as they are in the meeting,
 * regardless of which tile (if any) is on screen. The tiles keep the video and
 * are hard-muted, so nothing is ever played twice.
 *
 * The container is sized to zero rather than `display: none`, and is never
 * conditionally unmounted — staying laid out in the DOM is exactly the state
 * Chromium keeps a media player running in.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { applyAudioOutputPrefs } from '../../lib/mediaPreferences';

export type MeetingAudioParticipant = {
  connectionId: string;
  stream?: MediaStream;
  isLocal?: boolean;
};

const ParticipantAudio: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Track ids, not the track objects: a MediaStream is mutable, so the only
  // dependency React can compare across renders is a stable description of
  // what is currently on it. The parent also swaps in a fresh MediaStream
  // identity when a late track arrives, which covers the common case.
  const audioTrackKey = stream.getAudioTracks().map((track) => track.id).join(',');
  const audioStream = useMemo(() => {
    const tracks = stream.getAudioTracks();
    return tracks.length ? new MediaStream(tracks) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, audioTrackKey]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !audioStream) return;

    element.srcObject = audioStream;
    // Honour Settings → Audio and video: preferred speaker, output volume,
    // speaker mute. This is now the ONLY place those prefs need to land.
    void applyAudioOutputPrefs(element);

    const attemptPlay = () => { void element.play().catch(() => { /* retried on gesture below */ }); };
    attemptPlay();

    // Autoplay can be refused if the window has not been interacted with yet.
    // Without this retry the participant is simply silent forever, which looks
    // exactly like the bug we are fixing.
    const onGesture = () => attemptPlay();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      element.srcObject = null;
    };
  }, [audioStream]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

/**
 * Mount once, high in the meeting tree, and keep it mounted for the whole
 * call. Do not move it inside a layout branch — that would reintroduce the
 * exact coupling this component exists to remove.
 */
const ParticipantAudioMixer: React.FC<{ participants: MeetingAudioParticipant[] }> = ({ participants }) => (
  <div
    aria-hidden
    // Zero-sized and out of the way, but genuinely laid out: `display: none`
    // and unmounting both risk Chromium suspending the media player.
    style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
  >
    {participants.map((participant) => (
      // Never play the local participant back: that is a live mic loop into
      // the speakers, i.e. echo for everyone in the room.
      participant.stream && !participant.isLocal
        ? <ParticipantAudio key={participant.connectionId} stream={participant.stream} />
        : null
    ))}
  </div>
);

export default ParticipantAudioMixer;
