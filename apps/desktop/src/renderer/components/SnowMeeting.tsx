import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Users,
  Settings, Share, MessageSquare,
  MoreVertical, X, Copy, Mail, CheckCircle2, RefreshCw, MousePointer2, Send,
  ScreenShare, ScreenShareOff, Volume2, User, Info, Pause, Play, Check, Maximize2
} from 'lucide-react';
import logo from '../../logo.png';

const formatElapsed = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

const meetingInitials = (name?: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Disconnect / leave-meeting glyph (monitor with an X).
const DisconnectIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.8346 2.5H3.33464C2.89261 2.5 2.46868 2.67559 2.15612 2.98816C1.84356 3.30072 1.66797 3.72464 1.66797 4.16667V12.5C1.66797 12.942 1.84356 13.366 2.15612 13.6785C2.46868 13.9911 2.89261 14.1667 3.33464 14.1667H16.668C17.11 14.1667 17.5339 13.9911 17.8465 13.6785C18.159 13.366 18.3346 12.942 18.3346 12.5V10M6.66797 17.5H13.3346M10.0013 14.1667V17.5M18.3346 2.5L14.168 6.66667M14.168 2.5L18.3346 6.66667"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { MEETING_PREF_KEYS } from './MeetingPreviewModal';
import { isNoiseSuppressionEnabled } from '../lib/mediaPreferences';
import ParticipantAudioMixer from './meeting/ParticipantAudioMixer';
import { ScreenShareModal } from './ScreenShareModal';
import { MeetingSettingsPanel } from './MeetingSettingsPanel';
import { buildMeetingWebUrl, buildSignalUrl, DEFAULT_SERVER_HOST } from '../utils/server';

const readMeetingPref = (key: string, fallback = '') => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

interface Participant {
  connectionId: string;
  stream?: MediaStream;
  user?: {
    id: string;
    name: string;
    avatar?: string;
    clientKind?: string;
  };
  mediaState?: {
    isMuted: boolean;
    isCameraOff: boolean;
    isScreenSharing?: boolean;
  };
  isLocal?: boolean;
}

interface SnowMeetingProps {
  meetingId: string;
  onLeave: () => void;
  /** The meeting was created by this client (landing page, maybe signed
   *  out): claim the host seat of the new room instead of waiting for a
   *  host who does not exist. */
  claimHost?: boolean;
  hostAccessKey?: string | null;
  devicePassword?: string;
  serverIP?: string;
}

interface MeetingChatMessage {
  id: string;
  senderConnectionId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

interface ControlRequest {
  requestId: string;
  requesterConnectionId: string;
  requesterName: string;
}

const normalizeMeetingCode = (value: string) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const getMeetingWsUrl = () => {
  const envUrl = import.meta.env.VITE_SIGNAL_URL;
  return normalizeMeetingSignalUrl(envUrl);
};

const normalizeMeetingSignalUrl = (value?: string) => {
  try {
    return buildSignalUrl(value);
  } catch {
    return buildSignalUrl();
  }
};

const formatMeetingCode = (value: string) => {
  const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length === 9) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
  return clean || String(value || '').trim();
};

export const SnowMeeting: React.FC<SnowMeetingProps> = ({ meetingId, onLeave, claimHost = false, hostAccessKey, devicePassword, serverIP = DEFAULT_SERVER_HOST }) => {
  const { user } = useAuthStore();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [activeLayout, setActiveLayout] = useState<'grid' | 'focus' | 'list'>('grid');
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);
  const [openRosterMenu, setOpenRosterMenu] = useState<string | null>(null);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  // Waiting room: set while the host has yet to admit us; carries a message
  // once the host declines.
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);
  // False until the server confirms meeting-joined. The full-screen cover
  // shows from the very first frame ("Joining…", then "Waiting For Host…")
  // so a guest never sees a flash of the empty meeting grid while media and
  // the join round-trip settle.
  const [hasEnteredMeeting, setHasEnteredMeeting] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCopied, setInviteCopied] = useState<'link' | 'code' | null>(null);
  // Header chip: flips to "Copied" briefly after clicking the meeting code.
  const [headerCodeCopied, setHeaderCodeCopied] = useState(false);
  const [showEmailInvite, setShowEmailInvite] = useState(false);
  const [pendingGuests, setPendingGuests] = useState<{ id: string; name: string }[]>([]);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  // connectionId -> display name of participants currently typing in the chat.
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingClearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [controlRequest, setControlRequest] = useState<ControlRequest | null>(null);
  const [controlStatus, setControlStatus] = useState('');
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  // Host side: a participant is asking to share their screen.
  const [shareRequest, setShareRequest] = useState<{ requesterConnectionId: string; requesterName: string } | null>(null);
  // Participant side: waiting for the host to approve our share request.
  const [awaitingShareApproval, setAwaitingShareApproval] = useState(false);
  // Host-set meeting permissions, mirrored to every participant.
  const [meetingPolicy, setMeetingPolicy] = useState<{ allowScreenShare: boolean }>({ allowScreenShare: false });
  // Small in-meeting banner for request outcomes (e.g. "request denied").
  const [noticeToast, setNoticeToast] = useState<string | null>(null);
  const [shareSystemAudio, setShareSystemAudio] = useState(() => localStorage.getItem('remote365_meeting_share_system_audio') === 'true');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showEndOptions, setShowEndOptions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showRecordingMenu, setShowRecordingMenu] = useState(false);
  const [showRecordingToast, setShowRecordingToast] = useState(false);
  // Server-synchronized recording state: null, or the name of whoever is
  // recording. Every participant sees this — including late joiners, whose
  // meeting-joined ack carries it. Distinct from isRecording, which is only
  // "am I the one recording".
  const [recordingBy, setRecordingBy] = useState<string | null>(null);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const mediaStateRef = useRef({ isMuted: false, isCameraOff: false, isScreenSharing: false });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const startRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
    setShowMoreMenu(false);
    setShowRecordingToast(true);
    // Tell every participant, via the server so the state is authoritative and
    // late joiners are informed too. The server dedupes re-sends.
    ws?.send(JSON.stringify({ type: 'meeting-recording', meetingId: roomId, on: true }));
  };
  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setShowRecordingMenu(false);
    setShowRecordingToast(false);
    ws?.send(JSON.stringify({ type: 'meeting-recording', meetingId: roomId, on: false }));
  };

  // Recording notices (started/stopped/recorder-left) auto-dismiss; the
  // persistent fact that someone is recording lives in the header pill.
  useEffect(() => {
    if (!recordingNotice) return;
    const timer = setTimeout(() => setRecordingNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [recordingNotice]);

  // Auto-dismiss the recording info toast.
  useEffect(() => {
    if (!showRecordingToast) return;
    const timer = setTimeout(() => setShowRecordingToast(false), 6000);
    return () => clearTimeout(timer);
  }, [showRecordingToast]);

  // Auto-dismiss request-outcome notices.
  useEffect(() => {
    if (!noticeToast) return;
    const timer = setTimeout(() => setNoticeToast(null), 5000);
    return () => clearTimeout(timer);
  }, [noticeToast]);

  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showChatPanel) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, showChatPanel]);

  // Clear pending typing timers on unmount so setState never fires afterwards.
  useEffect(() => {
    const timers = typingClearTimersRef.current;
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const participantUsersRef = useRef<Map<string, { id: string; name: string; avatar?: string }>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const sidebarLocalVideoRef = useRef<HTMLVideoElement>(null);
  const hasJoinedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const placeholderVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const roomId = normalizeMeetingCode(meetingId);
  const meetingCode = formatMeetingCode(roomId);
  // Web join page (not remote365://): works for invitees without the app and
  // offers an "open in app" hand-off to those who have it.
  const meetingLink = buildMeetingWebUrl(meetingCode);

  useEffect(() => {
    const meetingSocket = new WebSocket(getMeetingWsUrl());
    setWs(meetingSocket);
    meetingSocket.onopen = () => {
      console.info(`[Meeting] Signaling connected for room ${roomId || '(pending)'}`);
    };
    meetingSocket.onerror = () => {
      setMeetingError('Meeting connection failed. Please check your internet connection.');
    };
    meetingSocket.onclose = () => {
      setWs((current) => current === meetingSocket ? null : current);
    };

    return () => {
      hasJoinedRef.current = false;
      meetingSocket.close();
    };
  }, [roomId]);

  const sendMeetingSignal = (targetConnectionId: string, signal: any) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'meeting-signal',
      meetingId: roomId,
      targetConnectionId,
      signal
    }));
  };

  const renegotiatePeer = async (targetId: string, pc: RTCPeerConnection) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || pc.signalingState !== 'stable') return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendMeetingSignal(targetId, offer);
  };

  const getPeerTransceiver = (pc: RTCPeerConnection, kind: 'audio' | 'video') => (
    pc.getTransceivers().find((item) => item.sender.track?.kind === kind || item.receiver.track?.kind === kind)
  );

  // One stable stream identity shared by both outgoing transceivers. It puts a
  // real a=msid on our m-lines, so the receiver's ontrack delivers ONE stream
  // carrying mic + camera together. Bare addTransceiver(kind) sent msid-less
  // tracks: receivers minted a per-track stream, attached their <video> while
  // it only held video, and the audio track grafted in later never played —
  // the "video works but nobody hears me" regression.
  const outboundStreamRef = useRef<MediaStream | null>(null);
  const getOutboundStream = () => {
    if (!outboundStreamRef.current) outboundStreamRef.current = new MediaStream();
    return outboundStreamRef.current;
  };

  const attachOutgoingTracks = async (pc: RTCPeerConnection, createMissing = false) => {
    const videoTrack = getOutgoingVideoTrack();
    const audioTrack = getOutgoingAudioTrack();
    const tracks: Array<['video' | 'audio', MediaStreamTrack | null]> = [
      ['video', videoTrack],
      ['audio', audioTrack]
    ];

    for (const [kind, track] of tracks) {
      let transceiver = getPeerTransceiver(pc, kind);
      if (!transceiver && createMissing) {
        transceiver = pc.addTransceiver(kind, { direction: 'sendrecv', streams: [getOutboundStream()] });
      }
      if (transceiver) {
        transceiver.direction = 'sendrecv';
        await transceiver.sender.replaceTrack(track);
      }
    }
  };

  const flushPendingIceCandidates = async (targetId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceCandidatesRef.current.get(targetId) || [];
    pendingIceCandidatesRef.current.delete(targetId);
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
        console.warn('[Meeting] Queued ICE candidate failed:', err);
      });
    }
  };

  const replacePeerTrack = async (kind: 'audio' | 'video', track: MediaStreamTrack | null, renegotiate = false) => {
    await Promise.all([...peersRef.current.entries()].map(async ([targetId, pc]) => {
      let shouldRenegotiate = renegotiate;
      let transceiver = getPeerTransceiver(pc, kind);
      if (!transceiver) {
        transceiver = pc.addTransceiver(kind, { direction: 'sendrecv', streams: [getOutboundStream()] });
        shouldRenegotiate = true;
      }
      transceiver.direction = 'sendrecv';
      await transceiver.sender.replaceTrack(track);
      if (shouldRenegotiate) await renegotiatePeer(targetId, pc);
    }));
  };

  const getPlaceholderVideoTrack = () => {
    if (placeholderVideoTrackRef.current?.readyState === 'live') return placeholderVideoTrackRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 9;
    const context = canvas.getContext('2d');
    context!.fillStyle = '#151515';
    context!.fillRect(0, 0, canvas.width, canvas.height);
    const stream = canvas.captureStream(1);
    const track = stream.getVideoTracks()[0];
    placeholderVideoTrackRef.current = track;
    return track;
  };

  const getOutgoingVideoTrack = () => (
    screenStreamRef.current?.getVideoTracks()[0]
    || localStreamRef.current?.getVideoTracks()[0]
    || getPlaceholderVideoTrack()
  );

  const getOutgoingAudioTrack = () => {
    const screenAudio = screenStreamRef.current?.getAudioTracks()[0] || null;
    return (shareSystemAudio && screenAudio)
      ? screenAudio
      : (localStreamRef.current?.getAudioTracks()[0] || null);
  };

  const setMediaFlags = (next: Partial<typeof mediaStateRef.current>) => {
    mediaStateRef.current = { ...mediaStateRef.current, ...next };
  };

  const currentMediaState = () => mediaStateRef.current;

  const publishMediaState = (nextMuted = mediaStateRef.current.isMuted, nextCameraOff = mediaStateRef.current.isCameraOff, nextScreenSharing = mediaStateRef.current.isScreenSharing) => {
    setMediaFlags({ isMuted: nextMuted, isCameraOff: nextCameraOff, isScreenSharing: nextScreenSharing });
    if (!ws || ws.readyState !== WebSocket.OPEN || !hasJoinedRef.current) return;
    ws.send(JSON.stringify({
      type: 'meeting-media-state',
      meetingId: roomId,
      mediaState: {
        isMuted: nextMuted,
        isCameraOff: nextCameraOff,
        isScreenSharing: nextScreenSharing
      }
    }));
  };

  const sendMediaState = (nextMuted = isMuted, nextCameraOff = isCameraOff) => {
    publishMediaState(nextMuted, nextCameraOff, isScreenSharing);
  };

  const getAvailableMediaStream = async (wantVideo = true) => {
    const preferredCamId = readMeetingPref(MEETING_PREF_KEYS.cam);
    const preferredMicId = readMeetingPref(MEETING_PREF_KEYS.mic);
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const hasCamera = wantVideo && devices.some((device) => device.kind === 'videoinput');
    const hasMic = devices.some((device) => device.kind === 'audioinput');

    if (hasCamera || hasMic) {
      return navigator.mediaDevices.getUserMedia({
        video: hasCamera ? (preferredCamId ? { deviceId: { ideal: preferredCamId } } : true) : false,
        audio: hasMic ? {
          ...(preferredMicId ? { deviceId: { ideal: preferredMicId } } : {}),
          noiseSuppression: isNoiseSuppressionEnabled(),
          echoCancellation: true,
        } : false
      });
    }

    const attempts: MediaStreamConstraints[] = [
      ...(wantVideo ? [{ video: true, audio: true }, { video: true, audio: false }] : []),
      { video: false, audio: true }
    ];

    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') continue;
        throw err;
      }
    }

    throw new DOMException('No camera or microphone was found.', 'NotFoundError');
  };

  const requestMedia = async () => {
      try {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        const audioPref = readMeetingPref(MEETING_PREF_KEYS.audio) !== 'false';
        const videoPref = readMeetingPref(MEETING_PREF_KEYS.video) !== 'false';
        // Don't power on the webcam when the user chose to join with video off —
        // acquiring it just to disable the track leaves the camera light on.
        const stream = await getAvailableMediaStream(videoPref);
        const nextCameraOff = stream.getVideoTracks().length === 0 || !videoPref;
        const nextMuted = stream.getAudioTracks().length === 0 || !audioPref;
        stream.getVideoTracks().forEach(t => { t.enabled = !nextCameraOff; });
        stream.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaFlags({ isMuted: nextMuted, isCameraOff: nextCameraOff, isScreenSharing: false });
        setIsCameraOff(nextCameraOff);
        setIsMuted(nextMuted);
        setMediaReady(true);
        setMeetingError(null);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (!screenStreamRef.current && peersRef.current.size) {
          await replacePeerTrack('video', stream.getVideoTracks()[0] || getPlaceholderVideoTrack(), true);
          await replacePeerTrack('audio', stream.getAudioTracks()[0] || null, true);
          publishMediaState(nextMuted, nextCameraOff, false);
        }
      } catch (err) {
        console.info('[Meeting] Camera or microphone unavailable. Joining without local media.', err);
        localStreamRef.current = null;
        setLocalStream(null);
        setMediaReady(true);
        setMediaFlags({ isMuted: true, isCameraOff: true, isScreenSharing: false });
        setIsCameraOff(true);
        setIsMuted(true);
        setMeetingError(null);
      }
  };

  // Initialize Media
  useEffect(() => {
    requestMedia();

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      placeholderVideoTrackRef.current?.stop();
      peersRef.current.forEach(pc => pc.close());
    };
  }, []);

  // Re-sync localVideoRef srcObject after the video element remounts when screen-sharing toggles.
  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = isScreenSharing && screenStreamRef.current
      ? screenStreamRef.current
      : (localStreamRef.current ?? null);
  }, [isScreenSharing, localStream]);

  // Keep sidebar camera tile in sync with the camera stream.
  useEffect(() => {
    if (!sidebarLocalVideoRef.current) return;
    sidebarLocalVideoRef.current.srcObject = localStreamRef.current ?? null;
  }, [isScreenSharing, localStream]);

  useEffect(() => {
    async function joinMeeting() {
      if (!ws || ws.readyState !== WebSocket.OPEN || !mediaReady || hasJoinedRef.current) return;

      const token = (window as any).electronAPI
        ? (await (window as any).electronAPI.getToken())?.token
        : localStorage.getItem('access_token');

      hasJoinedRef.current = true;
      ws.send(JSON.stringify({
        type: 'meeting-join',
        meetingId: roomId,
        token,
        user: { id: user?.id, name: user?.name, avatar: user?.avatar },
        clientKind: 'desktop',
        mediaState: currentMediaState(),
        claimHost
      }));
    }

    joinMeeting();
    if (ws && ws.readyState !== WebSocket.OPEN) {
      ws.addEventListener('open', joinMeeting, { once: true });
      return () => ws.removeEventListener('open', joinMeeting);
    }
  }, [ws, mediaReady, roomId, user?.id, user?.name, user?.avatar]);

  // Signaling Listener integration
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'meeting-waiting':
          // Held in the lobby — the host must accept before we can enter.
          setWaitingForHost(true);
          setDeniedMessage(null);
          setMeetingError(null);
          break;

        case 'meeting-denied':
          // The host declined (or the meeting ended before we were let in).
          setWaitingForHost(true);
          setDeniedMessage(data.error || 'The host declined your request to join.');
          break;

        case 'meeting-joined':
          console.info(`[Meeting] Joined ${data.meetingId} with ${data.participants?.length || 0} remote participants.`);
          if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            iceServersRef.current = data.iceServers;
          }
          setWaitingForHost(false);
          setDeniedMessage(null);
          setMeetingError(null);
          setHasEnteredMeeting(true);
          setIsHost(Boolean(data.isHost));
          if (data.policy) setMeetingPolicy({ allowScreenShare: Boolean(data.policy.allowScreenShare) });
          if (data.recording?.byName) {
            setRecordingBy(data.recording.byName);
            setRecordingNotice(`${data.recording.byName} is recording this meeting.`);
          }
          // Existing participants
          data.participants.forEach((p: any) => {
            if (p.user?.name) participantUsersRef.current.set(p.connectionId, p.user);
            setParticipants(prev => {
              const existing = prev.find(item => item.connectionId === p.connectionId);
              if (existing) {
                // A peer track may have created a placeholder entry first — merge the real identity in.
                return prev.map(item => item.connectionId === p.connectionId
                  ? { ...item, user: p.user || item.user, mediaState: p.mediaState || item.mediaState }
                  : item);
              }
              return [...prev, { ...p }];
            });
            initiatePeerConnection(p.connectionId, true).catch((err) => console.warn('[Meeting] Peer init failed:', err));
          });
          break;

        case 'meeting-recording':
          if (data.on) {
            setRecordingBy(data.byName || 'A Participant');
            setRecordingNotice(`${data.byName || 'A Participant'} started recording this meeting.`);
          } else {
            setRecordingBy(null);
            setRecordingNotice(data.reason === 'recorder-left'
              ? `${data.byName || 'The Recorder'} left; recording stopped.`
              : `${data.byName || 'A Participant'} stopped recording.`);
          }
          break;

        case 'meeting-chat':
          if (data.message) {
            setChatMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
            if (data.message.senderConnectionId !== 'local') {
              setShowChatPanel(true);
              // Their message means they've stopped typing.
              const cid = data.message.senderConnectionId;
              const existing = typingClearTimersRef.current.get(cid);
              if (existing) { clearTimeout(existing); typingClearTimersRef.current.delete(cid); }
              setTypingUsers(prev => {
                if (!prev[cid]) return prev;
                const next = { ...prev }; delete next[cid]; return next;
              });
            }
          }
          break;

        case 'meeting-typing': {
          const cid = data.senderConnectionId;
          if (cid && cid !== 'local') {
            const timers = typingClearTimersRef.current;
            const existing = timers.get(cid);
            if (existing) { clearTimeout(existing); timers.delete(cid); }
            if (data.isTyping) {
              setTypingUsers(prev => ({ ...prev, [cid]: data.senderName || 'Someone' }));
              const t = setTimeout(() => {
                setTypingUsers(prev => { const next = { ...prev }; delete next[cid]; return next; });
                timers.delete(cid);
              }, 4000);
              timers.set(cid, t);
            } else {
              setTypingUsers(prev => { const next = { ...prev }; delete next[cid]; return next; });
            }
          }
          break;
        }

        case 'meeting-knock':
          // A guest is waiting in the lobby to be admitted.
          setPendingGuests(prev => prev.some(g => g.id === data.guestId) ? prev : [...prev, { id: data.guestId, name: data.guestName || 'Guest' }]);
          setShowInvitePanel(true);
          setShowChatPanel(false);
          setShowSettingsPanel(false);
          break;

        case 'meeting-knock-cancelled':
          setPendingGuests(prev => prev.filter(g => g.id !== data.guestId));
          break;

        case 'meeting-control-request':
          setControlRequest({
            requestId: data.requestId,
            requesterConnectionId: data.requesterConnectionId,
            requesterName: data.requesterName || 'Participant'
          });
          break;

        case 'meeting-control-response':
          handleControlResponse(data);
          break;

        case 'meeting-share-request':
          // Host: a participant is asking permission to share their screen.
          setShareRequest({
            requesterConnectionId: data.requesterConnectionId,
            requesterName: data.requesterName || 'Participant'
          });
          break;

        case 'meeting-share-response':
          // Participant: the host answered our screen-share request.
          setAwaitingShareApproval(false);
          if (data.allowed) {
            setShowScreenShareModal(true);
          } else {
            setNoticeToast('Your screen sharing request was denied by the host.');
          }
          break;

        case 'meeting-policy':
          // Host changed meeting permissions (e.g. free screen sharing).
          setMeetingPolicy({ allowScreenShare: Boolean(data.policy?.allowScreenShare) });
          break;

        case 'meeting-error':
          setMeetingError(data.error || 'Could not join this meeting.');
          break;

        case 'meeting-participant-joined':
          // New participant
          if (data.participant.user?.name) participantUsersRef.current.set(data.participant.connectionId, data.participant.user);
          initiatePeerConnection(data.participant.connectionId, false).catch((err) => console.warn('[Meeting] Peer init failed:', err));
          setParticipants(prev => {
            const existing = prev.find(p => p.connectionId === data.participant.connectionId);
            if (existing) {
              // Merge the real identity onto a placeholder entry created by an early peer track.
              return prev.map(item => item.connectionId === data.participant.connectionId
                ? { ...item, user: data.participant.user || item.user, mediaState: data.participant.mediaState || item.mediaState }
                : item);
            }
            return [...prev, { ...data.participant }];
          });
          break;

        case 'meeting-media-state':
          setParticipants(prev => prev.map(p =>
            p.connectionId === data.participantConnectionId
              ? { ...p, mediaState: data.mediaState }
              : p
          ));
          break;

        case 'meeting-mute-request':
        case 'meeting-mute-all': {
          // A host asked us to change our mic. Mute-all only ever silences;
          // a targeted request can also unmute.
          const wantMuted = data.type === 'meeting-mute-all' ? true : Boolean(data.muted);
          localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !wantMuted; });
          setIsMuted(wantMuted);
          publishMediaState(wantMuted);
          break;
        }

        case 'meeting-signal':
          handlePeerSignal(data.senderConnectionId, data.signal);
          break;

        case 'meeting-participant-left':
          removeParticipant(data.participantConnectionId);
          break;

        case 'meeting-ended':
          // The host ended the meeting for everyone.
          onLeave();
          break;
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, localStream]);

  const createPeerConnection = (targetId: string) => {
    const existing = peersRef.current.get(targetId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current
    });

    peersRef.current.set(targetId, pc);

    pc.onicecandidate = (e) => {
      if (e.candidate && ws) {
        sendMeetingSignal(targetId, { type: 'candidate', candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (!stream.getTracks().includes(e.track)) {
        stream.addTrack(e.track);
      }
      setParticipants(prev => {
        const existing = prev.find((p) => p.connectionId === targetId);
        if (!existing) {
          const knownUser = participantUsersRef.current.get(targetId);
          return [...prev, {
            connectionId: targetId,
            stream,
            user: knownUser || { id: targetId, name: 'Participant' },
            mediaState: { isMuted: false, isCameraOff: false, isScreenSharing: false }
          }];
        }
        return prev.map(p => {
          if (p.connectionId !== targetId) return p;
          const base = p.stream || stream;
          if (base.getTracks().includes(e.track)) return { ...p, stream: base };
          // A track that lands after the tile attached must arrive as a NEW
          // stream identity: the RemoteVideo srcObject effect is keyed on it,
          // and Chromium doesn't reliably start playing a track added to a
          // stream a <video> is already attached to. Covers peers on builds
          // that still send msid-less (stream-less) tracks.
          return { ...p, stream: new MediaStream([...base.getTracks(), e.track]) };
        });
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    return pc;
  };

  const initiatePeerConnection = async (targetId: string, isOffer: boolean) => {
    if (peersRef.current.has(targetId)) return;
    const pc = createPeerConnection(targetId);

    if (isOffer) {
      await attachOutgoingTracks(pc, true);
      await renegotiatePeer(targetId, pc).catch((err) => console.warn('[Meeting] Offer failed:', err));
    }
  };

  const handlePeerSignal = async (senderId: string, signal: any) => {
    let pc = peersRef.current.get(senderId);
    if (!pc) {
       pc = createPeerConnection(senderId);
    }

    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await flushPendingIceCandidates(senderId, pc);
      await attachOutgoingTracks(pc, true);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendMeetingSignal(senderId, answer);
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await flushPendingIceCandidates(senderId, pc);
    } else if (signal.type === 'candidate') {
      if (!pc.remoteDescription) {
        const queued = pendingIceCandidatesRef.current.get(senderId) || [];
        queued.push(signal.candidate);
        pendingIceCandidatesRef.current.set(senderId, queued);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((err) => {
        console.warn('[Meeting] ICE candidate failed:', err);
      });
    }
  };

  const removeParticipant = (id: string) => {
    const pc = peersRef.current.get(id);
    if (pc) pc.close();
    peersRef.current.delete(id);
    pendingIceCandidatesRef.current.delete(id);
    setParticipants(prev => prev.filter(p => p.connectionId !== id));
  };

  const toggleMute = () => {
    if (!localStream) return;
    const nextMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !nextMuted);
    setIsMuted(nextMuted);
    sendMediaState(nextMuted, isCameraOff);
  };

  // Waiting room — admit / deny guests knocking to join.
  const admitGuest = (guestId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'meeting-admit', meetingId: roomId, guestId }));
    }
    setPendingGuests((prev) => prev.filter((g) => g.id !== guestId));
  };
  const denyGuest = (guestId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'meeting-deny', meetingId: roomId, guestId }));
    }
    setPendingGuests((prev) => prev.filter((g) => g.id !== guestId));
  };
  const admitAllGuests = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      pendingGuests.forEach((g) => ws.send(JSON.stringify({ type: 'meeting-admit', meetingId: roomId, guestId: g.id })));
    }
    setPendingGuests([]);
  };

  // Host "Mute All": we can only mute our own track locally, so this mutes
  // self and asks everyone else to mute via a signaling hint.
  const muteAll = () => {
    if (localStream && !isMuted) {
      localStream.getAudioTracks().forEach(t => t.enabled = false);
      setIsMuted(true);
      sendMediaState(true, isCameraOff);
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'meeting-mute-all', meetingId: roomId }));
    }
  };

  // Ask a specific participant's client to mute/unmute its microphone.
  const requestParticipantMute = (participant: Participant, muted: boolean) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'meeting-mute-request',
      meetingId: roomId,
      targetConnectionId: participant.connectionId,
      muted
    }));
    // Optimistically reflect the requested state in the roster.
    setParticipants((prev) => prev.map((p) =>
      p.connectionId === participant.connectionId
        ? { ...p, mediaState: { isCameraOff: false, ...(p.mediaState || {}), isMuted: muted } }
        : p
    ));
    setControlStatus(`${muted ? 'Muted' : 'Unmuted'} ${participant.user?.name || 'participant'}.`);
  };

  const toggleCamera = async () => {
    if (isScreenSharing) return;

    if (!isCameraOff) {
      const current = localStreamRef.current;
      current?.getVideoTracks().forEach((track) => {
        track.stop();
        current.removeTrack(track);
      });
      await replacePeerTrack('video', getPlaceholderVideoTrack());
      setLocalStream(current && current.getTracks().length ? current : null);
      setIsCameraOff(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = current || null;
      publishMediaState(isMuted, true, false);
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = cameraStream.getVideoTracks()[0];
      const current = localStreamRef.current || new MediaStream();
      current.getVideoTracks().forEach((track) => {
        track.stop();
        current.removeTrack(track);
      });
      if (videoTrack) current.addTrack(videoTrack);
      localStreamRef.current = current;
      setLocalStream(current);
      await replacePeerTrack('video', videoTrack || getPlaceholderVideoTrack());
      if (localVideoRef.current) localVideoRef.current.srcObject = current;
      setIsCameraOff(false);
      setMediaReady(true);
      publishMediaState(isMuted, false, false);
    } catch (err: any) {
      setMeetingError(err?.message || 'Could not turn camera on.');
      setIsCameraOff(true);
      publishMediaState(isMuted, true, false);
    }
  };

  // Tune the outgoing video encoder. Screen shares need a much higher bitrate
  // and resolution-first degradation to keep text sharp (what Meet does);
  // camera video goes back to balanced defaults.
  const tuneVideoSenders = async (mode: 'screen' | 'camera') => {
    for (const [, pc] of peersRef.current) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (!sender) continue;
      try {
        const params: any = sender.getParameters();
        if (!params.encodings || !params.encodings.length) params.encodings = [{}];
        if (mode === 'screen') {
          params.degradationPreference = 'maintain-resolution';
          params.encodings[0].maxBitrate = 8_000_000;
          params.encodings[0].maxFramerate = 30;
          params.encodings[0].scaleResolutionDownBy = 1;
        } else {
          params.degradationPreference = 'balanced';
          params.encodings[0].maxBitrate = 2_500_000;
          delete params.encodings[0].maxFramerate;
          delete params.encodings[0].scaleResolutionDownBy;
        }
        await sender.setParameters(params);
      } catch (err) {
        console.warn('[Meeting] Failed to tune video sender:', err);
      }
    }
  };

  const stopScreenShare = async () => {
    const screenStream = screenStreamRef.current;
    screenStream?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    const cameraVideo = localStreamRef.current?.getVideoTracks()[0] || getPlaceholderVideoTrack();
    const micAudio = localStreamRef.current?.getAudioTracks()[0] || null;
    await replacePeerTrack('video', cameraVideo);
    await replacePeerTrack('audio', micAudio);
    await tuneVideoSenders('camera');
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setIsScreenSharing(false);
    publishMediaState(isMuted, isCameraOff, false);
  };

  const startScreenShare = async (sourceId?: string) => {
    try {
      let displayStream: MediaStream;
      if (sourceId && (window as any).electronAPI) {
        // Electron desktop capture. Capture at up to 1080p30 — without explicit
        // constraints Chromium may pick a low resolution, which reads as blur.
        const electronConstraints = (withAudio: boolean) => ({
          // Desktop (loopback) audio on Windows requires chromeMediaSource on
          // BOTH tracks of the same getUserMedia call.
          audio: withAudio ? { mandatory: { chromeMediaSource: 'desktop' } } : false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: 1920,
              maxHeight: 1080,
              maxFrameRate: 30
            }
          }
        } as any);
        try {
          displayStream = await navigator.mediaDevices.getUserMedia(electronConstraints(shareSystemAudio));
        } catch {
          // Some systems refuse loopback audio — retry video-only.
          displayStream = await navigator.mediaDevices.getUserMedia(electronConstraints(false));
        }
      } else {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } },
          audio: shareSystemAudio
        } as DisplayMediaStreamOptions);
      }
      const screenVideo = displayStream.getVideoTracks()[0];
      const systemAudio = displayStream.getAudioTracks()[0] || null;
      screenStreamRef.current = displayStream;
      if (!screenVideo) throw new Error('No screen video track was returned.');
      // Tell the encoder this is screen content: keep text sharp over motion.
      try { (screenVideo as any).contentHint = 'detail'; } catch {}
      await replacePeerTrack('video', screenVideo);
      if (shareSystemAudio && systemAudio) {
        await replacePeerTrack('audio', systemAudio);
      }
      await tuneVideoSenders('screen');
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream;
      }
      setIsScreenSharing(true);
      publishMediaState(isMuted, false, true);
      screenVideo?.addEventListener('ended', () => stopScreenShare(), { once: true });
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        setMeetingError(err?.message || 'Could not start screen sharing.');
      }
    }
  };

  // Hosts share freely; participants must ask the host for permission first,
  // unless the host has enabled free screen sharing for this meeting.
  const requestScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    if (isHost || meetingPolicy.allowScreenShare) {
      setShowScreenShareModal(true);
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setAwaitingShareApproval(true);
    setMeetingError(null);
    ws.send(JSON.stringify({ type: 'meeting-share-request', meetingId: roomId }));
  };

  // Host: change a meeting permission and broadcast it to everyone.
  const updateMeetingPolicy = (next: { allowScreenShare: boolean }) => {
    setMeetingPolicy(next);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'meeting-policy', meetingId: roomId, policy: next }));
    }
  };

  const respondToShareRequest = (allowed: boolean) => {
    if (shareRequest && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'meeting-share-response',
        meetingId: roomId,
        targetConnectionId: shareRequest.requesterConnectionId,
        allowed
      }));
    }
    setShareRequest(null);
  };

  const updateShareSystemAudio = (checked: boolean) => {
    setShareSystemAudio(checked);
    localStorage.setItem('remote365_meeting_share_system_audio', String(checked));
  };

  const copyInvite = async () => {
    // Just the link: it already carries the code, and pasting "CNR-AZU-QMB"
    // on the line above it is what people kept sending by mistake.
    await copyText(meetingLink);
    setInviteStatus('sent');
    setInviteMessage('Meeting link copied.');
    setShowInvitePanel(true);
  };

  const copyText = async (value: string) => {
    try {
      if ((window as any).electronAPI?.clipboard?.writeText) {
        await (window as any).electronAPI.clipboard.writeText(value);
      } else {
        await navigator.clipboard?.writeText(value);
      }
    } catch {
      /* ignore */
    }
  };

  const flashCopied = (kind: 'link' | 'code') => {
    setInviteCopied(kind);
    setTimeout(() => setInviteCopied((value) => (value === kind ? null : value)), 1500);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setShowEmailInvite(false);
    setInviteMessage('');
    setInviteStatus('idle');
  };

  const sendInvite = async () => {
    const cleanEmail = inviteEmail.trim();
    if (!cleanEmail) return;

    setInviteStatus('sending');
    setInviteMessage('');
    const mailto = `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent('Remote365 Meeting Invite')}&body=${encodeURIComponent(`Join my Remote365 meeting:\n\nCode: ${meetingCode}\nLink: ${meetingLink}`)}`;
    try {
      const token = (window as any).electronAPI
        ? (await (window as any).electronAPI.getToken())?.token
        : localStorage.getItem('access_token');
      if (!token) {
        if ((window as any).electronAPI?.openExternal) {
          await (window as any).electronAPI.openExternal(mailto);
        } else {
          window.location.href = mailto;
        }
        setInviteStatus('sent');
        setInviteMessage('Opened your email app with the meeting invite.');
        setInviteEmail('');
        return;
      }
      await api.post('/api/chat/session-invites', {
        email: cleanEmail,
        sessionName: `${user?.name || 'Remote365'} meeting`,
        sessionCode: roomId,
        sessionPassword: '',
        sessionLink: meetingLink,
        type: 'VIDEO_MEETING'
      });
      setInviteStatus('sent');
      setInviteMessage(`Invite sent to ${cleanEmail}.`);
      setInviteEmail('');
    } catch (err: any) {
      setInviteStatus('error');
      setInviteMessage(err.response?.data?.error || err.message || 'Could not send invite.');
    }
  };

  const sendMeetingTyping = (isTyping: boolean) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'meeting-typing', meetingId: roomId, isTyping }));
  };

  // Relay "typing" as the user types: throttle true pulses to once per 1.5s and
  // schedule a "stopped" after a short idle so the indicator clears on its own.
  const handleChatTextChange = (text: string) => {
    setChatText(text);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      sendMeetingTyping(true);
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      lastTypingSentRef.current = 0;
      sendMeetingTyping(false);
    }, 2000);
  };

  const sendChatMessage = () => {
    const text = chatText.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    lastTypingSentRef.current = 0;
    sendMeetingTyping(false);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ws.send(JSON.stringify({ type: 'meeting-chat', meetingId: roomId, id, message: text }));
    // Optimistically render our own message on the right. The server echo
    // carries the same id and is de-duped by the meeting-chat handler.
    setChatMessages((prev) => (
      prev.some((m) => m.id === id)
        ? prev
        : [...prev, { id, senderConnectionId: 'local', senderName: user?.name || 'You', text, createdAt: Date.now() }]
    ));
    setChatText('');
  };

  const requestParticipantControl = (participant: Participant) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ws.send(JSON.stringify({
      type: 'meeting-control-request',
      meetingId: roomId,
      requestId,
      targetConnectionId: participant.connectionId
    }));
    setControlStatus(`Control request sent to ${participant.user?.name || 'participant'}.`);
    setShowInvitePanel(true);
  };

  const respondToControlRequest = (approved: boolean) => {
    if (!controlRequest || !ws || ws.readyState !== WebSocket.OPEN) return;
    const cleanAccessKey = String(hostAccessKey || '').replace(/\D/g, '');
    if (approved && !cleanAccessKey) {
      setControlStatus('Your device access key is not ready yet.');
      return;
    }
    ws.send(JSON.stringify({
      type: 'meeting-control-response',
      meetingId: roomId,
      requestId: controlRequest.requestId,
      targetConnectionId: controlRequest.requesterConnectionId,
      approved,
      accessKey: cleanAccessKey,
      password: devicePassword || '',
      deviceName: user?.name || 'Remote365 Device'
    }));
    setControlStatus(approved ? `Approved control for ${controlRequest.requesterName}.` : `Denied control for ${controlRequest.requesterName}.`);
    setControlRequest(null);
  };

  const handleControlResponse = async (data: any) => {
    if (!data.approved) {
      setControlStatus(`${data.approverName || 'Participant'} denied your control request.`);
      setNoticeToast(`Your remote control request was denied by ${data.approverName || 'the participant'}.`);
      setShowInvitePanel(true);
      return;
    }

    try {
      setControlStatus(`Opening remote control for ${data.deviceName || data.approverName || 'participant'}...`);
      // The participant just approved this request inside the meeting — that
      // IS the consent. If their client couldn't relay a device password,
      // fall back to the approval-only grant (their host app shows one final
      // Allow prompt) instead of failing with a password error.
      const { data: authData } = await api.post('/api/devices/verify-access', {
        accessKey: String(data.accessKey || '').replace(/\D/g, ''),
        ...(data.password ? { password: data.password } : { approvalOnly: true }),
      });
      if ((window as any).electronAPI?.openViewerWindow) {
        await (window as any).electronAPI.openViewerWindow(
          String(data.accessKey || '').replace(/\D/g, ''),
          serverIP,
          authData.token,
          data.deviceName || data.approverName || 'Meeting Participant',
          'desktop'
        );
        setControlStatus('Remote control window opened.');
      } else {
        setControlStatus('Remote control requires the desktop app.');
      }
    } catch (err: any) {
      setControlStatus(err.response?.data?.error || err.message || 'Could not open remote control.');
    } finally {
      setShowInvitePanel(true);
    }
  };

  const handleLeave = () => {
    ws?.send(JSON.stringify({ type: 'meeting-leave', meetingId: roomId }));
    onLeave();
  };

  const toggleFullscreen = async () => {
    try {
      if ((window as any).electronAPI?.toggleFullscreen) {
        await (window as any).electronAPI.toggleFullscreen();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn('[Meeting] Fullscreen failed:', err);
    }
  };

  // End the meeting for everyone (best-effort signal to the server, then leave).
  const endMeetingForAll = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'meeting-end', meetingId: roomId }));
    }
    setShowEndOptions(false);
    onLeave();
  };

  const sharingTileIds = [
    ...(isScreenSharing ? ['local'] : []),
    ...participants.filter((participant) => participant.mediaState?.isScreenSharing).map((participant) => participant.connectionId)
  ];
  const primaryTileId = sharingTileIds.length
    ? (focusedParticipantId && sharingTileIds.includes(focusedParticipantId) ? focusedParticipantId : sharingTileIds[0])
    : (activeLayout === 'focus' && focusedParticipantId ? focusedParticipantId : null);
  const hasSpotlightLayout = Boolean(primaryTileId);
  const sidePanelOpen = showChatPanel || showInvitePanel || showSettingsPanel;
  const hideTile = (tileId: string) => activeLayout === 'focus'
    && !sharingTileIds.length
    && Boolean(focusedParticipantId)
    && focusedParticipantId !== tileId;
  // Three in the meeting (you + two remotes), plain grid: feature the first
  // remote big on the left, stack you + the second remote small on the right.
  const featuredTrio = activeLayout === 'grid' && !hasSpotlightLayout && participants.length === 2;

  return (
    <div className="fixed inset-0 z-[200] bg-[#1A1D21] flex flex-col font-['Mona_Sans',system-ui,sans-serif] text-white animate-in fade-in duration-500">

      {/* Full-screen cover until we're actually in: "Joining…" from the very
          first frame, then the waiting room if the host must admit us. A
          guest never sees the empty meeting grid underneath. */}
      {(waitingForHost || !hasEnteredMeeting) && (
        <div className="absolute inset-0 z-[130] flex flex-col items-center justify-center gap-6 bg-[#1A1D21] px-6 text-center animate-in fade-in duration-200">
          <img src={logo} alt="Remote365" className="h-12 w-12 rounded-full object-contain" />
          {!waitingForHost && !deniedMessage ? (
            <>
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#FF8A00]/25" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#FFB347]/20">
                  <Video size={28} className="text-[#FF8A00]" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-[20px] font-semibold leading-7 text-white">Joining Meeting…</h2>
                <p className="max-w-[380px] text-[14px] leading-5 text-white/70">
                  Setting up your audio and video.
                </p>
              </div>
              <button
                onClick={handleLeave}
                className="mt-2 flex h-10 items-center justify-center rounded-full border border-white/20 px-6 text-[14px] font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
            </>
          ) : deniedMessage ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF383C]/15">
                <X size={30} className="text-[#FF383C]" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-[20px] font-semibold leading-7 text-white">Not Admitted</h2>
                <p className="max-w-[380px] text-[14px] leading-5 text-white/70">{deniedMessage}</p>
              </div>
              <button
                onClick={handleLeave}
                className="mt-2 flex h-10 items-center justify-center rounded-full bg-white/10 px-6 text-[14px] font-medium text-white transition-colors hover:bg-white/15"
              >
                Leave
              </button>
            </>
          ) : (
            <>
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#FF8A00]/25" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#FFB347]/20">
                  <Users size={28} className="text-[#FF8A00]" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-[20px] font-semibold leading-7 text-white">Waiting for host to accept your invitation</h2>
                <p className="max-w-[380px] text-[14px] leading-5 text-white/70">
                  You'll join the meeting as soon as the host lets you in.
                </p>
              </div>
              <button
                onClick={handleLeave}
                className="mt-2 flex h-10 items-center justify-center rounded-full border border-white/20 px-6 text-[14px] font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-7 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Remote365" className="h-6 w-6 rounded-full object-contain" />
            <h2 className="text-[18px] font-medium leading-[25px] text-white">Meeting</h2>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-[14px] leading-5 text-white/90">
              <span>Meeting Time {formatElapsed(elapsedSeconds)}</span>
              <span className="h-[3px] w-[3px] rounded-full bg-[#F3F4F6]" />
              <span>{participants.length + 1} Participant{participants.length === 0 ? '' : 's'}</span>
              <span className="h-[3px] w-[3px] rounded-full bg-[#F3F4F6]" />
              {/* Click-to-copy: the join link only. It already carries the code,
                  and the old "code on one line, link on the next" paste was what
                  people kept sending by mistake. */}
              <button
                type="button"
                onClick={() => {
                  copyText(meetingLink);
                  setHeaderCodeCopied(true);
                  window.setTimeout(() => setHeaderCodeCopied(false), 2000);
                }}
                title="Copy the meeting link"
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[13px] font-medium text-white transition-colors hover:bg-white/20"
              >
                {headerCodeCopied
                  ? <><CheckCircle2 size={13} className="text-[#34C759]" /> Copied</>
                  : <><Copy size={13} /> {meetingCode}</>}
              </button>
            </div>
            {recordingBy && !isRecording && (
              <div className="flex items-center gap-1.5 rounded-[32px] bg-[#FF2D55]/25 px-2.5 py-1" title={`${recordingBy} is recording this meeting`}>
                <span className="h-[6px] w-[6px] rounded-full bg-[#FF2D55] animate-pulse" />
                <span className="text-[11px] leading-[14px] text-white">{recordingBy} is recording</span>
              </div>
            )}
            {recordingNotice && (
              <div className="fixed left-1/2 top-16 z-[300] -translate-x-1/2 rounded-lg bg-black/85 px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl">
                {recordingNotice}
              </div>
            )}
            {isRecording && (
              <div className="relative">
                <button
                  onClick={() => setShowRecordingMenu((value) => !value)}
                  className="flex items-center gap-1.5 rounded-[32px] bg-[#FF2D55]/25 px-2.5 py-1 transition-colors hover:bg-[#FF2D55]/35"
                >
                  <span className={`h-[6px] w-[6px] rounded-full bg-[#FF2D55] ${isPaused ? '' : 'animate-pulse'}`} />
                  <span className="text-[11px] leading-[14px] text-white">{isPaused ? 'Paused' : 'Recording'}</span>
                </button>

                {showRecordingMenu && (
                  <>
                    <div className="fixed inset-0 z-[110]" onClick={() => setShowRecordingMenu(false)} />
                    <div className="absolute left-0 top-[calc(100%+8px)] z-[120] w-52 overflow-hidden rounded-xl border border-white/10 bg-[#22262b] py-1 shadow-2xl">
                      <button
                        onClick={() => { setIsPaused((value) => !value); setShowRecordingMenu(false); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-white transition-colors hover:bg-white/10"
                      >
                        {isPaused ? <Play size={16} /> : <Pause size={16} />}
                        {isPaused ? 'Resume Recording' : 'Pause Recording'}
                      </button>
                      <button
                        onClick={stopRecording}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-medium text-[#FF383C] transition-colors hover:bg-[#FF383C]/10"
                      >
                        <span className="flex h-4 w-4 items-center justify-center">
                          <span className="h-3 w-3 rounded-[2px] bg-[#FF383C]" />
                        </span>
                        Stop Recording
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {meetingError && <p className="mt-2 text-[13px] font-medium text-[#FF383C]">{meetingError}</p>}
      </div>

      {/* Everyone's audio, mounted outside the layout. Tiles come and go as
          people share screens or the grid reflows; hearing someone must not
          depend on whether they currently have a tile. */}
      <ParticipantAudioMixer participants={participants} />

      {/* Stage */}
      <div className="flex-1 min-h-0 px-4 overflow-hidden">
        <div className="relative h-full w-full overflow-hidden rounded-[12px] bg-[#F3F4F6]">
          <div className="absolute inset-0 p-4 sm:p-6" style={sidePanelOpen ? { paddingRight: 352 } : undefined}>
          {hasSpotlightLayout ? (
            /* Screen-share / spotlight: large primary tile left, participant column right */
            <div className={`flex h-full gap-[34px] ${activeLayout === 'list' ? 'hidden' : ''}`}>
              {/* Primary tile */}
              <div className="relative flex-1 min-h-0 min-w-0 bg-[#1A1D21] rounded-[12px] overflow-hidden">
                {primaryTileId === 'local' ? (
                  <>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                    <div className="absolute top-4 right-4">
                      {isMuted ? <MicOff size={20} className="text-[#FF383C]" /> : <Mic size={20} className="text-white" />}
                    </div>
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-md">
                      <span>You (Organizer)</span>
                      <ScreenShare size={12} className="text-[#FFB347]" />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                      title="Fullscreen"
                      className="absolute bottom-4 right-4 flex h-10 items-center justify-center rounded-[34px] bg-[#F3F4F6] px-5 text-[#111315] transition-colors hover:bg-white"
                    >
                      <Maximize2 size={18} />
                    </button>
                  </>
                ) : (() => {
                  const pp = participants.find(p => p.connectionId === primaryTileId);
                  return pp ? (
                    <RemoteVideo
                      participant={pp}
                      hidden={false}
                      className="h-full"
                      showFullscreen
                      onFullscreen={toggleFullscreen}
                      onFocus={() => {}}
                      onRequestControl={() => requestParticipantControl(pp)}
                    />
                  ) : null;
                })()}
              </div>

              {/* Right sidebar — participant tiles stacked vertically */}
              <div className="flex flex-col gap-[34px] min-w-[200px] w-[min(306px,22vw)] overflow-y-auto">
                {/* Local camera tile — always shown in sidebar so you can see yourself */}
                <div className="relative flex-1 min-h-[150px] bg-[#1A1D21] rounded-[12px] overflow-hidden">
                  <video
                    ref={sidebarLocalVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${(isCameraOff || !localStream) ? 'hidden' : ''}`}
                  />
                  {(isCameraOff || !localStream) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                      <User size={40} strokeWidth={1.4} className="text-[#F3F4F6]" />
                      <span className="text-[13px] text-white">{user?.name || 'You'}</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {isMuted ? <MicOff size={16} className="text-[#FF383C]" /> : <Mic size={16} className="text-white" />}
                  </div>
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white">
                    {user?.name || 'You'}
                  </div>
                </div>
                {/* Second (and last) side tile: the remote sharer's avatar when a
                    remote is presenting (their video track IS the screen shown
                    big), otherwise the first non-primary participant. Everyone
                    beyond these two collapses into a +N badge on this card —
                    they're still in the meeting, just not tiled. */}
                {(() => {
                  const others = participants.filter(p => p.connectionId !== primaryTileId);
                  const sharer = primaryTileId !== 'local' ? participants.find(p => p.connectionId === primaryTileId) : null;
                  // Prefer showing another PERSON on the side; the presenter's
                  // avatar tile only appears when it's just you + them. +N
                  // counts whoever didn't get a tile.
                  const secondRemote = others[0] || null;
                  const hiddenSideCount = Math.max(0, others.length - 1);
                  const overflowBadge = hiddenSideCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { setShowInvitePanel(true); setShowChatPanel(false); setShowSettingsPanel(false); }}
                      title="See All Participants"
                      className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-[12px] bg-black/60 transition-colors hover:bg-black/50"
                    >
                      <span className="text-[24px] font-semibold text-white">+{hiddenSideCount}</span>
                    </button>
                  );
                  if (!secondRemote && sharer) {
                    return (
                      <div className="relative flex-1 min-h-[150px] bg-[#1A1D21] rounded-[12px] overflow-hidden">
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                          <User size={40} strokeWidth={1.4} className="text-[#F3F4F6]" />
                          <span className="text-[13px] text-white">{sharer.user?.name || 'Participant'}</span>
                        </div>
                        <div className="absolute top-2 right-2">
                          {sharer.mediaState?.isMuted ? <MicOff size={16} className="text-[#FF383C]" /> : <Mic size={16} className="text-white" />}
                        </div>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white">
                          {sharer.user?.name || 'Participant'}
                          <ScreenShare size={11} className="text-[#FFB347]" />
                        </div>
                      </div>
                    );
                  }
                  if (secondRemote) {
                    return (
                      <div className="relative flex-1 min-h-[150px]">
                        <RemoteVideo
                          key={secondRemote.connectionId}
                          participant={secondRemote}
                          hidden={false}
                          className="h-full"
                          showFullscreen={false}
                          onFullscreen={toggleFullscreen}
                          onFocus={() => { setActiveLayout('focus'); setFocusedParticipantId(secondRemote.connectionId); }}
                          onRequestControl={() => requestParticipantControl(secondRemote)}
                        />
                        {overflowBadge}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          ) : (
            /* Normal grid layout. Three people (you + two) get a featured
               layout: the first remote participant big on the left, you and
               the second stacked small on the right. */
            <div className={`grid h-full gap-[34px] ${activeLayout === 'list' ? 'hidden' : ''} ${
              activeLayout === 'focus' ? 'grid-cols-1' :
              participants.length === 0 ? 'grid-cols-1' :
              participants.length === 1 ? 'grid-cols-2' :
              participants.length === 2 ? 'grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] grid-rows-2' :
              participants.length === 3 ? 'grid-cols-2 grid-rows-2' :
              'grid-cols-3 grid-rows-2'
            }`}>
              {/* Local Video */}
              <motion.div
                onClick={() => { setActiveLayout('focus'); setFocusedParticipantId('local'); }}
                className={`relative bg-[#1A1D21] rounded-[12px] overflow-hidden group ${hideTile('local') ? 'hidden' : ''} ${featuredTrio ? 'col-start-2 row-start-1' : ''}`}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${(!isScreenSharing && (isCameraOff || !localStream)) ? 'hidden' : ''}`}
                />
                {(!isScreenSharing && (isCameraOff || !localStream)) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-[22px] px-4 text-center">
                    <User size={72} strokeWidth={1.4} className="text-[#F3F4F6]" />
                    <span className="text-[16px] leading-[23px] text-white">{user?.name || 'You'}</span>
                    {!localStream && (
                      <button
                        onClick={requestMedia}
                        className="mt-1 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/15"
                      >
                        <RefreshCw size={15} />
                        Try Again
                      </button>
                    )}
                  </div>
                )}
                <div className="absolute top-4 right-4">
                  {isMuted ? <MicOff size={20} className="text-[#FF383C]" /> : <Mic size={20} className="text-white" />}
                </div>
                {!(!isScreenSharing && (isCameraOff || !localStream)) && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-md">
                    <span>You (Organizer)</span>
                  </div>
                )}
              </motion.div>

              {/* Remote Participants */}
              <AnimatePresence mode="popLayout">
                {participants.map((p, index) => (
                  <RemoteVideo
                    key={p.connectionId}
                    participant={p}
                    hidden={hideTile(p.connectionId)}
                    className={featuredTrio ? (index === 0 ? 'col-start-1 row-start-1 row-span-2' : 'col-start-2 row-start-2') : ''}
                    showFullscreen={false}
                    onFullscreen={toggleFullscreen}
                    onFocus={() => { setActiveLayout('focus'); setFocusedParticipantId(p.connectionId); }}
                    onRequestControl={() => requestParticipantControl(p)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* List view roster */}
          {activeLayout === 'list' && (
            <div className="flex h-full flex-col gap-5 overflow-y-auto">
              {openRosterMenu && (
                <div className="fixed inset-0 z-10" onClick={() => setOpenRosterMenu(null)} />
              )}
              {/* Top actions */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex h-10 items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white px-4 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  Invite People
                </button>
                <button
                  onClick={muteAll}
                  className="flex h-10 items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white px-4 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  Mute All
                </button>
              </div>
              <div className="h-px w-full flex-shrink-0 bg-black/20" />

              {/* Roster rows */}
              <div className="flex flex-col">
                {[{ id: 'local' as const, name: user?.name || 'You', role: 'Organizer', muted: isMuted, remote: false, participant: null as any },
                  ...participants.map((p) => ({ id: p.connectionId, name: p.user?.name || 'Participant', role: 'Participant', muted: Boolean(p.mediaState?.isMuted), remote: true, participant: p }))]
                  .map((row) => (
                  <div key={row.id} className="relative flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">
                        {meetingInitials(row.name)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-medium leading-5 text-[#111315]">{row.name}</span>
                        <span className="text-[12px] font-medium leading-[17px] text-[#111315]/70">{row.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {row.remote && row.participant ? (
                        <button
                          onClick={() => requestParticipantMute(row.participant, !row.muted)}
                          title={row.muted ? 'Unmute Participant' : 'Mute Participant'}
                          className="text-[#111315] transition-colors hover:text-[#FF8A00]"
                        >
                          {row.muted ? <MicOff size={20} className="text-[#FF383C]" /> : <Mic size={20} />}
                        </button>
                      ) : (
                        row.muted ? <MicOff size={20} className="text-[#FF383C]" /> : <Mic size={20} className="text-[#111315]" />
                      )}
                      <button
                        onClick={() => setOpenRosterMenu((value) => (value === row.id ? null : row.id))}
                        className="text-[#FF8A00] transition-opacity hover:opacity-70"
                        title="More"
                      >
                        <MoreVertical size={20} />
                      </button>

                      {openRosterMenu === row.id && (
                        <div className="absolute right-0 top-[calc(100%-4px)] z-20 w-[181px] overflow-hidden rounded-[4px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                          <button
                            onClick={() => { setFocusedParticipantId(row.id); setActiveLayout('focus'); setOpenRosterMenu(null); }}
                            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                          >
                            Pin to spotlight
                            {focusedParticipantId === row.id && <Check size={16} className="text-[#FFB347]" />}
                          </button>
                          {row.remote && !['mobile', 'web'].includes(String(row.participant?.user?.clientKind || '')) && (
                            <button
                              onClick={() => { requestParticipantControl(row.participant); setOpenRosterMenu(null); }}
                              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                            >
                              Request Control
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>

          {showChatPanel && (
            <div className="absolute right-4 top-4 bottom-4 z-10 flex w-[328px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[12px] bg-white font-['Mona_Sans',system-ui,sans-serif] shadow-[-8px_0_24px_rgba(0,0,0,0.08)] animate-in fade-in duration-150">
              {/* Header */}
              <div className="relative flex items-center justify-center border-b border-black/20 px-7 py-4">
                <h3 className="text-[16px] font-semibold leading-[23px] text-black">Chat</h3>
                <button
                  onClick={() => setShowChatPanel(false)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-[#111315] transition-opacity hover:opacity-60"
                  aria-label="Close Chat"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
                {chatMessages.length === 0 ? (
                  <p className="m-auto text-[14px] text-[#111315]/40">No messages yet.</p>
                ) : (
                  chatMessages.map((message) => {
                    const isMe = message.senderConnectionId === 'local';
                    if (isMe) {
                      return (
                        <div key={message.id} className="flex justify-end">
                          <div className="max-w-[260px] break-words rounded-md bg-[#FFB347] px-[19px] py-3 text-[12px] leading-[17px] text-white">
                            {message.text}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={message.id} className="flex items-end gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF4D0] text-[13px] font-bold text-[#FFC421]">
                          {(message.senderName || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div className="max-w-[260px] whitespace-pre-line break-words rounded-[10px] bg-[#F3F4F6] px-[18px] py-3 text-[12px] leading-[17px] text-[#111315]">
                          {message.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Typing indicator */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="flex items-center gap-1.5 px-5 pb-1.5">
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#12B76A] [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#12B76A] [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#12B76A]" />
                  </span>
                  <span className="text-[12px] italic text-[#111315]/55">
                    {(() => {
                      const names = Object.values(typingUsers);
                      return names.length === 1 ? `${names[0]} is typing…` : `${names.length} people are typing…`;
                    })()}
                  </span>
                </div>
              )}

              {/* Reply */}
              <div className="bg-[#F3F4F6] px-5 py-4">
                <div className="flex items-center gap-3">
                  <input
                    value={chatText}
                    onChange={(e) => handleChatTextChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Type A Reply..."
                    className="flex-1 bg-transparent text-[14px] leading-5 text-[#111315] outline-none placeholder:text-[#111315]/60"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatText.trim()}
                    className="flex-shrink-0 text-[#111315] transition-colors hover:text-[#FF8A00] disabled:opacity-40"
                    title="Send"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {showInvitePanel && (
            <div className="absolute right-4 top-4 bottom-4 z-10 flex w-[328px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[12px] bg-white font-['Mona_Sans',system-ui,sans-serif] shadow-[-8px_0_24px_rgba(0,0,0,0.08)] animate-in fade-in duration-150">
              {/* Header */}
              <div className="relative flex items-center justify-center border-b border-black/20 px-7 py-4">
                <h3 className="text-[16px] font-semibold leading-[23px] text-black">People</h3>
                <button
                  onClick={() => setShowInvitePanel(false)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-[#111315] transition-opacity hover:opacity-60"
                  aria-label="Close People"
                >
                  <X size={20} />
                </button>
              </div>

              {/* List */}
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-5 py-4">
                {/* Waiting room */}
                {pendingGuests.length > 0 && (
                  <div className="mb-2 flex flex-col gap-2 border-b border-black/20 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium text-[#111315]">Waiting to join ({pendingGuests.length})</span>
                      <button
                        onClick={admitAllGuests}
                        className="h-9 rounded border border-[#1A1D21]/30 px-3 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                      >
                        Admit All
                      </button>
                    </div>
                    {pendingGuests.map((guest) => (
                      <div key={guest.id} className="flex items-center gap-3 py-1">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">
                          {meetingInitials(guest.name)}
                        </div>
                        <span className="flex-1 truncate text-[14px] text-[#111315]">{guest.name}</span>
                        <button
                          onClick={() => admitGuest(guest.id)}
                          className="text-[14px] font-medium text-[#FF8A00] transition-opacity hover:opacity-70"
                        >
                          Admit
                        </button>
                        <button
                          onClick={() => denyGuest(guest.id)}
                          title="Deny"
                          className="text-[#111315]/50 transition-colors hover:text-[#FF383C]"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <span className="px-1 pb-1 text-[12px] font-medium uppercase tracking-wide text-[#111315]/50">
                  In the meeting ({participants.length + 1})
                </span>

                {/* Local user */}
                <div className="flex items-center gap-3 py-2">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">
                    {meetingInitials(user?.name)}
                  </div>
                  <span className="flex-1 truncate text-[14px] text-[#111315]">
                    {user?.name || 'You'} (Host, me)
                  </span>
                  <div className="flex items-center gap-2 text-[#111315]">
                    {isMuted ? <MicOff size={20} className="text-[#FF383C]" /> : <Mic size={20} />}
                    {isCameraOff ? <VideoOff size={20} className="text-[#FF383C]" /> : <Video size={20} />}
                  </div>
                </div>

                {/* Remote participants */}
                {participants.map((participant) => (
                  <div key={participant.connectionId} className="flex items-center gap-3 py-2">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">
                      {meetingInitials(participant.user?.name)}
                    </div>
                    <span className="flex-1 truncate text-[14px] text-[#111315]">
                      {participant.user?.name || 'Participant'}
                    </span>
                    <div className="flex items-center gap-2 text-[#111315]">
                      <button
                        onClick={() => requestParticipantMute(participant, !participant.mediaState?.isMuted)}
                        title={participant.mediaState?.isMuted ? 'Unmute Participant' : 'Mute Participant'}
                        className="transition-colors hover:text-[#FF8A00]"
                      >
                        {participant.mediaState?.isMuted ? <MicOff size={20} className="text-[#FF383C]" /> : <Mic size={20} />}
                      </button>
                      {participant.mediaState?.isCameraOff ? <VideoOff size={20} className="text-[#FF383C]" /> : <Video size={20} />}
                    </div>
                  </div>
                ))}

                {controlStatus && (
                  <p className="mt-2 rounded-lg bg-[#FF8A00]/10 px-3 py-2 text-[13px] text-[#B45309]">{controlStatus}</p>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-center gap-2 px-5 py-4">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] text-[14px] font-medium text-[#111315] transition hover:brightness-105"
                  style={{ background: 'linear-gradient(180deg, #FF8A00 0%, #FFB347 100%)' }}
                >
                  Invite
                </button>
                <button
                  onClick={muteAll}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  Mute All
                </button>
              </div>
            </div>
          )}

          {showSettingsPanel && (
            <MeetingSettingsPanel
              stream={localStream}
              cameraOff={isCameraOff}
              onClose={() => setShowSettingsPanel(false)}
              onOpenAdvanced={() => { setShowSettingsPanel(false); setShowSecurityPanel(true); }}
            />
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: layout actions */}
        <div className="flex items-center">
          <button
            onClick={() => { setActiveLayout('list'); setFocusedParticipantId(null); }}
            className={`h-10 rounded px-4 text-[14px] font-medium transition-colors ${activeLayout === 'list' ? 'bg-white text-[#111315]' : 'text-white hover:bg-white/10'}`}
          >
            List View
          </button>
          <button
            onClick={() => { setActiveLayout('grid'); setFocusedParticipantId(null); }}
            className={`h-10 rounded px-4 text-[14px] font-medium transition-colors ${activeLayout !== 'list' ? 'bg-white text-[#111315]' : 'text-white hover:bg-white/10'}`}
          >
            Media View
          </button>
        </div>

        {/* Right: primary controls pill (everything lives here) */}
        <div className="relative">
          <div className="flex h-[60px] items-center gap-5 rounded-[53px] bg-white px-[30px] shadow-lg">
            <button
              onClick={toggleMute}
              disabled={!localStream}
              title={!localStream ? 'Microphone Is Unavailable' : isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              className={`transition-colors disabled:opacity-40 ${isMuted ? 'text-[#FF383C]' : 'text-[#111315] hover:text-[#FF8A00]'}`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={toggleCamera}
              disabled={isScreenSharing}
              title={isScreenSharing ? 'Stop Screen Sharing Before Changing Camera' : isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              className={`transition-colors disabled:opacity-40 ${isCameraOff ? 'text-[#FF383C]' : 'text-[#111315] hover:text-[#FF8A00]'}`}
            >
              {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
            <button
              onClick={requestScreenShare}
              disabled={awaitingShareApproval}
              title={isScreenSharing ? 'Stop Screen Sharing' : awaitingShareApproval ? 'Waiting For Host Approval...' : 'Share Screen'}
              className={`transition-colors disabled:opacity-40 ${isScreenSharing || showScreenShareModal || awaitingShareApproval ? 'text-[#FF8A00]' : 'text-[#111315] hover:text-[#FF8A00]'}`}
            >
              {isScreenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
            </button>
            <button
              onClick={() => { setShowChatPanel((value) => !value); setShowInvitePanel(false); setShowSettingsPanel(false); }}
              title="Meeting Chat"
              className={`transition-colors ${showChatPanel ? 'text-[#FF8A00]' : 'text-[#111315] hover:text-[#FF8A00]'}`}
            >
              <MessageSquare size={20} />
            </button>
            <button
              onClick={() => { setShowInvitePanel((value) => !value); setShowChatPanel(false); setShowSettingsPanel(false); }}
              title="Participants And Invites"
              className={`transition-colors ${showInvitePanel ? 'text-[#FF8A00]' : 'text-[#111315] hover:text-[#FF8A00]'}`}
            >
              <Users size={20} />
            </button>

            <span className="h-6 w-px bg-black/10" />

            <div className="relative">
              <button
                onClick={() => setShowEndOptions((value) => !value)}
                title="End Or Leave Meeting"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF383C]/10 text-[#FF383C] transition-colors hover:bg-[#FF383C]/20"
              >
                <DisconnectIcon size={18} />
              </button>

              {showEndOptions && (
                <>
                  <div className="fixed inset-0 z-[110]" onClick={() => setShowEndOptions(false)} />
                  <div className="absolute bottom-[calc(100%+12px)] right-0 z-[120] flex w-[188px] flex-col gap-2 rounded-[12px] bg-white p-3 shadow-2xl">
                    <button
                      onClick={() => { setShowEndOptions(false); handleLeave(); }}
                      className="flex h-10 w-full items-center justify-center rounded bg-[#F3F4F6] text-[14px] font-medium text-[#111315] transition-colors hover:bg-[#E9EAEC]"
                    >
                      Leave Meeting
                    </button>
                    {isHost && (
                      <button
                        onClick={endMeetingForAll}
                        className="flex h-10 w-full items-center justify-center rounded bg-[#FF383C]/10 text-[14px] font-medium text-[#FF383C] transition-colors hover:bg-[#FF383C]/20"
                      >
                        End For All
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowMoreMenu((value) => !value)}
              title="More Options"
              className={`transition-colors ${showMoreMenu ? 'text-[#FF8A00]' : 'text-[#111315] hover:text-[#FF8A00]'}`}
            >
              <MoreVertical size={20} />
            </button>
          </div>

          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-[110]" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute bottom-[calc(100%+12px)] right-0 z-[120] flex items-center gap-1 rounded-2xl border border-white/10 bg-[#22262b] p-2 shadow-2xl">
                <button
                  onClick={() => (isRecording ? stopRecording() : startRecording())}
                  className="flex flex-col items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                >
                  <span className="flex h-5 w-5 items-center justify-center">
                    {isRecording ? (
                      <span className="h-3 w-3 rounded-[3px] bg-[#FF383C]" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full bg-[#FF383C]" />
                    )}
                  </span>
                  {isRecording ? 'Stop' : 'Record'}
                </button>
                <button
                  onClick={() => { setShowMoreMenu(false); setShowSettingsPanel((v) => !v); setShowChatPanel(false); setShowInvitePanel(false); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                >
                  <Settings size={20} />
                  Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {noticeToast && (
        <div className="absolute left-1/2 top-[92px] z-[140] flex max-w-[419px] -translate-x-1/2 items-center gap-3 rounded-[4px] bg-[#FFB347] px-3 py-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <Info size={24} className="flex-shrink-0 text-[#1A1D21]" />
          <p className="text-[12px] font-medium leading-[17px] text-[#1A1D21]">{noticeToast}</p>
          <button
            onClick={() => setNoticeToast(null)}
            className="flex-shrink-0 text-[#1A1D21] transition-opacity hover:opacity-60"
            aria-label="Dismiss"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {showRecordingToast && (
        <div className="absolute right-6 top-[92px] z-[140] flex max-w-[419px] items-center gap-3 rounded-[4px] rounded-tr-none bg-[#FFB347] px-3 py-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <Info size={24} className="flex-shrink-0 text-[#1A1D21]" />
          <p className="text-[12px] font-medium leading-[17px] text-[#1A1D21]">
            The recorded file will be converted to MP4 when the meeting ends.
          </p>
          <button
            onClick={() => setShowRecordingToast(false)}
            className="flex-shrink-0 text-[#1A1D21] transition-opacity hover:opacity-60"
            aria-label="Dismiss"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <ScreenShareModal
        open={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onShare={(sourceId) => { setShowScreenShareModal(false); startScreenShare(sourceId); }}
      />

      <AnimatePresence>
        {shareRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[130] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && respondToShareRequest(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="flex w-[468px] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 text-[#111315]"
            >
              <div className="flex items-center justify-between gap-[22px] py-[5px]">
                <h3 className="text-[24px] font-bold leading-[34px]">Allow Screen Sharing</h3>
                <button
                  onClick={() => respondToShareRequest(false)}
                  className="flex h-6 w-6 items-center justify-center text-[#111315] transition-opacity hover:opacity-60"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-[14px] font-normal leading-5">
                {shareRequest.requesterName} is requesting you to allow multiple presenters to share.
              </p>
              <div className="flex items-center justify-end gap-2 pb-2">
                <button
                  onClick={() => respondToShareRequest(false)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  Deny
                </button>
                <button
                  onClick={() => respondToShareRequest(true)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[14px] font-medium text-white transition-all hover:brightness-105"
                >
                  Allow
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {controlRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[130] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && respondToControlRequest(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="flex w-[468px] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 text-[#111315]"
            >
              <div className="flex items-center justify-between gap-[22px] py-[5px]">
                <h3 className="text-[24px] font-bold leading-[34px]">Remote Control Request</h3>
                <button
                  onClick={() => respondToControlRequest(false)}
                  className="flex h-6 w-6 items-center justify-center text-[#111315] transition-opacity hover:opacity-60"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-[14px] font-normal leading-5">
                {controlRequest.requesterName} wants to use your PC.
              </p>
              <div className="flex items-center justify-end gap-2 pb-2">
                <button
                  onClick={() => respondToControlRequest(false)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  Deny
                </button>
                <button
                  onClick={() => respondToControlRequest(true)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[14px] font-medium text-white transition-all hover:brightness-105"
                >
                  Approve
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[130] bg-black/45 backdrop-blur-sm flex items-center justify-center px-4"
            onMouseDown={(e) => e.target === e.currentTarget && closeInviteModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="flex w-full max-w-[400px] flex-col gap-3.5 rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center gap-2 py-[5px]">
                <img src={logo} alt="Remote365" className="h-6 w-6 flex-shrink-0 rounded object-contain" />
                <span className="flex-1 text-center text-[14px] font-medium text-[#111315]">Invite People To Join Meeting</span>
                <button
                  onClick={closeInviteModal}
                  className="flex-shrink-0 text-[#111315] transition-opacity hover:opacity-60"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3.5">
                <button
                  onClick={() => { copyText(meetingLink); flashCopied('link'); }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded border border-[#1A1D21]/30 text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  {inviteCopied === 'link' ? <><CheckCircle2 size={16} className="text-[#00AC4F]" /> Link Copied</> : <><Copy size={16} /> Copy Meeting Link</>}
                </button>
                <button
                  onClick={() => setShowEmailInvite((value) => !value)}
                  className={`flex h-10 w-full items-center justify-center gap-2 rounded border text-[14px] font-medium text-[#111315] transition-colors ${showEmailInvite ? 'border-[#FF8A00] bg-[#FF8A00]/5' : 'border-[#1A1D21]/30 hover:bg-black/5'}`}
                >
                  <Mail size={16} /> Invite Via Email
                </button>

                {showEmailInvite && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        autoFocus
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                        placeholder="person@company.com"
                        className="h-10 flex-1 rounded border border-[#1A1D21]/30 px-3 text-[14px] text-[#111315] outline-none transition-colors placeholder:text-[#111315]/30 focus:border-[#FF8A00]"
                      />
                      <button
                        onClick={sendInvite}
                        disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                        className="flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded px-4 text-[14px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
                        style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                      >
                        {inviteStatus === 'sending' ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                        Send
                      </button>
                    </div>
                    {inviteMessage && (
                      <p className={`text-[13px] font-medium ${inviteStatus === 'error' ? 'text-red-500' : 'text-[#00AC4F]'}`}>
                        {inviteMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* Passcode */}
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-medium leading-5 text-[#1A1D21]">Meeting Passcode</label>
                  <div className="flex h-[37px] items-center justify-between rounded border border-[#1A1D21]/30 px-4">
                    <span className="text-[12px] font-medium leading-[17px] text-[#111315]">{meetingCode}</span>
                  </div>
                </div>

                {/* Copy code (gradient text) */}
                <button
                  onClick={() => { copyText(meetingCode.replace(/\s/g, '')); flashCopied('code'); }}
                  className="h-10 w-full rounded text-[14px] font-medium transition-opacity hover:opacity-80"
                >
                  <span
                    style={{
                      background: 'linear-gradient(180deg, #FF8A00 0%, #FFB347 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {inviteCopied === 'code' ? 'Code copied!' : 'Copy Code'}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSecurityPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[125] bg-black/45 backdrop-blur-sm flex items-center justify-center px-4"
            onMouseDown={(e) => e.target === e.currentTarget && setShowSecurityPanel(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="flex w-[468px] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 text-[#111315]"
            >
              <div className="flex items-center justify-between gap-[22px] py-[5px]">
                <h3 className="text-[24px] font-bold leading-[34px]">Meeting Settings</h3>
                <button
                  onClick={() => setShowSecurityPanel(false)}
                  className="flex h-6 w-6 items-center justify-center text-[#111315] transition-opacity hover:opacity-60"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-[8px] border border-[#1A1D21]/30 px-4 py-3">
                <span className="flex items-center gap-3">
                  <Volume2 size={18} className="text-[#FF8A00]" />
                  <span>
                    <span className="block text-[14px] font-medium leading-5">Share Desktop Audio</span>
                    <span className="block text-[12px] leading-[17px] text-[#111315]/60">Includes audio from apps like YouTube during screen share.</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={shareSystemAudio}
                  onChange={(e) => updateShareSystemAudio(e.target.checked)}
                  className="h-4 w-4 accent-[#FF8A00]"
                />
              </label>

              {isHost && (
                <label className="flex items-center justify-between gap-4 rounded-[8px] border border-[#1A1D21]/30 px-4 py-3">
                  <span className="flex items-center gap-3">
                    <ScreenShare size={18} className="text-[#FF8A00]" />
                    <span>
                      <span className="block text-[14px] font-medium leading-5">Allow Screen Sharing Without Permission</span>
                      <span className="block text-[12px] leading-[17px] text-[#111315]/60">Participants can share their screen without asking you first.</span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={meetingPolicy.allowScreenShare}
                    onChange={(e) => updateMeetingPolicy({ allowScreenShare: e.target.checked })}
                    className="h-4 w-4 accent-[#FF8A00]"
                  />
                </label>
              )}

              <p className="text-[12px] leading-[17px] text-[#111315]/60">
                Remote control always requires approval — when someone asks to use a PC, its owner sees an Approve/Deny dialog before access opens. This cannot be turned off.
              </p>

              <div className="flex items-center justify-end gap-2 pb-2">
                <button
                  onClick={() => setShowSecurityPanel(false)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowSecurityPanel(false);
                    requestScreenShare();
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-[32px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] px-5 text-[14px] font-medium text-white transition-all hover:brightness-105"
                >
                  {isScreenSharing ? <ScreenShareOff size={16} /> : <ScreenShare size={16} />}
                  {isScreenSharing ? 'Stop Sharing' : 'Start Sharing'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {awaitingShareApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[130] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="flex w-[468px] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 text-[#111315]"
            >
              <div className="flex items-center justify-between gap-[22px] py-[5px]">
                <h3 className="text-[24px] font-bold leading-[34px]">Screen Sharing</h3>
                <button
                  onClick={() => setAwaitingShareApproval(false)}
                  className="flex h-6 w-6 items-center justify-center text-[#111315] transition-opacity hover:opacity-60"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-[14px] font-normal leading-5">
                Waiting for the host to allow you to share your screen...
              </p>
              <div className="flex items-center justify-end gap-2 pb-2">
                <button
                  onClick={() => setAwaitingShareApproval(false)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RemoteVideo: React.FC<{
  participant: Participant;
  hidden?: boolean;
  className?: string;
  showFullscreen?: boolean;
  onFullscreen?: () => void;
  onFocus?: () => void;
  onRequestControl?: () => void;
}> = ({ participant, hidden, className = '', showFullscreen, onFullscreen, onFocus, onRequestControl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const hasIncomingVideo = videoReady || Boolean(participant.stream?.getVideoTracks().some((track) => track.readyState === 'live'));
  const cameraOff = Boolean(participant.mediaState?.isCameraOff);
  const screenSharing = Boolean(participant.mediaState?.isScreenSharing);
  // When the camera is off (and not screen sharing) we still receive a live placeholder
  // track, so fall back to the avatar + name instead of showing a blank video.
  const shouldShowPlaceholder = (cameraOff && !screenSharing) || !hasIncomingVideo;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !participant.stream) {
      setVideoReady(false);
      return;
    }

    const updateReady = () => {
      setVideoReady(Boolean(video.videoWidth && video.videoHeight) || participant.stream!.getVideoTracks().some((track) => track.readyState === 'live'));
    };
    video.srcObject = participant.stream;
    // Deliberately silent. Sound for every participant is rendered by
    // ParticipantAudioMixer, which stays mounted no matter how the tiles
    // reflow; if this element played audio too, anyone with a visible tile
    // would be heard twice. Speaker/volume prefs are applied there.
    video.muted = true;
    video.addEventListener('loadedmetadata', updateReady);
    video.addEventListener('resize', updateReady);
    participant.stream.getVideoTracks().forEach((track) => {
      track.addEventListener('unmute', updateReady);
      track.addEventListener('ended', updateReady);
    });
    updateReady();
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('loadedmetadata', updateReady);
      video.removeEventListener('resize', updateReady);
      participant.stream?.getVideoTracks().forEach((track) => {
        track.removeEventListener('unmute', updateReady);
        track.removeEventListener('ended', updateReady);
      });
    };
  }, [participant.stream]);

  return (
    <motion.div
      onClick={onFocus}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`relative bg-[#1A1D21] rounded-[12px] overflow-hidden group ${className} ${hidden ? 'hidden' : ''}`}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full ${participant.mediaState?.isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${shouldShowPlaceholder ? 'hidden' : ''}`}
      />
      {shouldShowPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[22px] px-4 text-center">
          <User size={72} strokeWidth={1.4} className="text-[#F3F4F6]" />
          <span className="text-[16px] leading-[23px] text-white">{participant.user?.name || 'Participant'}</span>
          {!participant.mediaState?.isCameraOff && (
            <span className="text-[12px] font-medium uppercase tracking-widest text-white/40">Connecting…</span>
          )}
        </div>
      )}
      {/* mic indicator */}
      <div className="absolute top-4 right-4">
        {participant.mediaState?.isMuted ? <MicOff size={20} className="text-[#FF383C]" /> : <Mic size={20} className="text-white" />}
      </div>
      {!shouldShowPlaceholder && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-md">
          {participant.user?.name || 'Participant'}
          {participant.mediaState?.isScreenSharing && <ScreenShare size={12} className="text-[#FFB347]" />}
        </div>
      )}
      {/* Remote control can only target another DESKTOP app (a browser or
          phone participant has no host to take over). */}
      {!['mobile', 'web'].includes(String(participant.user?.clientKind || '')) && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRequestControl?.();
          }}
          className="absolute top-4 left-4 h-9 rounded-lg bg-[#FF8A00] hover:brightness-105 text-white transition-all flex items-center justify-center gap-2 px-3 shadow-lg opacity-0 group-hover:opacity-100"
          title="Request Remote Control"
        >
          <MousePointer2 size={16} />
          <span className="text-xs font-semibold">Control</span>
        </button>
      )}
      {showFullscreen && (
        <button
          onClick={(event) => { event.stopPropagation(); onFullscreen?.(); }}
          title="Fullscreen"
          className="absolute bottom-4 right-4 flex h-10 items-center justify-center rounded-[34px] bg-[#F3F4F6] px-5 text-[#111315] transition-colors hover:bg-white"
        >
          <Maximize2 size={18} />
        </button>
      )}
    </motion.div>
  );
};
