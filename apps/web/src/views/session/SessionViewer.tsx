import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Smartphone,
  Search,
  Monitor,
  RefreshCw,
  Lock,
  Power,
  Plus,
  MonitorOff,
  Globe,
  Folder,
  Keyboard,
  MousePointer2,
  RotateCw,
  RotateCcw,
  LogOut,
  AppWindow,
  Scaling,
  Zap,
  Check,
  MessageSquare,
  ChevronDown,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  X,
  ArrowLeftRight,
  Sliders,
  Home,
  LayoutGrid,
  Bell,
  Command,
  Hand,
  Zap as ZapIcon,
  Settings as SettingsIcon,
  ScreenShareOff,
  UploadCloud,
  DownloadCloud,
  Upload,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import api from '../../lib/api';
import { WebFileTransfer, describeFileLimit, type WebTransfer } from '../../lib/webFileTransfer';
import { publishActiveSession } from '../../lib/activeSessions';
import waitIllustrationAsset from '../../assets/wait.png';
import {
  clearDeviceNeedsPasswordUpdate,
  clearDeviceRemembered,
  deviceNeedsPasswordUpdate,
  markDeviceNeedsPasswordUpdate,
  markDeviceRemembered,
} from '../../lib/devicePasswordStatus';

const waitIllustration = waitIllustrationAsset.src;

// Generate a stable client ID for this session to handle React StrictMode double-mounts
const viewerClientId = Math.random().toString(36).substring(7);

// Rotating status lines under the connecting loader (same as the desktop app)
const CONNECTING_MESSAGES = [
  'Making connection',
  'Starting the screen',
  'Getting things ready',
  'Almost ready',
];

// Mirrors the host's ALLOWED_BEFORE_CONTROL (desktop main/index.ts) plus the
// messages it handles before that gate — what a view-only viewer may still send.
const SENDABLE_BEFORE_CONTROL = new Set([
  'ping', 'request-keyframe', 'stream-quality', 'chat',
  'request-control', 'viewer-disconnect', 'whiteboard-event',
  'audio-listen', 'recording-state',
]);

const VIEWER_HANDOFF_KEY = 'remotelink_viewer_handoff';
const HANDOFF_MAX_AGE_MS = 5 * 60 * 1000;

function readViewerHandoff(deviceId: string | undefined) {
  if (!deviceId) return null;
  try {
    const raw = sessionStorage.getItem(VIEWER_HANDOFF_KEY);
    if (!raw) return null;
    const h = JSON.parse(raw);
    if (h.deviceId !== deviceId || !h.accessToken) return null;
    if (Date.now() - (h.ts || 0) > HANDOFF_MAX_AGE_MS) return null;
    return h as { accessToken: string; accessKey?: string; deviceName?: string; deviceType?: string };
  } catch {
    return null;
  }
}

function resolveViewerRouteState(deviceId: string | undefined, loc: ReturnType<typeof useLocation>) {
  const s = (loc.state as any) || {};
  if (s?.accessToken && deviceId) {
    return {
      accessToken: s.accessToken as string,
      accessKey: s.accessKey as string | undefined,
      deviceName: s.deviceName as string | undefined,
      deviceType: s.deviceType as string | undefined,
    };
  }
  const h = readViewerHandoff(deviceId);
  if (h) {
    return {
      accessToken: h.accessToken,
      accessKey: h.accessKey,
      deviceName: h.deviceName,
      deviceType: h.deviceType,
    };
  }
  return {
    accessToken: undefined as string | undefined,
    accessKey: undefined as string | undefined,
    deviceName: undefined as string | undefined,
    deviceType: undefined as string | undefined,
  };
}

const SessionViewer: React.FC = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { initSocket, closeSocket, sendMessage, onMessage, activeSession, updateLatency, updateSessionStatus } = useSessionStore();

  const viewerRoute = React.useMemo(
    () => resolveViewerRouteState(deviceId, location),
    [deviceId, location.state, location.key, location.pathname]
  );

  // The signaling server only accepts a short-lived *remote-access* token
  // (minted by POST /api/devices/verify-access) — not the login JWT. When the
  // viewer is opened without a handed-off token (e.g. a direct URL or the
  // Devices page), it authorizes itself below: try verify-access silently,
  // and prompt for the device password on 401.
  const [fetchedAuth, setFetchedAuth] = useState<{
    token: string; accessKey?: string; deviceName?: string; deviceType?: string;
  } | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [rememberPassword, setRememberPassword] = useState(true);
  const rememberPasswordRef = useRef(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const accessToken: string | undefined = viewerRoute.accessToken || fetchedAuth?.token;
  const passedDeviceName: string | undefined = viewerRoute.deviceName || fetchedAuth?.deviceName;
  const accessKey: string | undefined = viewerRoute.accessKey || fetchedAuth?.accessKey || deviceId;
  const isPasswordUpdate = deviceNeedsPasswordUpdate(String(deviceId || ''));

  const requestViewerAuth = useCallback(async (password?: string) => {
    const cleanKey = String(deviceId || '').replace(/\D/g, '');
    if (!cleanKey) {
      setFatalError('This session link is missing a valid device ID.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { data } = await api.post('/api/devices/verify-access', {
        accessKey: cleanKey,
        password: password || undefined,
      });
      if (data?.token) {
        if (password && data.device?.id) {
          if (rememberPasswordRef.current) {
            try {
              await api.post(`/api/devices/${data.device.id}/trust`);
              markDeviceRemembered(cleanKey);
            } catch {
              // The one-time session token is still valid; a later device refresh
              // will keep the update badge if trust could not be persisted.
            }
          } else {
            await api.delete(`/api/devices/${data.device.id}/trust`).catch(() => undefined);
            clearDeviceRemembered(cleanKey);
          }
        } else if (!password) {
          markDeviceRemembered(cleanKey);
        }
        clearDeviceNeedsPasswordUpdate(cleanKey);
        setNeedPassword(false);
        setPasswordValue('');
        setFetchedAuth({
          token: data.token,
          accessKey: cleanKey,
          deviceName: data.device?.name,
          deviceType: data.device?.type,
        });
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        setNeedPassword(true);
        if (password) {
          markDeviceNeedsPasswordUpdate(cleanKey);
          setAuthError('Incorrect password. Please try again.');
        } else {
          setAuthError(deviceNeedsPasswordUpdate(cleanKey) ? 'This device password changed. Enter the new password to reconnect.' : null);
        }
      } else if (status === 409) {
        setFatalError('That device is offline.');
      } else {
        setFatalError(error?.response?.data?.error || 'Could not start the session.');
      }
    } finally {
      setAuthBusy(false);
    }
  }, [deviceId]);

  useEffect(() => {
    rememberPasswordRef.current = rememberPassword;
  }, [rememberPassword]);

  useEffect(() => {
    if (viewerRoute.accessToken || fetchedAuth) return;
    requestViewerAuth();
  }, [viewerRoute.accessToken, fetchedAuth, requestViewerAuth]);

  const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'connected' | 'streaming' | 'connection_lost' | 'error'>('connecting');
  const [openToolbarMenu, setOpenToolbarMenu] = useState<string | null>(null);
  const [connectingMessageIndex, setConnectingMessageIndex] = useState(0);
  const [mobileTouchMode, setMobileTouchMode] = useState<'tap' | 'drag' | 'scroll'>('tap');
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches);
  const connectingText = CONNECTING_MESSAGES[connectingMessageIndex];

  // Rotate the loader status line while waiting for the first frame
  useEffect(() => {
    if (viewerStatus === 'streaming') return;
    const timer = setInterval(() => {
      setConnectingMessageIndex((i) => (i + 1) % CONNECTING_MESSAGES.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [viewerStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    const update = () => setIsMobileViewport(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const [zoomMode, setZoomMode] = useState<'fit' | 'fill' | 'original'>('fit');
  // "Send files" / "Get files" — see lib/webFileTransfer. One engine per
  // viewer; it reads the live control channel on every send.
  // Per-file cap for this viewer's plan, announced by the host (null until it
  // does, and for hosts older than 1.2.139 that never announce one).
  const [fileLimitBytes, setFileLimitBytes] = useState<number | null>(null);
  const fileXferRef = useRef<WebFileTransfer | null>(null);
  if (!fileXferRef.current) fileXferRef.current = new WebFileTransfer(() => dataChannelRef.current, setFileLimitBytes);
  const [fileTransfers, setFileTransfers] = useState<WebTransfer[]>([]);
  useEffect(() => fileXferRef.current!.subscribe(setFileTransfers), []);
  useEffect(() => () => { fileXferRef.current?.dispose(); }, []);
  // Host-side control gate (see the control-channel switch in the desktop
  // main process): auto-granted when the channel opens, but the host can
  // revoke or hold input behind an approval prompt.
  // Desktop browsers start denied: the host states the mode explicitly when the
  // control channel opens, and assuming 'granted' only ever produced a toolbar
  // reading "In control" while every event bounced off the host's gate. Phones
  // start granted because the host exempts them from the consent flow.
  const [controlStatus, setControlStatus] = useState<'granted' | 'pending' | 'denied'>(
    isMobileViewport ? 'granted' : 'denied',
  );
  const controlStatusRef = useRef(controlStatus);
  controlStatusRef.current = controlStatus;
  // Android phone hosts implement no control handshake, so they never announce
  // a mode. Silence must not be read as "denied", or every tap gets eaten and
  // "Request control" asks something that cannot answer.
  const [hostAnnouncedControl, setHostAnnouncedControl] = useState(false);
  const hostAnnouncedControlRef = useRef(false);
  hostAnnouncedControlRef.current = hostAnnouncedControl;
  // Remote audio auto-plays once the host track arrives (desktop parity).
  // Browsers may refuse unmuted playback without user activation — the
  // auto-enable effect below falls back to arming a one-shot gesture listener.
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(false);
  // Distinguishes "not enabled yet" from "this viewer chose mute": auto-play
  // must never undo an explicit mute when tracks re-arrive after a reconnect.
  const userMutedAudioRef = useRef(false);
  // Bumped when a late audio track folds into the playing stream — React can't
  // see MediaStream mutations, so this drives the re-render/effects instead.
  const [audioTrackRevision, setAudioTrackRevision] = useState(0);
  const armAudioGestureRef = useRef(false);
  // Always points at the LATEST auto-enable attempt, so the one-shot gesture
  // listener never calls a stale closure from a superseded effect run.
  const audioEnableRetryRef = useRef<() => void>(() => {});
  // Transient top-center notices (someone started recording, etc.).
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  // Closing the tab mid-session should warn first, like the Disconnect button
  // does. Browsers do not allow custom modals on tab close — arming
  // beforeunload shows the native "Leave site?" prompt, which is the strongest
  // guard the platform offers. Disarmed once the session is over so a dead
  // session's tab closes silently.
  const viewerStatusRefForUnload = useRef('');
  viewerStatusRefForUnload.current = viewerStatus;
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      const status = viewerStatusRefForUnload.current;
      if (status !== 'streaming' && status !== 'connecting') return;
      e.preventDefault();
      // Chrome requires returnValue to be set; the text itself is ignored.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  useEffect(() => {
    if (!sessionNotice) return;
    const timer = window.setTimeout(() => setSessionNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [sessionNotice]);
  // Mirrors the desktop viewer's Quality menu: 'auto' hands control back to
  // the bandwidth tuner; a fixed choice pins the host encoder.
  const [qualityMode, setQualityMode] = useState<'auto' | 'speed' | 'quality'>('auto');
  // Destructive host actions (restart / sign out) confirm first, desktop-style.
  const [pendingAction, setPendingAction] = useState<{ action: string; title: string; message: string; confirmLabel: string } | null>(null);
  // Desktop RemoteSessionChrome parity for the quick-action pill: disconnect
  // asks for confirmation, the toolbar starts hidden behind a floating tab,
  // and a chat panel talks to the person at the host machine.
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; at: number; mine: boolean }[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatDraft, setChatDraft] = useState('');
  const [remoteChatEvent, setRemoteChatEvent] = useState<any>(null);
  // Quick-pill hover hint: tracks the hovered button's center so the tooltip
  // sits exactly above the icon being pointed at.
  const [quickHint, setQuickHint] = useState<{ label: string; left: number } | null>(null);
  const quickPillRef = useRef<HTMLDivElement>(null);
  const chatOpenRef = useRef(false);
  const chatListRef = useRef<HTMLDivElement>(null);
  const chatSeenRef = useRef(0);
  // Read by the window-level key forwarders (which close over stale state).
  const uiModalOpenRef = useRef(false);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => {
    uiModalOpenRef.current = Boolean(showDisconnectConfirm || pendingAction);
  }, [showDisconnectConfirm, pendingAction]);
  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Last normalized pointer position, so wheel events scroll under the cursor.
  const lastPointerRef = useRef({ x: 0.5, y: 0.5 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileKeyboardRef = useRef<HTMLTextAreaElement>(null);
  const touchStateRef = useRef<{ startX: number; startY: number; lastX: number; lastY: number; startedAt: number; moved: boolean; fingers: number; dragging: boolean; startPoint: { x: number; y: number }; pinchDist?: number; pinchMid?: { x: number; y: number }; gesture?: 'scroll' | 'zoom' | null } | null>(null);
  // Pinch-to-zoom (phones): a CSS transform on the media element. Input
  // mapping needs no changes — normalizedPoint reads getBoundingClientRect,
  // which reflects the transform.
  const pinchZoomRef = useRef({ scale: 1, tx: 0, ty: 0 });
  // Phones have no local pointer mirroring the remote one, so the host's
  // reported cursor position is drawn as an arrow overlay (desktop browsers
  // keep the plain CSS cursor instead). Driven by direct DOM writes — cursor
  // messages arrive at ~30Hz and must not re-render React.
  const remoteCursorElRef = useRef<HTMLDivElement>(null);
  const lastRemoteCursorRef = useRef<{ x: number; y: number; visible?: boolean } | null>(null);
  // Last cursor SHAPE the host reported — 'text' means the pointer sits on an
  // editable field, which is what lets a tap auto-open the phone keyboard.
  const lastCursorTypeRef = useRef('default');
  // Armed by a tap: until this deadline, a 'text' cursor report auto-opens
  // the keyboard (deadline instead of a fixed timer — the report's arrival
  // time depends on the link and the host's cursor interval).
  const keyboardProbeUntilRef = useRef(0);
  const isMobileViewportRef = useRef(isMobileViewport);
  useEffect(() => { isMobileViewportRef.current = isMobileViewport; }, [isMobileViewport]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  // Host-created low-latency input channels. Until now the web viewer ignored
  // them and pushed ALL input over the reliable ordered 'control' channel —
  // where a running file transfer or clipboard sync head-of-line-blocks every
  // click and keystroke. Desktop parity: transient events (mousemove/wheel) on
  // 'input' (unordered, lossy), state transitions on 'input-critical'.
  const inputChannelRef = useRef<RTCDataChannel | null>(null);
  const criticalInputChannelRef = useRef<RTCDataChannel | null>(null);
  // Desktop hosts ping on the control channel every second. ICE keepalives run
  // on the host's network threads, so a host whose app has hung keeps the
  // connection "connected" while sending no picture and injecting no input —
  // from here that is a frozen screen and dead clicks with nothing to explain
  // it. Silence on a channel that had been pinging is how the viewer tells.
  // (Android hosts never ping, so the check only arms once a ping is seen.)
  const lastHostMessageAtRef = useRef(0);
  const hostHeartbeatSeenRef = useRef(false);
  const [hostSilent, setHostSilent] = useState(false);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // The stream the <video> is playing, readable from inside pc.ontrack. The
  // host sends video and audio as separate node-datachannel tracks with no
  // shared msid, so each ontrack carries its own stream (or none) — late
  // tracks must fold into this one instead of replacing it (desktop parity).
  const remoteStreamRef = useRef<MediaStream | null>(null);
  // Track path: ontrack fires at SDP time, BEFORE any RTP arrives — keep a
  // "connecting" cover over the <video> until real frames paint, instead of
  // showing an undiagnosed black rectangle while ICE/decode still fail.
  const [trackPainted, setTrackPainted] = useState(false);
  useEffect(() => { setTrackPainted(false); }, [remoteStream]);
  const [deviceType, setDeviceType] = useState<string | null>(viewerRoute.deviceType || null);
  const deviceName = passedDeviceName || deviceId || 'Remote Node';

  // Name the browser tab after the machine being controlled. Sessions open in
  // their own tabs, so several identical "Remote365 – Secure Remote Desktop"
  // titles are indistinguishable once more than one is running; the device name
  // goes first because that's the part that survives the tab's narrow width.
  // Re-runs when the name resolves (it can arrive later, from the auth fetch),
  // so the restore target is captured once on mount — reading it inside the
  // effect would capture the title WE set on the previous run and leave a stale
  // device name on the tab after navigating away.
  const baseDocumentTitleRef = useRef(document.title);
  useEffect(() => {
    document.title = `${deviceName} — Remote365`;
    return () => { document.title = baseDocumentTitleRef.current; };
  }, [deviceName]);

  // Tell the dashboard tab this device is in a session, so its "In Active
  // Session" stat and filter are real. The desktop gets this from its main
  // process; on the web the session lives in a separate tab, so it has to
  // announce itself (see lib/activeSessions).
  useEffect(() => publishActiveSession(accessKey || deviceId || ''), [accessKey, deviceId]);

  const decoderRef = useRef<any>(null);
  const hasReceivedKeyframeRef = useRef(false);
  const [, forceRender] = useState({}); // used when hasReceivedKeyframe updates
  const iceQueue = useRef<any[]>([]);
  // Decode strategy ladder: hardware first, software on failure, then a
  // visible error instead of an endless black screen. Machines with a broken
  // or missing hardware H264 decoder are the "black screen on SOME systems"
  // case — the desktop app works there because Electron ships its own
  // Chromium, so the web viewer must fall back rather than fail silently.
  const decoderModeRef = useRef<'hw' | 'sw'>('hw');
  const [streamDecodeError, setStreamDecodeError] = useState<string | null>(null);

  const decodeFailCountRef = useRef(0);
  const reassemblyMap = useRef(new Map<bigint, { fragments: (Uint8Array | null)[], count: number, total: number }>());

  const initDecoder = (preferSoftware = false) => {
    if (remoteStream || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (decoderRef.current) {
       try { decoderRef.current.close(); } catch {}
       decoderRef.current = null;
    }
    const VideoDecoder = (window as any).VideoDecoder;
    if (!VideoDecoder) {
      console.error('[WebRTC] WebCodecs VideoDecoder is not available in this browser.');
      setStreamDecodeError('This browser cannot decode the video stream. Please use the latest Chrome or Edge.');
      return;
    }

    decoderModeRef.current = preferSoftware ? 'sw' : 'hw';

    const failover = () => {
      hasReceivedKeyframeRef.current = false;
      if (decoderModeRef.current === 'hw') {
        console.warn('[WebRTC] Hardware decode failed — retrying with software decoder.');
        initDecoder(true);
        // Fresh decoder needs a fresh keyframe to start from.
        if (dataChannelRef.current?.readyState === 'open') {
          try { dataChannelRef.current.send(JSON.stringify({ type: 'request-keyframe' })); } catch {}
        }
      } else {
        setStreamDecodeError('Video decoding failed on this machine. Try updating your browser or graphics drivers.');
      }
      forceRender({});
    };

    try {
      const decoder = new VideoDecoder({
        output: (frame: any) => {
          if (canvasRef.current) {
            ctx.drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          if (!hasReceivedKeyframeRef.current) {
            hasReceivedKeyframeRef.current = true;
            setStreamDecodeError(null);
            forceRender({});
          }
          frame.close();
        },
        error: (e: any) => {
          console.error('[WebRTC] Decoder error:', e);
          failover();
        },
      });
      decoder.configure({
        codec: 'avc1.42E029',
        optimizeForLatency: true,
        // 'prefer-software' rescues machines whose GPU decoder is broken;
        // default (no-preference) lets healthy machines use hardware.
        ...(preferSoftware ? { hardwareAcceleration: 'prefer-software' } : {}),
      });
      decoderRef.current = decoder;
    } catch (err) {
      console.error('[WebRTC] Decoder init failed:', err);
      failover();
    }
  };

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const feedToDecoder = (chunkData: Uint8Array, timestamp: bigint) => {
    if (!decoderRef.current || decoderRef.current.state !== 'configured') return;
    
    let type: 'key' | 'delta' = 'delta';
    for (let i = 0; i < Math.min(chunkData.length - 5, 256); i++) {
        const isHeader4 = chunkData[i] === 0 && chunkData[i+1] === 0 && chunkData[i+2] === 0 && chunkData[i+3] === 1;
        const isHeader3 = chunkData[i] === 0 && chunkData[i+1] === 0 && chunkData[i+2] === 1;
        
        if (isHeader4 || isHeader3) {
            let nalType = -1;
            if (isHeader4) { 
                nalType = chunkData[i+4] & 0x1F;
            } else {
                nalType = chunkData[i+3] & 0x1F;
            }

            if (nalType === 5 || nalType === 7 || nalType === 8) {
                type = 'key';
                if (!hasReceivedKeyframeRef.current) {
                    console.log(`[VideoPlayer] Initial Keyframe Found (type:${nalType})`);
                    hasReceivedKeyframeRef.current = true;
                    forceRender({});
                }
                break;
            }
        }
    }

    if (!hasReceivedKeyframeRef.current) return;

    if (viewerStatus !== 'streaming') {
      console.log(`[VideoPlayer] Transitioning to STREAMING. First frame type: ${type}, size: ${chunkData.length}`);
      setViewerStatus('streaming');
    }

    try {
      const EncodedVideoChunk = (window as any).EncodedVideoChunk;
      if (!EncodedVideoChunk) return;

      const encodedChunk = new EncodedVideoChunk({
        type: type,
        timestamp: Number(timestamp),
        data: chunkData,
      });

      if (Math.random() < 0.01) {
        console.log(`[VideoPlayer] Feeding ${type} frame to decoder (${chunkData.length} bytes)`);
      }

      decoderRef.current.decode(encodedChunk);
      decodeFailCountRef.current = 0;
    } catch (e) {
      console.warn('[VideoPlayer] Decoder push failed:', e);
      // A decoder wedged in 'closed'/'unconfigured' state throws on every
      // push — rebuild it (software on the second strike) instead of
      // black-screening forever.
      decodeFailCountRef.current += 1;
      if (decodeFailCountRef.current >= 8) {
        decodeFailCountRef.current = 0;
        const preferSoftware = decoderModeRef.current === 'hw';
        initDecoder(preferSoftware);
        onControlEvent({ type: 'request-keyframe' });
      }
    }
  };

  const handleFragment = (data: Uint8Array) => {
    if (data.length < 10) return;
    const view = new DataView(data.buffer, data.byteOffset, 10);
    const ts = view.getBigInt64(0, true);
    const fragIdx = view.getUint8(8);
    const totalFrags = view.getUint8(9);
    let entry = reassemblyMap.current.get(ts);
    if (!entry) {
      entry = { fragments: new Array(totalFrags).fill(null), count: 0, total: totalFrags };
      reassemblyMap.current.set(ts, entry);
    }
    if (!entry.fragments[fragIdx]) {
      entry.fragments[fragIdx] = data.slice(10);
      entry.count++;
      
      if (Math.random() < 0.005) {
        console.log(`[WebRTC] Fragment arrival: TS=${ts} Frag=${fragIdx+1}/${totalFrags}`);
      }
    }
    if (entry.count === entry.total) {
      const totalSize = entry.fragments.reduce((acc, f) => acc + (f ? f.length : 0), 0);
      const fullNAL = new Uint8Array(totalSize);
      let offset = 0;
      for (const f of entry.fragments) {
        if (f) { fullNAL.set(f, offset); offset += f.length; }
      }
      feedToDecoder(fullNAL, ts);
      reassemblyMap.current.delete(ts);
      if (reassemblyMap.current.size > 20) {
        const oldestTs = Array.from(reassemblyMap.current.keys()).sort()[0] as any;
        reassemblyMap.current.delete(oldestTs);
      }
    }
  };

  useEffect(() => {
    if (!accessToken || !deviceId) return;
    const ws = initSocket(accessToken);

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    // Warm the real ICE configuration before asking the host for an offer.
    // Previously the WebSocket could already be open, join immediately, and
    // receive an offer while this PC still knew only Google STUN. On carrier/
    // symmetric NAT that first gather omitted TURN and the session stayed
    // connecting even though signaling later called setConfiguration().
    const iceConfigurationReady = api.get('/api/auth/ice-servers', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(({ data }: { data: any }) => {
      if (Array.isArray(data?.iceServers) && data.iceServers.length > 0 && pcRef.current === pc) {
        pc.setConfiguration({ iceServers: data.iceServers });
        console.log(`[WebRTC] Preloaded ${data.iceServers.length} ICE servers before joining.`);
      }
    }).catch((error: any) => {
      // Signaling's joined payload remains a second source, and STUN-only is
      // still useful on directly reachable networks.
      console.warn('[WebRTC] ICE preload failed; continuing with signaling fallback:', error?.message || error);
    });

    const handleOpen = async () => {
      await iceConfigurationReady;
      if (pcRef.current !== pc) return;
      console.log('[Signaling] Join session:', accessKey || deviceId);
      // Tell the host what we are. Phones skip the view-only consent flow —
      // the host matches /^mobile/ and grants control on connect, same as the
      // native mobile app. Desktop browsers still have to ask.
      sendMessage('join', {
        sessionId: accessKey || deviceId,
        token: accessToken,
        viewerClientId,
        clientKind: isMobileViewportRef.current ? 'mobile-web-viewer' : 'web-viewer',
      });
    };

    if (ws.readyState === WebSocket.OPEN) void handleOpen();
    const cleanupOpen = onMessage('open', () => { void handleOpen(); });

    // Surface join rejections (expired grant, session not found, bad token)
    // instead of spinning on "connecting" forever.
    const cleanupJoined = onMessage('joined', (msg: any) => {
      if (msg?.success === false) {
        console.error('[Signaling] Join rejected:', msg.error);
        setFatalError(msg.error || 'Could not join the session.');
        return;
      }
      // The join grant carries the real STUN+TURN list. Apply it before the
      // host's offer arrives — with only the default STUN server, viewers on
      // carrier NAT (mobile data) usually fail ICE and never see a frame.
      if (Array.isArray(msg?.iceServers) && msg.iceServers.length > 0 && pcRef.current) {
        try {
          pcRef.current.setConfiguration({ iceServers: msg.iceServers });
          console.log(`[WebRTC] Applied ${msg.iceServers.length} ICE servers from signaling.`);
        } catch (e) {
          console.warn('[WebRTC] Could not apply ICE servers from signaling:', e);
        }
      }
    });

    const cleanupOffer = onMessage('offer', async (msg: any) => {
      if (!pcRef.current) return;
      console.log('[WebRTC] Received offer, setting remote description');
      
      const sdp = msg.sdp || msg;
      const senderId = msg.senderId || msg.sourceId;
      if (msg.hostType) setDeviceType(msg.hostType);
      
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        sendMessage('answer', { targetId: senderId || accessKey || deviceId, sdp: answer.sdp });
        
        // Process queued ice candidates
        if (iceQueue.current.length > 0) {
          console.log(`[WebRTC] Processing ${iceQueue.current.length} queued ICE candidates`);
          while (iceQueue.current.length > 0) {
            const cand = iceQueue.current.shift();
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      } catch (e) {
        console.error('[WebRTC] Offer handling error:', e);
      }
    });

    const cleanupIce = onMessage('ice-candidate', async (msg: any) => {
      if (!pcRef.current) return;
      
      const candidateData = {
        candidate: typeof msg.candidate === 'string' ? msg.candidate : msg.candidate?.candidate, 
        sdpMid: msg.sdpMid || msg.candidate?.sdpMid,
        sdpMLineIndex: msg.sdpMLineIndex || msg.candidate?.sdpMLineIndex
      };

      if (!candidateData.candidate) return;

      if (pcRef.current.remoteDescription) {
        try { 
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidateData as RTCIceCandidateInit)); 
        } catch (e) {
          console.error('[WebRTC] Add ICE candidate failed:', e);
        }
      } else {
        console.log('[WebRTC] Queueing ICE candidate (remote description not set)');
        iceQueue.current.push(candidateData);
      }
    });

    const handshakeInterval = setInterval(() => {
      if (pcRef.current && !pcRef.current.remoteDescription && viewerStatus !== 'error') {
        const retries = (handshakeInterval as any)._retries || 0;
        (handshakeInterval as any)._retries = retries + 1;
        console.log(`[Signaling] retry request-offer (${retries + 1})...`);
        sendMessage('request-offer', { targetId: accessKey || deviceId });
        
        if (retries > 5) {
          console.warn('[Signaling] Host not responding to offer requests. Check if host is online.');
        }
      }
    }, 2000);

    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE Gathering State: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE Connection State: ${pc.iceConnectionState}`);
    };

    // 'disconnected' is frequently transient (WiFi blip) and ICE self-heals in
    // seconds — only 'failed' is terminal. Grace the former instead of dropping
    // the session and paying a full reconnect + first-keyframe wait.
    let disconnectGraceTimer: number | null = null;
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection State: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        if (disconnectGraceTimer != null) {
          window.clearTimeout(disconnectGraceTimer);
          disconnectGraceTimer = null;
          console.log('[WebRTC] Transient disconnect self-healed.');
        }
      } else if (pc.connectionState === 'failed') {
        if (disconnectGraceTimer != null) { window.clearTimeout(disconnectGraceTimer); disconnectGraceTimer = null; }
        setViewerStatus('connection_lost');
      } else if (pc.connectionState === 'disconnected') {
        if (disconnectGraceTimer == null) {
          disconnectGraceTimer = window.setTimeout(() => {
            disconnectGraceTimer = null;
            if (pc.connectionState === 'disconnected') setViewerStatus('connection_lost');
          }, 4000);
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage('ice-candidate', { 
          targetId: accessKey || deviceId, 
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
      }
    };

    // Fresh connection, fresh stream: folding a new pc's tracks into a stream
    // from a previous attempt would leave the <video> on dead tracks.
    remoteStreamRef.current = null;
    hostHeartbeatSeenRef.current = false;
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Stream Track Received: ${event.track?.kind || 'unknown'}`);
      // Prime the playout buffer IMMEDIATELY (~2 frame intervals). Without
      // this the first seconds play nearly unbuffered until the adaptive
      // stats loop's first retune — the "shaky at start" symptom.
      try {
        const receiver: any = event.receiver;
        if (receiver && (!event.track || event.track.kind === 'video')) {
          if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = 60;
          if ('playoutDelayHint' in receiver) receiver.playoutDelayHint = 0.06;
        }
      } catch { /* older browsers */ }
      const existing = remoteStreamRef.current;
      if (existing && event.track) {
        // Late track (typically the host's loopback audio): add it to the
        // stream the <video> is already playing — it starts without touching
        // srcObject, so the picture never restarts.
        if (!existing.getTracks().some((t) => t.id === event.track.id)) existing.addTrack(event.track);
        setAudioTrackRevision((n) => n + 1);
      } else {
        const stream = event.streams[0] || (event.track ? new MediaStream([event.track]) : null);
        if (!stream) return;
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
      setViewerStatus('streaming');
      updateSessionStatus('active');
      // Some hosts start streaming before they've emitted a keyframe on the
      // new peer, so the video element gets a track but nothing paints (the
      // "black screen" symptom). Ask the host to send one immediately over
      // the control channel if it's already open — the recovery loop below
      // covers the case where the control channel opens later.
      if (dataChannelRef.current?.readyState === 'open') {
        try { dataChannelRef.current.send(JSON.stringify({ type: 'request-keyframe' })); } catch {}
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log(`[WebRTC] Incoming DataChannel: ${channel.label}`);
      
      if (channel.label === 'control') {
        dataChannelRef.current = channel;
        channel.onopen = () => {
          console.log('[WebRTC] Control DataChannel OPEN');
          channel.send(JSON.stringify({ type: 'request-keyframe' }));
        };
        channel.onclose = () => console.log('[WebRTC] Control DataChannel CLOSED');
        // File chunks from the host arrive as binary frames on this channel.
        channel.binaryType = 'arraybuffer';
        channel.onmessage = (e) => {
          lastHostMessageAtRef.current = performance.now();
          if (e.data instanceof ArrayBuffer) {
            fileXferRef.current?.handleBinary(e.data);
            return;
          }
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'ping') { hostHeartbeatSeenRef.current = true; return; }
            if (fileXferRef.current?.handleJson(data)) return;
            if (data.type === 'clipboard' && data.text) navigator.clipboard.writeText(data.text).catch(() => {});
            else if (data.type === 'control-granted') { setHostAnnouncedControl(true); setControlStatus('granted'); }
            else if (data.type === 'control-pending') { setHostAnnouncedControl(true); setControlStatus('pending'); }
            else if (data.type === 'control-denied') { setHostAnnouncedControl(true); setControlStatus('denied'); }
            else if (data.type === 'recording-state') {
              // Another party (or the host relaying a co-viewer) started/stopped
              // recording this session — every participant gets told.
              setSessionNotice(data.on
                ? `${data.byName || 'Someone'} started recording this session.`
                : `${data.byName || 'Someone'} stopped recording this session.`);
            }
            else if (data.type === 'cursor') {
              // The host reports the real cursor shape under the remote pointer
              // (already CSS names: text / pointer / move / *-resize / wait…),
              // so hovering an input shows the I-beam, links show the hand, etc.
              // Written straight to the DOM — this fires on every remote mouse
              // move and must not re-render React.
              const css = typeof data.cursorType === 'string' && data.cursorType ? data.cursorType : 'default';
              if (videoRef.current) videoRef.current.style.cursor = css;
              if (canvasRef.current) canvasRef.current.style.cursor = css;
              lastCursorTypeRef.current = css;
              // A recent tap parked the remote cursor on an editable field —
              // open the phone keyboard. (iOS may ignore focus outside the
              // touch gesture; the in-gesture path in touchend covers it on
              // the next tap, once the shape is already known to be 'text'.)
              if (css === 'text' && isMobileViewportRef.current && Date.now() < keyboardProbeUntilRef.current) {
                keyboardProbeUntilRef.current = 0;
                focusMobileKeyboard();
              }
              // Phones can't show a CSS cursor — draw the reported position
              // as an arrow overlay instead.
              lastRemoteCursorRef.current = data;
              updateRemoteCursorOverlay(data);
            }
            else if (data.type === 'chat') {
              // Chat from the person at the host machine (their side lives in
              // the host dock) — processed by the chat effect below.
              setRemoteChatEvent({ ...data, receivedAt: Date.now() });
            }
          } catch {}
        };
      } else if (channel.label === 'input') {
        inputChannelRef.current = channel;
        channel.onopen = () => console.log('[WebRTC] Input DataChannel OPEN');
        channel.onclose = () => { if (inputChannelRef.current === channel) inputChannelRef.current = null; };
      } else if (channel.label === 'input-critical') {
        criticalInputChannelRef.current = channel;
        channel.onopen = () => console.log('[WebRTC] Critical input DataChannel OPEN');
        channel.onclose = () => { if (criticalInputChannelRef.current === channel) criticalInputChannelRef.current = null; };
      } else if (channel.label === 'video') {
        channel.binaryType = 'arraybuffer';
        channel.onopen = () => {
          console.log('[WebRTC] Video DataChannel OPEN');
          if (!remoteStream) { setViewerStatus('streaming'); updateSessionStatus('active'); initDecoder(); }
        };
        channel.onclose = () => console.log('[WebRTC] Video DataChannel CLOSED');
        channel.onmessage = (e) => {
          if (!remoteStream) handleFragment(new Uint8Array(e.data as ArrayBuffer));
        };
      }
    };

    const cleanupLatency = onMessage('session:latency', ({ value }) => { updateLatency(value); });
    const cleanupDisconnect = onMessage('disconnect', () => setViewerStatus('connection_lost'));
    const cleanupError = onMessage('error', () => {
      console.error('[Signaling] WebSocket error received');
      setViewerStatus('error');
    });

    return () => {
      console.log('[WebRTC] Cleaning up session components...');
      clearInterval(handshakeInterval);
      cleanupOpen();
      cleanupJoined();
      cleanupOffer();
      cleanupIce();
      cleanupLatency();
      cleanupDisconnect();
      cleanupError();
      pc.close();
      pcRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, accessToken]);

  const onControlEvent = useCallback((data: any) => {
    if (viewerStatus !== 'streaming' && viewerStatus !== 'connected') return;
    // View-only session: drop input locally instead of shipping it to be
    // refused. Mirrors the host's ALLOWED_BEFORE_CONTROL plus the messages it
    // handles ahead of that gate. Binary (file chunks) is exempt.
    if (!isMobileViewportRef.current
      && hostAnnouncedControlRef.current
      && !(data instanceof Uint8Array)
      && controlStatusRef.current !== 'granted'
      && !SENDABLE_BEFORE_CONTROL.has(data?.type)) {
      return;
    }
    if (data instanceof Uint8Array) {
      if (dataChannelRef.current?.readyState === 'open') dataChannelRef.current.send(data as any);
      return;
    }
    // Route like the desktop viewer so input never queues behind file/clipboard
    // traffic on 'control': stale-droppable travel on 'input', must-arrive
    // transitions and composed input on 'input-critical'. Falls back to
    // 'control' whenever the host didn't offer the channel (older hosts).
    const type = data?.type;
    const isTransient = type === 'mousemove' || type === 'wheel';
    const isCritical = type === 'mousedown' || type === 'mouseup' || type === 'keydown' || type === 'keyup'
      || type === 'typeText' || type === 'keyCombo' || type === 'shortcut';
    let channel: RTCDataChannel | null = null;
    if (isCritical && criticalInputChannelRef.current?.readyState === 'open') {
      channel = criticalInputChannelRef.current;
    } else if (isTransient && inputChannelRef.current?.readyState === 'open') {
      channel = inputChannelRef.current;
      // Shed stale pointer travel under congestion — never clicks/keys.
      if (channel.bufferedAmount > 65536) return;
    }
    if (!channel) channel = dataChannelRef.current?.readyState === 'open' ? dataChannelRef.current : null;
    if (channel) channel.send(JSON.stringify(data));
  }, [viewerStatus]);

  // --- In-session chat (desktop RemoteSessionChrome parity) ---------------
  // Messages ride the control data channel as {type:'chat'}; the person at
  // the host machine reads and replies from the dock chat window.
  useEffect(() => {
    if (!remoteChatEvent || typeof remoteChatEvent.text !== 'string' || !remoteChatEvent.text) return;
    if (remoteChatEvent.receivedAt && remoteChatEvent.receivedAt === chatSeenRef.current) return;
    chatSeenRef.current = remoteChatEvent.receivedAt || Date.now();
    const from = String(remoteChatEvent.from || deviceName || 'Remote user').slice(0, 80);
    const text = String(remoteChatEvent.text).slice(0, 2000);
    setChatMessages((list) => [...list, { from, text, at: remoteChatEvent.at || Date.now(), mine: false }]);
    if (!chatOpenRef.current) setChatUnread((count) => count + 1);
  }, [remoteChatEvent, deviceName]);

  // Keep the newest message in view.
  useEffect(() => {
    if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages, chatOpen]);

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    onControlEvent({ type: 'chat', text });
    setChatMessages((list) => [...list, { from: 'You', text, at: Date.now(), mine: true }]);
    setChatDraft('');
  };

  // --- Adaptive stream quality (Auto mode) --------------------------------
  // The host encodes at a fixed CBR tier and has no bandwidth estimation of its
  // own, so a viewer on a congested link must ask it to step down — otherwise
  // the stream degrades into loss-driven blur, frozen frames and low fps.
  // Mirrors the desktop viewer's loss-based tuner (apps/desktop/src/renderer/App.tsx):
  // only packet loss (real congestion) lowers the tier; RTT alone must not blur
  // the picture on long-haul links. Stands down while the user pins a quality.
  //
  // Every tier change makes the host stop and restart capture and its encoder
  // (new resolution, new frame rate, a fresh keyframe burst), so the ladder has
  // to move as carefully as the desktop viewer's does. It used to start at
  // 'ultra' and report that on its first sample, which overrode the host's own
  // 'balanced' start 1.5s into every session, and it climbed a tier after 4.5
  // clean seconds: on a link that cannot hold the top tier the host was
  // restarting its encoder every few seconds, and the picture stops at each
  // restart until the new keyframe arrives. Now it starts where the host
  // starts and only reports changes.
  const lastAdaptiveModeRef = useRef<'smooth' | 'balanced' | 'sharp' | 'ultra'>('balanced');
  useEffect(() => {
    if (viewerStatus !== 'streaming' || qualityMode !== 'auto') return;
    let prevReceived = 0;
    let prevLost = 0;
    let upshiftStreak = 0;
    let downshiftStreak = 0; // two lossy samples required before dropping a tier
    let warmedUp = false; // first sample's counters are cumulative: never act on it
    // Only loss that matters (>=0.5% of a sample) holds the climb back; a stray
    // packet must not pin the session at a blurry tier.
    let lastMeaningfulLossAt = 0;
    // Samples run every 1.5s: about ten clean seconds per tier going up.
    const UPSHIFT_SAMPLES = 7;
    const rank: Record<string, number> = { smooth: 0, balanced: 1, sharp: 2, ultra: 3 };
    const order: Array<'smooth' | 'balanced' | 'sharp' | 'ultra'> = ['smooth', 'balanced', 'sharp', 'ultra'];
    const interval = window.setInterval(async () => {
      const pc = pcRef.current;
      const channel = dataChannelRef.current;
      if (!pc || pc.connectionState !== 'connected' || !channel || channel.readyState !== 'open') return;
      try {
        const stats = await pc.getStats();
        let rttMs = 0;
        let fps = 0;
        let received = prevReceived;
        let lost = prevLost;
        let sawVideoRtp = false;
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && (report.nominated || report.selected) && typeof report.currentRoundTripTime === 'number') {
            rttMs = Math.max(rttMs, Math.round(report.currentRoundTripTime * 1000));
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            sawVideoRtp = true;
            received = Number(report.packetsReceived || 0);
            lost = Math.max(0, Number(report.packetsLost || 0));
            fps = Number(report.framesPerSecond || 0);
          }
        });
        const dReceived = Math.max(0, received - prevReceived);
        const dLost = Math.max(0, lost - prevLost);
        prevReceived = received;
        prevLost = lost;
        const lossPct = (dReceived + dLost) > 0 ? Math.round((dLost / (dReceived + dLost)) * 1000) / 10 : 0;

        // Keep Chromium's playout buffer matched to live conditions: small on a
        // clean link (latency), larger under loss/high RTT (smoothness). Floor
        // 30ms on snappy links (<80ms RTT), 45ms otherwise — a sub-frame buffer
        // turns any delivery wobble into visible repaint stutter.
        const jitterFloorMs = rttMs > 0 && rttMs < 80 ? 30 : 45;
        const jitterTargetMs = Math.round(Math.min(95, Math.max(jitterFloorMs, 18 + rttMs * 0.08 + lossPct * 12)));
        const receiver = pc.getReceivers().find((r) => r.track && r.track.kind === 'video') as any;
        if (receiver) {
          try {
            if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = jitterTargetMs;
            if ('playoutDelayHint' in receiver) receiver.playoutDelayHint = jitterTargetMs / 1000;
          } catch { /* receiver may be gone mid-teardown */ }
        }

        const reason = lossPct >= 5 ? 'loss-high' : lossPct >= 1.5 ? 'loss-moderate' : 'healthy';
        // Long-haul ceiling (desktop parity): past ~180ms RTT the 'ultra' tier's
        // bitrate just deepens queueing delay on the bottleneck link.
        const healthyCeiling = rttMs >= 180 ? 'sharp' : 'ultra';
        const target = lossPct >= 5 ? 'smooth' : lossPct >= 1.5 ? 'balanced' : healthyCeiling;
        if (lossPct >= 0.5) lastMeaningfulLossAt = Date.now();
        const painted = remoteStreamRef.current
          ? (videoRef.current?.videoWidth ?? 0) > 0
          : hasReceivedKeyframeRef.current;
        const current = lastAdaptiveModeRef.current;
        let next = current;
        if (!painted) {
          // Never restart the encoder while the first picture is still on its
          // way: that throws away the startup keyframe the viewer is waiting for.
          upshiftStreak = 0;
          downshiftStreak = 0;
        } else if (!warmedUp) {
          warmedUp = true;
        } else if (rank[target] < rank[current]) {
          // Congestion — require TWO consecutive lossy samples before dropping:
          // every tier change restarts the host encoder (a visible quality
          // flip), so one 1.5s blip must not trigger it. One tier at a time;
          // only catastrophic loss drops straight to the safe tier.
          downshiftStreak++;
          upshiftStreak = 0;
          const catastrophicLoss = lossPct >= 30;
          if (catastrophicLoss || downshiftStreak >= 2) {
            next = catastrophicLoss ? target : order[Math.max(rank[current] - 1, rank[target])];
            downshiftStreak = 0;
          }
        } else if (rank[target] > rank[current]) {
          // Headroom: raise one tier at a time, and only after a sustained
          // clean window, so we don't overshoot the link and re-congest. An
          // interval with no video packets at all proves nothing about the
          // link (the picture is stalled), so it never counts as clean.
          downshiftStreak = 0;
          const cleanLongEnough = lastMeaningfulLossAt === 0 || Date.now() - lastMeaningfulLossAt >= 20_000;
          const stalled = sawVideoRtp && dReceived === 0;
          upshiftStreak = cleanLongEnough && !stalled ? upshiftStreak + 1 : 0;
          if (upshiftStreak >= UPSHIFT_SAMPLES) {
            next = order[Math.min(rank[current] + 1, order.length - 1)];
            upshiftStreak = 0;
          }
        } else {
          upshiftStreak = 0;
          downshiftStreak = 0;
        }
        if (next !== lastAdaptiveModeRef.current) {
          lastAdaptiveModeRef.current = next;
          channel.send(JSON.stringify({ type: 'stream-quality', mode: next, rttMs, lossPct, fps: Math.round(fps), reason }));
        }
      } catch { /* getStats can fail during teardown */ }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [viewerStatus, qualityMode]);

  useEffect(() => {
    const isMobileKeyboardEvent = (e: KeyboardEvent) => e.target === mobileKeyboardRef.current;
    // Ctrl/Cmd+V is handled by the 'paste' listener below (it carries the
    // viewer machine's clipboard text) — forwarding the raw chord as keys too
    // would make the remote paste twice, the second time with stale content.
    const isLocalPasteChord = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V');
    // Printable single character with no system modifiers → the mobile host's
    // accessibility injectText handles character input directly (keyCode alone
    // can't tell it what to type). Desktop hosts also accept typeText, so
    // sending both would type twice — send ONE 'typeText' for the character and
    // skip the corresponding keydown/keyup. Shift-produced symbols land as
    // e.key already ("A", "!", "@"), so no shift chord needed.
    const isPrintable = (e: KeyboardEvent) =>
      e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    const enriched = (e: KeyboardEvent, type: 'keydown' | 'keyup') => ({
      type,
      // key and modifier flags let the mobile-native-host inject characters
      // via AccessibilityService (see hostStore.ts keydown case) — keyCode
      // alone is Windows-only. Desktop host still uses keyCode for injection.
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      // Live CapsLock STATE — the host mirrors this instead of replaying
      // CapsLock keypresses (which double-fire and drift the toggle state).
      capsLock: typeof e.getModifierState === 'function' ? e.getModifierState('CapsLock') : undefined,
      repeat: e.repeat,
    });
    // The CapsLock KEY itself is never forwarded — see capsLock state above.
    const isCapsLockKey = (e: KeyboardEvent) => e.key === 'CapsLock';
    // Keys typed into session UI (chat panel, keyboard popover, dialogs) stay
    // local — they must not be injected into the remote desktop.
    const isSessionUiTarget = (e: Event) =>
      Boolean((e.target as HTMLElement | null)?.closest?.('[data-session-ui]'));
    // Desktop hosts get RAW per-key down/up for printable keys too (TeamViewer
    // style): batched typeText only produces WM_CHAR text on the host, which
    // raw-input apps (scrcpy, games, terminals, VMs) ignore or mangle, and it
    // loses key-repeat/hold. Mobile hosts keep typeText — their accessibility
    // injection needs the character itself.
    const hostIsMobile = /mobile|android|ios/.test(String(deviceType || '').toLowerCase());
    const handleKeyDown = (e: KeyboardEvent) => {
      // While a confirm dialog is up, the keyboard belongs to the dialog.
      if (uiModalOpenRef.current) {
        if (e.key === 'Escape') {
          setShowDisconnectConfirm(false);
          setPendingAction(null);
        }
        return;
      }
      if (isSessionUiTarget(e) || isMobileKeyboardEvent(e) || isLocalPasteChord(e) || isCapsLockKey(e)) return;
      if (isPrintable(e)) {
        // Prevent the browser from treating the key as a page shortcut
        // (Space scrolls, '/' opens quick find, etc.) while the session
        // owns focus. Only for pure typing — shortcut keys still bubble.
        e.preventDefault();
        if (hostIsMobile) {
          onControlEvent({ type: 'typeText', text: e.key });
          return;
        }
      }
      onControlEvent(enriched(e, 'keydown'));
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (uiModalOpenRef.current || isSessionUiTarget(e) || isMobileKeyboardEvent(e) || isLocalPasteChord(e) || isCapsLockKey(e)) return;
      // typeText covers the whole press/release for printable characters on
      // MOBILE hosts — no matching keyup there. Desktop hosts get real keyups.
      if (isPrintable(e) && hostIsMobile) return;
      onControlEvent(enriched(e, 'keyup'));
    };
    // Viewer → remote clipboard, permission-free: the browser hands over the
    // local clipboard in the paste event (unlike clipboard.readText from a
    // timer, which Chrome rejects without a prior grant). The host writes the
    // text to its clipboard and injects Ctrl+V, so pressing Ctrl+V in the
    // session pastes whatever was last copied on the viewer machine.
    const handlePaste = (e: ClipboardEvent) => {
      if (isSessionUiTarget(e) || e.target === mobileKeyboardRef.current) return;
      const text = e.clipboardData?.getData('text');
      if (!text) return;
      e.preventDefault();
      onControlEvent({ type: 'paste-clipboard', text });
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
    };
  }, [onControlEvent, deviceType]);

  // Keyframe recovery / black-screen watchdog. Two failure modes to cover:
  //   1) Chunk path (WebCodecs canvas): the decoder is up but no keyframe
  //      arrived yet — canvas stays hidden by opacity, connecting overlay is
  //      still visible.
  //   2) MediaStream track path: <video> has a track but no frames paint
  //      (videoWidth stays 0) — user sees a solid black screen with the
  //      overlay already gone. Previously the loop skipped this case because
  //      remoteStream was set, so recovery never fired.
  // Poll faster than before so users don't stare at black for 4+ seconds.
  useEffect(() => {
    if (viewerStatus !== 'streaming' && viewerStatus !== 'connected' && viewerStatus !== 'connecting') return;
    const timer = setInterval(() => {
      const chunkPathStalled = !remoteStream && !hasReceivedKeyframeRef.current;
      const trackPathBlack = !!remoteStream && (videoRef.current?.videoWidth ?? 0) === 0;
      if (chunkPathStalled || trackPathBlack) {
        console.log(`[Web] No frames yet (${chunkPathStalled ? 'chunk-path' : 'track-path'}) — requesting keyframe`);
        // urgent: the desktop host IGNORES non-urgent keyframe requests, so
        // this watchdog was a no-op against it.
        onControlEvent({ type: 'request-keyframe', urgent: true });
      }
      // Autoplay rescue: some phone browsers (Low Power Mode, in-app webviews)
      // block even muted autoplay and the play() rejection is silent.
      if (videoRef.current?.paused && remoteStream) videoRef.current.play().catch(() => {});
    }, 1500);
    return () => clearInterval(timer);
  }, [viewerStatus, remoteStream, onControlEvent]);

  // Live-stall recovery (desktop viewer parity). The watchdog above only covers
  // a stream that never painted; a picture that froze MID-session had nothing
  // watching it, so the viewer sat on a dead frame (clicks landing unseen)
  // until the host happened to produce a keyframe. When no frame has been
  // presented for 5s, ask for an urgent keyframe and report how long the stall
  // is — past 6s the host restarts its encoder (15s cooldown on its side).
  // A hidden tab presents no frames at all, which is not a stall: the probe
  // stands down while hidden and starts a fresh clock, with a keyframe, when
  // the tab comes back.
  const onControlEventRef = useRef(onControlEvent);
  onControlEventRef.current = onControlEvent;
  useEffect(() => {
    if (viewerStatus !== 'streaming' || !remoteStream) return;
    const video = videoRef.current as any;
    if (!video || typeof video.requestVideoFrameCallback !== 'function') return;
    let cancelled = false;
    let lastPresentedAt = performance.now();
    let callbackId: number | null = null;
    const onPresentedFrame = () => {
      if (cancelled) return;
      lastPresentedAt = performance.now();
      callbackId = video.requestVideoFrameCallback(onPresentedFrame);
    };
    callbackId = video.requestVideoFrameCallback(onPresentedFrame);
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      lastPresentedAt = performance.now();
      onControlEventRef.current({ type: 'request-keyframe', reason: 'tab-visible' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    const probe = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) return;
      const stalledMs = performance.now() - lastPresentedAt;
      if (stalledMs < 5000) return;
      console.warn(`[Web] No frame presented for ${Math.round(stalledMs)}ms — requesting recovery keyframe`);
      onControlEventRef.current({ type: 'request-keyframe', urgent: true, reason: 'presentation-stalled', stalledMs: Math.round(stalledMs) });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(probe);
      document.removeEventListener('visibilitychange', onVisibility);
      if (callbackId != null && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(callbackId);
    };
  }, [viewerStatus, remoteStream]);

  // Host-heartbeat watch (see lastHostMessageAtRef). After 6s of silence say so
  // on screen; after 30s the session is over in all but name, so end it and
  // offer Reconnect instead of leaving a frozen picture. A hidden tab's timers
  // are throttled and may run before queued messages are delivered, so the
  // clock restarts when the tab comes back rather than counting hidden time.
  useEffect(() => {
    if (viewerStatus !== 'streaming') return;
    lastHostMessageAtRef.current = performance.now();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') lastHostMessageAtRef.current = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(() => {
      if (!hostHeartbeatSeenRef.current || document.visibilityState !== 'visible') return;
      const silentMs = performance.now() - lastHostMessageAtRef.current;
      if (silentMs >= 30_000) {
        console.warn(`[Web] Host silent for ${Math.round(silentMs)}ms on the control channel — ending the session.`);
        setViewerStatus('connection_lost');
        return;
      }
      setHostSilent(silentMs >= 6000);
    }, 2000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [viewerStatus]);

  // Desktop-mouse scroll → remote scroll. Attached manually (passive: false)
  // so preventDefault works — React's onWheel is passive and the page would
  // scroll instead of the remote screen. In "Actual size" mode the wheel keeps
  // panning the oversized stream locally, matching the grab-to-pan cursor.
  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    const onWheel = (e: WheelEvent) => {
      if (zoomMode === 'original') return;
      e.preventDefault();
      onControlEvent({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY, x: lastPointerRef.current.x, y: lastPointerRef.current.y });
    };
    target.addEventListener('wheel', onWheel, { passive: false });
    return () => target.removeEventListener('wheel', onWheel);
  }, [onControlEvent, zoomMode]);

  // Viewer → host clipboard sync, mirroring the desktop viewer's automatic
  // sync: anything copied locally lands on the remote clipboard so Ctrl+V on
  // the remote side pastes it. Host → viewer already arrives as 'clipboard'
  // messages on the control channel. Reading the browser clipboard needs the
  // tab focused and (once) a permission grant; failures stay silent.
  useEffect(() => {
    if (viewerStatus !== 'streaming' && viewerStatus !== 'connected') return;
    // Not on phones: iOS anchors a native "Paste" permission callout to the
    // last touch on EVERY programmatic clipboard read, so the poll made each
    // tap pop a paste bubble. Host→viewer clipboard still works.
    if (isMobileViewport) return;
    let lastText = '';
    const timer = window.setInterval(async () => {
      if (!document.hasFocus()) return;
      try {
        const text = await navigator.clipboard?.readText?.();
        if (text && text !== lastText) {
          lastText = text;
          onControlEvent({ type: 'clipboard', text });
        }
      } catch { /* permission denied — host→viewer direction still works */ }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [viewerStatus, onControlEvent, isMobileViewport]);

  const focusMobileKeyboard = useCallback(() => {
    const input = mobileKeyboardRef.current;
    if (!input) return;
    input.value = '';
    input.focus({ preventScroll: true });
  }, []);

  const sendSpecialMobileKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const specialKeys: Record<string, number> = {
      Backspace: 8,
      Tab: 9,
      Enter: 13,
      Escape: 27,
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      Delete: 46,
    };
    const keyCode = specialKeys[event.key];
    if (!keyCode) return;
    event.preventDefault();
    onControlEvent({ type: 'keydown', keyCode });
    window.setTimeout(() => onControlEvent({ type: 'keyup', keyCode }), 12);
    if (mobileKeyboardRef.current) mobileKeyboardRef.current.value = '';
  };

  const sendMobileTypedText = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const input = event.currentTarget;
    const text = input.value;
    if (!text) return;
    onControlEvent({ type: 'typeText', text });
    input.value = '';
  };

  const requestLandscape = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
      }
      const orientation = (screen as any).orientation;
      if (orientation?.lock) {
        await orientation.lock('landscape').catch(() => undefined);
      }
    } catch {
      // iOS Safari may not allow programmatic orientation lock. Fullscreen
      // still helps, and the user can rotate the device manually.
    }
  }, []);

  // With object-contain the media element spans the whole panel but the actual
  // stream is letterboxed inside it. Normalizing against the element's rect
  // lands clicks in the wrong place whenever the panel's aspect ratio differs
  // from the stream's (fullscreen happened to match, so it looked fine there).
  // Map against the rendered content box instead.
  const getContentRect = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    let mediaW = 0;
    let mediaH = 0;
    if (target instanceof HTMLVideoElement) {
      mediaW = target.videoWidth;
      mediaH = target.videoHeight;
    } else if (target instanceof HTMLCanvasElement) {
      mediaW = target.width;
      mediaH = target.height;
    }
    if (!mediaW || !mediaH || !rect.width || !rect.height) return rect;
    const scale = Math.min(rect.width / mediaW, rect.height / mediaH);
    const width = mediaW * scale;
    const height = mediaH * scale;
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height,
    };
  };

  const normalizedPoint = (target: HTMLElement, clientX: number, clientY: number) => {
    const rect = getContentRect(target);
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    // Clicks on the letterbox bars are clamped to the stream edge.
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  };

  // Positions the phone cursor overlay from a host cursor report. Touches only
  // refs, so the (once-created) data-channel handler can call it safely.
  const updateRemoteCursorOverlay = (data: { x: number; y: number; visible?: boolean }) => {
    const el = remoteCursorElRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    if (!isMobileViewportRef.current || data.visible === false) { el.style.opacity = '0'; return; }
    const media = (videoRef.current ?? canvasRef.current) as HTMLElement | null;
    if (!media) { el.style.opacity = '0'; return; }
    const rect = getContentRect(media);
    const cRect = container.getBoundingClientRect();
    el.style.left = `${rect.left - cRect.left + Math.min(1, Math.max(0, Number(data.x) || 0)) * rect.width}px`;
    el.style.top = `${rect.top - cRect.top + Math.min(1, Math.max(0, Number(data.y) || 0)) * rect.height}px`;
    el.style.opacity = '1';
  };

  const applyPinchTransform = () => {
    const media = (videoRef.current ?? canvasRef.current) as HTMLElement | null;
    if (!media) return;
    const { scale, tx, ty } = pinchZoomRef.current;
    if (scale <= 1.001) {
      media.style.transform = '';
      media.style.transformOrigin = '';
      media.style.transition = '';
    } else {
      // The media element carries a transition-all class that would rubber-band
      // the pinch — suspend it while a zoom transform is active.
      media.style.transition = 'none';
      media.style.transformOrigin = '0 0';
      media.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    if (lastRemoteCursorRef.current) updateRemoteCursorOverlay(lastRemoteCursorRef.current);
  };

  // Keep the zoomed content covering the viewport — no gaps past the edges.
  const clampPinchPan = () => {
    const container = containerRef.current;
    if (!container) return;
    const z = pinchZoomRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;
    z.tx = Math.min(0, Math.max(w - w * z.scale, z.tx));
    z.ty = Math.min(0, Math.max(h - h * z.scale, z.ty));
  };

  // A stale zoom transform makes no sense once the media element is replaced
  // or the user picks a different scale mode.
  useEffect(() => {
    pinchZoomRef.current = { scale: 1, tx: 0, ty: 0 };
    applyPinchTransform();
  }, [zoomMode, remoteStream]);

  // Browsers fire compatibility MOUSE events after every touch (React's root
  // touch listeners are passive, so preventDefault can't stop them). Without
  // this guard each phone tap reached the host TWICE — the remote Android saw
  // a double-tap, which is what pops its text-selection "Paste" bubble.
  const lastTouchAtRef = useRef(0);
  const handleMouseEvent = (e: React.MouseEvent, type: string) => {
    if (Date.now() - lastTouchAtRef.current < 700) return;
    const target = (remoteStream ? videoRef.current : canvasRef.current) as HTMLElement;
    if (!target) return;
    const { x, y } = normalizedPoint(target, e.clientX, e.clientY);
    lastPointerRef.current = { x, y };
    onControlEvent({ type, button: (e as any).button, x, y });
  };

  const throttledMouseMove = useRef(0);
  const handleMouseMove = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - throttledMouseMove.current < 16) return; // ~60fps
    throttledMouseMove.current = now;
    handleMouseEvent(e, 'mousemove');
  };

  const getTouchPoint = (e: React.TouchEvent) => {
    const target = (remoteStream ? videoRef.current : canvasRef.current) as HTMLElement;
    const touch = e.touches.length > 0 ? e.touches[0] : e.changedTouches[0];
    if (!target || !touch) return null;
    return { target, touch, point: normalizedPoint(target, touch.clientX, touch.clientY) };
  };

  const handleTouchEvent = (e: React.TouchEvent, type: string) => {
    const target = (remoteStream ? videoRef.current : canvasRef.current) as HTMLElement;
    if (!target) return;
    const touch = e.touches.length > 0 ? e.touches[0] : e.changedTouches[0];
    if (!touch) return;
    const { x, y } = normalizedPoint(target, touch.clientX, touch.clientY);
    onControlEvent({ type, button: 0, x, y });
  };

  const handleMobileTouchStart = (e: React.TouchEvent) => {
    lastTouchAtRef.current = Date.now();
    if (!isMobileViewport) return handleTouchEvent(e, 'mousedown');
    const info = getTouchPoint(e);
    if (!info) return;
    e.preventDefault();
    // Automatic gestures — no mode picking: tap = click, hold-and-move =
    // drag, two fingers = scroll, long-press = right click.
    touchStateRef.current = {
      startX: info.touch.clientX,
      startY: info.touch.clientY,
      lastX: info.touch.clientX,
      lastY: info.touch.clientY,
      startedAt: Date.now(),
      moved: false,
      fingers: e.touches.length,
      dragging: false,
      startPoint: info.point,
    };
    if (e.touches.length >= 2) {
      const a = e.touches[0];
      const b = e.touches[1];
      touchStateRef.current.pinchDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      touchStateRef.current.pinchMid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      touchStateRef.current.gesture = null;
    }
  };

  const throttledTouchMove = useRef(0);
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isMobileViewport) {
      const info = getTouchPoint(e);
      const state = touchStateRef.current;
      if (!info || !state) return;
      e.preventDefault();
      const now = Date.now();
      if (now - throttledTouchMove.current < 16) return;
      throttledTouchMove.current = now;

      const dx = info.touch.clientX - state.lastX;
      const dy = info.touch.clientY - state.lastY;
      if (Math.abs(info.touch.clientX - state.startX) + Math.abs(info.touch.clientY - state.startY) > 8) {
        state.moved = true;
      }
      state.lastX = info.touch.clientX;
      state.lastY = info.touch.clientY;

      state.fingers = Math.max(state.fingers, e.touches.length);
      if (state.fingers >= 2) {
        // Two fingers: pinch zooms the view, a parallel drag pans while
        // zoomed and scrolls the remote screen otherwise. The gesture is
        // classified once from whichever threshold breaks first, so a scroll
        // doesn't wobble the zoom and a pinch doesn't scroll.
        const a = e.touches[0];
        const b = e.touches[1];
        if (a && b && state.pinchDist != null && state.pinchMid) {
          const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
          const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
          const z = pinchZoomRef.current;
          if (!state.gesture) {
            if (z.scale > 1.001 || Math.abs(dist - state.pinchDist) > 14) state.gesture = 'zoom';
            else if (Math.hypot(mid.x - state.pinchMid.x, mid.y - state.pinchMid.y) > 10) state.gesture = 'scroll';
          }
          if (state.gesture === 'zoom') {
            const cRect = containerRef.current?.getBoundingClientRect();
            const ratio = state.pinchDist > 0 ? dist / state.pinchDist : 1;
            const next = Math.min(5, Math.max(1, z.scale * ratio));
            const applied = next / z.scale;
            // Zoom around the finger midpoint, then pan by its movement.
            const mx = mid.x - (cRect?.left || 0);
            const my = mid.y - (cRect?.top || 0);
            z.tx = mx - (mx - z.tx) * applied + (mid.x - state.pinchMid.x);
            z.ty = my - (my - z.ty) * applied + (mid.y - state.pinchMid.y);
            z.scale = next;
            clampPinchPan();
            applyPinchTransform();
          } else if (state.gesture === 'scroll') {
            onControlEvent({ type: 'wheel', deltaX: -dx, deltaY: -dy, x: info.point.x, y: info.point.y });
          }
          state.pinchDist = dist;
          state.pinchMid = mid;
        } else {
          onControlEvent({ type: 'wheel', deltaX: -dx, deltaY: -dy, x: info.point.x, y: info.point.y });
        }
      } else if (state.moved) {
        // One finger past the threshold: press at the start point once, then drag.
        if (!state.dragging) {
          state.dragging = true;
          onControlEvent({ type: 'mousemove', button: 0, x: state.startPoint.x, y: state.startPoint.y });
          onControlEvent({ type: 'mousedown', button: 0, x: state.startPoint.x, y: state.startPoint.y });
        }
        onControlEvent({ type: 'mousemove', button: 0, x: info.point.x, y: info.point.y });
      }
      return;
    }

    const now = Date.now();
    if (now - throttledTouchMove.current < 16) return;
    throttledTouchMove.current = now;
    handleTouchEvent(e, 'mousemove');
  };

  const handleMobileTouchEnd = (e: React.TouchEvent) => {
    lastTouchAtRef.current = Date.now();
    if (!isMobileViewport) return handleTouchEvent(e, 'mouseup');
    const info = getTouchPoint(e);
    const state = touchStateRef.current;
    if (!info || !state) return;
    e.preventDefault();
    if (state.dragging) {
      onControlEvent({ type: 'mouseup', button: 0, x: info.point.x, y: info.point.y });
    } else if (state.fingers === 1 && !state.moved) {
      // Quick tap = left click; a still long-press = right click.
      const button = Date.now() - state.startedAt > 500 ? 2 : 0;
      onControlEvent({ type: 'mousemove', button: 0, x: info.point.x, y: info.point.y });
      // 12ms press: network jitter between down/up already stretches the
      // injected touch on Android hosts — at 45ms a jittery link crossed the
      // long-press threshold and popped the remote phone's "Paste" bubble.
      onControlEvent({ type: 'mousedown', button, x: info.point.x, y: info.point.y });
      window.setTimeout(() => onControlEvent({ type: 'mouseup', button, x: info.point.x, y: info.point.y }), 12);
      // Tapping an editable field auto-opens the phone keyboard. iOS only
      // honors keyboard-opening focus INSIDE the touch gesture, so when the
      // cursor shape is already known to be 'text' (tapping a field the
      // cursor is on, or a second tap), focus right here. Otherwise arm a
      // probe window: the injected click parks the remote cursor on whatever
      // was tapped and the host's next shape report decides.
      // (Not blind focusing on every tap — that used to pop paste bubbles.)
      if (button === 0) {
        if (lastCursorTypeRef.current === 'text') focusMobileKeyboard();
        else keyboardProbeUntilRef.current = Date.now() + 1500;
      }
    }
    // A pinch released barely past 1x snaps back to the untransformed view.
    const z = pinchZoomRef.current;
    if (z.scale > 1 && z.scale < 1.05) {
      pinchZoomRef.current = { scale: 1, tx: 0, ty: 0 };
      applyPinchTransform();
    }
    touchStateRef.current = null;
  };

  const renderVideoContent = () => (
    <div className="w-full h-full flex items-center justify-center relative bg-[#0A0A0A]">
      {remoteStream ? (
        <>
        <video
          ref={videoRef}
          autoPlay
          muted={!remoteAudioEnabled}
          playsInline
          onLoadedMetadata={(e) => {
            e.currentTarget.play().catch(console.error);
            if (e.currentTarget.videoWidth > 0) setTrackPainted(true);
            forceRender({});
          }}
          onResize={(e) => { if ((e.currentTarget as HTMLVideoElement).videoWidth > 0) setTrackPainted(true); }}
          className={`transition-all duration-300 ${zoomMode === 'fit' ? 'w-full h-full object-contain' : zoomMode === 'fill' ? 'w-full h-full object-fill' : 'w-auto h-auto object-none cursor-move'}`}
          style={{ minHeight: '100px', minWidth: '100px', backgroundColor: '#0A0A0A', touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
          onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
          onTouchStart={handleMobileTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMobileTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        />
        {!trackPainted && (
          <button
            type="button"
            onClick={() => videoRef.current?.play().catch(() => {})}
            className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-[#0A0A0A] text-white/70"
          >
            <RefreshCw size={22} className="animate-spin text-[#FF8A00]" />
            <span className="text-[13px] font-medium">Connecting to {deviceName}…</span>
            <span className="text-[11px] text-white/40">Tap here if the screen stays black</span>
          </button>
        )}
        </>
      ) : (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0A0A0A] cursor-crosshair">
          {!hasReceivedKeyframeRef.current && (
            /* Connecting loader — same design as the desktop remote-session window */
            <div className="absolute inset-0 z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden bg-white text-[#111315] cursor-default">
              <style>{`@keyframes remoteLoader { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
              <div className="pointer-events-none absolute left-1/2 top-[-390px] h-[517px] w-[min(1748px,calc(100vw+320px))] -translate-x-1/2 rounded-full bg-[linear-gradient(360deg,rgba(255,255,255,0.375)_-16.83%,rgba(255,179,71,0.58)_29.84%,rgba(255,138,0,0.72)_76.5%)] blur-[39.5px]" />
              <div className="relative z-10 flex w-[440px] max-w-[calc(100%-40px)] flex-col items-center text-center">
                <div className="relative">
                  <div className="absolute inset-6 rounded-full bg-[#FFB347]/20 blur-2xl" />
                  <img src={waitIllustration} alt="" className="relative h-[190px] w-[230px] object-contain sm:h-[214px] sm:w-[251px]" />
                </div>

                <div className="mt-12 flex w-full flex-col items-center gap-3">
                  {streamDecodeError ? (
                    <>
                      <div className="inline-flex h-8 items-center gap-2 rounded-full bg-red-50 px-3 text-[12px] font-medium text-red-600">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Video decoding problem
                      </div>
                      <h1 className="m-0 text-[24px] font-medium leading-[34px] text-black sm:text-[28px] sm:leading-[39px]">
                        Can't show {deviceName}
                      </h1>
                      <p className="m-0 max-w-[377px] text-[13px] leading-[18px] text-[#1A1D21]/70">
                        {streamDecodeError} You can also connect from the Remote365 desktop app, which has its own decoder.
                      </p>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-3 h-10 min-w-[153px] rounded px-4 text-[14px] font-medium text-[#111315] shadow-sm transition hover:brightness-105"
                        style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                      >
                        Try again
                      </button>
                    </>
                  ) : (
                    <>
                  <div className="inline-flex h-8 items-center gap-2 rounded-full bg-[#F3F4F6] px-3 text-[12px] font-medium text-[#1A1D21]/70">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#34C759]" />
                    Connecting safely
                  </div>
                  <h1 className="m-0 text-[24px] font-medium leading-[34px] text-black sm:text-[28px] sm:leading-[39px]">
                    Connecting to {deviceName}
                  </h1>
                  <p className="m-0 max-w-[377px] text-[13px] leading-[18px] text-[#1A1D21]/70">
                    Remote365 is opening the screen and getting controls ready. This may take a moment.
                  </p>
                  <div className="mt-3 flex w-full max-w-[300px] flex-col items-center gap-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                      <div className="h-full w-1/2 animate-[remoteLoader_1.6s_ease-in-out_infinite] rounded-full bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)]" />
                    </div>
                    <p className="m-0 text-[12px] font-medium text-[#1A1D21]/50">{connectingText}</p>
                  </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={endSession}
                  className="mt-12 h-10 min-w-[153px] rounded px-4 text-[14px] font-medium text-[#111315] shadow-sm transition hover:brightness-105"
                  style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                >
                  Cancel session
                </button>
              </div>
              <div className="absolute bottom-2 left-1/2 flex w-[226px] -translate-x-1/2 flex-col items-center text-center text-black/50">
                <div className="text-[10px] leading-[14px]">Privacy Policy</div>
                <div className="text-[8px] leading-[11px]">Copyright {new Date().getFullYear()} © Remote365. All rights reserved.</div>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className={`transition-all duration-300 ${zoomMode === 'fit' ? 'w-full h-full object-contain' : zoomMode === 'fill' ? 'w-full h-full object-fill' : 'w-auto h-auto object-none'} ${!hasReceivedKeyframeRef.current ? 'opacity-0' : 'opacity-100'}`}
            style={{ touchAction: 'none' }}
            onMouseMove={handleMouseMove}
            onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
            onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
            onTouchStart={handleMobileTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMobileTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      )}
    </div>
  );

  // --- Remote audio: auto-play (desktop parity) ---
  // Declared before the early returns below so the hook order never changes
  // between the password/error screens and the full session render.
  const remoteAudioTrackCount = remoteStream?.getAudioTracks?.().length || 0;

  // Auto-play: enable sound the moment the host stream carries an audio track,
  // unless this viewer explicitly muted. Sessions open in their own tab, which
  // starts with NO user activation — when the browser refuses unmuted playback,
  // arm a one-shot gesture listener and retry on the first click or keypress
  // (in a remote-control session that's nearly immediate).
  useEffect(() => {
    if (!remoteAudioTrackCount || remoteAudioEnabled || userMutedAudioRef.current) return;
    if (!videoRef.current) return;
    const enable = () => {
      const el = videoRef.current;
      if (userMutedAudioRef.current || !el) return;
      el.muted = false;
      const attempt = el.play();
      (attempt || Promise.resolve()).then(() => {
        setRemoteAudioEnabled(true);
        onControlEvent({ type: 'audio-listen', on: true });
      }).catch(() => {
        el.muted = true;
        if (armAudioGestureRef.current) return;
        armAudioGestureRef.current = true;
        const onGesture = () => {
          window.removeEventListener('pointerdown', onGesture, true);
          window.removeEventListener('keydown', onGesture, true);
          armAudioGestureRef.current = false;
          audioEnableRetryRef.current();
        };
        window.addEventListener('pointerdown', onGesture, true);
        window.addEventListener('keydown', onGesture, true);
      });
    };
    audioEnableRetryRef.current = enable;
    enable();
  }, [remoteAudioTrackCount, remoteAudioEnabled, audioTrackRevision]);

  // Join/auth failed outright (expired grant, offline device, bad link…)
  if (fatalError) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
        <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mb-6 border border-red-100">
          <MonitorOff className="text-red-500 w-9 h-9" />
        </div>
        <h2 className="text-2xl font-semibold text-[#111315] mb-2">Could not connect</h2>
        <p className="text-sm text-[rgba(26,29,33,0.55)] mb-10 max-w-sm text-center">{fatalError}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { closeSocket(); navigate('/dashboard/devices'); }}
            className="px-8 py-3 border border-[rgba(26,29,33,0.15)] rounded-lg font-medium text-sm text-[rgba(26,29,33,0.7)] hover:bg-[#F3F4F6] transition-all"
          >
            Back to devices
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 text-white rounded-lg font-medium text-sm transition-all"
            style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // The device requires its password before a session can start
  if (needPassword && !accessToken) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
        <div className="pointer-events-none absolute left-1/2 top-[-390px] h-[517px] w-[min(1748px,calc(100vw+320px))] -translate-x-1/2 rounded-full bg-[linear-gradient(360deg,rgba(255,255,255,0.375)_-16.83%,rgba(255,179,71,0.58)_29.84%,rgba(255,138,0,0.72)_76.5%)] blur-[39.5px]" />
        <div className="relative bg-white rounded-[20px] w-full max-w-sm p-8 shadow-2xl border border-[rgba(26,29,33,0.08)]">
          <h2 className="text-xl font-semibold text-[#111315] mb-2">{isPasswordUpdate ? 'Update device password' : 'Enter device password'}</h2>
          <p className="text-sm text-[rgba(26,29,33,0.5)] mb-6">
            {isPasswordUpdate
              ? 'The host password changed. Enter the new password to reconnect.'
              : `${deviceName ? `${deviceName} requires` : 'This device requires'} its password to start the session.`}
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (passwordValue) requestViewerAuth(passwordValue); }}>
            <input
              autoFocus
              type="password"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="Device password"
              className="w-full bg-[#F3F4F6] border border-[rgba(26,29,33,0.08)] rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:border-[#FF8A00] outline-none transition-all"
            />
            {authError && <p className="mt-3 text-sm text-[#D64545] m-0">{authError}</p>}
            <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px] text-[#111315]/70">
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={(event) => setRememberPassword(event.target.checked)}
                className="h-4 w-4 accent-[#FF8A00]"
              />
              Remember this device
            </label>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => navigate('/dashboard/devices')}
                className="flex-1 py-3 border border-[rgba(26,29,33,0.15)] rounded-lg text-sm font-medium text-[rgba(26,29,33,0.6)] hover:bg-[#F3F4F6] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={authBusy || !passwordValue}
                className="flex-1 py-3 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
              >
                {authBusy ? 'Connecting…' : isPasswordUpdate ? 'Update & connect' : 'Connect'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (viewerStatus === 'connection_lost') {
    return (
      <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-inter">
        <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-700">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mb-6 border border-red-100">
            <MonitorOff className="text-red-500 w-9 h-9" />
          </div>
          <h2 className="text-2xl font-semibold text-[#111315] mb-2">Connection lost</h2>
          <p className="text-sm text-[rgba(26,29,33,0.55)] mb-10">The session to {deviceName} ended or was interrupted.</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeSocket();
                navigate('/dashboard/devices');
              }}
              className="px-8 py-3 border border-[rgba(26,29,33,0.15)] rounded-lg font-medium text-sm text-[rgba(26,29,33,0.7)] hover:bg-[#F3F4F6] transition-all"
            >
              Back to devices
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 text-white rounded-lg font-medium text-sm transition-all"
              style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
            >
              Reconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Menu definitions for the bottom toolbar (desktop RemoteSessionChrome
  // style). Every Actions item maps to a command the host's control-channel
  // switch actually executes — see apps/desktop/src/main/index.ts.
  const hostAction = (action: string) => () => onControlEvent({ type: 'action', action });

  // Send files / Get files. Phones can't receive files yet, so the buttons
  // are hidden for them. Both act on the remote computer, so both need
  // control; without it they ask for control instead of sending into nothing
  // (the host silently drops file chunks from a view-only viewer).
  const hostIsPhone = /^(mobile|android|ios)$/i.test(String(deviceType || ''));
  const needControlForFiles = () => {
    if (!hostAnnouncedControl || controlStatus === 'granted') return false;
    if (controlStatus === 'pending') {
      setSessionNotice('Waiting for the other side to allow control. Files can be sent once they do.');
    } else {
      setSessionNotice('Sending and getting files needs control of the session. Control requested.');
      onControlEvent({ type: 'request-control' });
    }
    return true;
  };
  const sendFilesClick = () => {
    if (needControlForFiles()) return;
    fileInputRef.current?.click();
  };
  const getFilesClick = () => {
    if (needControlForFiles()) return;
    fileXferRef.current?.requestHostPick(deviceName);
  };
  // The hover hints carry the plan's per-file limit once the host has said it.
  const fileLimitNote = fileLimitBytes ? ` (up to ${describeFileLimit(fileLimitBytes)} per file)` : '';
  const sendFilesHint = `Send files${fileLimitNote}`;
  const getFilesHint = `Get files${fileLimitNote}`;
  const confirmHostAction = (action: string, title: string, message: string, confirmLabel: string) => () =>
    setPendingAction({ action, title, message, confirmLabel });
  const pickQuality = (mode: 'auto' | 'speed' | 'quality') => () => {
    setQualityMode(mode);
    // reason:'user' pins the host encoder; the bandwidth auto-tuner stands
    // down until the viewer picks "Auto select" again. The host stays on the
    // pinned tier when Auto comes back, so the tuner resumes from that tier.
    if (mode === 'speed') lastAdaptiveModeRef.current = 'smooth';
    else if (mode === 'quality') lastAdaptiveModeRef.current = 'ultra';
    onControlEvent({ type: 'stream-quality', mode, reason: 'user' });
  };
  const endSession = () => {
    closeSocket();
    // Session tabs are opened by a plain window.open (lib/sessionLauncher.ts),
    // so the tab may close itself; a directly-navigated tab can't, and falls
    // back to the device list.
    window.close();
    navigate('/dashboard/devices');
  };
  // Quick-pill hover hint (desktop parity): tooltip centered over the icon.
  const showQuickHint = (label: string) => (event: React.MouseEvent<HTMLElement>) => {
    const pillRect = quickPillRef.current?.getBoundingClientRect();
    const rect = event.currentTarget.getBoundingClientRect();
    setQuickHint({ label, left: pillRect ? rect.left - pillRect.left + rect.width / 2 : 24 });
  };
  const hideQuickHint = (label: string) => () =>
    setQuickHint((current) => (current?.label === label ? null : current));
  // Keyboard shortcuts popover — system key combos sent straight to the host,
  // same set as the desktop viewer's keyboard pill.
  const hostIsMobileDevice = /mobile|android|ios/.test(String(deviceType || '').toLowerCase());
  const keyboardItems: { label: string; hint?: string; icon: React.ReactNode; onClick: () => void }[] = hostIsMobileDevice
    ? [
        { label: 'Back', icon: <ArrowLeftRight size={16} />, onClick: () => onControlEvent({ type: 'globalAction', action: 1 }) },
        { label: 'Home', icon: <Home size={16} />, onClick: hostAction('home') },
        { label: 'Recent apps', icon: <LayoutGrid size={16} />, onClick: hostAction('recents') },
        { label: 'Notifications', icon: <Bell size={16} />, onClick: () => onControlEvent({ type: 'shortcut', key: 'notifications' }) },
      ]
    : [
        { label: 'Task Manager', hint: 'Ctrl+Shift+Esc', icon: <Keyboard size={16} />, onClick: hostAction('task_manager') },
        { label: 'Switch window', hint: 'Alt+Tab', icon: <ArrowLeftRight size={16} />, onClick: () => onControlEvent({ type: 'keyCombo', keys: [0x12, 0x09] }) },
        { label: 'Show desktop', hint: 'Win+D', icon: <AppWindow size={16} />, onClick: () => onControlEvent({ type: 'shortcut', key: 'show-desktop' }) },
        { label: 'File Explorer', hint: 'Win+E', icon: <Folder size={16} />, onClick: () => onControlEvent({ type: 'shortcut', key: 'file-explorer' }) },
        { label: 'Quick Settings', hint: 'Win+A', icon: <Sliders size={16} />, onClick: () => onControlEvent({ type: 'shortcut', key: 'control-center' }) },
        { label: 'Lock', hint: 'Win+L', icon: <Lock size={16} />, onClick: hostAction('lock') },
      ];
  // --- Remote audio: viewer-local mute (desktop parity; auto-play is above the early returns) ---
  const toggleRemoteAudio = () => {
    const next = !remoteAudioEnabled;
    // Muting is local-only (the host keeps streaming for other viewers), and
    // it must stick: auto-play checks this ref before re-enabling.
    userMutedAudioRef.current = !next;
    setRemoteAudioEnabled(next);
    if (videoRef.current) {
      videoRef.current.muted = !next;
      // Unmuting needs the click we are already inside, or autoplay policy
      // silently refuses it.
      if (next) videoRef.current.play().catch(() => { /* user can retry */ });
    }
    // Surfaces on the host's dock, where they can mute the share.
    onControlEvent({ type: 'audio-listen', on: next });
  };

  const toolbarMenus: { id: string; label: string; items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; active?: boolean }[] }[] = [
    {
      id: 'actions',
      label: 'Actions',
      items: [
        {
          label: remoteAudioEnabled ? 'Mute remote audio' : 'Listen to remote audio',
          icon: <Zap size={15} />,
          active: remoteAudioEnabled,
          onClick: toggleRemoteAudio,
        },
        ...(!isMobileViewport && hostAnnouncedControl && controlStatus !== 'granted'
          ? [{
              label: controlStatus === 'pending' ? 'Requesting control…' : 'Request control',
              icon: <MousePointer2 size={15} />,
              onClick: () => onControlEvent({ type: 'request-control' }),
            }]
          : []),
        { label: 'Refresh stream', icon: <RefreshCw size={15} />, onClick: () => onControlEvent({ type: 'request-keyframe' }) },
        { label: 'Ctrl + Alt + Del (Task Manager)', icon: <Keyboard size={15} />, onClick: hostAction('task_manager') },
        { label: 'Minimize Remote365 on host', icon: <AppWindow size={15} />, onClick: hostAction('minimize_host_window') },
        { label: 'Open browser', icon: <Globe size={15} />, onClick: hostAction('browser') },
        { label: 'File explorer', icon: <Folder size={15} />, onClick: hostAction('explorer') },
        { label: 'Lock screen', icon: <Lock size={15} />, onClick: hostAction('lock') },
        { label: 'Sign out remote user', icon: <LogOut size={15} />, onClick: confirmHostAction('sign_out', 'Sign out remote computer', 'The current Windows user on the remote computer will be signed out and their desktop session will end.', 'Sign out'), danger: true },
        { label: 'Safe reboot (15s grace)', icon: <RotateCcw size={15} />, onClick: confirmHostAction('safe_reboot', 'Safe reboot', 'The remote computer will restart after a 15-second grace period so open apps can react first.', 'Reboot') },
        { label: 'Restart device', icon: <Power size={15} />, onClick: confirmHostAction('reboot', 'Remote reboot', 'The remote computer is going to reboot immediately. Click Cancel to prevent it.', 'Restart'), danger: true },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { label: 'Best fit', icon: <Monitor size={15} />, onClick: () => setZoomMode('fit'), active: zoomMode === 'fit' },
        { label: 'Scaled (fill window)', icon: <Scaling size={15} />, onClick: () => setZoomMode('fill'), active: zoomMode === 'fill' },
        { label: 'Actual size', icon: <Search size={15} />, onClick: () => setZoomMode('original'), active: zoomMode === 'original' },
        { label: 'Quality: Auto select', icon: <Check size={15} />, onClick: pickQuality('auto'), active: qualityMode === 'auto' },
        { label: 'Quality: Optimal speed', icon: <Zap size={15} />, onClick: pickQuality('speed'), active: qualityMode === 'speed' },
        { label: 'Quality: Optimal quality', icon: <Monitor size={15} />, onClick: pickQuality('quality'), active: qualityMode === 'quality' },
        { label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen', icon: <Smartphone size={15} className="rotate-90" />, onClick: () => {
          if (!document.fullscreenElement) requestLandscape();
          else document.exitFullscreen();
        } },
      ],
    },
  ];

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex flex-col bg-[#1A1D21] select-none" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      {/* Live screen — inset panel like the desktop remote-session window */}
      <div
        ref={containerRef}
        className={`relative mx-1 mt-1 min-h-0 flex-1 overflow-hidden bg-[#0A0A0A] sm:mx-5 sm:mt-3 ${zoomMode === 'original' ? 'cursor-grab active:cursor-grabbing overflow-auto custom-scrollbar' : ''}`}
        // Phone viewing a phone: leave a strip above the remote screen, so a
        // swipe aimed at the REMOTE device's notification shade can start
        // below the local phone's own edge-gesture zone (inline style so it
        // outranks the sm:mt-3 media rule on landscape phones).
        style={isMobileViewport && hostIsMobileDevice ? { marginTop: 28 } : undefined}
      >
        {renderVideoContent()}

        {/* Inside the fullscreen container, so it shows there too. */}
        {hostSilent && viewerStatus === 'streaming' && (
          <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-[90] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg bg-black/85 px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl">
            <Loader2 size={15} className="flex-none animate-spin text-[#FF8A00]" />
            {deviceName} has stopped responding. Waiting for it to come back…
          </div>
        )}

        {isMobileViewport && (
          <button
            type="button"
            onClick={requestLandscape}
            className="absolute left-3 top-3 z-[85] inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-[12px] font-medium text-white backdrop-blur-md active:scale-95"
          >
            <RotateCw size={14} />
            Rotate
          </button>
        )}

        {/* Phone remote-cursor overlay: the host's reported pointer position,
            drawn as the Windows arrow (same path as the desktop viewer's
            WindowsCursor). Positioned by direct DOM writes from the cursor
            stream; hidden until the first report arrives. The slight negative
            margin puts the arrow TIP on the reported point. */}
        {isMobileViewport && (
          <div
            ref={remoteCursorElRef}
            className="pointer-events-none absolute z-[60] opacity-0 transition-opacity duration-150"
            style={{ left: 0, top: 0, marginLeft: -3, marginTop: -2 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 2 L4 18.4 L8.5 14.1 L11.4 20.7 L13.9 19.6 L11.1 13.2 L16.9 13.2 Z"
                fill="#FFFFFF"
                stroke="#000000"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Top-right session controls, riding inside the fullscreen container
            (the toolbar lives outside it): a Disconnect pill that stays in
            reach while the bottom toolbar is collapsed, and the fullscreen
            exit — Esc must not be the only way back. Shifts down while the
            transfer toast occupies the corner. */}
        {(isFullscreen || remoteStream || hasReceivedKeyframeRef.current) && (
          <div className={`absolute right-4 z-[100] flex items-center gap-2 top-4`}>
            {isFullscreen && (
              <button
                type="button"
                onClick={() => document.exitFullscreen?.().catch(() => undefined)}
                className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl backdrop-blur-md transition hover:bg-black/85 active:scale-95"
              >
                <Minimize2 size={15} />
                Exit full screen
              </button>
            )}
            <button
              type="button"
              title="End session"
              onClick={() => {
                // The confirm dialog renders outside the fullscreen element,
                // so it would be invisible until fullscreen exits.
                if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
                setShowDisconnectConfirm(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#FF383C] px-4 text-[13px] font-semibold text-white shadow-2xl transition-colors hover:bg-[#E62E32] active:scale-95"
            >
              <MonitorOff size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        )}

        {/* Send files / Get files progress (desktop parity): newest first, at
            most four. The X cancels a transfer that is still running and
            closes a finished one. */}
        {fileTransfers.length > 0 && (
          <div className="pointer-events-none absolute bottom-24 right-4 z-[105] flex w-[300px] max-w-[calc(100%-2rem)] flex-col gap-2">
            {fileTransfers.slice(0, 4).map((t) => {
              const running = t.state === 'active' || t.state === 'waiting';
              const pct = t.totalBytes > 0 ? Math.min(100, Math.round((t.transferredBytes / t.totalBytes) * 100)) : 0;
              const Icon = t.state === 'done' ? Check : t.state === 'error' ? AlertCircle : t.hostPick ? Loader2 : t.direction === 'send' ? Upload : Download;
              const iconColor = t.state === 'done' ? 'text-[#1E8E3E]' : t.state === 'error' ? 'text-[#FF383C]' : t.state === 'cancelled' ? 'text-[#111315]/40' : 'text-[#FF8A00]';
              const line = t.state === 'done'
                ? (t.direction === 'send' ? `Saved on ${deviceName} in Downloads\\Remote365` : 'Saved to your browser downloads')
                : t.state === 'error' ? t.message
                  : t.state === 'cancelled' ? 'Cancelled'
                    : t.message || `${pct}%`;
              return (
                <div key={t.id} className="pointer-events-auto rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[#111315] shadow-lg" role="status">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={`flex-none ${iconColor} ${t.hostPick && running ? 'animate-spin' : ''}`} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.name}</span>
                    <button
                      type="button"
                      aria-label={running ? 'Cancel' : 'Close'}
                      title={running ? 'Cancel' : 'Close'}
                      onClick={() => (running ? fileXferRef.current?.cancel(t.id) : fileXferRef.current?.dismiss(t.id))}
                      className="flex h-6 w-6 flex-none items-center justify-center rounded text-[#111315]/60 hover:bg-black/5 hover:text-[#111315]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className={`m-0 mt-1 line-clamp-2 text-[11px] leading-4 ${t.state === 'error' ? 'text-[#FF383C]' : 'text-[#111315]/60'}`}>{line}</p>
                  {running && !t.hostPick && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/10">
                      <div className="h-full rounded-full bg-[#FF8A00] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Click-away layer for open menus */}
      {openToolbarMenu && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-[70] cursor-default"
          onClick={() => setOpenToolbarMenu(null)}
        />
      )}

      {/* Mobile quick controls: gestures are automatic (tap=click, drag=hold
          and move, two fingers=scroll, long-press=right click). */}
      {/* Phone session bar — Figma "Remote support" spec: white 64px bar,
          rounded top corners, icon actions, red disconnect pill, collapse. */}
      {/* Phones keep this SAME white icon bar in portrait AND landscape (the
          dark desktop bar is suppressed on mobile viewports below). */}
      {isMobileViewport && !toolbarCollapsed && (
        <div className="relative z-[82] flex h-16 flex-none items-center justify-between rounded-t bg-white px-[22px] py-2.5">
          <button type="button" aria-label="Actions" onClick={() => setOpenToolbarMenu((c) => (c === 'm-actions' ? null : 'm-actions'))} className="flex h-10 w-10 items-center justify-center text-[#FF8A00] active:scale-95">
            <Command size={20} strokeWidth={2} />
          </button>
          <button type="button" aria-label="Touch gestures" onClick={() => setOpenToolbarMenu((c) => (c === 'm-gestures' ? null : 'm-gestures'))} className="flex h-10 w-10 items-center justify-center text-[#111315] active:scale-95">
            <Hand size={22} strokeWidth={1.7} />
          </button>
          <button type="button" aria-label="Open keyboard" onClick={focusMobileKeyboard} className="flex h-10 w-10 items-center justify-center text-[#111315] active:scale-95">
            <Keyboard size={22} strokeWidth={1.7} />
          </button>
          <button type="button" aria-label="Shortcuts" onClick={() => setOpenToolbarMenu((c) => (c === 'm-shortcuts' ? null : 'm-shortcuts'))} className="flex h-10 w-10 items-center justify-center text-[#111315] active:scale-95">
            <ZapIcon size={22} strokeWidth={1.7} />
          </button>
          <button type="button" aria-label="View settings" onClick={() => setOpenToolbarMenu((c) => (c === 'm-view' ? null : 'm-view'))} className="flex h-10 w-10 items-center justify-center text-[#111315] active:scale-95">
            <SettingsIcon size={21} strokeWidth={1.7} />
          </button>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="End session" onClick={() => setShowDisconnectConfirm(true)} className="flex h-11 w-16 items-center justify-center rounded-[34px] bg-[#FF383C]/10 text-[#FF383C] active:scale-95">
              <ScreenShareOff size={22} strokeWidth={1.8} />
            </button>
            <button type="button" aria-label="Hide toolbar" onClick={() => { setOpenToolbarMenu(null); setToolbarCollapsed(true); }} className="flex h-10 w-6 items-center justify-center text-[#111315] active:scale-95">
              <ChevronDown size={22} />
            </button>
          </div>
        </div>
      )}

      {/* Phone bottom sheets for the bar's menus */}
      {isMobileViewport && openToolbarMenu?.startsWith('m-') && (
        <div className="fixed inset-0 z-[150]">
          <button type="button" aria-label="Close menu" onClick={() => setOpenToolbarMenu(null)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white pb-2 shadow-2xl" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            {openToolbarMenu === 'm-gestures' ? (
              <div className="px-5 py-3">
                <p className="m-0 mb-2 text-[14px] font-semibold text-[#111315]">Touch gestures</p>
                {['Tap — left click', 'Hold and move — drag', 'Two fingers — scroll', 'Long-press — right click'].map((line) => (
                  <p key={line} className="m-0 py-1.5 text-[13px] text-[#111315]/70">{line}</p>
                ))}
                <button type="button" onClick={requestLandscape} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#F3F4F6] text-[13px] font-semibold text-[#111315]">
                  <RotateCw size={15} /> Rotate to landscape
                </button>
              </div>
            ) : (
              (openToolbarMenu === 'm-shortcuts'
                ? keyboardItems
                : (toolbarMenus.find((menu) => menu.id === (openToolbarMenu === 'm-actions' ? 'actions' : 'view'))?.items || [])
              ).map((item: any) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { item.onClick(); setOpenToolbarMenu(null); }}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB] ${item.danger ? 'text-[#FF383C]' : 'text-[#111315]'}`}
                >
                  <span className={item.danger ? 'text-[#FF383C]' : 'text-[#111315]/55'}>{item.icon}</span>
                  <span className="flex-1 text-[14px] font-medium">{item.label}</span>
                  {item.active && <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A00]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div
        className={`session-bottom-bar hidden flex-wrap items-center justify-between gap-3 px-2 py-2 transition-transform duration-300 ease-out sm:px-6 sm:py-3 ${
          // Desktop-browser bar only. Phones (coarse pointer) use the white
          // icon bar in every orientation — sm:flex would resurface this one
          // on landscape phones (≥640px wide) and stack two footers.
          isMobileViewport ? '' : 'sm:flex'
        } ${
          toolbarCollapsed
            ? 'pointer-events-none absolute inset-x-0 bottom-0 z-[80] translate-y-[calc(100%+18px)]'
            : 'relative z-[80] translate-y-0'
        }`}
        // The mobile-landscape stylesheet makes this bar horizontally
        // scrollable, which would clip the chat panel and keyboard popover —
        // lift the clipping while one of them is open.
        style={chatOpen || openToolbarMenu === 'keyboard' ? { overflow: 'visible' } : undefined}
      >
        {/* Left: device label + action menus */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="mr-2 hidden items-center gap-2.5 sm:flex min-w-0">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#34C759]" />
            <div className="min-w-0">
              <p className="m-0 truncate text-[13px] font-medium leading-4 text-white">{deviceName}</p>
              <p className="m-0 text-[11px] leading-4 text-white/45">{accessKey || deviceId} · {activeSession?.latency || 0}ms</p>
            </div>
          </div>
          {toolbarMenus.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                type="button"
                onClick={() => setOpenToolbarMenu((current) => (current === menu.id ? null : menu.id))}
                className={`flex h-10 items-center gap-2 rounded px-4 text-[14px] font-medium leading-5 transition-colors ${
                  openToolbarMenu === menu.id ? 'bg-white/10 text-white' : 'text-white/90 hover:bg-white/5 hover:text-white'
                }`}
              >
                {menu.label}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`transition-transform ${openToolbarMenu === menu.id ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openToolbarMenu === menu.id && (
                <div className="absolute bottom-full left-0 z-[90] mb-2 flex w-[200px] flex-col items-stretch rounded bg-white py-1.5 shadow-2xl">
                  {menu.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { item.onClick(); setOpenToolbarMenu(null); }}
                      className={`flex h-9 items-center gap-2.5 px-3.5 text-left text-[13px] font-medium transition-colors hover:bg-[#F3F4F6] ${
                        item.danger ? 'text-[#FF383C]' : 'text-[#111315]'
                      }`}
                    >
                      <span className={item.danger ? 'text-[#FF383C]' : 'text-[#111315]/60'}>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.active && <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A00]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: white quick-action pill (desktop RemoteSessionChrome parity) */}
        <div ref={quickPillRef} className="relative flex h-14 flex-none items-center gap-2.5 rounded-[53px] bg-white px-4 py-2">
          {quickHint && (
            <div
              className="pointer-events-none absolute bottom-[calc(100%+10px)] z-[160] -translate-x-1/2 whitespace-nowrap rounded-md bg-[#FFB347] px-4 py-2 text-[14px] font-medium leading-5 text-[#111315] shadow-xl"
              style={{ left: quickHint.left }}
            >
              {quickHint.label}
            </div>
          )}
          {!hostIsPhone && (
            <>
              <button
                type="button"
                aria-label="Send files"
                onClick={sendFilesClick}
                onMouseEnter={showQuickHint(sendFilesHint)}
                onMouseLeave={hideQuickHint(sendFilesHint)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#FF8A00] transition-colors hover:bg-[#FFF1E0] active:scale-95"
              >
                <UploadCloud size={20} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                aria-label="Get files"
                onClick={getFilesClick}
                onMouseEnter={showQuickHint(getFilesHint)}
                onMouseLeave={hideQuickHint(getFilesHint)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#FF8A00] transition-colors hover:bg-[#FFF1E0] active:scale-95"
              >
                <DownloadCloud size={20} strokeWidth={1.75} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onControlEvent({ type: 'request-keyframe' })}
            onMouseEnter={showQuickHint('Refresh stream')}
            onMouseLeave={hideQuickHint('Refresh stream')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#111315]/70 transition-colors hover:bg-[#F3F4F6] active:scale-95"
          >
            <RefreshCw size={18} strokeWidth={1.8} />
          </button>

          {/* Keyboard shortcuts popover. The wrapper is unpositioned on purpose:
              the popover anchors to the pill's right edge so it stays on screen
              on narrow viewports. Hidden on phones — the mobile row has its own
              keyboard button for typing. */}
          <div className="hidden sm:block">
            <button
              type="button"
              onClick={() => setOpenToolbarMenu((current) => (current === 'keyboard' ? null : 'keyboard'))}
              onMouseEnter={showQuickHint('Send keyboard shortcut')}
              onMouseLeave={hideQuickHint('Send keyboard shortcut')}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-[#111315]/70 transition-colors hover:bg-[#F3F4F6] active:scale-95 ${
                openToolbarMenu === 'keyboard' ? 'bg-[#FFE7E7]' : ''
              }`}
            >
              <Keyboard size={19} strokeWidth={1.6} />
            </button>
            {openToolbarMenu === 'keyboard' && (
              <div data-session-ui className="absolute bottom-[calc(100%+14px)] right-0 z-[90] w-[230px] overflow-hidden rounded-xl border border-black/5 bg-white py-1.5 shadow-2xl">
                {keyboardItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => { item.onClick(); setOpenToolbarMenu(null); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-[#111315] transition-colors hover:bg-[#F3F4F6]"
                  >
                    <span className="flex-shrink-0 text-[#111315]/60">{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="flex-shrink-0 font-mono text-[10px] text-[#111315]/40">{item.hint}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat with the person at the host machine. Unpositioned wrapper —
              the panel anchors to the pill's right edge (see keyboard note). */}
          <div>
            <button
              type="button"
              onClick={() => setChatOpen((open) => { const next = !open; if (next) setChatUnread(0); return next; })}
              onMouseEnter={showQuickHint('Chat with remote user')}
              onMouseLeave={hideQuickHint('Chat with remote user')}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full text-[#111315]/70 transition-colors hover:bg-[#F3F4F6] active:scale-95 ${
                chatOpen ? 'bg-[#FFE7E7]' : ''
              }`}
            >
              <MessageSquare size={19} strokeWidth={1.6} />
              {chatUnread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF383C] px-1 text-[9px] font-bold leading-none text-white">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
            {chatOpen && (
              <div data-session-ui className="absolute bottom-[calc(100%+14px)] right-0 z-[90] flex h-[460px] max-h-[65vh] w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl">
                <div className="flex h-10 flex-none items-center justify-between border-b border-black/5 px-3">
                  <span className="truncate text-[13px] font-semibold text-[#111315]">Chat — {deviceName}</span>
                  <button type="button" onClick={() => setChatOpen(false)} className="flex h-6 w-6 flex-none items-center justify-center text-[#111315] transition hover:opacity-70">
                    <X size={16} />
                  </button>
                </div>
                <div ref={chatListRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto bg-[#F9FAFB] p-3">
                  {chatMessages.length === 0 && (
                    <p className="m-0 text-center text-[11px] leading-4 text-[#111315]/40">
                      Messages appear on {deviceName} next to the Remote365 dock.
                    </p>
                  )}
                  {chatMessages.map((message, index) => (
                    <div
                      key={`${message.at}-${index}`}
                      className={`max-w-[82%] rounded-lg px-3 py-2 text-[13px] leading-[18px] text-[#111315] ${
                        message.mine ? 'self-end bg-[#FFE9D2]' : 'self-start border border-black/5 bg-white'
                      }`}
                    >
                      {!message.mine && <span className="block text-[10px] font-medium text-[#111315]/50">{message.from}</span>}
                      <span className="whitespace-pre-wrap break-words">{message.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex h-14 flex-none items-center gap-2 border-t border-black/5 bg-white px-2">
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') sendChat(); }}
                    placeholder="Type a message…"
                    maxLength={500}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-[rgba(26,29,33,0.25)] bg-white px-3 text-[13px] text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.35)] focus:border-[#FF8A00]"
                  />
                  <button
                    type="button"
                    onClick={sendChat}
                    className="flex h-9 flex-none items-center justify-center rounded-lg bg-[#FF8A00] px-4 text-[13px] font-semibold text-white transition hover:brightness-105"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleRemoteAudio}
            disabled={!remoteAudioTrackCount && !remoteAudioEnabled}
            title={remoteAudioEnabled
              ? 'Mute audio from the host machine (only for you)'
              : remoteAudioTrackCount
                ? 'Play audio from the host machine'
                : 'The host stream has no audio track'}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#111315]/70 transition-colors hover:bg-[#F3F4F6] active:scale-95 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
          >
            {remoteAudioEnabled ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
          </button>
          <div className="mx-1 h-6 w-px bg-[rgba(26,29,33,0.1)]" />
          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) requestLandscape();
              else document.exitFullscreen();
            }}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#111315]/70 transition-colors hover:bg-[#F3F4F6] active:scale-95"
          >
            {isFullscreen ? <Minimize2 size={18} strokeWidth={2} /> : <Maximize2 size={18} strokeWidth={2} />}
          </button>
          <button
            type="button"
            onClick={() => setShowDisconnectConfirm(true)}
            title="End session"
            className="flex h-10 flex-none items-center justify-center whitespace-nowrap rounded-[34px] bg-[#FF383C] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#E62E32] active:scale-95"
          >
            {/* Icon-only below sm — the labeled pill would overflow a phone-width bar. */}
            <MonitorOff size={19} strokeWidth={2} className="sm:hidden" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
          <button
            type="button"
            onClick={() => { setOpenToolbarMenu(null); setChatOpen(false); setQuickHint(null); setToolbarCollapsed(true); }}
            title="Hide toolbar"
            className="flex h-[22px] w-[22px] flex-none items-center justify-center text-[#111315] transition-transform hover:scale-105 active:scale-95"
          >
            <ChevronDown size={22} />
          </button>
        </div>
      </div>

      {/* Transient top-center notice: recording started/stopped, etc. */}
      {sessionNotice && (
        <div className="fixed left-1/2 top-4 z-[300] -translate-x-1/2 rounded-lg bg-black/85 px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl">
          {sessionNotice}
        </div>
      )}

      {/* Collapsed toolbar: floating tab to bring it back (desktop parity) */}
      {toolbarCollapsed && (
        <button
          type="button"
          onClick={() => setToolbarCollapsed(false)}
          title="Show toolbar"
          className="absolute bottom-3 right-0 z-[120] flex h-11 w-12 items-center justify-center rounded-l-2xl rounded-r-none bg-white pr-1 text-[#111315] shadow-2xl transition hover:bg-[#F6F7F8] active:scale-95"
        >
          <ChevronDown size={22} className="rotate-180" />
          {chatUnread > 0 && (
            <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF383C] px-1 text-[9px] font-bold leading-none text-white">
              {chatUnread > 9 ? '9+' : chatUnread}
            </span>
          )}
        </button>
      )}

      <textarea
        ref={mobileKeyboardRef}
        aria-label="Remote keyboard"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        onKeyDown={sendSpecialMobileKey}
        onInput={sendMobileTypedText}
        className="pointer-events-none fixed bottom-2 left-2 z-[1] h-6 w-6 resize-none opacity-[0.01]"
      />

      {/* Hidden file input for "Send files" (several at once) */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (picked.length) void fileXferRef.current?.sendFiles(picked);
        }}
      />

      {/* Disconnect confirmation — same dialog as the desktop viewer */}
      {showDisconnectConfirm && (
        <div
          data-session-ui
          className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 p-6"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div
            className="relative flex w-full max-w-[468px] flex-col items-start gap-[22px] rounded-xl bg-white px-6 py-3 text-[#111315] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-11 w-full items-center justify-between gap-[22px]">
              <h2 className="m-0 flex-1 text-[24px] font-bold leading-[34px] text-[#111315]">Disconnect session?</h2>
              <button
                type="button"
                aria-label="Close disconnect confirmation"
                onClick={() => setShowDisconnectConfirm(false)}
                className="flex h-6 w-6 flex-none items-center justify-center text-[#111315] transition hover:opacity-70"
              >
                <X size={24} strokeWidth={2.4} />
              </button>
            </div>
            <div className="flex w-full flex-col items-start gap-[22px]">
              <div>
                <p className="m-0 text-[14px] font-normal leading-5 text-[#111315]">
                  You are about to end the session with {deviceName}.
                </p>
                <p className="m-0 mt-2 text-[12px] leading-4 text-[#111315]/55">
                  You can reconnect at any time from your device list.
                </p>
              </div>
              <div className="flex w-full justify-end">
                <div className="flex h-10 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-[#F3F4F6]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDisconnectConfirm(false); endSession(); }}
                    className="flex h-10 w-[124px] items-center justify-center rounded-[32px] bg-[#FF383C] px-4 text-[14px] font-medium leading-5 text-white transition hover:bg-[#E62E32]"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog for destructive host actions (restart / sign out) */}
      {pendingAction && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF4E5] text-[#FF8A00]"><Power size={26} /></div>
            <h3 className="m-0 mb-2 text-lg font-bold text-[#111315]">{pendingAction.title}</h3>
            <p className="m-0 mb-7 text-sm leading-relaxed text-[rgba(17,19,21,0.55)]">{pendingAction.message}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="flex-1 rounded-xl bg-[#F3F4F6] py-3 text-sm font-bold text-[rgba(17,19,21,0.65)] transition-colors hover:bg-[#E8EAED]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onControlEvent({ type: 'action', action: pendingAction.action }); setPendingAction(null); }}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
              >
                {pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionViewer;
