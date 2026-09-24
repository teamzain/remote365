import { ResponsivePanel } from '../components/ResponsivePanel';
import React, { useEffect, useRef, useState } from 'react';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  findNodeHandle,
  UIManager,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  ScreenCapturePickerView,
} from 'react-native-webrtc';
import {
  buildSignalUrl,
  formatMeetingCode,
  MEETING_PREF_KEYS,
  MeetingUser,
  normalizeMeetingCode,
} from './meetingUtils';
import { meetingFetch } from './meetingApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Participant = {
  connectionId: string;
  stream?: any;
  user?: { id?: string; name?: string; avatar?: string | null };
  mediaState?: { isMuted: boolean; isCameraOff: boolean; isScreenSharing?: boolean };
};

type MeetingChatMessage = {
  id: string;
  senderConnectionId: string;
  senderName: string;
  text: string;
  createdAt: number;
};

type MeetingRoomProps = {
  apiBaseUrl: string;
  meetingId: string;
  onLeave: () => void;
  token: string | null;
  user: MeetingUser | null;
};

export function MeetingRoom({ apiBaseUrl, meetingId, onLeave, token, user }: MeetingRoomProps) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { type, textSize, control, cappedFontScale, maxFontSizeMultiplier, width: windowWidth } = useResponsive();
  const { t } = useTranslation();
  // How much a text box has to grow to keep holding its (capped) scaled label.
  const grow = Math.max(1, cappedFontScale);

  const roomId = normalizeMeetingCode(meetingId);
  const meetingCode = formatMeetingCode(roomId);
  const meetingLink = `remote365://meeting?code=${encodeURIComponent(meetingCode)}`;

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<any>(null);
  const screenStreamRef = useRef<any>(null);
  const peersRef = useRef<Map<string, any>>(new Map());
  const pendingIceRef = useRef<Map<string, any[]>>(new Map());
  const hasJoinedRef = useRef(false);
  const mountedRef = useRef(true);
  // iOS only: the RPSystemBroadcastPickerView we programmatically tap to start a broadcast.
  const screenPickerRef = useRef<any>(null);
  // Names learned from join/participant events, used to backfill placeholder
  // entries that an early peer track creates before the identity arrives.
  const participantUsersRef = useRef<Map<string, Participant['user']>>(new Map());
  // Mirror of the local media flags. The signaling handler lives in a closure
  // that only re-runs on mediaReady, so reading React state there is stale —
  // every publish reads from this ref instead.
  const mediaFlagsRef = useRef({ isMuted: false, isCameraOff: false, isScreenSharing: false });
  const iceServersRef = useRef<any[]>([{ urls: 'stun:stun.l.google.com:19302' }]);
  const chatScrollRef = useRef<ScrollView | null>(null);
  // Mirror of showChat so the WS message closure (bound once on mediaReady) can
  // read the live panel state without going stale.
  const showChatRef = useRef(false);
  // Typing: outgoing throttle/stop timer + per-sender auto-clear timers.
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingClearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [localStreamUrl, setLocalStreamUrl] = useState('');
  const [screenStreamUrl, setScreenStreamUrl] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [awaitingShareApproval, setAwaitingShareApproval] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  // Waiting room: held until the host admits us; carries a message on decline.
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState('');
  const [isHost, setIsHost] = useState(false);
  // Host-set meeting permissions, mirrored to every participant.
  const [meetingPolicy, setMeetingPolicy] = useState<{ allowScreenShare: boolean }>({ allowScreenShare: false });
  // Waiting room (host side): guests knocking to be let in.
  const [pendingGuests, setPendingGuests] = useState<{ id: string; name: string }[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeLayout, setActiveLayout] = useState<'grid' | 'list'>('grid');
  const [isImmersive, setIsImmersive] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Custom dialogs (replacing OS Alerts) + Settings toggles.
  const [shareRequest, setShareRequest] = useState<{ id: string; name: string } | null>(null);
  const [showRecordingMenu, setShowRecordingMenu] = useState(false);
  const [showEndOptions, setShowEndOptions] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [noticeToast, setNoticeToast] = useState('');
  const [controlStatus, setControlStatus] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const [chatToast, setChatToast] = useState<{ name: string; text: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  // Measured layout boxes (pure layout wiring): the stage viewport drives the
  // participant grid, and the middle band caps how far the chat card may lift.
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const [middleHeight, setMiddleHeight] = useState(0);

  const sendJson = (payload: any) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  };

  /**
   * Drop the signaling socket and peer connections but KEEP the local camera/mic.
   *
   * The socket effect below is keyed on `mediaReady`, so it re-runs the moment media
   * is acquired. Using the full teardown as its cleanup meant that becoming
   * "media ready" immediately stopped the tracks that had just been obtained — the
   * camera opened and closed within ~2ms, over and over (confirmed in logcat), so no
   * video, audio or screen share was ever sent. It also announced `meeting-leave`,
   * telling the server we had left right after joining.
   */
  const closeConnection = () => {
    peersRef.current.forEach((pc) => pc.close?.());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    wsRef.current?.close();
    wsRef.current = null;
    hasJoinedRef.current = false;
  };

  /** Full teardown — only for actually leaving the meeting or unmounting. */
  const stopEverything = () => {
    sendJson({ type: 'meeting-leave', meetingId: roomId });
    closeConnection();
    localStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    screenStreamRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    const timer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, []);

  // Auto-dismiss the notice toast.
  useEffect(() => {
    if (!noticeToast) return;
    const timer = setTimeout(() => setNoticeToast(''), 5000);
    return () => clearTimeout(timer);
  }, [noticeToast]);

  // Auto-dismiss the in-meeting chat toast.
  useEffect(() => {
    if (!chatToast) return;
    const timer = setTimeout(() => setChatToast(null), 4500);
    return () => clearTimeout(timer);
  }, [chatToast]);

  const setMediaFlags = (next: Partial<typeof mediaFlagsRef.current>) => {
    mediaFlagsRef.current = { ...mediaFlagsRef.current, ...next };
  };

  const currentMediaState = () => {
    const flags = mediaFlagsRef.current;
    return {
      isMuted: flags.isMuted,
      // While screen sharing the outgoing video track is live even if the
      // camera is off — matches what the desktop client broadcasts.
      isCameraOff: flags.isCameraOff && !flags.isScreenSharing,
      isScreenSharing: flags.isScreenSharing,
    };
  };

  const publishMediaState = () => {
    sendJson({ type: 'meeting-media-state', meetingId: roomId, mediaState: currentMediaState() });
  };

  const requestMedia = async () => {
    try {
      const [audioPref, videoPref] = await Promise.all([
        AsyncStorage.getItem(MEETING_PREF_KEYS.audio).catch(() => null),
        AsyncStorage.getItem(MEETING_PREF_KEYS.video).catch(() => null),
      ]);
      const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track: any) => track.stop());
        return;
      }
      const nextMuted = audioPref === 'false';
      const nextCameraOff = videoPref === 'false';
      stream.getAudioTracks().forEach((track: any) => { track.enabled = !nextMuted; });
      stream.getVideoTracks().forEach((track: any) => { track.enabled = !nextCameraOff; });
      localStreamRef.current = stream;
      setLocalStreamUrl(stream.toURL());
      setMediaFlags({ isMuted: nextMuted, isCameraOff: nextCameraOff });
      setIsMuted(nextMuted);
      setIsCameraOff(nextCameraOff);
      setMediaReady(true);
      setMeetingError('');
      // Retried mid-meeting: attach the new tracks to existing peers and re-offer.
      if (hasJoinedRef.current && peersRef.current.size) {
        for (const [id, pc] of peersRef.current) {
          addLocalTracks(pc);
          await renegotiatePeer(id, pc);
        }
        publishMediaState();
      }
    } catch (err: any) {
      // Was a bare `catch {}`. getUserMedia failing is the single most likely cause
      // of a silent meeting, and swallowing the reason made it undiagnosable from
      // the device — logcat showed nothing at all.
      console.warn('[meeting] getUserMedia failed:', err?.name, err?.message, err);
      if (!mountedRef.current) return;
      setMediaFlags({ isMuted: true, isCameraOff: true });
      setIsMuted(true);
      setIsCameraOff(true);
      setMediaReady(true);
      setMeetingError(t('Joined without camera or microphone.'));
    }
  };

  useEffect(() => {
    void requestMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLocalTracks = (pc: any) => {
    const stream = localStreamRef.current;
    if (!stream) {
      try {
        pc.addTransceiver?.('audio', { direction: 'recvonly' });
        pc.addTransceiver?.('video', { direction: 'recvonly' });
      } catch {
        // Some native WebRTC builds omit addTransceiver; joining without local media is still allowed.
      }
      return;
    }
    stream.getTracks().forEach((track: any) => {
      const exists = pc.getSenders?.().some((sender: any) => sender.track?.id === track.id);
      if (exists) return;
      // If a transceiver of this kind already exists (created recvonly before
      // media was ready, or minted by the remote offer), plain addTrack can
      // leave its direction stuck at recvonly — the classic "everyone joins
      // but nobody hears the phone" bug. Attach via replaceTrack on that
      // transceiver and force sendrecv so the mic actually goes out.
      const transceiver = (pc.getTransceivers?.() || []).find((item: any) =>
        item.receiver?.track?.kind === track.kind && item.sender && !item.sender.track,
      );
      if (transceiver?.sender?.replaceTrack) {
        transceiver.sender.replaceTrack(track).catch(() => undefined);
        try { transceiver.direction = 'sendrecv'; } catch { /* older builds have read-only direction */ }
      } else {
        pc.addTrack(track, stream);
      }
    });
  };

  const renegotiatePeer = async (targetId: string, pc: any) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendJson({ type: 'meeting-signal', meetingId: roomId, targetConnectionId: targetId, signal: offer });
    } catch {
      // A failed renegotiation just leaves that peer with the old tracks.
    }
  };

  // Swap the outgoing video track on every peer (camera <-> screen). Peers
  // that joined without a video sender get the track added plus a re-offer.
  const replaceVideoTrackEverywhere = async (track: any, stream: any) => {
    for (const [id, pc] of peersRef.current) {
      const senders = pc.getSenders?.() || [];
      let sender = senders.find((item: any) => item.track?.kind === 'video');
      if (!sender) {
        const transceiver = (pc.getTransceivers?.() || [])
          .find((item: any) => item.receiver?.track?.kind === 'video' && item.sender);
        sender = transceiver?.sender;
        if (transceiver && track) {
          try { transceiver.direction = 'sendrecv'; } catch { /* older builds */ }
        }
      }
      try {
        if (sender?.replaceTrack) {
          await sender.replaceTrack(track);
        } else if (track && stream) {
          pc.addTrack(track, stream);
        }
      } catch {
        // Leave this peer on its previous track.
      }
      await renegotiatePeer(id, pc);
    }
  };

  const flushIce = async (targetId: string, pc: any) => {
    const queued = pendingIceRef.current.get(targetId) || [];
    pendingIceRef.current.delete(targetId);
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
    }
  };

  const createPeerConnection = (targetId: string) => {
    const existing = peersRef.current.get(targetId);
    if (existing) return existing;

    const pc: any = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peersRef.current.set(targetId, pc);

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        sendJson({
          type: 'meeting-signal',
          meetingId: roomId,
          targetConnectionId: targetId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event: any) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      setParticipants((current) => {
        const exists = current.find((item) => item.connectionId === targetId);
        if (!exists) {
          const knownUser = participantUsersRef.current.get(targetId);
          return [...current, {
            connectionId: targetId,
            stream,
            user: knownUser || { id: targetId, name: t('Participant') },
            mediaState: { isMuted: false, isCameraOff: false },
          }];
        }
        return current.map((item) => item.connectionId === targetId ? { ...item, stream } : item);
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce?.();
    };

    return pc;
  };

  const initiatePeerConnection = async (targetId: string, shouldOffer: boolean) => {
    const pc = createPeerConnection(targetId);
    addLocalTracks(pc);
    if (!shouldOffer) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendJson({ type: 'meeting-signal', meetingId: roomId, targetConnectionId: targetId, signal: offer });
  };

  const handlePeerSignal = async (senderId: string, signal: any) => {
    const pc = createPeerConnection(senderId);

    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await flushIce(senderId, pc);
      addLocalTracks(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendJson({ type: 'meeting-signal', meetingId: roomId, targetConnectionId: senderId, signal: answer });
      return;
    }

    if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await flushIce(senderId, pc);
      return;
    }

    if (signal.type === 'candidate') {
      if (!pc.remoteDescription) {
        const queued = pendingIceRef.current.get(senderId) || [];
        queued.push(signal.candidate);
        pendingIceRef.current.set(senderId, queued);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => undefined);
    }
  };

  const upsertParticipant = (participant: Participant) => {
    if (participant.user?.name) participantUsersRef.current.set(participant.connectionId, participant.user);
    setParticipants((current) => (
      current.some((item) => item.connectionId === participant.connectionId)
        ? current.map((item) => item.connectionId === participant.connectionId
          ? { ...item, user: participant.user || item.user, mediaState: participant.mediaState || item.mediaState }
          : item)
        : [...current, { ...participant }]
    ));
  };

  // A host asked us to change our mic. Mute-all only ever silences;
  // a targeted request can also unmute.
  const applyMuteRequest = (wantMuted: boolean) => {
    localStreamRef.current?.getAudioTracks?.().forEach((track: any) => { track.enabled = !wantMuted; });
    setMediaFlags({ isMuted: wantMuted });
    setIsMuted(wantMuted);
    publishMediaState();
  };

  const respondToShareRequest = (requesterConnectionId: string, allowed: boolean) => {
    sendJson({ type: 'meeting-share-response', meetingId: roomId, targetConnectionId: requesterConnectionId, allowed });
  };

  const stopScreenShare = async () => {
    screenStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    screenStreamRef.current = null;
    setScreenStreamUrl('');
    const cameraTrack = localStreamRef.current?.getVideoTracks?.()[0] || null;
    await replaceVideoTrackEverywhere(cameraTrack, localStreamRef.current);
    setMediaFlags({ isScreenSharing: false });
    setIsScreenSharing(false);
    setFocusedId((current) => (current === 'local' ? null : current));
    publishMediaState();
  };

  const startScreenShare = async () => {
    try {
      // iOS captures the screen from a separate Broadcast Upload Extension process, and
      // ONLY the user can start it — via the system picker. getDisplayMedia() alone
      // resolves with a track that never receives a frame, which is exactly how screen
      // share used to fail here: silently, with no error to catch.
      if (Platform.OS === 'ios') {
        const picker = screenPickerRef.current;
        if (picker) {
          const handle = findNodeHandle(picker);
          if (handle != null) {
            UIManager.dispatchViewManagerCommand(
              handle,
              // The manager exports `show`; look it up rather than hardcoding an index,
              // whose ordering is not guaranteed across library versions.
              (UIManager as any).getViewManagerConfig?.('ScreenCapturePickerView')?.Commands?.show ?? 'show',
              [handle],
            );
          }
        }
      }
      const displayStream: any = await mediaDevices.getDisplayMedia();
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error(t('No screen video track was returned.'));
      screenStreamRef.current = displayStream;
      setScreenStreamUrl(displayStream.toURL());
      await replaceVideoTrackEverywhere(screenTrack, displayStream);
      setMediaFlags({ isScreenSharing: true });
      setIsScreenSharing(true);
      publishMediaState();
      // The user can stop the capture from the system notification/status bar.
      try {
        screenTrack.addEventListener?.('ended', () => { void stopScreenShare(); });
      } catch {
        /* older builds without track events */
      }
    } catch (err: any) {
      // A permission-dialog dismissal is not an error worth surfacing.
      if (err?.name !== 'NotAllowedError' && err?.message !== 'Permission denied') {
        setNoticeToast(err?.message || t('Could not start screen sharing.'));
      }
    }
  };

  // Hosts share freely; participants must ask the host for permission first,
  // unless the host has enabled free screen sharing for this meeting.
  const requestScreenShare = () => {
    if (isScreenSharing) {
      void stopScreenShare();
      return;
    }
    // Android: MediaProjection's mandatory consent dialog. iOS: ReplayKit
    // in-app capture via the same getDisplayMedia path (shares what this app
    // shows while foregrounded; system-wide sharing needs a broadcast
    // upload extension — a native add-on for a future build).
    if (isHost || meetingPolicy.allowScreenShare) {
      void startScreenShare();
      return;
    }
    // Participants without free-share permission must ask the host first; the
    // native OS dialog only appears once the host approves.
    setAwaitingShareApproval(true);
    sendJson({ type: 'meeting-share-request', meetingId: roomId });
  };

  useEffect(() => {
    const ws = new WebSocket(buildSignalUrl(apiBaseUrl));
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mediaReady || hasJoinedRef.current) return;
      hasJoinedRef.current = true;
      ws.send(JSON.stringify({
        type: 'meeting-join',
        meetingId: roomId,
        token,
        user: { id: user?.id, name: user?.name || user?.email || 'Participant', avatar: user?.avatar },
        clientKind: 'mobile',
        mediaState: currentMediaState(),
      }));
    };

    ws.onerror = () => setMeetingError(t('Meeting connection failed.'));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'meeting-waiting') {
        setWaitingForHost(true);
        setDeniedMessage('');
        setMeetingError('');
        return;
      }

      if (data.type === 'meeting-denied') {
        setWaitingForHost(true);
        setDeniedMessage(data.error || t('The host declined your request to join.'));
        return;
      }

      if (data.type === 'meeting-joined') {
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServersRef.current = data.iceServers;
        }
        setWaitingForHost(false);
        setDeniedMessage('');
        setMeetingError('');
        setIsHost(Boolean(data.isHost));
        if (data.policy) setMeetingPolicy({ allowScreenShare: Boolean(data.policy.allowScreenShare) });
        (data.participants || []).forEach((participant: Participant) => {
          upsertParticipant(participant);
          initiatePeerConnection(participant.connectionId, true).catch(() => undefined);
        });
        return;
      }

      if (data.type === 'meeting-participant-joined') {
        const participant = data.participant as Participant;
        upsertParticipant(participant);
        initiatePeerConnection(participant.connectionId, false).catch(() => undefined);
        return;
      }

      if (data.type === 'meeting-participant-left') {
        const id = data.participantConnectionId;
        peersRef.current.get(id)?.close?.();
        peersRef.current.delete(id);
        participantUsersRef.current.delete(id);
        setParticipants((current) => current.filter((item) => item.connectionId !== id));
        setFocusedId((current) => (current === id ? null : current));
        return;
      }

      if (data.type === 'meeting-signal') {
        handlePeerSignal(data.senderConnectionId, data.signal).catch(() => undefined);
        return;
      }

      if (data.type === 'meeting-media-state') {
        setParticipants((current) => current.map((item) => (
          item.connectionId === data.participantConnectionId
            ? { ...item, mediaState: data.mediaState }
            : item
        )));
        return;
      }

      if (data.type === 'meeting-mute-request' || data.type === 'meeting-mute-all') {
        applyMuteRequest(data.type === 'meeting-mute-all' ? true : Boolean(data.muted));
        return;
      }

      if (data.type === 'meeting-knock') {
        // A guest is waiting in the lobby to be admitted.
        setPendingGuests((current) => (
          current.some((guest) => guest.id === data.guestId)
            ? current
            : [...current, { id: data.guestId, name: data.guestName || t('Guest') }]
        ));
        setShowPeople(true);
        setShowChat(false);
        return;
      }

      if (data.type === 'meeting-knock-cancelled') {
        setPendingGuests((current) => current.filter((guest) => guest.id !== data.guestId));
        return;
      }

      if (data.type === 'meeting-policy') {
        setMeetingPolicy({ allowScreenShare: Boolean(data.policy?.allowScreenShare) });
        return;
      }

      if (data.type === 'meeting-share-request') {
        // Host: a participant is asking permission to share their screen. Shown
        // as a custom in-app dialog (never an OS Alert).
        setShareRequest({ id: data.requesterConnectionId, name: data.requesterName || t('Participant') });
        return;
      }

      if (data.type === 'meeting-share-response') {
        // The host answered our screen-share request.
        setAwaitingShareApproval(false);
        if (data.allowed) {
          void startScreenShare();
        } else {
          setNoticeToast(t('Your screen sharing request was denied by the host.'));
        }
        return;
      }

      if (data.type === 'meeting-control-request') {
        // Remote control isn't supported on mobile. Decline silently so the
        // requester's client isn't left waiting for an answer.
        sendJson({
          type: 'meeting-control-response',
          meetingId: roomId,
          requestId: data.requestId,
          targetConnectionId: data.requesterConnectionId,
          approved: false,
          accessKey: '',
          password: '',
          deviceName: user?.name || 'Mobile device',
        });
        return;
      }

      if (data.type === 'meeting-chat' && data.message) {
        let isNew = false;
        setChatMessages((current) => {
          if (current.some((message) => message.id === data.message.id)) return current;
          isNew = true;
          return [...current, data.message];
        });
        const fromSomeoneElse = data.message.senderConnectionId !== 'local';
        // A real message from that sender means they've stopped typing.
        if (fromSomeoneElse) {
          const timers = typingClearTimersRef.current;
          const existing = timers.get(data.message.senderConnectionId);
          if (existing) { clearTimeout(existing); timers.delete(data.message.senderConnectionId); }
          setTypingUsers((cur) => {
            if (!cur[data.message.senderConnectionId]) return cur;
            const next = { ...cur };
            delete next[data.message.senderConnectionId];
            return next;
          });
        }
        // Badge + toast when a new message from someone else arrives while the
        // panel is closed (mobile sheet covers the video, so we don't auto-open).
        if (isNew && fromSomeoneElse && !showChatRef.current) {
          setChatUnread((n) => n + 1);
          setChatToast({ name: data.message.senderName || t('Someone'), text: String(data.message.text || '') });
        }
        return;
      }

      if (data.type === 'meeting-typing') {
        const cid = data.senderConnectionId;
        if (!cid || cid === 'local') return;
        const timers = typingClearTimersRef.current;
        const existing = timers.get(cid);
        if (existing) { clearTimeout(existing); timers.delete(cid); }
        if (data.isTyping) {
          setTypingUsers((cur) => ({ ...cur, [cid]: data.senderName || t('Someone') }));
          const clearTimer = setTimeout(() => {
            setTypingUsers((cur) => { const next = { ...cur }; delete next[cid]; return next; });
            timers.delete(cid);
          }, 4000);
          timers.set(cid, clearTimer);
        } else {
          setTypingUsers((cur) => { const next = { ...cur }; delete next[cid]; return next; });
        }
        return;
      }

      if (data.type === 'meeting-ended') {
        // The host ended the meeting for everyone.
        stopEverything();
        onLeave();
        return;
      }

      if (data.type === 'meeting-error') {
        setMeetingError(data.error || t('Could not join this meeting.'));
      }
    };

    // Only the connection — NOT the local media, which this effect does not own and
    // which is still needed by the socket this cleanup is about to be replaced by.
    return () => closeConnection();
    // WebSocket should connect once media prefs are known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaReady]);

  // Local media IS owned by the component, so it is released when the screen goes
  // away — not on every re-run of the socket effect above.
  useEffect(() => () => {
    localStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    screenStreamRef.current = null;
  }, []);

  const toggleMute = () => {
    const next = !isMuted;
    localStreamRef.current?.getAudioTracks?.().forEach((track: any) => { track.enabled = !next; });
    setMediaFlags({ isMuted: next });
    setIsMuted(next);
    publishMediaState();
  };

  const toggleCamera = () => {
    const next = !isCameraOff;
    localStreamRef.current?.getVideoTracks?.().forEach((track: any) => { track.enabled = !next; });
    setMediaFlags({ isCameraOff: next });
    setIsCameraOff(next);
    publishMediaState();
  };

  const flipCamera = () => {
    const tracks = localStreamRef.current?.getVideoTracks?.() || [];
    if (!tracks.length) {
      setNoticeToast(t('Camera is unavailable.'));
      return;
    }
    tracks.forEach((track: any) => track._switchCamera?.());
  };

  const toggleMirror = (value: boolean) => {
    setMirrorVideo(value);
    AsyncStorage.setItem('remote365_meeting_pref_mirror', value ? '1' : '0').catch(() => {});
  };

  const applyNoiseSuppression = (value: boolean) => {
    setNoiseSuppression(value);
    AsyncStorage.setItem('remote365_meeting_pref_noise', value ? '1' : '0').catch(() => {});
    // Best-effort: apply to the live mic track where the platform supports it.
    const tracks = localStreamRef.current?.getAudioTracks?.() || [];
    tracks.forEach((track: any) => {
      try { track.applyConstraints?.({ noiseSuppression: value, echoCancellation: value }); } catch { /* unsupported */ }
    });
  };

  // Restore persisted Settings toggles.
  useEffect(() => {
    AsyncStorage.multiGet(['remote365_meeting_pref_mirror', 'remote365_meeting_pref_noise'])
      .then((entries) => {
        entries.forEach(([key, value]) => {
          if (value == null) return;
          if (key === 'remote365_meeting_pref_mirror') setMirrorVideo(value !== '0');
          else if (key === 'remote365_meeting_pref_noise') setNoiseSuppression(value !== '0');
        });
      })
      .catch(() => {});
  }, []);

  // Waiting room — admit / deny guests knocking to join.
  const admitGuest = (guestId: string) => {
    sendJson({ type: 'meeting-admit', meetingId: roomId, guestId });
    setPendingGuests((current) => current.filter((guest) => guest.id !== guestId));
  };
  const denyGuest = (guestId: string) => {
    sendJson({ type: 'meeting-deny', meetingId: roomId, guestId });
    setPendingGuests((current) => current.filter((guest) => guest.id !== guestId));
  };
  const admitAllGuests = () => {
    pendingGuests.forEach((guest) => sendJson({ type: 'meeting-admit', meetingId: roomId, guestId: guest.id }));
    setPendingGuests([]);
  };

  // Host "Mute all": mutes our own track locally and asks everyone else to
  // mute via a signaling hint.
  const muteAll = () => {
    if (!isMuted) {
      localStreamRef.current?.getAudioTracks?.().forEach((track: any) => { track.enabled = false; });
      setMediaFlags({ isMuted: true });
      setIsMuted(true);
      publishMediaState();
    }
    sendJson({ type: 'meeting-mute-all', meetingId: roomId });
  };

  // Ask a specific participant's client to mute/unmute its microphone.
  const requestParticipantMute = (participant: Participant, muted: boolean) => {
    sendJson({
      type: 'meeting-mute-request',
      meetingId: roomId,
      targetConnectionId: participant.connectionId,
      muted,
    });
    // Optimistically reflect the requested state in the roster.
    setParticipants((current) => current.map((item) => (
      item.connectionId === participant.connectionId
        ? { ...item, mediaState: { isCameraOff: false, ...(item.mediaState || {}), isMuted: muted } }
        : item
    )));
    setControlStatus(`${muted ? t('Muted') : t('Unmuted')} ${participant.user?.name || t('participant')}.`);
  };

  // Host: change a meeting permission and broadcast it to everyone.
  const updateMeetingPolicy = (next: { allowScreenShare: boolean }) => {
    setMeetingPolicy(next);
    sendJson({ type: 'meeting-policy', meetingId: roomId, policy: next });
  };

  const startRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
    setShowMore(false);
    setNoticeToast(t('The recorded file will be converted to MP4 when the meeting ends.'));
  };
  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
  };
  const openRecordingMenu = () => setShowRecordingMenu(true);

  const sendMeetingTyping = (isTyping: boolean) => {
    sendJson({ type: 'meeting-typing', meetingId: roomId, isTyping });
  };

  // Relay "typing" as the user types: throttle the true pulses to once per 1.5s
  // and schedule a "stopped" after a short idle so the indicator clears itself.
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
    if (!text) return;
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    lastTypingSentRef.current = 0;
    sendMeetingTyping(false);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sendJson({ type: 'meeting-chat', meetingId: roomId, id, message: text });
    setChatMessages((current) => [...current, {
      id,
      senderConnectionId: 'local',
      senderName: user?.name || t('You'),
      text,
      createdAt: Date.now(),
    }]);
    setChatText('');
  };

  // Track the keyboard so the inline chat/people cards can lift above it while the
  // floating control pill stays put. Always on — harmless when no card is open.
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates?.height || 0),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Jump to the newest message when the chat opens (content-size changes handle
  // new messages while it's already open) and clear the unread badge.
  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) {
      setChatUnread(0);
      const t = setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 80);
      return () => clearTimeout(t);
    }
  }, [showChat]);

  // Clear any pending typing timers on unmount so setState never fires after it.
  useEffect(() => {
    const timers = typingClearTimersRef.current;
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const typingNames = Object.values(typingUsers);
  const typingLabel = typingNames.length === 0
    ? ''
    : typingNames.length === 1
      ? `${typingNames[0]} ${t('is typing…')}`
      : `${typingNames.length} ${t('people are typing…')}`;

  // Vertical space the floating control pill occupies below the stage, so the
  // chat card can rest just above it and lift only when the keyboard overlaps.
  const controlBarSpace = 68 + Math.max(insets.bottom + 12, 28);
  // Lift the card so its composer clears the keyboard. The inset buffer is an
  // Android edge-to-edge correction — keyboardDidShow under-reports the height by
  // the gesture-nav inset there — so it must not be applied on iOS, where it would
  // just leave a dead strip between the composer and the keyboard.
  const keyboardLiftBuffer = Platform.OS === 'android' ? insets.bottom + 8 : 8;
  // The card's own chrome (header + composer) plus a usable slice of list. Below
  // this the card starts clipping the input the user is typing into.
  const chatCardMinHeight = Math.round(200 * grow);
  const chatCardLift = keyboardHeight > 0
    ? Math.max(0, keyboardHeight - controlBarSpace + keyboardLiftBuffer)
    : 0;
  // Never lift so far that the card (top: 8 inside `middle`) collapses onto its
  // own chrome — on short/landscape windows that hid the composer entirely.
  const chatCardBottom = middleHeight > 0
    ? Math.min(chatCardLift, Math.max(0, middleHeight - 8 - chatCardMinHeight))
    : chatCardLift;

  const copyInvite = async (kind: 'code' | 'link') => {
    await Clipboard.setStringAsync(kind === 'code' ? meetingCode.replace(/-/g, '') : meetingLink);
    setCopied(kind);
    setTimeout(() => setCopied((value) => (value === kind ? null : value)), 1500);
  };

  const sendEmailInvite = async () => {
    const cleanEmail = inviteEmail.trim();
    if (!cleanEmail || !token) return;
    setInviteStatus('sending');
    setInviteMessage('');
    try {
      await meetingFetch(apiBaseUrl, '/api/chat/session-invites', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          sessionName: `${user?.name || 'Remote 365'} meeting`,
          sessionCode: roomId,
          sessionPassword: '',
          sessionLink: meetingLink,
          type: 'VIDEO_MEETING',
        }),
      }, token);
      setInviteStatus('sent');
      setInviteMessage(`${t('Invite sent to')} ${cleanEmail}.`);
      setInviteEmail('');
    } catch (err: any) {
      setInviteStatus('error');
      setInviteMessage(err?.message || t('Could not send invite.'));
    }
  };

  const leave = () => {
    stopEverything();
    onLeave();
  };

  // End the meeting for everyone (best-effort signal to the server, then leave).
  const endMeetingForAll = () => {
    sendJson({ type: 'meeting-end', meetingId: roomId });
    leave();
  };

  const confirmLeave = () => {
    if (!isHost) {
      leave();
      return;
    }
    setShowEndOptions(true);
  };

  const elapsed = [
    Math.floor(elapsedSeconds / 3600),
    Math.floor((elapsedSeconds % 3600) / 60),
    elapsedSeconds % 60,
  ].map((part) => String(part).padStart(2, '0')).join(':');

  const participantCount = participants.length + 1;

  // Spotlight: a screen sharer wins automatically (local first); otherwise a
  // tapped (pinned) tile. Tapping the spotlighted tile again unpins it.
  const sharerIds = [
    ...(isScreenSharing ? ['local'] : []),
    ...participants
      .filter((participant) => participant.mediaState?.isScreenSharing)
      .map((participant) => participant.connectionId),
  ];
  const primaryId = sharerIds.length
    ? (focusedId && sharerIds.includes(focusedId) ? focusedId : sharerIds[0])
    : focusedId;

  const toggleFocus = (id: string) => {
    setFocusedId((current) => (current === id ? null : id));
  };

  const pinToSpotlight = (id: string) => {
    setFocusedId(id);
    setActiveLayout('grid');
  };

  const localTile = (small: boolean, showFullscreen = false, tileStyle?: ViewStyle) => (
    <MeetingTile
      cameraOff={isCameraOff}
      mirror={mirrorVideo}
      muted={isMuted}
      name={user?.name || t('You')}
      noStream={!localStreamUrl}
      onFlipCamera={flipCamera}
      onFullscreen={() => setIsImmersive(true)}
      onPress={() => toggleFocus('local')}
      onRetryMedia={() => void requestMedia()}
      screenSharing={isScreenSharing}
      showFullscreen={showFullscreen}
      small={small}
      streamUrl={isScreenSharing && screenStreamUrl ? screenStreamUrl : localStreamUrl}
      tileStyle={tileStyle}
      you
    />
  );

  const remoteTile = (participant: Participant, small: boolean, showFullscreen = false, tileStyle?: ViewStyle) => (
    <MeetingTile
      key={participant.connectionId}
      cameraOff={Boolean(participant.mediaState?.isCameraOff)}
      muted={Boolean(participant.mediaState?.isMuted)}
      name={participant.user?.name || t('Participant')}
      onFullscreen={() => setIsImmersive(true)}
      onPress={() => toggleFocus(participant.connectionId)}
      screenSharing={Boolean(participant.mediaState?.isScreenSharing)}
      showFullscreen={showFullscreen}
      small={small}
      streamUrl={participant.stream?.toURL?.() || ''}
      tileStyle={tileStyle}
    />
  );

  const rosterRows = [
    {
      id: 'local',
      name: user?.name || t('You'),
      role: isHost ? t('Host (me)') : t('Participant (me)'),
      muted: isMuted,
      participant: null as Participant | null,
    },
    ...participants.map((participant) => ({
      id: participant.connectionId,
      name: participant.user?.name || t('Participant'),
      role: t('Participant'),
      muted: Boolean(participant.mediaState?.isMuted),
      participant,
    })),
  ];

  // This screen is mounted without a SafeAreaView, and in landscape (tablet,
  // unfolded foldable, multi-window) the cutout and the nav bar move to a side
  // edge — so the horizontal insets have to be carried by the root itself.
  const sideInsetStyle: ViewStyle = { paddingLeft: insets.left, paddingRight: insets.right };
  // Same, added to the waiting screen's own 32dp gutter (a bare paddingLeft/Right
  // would override paddingHorizontal instead of adding to it).
  const waitingInsetStyle: ViewStyle = { paddingLeft: insets.left + 32, paddingRight: insets.right + 32 };

  // ── Stage geometry ──
  // The stage is a fixed box, so the tiles have to be laid out *inside* it rather
  // than stacked past its bottom edge (the old column pushed the 5th participant
  // under the control pill and off-screen). From the measured box we derive a
  // column count and an exact tile size; while a single column still fits every
  // tile we keep the original flex layout untouched.
  const STAGE_GAP = 8;
  const TILE_MIN_HEIGHT = 120;
  const stagePadding = isImmersive ? 0 : 8;
  const stageInnerWidth = Math.max(0, stageBox.width - stagePadding * 2);
  const stageInnerHeight = Math.max(0, stageBox.height - stagePadding * 2);
  const tileCount = participants.length + 1;
  const tileRowsThatFit = Math.max(1, Math.floor((stageInnerHeight + STAGE_GAP) / (TILE_MIN_HEIGHT + STAGE_GAP)));
  const stageColumns = (() => {
    if (!stageInnerWidth || !stageInnerHeight || tileCount <= 1) return 1;
    // Wide viewports (tablet, unfolded foldable, landscape) get a real grid so the
    // horizontal axis is not spent on full-width letterbox strips.
    if (windowWidth >= 600) return Math.min(tileCount, Math.ceil(Math.sqrt(tileCount)));
    // On a phone, stay a single column for as long as every tile fits in one.
    return tileCount <= tileRowsThatFit ? 1 : 2;
  })();
  const stageRows = Math.max(1, Math.ceil(tileCount / stageColumns));
  const stageTileStyle: ViewStyle = {
    flex: 0,
    // Floor both: an exact 1/3 (or 1/n) share can land a hair above the share the
    // row actually has once Yoga rounds to the pixel grid, which would wrap the
    // last tile of every row onto a line of its own.
    height: Math.max(TILE_MIN_HEIGHT, Math.floor((stageInnerHeight - STAGE_GAP * (stageRows - 1)) / stageRows)),
    width: Math.floor((stageInnerWidth - STAGE_GAP * (stageColumns - 1)) / stageColumns),
  };

  if (waitingForHost) {
    return (
      <View style={[styles.screen, styles.waitingScreen, waitingInsetStyle]}>
        {deniedMessage ? (
          <>
            <Feather name="x-circle" size={48} color="#FF383C" />
            <Text style={[styles.waitingTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Not admitted')}</Text>
            <Text style={[styles.waitingSubtitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{deniedMessage}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#FF8A00" />
            <Text style={[styles.waitingTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Waiting for host to accept your invitation')}</Text>
            <Text style={[styles.waitingSubtitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t("You'll join the meeting as soon as the host lets you in.")}</Text>
          </>
        )}
        <Pressable style={styles.waitingButton} onPress={leave}>
          <Text style={[styles.waitingButtonText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{deniedMessage ? t('Leave') : t('Cancel')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, sideInsetStyle]}>
      <StatusBar hidden={isImmersive} />
      {/* iOS system broadcast picker. It must be MOUNTED for its ref to resolve, but it is
          never meant to be seen — startScreenShare taps its button programmatically. On
          Android the component does not exist, so it is not rendered at all. */}
      {Platform.OS === 'ios' && (
        // Cast: requireNativeComponent types its props as `unknown`, so style/ref are
        // rejected by TS even though the native view accepts both.
        React.createElement(ScreenCapturePickerView as any, {
          ref: screenPickerRef,
          style: styles.screenPicker,
        })
      )}

      {/* Header (Figma: "Meeting" + time • participants + live pill) */}
      {!isImmersive && (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Text style={[styles.headerTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Meeting')}</Text>
          <View style={styles.headerMetaRow}>
            <View style={styles.headerMetaGroup}>
              <Text style={[styles.headerMeta, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{t('Meeting Time')} {elapsed}</Text>
              <View style={styles.headerDot} />
              <Text style={[styles.headerMeta, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>
                {participantCount} {participantCount === 1 ? t('Participant') : t('Participants')}
              </Text>
            </View>
            {isRecording ? (
              <Pressable style={styles.livePill} onPress={openRecordingMenu}>
                <View style={styles.livePillDot} />
                <Text style={[styles.livePillText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isPaused ? t('Paused') : t('Recording')}</Text>
              </Pressable>
            ) : (
              <View style={styles.livePill}>
                <View style={styles.livePillDot} />
                <Text style={[styles.livePillText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Live')}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {meetingError && !isImmersive ? <Text style={[styles.errorText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{meetingError}</Text> : null}

      {/* Stage: grey rounded container with participant tiles (or the roster in list view) */}
      <View
        style={styles.middle}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          setMiddleHeight((current) => (current === next ? current : next));
        }}
      >
      <View
        style={[styles.stage, isImmersive && styles.stageImmersive]}
        onLayout={(event) => {
          const { height, width } = event.nativeEvent.layout;
          setStageBox((current) => (current.height === height && current.width === width ? current : { height, width }));
        }}
      >
        {activeLayout === 'list' && !isImmersive ? (
          <ScrollView contentContainerStyle={styles.rosterContent}>
            <View style={styles.rosterActions}>
              <Pressable style={styles.rosterActionButton} onPress={() => setShowPeople(true)}>
                <Text style={[styles.rosterActionText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Invite people')}</Text>
              </Pressable>
              <Pressable style={styles.rosterActionButton} onPress={muteAll}>
                <Text style={[styles.rosterActionText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Mute all')}</Text>
              </Pressable>
            </View>
            <View style={styles.rosterDivider} />
            {rosterRows.map((row) => (
              <View key={row.id} style={styles.rosterRow}>
                <View style={styles.rosterAvatar}>
                  <Text style={[styles.rosterAvatarText, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials(row.name)}</Text>
                </View>
                <View style={styles.rosterNameGroup}>
                  <Text style={[styles.rosterName, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{row.name}</Text>
                  <Text style={[styles.rosterRole, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{row.role}</Text>
                </View>
                {row.participant ? (
                  <Pressable hitSlop={6} onPress={() => requestParticipantMute(row.participant!, !row.muted)}>
                    <Feather name={row.muted ? 'mic-off' : 'mic'} size={20} color={row.muted ? '#FF383C' : '#111315'} />
                  </Pressable>
                ) : (
                  <Feather name={row.muted ? 'mic-off' : 'mic'} size={20} color={row.muted ? '#FF383C' : '#111315'} />
                )}
                <Pressable hitSlop={6} onPress={() => pinToSpotlight(row.id)}>
                  <MaterialIcons name="push-pin" size={20} color={focusedId === row.id ? '#FF8A00' : 'rgba(17,19,21,0.45)'} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : primaryId ? (
          <>
            {primaryId === 'local' ? localTile(false, true) : (() => {
              const primary = participants.find((participant) => participant.connectionId === primaryId);
              return primary ? remoteTile(primary, false, true) : localTile(false, true);
            })()}
            {!isImmersive && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stageStrip} contentContainerStyle={styles.stageStripContent}>
                {primaryId !== 'local' && localTile(true)}
                {participants
                  .filter((participant) => participant.connectionId !== primaryId)
                  .map((participant) => remoteTile(participant, true))}
              </ScrollView>
            )}
          </>
        ) : stageColumns > 1 ? (
          /* More tiles than a single column can hold (or a wide viewport): lay them
             out as a measured grid inside the stage, scrolling only once even the
             minimum tile height no longer fits. */
          <ScrollView
            style={styles.stageGrid}
            contentContainerStyle={styles.stageGridContent}
            showsVerticalScrollIndicator={false}
          >
            {localTile(false, false, stageTileStyle)}
            {participants.map((participant) => remoteTile(participant, false, false, stageTileStyle))}
          </ScrollView>
        ) : (
          <>
            {localTile(false)}
            {participants.map((participant) => remoteTile(participant, false))}
          </>
        )}
      </View>

      {/* Chat: inline card over the stage — header stays above, control pill stays
          below (Figma). Lifts above the keyboard while typing. */}
      {showChat && !isImmersive && (
        <AnimatedCard bottom={chatCardBottom}>
          {/* Header — centered "Chat" title with a close on the right */}
          <View style={styles.chatHeader}>
            <Text style={[styles.chatHeaderTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Chat')}</Text>
            <Pressable style={styles.chatHeaderClose} hitSlop={8} onPress={() => setShowChat(false)}>
              <Feather name="x" size={22} color="#111315" />
            </Pressable>
          </View>
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatList}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
            {chatMessages.length === 0 ? (
              <Text style={[styles.emptyText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('No messages yet. Say hello 👋')}</Text>
            ) : chatMessages.map((message) => {
              const isMe = message.senderConnectionId === 'local';
              return (
                <View key={message.id} style={[styles.chatMessageRow, isMe ? styles.chatMessageRowMine : styles.chatMessageRowTheirs]}>
                  {!isMe ? (
                    <View style={styles.operatorAvatar}>
                      <Text style={[styles.operatorAvatarText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{(message.senderName || 'A').charAt(0).toUpperCase()}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.chatBubble, isMe ? styles.chatBubbleMine : styles.chatBubbleTheirs]}>
                    <Text style={[styles.chatMessage, type(12, 17 / 12), isMe ? styles.chatMessageMine : styles.chatMessageTheirs]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{message.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          {typingLabel ? (
            <View style={styles.typingRow}>
              <View style={styles.typingDot} />
              <Text style={[styles.typingText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{typingLabel}</Text>
            </View>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              onChangeText={handleChatTextChange}
              onSubmitEditing={sendChatMessage}
              placeholder={t('Type a reply…')}
              placeholderTextColor="#9AA0A6"
              style={[styles.chatInput, textSize(14), control(40)]}
              value={chatText}
              returnKeyType="send"
              blurOnSubmit={false}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            />
            <Pressable
              style={[styles.sendButton, !chatText.trim() && styles.sendButtonDisabled]}
              onPress={sendChatMessage}
              disabled={!chatText.trim()}
            >
              <Feather name="send" size={18} color="#FF8A00" />
            </Pressable>
          </View>
        </AnimatedCard>
      )}

      {/* People: inline card over the stage — header above, control pill below (like Chat) */}
      {showPeople && !isImmersive && (
        <AnimatedCard bottom={chatCardBottom}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatHeaderTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('People')}</Text>
            <Pressable style={styles.chatHeaderClose} hitSlop={8} onPress={() => setShowPeople(false)}>
              <Feather name="x" size={22} color="#111315" />
            </Pressable>
          </View>
          <ScrollView style={styles.peopleList} contentContainerStyle={styles.peopleContent} keyboardShouldPersistTaps="handled">
            {pendingGuests.length > 0 && (
              <View style={styles.waitingSection}>
                <View style={styles.waitingSectionHeader}>
                  <Text style={[styles.waitingSectionTitle, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Waiting to join')} ({pendingGuests.length})</Text>
                  <Pressable style={styles.admitAllButton} onPress={admitAllGuests}>
                    <Text style={[styles.admitAllText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Admit all')}</Text>
                  </Pressable>
                </View>
                {pendingGuests.map((guest) => (
                  <View key={guest.id} style={styles.personRow}>
                    <View style={styles.personAvatar}>
                      <Text style={[styles.personAvatarText, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials(guest.name)}</Text>
                    </View>
                    <Text style={[styles.personName, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{guest.name}</Text>
                    <Pressable hitSlop={6} onPress={() => admitGuest(guest.id)}>
                      <Text style={[styles.admitText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Admit')}</Text>
                    </Pressable>
                    <Pressable hitSlop={6} onPress={() => denyGuest(guest.id)}>
                      <Feather name="x" size={18} color="rgba(17,19,21,0.5)" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.personRow}>
              <View style={styles.personAvatar}>
                <Text style={[styles.personAvatarText, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials(user?.name || t('You'))}</Text>
              </View>
              <Text style={[styles.personName, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>
                {user?.name || t('You')} {isHost ? t('(Host, me)') : t('(me)')}
              </Text>
              <Feather name={isMuted ? 'mic-off' : 'mic'} size={16} color={isMuted ? '#FF383C' : '#111315'} />
              <Feather name={isCameraOff ? 'video-off' : 'video'} size={16} color={isCameraOff ? '#FF383C' : '#111315'} />
            </View>
            {participants.map((participant) => (
              <View key={participant.connectionId} style={styles.personRow}>
                <View style={styles.personAvatar}>
                  <Text style={[styles.personAvatarText, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials(participant.user?.name || t('Participant'))}</Text>
                </View>
                <Text style={[styles.personName, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{participant.user?.name || t('Participant')}</Text>
                <Pressable hitSlop={6} onPress={() => requestParticipantMute(participant, !participant.mediaState?.isMuted)}>
                  <Feather
                    name={participant.mediaState?.isMuted ? 'mic-off' : 'mic'}
                    size={16}
                    color={participant.mediaState?.isMuted ? '#FF383C' : '#111315'}
                  />
                </Pressable>
                <Feather
                  name={participant.mediaState?.isCameraOff ? 'video-off' : 'video'}
                  size={16}
                  color={participant.mediaState?.isCameraOff ? '#FF383C' : '#111315'}
                />
              </View>
            ))}

            {controlStatus ? <Text style={[styles.controlStatus, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{controlStatus}</Text> : null}
          </ScrollView>

          <View style={styles.peopleFooter}>
            <Pressable style={styles.inviteButton} onPress={muteAll}>
              <Feather name="mic-off" size={16} color="#111315" />
              <Text style={[styles.inviteButtonText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Mute all')}</Text>
            </Pressable>
            <Pressable style={styles.inviteButton} onPress={() => copyInvite('code')}>
              <Feather name={copied === 'code' ? 'check-circle' : 'copy'} size={16} color="#111315" />
              <Text style={[styles.inviteButtonText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={2}>{copied === 'code' ? t('Code copied') : `${t('Copy meeting code')} (${meetingCode})`}</Text>
            </Pressable>
            <Pressable style={styles.inviteButton} onPress={() => copyInvite('link')}>
              <Feather name={copied === 'link' ? 'check-circle' : 'link'} size={16} color="#111315" />
              <Text style={[styles.inviteButtonText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{copied === 'link' ? t('Link copied') : t('Copy meeting link')}</Text>
            </Pressable>
            <View style={styles.emailRow}>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setInviteEmail}
                onSubmitEditing={() => void sendEmailInvite()}
                placeholder="person@company.com"
                placeholderTextColor="#9AA0A6"
                style={[styles.emailInput, textSize(14), control(44)]}
                value={inviteEmail}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
              />
              <Pressable
                style={[styles.emailSendButton, (!inviteEmail.trim() || inviteStatus === 'sending') && styles.emailSendDisabled]}
                disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                onPress={() => void sendEmailInvite()}
              >
                {inviteStatus === 'sending'
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Feather name="send" size={16} color="#FFFFFF" />}
              </Pressable>
            </View>
            {inviteMessage ? (
              <Text style={[styles.inviteMessage, textSize(13), inviteStatus === 'error' && styles.inviteMessageError]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{inviteMessage}</Text>
            ) : null}
          </View>
        </AnimatedCard>
      )}

      {/* Settings: inline card over the stage (like Chat/People) */}
      {showSettings && !isImmersive && (
        <AnimatedCard bottom={chatCardBottom}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatHeaderTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Settings')}</Text>
            <Pressable style={styles.chatHeaderClose} hitSlop={8} onPress={() => setShowSettings(false)}>
              <Feather name="x" size={22} color="#111315" />
            </Pressable>
          </View>
          <ScrollView style={styles.chatList} contentContainerStyle={styles.settingsContent} keyboardShouldPersistTaps="handled">
            {/* Video */}
            <Text style={[styles.settingsSectionTitle, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Video')}</Text>
            <Text style={[styles.settingsSectionHint, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Preview and configure your camera.')}</Text>
            <View style={styles.settingsPreview}>
              {localStreamUrl && !isCameraOff ? (
                <RTCView objectFit="cover" streamURL={localStreamUrl} style={styles.settingsPreviewVideo} mirror={mirrorVideo} />
              ) : (
                <View style={styles.settingsPreviewEmpty}>
                  <Feather name="video-off" size={26} color="rgba(17,19,21,0.35)" />
                  <Text style={[styles.settingsPreviewEmptyText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Camera is off')}</Text>
                </View>
              )}
            </View>
            <Pressable style={styles.settingsRowButton} onPress={flipCamera}>
              <Feather name="refresh-cw" size={16} color="#111315" />
              <Text style={[styles.settingsRowButtonText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Flip camera')}</Text>
            </Pressable>
            <SettingToggle
              title={t('Mirror my video')}
              hint={t('Show your camera flipped, like a mirror.')}
              value={mirrorVideo}
              onChange={toggleMirror}
            />
            <SettingToggle
              title={isCameraOff ? t('Camera off') : t('Camera on')}
              hint={t('Turn your camera on or off.')}
              value={!isCameraOff}
              onChange={() => toggleCamera()}
            />

            <View style={styles.settingsDivider} />

            {/* Microphone */}
            <Text style={[styles.settingsSectionTitle, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Microphone')}</Text>
            <Text style={[styles.settingsSectionHint, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Control how the others hear you.')}</Text>
            <SettingToggle
              title={isMuted ? t('Microphone muted') : t('Microphone on')}
              hint={t('Mute or unmute your microphone.')}
              value={!isMuted}
              onChange={() => toggleMute()}
            />
            <SettingToggle
              title={t('Noise suppression')}
              hint={t('Reduces background noise during the meeting.')}
              value={noiseSuppression}
              onChange={applyNoiseSuppression}
            />

            {isHost && (
              <>
                <View style={styles.settingsDivider} />
                <Text style={[styles.settingsSectionTitle, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Host controls')}</Text>
                <SettingToggle
                  title={t('Allow screen sharing')}
                  hint={t('Participants can share without asking you first.')}
                  value={meetingPolicy.allowScreenShare}
                  onChange={(v) => updateMeetingPolicy({ allowScreenShare: v })}
                />
              </>
            )}
          </ScrollView>
        </AnimatedCard>
      )}
      </View>

      {/* Control bar: white pill (Figma: 332 x 60, radius 53) */}
      {!isImmersive && (
        <View style={[styles.controls, { marginBottom: Math.max(insets.bottom + 12, 28), width: Math.round(332 * grow) }]}>
          <Pressable hitSlop={8} onPress={toggleMute}>
            <Feather name={isMuted ? 'mic-off' : 'mic'} size={20} color={isMuted ? '#FF383C' : '#111315'} />
          </Pressable>
          <Pressable hitSlop={8} onPress={toggleCamera} disabled={isScreenSharing}>
            <Feather
              name={isCameraOff ? 'video-off' : 'video'}
              size={20}
              color={isScreenSharing ? 'rgba(17,19,21,0.35)' : isCameraOff ? '#FF383C' : '#111315'}
            />
          </Pressable>
          <Pressable hitSlop={8} onPress={requestScreenShare} disabled={awaitingShareApproval}>
            <MaterialIcons
              name={isScreenSharing ? 'stop-screen-share' : 'screen-share'}
              size={20}
              color={isScreenSharing || awaitingShareApproval ? '#FF8A00' : '#111315'}
            />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => { setShowPeople(false); setShowSettings(false); setShowChat((v) => !v); }}>
            <View>
              <Feather name="message-circle" size={20} color={showChat ? '#FF8A00' : '#111315'} />
              {chatUnread > 0 && (
                <View style={styles.chatUnreadBadge}>
                  <Text style={[styles.chatUnreadText, type(9, 12 / 9)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                </View>
              )}
            </View>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => { setShowChat(false); setShowSettings(false); setShowPeople((v) => !v); }}>
            <View>
              <Feather name="user" size={20} color={showPeople ? '#FF8A00' : '#111315'} />
              {pendingGuests.length > 0 && <View style={styles.knockBadge} />}
            </View>
          </Pressable>
          <View style={styles.controlsEndGroup}>
            <Pressable style={styles.leavePill} onPress={confirmLeave}>
              <MaterialIcons name="call-end" size={20} color="#FF383C" />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setShowMore(true)}>
              <Feather name="more-vertical" size={16} color="#111315" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Immersive mode: floating restore button */}
      {isImmersive && (
        <Pressable
          style={[styles.immersiveExit, { bottom: Math.max(insets.bottom + 12, 24), right: Math.max(insets.right + 12, 24) }]}
          onPress={() => setIsImmersive(false)}
        >
          <Feather name="minimize-2" size={18} color="#111315" />
        </Pressable>
      )}

      {/* Notice toast (amber, like desktop) */}
      {noticeToast ? (
        <View style={[styles.noticeToast, { top: Math.max(96, insets.top + 66) }]}>
          <Feather name="info" size={18} color="#1A1D21" />
          <Text style={[styles.noticeToastText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{noticeToast}</Text>
          <Pressable hitSlop={8} onPress={() => setNoticeToast('')}>
            <Feather name="x" size={16} color="#1A1D21" />
          </Pressable>
        </View>
      ) : null}

      {/* In-meeting chat toast — tap to open the chat (WhatsApp-style) */}
      {chatToast && !showChat ? (
        <Pressable
          style={[styles.chatToast, { top: insets.top + 8 }]}
          onPress={() => { setChatToast(null); setShowPeople(false); setShowSettings(false); setShowChat(true); }}
        >
          <View style={styles.chatToastAvatar}>
            <Text style={[styles.chatToastAvatarText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{chatToast.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.chatToastBody}>
            <Text style={[styles.chatToastName, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{chatToast.name}</Text>
            <Text style={[styles.chatToastText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{chatToast.text || t('Sent a message')}</Text>
          </View>
          <Feather name="message-circle" size={18} color="#FF8A00" />
        </Pressable>
      ) : null}

      {/* Waiting for the host to approve our screen-share request */}
      {awaitingShareApproval && (
        <View style={styles.approvalOverlay}>
          <ResponsivePanel style={styles.approvalCard}>
            <Text style={[styles.approvalTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Screen sharing')}</Text>
            <Text style={[styles.approvalText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Waiting for the host to allow you to share your screen...')}</Text>
            <Pressable style={styles.approvalCancel} onPress={() => setAwaitingShareApproval(false)}>
              <Text style={[styles.approvalCancelText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
            </Pressable>
          </ResponsivePanel>
        </View>
      )}

      {/* More menu */}
      <Modal animationType="fade" transparent visible={showMore} onRequestClose={() => setShowMore(false)}>
        <Pressable
          style={[styles.sheetBackdrop, { alignItems: 'flex-end', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom + 12, 28) + 72, paddingTop: insets.top + 8 }]}
          onPress={() => setShowMore(false)}
        >
          <ResponsivePanel style={styles.moreCard}>
            <Pressable
              style={styles.moreRow}
              onPress={() => { setShowMore(false); setActiveLayout((value) => (value === 'list' ? 'grid' : 'list')); }}
            >
              <Feather name={activeLayout === 'list' ? 'grid' : 'list'} size={18} color="#111315" />
              <Text style={[styles.moreRowText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{activeLayout === 'list' ? t('Media view') : t('List view')}</Text>
            </Pressable>
            <Pressable style={styles.moreRow} onPress={() => { setShowMore(false); setShowChat(false); setShowPeople(true); }}>
              <Feather name="user-plus" size={18} color="#111315" />
              <Text style={[styles.moreRowText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Invite people')}</Text>
            </Pressable>
            <Pressable style={styles.moreRow} onPress={() => copyInvite('code')}>
              <Feather name={copied === 'code' ? 'check-circle' : 'copy'} size={18} color="#111315" />
              <Text style={[styles.moreRowText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{copied === 'code' ? t('Code copied') : t('Copy meeting code')}</Text>
            </Pressable>
            <Pressable style={styles.moreRow} onPress={() => { setShowMore(false); flipCamera(); }}>
              <Feather name="refresh-cw" size={18} color="#111315" />
              <Text style={[styles.moreRowText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Flip camera')}</Text>
            </Pressable>
            <Pressable style={styles.moreRow} onPress={() => (isRecording ? (setShowMore(false), stopRecording()) : startRecording())}>
              <View style={isRecording ? styles.recordStopIcon : styles.recordDotIcon} />
              <Text style={[styles.moreRowText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isRecording ? t('Stop recording') : t('Record')}</Text>
            </Pressable>
            <Pressable style={styles.moreRow} onPress={() => { setShowMore(false); setShowChat(false); setShowPeople(false); setShowSettings(true); }}>
              <Feather name="settings" size={18} color="#111315" />
              <Text style={[styles.moreRowText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Settings')}</Text>
            </Pressable>
            <Pressable style={styles.moreRow} onPress={() => { setShowMore(false); confirmLeave(); }}>
              <MaterialIcons name="call-end" size={18} color="#FF383C" />
              <Text style={[styles.moreRowText, textSize(14), styles.moreRowDanger]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isHost ? t('Leave or end meeting') : t('Leave meeting')}</Text>
            </Pressable>
          </ResponsivePanel>
        </Pressable>
      </Modal>

      {/* Host: participant asking to share their screen (custom, not an OS Alert) */}
      <CenterModal visible={!!shareRequest} onClose={() => setShareRequest(null)}>
        <View style={styles.dialogIconWrap}>
          <MaterialIcons name="screen-share" size={26} color="#FF8A00" />
        </View>
        <Text style={[styles.dialogTitle, textSize(17)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Allow screen sharing')}</Text>
        <Text style={[styles.dialogText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {shareRequest?.name || t('A participant')} {t('is asking to share their screen.')}
        </Text>
        <View style={styles.dialogButtonRow}>
          <Pressable
            style={[styles.dialogButton, styles.dialogButtonGhost]}
            onPress={() => { if (shareRequest) respondToShareRequest(shareRequest.id, false); setShareRequest(null); }}
          >
            <Text style={[styles.dialogButtonGhostText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Deny')}</Text>
          </Pressable>
          <Pressable
            style={[styles.dialogButton, styles.dialogButtonPrimary]}
            onPress={() => { if (shareRequest) respondToShareRequest(shareRequest.id, true); setShareRequest(null); }}
          >
            <Text style={[styles.dialogButtonPrimaryText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Allow')}</Text>
          </Pressable>
        </View>
      </CenterModal>

      {/* Recording menu (custom, not an OS Alert) */}
      <CenterModal visible={showRecordingMenu} onClose={() => setShowRecordingMenu(false)}>
        <View style={styles.dialogIconWrap}>
          <View style={styles.recordDotIcon} />
        </View>
        <Text style={[styles.dialogTitle, textSize(17)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Recording')}</Text>
        <Text style={[styles.dialogText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isPaused ? t('Recording is paused.') : t('Recording is in progress.')}</Text>
        <View style={styles.dialogStack}>
          <Pressable style={[styles.dialogButton, styles.dialogButtonGhost, styles.dialogButtonWide]} onPress={() => { setIsPaused((v) => !v); setShowRecordingMenu(false); }}>
            <Text style={[styles.dialogButtonGhostText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isPaused ? t('Resume recording') : t('Pause recording')}</Text>
          </Pressable>
          <Pressable style={[styles.dialogButton, styles.dialogButtonDanger, styles.dialogButtonWide]} onPress={() => { stopRecording(); setShowRecordingMenu(false); }}>
            <Text style={[styles.dialogButtonDangerText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Stop recording')}</Text>
          </Pressable>
        </View>
      </CenterModal>

      {/* End meeting options (host, custom, not an OS Alert) */}
      <CenterModal visible={showEndOptions} onClose={() => setShowEndOptions(false)}>
        <View style={styles.dialogIconWrap}>
          <MaterialIcons name="call-end" size={24} color="#FF383C" />
        </View>
        <Text style={[styles.dialogTitle, textSize(17)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('End meeting')}</Text>
        <Text style={[styles.dialogText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Leave the meeting or end it for everyone?')}</Text>
        <View style={styles.dialogStack}>
          <Pressable style={[styles.dialogButton, styles.dialogButtonGhost, styles.dialogButtonWide]} onPress={() => { setShowEndOptions(false); leave(); }}>
            <Text style={[styles.dialogButtonGhostText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Leave meeting')}</Text>
          </Pressable>
          <Pressable style={[styles.dialogButton, styles.dialogButtonDanger, styles.dialogButtonWide]} onPress={() => { setShowEndOptions(false); endMeetingForAll(); }}>
            <Text style={[styles.dialogButtonDangerText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('End for all')}</Text>
          </Pressable>
        </View>
      </CenterModal>
    </View>
  );
}

/**
 * Inline card (chat / people / settings) that fades + slides up on mount, so the
 * panels animate in instead of appearing instantly. `bottom` is driven by the
 * keyboard-lift logic; the transform/opacity run on the native driver.
 */
function AnimatedCard({ bottom, children }: { bottom: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  return (
    <Animated.View style={[styles.chatCard, { bottom, opacity: anim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/** A labelled row with a switch, used throughout the Settings card. */
function SettingToggle({ title, hint, value, onChange }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  return (
    <View style={styles.settingsToggleRow}>
      <View style={styles.settingsToggleLabel}>
        <Text style={[styles.settingsToggleTitle, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
        {hint ? <Text style={[styles.settingsToggleHint, type(12, 16 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor="#FFFFFF"
        trackColor={{ false: 'rgba(26,29,33,0.25)', true: '#FF8A00' }}
      />
    </View>
  );
}

/**
 * Custom centered dialog with a dimmed backdrop and a scale/fade entrance. Used
 * for every confirmation (screen-share approval, screen picker, recording, end
 * meeting) so we never fall back to the OS Alert dialogs.
 */
function CenterModal({ visible, onClose, children }: { visible: boolean; onClose?: () => void; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, anim]);
  if (!visible) return null;
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.centerCard, { opacity: anim, transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function MeetingTile({
  cameraOff,
  mirror = true,
  muted,
  name,
  noStream,
  onFlipCamera,
  onFullscreen,
  onPress,
  onRetryMedia,
  screenSharing,
  showFullscreen,
  small,
  streamUrl,
  tileStyle,
  you,
}: {
  cameraOff: boolean;
  mirror?: boolean;
  muted: boolean;
  name: string;
  noStream?: boolean;
  onFlipCamera?: () => void;
  onFullscreen?: () => void;
  onPress?: () => void;
  onRetryMedia?: () => void;
  screenSharing?: boolean;
  showFullscreen?: boolean;
  small?: boolean;
  streamUrl: string;
  tileStyle?: ViewStyle;
  you?: boolean;
}) {
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  const displayName = you ? t('You') : name;
  const showVideo = Boolean(streamUrl) && (!cameraOff || screenSharing);
  return (
    <Pressable style={[styles.tile, small && styles.tileSmall, tileStyle]} onPress={onPress}>
      {showVideo ? (
        <>
          <RTCView
            objectFit={screenSharing ? 'contain' : 'cover'}
            streamURL={streamUrl}
            style={styles.tileVideo}
            mirror={Boolean(you) && !screenSharing && mirror}
          />
          <View style={styles.tileNameOverlay}>
            <Text style={[styles.tileName, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{displayName}</Text>
            {screenSharing && <Feather name="monitor" size={11} color="#FFB347" />}
          </View>
        </>
      ) : (
        <View style={styles.tileFallback}>
          <Feather name="user" size={small ? 28 : 52} color="#FFFFFF" />
          {!small && <Text style={[styles.tileName, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{displayName}</Text>}
          {!small && you && noStream && onRetryMedia && (
            <Pressable style={styles.retryButton} onPress={onRetryMedia}>
              <Feather name="refresh-cw" size={13} color="#FFFFFF" />
              <Text style={[styles.retryButtonText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Try again')}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.tileMic}>
        <Feather name={muted ? 'mic-off' : 'mic'} size={small ? 14 : 18} color={muted ? '#FF383C' : '#FFFFFF'} />
      </View>
      {/* Flip camera — top-left of your own tile, and only while a real camera feed is
          showing: pointless when the camera is off, and switching cameras mid
          screen-share would tear down the projection. */}
      {you && showVideo && !screenSharing && onFlipCamera && (
        <Pressable
          style={styles.tileFlip}
          hitSlop={8}
          onPress={onFlipCamera}
          accessibilityRole="button"
          accessibilityLabel={t('Flip camera')}
        >
          <Feather name="refresh-cw" size={16} color="#111315" />
        </Pressable>
      )}
      {showFullscreen && onFullscreen && (
        <Pressable style={styles.tileFullscreen} hitSlop={6} onPress={onFullscreen}>
          <Feather name="maximize-2" size={16} color="#111315" />
        </Pressable>
      )}
    </Pressable>
  );
}

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const styles = StyleSheet.create(monaFontStyles({
  admitAllButton: {
    borderColor: 'rgba(26,29,33,0.3)',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  admitAllText: {
    color: '#111315',
    fontWeight: '500',
  },
  admitText: {
    color: '#FF8A00',
    fontWeight: '600',
  },
  approvalCancel: {
    alignItems: 'center',
    borderColor: 'rgba(26,29,33,0.3)',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 9,
  },
  approvalCancelText: {
    color: '#111315',
    fontWeight: '500',
  },
  approvalCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 14,
    maxWidth: 360,
    padding: 20,
    width: '84%',
  },
  approvalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 50,
  },
  approvalText: {
    color: '#111315',
    textAlign: 'center',
  },
  approvalTitle: {
    color: '#111315',
    fontWeight: '700',
  },
  middle: {
    flex: 1,
  },
  chatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 8,
    left: 12,
    overflow: 'hidden',
    position: 'absolute',
    right: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    top: 8,
  },
  // ── Settings card ──
  settingsContent: {
    gap: 12,
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  settingsSectionTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  settingsSectionHint: {
    color: 'rgba(17,19,21,0.55)',
    marginTop: -6,
  },
  settingsPreview: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    height: 168,
    overflow: 'hidden',
  },
  settingsPreviewVideo: {
    height: '100%',
    width: '100%',
  },
  settingsPreviewEmpty: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  settingsPreviewEmptyText: {
    color: 'rgba(17,19,21,0.4)',
  },
  settingsRowButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: 'rgba(26,29,33,0.25)',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  settingsRowButtonText: {
    color: '#111315',
    fontWeight: '500',
  },
  settingsDivider: {
    backgroundColor: 'rgba(26,29,33,0.12)',
    height: 1,
    marginVertical: 4,
  },
  settingsToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  settingsToggleLabel: {
    flex: 1,
    gap: 2,
  },
  settingsToggleTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  settingsToggleHint: {
    color: 'rgba(17,19,21,0.55)',
  },
  // ── Custom centered dialogs ──
  centerBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  centerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 12,
    maxWidth: 360,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    width: '100%',
  },
  dialogIconWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,138,0,0.12)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 12,
    width: 44,
  },
  dialogTitle: {
    color: '#111315',
    fontWeight: '600',
    textAlign: 'center',
  },
  dialogText: {
    color: 'rgba(17,19,21,0.65)',
    marginTop: 6,
    textAlign: 'center',
  },
  dialogButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  dialogStack: {
    gap: 10,
    marginTop: 20,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  dialogButtonWide: {
    flex: 0,
    width: '100%',
  },
  dialogButtonGhost: {
    borderColor: 'rgba(26,29,33,0.3)',
    borderWidth: 1,
  },
  dialogButtonGhostText: {
    color: '#111315',
    fontWeight: '500',
  },
  dialogButtonPrimary: {
    backgroundColor: '#FF8A00',
  },
  dialogButtonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dialogButtonDanger: {
    backgroundColor: 'rgba(255,56,60,0.1)',
  },
  dialogButtonDangerText: {
    color: '#FF383C',
    fontWeight: '600',
  },
  typingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 4,
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  typingDot: {
    backgroundColor: '#12B76A',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  typingText: {
    color: 'rgba(17,19,21,0.55)',
    flexShrink: 1,
    fontStyle: 'italic',
  },
  chatUnreadBadge: {
    alignItems: 'center',
    backgroundColor: '#FF383C',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 15,
    minWidth: 15,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -7,
    top: -6,
  },
  chatUnreadText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chatHeader: {
    alignItems: 'center',
    borderBottomColor: 'rgba(0,0,0,0.12)',
    borderBottomWidth: 1,
    justifyContent: 'center',
    paddingBottom: 16,
    paddingHorizontal: 28,
    paddingTop: 18,
    position: 'relative',
  },
  chatHeaderTitle: {
    color: '#000000',
    fontWeight: '600',
    textAlign: 'center',
  },
  chatHeaderClose: {
    position: 'absolute',
    right: 22,
    top: 16,
  },
  chatBubble: {
    flexShrink: 1,
    maxWidth: 260,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chatBubbleMine: {
    backgroundColor: '#FFB347',
    borderRadius: 6,
  },
  chatBubbleTheirs: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  chatContent: {
    flexGrow: 1,
    gap: 16,
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
    paddingVertical: 18,
  },
  chatInput: {
    color: '#111315',
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
    textAlignVertical: 'center',
  },
  chatList: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
  },
  chatMessage: {
  },
  chatMessageMine: {
    color: '#FFFFFF',
  },
  chatMessageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  chatMessageRowMine: {
    justifyContent: 'flex-end',
  },
  chatMessageRowTheirs: {
    justifyContent: 'flex-start',
  },
  chatMessageTheirs: {
    color: '#111315',
  },
  composer: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  controlStatus: {
    backgroundColor: 'rgba(255,138,0,0.1)',
    borderRadius: 8,
    color: '#B45309',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  controls: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
    maxWidth: '94%',
    minHeight: 60,
    paddingHorizontal: 24,
  },
  controlsEndGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 12,
  },
  emailInput: {
    color: '#111315',
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  emailRow: {
    alignItems: 'center',
    borderColor: 'rgba(26,29,33,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  emailSendButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    height: 44,
    justifyContent: 'center',
    width: 48,
  },
  emailSendDisabled: {
    opacity: 0.5,
  },
  emptyText: {
    color: 'rgba(26,29,33,0.55)',
    textAlign: 'center',
  },
  errorText: {
    color: '#FFB347',
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingTop: 6,
    textAlign: 'center',
  },
  header: {
    gap: 4,
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  headerDot: {
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    height: 3,
    width: 3,
  },
  headerMeta: {
    color: '#FFFFFF',
    flexShrink: 1,
    minWidth: 0,
  },
  headerMetaGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  immersiveExit: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    width: 44,
    zIndex: 30,
  },
  inviteButton: {
    alignItems: 'center',
    borderColor: 'rgba(26,29,33,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inviteButtonText: {
    color: '#111315',
    flexShrink: 1,
    fontWeight: '500',
  },
  inviteMessage: {
    color: '#00AC4F',
    fontWeight: '500',
  },
  inviteMessageError: {
    color: '#FF383C',
  },
  knockBadge: {
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    height: 8,
    position: 'absolute',
    right: -2,
    top: -2,
    width: 8,
  },
  leavePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,56,60,0.1)',
    borderRadius: 34,
    height: 40,
    justifyContent: 'center',
    width: 60,
  },
  livePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,45,85,0.3)',
    borderRadius: 32,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  livePillDot: {
    backgroundColor: '#FF2D55',
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  livePillText: {
    color: '#FFFFFF',
  },
  moreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 8,
    maxWidth: 260,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    width: 236,
  },
  moreRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  moreRowDanger: {
    color: '#FF383C',
  },
  moreRowText: {
    color: '#111315',
    fontWeight: '500',
  },
  noticeToast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFB347',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 10,
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    zIndex: 40,
  },
  chatToast: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 10,
    flexDirection: 'row',
    gap: 10,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    right: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    zIndex: 60,
  },
  chatToastAvatar: {
    alignItems: 'center',
    backgroundColor: '#FFF4D0',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chatToastAvatarText: {
    color: '#FFC421',
    fontWeight: '700',
  },
  chatToastBody: {
    flex: 1,
    gap: 1,
  },
  chatToastName: {
    color: '#111315',
    fontWeight: '600',
  },
  chatToastText: {
    color: 'rgba(17,19,21,0.6)',
  },
  noticeToastText: {
    color: '#1A1D21',
    flexShrink: 1,
    fontWeight: '500',
  },
  operatorAvatar: {
    alignItems: 'center',
    backgroundColor: '#FFF4D0',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  operatorAvatarText: {
    color: '#FFC421',
    fontWeight: '800',
  },
  peopleList: {
    flex: 1,
    minHeight: 0,
  },
  peopleContent: {
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  peopleFooter: {
    borderTopColor: 'rgba(0,0,0,0.08)',
    borderTopWidth: 1,
    gap: 8,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  personName: {
    color: '#111315',
    flex: 1,
    fontWeight: '400',
  },
  personRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
    paddingVertical: 6,
  },
  personAvatar: {
    alignItems: 'center',
    backgroundColor: '#F9F5FF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  personAvatarText: {
    color: '#7F56D9',
    fontWeight: '500',
  },
  recordDotIcon: {
    backgroundColor: '#FF383C',
    borderRadius: 7,
    height: 14,
    marginHorizontal: 2,
    width: 14,
  },
  recordStopIcon: {
    backgroundColor: '#FF383C',
    borderRadius: 3,
    height: 12,
    marginHorizontal: 3,
    width: 12,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rosterActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26,29,33,0.3)',
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  rosterActionText: {
    color: '#111315',
    fontWeight: '500',
  },
  rosterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rosterAvatar: {
    alignItems: 'center',
    backgroundColor: '#F9F5FF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rosterAvatarText: {
    color: '#7F56D9',
    fontWeight: '500',
  },
  rosterContent: {
    gap: 12,
    padding: 8,
  },
  rosterDivider: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    height: 1,
  },
  rosterName: {
    color: '#111315',
    fontWeight: '500',
  },
  rosterNameGroup: {
    flex: 1,
  },
  rosterRole: {
    color: 'rgba(17,19,21,0.7)',
    fontWeight: '500',
  },
  rosterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  // Zero-size and non-interactive: mounted only so its ref exists.
  screenPicker: {
    height: 0,
    opacity: 0,
    position: 'absolute',
    width: 0,
  },
  screen: {
    backgroundColor: '#1A1D21',
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  settingHint: {
    color: 'rgba(17,19,21,0.6)',
    fontSize: 12,
    lineHeight: 17,
  },
  settingLabel: {
    color: '#111315',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  settingLabelGroup: {
    flex: 1,
    gap: 2,
  },
  settingRow: {
    alignItems: 'center',
    borderColor: 'rgba(26,29,33,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 16,
    maxHeight: '76%',
    padding: 16,
    width: '91%',
  },
  sheetBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 96,
  },
  sheetHeader: {
    alignItems: 'center',
    borderBottomColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -16,
    paddingBottom: 16,
    paddingHorizontal: 28,
  },
  sheetTitle: {
    color: '#000000',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
  },
  stage: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    flex: 1,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    overflow: 'hidden',
    padding: 8,
  },
  // Wrapped participant grid: tiles are sized from the measured stage, so the
  // scroll only ever engages once even the minimum tile height stops fitting.
  stageGrid: {
    flex: 1,
  },
  stageGridContent: {
    flexDirection: 'row',
    flexGrow: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  stageImmersive: {
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
    padding: 0,
  },
  stageStrip: {
    flexGrow: 0,
  },
  stageStripContent: {
    gap: 8,
  },
  tile: {
    backgroundColor: '#111315',
    borderRadius: 12,
    flex: 1,
    minHeight: 120,
    overflow: 'hidden',
    position: 'relative',
  },
  tileFallback: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  // Flip-camera affordance: same chip as tileFullscreen, opposite corner.
  tileFlip: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    left: 12,
    position: 'absolute',
    top: 12,
    width: 34,
  },
  tileFullscreen: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 17,
    bottom: 12,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    width: 34,
  },
  tileMic: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  tileName: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tileNameOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 6,
    bottom: 8,
    flexDirection: 'row',
    gap: 5,
    left: 8,
    maxWidth: '70%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
  },
  tileSmall: {
    flex: 0,
    height: 96,
    minHeight: 96,
    width: 150,
  },
  tileVideo: {
    height: '100%',
    width: '100%',
  },
  waitingButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  waitingButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  waitingScreen: {
    alignItems: 'center',
    gap: 18,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  waitingSection: {
    borderBottomColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 1,
    gap: 12,
    marginBottom: 8,
    paddingBottom: 12,
  },
  waitingSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  waitingSectionTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  waitingSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  waitingTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
}));
