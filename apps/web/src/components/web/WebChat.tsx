import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SnowChat } from '../SnowChat';
import { WebChatMobile } from './WebChatMobile';
import { normalizeMeetingCode } from '../../lib/meetingLinks';
import { openSessionTab } from '../../lib/sessionLauncher';
import { useDeviceStore } from '../../store/deviceStore';

const VIEW_TO_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  devices: '/dashboard/devices',
  connect: '/dashboard/sessions',
  sessions: '/dashboard/sessions',
  meetings: '/dashboard/meetings',
  billing: '/dashboard/billing',
  settings: '/dashboard/settings',
  profile: '/dashboard/profile',
  support: '/dashboard/support',
  chat: '/dashboard/chat',
};

/**
 * Web wrapper for the desktop `SnowChat` real-time chat. Renders the desktop UI
 * and supplies browser-appropriate navigation handlers. Messaging/presence run
 * over the same chat WebSocket + REST API the desktop uses.
 */
export const WebChat: React.FC = () => {
  const navigate = useNavigate();
  const { devices, fetchDevices } = useDeviceStore();
  // Phones get the dedicated WebChatMobile experience — a separate design,
  // not a squeezed SnowChat. Desktop keeps the existing layout untouched.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  useEffect(() => {
    fetchDevices(true);
  }, [fetchDevices]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  if (isMobile) {
    return (
      <WebChatMobile
        onJoinMeeting={(meetingId: string) => navigate(`/meeting/${encodeURIComponent(normalizeMeetingCode(meetingId))}`)}
        onOpenDeviceMention={(accessKey: string) => openSessionTab(accessKey)}
      />
    );
  }

  return (
    <SnowChat
      setCurrentView={(view: string) => navigate(VIEW_TO_PATH[view] || '/dashboard')}
      localAuthKey={null}
      devicePassword=""
      serverIP={window.location.hostname}
      onJoinSessionInvite={() => navigate('/dashboard/sessions')}
      onJoinMeeting={(meetingId: string) => navigate(`/meeting/${encodeURIComponent(normalizeMeetingCode(meetingId))}`)}
      devices={devices}
      onOpenDeviceMention={(accessKey: string) => openSessionTab(accessKey)}
    />
  );
};

export default WebChat;
