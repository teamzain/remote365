import React, { useState } from 'react';
import { SnowMeetingsHome } from '../SnowMeetingsHome';
import { SnowMeeting } from '../SnowMeeting';
import { useAuthStore } from '../../store/authStore';

/**
 * Web meetings surface. Renders the desktop `SnowMeetingsHome` lobby, and when a
 * meeting is created/joined mounts the desktop `SnowMeeting` in-call UI as a
 * full-screen overlay (the desktop opens it in a dedicated window; on web we
 * cover the viewport). Every Electron call inside those components is guarded
 * with browser fallbacks (getDisplayMedia, navigator.clipboard, localStorage).
 */
export const WebMeetingsHome: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  if (activeMeetingId) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#080808]">
        <SnowMeeting meetingId={activeMeetingId} onLeave={() => setActiveMeetingId(null)} />
      </div>
    );
  }

  return (
    <SnowMeetingsHome
      user={user}
      onJoinMeeting={(meetingId: string) => {
        const clean = String(meetingId || '').trim();
        if (clean) setActiveMeetingId(clean);
      }}
    />
  );
};

export default WebMeetingsHome;
