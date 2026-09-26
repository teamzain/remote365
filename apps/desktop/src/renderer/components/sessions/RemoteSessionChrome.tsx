import React, { useEffect, useRef, useState } from 'react';
import whiteboardIcon from '../../assets/whiteboard.svg';
import { toast } from '../../lib/toastStore';
import { useClipboardSyncPreference } from '../../lib/clipboardSyncPreference';
import FileTransferToasts from './FileTransferToasts';
import ViewerCameraDock from './ViewerCameraDock';
import { MeetingPreviewModal, SESSION_CAMERA_PREF_KEYS } from '../MeetingPreviewModal';
import {
  configureCameraTransport,
  handleCameraControlMessage,
  isViewerCameraSupported,
  startViewerCamera,
  stopViewerCamera,
  subscribeCameraState,
} from '../../lib/viewerCameraCapture';
import { subscribeControlChunk, subscribeControlJson } from '../../lib/sessionControlBus';
import { disposeFileTransferEngine, getFileTransferEngine, subscribeTransferJobs } from '../../lib/fileTransferEngine';
import {
  MousePointer2,
  RefreshCw,
  Lock,
  Power,
  RotateCcw,
  Maximize,
  Maximize2,
  Minimize,
  Minimize2,
  Search,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Command,
  Folder,
  Copy,
  Keyboard,
  Monitor,
  Smartphone,
  MonitorOff,
  ChevronDown,
  ChevronRight,
  Home,
  Bell,
  Sliders,
  Globe,
  AppWindow,
  LayoutGrid,
  Sun,
  ArrowLeftRight,
  Scaling,
  Check,
  LogOut,
  UserPlus,
  Users,
  StickyNote,
  Camera,
  Video,
  VideoOff,
  RotateCw,
  Volume1,
  Wifi,
  Signal,
  PhoneCall,
  Plane,
  CircleDot,
  MessageSquare,
  UploadCloud,
  DownloadCloud,
  PencilLine,
  Eraser,
  Square,
  Circle,
  Type,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Modal from '../ui/Modal';

interface RemoteSessionChromeProps {
  deviceName?: string;
  sessionCode?: string;
  isMobileDevice: boolean;
  controlStatus: 'granted' | 'pending' | 'denied';
  scaleMode: 'fit' | 'fill' | 'actual';
  isFullScreen: boolean;
  remoteAudioEnabled: boolean;
  remoteAudioTrackCount: number;
  /** Talk-back: true while the operator's mic is streaming to the host. */
  talkActive?: boolean;
  /** Talk-back: toggle the local mic (undefined = host does not accept mic audio). */
  onToggleTalk?: () => void;
  latency: number;
  hasReceivedKeyframe: boolean;
  isRecording: boolean;
  hasUnsavedRecording?: boolean;
  recordingElapsed?: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSaveRecording: () => void;
  onDiscardRecording: () => void;
  /** Platform recording policy: false hides the Record control entirely
   *  ("Only Admins Can Download" — recordings save to this machine). */
  recordingAllowed?: boolean;
  onTakeScreenshot: () => void;
  connectionHealth?: { rttMs: number; lossPct: number; fps: number };
  onBoostConnection?: () => void;
  isMacroRecording?: boolean;
  macroRecordingCount?: number;
  isMacroPlaying?: boolean;
  savedMacros?: { id: string; name: string; events: { event: any; dt: number }[]; createdAt: number }[];
  onStartMacroRecording?: () => void;
  onStopMacroRecording?: () => void;
  onPlayMacro?: (macro: { id: string; name: string; events: { event: any; dt: number }[]; createdAt: number }) => void;
  onDeleteMacro?: (id: string) => void;
  directKeyboardMode?: boolean;
  onSetDirectKeyboardMode?: (value: boolean) => void;
  // Win / Alt+Tab / Alt+F4 / Ctrl+Esc / PrintScreen go to the remote machine
  // instead of this laptop (desktop hosts only; undefined = unsupported here).
  systemKeysMode?: boolean;
  onSetSystemKeysMode?: (value: boolean) => void;
  onDisconnect: () => void;
  onRequestControl: () => void;
  onSetScaleMode: (mode: 'fit' | 'fill' | 'actual') => void;
  onToggleFullscreen: () => void;
  onOpenCommandDeck: () => void;
  onPasteClipboard: () => void;
  onSendFile: () => void;
  onSendLocalFilePath?: (path: string) => void;
  onReceiveFile: () => void;
  onReceiveRemoteFilePath?: (path: string) => void;
  onRefreshStream: () => void;
  onToggleAudio: () => void;
  onPowerActions: () => void;
  onControlEvent: (event: any) => void;
  /** Live handle on the control channel — the file manager needs its
   *  bufferedAmount for send-side flow control. */
  getControlChannel?: () => RTCDataChannel | null;
  remoteWhiteboardEvent?: any;
  /** Incoming chat message from the host machine's dock ({from, text, at, receivedAt}). */
  remoteChatEvent?: any;
  remoteCursor?: { x: number; y: number; visible: boolean; cursorType?: string } | null;
  remoteFileBrowserEvent?: any;
  fileTransferStatus?: {
    direction: 'send' | 'receive';
    name?: string;
    progress: number;
    state: 'idle' | 'waiting' | 'transferring' | 'complete' | 'error';
    message?: string;
    path?: string;
  } | null;
  children: React.ReactNode;
}

interface MenuItem {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** Render a flyout submenu instead of running an action. */
  submenu?: MenuItem[];
  /** Show a trailing check mark (for toggles). */
  checked?: boolean;
  /** Keep the menu open after running (for toggles). */
  keepOpen?: boolean;
}

type ConfirmableAction = 'reboot' | 'safe_reboot' | 'sign_out';

interface RemoteActionConfirmation {
  action: ConfirmableAction;
  title: string;
  message: string;
  confirmLabel: string;
  detail: string;
}

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const FilledMenuArrow: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.30325 5.30325L1.0605 9.546L0 8.4855L3.7125 4.773L0 1.0605L1.0605 0L5.30325 4.24275C5.44385 4.3834 5.52284 4.57413 5.52284 4.773C5.52284 4.97187 5.44385 5.1626 5.30325 5.30325Z"
      fill="#111315"
    />
  </svg>
);

const RadioMenuMark: React.FC<{ checked?: boolean }> = ({ checked }) => (
  <span
    className={`relative inline-flex h-[18px] w-[30px] flex-shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-[#FF8A00]' : 'bg-[#D7DBE0]'
    }`}
  >
    <span
      className={`absolute h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-[14px]' : 'translate-x-[2px]'
      }`}
    />
  </span>
);

/**
 * Charcoal session chrome shown while viewing a remote device.
 * Renders the live screen (children) and a bottom toolbar with action menus
 * (with flyout submenus) plus a floating quick-action pill. Every control maps
 * to a command the host
 * actually understands (see the control-channel switch in
 * apps/desktop/src/main/index.ts).
 */
export const RemoteSessionChrome: React.FC<RemoteSessionChromeProps> = ({
  deviceName,
  sessionCode,
  isMobileDevice,
  controlStatus,
  scaleMode,
  isFullScreen,
  remoteAudioEnabled,
  remoteAudioTrackCount,
  talkActive,
  onToggleTalk,
  hasReceivedKeyframe,
  isRecording,
  hasUnsavedRecording,
  recordingElapsed = 0,
  onStartRecording,
  onStopRecording,
  onSaveRecording,
  onDiscardRecording,
  recordingAllowed = true,
  onTakeScreenshot,
  connectionHealth,
  onBoostConnection,
  isMacroRecording,
  macroRecordingCount = 0,
  isMacroPlaying,
  savedMacros = [],
  onStartMacroRecording,
  onStopMacroRecording,
  onPlayMacro,
  onDeleteMacro,
  directKeyboardMode = false,
  onSetDirectKeyboardMode,
  systemKeysMode = false,
  onSetSystemKeysMode,
  onDisconnect,
  onRequestControl,
  onSetScaleMode,
  onToggleFullscreen,
  onOpenCommandDeck,
  onPasteClipboard,
  onSendFile,
  onSendLocalFilePath,
  onReceiveFile,
  onReceiveRemoteFilePath,
  onRefreshStream,
  onToggleAudio,
  onPowerActions,
  onControlEvent,
  getControlChannel,
  remoteWhiteboardEvent,
  remoteChatEvent,
  remoteCursor,
  remoteFileBrowserEvent,
  fileTransferStatus,
  children,
}) => {
  const user = useAuthStore((state) => state.user);
  const [elapsed, setElapsed] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [lockOnEnd, setLockOnEnd] = useState(false);
  const [clipboardSync, setClipboardSync] = useClipboardSyncPreference();
  const [inviteCopied, setInviteCopied] = useState(false);
  const [recapCopied, setRecapCopied] = useState(false);
  // Lightweight, fully local session recap: a running log of what actually
  // happened this session (no server round-trip), so you can share a summary
  // with a teammate afterward instead of trying to remember what you did.
  const [sessionLog, setSessionLog] = useState<{ time: number; label: string }[]>([]);
  const logEvent = (label: string) => {
    setSessionLog((log) => [...log, { time: Date.now(), label }].slice(-50));
  };
  const [qualityMode, setQualityMode] = useState<'auto' | 'speed' | 'quality'>('auto');
  const [showRemoteCursor, setShowRemoteCursor] = useState(false);
  // Disconnect asks for confirmation first — an accidental click on the red
  // pill must not drop a live session (and with lock-on-end, lock the PC).
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  // In-session chat with the person at the host machine (their side lives in
  // the host dock). Messages ride the control data channel as {type:'chat'}.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; at: number; mine: boolean }[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatDraft, setChatDraft] = useState('');
  const chatOpenRef = useRef(false);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  const chatListRef = useRef<HTMLDivElement>(null);
  const chatSeenRef = useRef(0);
  useEffect(() => {
    if (!remoteChatEvent || typeof remoteChatEvent.text !== 'string' || !remoteChatEvent.text) return;
    if (remoteChatEvent.receivedAt && remoteChatEvent.receivedAt === chatSeenRef.current) return;
    chatSeenRef.current = remoteChatEvent.receivedAt || Date.now();
    const from = String(remoteChatEvent.from || deviceName || 'Remote User').slice(0, 80);
    const text = String(remoteChatEvent.text).slice(0, 2000);
    setChatMessages((list) => [...list, { from, text, at: remoteChatEvent.at || Date.now(), mine: false }]);
    if (!chatOpenRef.current) {
      setChatUnread((count) => count + 1);
      toast.success(`${from}: ${text.length > 80 ? `${text.slice(0, 80)}…` : text}`);
    }
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
  // Driven directly (no React re-render) from local pointer moves so the remote-cursor
  // overlay tracks the viewer's mouse instantly instead of the laggy round-tripped pos.
  const cursorElRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  // Inline text-entry for the whiteboard "T" tool (Electron has no window.prompt).
  const [whiteboardTextInput, setWhiteboardTextInput] = useState<{ x: number; y: number } | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<RemoteActionConfirmation | null>(null);
  // Quick-pill hover hint. Tracks the hovered button's center so the tooltip
  // sits exactly above the icon being pointed at, not at a fixed pill offset.
  const [quickHint, setQuickHint] = useState<{ label: string; left: number } | null>(null);
  const quickPillRef = useRef<HTMLDivElement>(null);
  const showQuickHint = (label: string) => (event: React.MouseEvent<HTMLElement>) => {
    const pillRect = quickPillRef.current?.getBoundingClientRect();
    const rect = event.currentTarget.getBoundingClientRect();
    setQuickHint({ label, left: pillRect ? rect.left - pillRect.left + rect.width / 2 : 24 });
  };
  const hideQuickHint = (label: string) => () =>
    setQuickHint((current) => (current?.label === label ? null : current));
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);
  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'marker' | 'eraser' | 'rect' | 'circle' | 'text'>('pen');
  const [whiteboardColor, setWhiteboardColor] = useState('#FF8A00');
  const whiteboardRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const whiteboardSnapshotRef = useRef<ImageData | null>(null);
  const whiteboardExpireTimerRef = useRef<number | null>(null);
  const whiteboardClientIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const notesKey = `remote365_session_notes_${(deviceName || 'device').replace(/\s+/g, '_').toLowerCase()}`;
  const [notes, setNotes] = useState(() => localStorage.getItem(notesKey) || '');
  const barRef = useRef<HTMLDivElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  // Turning the camera on shows the same preview/consent dialog as joining a
  // meeting. Sharing your face and voice with the far end should never be a
  // single unconfirmed click, and it lets you pick the right camera and see
  // yourself BEFORE anything is broadcast.
  const [cameraConsentOpen, setCameraConsentOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  const readCameraPref = (key: string, fallback = '') => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  };

  const confirmCameraConsent = async () => {
    setCameraStarting(true);
    // The dialog persisted the choices before calling back, so read them here
    // rather than duplicating its state.
    const started = await startViewerCamera({
      cameraId: readCameraPref(SESSION_CAMERA_PREF_KEYS.cam) || undefined,
      micId: readCameraPref(SESSION_CAMERA_PREF_KEYS.mic) || undefined,
      micEnabled: readCameraPref(SESSION_CAMERA_PREF_KEYS.audio, 'true') !== 'false',
      videoEnabled: readCameraPref(SESSION_CAMERA_PREF_KEYS.video, 'true') !== 'false',
    });
    setCameraStarting(false);
    setCameraConsentOpen(false);
    logEvent(started ? 'Turned Camera On' : 'Camera Could Not Be Started');
  };

  const toggleCamera = () => {
    if (cameraOn) {
      void stopViewerCamera();
      logEvent('Turned Camera Off');
      return;
    }
    setCameraConsentOpen(true);
  };

  // The camera path needs the control channel for its own flow control, so it
  // is wired up once per session rather than per toggle.
  useEffect(() => {
    configureCameraTransport(onControlEvent, () => getControlChannel?.() || null);
    const unsubscribeState = subscribeCameraState((state) => setCameraOn(state.active));
    const unsubscribeBus = subscribeControlJson(handleCameraControlMessage);
    // The remote end sometimes has to explain itself — a phone cannot rotate
    // without "Modify System Settings", and a dead-looking button with no
    // reason is exactly the kind of thing that gets reported as broken.
    const unsubscribeNotices = subscribeControlJson((data) => {
      if (data?.type !== 'host-notice' || !data?.text) return false;
      toast.info(String(data.text), 8000);
      return true;
    });

    // The transfer engine is subscribed at SESSION scope, not panel scope: a
    // job must keep running (and keep writing to disk) while the file manager
    // is closed. Only leaving the session tears it down.
    const transferEngine = getFileTransferEngine(onControlEvent, () => getControlChannel?.() || null);
    const unsubscribeTransferJson = subscribeControlJson((data) => transferEngine.handleMessage(data));
    const unsubscribeTransferChunk = subscribeControlChunk((header, chunk) => transferEngine.handleChunk(header, chunk));

    return () => {
      unsubscribeState();
      unsubscribeBus();
      unsubscribeNotices();
      unsubscribeTransferJson();
      unsubscribeTransferChunk();
      disposeFileTransferEngine();
      // Leaving a session with the camera still running would keep the webcam
      // light on with nothing receiving it.
      void stopViewerCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session timer starts when the first frame arrives.
  useEffect(() => {
    if (!hasReceivedKeyframe) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [hasReceivedKeyframe]);

  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    const remoteName = (deviceName || 'Remote Device').trim();
    const sessionTime = formatDuration(elapsed);
    const title = `Remote365 - ${remoteName} - Session Time ${sessionTime}`;
    document.title = title;
    electronApi?.setWindowTitle?.(title);
  }, [deviceName, elapsed]);

  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    return () => {
      document.title = 'Remote365';
      electronApi?.setWindowTitle?.('Remote365');
    };
  }, []);

  // "Send files" / "Get files" (the whole transfer UI: two buttons plus the
  // progress cards). Both act on the remote computer, so both need control;
  // a view-only session asks for it instead of sending into nothing.
  const transferEngine = () => getFileTransferEngine(onControlEvent, () => getControlChannel?.() || null);
  const needControlForFiles = () => {
    if (controlStatus === 'granted') return false;
    toast.info(controlStatus === 'pending'
      ? 'Waiting for the other side to allow control. Files can be sent once they do.'
      : 'Sending and getting files needs control of the session. Control requested.', 6000);
    if (controlStatus !== 'pending') onRequestControl();
    return true;
  };
  const sendFiles = async () => {
    if (needControlForFiles()) return;
    const paths: string[] = await (window as any).electronAPI?.files?.pickFiles?.().catch(() => []) || [];
    if (!paths.length) return;
    void transferEngine().sendPaths(paths, '');
  };
  const getFiles = () => {
    if (needControlForFiles()) return;
    transferEngine().requestHostPick((deviceName || 'the remote computer').trim());
  };

  // Close any open menu / popover on outside click or Escape.
  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (event: MouseEvent) => {
      if (barRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
      setOpenSubmenu(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setOpenSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenu]);

  // Automatic clipboard sync itself lives in App.tsx (one 650 ms poller per
  // session, gated by the shared preference in lib/clipboardSyncPreference);
  // this component only owns the toggle. A second poller here used to
  // double-send every change while the toggle itself changed nothing.

  // --- Real host commands -------------------------------------------------
  const action = (name: string) => () => onControlEvent({ type: 'action', action: name });
  const confirmableActions: Record<ConfirmableAction, RemoteActionConfirmation> = {
    reboot: {
      action: 'reboot',
      title: isMobileDevice ? 'Remote Power Menu' : 'Remote Reboot',
      message: isMobileDevice
        ? 'The remote phone power menu is going to open. If you want to prevent this action click Cancel.'
        : 'The remote computer is going to reboot. If you want to prevent the computer from rebooting click Cancel.',
      confirmLabel: 'Confirm',
      detail: isMobileDevice ? 'Opens the phone power controls on the remote device.' : 'Restarts the remote computer immediately.',
    },
    safe_reboot: {
      action: 'safe_reboot',
      title: 'Safe Reboot',
      message: 'The remote computer is going to reboot after a short grace period. If you want to prevent the computer from rebooting click Cancel.',
      confirmLabel: 'Confirm',
      detail: 'Restarts the remote computer after 15 seconds so apps can react first.',
    },
    sign_out: {
      action: 'sign_out',
      title: 'Sign Out Remote Computer',
      message: 'The current Windows user on the remote computer is going to be signed out. If you want to prevent this action click Cancel.',
      confirmLabel: 'Sign Out',
      detail: 'Signs out the remote Windows user and ends their desktop session.',
    },
  };
  const confirmAction = (name: ConfirmableAction) => () => {
    setOpenMenu(null);
    setOpenSubmenu(null);
    setPendingConfirmation(confirmableActions[name]);
  };
  const runPendingConfirmation = () => {
    if (!pendingConfirmation) return;
    onControlEvent({ type: 'action', action: pendingConfirmation.action });
    setPendingConfirmation(null);
  };
  const shortcut = (key: string) => () => onControlEvent({ type: 'shortcut', key });
  const keyCombo = (keys: number[]) => () => onControlEvent({ type: 'keyCombo', keys });
  const globalAction = (code: number) => () => onControlEvent({ type: 'globalAction', action: code });

  const handleDisconnect = () => {
    if (lockOnEnd && !isMobileDevice) {
      onControlEvent({ type: 'action', action: 'lock' });
      setTimeout(onDisconnect, 350);
    } else {
      onDisconnect();
    }
  };

  const copyInviteLink = async () => {
    const code = String(sessionCode || '').replace(/\s/g, '');
    if (!code) return;
    const link = `remote365://join?code=${encodeURIComponent(code)}`;
    try {
      const electronApi = (window as any).electronAPI;
      if (electronApi?.clipboard?.writeText) await electronApi.clipboard.writeText(link);
      else await navigator.clipboard?.writeText?.(link);
      setInviteCopied(true);
      logEvent('Copied An Invite Link');
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (err) {
      console.error('[Session] Failed to copy invite link', err);
    }
  };

  const copyRecap = async () => {
    if (!sessionLog.length) return;
    const lines = sessionLog.map((entry) => `${new Date(entry.time).toLocaleTimeString()} — ${entry.label}`);
    const text = `Remote365 session recap — ${deviceName || 'remote device'}\n${lines.join('\n')}`;
    try {
      const electronApi = (window as any).electronAPI;
      if (electronApi?.clipboard?.writeText) await electronApi.clipboard.writeText(text);
      else await navigator.clipboard?.writeText?.(text);
      setRecapCopied(true);
      setTimeout(() => setRecapCopied(false), 2000);
    } catch (err) {
      console.error('[Session] Failed to copy session recap', err);
    }
  };

  const saveNotes = (value: string) => {
    setNotes(value);
    try { localStorage.setItem(notesKey, value); } catch { }
  };

  useEffect(() => {
    if (!showWhiteboard) return;
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const image = canvas.toDataURL();
      canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      if (image && image !== 'data:,') {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = image;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [showWhiteboard]);

  const getWhiteboardPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const scheduleWhiteboardExpiry = () => {
    if (whiteboardExpireTimerRef.current) window.clearTimeout(whiteboardExpireTimerRef.current);
    whiteboardExpireTimerRef.current = window.setTimeout(() => {
      clearWhiteboard(false);
      setShowWhiteboard(false);
      whiteboardExpireTimerRef.current = null;
    }, 6500);
  };

  const normalizePoint = (point: { x: number; y: number }) => {
    const rect = whiteboardRef.current?.getBoundingClientRect();
    return {
      x: rect?.width ? point.x / rect.width : 0,
      y: rect?.height ? point.y / rect.height : 0
    };
  };

  const denormalizePoint = (point: { x: number; y: number }) => {
    const rect = whiteboardRef.current?.getBoundingClientRect();
    return {
      x: point.x * (rect?.width || 1),
      y: point.y * (rect?.height || 1)
    };
  };

  const drawWhiteboardLine = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    options?: { tool?: typeof whiteboardTool; color?: string }
  ) => {
    const canvas = whiteboardRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const tool = options?.tool || whiteboardTool;
    const color = options?.color || whiteboardColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = tool === 'marker' ? 9 : tool === 'eraser' ? 20 : 3;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = tool === 'marker' ? `${color}99` : color;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const emitWhiteboardEvent = (payload: any) => {
    onControlEvent({
      type: 'whiteboard-event',
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sourceId: whiteboardClientIdRef.current,
      ttlMs: 6500,
      ...payload
    });
    scheduleWhiteboardExpiry();
  };

  const applyWhiteboardEvent = (event: any) => {
    if (!event || event.type !== 'whiteboard-event') return;
    if (event.sourceId === whiteboardClientIdRef.current) return;
    setShowWhiteboard(true);
    window.requestAnimationFrame(() => {
      const canvas = whiteboardRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      if (event.action === 'clear') {
        clearWhiteboard(false);
      } else if (event.action === 'text') {
        const point = denormalizePoint(event.point);
        ctx.fillStyle = event.color || whiteboardColor;
        ctx.font = '600 18px Mona Sans, system-ui, sans-serif';
        ctx.fillText(event.text || '', point.x, point.y);
      } else if (event.action === 'shape') {
        const start = denormalizePoint(event.start);
        const end = denormalizePoint(event.end);
        ctx.strokeStyle = event.color || whiteboardColor;
        ctx.lineWidth = 3;
        const width = end.x - start.x;
        const height = end.y - start.y;
        if (event.tool === 'rect') {
          ctx.strokeRect(start.x, start.y, width, height);
        } else {
          ctx.beginPath();
          ctx.ellipse(start.x + width / 2, start.y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (event.action === 'line') {
        drawWhiteboardLine(denormalizePoint(event.from), denormalizePoint(event.to), { tool: event.tool, color: event.color });
      }
      scheduleWhiteboardExpiry();
    });
  };

  useEffect(() => {
    applyWhiteboardEvent(remoteWhiteboardEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteWhiteboardEvent]);


  // Toast when screen recording starts.
  const wasRecordingRef = useRef(false);
  useEffect(() => {
    if (isRecording && !wasRecordingRef.current) { toast.success('Screen Recording Started'); logEvent('Started A Screen Recording'); }
    if (!isRecording && wasRecordingRef.current) logEvent('Stopped The Screen Recording');
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  // Recap entries for control changes and macro activity — real session
  // events, not decoration, so "Session Recap" reflects what actually happened.
  const wasControllingRef = useRef(false);
  useEffect(() => {
    const controlling = controlStatus === 'granted';
    if (controlling && !wasControllingRef.current) logEvent('Took Control Of The Remote Device');
    if (!controlling && wasControllingRef.current) logEvent('Released Control Of The Remote Device');
    wasControllingRef.current = controlling;
  }, [controlStatus]);
  const wasMacroRecordingRef = useRef(false);
  useEffect(() => {
    if (isMacroRecording && !wasMacroRecordingRef.current) logEvent('Started Recording A Macro');
    wasMacroRecordingRef.current = Boolean(isMacroRecording);
  }, [isMacroRecording]);

  // Unmounting the text input (after Enter or Escape) makes the browser fire a
  // native blur on it as it's removed, which was re-invoking onBlur's commit a
  // second time — so Escape didn't actually cancel (the blur-echo committed the
  // text anyway) and Enter could double-draw the same text. This flag makes
  // commit/cancel idempotent: only the first call for a given text-tool click
  // does anything.
  const whiteboardTextHandledRef = useRef(false);
  // True while the text input is open AND an auto-expiry timer was pending
  // when it opened, so commit/cancel know to re-arm it.
  const whiteboardTextHeldExpiryRef = useRef(false);

  const startWhiteboardDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (whiteboardTool === 'text') {
      // Open an inline input at the click point (window.prompt is a no-op in Electron).
      whiteboardTextHandledRef.current = false;
      // Any earlier stroke armed the 6.5 s auto-expiry. Left running, it closed
      // the whiteboard (unmounting this input) while the user was still typing;
      // the unmount-blur then committed against a missing canvas and the text
      // was dropped locally AND never sent to the host. Hold the expiry while
      // the input is open — commit/cancel re-arm it.
      whiteboardTextHeldExpiryRef.current = Boolean(whiteboardExpireTimerRef.current);
      if (whiteboardExpireTimerRef.current) {
        window.clearTimeout(whiteboardExpireTimerRef.current);
        whiteboardExpireTimerRef.current = null;
      }
      setWhiteboardTextInput(getWhiteboardPoint(event));
      return;
    }
    drawingRef.current = true;
    const point = getWhiteboardPoint(event);
    lastPointRef.current = point;
    startPointRef.current = point;
    const ctx = event.currentTarget.getContext('2d');
    whiteboardSnapshotRef.current = ctx?.getImageData(0, 0, event.currentTarget.width, event.currentTarget.height) || null;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const commitWhiteboardText = (raw: string) => {
    if (whiteboardTextHandledRef.current) return;
    whiteboardTextHandledRef.current = true;
    const point = whiteboardTextInput;
    setWhiteboardTextInput(null);
    const text = (raw || '').trim();
    if (!point || !text) {
      if (whiteboardTextHeldExpiryRef.current) scheduleWhiteboardExpiry();
      whiteboardTextHeldExpiryRef.current = false;
      return;
    }
    const ctx = whiteboardRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = whiteboardColor;
      ctx.font = '600 18px "Mona Sans", system-ui, sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, point.x, point.y);
    }
    // Send it even if the canvas is already gone: the host and other viewers
    // should still see the annotation. emitWhiteboardEvent re-arms the expiry.
    whiteboardTextHeldExpiryRef.current = false;
    emitWhiteboardEvent({ action: 'text', point: normalizePoint(point), text, color: whiteboardColor });
  };

  const cancelWhiteboardText = () => {
    whiteboardTextHandledRef.current = true;
    setWhiteboardTextInput(null);
    if (whiteboardTextHeldExpiryRef.current) scheduleWhiteboardExpiry();
    whiteboardTextHeldExpiryRef.current = false;
  };

  const moveWhiteboardDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const next = getWhiteboardPoint(event);
    if ((whiteboardTool === 'rect' || whiteboardTool === 'circle') && startPointRef.current) {
      const canvas = whiteboardRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      if (whiteboardSnapshotRef.current) ctx.putImageData(whiteboardSnapshotRef.current, 0, 0);
      ctx.strokeStyle = whiteboardColor;
      ctx.lineWidth = 3;
      const start = startPointRef.current;
      const width = next.x - start.x;
      const height = next.y - start.y;
      if (whiteboardTool === 'rect') {
        ctx.strokeRect(start.x, start.y, width, height);
      } else {
        ctx.beginPath();
        ctx.ellipse(start.x + width / 2, start.y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      lastPointRef.current = next;
      return;
    }
    drawWhiteboardLine(lastPointRef.current, next);
    emitWhiteboardEvent({
      action: 'line',
      from: normalizePoint(lastPointRef.current),
      to: normalizePoint(next),
      tool: whiteboardTool,
      color: whiteboardColor
    });
    lastPointRef.current = next;
  };

  const stopWhiteboardDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if ((whiteboardTool === 'rect' || whiteboardTool === 'circle') && startPointRef.current && lastPointRef.current) {
      emitWhiteboardEvent({
        action: 'shape',
        tool: whiteboardTool,
        start: normalizePoint(startPointRef.current),
        end: normalizePoint(lastPointRef.current),
        color: whiteboardColor
      });
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    startPointRef.current = null;
    whiteboardSnapshotRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { }
  };

  const clearWhiteboard = (broadcast = true) => {
    const canvas = whiteboardRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // sourceId lets applyWhiteboardEvent ignore the host's echo of our own
    // clear; without it the echo re-opened a whiteboard the user had closed.
    if (broadcast) onControlEvent({ type: 'whiteboard-event', action: 'clear', id: `${Date.now()}-clear`, sourceId: whiteboardClientIdRef.current, ttlMs: 0 });
  };

  const clipboardSubmenu: MenuItem[] = [
    { label: 'Paste Clipboard As Key Strokes', icon: <Keyboard size={16} />, onClick: onPasteClipboard },
    {
      label: 'Sync Clipboard Automatically',
      icon: <Copy size={16} />,
      checked: clipboardSync,
      keepOpen: true,
      onClick: () => setClipboardSync(!clipboardSync),
    },
  ];

  const scalingItems: MenuItem[] = [
    { label: 'Best Fit', icon: <Monitor size={16} />, checked: scaleMode === 'fit', onClick: () => onSetScaleMode('fit') },
    { label: 'Original', icon: <Search size={16} />, checked: scaleMode === 'actual', onClick: () => onSetScaleMode('actual') },
    { label: 'Scaled', icon: <Scaling size={16} />, checked: scaleMode === 'fill', onClick: () => onSetScaleMode('fill') },
  ];

  const pickQuality = (mode: 'auto' | 'speed' | 'quality') => {
    setQualityMode(mode);
    // reason:'user' pins the host encoder; the bandwidth auto-tuner stands down
    // until the viewer chooses "Auto Select" again.
    onControlEvent({ type: 'stream-quality', mode, reason: 'user' });
  };
  const handleRefresh = () => {
    setRefreshing(true);
    onRefreshStream();
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => setRefreshing(false), 1100);
  };

  const qualityItems: MenuItem[] = [
    { label: 'Auto Select', icon: <Check size={16} />, checked: qualityMode === 'auto', onClick: () => pickQuality('auto') },
    { label: 'Optimal Speed', icon: <RefreshCw size={16} />, checked: qualityMode === 'speed', onClick: () => pickQuality('speed') },
    { label: 'Optimal Quality', icon: <Monitor size={16} />, checked: qualityMode === 'quality', onClick: () => pickQuality('quality') },
  ];

  // Menu definitions branch on the target platform so each item maps to a
  // command the host can actually execute.
  const menus: { id: string; label: string; items: MenuItem[] }[] = [
    {
      id: 'actions',
      label: 'Actions',
      items: isMobileDevice
        ? [
            {
              label:
                controlStatus === 'granted'
                  ? 'Control Granted'
                  : controlStatus === 'pending'
                    ? 'Requesting Control…'
                    : 'Request Control',
              icon: <MousePointer2 size={16} />,
              onClick: onRequestControl,
              disabled: controlStatus === 'granted',
            },
            { label: 'Refresh Screen', icon: <RefreshCw size={16} />, onClick: handleRefresh },
            { label: 'Wake Phone', icon: <Sun size={16} />, onClick: () => onControlEvent({ type: 'wake' }) },
            { label: 'Lock Phone', icon: <Lock size={16} />, onClick: action('lock') },
            {
              label: 'Rotate Screen',
              icon: <RotateCw size={16} />,
              submenu: [
                { label: 'Rotate Left', icon: <RotateCcw size={16} />, onClick: action('rotate_left') },
                { label: 'Rotate Right', icon: <RotateCw size={16} />, onClick: action('rotate_right') },
                { label: 'Portrait', icon: <Smartphone size={16} />, onClick: action('rotate_portrait') },
                { label: 'Landscape', icon: <Monitor size={16} />, onClick: action('rotate_landscape') },
                { label: 'Auto-Rotate', icon: <RefreshCw size={16} />, onClick: action('rotate_auto') },
              ],
            },
            {
              label: 'Volume',
              icon: <Volume2 size={16} />,
              submenu: [
                // keepOpen: nudging volume is repetitive — closing the menu after
                // every single step would make setting a level tedious.
                { label: 'Volume Up', icon: <Volume2 size={16} />, keepOpen: true, onClick: action('volume_up') },
                { label: 'Volume Down', icon: <Volume1 size={16} />, keepOpen: true, onClick: action('volume_down') },
              ],
            },
            {
              label: 'Connectivity',
              // Android has blocked third-party apps from flipping Wi-Fi and
              // mobile data since Android 10, so these open the system panel
              // that holds the real switch — tap it with remote control.
              hint: 'opens phone settings',
              icon: <Wifi size={16} />,
              submenu: [
                { label: 'Wi-Fi', icon: <Wifi size={16} />, onClick: action('connectivity_wifi') },
                { label: 'Mobile Data', icon: <Signal size={16} />, onClick: action('connectivity_data') },
                { label: 'Wi-Fi Calling', icon: <PhoneCall size={16} />, onClick: action('connectivity_calling') },
                { label: 'Airplane Mode', icon: <Plane size={16} />, onClick: action('connectivity_airplane') },
              ],
            },
            { label: 'Quick Settings', hint: 'tile shade', icon: <Sliders size={16} />, onClick: action('quick_settings') },
            // Android gives no app any way to power a device off (or on) — not
            // even a device owner. The system power dialog is the real ceiling:
            // it opens on the phone and Power off is one remote tap away.
            { label: 'Power Menu', hint: 'restart / power off', icon: <Power size={16} />, onClick: confirmAction('reboot'), danger: true },
          ]
        : [
            {
              label:
                controlStatus === 'granted'
                  ? 'Control Granted'
                  : controlStatus === 'pending'
                    ? 'Requesting Control…'
                    : 'Request Control',
              icon: <MousePointer2 size={16} />,
              onClick: onRequestControl,
              disabled: controlStatus === 'granted',
            },
            {
              label: 'Minimize Remote365 Window',
              hint: 'host app',
              icon: <AppWindow size={16} />,
              onClick: action('minimize_host_window'),
            },
            {
              label: 'Lock Device',
              icon: <Lock size={16} />,
              submenu: [
                { label: 'Lock Now', hint: 'Win+L', icon: <Lock size={16} />, onClick: action('lock') },
                {
                  label: 'Lock On Session End',
                  icon: <MonitorOff size={16} />,
                  checked: lockOnEnd,
                  keepOpen: true,
                  onClick: () => setLockOnEnd((value) => !value),
                },
                { label: 'Sign Out On Remote Computer', icon: <LogOut size={16} />, onClick: confirmAction('sign_out'), danger: true },
              ],
            },
            { label: 'Restart Device', icon: <RotateCcw size={16} />, onClick: confirmAction('reboot'), danger: true },
            { label: 'Safe Reboot', hint: '15s grace', icon: <RotateCcw size={16} />, onClick: confirmAction('safe_reboot') },
            { label: 'Send Ctrl + Alt + Del', hint: 'Task Manager', icon: <Keyboard size={16} />, onClick: action('task_manager') },
            {
              label: 'Direct Keyboard Mode',
              hint: directKeyboardMode ? 'raw keys' : undefined,
              icon: <Keyboard size={16} />,
              checked: directKeyboardMode,
              keepOpen: true,
              disabled: !onSetDirectKeyboardMode,
              onClick: () => onSetDirectKeyboardMode?.(!directKeyboardMode),
            },
            {
              label: 'Send System Keys To Remote',
              hint: systemKeysMode ? 'Win, Alt + Tab' : undefined,
              icon: <Keyboard size={16} />,
              checked: systemKeysMode,
              keepOpen: true,
              disabled: !onSetSystemKeysMode,
              onClick: () => onSetSystemKeysMode?.(!systemKeysMode),
            },
          ],
    },
    {
      id: 'collaboration',
      label: 'Collaboration',
      items: [
        {
          label: 'Show Participants',
          icon: <Users size={16} />,
          keepOpen: true,
          onClick: () => setOpenMenu('participants'),
        },
        {
          label: cameraOn ? 'Turn My Camera Off' : 'Turn My Camera On',
          hint: 'Show your face on the remote machine',
          icon: cameraOn ? <VideoOff size={16} /> : <Video size={16} />,
          checked: cameraOn,
          keepOpen: true,
          disabled: !isViewerCameraSupported(),
          onClick: toggleCamera,
        },
        {
          label: `Session recap${sessionLog.length ? ` (${sessionLog.length})` : ''}`,
          icon: <StickyNote size={16} />,
          keepOpen: true,
          onClick: () => setOpenMenu('recap'),
        },
      ],
    },
    {
      id: 'tools',
      label: 'Tools',
      items: [
        { label: 'Leave Notes', icon: <StickyNote size={16} />, keepOpen: true, onClick: () => setOpenMenu('notes') },
        { label: 'Clipboard', icon: <Copy size={16} />, submenu: clipboardSubmenu },
        ...(isMobileDevice ? [] : [
          { label: 'Send files', icon: <UploadCloud size={16} />, onClick: () => { void sendFiles(); } },
          { label: 'Get files', icon: <DownloadCloud size={16} />, onClick: getFiles },
        ]),
        { label: 'Whiteboard', icon: <img src={whiteboardIcon} alt="" className="h-4 w-4" />, onClick: () => { setShowWhiteboard(true); } },
        { label: 'Take Screenshot', icon: <Camera size={16} />, onClick: () => { onTakeScreenshot(); logEvent('Took A Screenshot'); }, disabled: !hasReceivedKeyframe },
        {
          label: isRecording
            ? 'Recording… (See Top Right)'
            : hasUnsavedRecording
              ? 'Recording Ready — See Top Right'
              : 'Start Screen Recording',
          icon: <CircleDot size={16} className={isRecording ? 'text-[#FF2D55]' : undefined} />,
          onClick: onStartRecording,
          disabled: !hasReceivedKeyframe || isRecording || Boolean(hasUnsavedRecording),
          hidden: !recordingAllowed,
        },
        { label: 'Command Deck', icon: <Command size={16} />, onClick: onOpenCommandDeck },
        ...(!isMobileDevice
          ? [
              { label: 'File Explorer', hint: 'Win+E', icon: <Folder size={16} />, onClick: action('explorer') },
              { label: 'Web Browser', icon: <Globe size={16} />, onClick: action('browser') },
            ]
          : [
              { label: 'Home Screen', icon: <Home size={16} />, onClick: action('home') },
              { label: 'Recent Apps', icon: <LayoutGrid size={16} />, onClick: action('recents') },
              { label: 'Back', icon: <ArrowLeftRight size={16} />, onClick: globalAction(1) },
            ]),
      ],
    },
    // The Macros menu (record / play / delete input macros) was removed from
    // the session toolbar on Sep 4 2026 at the owner's request. The recording
    // plumbing in App.tsx is untouched; only this entry point is gone.
    {
      id: 'view',
      label: 'View',
      items: [
        { label: 'Scaling', icon: <Scaling size={16} />, submenu: scalingItems },
        { label: 'Quality', icon: <Monitor size={16} />, submenu: qualityItems },
        { label: 'Connection Info', icon: <Search size={16} />, keepOpen: true, onClick: () => setOpenMenu('connection-info') },
        {
          label: 'Show Remote Cursor',
          icon: <MousePointer2 size={16} />,
          checked: showRemoteCursor,
          keepOpen: true,
          onClick: () => setShowRemoteCursor((value) => !value),
        },
        { label: 'Refresh Screen', icon: <RefreshCw size={16} />, onClick: handleRefresh },
        {
          label: 'Fit To Screen',
          hidden: true,
          hint: scaleMode === 'fit' ? '✓' : undefined,
          icon: scaleMode === 'fit' ? <Check size={16} /> : <Monitor size={16} />,
          onClick: () => onSetScaleMode('fit'),
        },
        {
          label: 'Fill Screen',
          hidden: true,
          hint: scaleMode === 'fill' ? '✓' : undefined,
          icon: scaleMode === 'fill' ? <Check size={16} /> : <Scaling size={16} />,
          onClick: () => onSetScaleMode('fill'),
        },
        {
          label: 'Actual Size',
          hidden: true,
          hint: scaleMode === 'actual' ? '✓' : undefined,
          icon: scaleMode === 'actual' ? <Check size={16} /> : <Search size={16} />,
          onClick: () => onSetScaleMode('actual'),
        },
        {
          label: isFullScreen ? 'Exit Fullscreen' : 'Fullscreen',
          hidden: true,
          icon: isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />,
          onClick: onToggleFullscreen,
        },
        {
          label: remoteAudioEnabled
            ? 'Mute Remote Audio'
            : remoteAudioTrackCount
              ? 'Listen To Remote Audio'
              : 'No Remote Audio',
          hidden: true,
          icon: remoteAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />,
          onClick: onToggleAudio,
          disabled: !remoteAudioTrackCount && !remoteAudioEnabled,
        },
      ],
    },
  ];

  // Keyboard popover (pill) — system key combos sent straight to the host.
  const keyboardItems: MenuItem[] = isMobileDevice
    ? [
        { label: 'Back', icon: <ArrowLeftRight size={16} />, onClick: globalAction(1) },
        { label: 'Home', icon: <Home size={16} />, onClick: action('home') },
        { label: 'Recent Apps', icon: <LayoutGrid size={16} />, onClick: action('recents') },
        { label: 'Notifications', icon: <Bell size={16} />, onClick: shortcut('notifications') },
      ]
    : [
        { label: 'Task Manager', hint: 'Ctrl+Shift+Esc', icon: <Keyboard size={16} />, onClick: action('task_manager') },
        { label: 'Switch Window', hint: 'Alt+Tab', icon: <ArrowLeftRight size={16} />, onClick: keyCombo([0x12, 0x09]) },
        { label: 'Show Desktop', hint: 'Win+D', icon: <AppWindow size={16} />, onClick: shortcut('show-desktop') },
        { label: 'File Explorer', hint: 'Win+E', icon: <Folder size={16} />, onClick: shortcut('file-explorer') },
        { label: 'Quick Settings', hint: 'Win+A', icon: <Sliders size={16} />, onClick: shortcut('control-center') },
        { label: 'Lock', hint: 'Win+L', icon: <Lock size={16} />, onClick: action('lock') },
      ];



  const runItem = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.submenu) {
      setOpenSubmenu((current) => (current === item.label ? null : item.label));
      return;
    }
    item.onClick?.();
    if (!item.keepOpen) {
      setOpenMenu(null);
      setOpenSubmenu(null);
    }
  };

  const pillButton =
    'flex h-10 w-10 items-center justify-center rounded-full text-[#111315] transition-colors hover:bg-[#111315]/10 active:scale-95';
  const quickPillButton =
    'flex flex-none items-center justify-center text-[#111315] transition-transform hover:scale-105 active:scale-95';

  const renderMenuItems = (items: MenuItem[], dark: boolean, compact = false, menuId?: string) => {
    const visibleItems = items.filter((item) => {
      if (item.hidden) return false;
      if (!compact) return true;
      // Tools shows every item. A label whitelist here used to hide Command
      // Deck, File Explorer, Web Browser, Home Screen, Recent Apps and Back.
      if (menuId === 'tools') return true;
      if (menuId === 'view') return true;
      return !['Request Control', 'Control Granted'].includes(item.label) && !item.label.startsWith('Requesting Control');
    });
    return visibleItems.map((item, index) => (
      <div key={item.label} className="relative w-full">
        <button
          type="button"
          onClick={() => runItem(item)}
          disabled={item.disabled}
          className={
            compact
              ? `flex h-10 w-full items-center justify-between gap-2 bg-white px-4 text-left text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F6F7F8] disabled:cursor-not-allowed disabled:opacity-40 font-['Mona_Sans',system-ui,sans-serif] ${
                  index === 0 ? 'rounded-t' : ''
                } ${index === visibleItems.length - 1 ? 'rounded-b' : ''}`
              : `flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger
                    ? 'text-[#FF6B6B] hover:bg-[#FF2D55]/10'
                    : dark
                      ? 'text-white/85 hover:bg-white/10 hover:text-white'
                      : 'text-[#111315] hover:bg-[#F3F4F6]'
                }`
          }
        >
          {!compact && <span className="flex-shrink-0">{item.icon}</span>}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.checked !== undefined && compact && !item.submenu && (
            <RadioMenuMark checked={item.checked} />
          )}
          {item.checked && !compact && <Check size={14} className="flex-shrink-0 text-[#34C759]" />}
          {!compact && item.hint && !item.checked && (
            <span className={`flex-shrink-0 text-[10px] font-mono ${dark ? 'text-white/35' : 'text-[#111315]/40'}`}>
              {item.hint}
            </span>
          )}
          {item.submenu && (
            compact
              ? <FilledMenuArrow className={`flex-shrink-0 transition-transform ${openSubmenu === item.label ? 'rotate-180' : ''}`} />
              : <ChevronRight size={14} className="flex-shrink-0 opacity-60" />
          )}
        </button>
        {item.submenu && openSubmenu === item.label && (
          <div
            className={`absolute bottom-0 z-50 overflow-hidden shadow-2xl animate-in fade-in duration-150 ${
              menuId === 'view'
                ? 'right-full mr-1 slide-in-from-right-1'
                : 'left-full ml-1 slide-in-from-left-1'
            } ${
              compact
                ? `${item.label === 'Clipboard' ? 'w-[240px]' : 'w-[181px]'} rounded bg-white`
                : `w-[250px] rounded-xl border py-1.5 ${dark ? 'border-white/10 bg-[#23262B]' : 'border-black/5 bg-white'}`
            }`}
          >
            {renderMenuItems(item.submenu, dark, compact)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#1A1D21]">
      {/* Live screen */}
      <div
        className="relative mx-3 mb-3 min-h-0 flex-1 overflow-hidden bg-[#F3F4F6] sm:mx-5"
        // Mirror the host's cursor SHAPE: for a native shape (text/pointer/resize…) show the
        // OS cursor with that shape; for the plain arrow, hide the OS cursor and draw our own
        // smooth overlay below. So the pointer looks exactly like it does on the host.
        style={{ cursor: showRemoteCursor ? ((remoteCursor?.cursorType && remoteCursor.cursorType !== 'default') ? remoteCursor.cursorType : 'none') : undefined }}
        onPointerMove={(e) => {
          if (!showRemoteCursor) return;
          const el = cursorElRef.current;
          if (!el) return;
          const r = e.currentTarget.getBoundingClientRect();
          el.style.left = `${e.clientX - r.left}px`;
          el.style.top = `${e.clientY - r.top}px`;
          el.style.opacity = '1';
        }}
        onPointerLeave={() => { const el = cursorElRef.current; if (el) el.style.opacity = '0'; }}
      >
        {children}
        {/* Top-right session controls (web viewer parity): a Disconnect pill
            that stays in reach while the toolbar is collapsed, and — in
            fullscreen, which hides the OS chrome and starts the toolbar
            collapsed — a persistent way out. Shifts down while the recording
            toast occupies the corner. */}
        {(isFullScreen || hasReceivedKeyframe) && (
          <div className={`absolute right-4 z-[100] flex items-center gap-2 ${isRecording || hasUnsavedRecording ? 'top-[70px]' : 'top-4'}`}>
            {isFullScreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl backdrop-blur-md transition hover:bg-black/85 active:scale-95"
              >
                <Minimize2 size={15} />
                Exit Full Screen
              </button>
            )}
            {/* In a view-only session this is the ONLY way to get keyboard and
                mouse, so it sits next to Disconnect rather than inside a menu —
                it was previously filtered out of Actions entirely, back when
                control was always granted on connect. */}
            {controlStatus !== 'granted' && (
              <button
                type="button"
                title="Ask the person at the remote PC to allow keyboard and mouse"
                onClick={onRequestControl}
                disabled={controlStatus === 'pending'}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#FF8A00] px-4 text-[13px] font-semibold text-white shadow-2xl transition-colors hover:bg-[#E67C00] active:scale-95 disabled:cursor-not-allowed disabled:opacity-75"
              >
                <MousePointer2 size={16} strokeWidth={2} />
                {controlStatus === 'pending' ? 'Waiting For Approval…' : 'Request Control'}
              </button>
            )}
            <button
              type="button"
              title={lockOnEnd ? 'End Session (Locks Remote Device)' : 'End Session'}
              onClick={() => {
                // The element-fullscreen fallback (used when Electron window
                // fullscreen is unavailable) puts only the video container on
                // screen, where the confirm dialog would be invisible.
                if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
                setShowDisconnectConfirm(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#FF383C] px-4 text-[13px] font-semibold text-white shadow-2xl transition-colors hover:bg-[#E62E32] active:scale-95"
            >
              <MonitorOff size={16} strokeWidth={2} />
              Disconnect
            </button>
          </div>
        )}
        {(isRecording || hasUnsavedRecording) && (
          <div className="pointer-events-auto absolute right-4 top-4 z-[105] flex items-center gap-3 rounded-full bg-black/80 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
            {isRecording && (
              <>
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#FF2D55] animate-pulse" />
                <span className="text-[13px] font-medium leading-none tabular-nums">{formatDuration(recordingElapsed)}</span>
                <button
                  type="button"
                  onClick={onStopRecording}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[12px] font-medium leading-none text-white transition hover:bg-white/25"
                >
                  <CircleDot size={14} /> Stop Recording
                </button>
              </>
            )}
            {hasUnsavedRecording && (
              <>
                <span className="text-[13px] font-medium leading-none text-white/70">Recording Ready</span>
                <button
                  type="button"
                  onClick={onSaveRecording}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-[#FF8A00] px-3 text-[12px] font-semibold leading-none text-white transition hover:brightness-105"
                >
                  <DownloadCloud size={14} /> Save Recording
                </button>
                <button
                  type="button"
                  onClick={onDiscardRecording}
                  title="Discard Recording"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        )}
        {showRemoteCursor && (!remoteCursor?.cursorType || remoteCursor.cursorType === 'default') && (
          // Position is driven imperatively above (instant, follows the local mouse).
          <div
            ref={cursorElRef}
            className="pointer-events-none absolute left-0 top-0 z-[95] -translate-x-[3px] -translate-y-[2px] opacity-0 drop-shadow"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 2.5l13.5 6.8-6 1.4-3.2 6.3L5 2.5z" fill="#ffffff" stroke="#111315" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {refreshing && (
          <div className="pointer-events-none absolute inset-0 z-[96] flex items-center justify-center bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-150">
            <div className="flex items-center gap-3 rounded-full bg-white/95 px-5 py-3 shadow-2xl">
              <RefreshCw size={18} className="animate-spin text-[#FF8A00]" />
              <span className="text-[13px] font-medium text-[#111315]">Refreshing Screen…</span>
            </div>
          </div>
        )}
        {showWhiteboard && (
          <div className="absolute inset-0 z-[90] bg-white/75">
            <canvas
              ref={whiteboardRef}
              className="h-full w-full touch-none cursor-crosshair"
              onPointerDown={startWhiteboardDraw}
              onPointerMove={moveWhiteboardDraw}
              onPointerUp={stopWhiteboardDraw}
              onPointerCancel={stopWhiteboardDraw}
            />
            {whiteboardTextInput && (
              <input
                autoFocus
                type="text"
                placeholder="Type Text…"
                className="absolute z-[100] min-w-[150px] rounded border border-[#FF8A00] bg-white px-2 py-1 text-[18px] font-semibold text-[#111315] shadow-lg outline-none"
                // Same font as the committed canvas text (600 18px), offset so the
                // typed text sits where fillText will draw it: 8px padding + 1px
                // border to the left, ~14px ascent + 4px padding + 1px border above.
                style={{ left: Math.max(0, whiteboardTextInput.x - 9), top: Math.max(0, whiteboardTextInput.y - 19) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitWhiteboardText((e.target as HTMLInputElement).value); }
                  else if (e.key === 'Escape') { e.preventDefault(); cancelWhiteboardText(); }
                }}
                onBlur={(e) => commitWhiteboardText(e.currentTarget.value)}
              />
            )}
            <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-[999px] bg-white px-4 py-2.5 shadow-2xl">
              {[
                { id: 'pen', icon: <PencilLine size={20} />, label: 'Pen' },
                { id: 'marker', icon: <PencilLine size={20} />, label: 'Marker' },
                { id: 'eraser', icon: <Eraser size={20} />, label: 'Eraser' },
                { id: 'rect', icon: <Square size={20} />, label: 'Rectangle' },
                { id: 'circle', icon: <Circle size={20} />, label: 'Circle' },
                { id: 'text', icon: <Type size={20} />, label: 'Text' },
              ].map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  title={tool.label}
                  onClick={() => setWhiteboardTool(tool.id as any)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    whiteboardTool === tool.id ? 'bg-[#FF8A00] text-white' : 'text-[#111315] hover:bg-[#111315]/10'
                  }`}
                >
                  {tool.icon}
                </button>
              ))}
              <input
                type="color"
                value={whiteboardColor}
                onChange={(event) => setWhiteboardColor(event.target.value)}
                title="Color"
                className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              <button type="button" onClick={() => clearWhiteboard()} className="rounded-full px-3 py-2 text-[12px] font-semibold text-[#111315] hover:bg-[#111315]/10">
                Clear
              </button>
              <button type="button" onClick={() => setShowWhiteboard(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF383C]/10 text-[#FF383C]">
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        <ViewerCameraDock deviceName={deviceName} />
        <MeetingPreviewModal
          open={cameraConsentOpen}
          busy={cameraStarting}
          title="Share Your Camera"
          confirmLabel="Share Camera"
          note={`Only ${deviceName || 'the remote computer'} will see and hear this`}
          // Playback happens on the far end, so a local speaker picker here
          // would control nothing.
          showSpeaker={false}
          prefKeys={SESSION_CAMERA_PREF_KEYS}
          onCancel={() => setCameraConsentOpen(false)}
          onConfirm={() => { void confirmCameraConsent(); }}
        />
        <FileTransferToasts
          deviceName={(deviceName || 'the remote computer').trim()}
          onCancel={(id) => transferEngine().cancel(id)}
          onDismiss={(id) => transferEngine().dismiss(id)}
        />
      </div>

      {/* Bottom toolbar */}
      <div
        ref={barRef}
        className={`flex flex-wrap items-end justify-between gap-4 px-4 pb-4 transition-transform duration-300 ease-out sm:px-6 ${
          toolbarCollapsed
            ? 'pointer-events-none absolute inset-x-0 bottom-0 z-[80] translate-y-[calc(100%+18px)]'
            : 'relative flex-shrink-0 translate-y-0'
        }`}
      >
        {/* Action menus */}
        <div className="flex items-center">
          {menus.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenSubmenu(null);
                  setOpenMenu((current) => (current === menu.id ? null : menu.id));
                }}
                className={`flex h-10 items-center gap-2 rounded px-4 text-[14px] font-medium leading-5 transition-colors ${
                  openMenu === menu.id ? 'bg-white/10 text-white' : 'text-white/90 hover:bg-white/5 hover:text-white'
                }`}
              >
                {menu.label}
                <ChevronDown size={14} className={`transition-transform ${openMenu === menu.id ? 'rotate-180' : ''}`} />
              </button>
              {openMenu === menu.id && (
                <div
                  className={
                    menu.id === 'actions'
                      ? 'absolute bottom-full left-0 z-50 mb-2 flex w-[181px] flex-col items-start rounded bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150'
                      : menu.id === 'collaboration'
                        ? 'absolute bottom-full left-0 z-50 mb-2 flex w-[200px] flex-col items-start rounded bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150'
                      : menu.id === 'tools'
                        ? 'absolute bottom-full left-0 z-50 mb-2 flex w-[181px] flex-col items-start rounded bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150'
                      : menu.id === 'view'
                        ? 'absolute bottom-full left-0 z-50 mb-2 flex w-[181px] flex-col items-start rounded bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150'
                      : menu.id === 'macros'
                        ? 'absolute bottom-full left-0 z-50 mb-2 flex w-[220px] flex-col items-start rounded bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150'
                      : 'absolute bottom-full left-0 z-50 mb-2 w-[250px] rounded-xl border border-white/10 bg-[#23262B] py-1.5 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150'
                  }
                >
                  {renderMenuItems(menu.items, true, menu.id === 'actions' || menu.id === 'collaboration' || menu.id === 'tools' || menu.id === 'view' || menu.id === 'macros', menu.id)}
                </div>
              )}
            </div>
          ))}

          {/* Participants panel */}
          {openMenu === 'participants' && (
            <div className="absolute bottom-full left-4 z-50 mb-2 w-[280px] rounded-xl border border-black/10 bg-white p-4 text-[#111315] shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150">
              <h3 className="m-0 mb-3 text-[13px] font-semibold text-[#111315]">Participants</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF8A00]/15 text-[11px] font-semibold text-[#9A5400]">
                    {(user?.name || 'You').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-medium text-[#111315]">{user?.name || 'You'}</p>
                    <p className="m-0 text-[11px] text-[#111315]/55">{controlStatus === 'granted' ? 'In Control' : 'Viewing'}</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-[#34C759]" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F2F5] text-[#111315]/60">
                    {isMobileDevice ? <Smartphone size={14} /> : <Monitor size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-medium text-[#111315]">{deviceName || 'Remote Device'}</p>
                    <p className="m-0 text-[11px] text-[#111315]/55">Host - Sharing Screen</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-[#34C759]" />
                </div>
              </div>
              <button
                type="button"
                onClick={copyInviteLink}
                disabled={!sessionCode}
                className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#F0F2F5] text-[12px] font-medium text-[#111315] transition-colors hover:bg-[#E6E8EC] disabled:opacity-40"
              >
                {inviteCopied ? <Check size={14} className="text-[#34C759]" /> : <UserPlus size={14} />}
                {inviteCopied ? 'Invite Link Copied' : 'Copy Invite Link'}
              </button>
            </div>
          )}

          {/* Session notes panel */}
          {openMenu === 'notes' && (
            <div className="absolute bottom-full left-4 z-50 mb-2 w-[320px] rounded-xl border border-black/10 bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150">
              <h3 className="m-0 mb-1 text-[13px] font-semibold text-[#111315]">Session Notes</h3>
              <p className="m-0 mb-3 text-[11px] text-[#111315]/55">Saved on this device for {deviceName || 'this session'}.</p>
              <textarea
                autoFocus
                value={notes}
                onChange={(event) => saveNotes(event.target.value)}
                placeholder="Type Your Notes…"
                className="h-[120px] w-full resize-none rounded-lg border border-black/10 bg-[#F9FAFB] p-3 text-[13px] text-[#111315] outline-none placeholder:text-[#111315]/35 focus:border-[#FF8A00]"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-[#111315]/40">Saved Automatically</span>
                <button
                  type="button"
                  onClick={() => setOpenMenu(null)}
                  className="rounded-lg bg-[#111315] px-4 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Connection info panel */}
          {openMenu === 'connection-info' && (
            <div className="absolute bottom-full left-4 z-50 mb-2 w-[260px] rounded-xl border border-black/10 bg-white p-4 text-[#111315] shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150">
              <h3 className="m-0 mb-3 text-[13px] font-semibold text-[#111315]">Connection Info</h3>
              {connectionHealth ? (
                <div className="flex flex-col gap-2 text-[12px]">
                  <div className="flex items-center justify-between"><span className="text-[#111315]/55">Round-Trip Time</span><span className="font-medium tabular-nums">{connectionHealth.rttMs}ms</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#111315]/55">Packet Loss</span><span className="font-medium tabular-nums">{connectionHealth.lossPct}%</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#111315]/55">Decoded FPS</span><span className="font-medium tabular-nums">{connectionHealth.fps}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#111315]/55">Quality Mode</span><span className="font-medium capitalize">{qualityMode}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#111315]/55">Display Mode</span><span className="font-medium capitalize">{scaleMode}</span></div>
                </div>
              ) : (
                <p className="m-0 text-[12px] text-[#111315]/55">Waiting for the first stats sample…</p>
              )}
              {connectionHealth && onBoostConnection && (connectionHealth.rttMs >= 60 || connectionHealth.lossPct >= 1) && (
                <button
                  type="button"
                  onClick={onBoostConnection}
                  className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#FF8A00] text-[12px] font-medium text-white transition-colors hover:brightness-105"
                >
                  Boost Connection
                </button>
              )}
            </div>
          )}

          {/* Session recap panel */}
          {openMenu === 'recap' && (
            <div className="absolute bottom-full left-4 z-50 mb-2 w-[320px] rounded-xl border border-black/10 bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150">
              <h3 className="m-0 mb-1 text-[13px] font-semibold text-[#111315]">Session Recap</h3>
              <p className="m-0 mb-3 text-[11px] text-[#111315]/55">A running log of what happened this session — share it with a teammate.</p>
              {sessionLog.length ? (
                <div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto pr-1">
                  {sessionLog.slice().reverse().map((entry, index) => (
                    <div key={`${entry.time}-${index}`} className="flex items-start gap-2 text-[12px]">
                      <span className="mt-0.5 flex-shrink-0 text-[10px] font-mono text-[#111315]/40">{new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[#111315]/80">{entry.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[12px] text-[#111315]/40">Nothing logged yet — actions like screenshots, recordings, and macros will show up here.</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-[#111315]/40">Local To This Device Only</span>
                <button
                  type="button"
                  onClick={copyRecap}
                  disabled={!sessionLog.length}
                  className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#F0F2F5] px-3 text-[12px] font-medium text-[#111315] transition-colors hover:bg-[#E6E8EC] disabled:opacity-40"
                >
                  {recapCopied ? <Check size={14} className="text-[#34C759]" /> : <Copy size={14} />}
                  {recapCopied ? 'Copied' : 'Copy Recap'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick-action pill. Width is content-driven: a fixed 360px clipped the
            trailing hide-toolbar chevron once Disconnect grew a text label. */}
        <div ref={quickPillRef} className="relative flex h-16 w-auto flex-none items-center gap-3 rounded-[53px] bg-white px-5 py-2.5">
          {quickHint && (
            <div
              className="pointer-events-none absolute bottom-[calc(100%+10px)] z-[160] -translate-x-1/2 whitespace-nowrap rounded-md bg-[#FFB347] px-4 py-2 text-[14px] font-medium leading-5 text-[#111315] shadow-xl"
              style={{ left: quickHint.left }}
            >
              {quickHint.label}
            </div>
          )}
          {!isMobileDevice && (
            <>
              <button
                type="button"
                aria-label="Send files"
                onClick={() => { void sendFiles(); }}
                onMouseEnter={showQuickHint('Send files')}
                onMouseLeave={hideQuickHint('Send files')}
                className={`${quickPillButton} h-11 w-11 rounded-full text-[#FF8A00]`}
              >
                <UploadCloud size={20} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Get files"
                onClick={getFiles}
                onMouseEnter={showQuickHint('Get files')}
                onMouseLeave={hideQuickHint('Get files')}
                className={`${quickPillButton} h-11 w-11 rounded-full text-[#FF8A00]`}
              >
                <DownloadCloud size={20} strokeWidth={1.5} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setShowWhiteboard(true); }}
            onMouseEnter={showQuickHint('Whiteboard')}
            onMouseLeave={hideQuickHint('Whiteboard')}
            className={`${quickPillButton} h-11 w-11 rounded-full ${showWhiteboard ? 'bg-[#FFE7E7]' : ''}`}
          >
            <PencilLine size={24} strokeWidth={1.8} />
          </button>
          {/* Camera. A face-to-face toggle belongs where it can be found in one
              glance, not three levels into a menu. */}
          <button
            type="button"
            disabled={!isViewerCameraSupported()}
            onClick={toggleCamera}
            onMouseEnter={showQuickHint(cameraOn ? 'Turn My Camera Off' : 'Show My Camera To Them')}
            onMouseLeave={hideQuickHint(cameraOn ? 'Turn My Camera Off' : 'Show My Camera To Them')}
            className={`${quickPillButton} h-11 w-11 rounded-full disabled:opacity-35 ${cameraOn ? 'bg-[#FFE7E7] text-[#FF8A00]' : ''}`}
          >
            {cameraOn ? <VideoOff size={22} strokeWidth={1.6} /> : <Video size={22} strokeWidth={1.6} />}
          </button>

          {/* Keyboard shortcuts popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu((current) => (current === 'keyboard' ? null : 'keyboard'))}
              onMouseEnter={showQuickHint('Send Keyboard Shortcut')}
              onMouseLeave={hideQuickHint('Send Keyboard Shortcut')}
              className={`${quickPillButton} h-11 w-11 rounded-full ${openMenu === 'keyboard' ? 'bg-[#FFE7E7]' : ''}`}
            >
              <Keyboard size={24} strokeWidth={1.5} />
            </button>
            {openMenu === 'keyboard' && (
              <div className="absolute bottom-full right-0 z-50 mb-3 w-[230px] overflow-hidden rounded-xl border border-black/5 bg-white py-1.5 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150">
                {renderMenuItems(keyboardItems, false)}
              </div>
            )}
          </div>

          {/* Chat with the person at the host machine */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setChatOpen((open) => { const next = !open; if (next) setChatUnread(0); return next; })}
              onMouseEnter={showQuickHint('Chat With Remote User')}
              onMouseLeave={hideQuickHint('Chat With Remote User')}
              className={`${quickPillButton} relative h-11 w-11 rounded-full ${chatOpen ? 'bg-[#FFE7E7]' : ''}`}
            >
              <MessageSquare size={22} strokeWidth={1.6} />
              {chatUnread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF383C] px-1 text-[9px] font-bold leading-none text-white">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
            {chatOpen && (
              <div className="absolute bottom-[calc(100%+14px)] right-0 z-50 flex h-[460px] max-h-[70vh] w-[380px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-150">
                <div className="flex h-10 flex-none items-center justify-between border-b border-black/5 px-3">
                  <span className="truncate text-[13px] font-semibold text-[#111315]">Chat — {deviceName || 'Remote Device'}</span>
                  <button type="button" onClick={() => setChatOpen(false)} className="flex h-6 w-6 flex-none items-center justify-center text-[#111315] transition hover:opacity-70">
                    <X size={16} />
                  </button>
                </div>
                <div ref={chatListRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto bg-[#F9FAFB] p-3">
                  {chatMessages.length === 0 && (
                    <p className="m-0 text-center text-[11px] leading-4 text-[#111315]/40">
                      Messages appear on {deviceName || 'the remote PC'} next to the Remote365 dock.
                    </p>
                  )}
                  {chatMessages.map((message, index) => (
                    <div
                      key={`${message.at}-${index}`}
                      className={`max-w-[82%] rounded-lg px-3 py-2 text-[13px] leading-[18px] text-[#111315] ${message.mine ? 'self-end bg-[#FFE9D2]' : 'self-start border border-black/5 bg-white'}`}
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
                    placeholder="Type A Message…"
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
            onClick={onToggleAudio}
            disabled={!remoteAudioTrackCount && !remoteAudioEnabled}
            title={remoteAudioEnabled
              ? 'Mute audio from the host machine (only for you)'
              : remoteAudioTrackCount
                ? 'Play Audio From The Host Machine'
                : 'The host stream has no audio track'}
            className={`${quickPillButton} h-[22px] w-[22px] disabled:cursor-default disabled:opacity-35`}
          >
            {remoteAudioEnabled ? <Volume2 size={22} strokeWidth={2.1} /> : <VolumeX size={22} strokeWidth={2.1} />}
          </button>

          {onToggleTalk && (
            <button
              type="button"
              onClick={onToggleTalk}
              title={talkActive
                ? 'Stop talking — the remote machine stops hearing your microphone'
                : 'Talk to the remote machine (send your microphone)'}
              className={`${quickPillButton} h-[22px] w-[22px] ${talkActive ? 'text-emerald-400' : ''}`}
            >
              {talkActive ? <Mic size={22} strokeWidth={2.1} /> : <MicOff size={22} strokeWidth={2.1} />}
            </button>
          )}

          <div className="flex h-11 w-auto flex-none items-center gap-4">
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className={`${quickPillButton} h-[22px] w-[22px]`}
            >
              {isFullScreen ? <Minimize2 size={22} strokeWidth={2.1} /> : <Maximize2 size={22} strokeWidth={2.1} />}
            </button>
            <button
              type="button"
              onClick={() => setShowDisconnectConfirm(true)}
              title={lockOnEnd ? 'End Session (Locks Remote Device)' : 'End Session'}
              className="flex h-11 flex-none items-center justify-center whitespace-nowrap rounded-[34px] bg-[#FF383C] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#E62E32] active:scale-95"
            >
              Disconnect
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  setOpenSubmenu(null);
                  setToolbarCollapsed(true);
                }}
                title="Hide Toolbar"
                className="flex h-[22px] w-[22px] items-center justify-center text-[#111315] transition-transform hover:scale-105 active:scale-95"
              >
                <ChevronDown size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {toolbarCollapsed && (
        <button
          type="button"
          onClick={() => setToolbarCollapsed(false)}
          title="Show Toolbar"
          className="absolute bottom-3 right-0 z-[120] flex h-11 w-12 items-center justify-center rounded-l-2xl rounded-r-none bg-white pr-1 text-[#111315] shadow-2xl transition hover:bg-[#F6F7F8] active:scale-95"
        >
          <ChevronDown size={22} className="rotate-180" />
        </button>
      )}

      <Modal open={Boolean(pendingConfirmation)} onClose={() => setPendingConfirmation(null)} className="z-[240] bg-black/45 p-6">
        <div className="relative flex w-full max-w-[468px] flex-col items-start gap-[22px] rounded-xl bg-white px-6 py-3 text-[#111315] shadow-2xl">
          <div className="flex h-11 w-full items-center justify-between gap-[22px]">
            <h2 className="m-0 flex-1 text-[24px] font-bold leading-[34px] text-[#111315]">
              {pendingConfirmation?.title}
            </h2>
            <button
              type="button"
              aria-label="Close Remote Action Confirmation"
              onClick={() => setPendingConfirmation(null)}
              className="flex h-6 w-6 flex-none items-center justify-center text-[#111315] transition hover:opacity-70"
            >
              <X size={24} strokeWidth={2.4} />
            </button>
          </div>
          <div className="flex w-full flex-col items-start gap-[22px]">
            <div>
              <p className="m-0 text-[14px] font-normal leading-5 text-[#111315]">
                {pendingConfirmation?.message}
              </p>
              <p className="m-0 mt-2 text-[12px] leading-4 text-[#111315]/55">
                {pendingConfirmation?.detail}
              </p>
            </div>
            <div className="flex w-full justify-end">
              <div className="flex h-10 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirmation(null)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={runPendingConfirmation}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 text-[14px] font-medium leading-5 text-[#111315] transition hover:brightness-105"
                >
                  {pendingConfirmation?.confirmLabel || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Disconnect confirmation */}
      <Modal open={showDisconnectConfirm} onClose={() => setShowDisconnectConfirm(false)} className="z-[240] bg-black/45 p-6">
        <div className="relative flex w-full max-w-[468px] flex-col items-start gap-[22px] rounded-xl bg-white px-6 py-3 text-[#111315] shadow-2xl">
          <div className="flex h-11 w-full items-center justify-between gap-[22px]">
            <h2 className="m-0 flex-1 text-[24px] font-bold leading-[34px] text-[#111315]">Disconnect Session?</h2>
            <button
              type="button"
              aria-label="Close Disconnect Confirmation"
              onClick={() => setShowDisconnectConfirm(false)}
              className="flex h-6 w-6 flex-none items-center justify-center text-[#111315] transition hover:opacity-70"
            >
              <X size={24} strokeWidth={2.4} />
            </button>
          </div>
          <div className="flex w-full flex-col items-start gap-[22px]">
            <div>
              <p className="m-0 text-[14px] font-normal leading-5 text-[#111315]">
                You are about to end the session with {deviceName || 'the remote device'}.
              </p>
              <p className="m-0 mt-2 text-[12px] leading-4 text-[#111315]/55">
                {lockOnEnd
                  ? 'The remote device will be locked as you leave.'
                  : 'You can reconnect at any time from your device list.'}
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
                  onClick={() => { setShowDisconnectConfirm(false); handleDisconnect(); }}
                  className="flex h-10 w-[124px] items-center justify-center rounded-[32px] bg-[#FF383C] px-4 text-[14px] font-medium leading-5 text-white transition hover:bg-[#E62E32]"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
