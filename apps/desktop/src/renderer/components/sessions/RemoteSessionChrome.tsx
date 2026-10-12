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
  Columns2,
  SlidersHorizontal,
  Gauge,
  FolderUp,
  Clipboard,
  ClipboardPaste,
  Wrench,
  MoreHorizontal,
  ChevronUp,
  Info,
  Image as ImageIcon,
  Headphones,
  Zap,
  Sparkles,
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
  /** Draw `checked` as an on/off switch instead of a check mark. */
  toggle?: boolean;
}

// The session dock colours each control by what it is for, so the group a
// button belongs to reads before its icon does: the picture (orange, the brand
// colour), moving things across (blue), talking (green), driving the remote
// machine (violet), everything else (grey). Red is kept for Disconnect alone.
const DOCK_TONES = {
  view: '#F5A04A',
  transfer: '#5AA9F0',
  talk: '#4CC38A',
  control: '#B49AF0',
  more: '#A9ABB3',
} as const;
type DockTone = keyof typeof DOCK_TONES;

interface DockSection {
  title?: string;
  items: MenuItem[];
}

/** What the host says its stream is doing (frame rate, screens). */
interface HostStreamState {
  fps: number;
  fpsPinned: number | null;
  fpsMax: number;
  displays: { id: number | string; label: string; width: number; height: number; primary: boolean }[];
  displayId: number | string | null;
}

const FRAME_RATES = [10, 15, 24, 30, 45, 60, 75, 90, 120];

const DockSwitch: React.FC<{ on?: boolean }> = ({ on }) => (
  <span className={`relative inline-flex h-[16px] w-[28px] flex-shrink-0 items-center rounded-full transition-colors ${on ? 'bg-[#F58A1F]' : 'bg-[#3A3B42]'}`}>
    <span className={`absolute h-[12px] w-[12px] rounded-full bg-white transition-transform ${on ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
  </span>
);

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

/**
 * Charcoal session chrome shown while viewing a remote device.
 * Renders the live screen (children) and, under it, a slim dock: one row of
 * icon buttons grouped and coloured by function, each opening its menu above
 * the dock. Every control maps to a command the host
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
  const [qualityMode, setQualityMode] = useState<'auto' | 'speed' | 'quality'>(isMobileDevice ? 'auto' : 'quality');
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
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  // Frame rate and screen list as the host reports them. null until the host
  // says anything, which an older host never does: its Display and Multi
  // monitor menus then explain that instead of offering buttons that do nothing.
  const [streamState, setStreamState] = useState<HostStreamState | null>(null);
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
    const unsubscribeStreamState = subscribeControlJson((data) => {
      if (data?.type !== 'stream-state') return false;
      setStreamState({
        fps: Number(data.fps) || 0,
        fpsPinned: Number(data.fpsPinned) > 0 ? Number(data.fpsPinned) : null,
        fpsMax: Number(data.fpsMax) || 30,
        displays: Array.isArray(data.displays) ? data.displays : [],
        displayId: data.displayId ?? null,
      });
      return true;
    });
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
      unsubscribeStreamState();
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

  // A session to a computer opens on "Optimal quality" at 24 fps, and the
  // viewer can still pick anything else from Quality and Display. Sent
  // once per session. The remote side still steps below the chosen quality
  // when the link cannot carry it. Phones keep their own defaults.
  const defaultsSentRef = useRef({ quality: false, fps: false });
  useEffect(() => {
    if (isMobileDevice || !hasReceivedKeyframe || defaultsSentRef.current.quality) return;
    defaultsSentRef.current.quality = true;
    onControlEvent({ type: 'stream-quality', mode: 'quality', reason: 'user' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasReceivedKeyframe, isMobileDevice]);
  useEffect(() => {
    if (isMobileDevice || !streamState || defaultsSentRef.current.fps) return;
    defaultsSentRef.current.fps = true;
    if (!streamState.fpsPinned) onControlEvent({ type: 'stream-fps', fps: 24 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamState, isMobileDevice]);

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

  const pickQuality = (mode: 'auto' | 'speed' | 'quality') => {
    setQualityMode(mode);
    // reason:'user' pins the host encoder; the bandwidth auto-tuner stands down
    // until the viewer chooses "Auto select" again.
    onControlEvent({ type: 'stream-quality', mode, reason: 'user' });
  };
  const handleRefresh = () => {
    setRefreshing(true);
    onRefreshStream();
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => setRefreshing(false), 1100);
  };
  const pickFrameRate = (fps: number | 'auto') => {
    onControlEvent({ type: 'stream-fps', fps });
    logEvent(fps === 'auto' ? 'Set Frame Rate To Auto' : `Set Frame Rate To ${fps} fps`);
  };
  const pickDisplay = (id: number | string) => {
    if (controlStatus !== 'granted') {
      toast.info('Switching screens needs control of the session.', 5000);
      return;
    }
    onControlEvent({ type: 'stream-display', id });
    setOpenMenu(null);
  };

  const runItem = (item: MenuItem) => {
    if (item.disabled) return;
    item.onClick?.();
    if (!item.keepOpen) {
      setOpenMenu(null);
      setOpenSubmenu(null);
    }
  };

  // ---- Dock menus. Each maps to a command the target platform can execute.
  const screenSections: DockSection[] = [
    {
      items: [
        {
          label: controlStatus === 'pending' ? 'Requesting control…' : 'Request control',
          icon: <MousePointer2 size={15} />,
          onClick: onRequestControl,
          hidden: controlStatus === 'granted',
          disabled: controlStatus === 'pending',
        },
        {
          label: isFullScreen ? 'Exit full screen' : 'Full screen',
          icon: isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />,
          onClick: onToggleFullscreen,
        },
        {
          label: 'Take screenshot',
          icon: <Camera size={15} />,
          onClick: () => { onTakeScreenshot(); logEvent('Took A Screenshot'); },
          disabled: !hasReceivedKeyframe,
        },
        {
          label: isRecording ? 'Recording, see top right' : hasUnsavedRecording ? 'Recording ready, see top right' : 'Record session',
          icon: <CircleDot size={15} className={isRecording ? 'text-[#FF2D55]' : undefined} />,
          onClick: onStartRecording,
          disabled: !hasReceivedKeyframe || isRecording || Boolean(hasUnsavedRecording),
          hidden: !recordingAllowed,
        },
      ],
    },
  ];

  const scalingSection: DockSection = {
    title: 'Scaling',
    items: [
      { label: 'Best fit', icon: <Monitor size={15} />, checked: scaleMode === 'fit', keepOpen: true, onClick: () => onSetScaleMode('fit') },
      { label: 'Actual size', icon: <Search size={15} />, checked: scaleMode === 'actual', keepOpen: true, onClick: () => onSetScaleMode('actual') },
      { label: 'Fill screen', icon: <Scaling size={15} />, checked: scaleMode === 'fill', keepOpen: true, onClick: () => onSetScaleMode('fill') },
    ],
  };
  const displayExtras: DockSection = {
    items: [
      {
        label: 'Show remote cursor',
        icon: <MousePointer2 size={15} />,
        checked: showRemoteCursor,
        toggle: true,
        keepOpen: true,
        onClick: () => setShowRemoteCursor((value) => !value),
      },
      { label: 'Refresh screen', icon: <RefreshCw size={15} />, onClick: handleRefresh },
    ],
  };

  const qualitySections: DockSection[] = [
    {
      items: [
        { label: 'Auto select', hint: 'follows the link', icon: <Sparkles size={15} />, checked: qualityMode === 'auto', keepOpen: true, onClick: () => pickQuality('auto') },
        { label: 'Optimal speed', hint: 'responsive', icon: <Zap size={15} />, checked: qualityMode === 'speed', keepOpen: true, onClick: () => pickQuality('speed') },
        { label: 'Optimal quality', hint: 'sharp', icon: <Monitor size={15} />, checked: qualityMode === 'quality', keepOpen: true, onClick: () => pickQuality('quality') },
      ],
    },
  ];

  const fileSections: DockSection[] = [
    {
      items: [
        { label: 'Send files', hint: 'to remote', icon: <UploadCloud size={15} />, onClick: () => { void sendFiles(); } },
        { label: 'Get files', hint: 'from remote', icon: <DownloadCloud size={15} />, onClick: getFiles },
        { label: 'File explorer', hint: 'Win+E', icon: <Folder size={15} />, onClick: action('explorer') },
      ],
    },
  ];

  const clipboardSections: DockSection[] = [
    {
      items: [
        {
          label: 'Sync automatically',
          icon: <Copy size={15} />,
          checked: clipboardSync,
          toggle: true,
          keepOpen: true,
          onClick: () => setClipboardSync(!clipboardSync),
        },
        { label: 'Paste as keystrokes', icon: <ClipboardPaste size={15} />, onClick: onPasteClipboard },
      ],
    },
  ];

  const audioSections: DockSection[] = [
    {
      items: [
        {
          label: remoteAudioTrackCount || remoteAudioEnabled ? 'Listen to remote sound' : 'No remote sound',
          icon: remoteAudioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />,
          checked: remoteAudioEnabled,
          toggle: true,
          keepOpen: true,
          disabled: !remoteAudioTrackCount && !remoteAudioEnabled,
          onClick: onToggleAudio,
        },
        {
          label: 'Talk',
          hint: 'your microphone',
          icon: talkActive ? <Mic size={15} /> : <MicOff size={15} />,
          checked: Boolean(talkActive),
          toggle: true,
          keepOpen: true,
          hidden: !onToggleTalk,
          onClick: () => onToggleTalk?.(),
        },
        {
          label: 'Share camera',
          icon: cameraOn ? <Video size={15} /> : <VideoOff size={15} />,
          checked: cameraOn,
          toggle: true,
          disabled: !isViewerCameraSupported(),
          onClick: toggleCamera,
        },
      ],
    },
  ];

  const toolsSections: DockSection[] = isMobileDevice
    ? [
        {
          title: 'Navigate',
          items: [
            { label: 'Home screen', icon: <Home size={15} />, keepOpen: true, onClick: action('home') },
            { label: 'Recent apps', icon: <LayoutGrid size={15} />, keepOpen: true, onClick: action('recents') },
            { label: 'Back', icon: <ArrowLeftRight size={15} />, keepOpen: true, onClick: globalAction(1) },
            { label: 'Notifications', icon: <Bell size={15} />, onClick: shortcut('notifications') },
            { label: 'Quick settings', hint: 'tile shade', icon: <Sliders size={15} />, onClick: action('quick_settings') },
          ],
        },
        {
          title: 'Screen',
          items: [
            { label: 'Wake phone', icon: <Sun size={15} />, onClick: () => onControlEvent({ type: 'wake' }) },
            { label: 'Rotate left', icon: <RotateCcw size={15} />, keepOpen: true, onClick: action('rotate_left') },
            { label: 'Rotate right', icon: <RotateCw size={15} />, keepOpen: true, onClick: action('rotate_right') },
            { label: 'Portrait', icon: <Smartphone size={15} />, keepOpen: true, onClick: action('rotate_portrait') },
            { label: 'Landscape', icon: <Monitor size={15} />, keepOpen: true, onClick: action('rotate_landscape') },
            { label: 'Auto-rotate', icon: <RefreshCw size={15} />, keepOpen: true, onClick: action('rotate_auto') },
            { label: 'Whiteboard', icon: <PencilLine size={15} />, onClick: () => { setShowWhiteboard(true); } },
          ],
        },
        {
          title: 'Sound and network',
          items: [
            // keepOpen: nudging volume is repetitive.
            { label: 'Volume up', icon: <Volume2 size={15} />, keepOpen: true, onClick: action('volume_up') },
            { label: 'Volume down', icon: <Volume1 size={15} />, keepOpen: true, onClick: action('volume_down') },
            // Android has blocked third-party apps from flipping Wi-Fi and
            // mobile data since Android 10, so these open the system panel
            // that holds the real switch — tap it with remote control.
            { label: 'Wi-Fi', hint: 'opens settings', icon: <Wifi size={15} />, onClick: action('connectivity_wifi') },
            { label: 'Mobile data', hint: 'opens settings', icon: <Signal size={15} />, onClick: action('connectivity_data') },
            { label: 'Wi-Fi calling', hint: 'opens settings', icon: <PhoneCall size={15} />, onClick: action('connectivity_calling') },
            { label: 'Airplane mode', hint: 'opens settings', icon: <Plane size={15} />, onClick: action('connectivity_airplane') },
          ],
        },
        {
          title: 'Power',
          items: [
            { label: 'Lock phone', icon: <Lock size={15} />, onClick: action('lock') },
            // Android gives no app any way to power a device off (or on). The
            // system power dialog is the real ceiling: it opens on the phone
            // and Power off is one remote tap away.
            { label: 'Power menu', hint: 'restart / power off', icon: <Power size={15} />, onClick: confirmAction('reboot'), danger: true },
          ],
        },
      ]
    : [
        {
          title: 'Send keys',
          items: [
            { label: 'Ctrl + Alt + Del', hint: 'Task Manager', icon: <Keyboard size={15} />, onClick: action('task_manager') },
            { label: 'Switch window', hint: 'Alt+Tab', icon: <ArrowLeftRight size={15} />, onClick: keyCombo([0x12, 0x09]) },
            { label: 'Show desktop', hint: 'Win+D', icon: <AppWindow size={15} />, onClick: shortcut('show-desktop') },
            { label: 'Quick settings', hint: 'Win+A', icon: <Sliders size={15} />, onClick: shortcut('control-center') },
          ],
        },
        {
          title: 'Open on remote',
          items: [
            { label: 'Web browser', icon: <Globe size={15} />, onClick: action('browser') },
            { label: 'Whiteboard', icon: <PencilLine size={15} />, onClick: () => { setShowWhiteboard(true); } },
          ],
        },
        {
          title: 'Power and sign-in',
          items: [
            { label: 'Lock now', hint: 'Win+L', icon: <Lock size={15} />, onClick: action('lock') },
            {
              label: 'Lock when session ends',
              icon: <MonitorOff size={15} />,
              checked: lockOnEnd,
              toggle: true,
              keepOpen: true,
              onClick: () => setLockOnEnd((value) => !value),
            },
            { label: 'Sign out on remote', icon: <LogOut size={15} />, onClick: confirmAction('sign_out'), danger: true },
            { label: 'Safe reboot', hint: '15 s grace', icon: <RotateCcw size={15} />, onClick: confirmAction('safe_reboot') },
            { label: 'Restart now', icon: <Power size={15} />, onClick: confirmAction('reboot'), danger: true },
          ],
        },
      ];

  const moreSections: DockSection[] = [
    {
      title: 'Session',
      items: [
        { label: 'Connection info', icon: <Info size={15} />, keepOpen: true, onClick: () => setOpenMenu('connection-info') },
        { label: 'Show participants', icon: <Users size={15} />, keepOpen: true, onClick: () => setOpenMenu('participants') },
        { label: `Session recap${sessionLog.length ? ` (${sessionLog.length})` : ''}`, icon: <StickyNote size={15} />, keepOpen: true, onClick: () => setOpenMenu('recap') },
        { label: 'Leave notes', icon: <PencilLine size={15} />, keepOpen: true, onClick: () => setOpenMenu('notes') },
        { label: 'Command deck', icon: <Command size={15} />, onClick: onOpenCommandDeck },
      ],
    },
    {
      title: 'Keyboard',
      items: [
        {
          label: 'Direct keyboard mode',
          hint: directKeyboardMode ? 'raw keys' : undefined,
          icon: <Keyboard size={15} />,
          checked: directKeyboardMode,
          toggle: true,
          keepOpen: true,
          disabled: !onSetDirectKeyboardMode,
          hidden: isMobileDevice,
          onClick: () => onSetDirectKeyboardMode?.(!directKeyboardMode),
        },
        {
          label: 'Send system keys to remote',
          hint: systemKeysMode ? 'Win, Alt+Tab' : undefined,
          icon: <Keyboard size={15} />,
          checked: systemKeysMode,
          toggle: true,
          keepOpen: true,
          disabled: !onSetSystemKeysMode,
          hidden: isMobileDevice,
          onClick: () => onSetSystemKeysMode?.(!systemKeysMode),
        },
      ],
    },
    {
      items: [
        { label: 'Minimize Remote365 on remote', icon: <AppWindow size={15} />, hidden: isMobileDevice, onClick: action('minimize_host_window') },
      ],
    },
  ];

  const renderDockRows = (sections: DockSection[], tone: DockTone, divided = false) =>
    sections.map((section, index) => {
      const rows = section.items.filter((item) => !item.hidden);
      if (!rows.length) return null;
      return (
        <div key={section.title || `section-${index}`} className={index > 0 || divided ? 'mt-1 border-t border-[#2B2C31] pt-1' : ''}>
          {section.title && <p className="m-0 px-2.5 pb-1 pt-1.5 text-[11px] font-medium leading-4 text-white/40">{section.title}</p>}
          {rows.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => runItem(item)}
              className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium leading-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                item.danger ? 'text-[#FF8080] hover:bg-[#EF3B3B]/15' : 'text-white/85 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <span className="flex flex-shrink-0 items-center" style={{ color: item.danger ? undefined : DOCK_TONES[tone] }}>{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && <span className="flex-shrink-0 text-[10.5px] font-normal text-white/35">{item.hint}</span>}
              {item.toggle
                ? <DockSwitch on={item.checked} />
                : item.checked && <Check size={14} className="flex-shrink-0 text-[#F58A1F]" />}
            </button>
          ))}
        </div>
      );
    });

  const sentFps = streamState?.fps || 0;
  const frameRateBlock = (
    <div className="mt-1 border-t border-[#2B2C31] px-2.5 pb-2 pt-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium leading-4 text-white/40">Frame rate</span>
        {streamState && (
          <span className="text-[11px] leading-4 text-white/55 tabular-nums">
            Sending {sentFps} fps{connectionHealth?.fps ? `, showing ${Math.round(connectionHealth.fps)}` : ''}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {(['auto', ...FRAME_RATES] as (number | 'auto')[]).map((rate) => {
          const selected = rate === 'auto' ? !streamState?.fpsPinned : streamState?.fpsPinned === rate;
          const tooFast = typeof rate === 'number' && Boolean(streamState) && rate > (streamState?.fpsMax || 0);
          return (
            <button
              key={rate}
              type="button"
              disabled={!streamState || tooFast}
              title={tooFast ? `The remote computer's video encoder tops out at ${streamState?.fpsMax} fps` : undefined}
              onClick={() => pickFrameRate(rate)}
              className={`h-7 rounded-md border text-[12px] font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                selected && streamState
                  ? 'border-[#F58A1F] bg-[#2A1C0E] text-white'
                  : 'border-[#33343A] text-white/75 hover:border-[#4A4B52] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {rate === 'auto' ? 'Auto' : rate}
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-2 text-[11px] leading-[15px] text-white/40">
        {!streamState
          ? 'Update Remote365 on the remote computer to choose a frame rate from here.'
          : streamState.fpsPinned && streamState.fpsPinned > sentFps
            ? `The link is thin right now, so the remote computer is sending ${sentFps} fps. It returns to ${streamState.fpsPinned} when the link recovers.`
            : 'Auto follows the quality level. Higher rates feel smoother and use more bandwidth.'}
      </p>
    </div>
  );

  const monitorsBlock = !streamState ? (
    <p className="m-0 px-2.5 py-2 text-[12px] leading-[17px] text-white/55">
      Update Remote365 on the remote computer to switch between its screens from here.
    </p>
  ) : (
    <>
      <p className="m-0 px-2.5 pb-1 pt-1.5 text-[11px] font-medium leading-4 text-white/40">
        {streamState.displays.length > 1 ? 'Show this screen' : 'This computer has one screen'}
      </p>
      {streamState.displays.map((display) => (
        <button
          key={String(display.id)}
          type="button"
          onClick={() => pickDisplay(display.id)}
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium leading-4 text-white/85 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <span className="flex flex-shrink-0 items-center" style={{ color: DOCK_TONES.view }}><Monitor size={15} /></span>
          <span className="min-w-0 flex-1 truncate">{display.label}{display.primary ? ' (main)' : ''}</span>
          <span className="flex-shrink-0 text-[10.5px] font-normal text-white/35 tabular-nums">{display.width} x {display.height}</span>
          {String(display.id) === String(streamState.displayId) && <Check size={14} className="flex-shrink-0 text-[#F58A1F]" />}
        </button>
      ))}
    </>
  );

  // One entry per dock button, in display order; `gap` starts a new group.
  const dockButtons: {
    id: string;
    label: string;
    tone: DockTone;
    icon: React.ReactNode;
    width: string;
    body: React.ReactNode;
    hidden?: boolean;
    gap?: boolean;
    /** Small dot on the icon: something in this menu is switched on. */
    lit?: string | false;
  }[] = [
    {
      id: 'screen', label: 'Screen', tone: 'view', icon: <Monitor size={22} strokeWidth={1.8} />, width: 'w-[230px]',
      lit: isRecording && '#FF2D55',
      body: renderDockRows(screenSections, 'view'),
    },
    {
      id: 'monitors', label: 'Multi monitor', tone: 'view', icon: <Columns2 size={22} strokeWidth={1.8} />, width: 'w-[250px]',
      hidden: isMobileDevice,
      body: monitorsBlock,
    },
    {
      id: 'display', label: 'Display', tone: 'view', icon: <SlidersHorizontal size={22} strokeWidth={1.8} />, width: 'w-[250px]',
      body: <>{renderDockRows([scalingSection], 'view')}{!isMobileDevice && frameRateBlock}{renderDockRows([displayExtras], 'view', true)}</>,
    },
    {
      id: 'quality', label: 'Quality', tone: 'view', icon: <Gauge size={22} strokeWidth={1.8} />, width: 'w-[240px]',
      body: (
        <>
          {renderDockRows(qualitySections, 'view')}
          {connectionHealth && (
            <p className="m-0 mt-1 border-t border-[#2B2C31] px-2.5 pb-1 pt-2 text-[11px] leading-4 text-white/45 tabular-nums">
              Link now: {connectionHealth.rttMs} ms, {connectionHealth.lossPct}% loss
            </p>
          )}
        </>
      ),
    },
    {
      id: 'files', label: 'File transfer', tone: 'transfer', icon: <FolderUp size={22} strokeWidth={1.8} />, width: 'w-[230px]', gap: true,
      hidden: isMobileDevice,
      body: renderDockRows(fileSections, 'transfer'),
    },
    {
      id: 'clipboard', label: 'Clipboard', tone: 'transfer', icon: <Clipboard size={22} strokeWidth={1.8} />, width: 'w-[240px]', gap: isMobileDevice,
      body: (
        <>
          {renderDockRows(clipboardSections, 'transfer')}
          <p className="m-0 mt-1 flex items-start gap-2 border-t border-[#2B2C31] px-2.5 pb-1 pt-2 text-[11px] leading-[15px] text-white/45">
            <ImageIcon size={13} className="mt-px flex-shrink-0" style={{ color: DOCK_TONES.transfer }} />
            Images and snips copy across along with text while sync is on.
          </p>
        </>
      ),
    },
    {
      id: 'audio', label: 'Audio', tone: 'talk', icon: remoteAudioEnabled ? <Headphones size={22} strokeWidth={1.8} /> : <VolumeX size={22} strokeWidth={1.8} />, width: 'w-[240px]',
      lit: (talkActive || cameraOn) && DOCK_TONES.talk,
      body: renderDockRows(audioSections, 'talk'),
    },
    {
      id: 'tools', label: 'Tools', tone: 'control', icon: <Wrench size={22} strokeWidth={1.8} />, width: 'w-[250px]', gap: true,
      body: <div className="max-h-[min(440px,60vh)] overflow-y-auto">{renderDockRows(toolsSections, 'control')}</div>,
    },
    {
      id: 'more', label: 'More', tone: 'more', icon: <MoreHorizontal size={22} strokeWidth={1.8} />, width: 'w-[250px]',
      body: renderDockRows(moreSections, 'more'),
    },
  ];

  const dockButtonClass = (open: boolean) =>
    `relative flex h-[40px] items-center gap-1.5 rounded-[10px] border px-[9px] text-[13px] font-medium leading-none transition-colors active:scale-[0.97] ${
      open ? 'border-[#F58A1F] bg-[#2A1C0E] text-white' : 'border-transparent text-white/75 hover:bg-white/[0.08] hover:text-white'
    }`;
  const dockDivider = <span className="mx-1.5 h-6 w-px flex-none bg-[#2B2C31]" />;
  const dockPanel = 'rounded-xl border border-[#33343A] bg-[#1B1C20] text-white shadow-[0_16px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-bottom-1 duration-150';
  const dockStat = 'flex items-center justify-between';

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#1A1D21]">
      {/* Live screen */}
      <div
        className="relative mx-3 mb-2 min-h-0 flex-1 overflow-hidden bg-[#F3F4F6] sm:mx-5"
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
          <div className={`absolute right-12 z-[100] flex items-center gap-2 ${isRecording || hasUnsavedRecording ? 'top-[70px]' : 'top-4'}`}>
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
          </div>
        )}
        {/* Close the session from the corner, wherever the bar is. It asks first. */}
        <button
          type="button"
          title={lockOnEnd ? 'Close session (locks the remote device)' : 'Close session'}
          aria-label="Close session"
          onClick={() => {
            // The element-fullscreen fallback (used when Electron window
            // fullscreen is unavailable) puts only the video container on
            // screen, where the confirm dialog would be invisible.
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
            setShowDisconnectConfirm(true);
          }}
          className="absolute right-1.5 top-1.5 z-[110] flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[#EF3B3B] text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#D92F2F] active:scale-95"
        >
          <X size={16} strokeWidth={2.6} />
        </button>
        {(isRecording || hasUnsavedRecording) && (
          <div className="pointer-events-auto absolute right-12 top-4 z-[105] flex items-center gap-3 rounded-full bg-black/80 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
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

      {/* Session dock */}
      <div ref={barRef} className={`relative z-[80] flex flex-shrink-0 justify-center px-3 pb-3 ${toolbarCollapsed ? 'hidden' : ''}`}>
        <div ref={quickPillRef} className="relative flex h-[50px] items-center gap-0.5 rounded-2xl border border-[#2B2C31] bg-[#16171A] px-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          {quickHint && (
            <div
              className="pointer-events-none absolute bottom-[calc(100%+8px)] z-[160] -translate-x-1/2 whitespace-nowrap rounded-md border border-[#33343A] bg-[#0E0F11] px-2.5 py-1.5 text-[12.5px] font-medium leading-4 text-white/90 shadow-xl"
              style={{ left: quickHint.left }}
            >
              {quickHint.label}
            </div>
          )}

          {dockButtons.filter((button) => !button.hidden).map((button, index) => {
            const menuId = `dock-${button.id}`;
            const open = openMenu === menuId;
            return (
              <React.Fragment key={button.id}>
                {button.gap && index > 0 && dockDivider}
                <div className="relative">
                  <button
                    type="button"
                    aria-label={button.label}
                    aria-expanded={open}
                    onClick={() => {
                      setQuickHint(null);
                      setChatOpen(false);
                      setOpenSubmenu(null);
                      setOpenMenu((current) => (current === menuId ? null : menuId));
                    }}
                    className={dockButtonClass(open)}
                  >
                    <span className="flex items-center" style={{ color: DOCK_TONES[button.tone] }}>{button.icon}</span>
                    <span className="whitespace-nowrap pr-0.5">{button.label}</span>
                    {button.lit && <span className="absolute right-[5px] top-[5px] h-[7px] w-[7px] rounded-full" style={{ background: button.lit }} />}
                  </button>
                  {open && (
                    <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 -translate-x-1/2">
                      <div className={`${dockPanel} ${button.width} p-1.5`}>{button.body}</div>
                    </div>
                  )}
                </div>
                {/* Chat sits between Clipboard and Audio: it is its own panel, not a menu. */}
                {button.id === 'clipboard' && (
                  <>
                    {dockDivider}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Chat"
                        aria-expanded={chatOpen}
                        onClick={() => {
                          setQuickHint(null);
                          setOpenMenu(null);
                          setChatOpen((value) => { const next = !value; if (next) setChatUnread(0); return next; });
                        }}
                        className={dockButtonClass(chatOpen)}
                      >
                        <span className="flex items-center" style={{ color: DOCK_TONES.talk }}><MessageSquare size={22} strokeWidth={1.8} /></span>
                        <span className="whitespace-nowrap pr-0.5">Chat</span>
                        {chatUnread > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#EF3B3B] px-[3px] text-[9px] font-bold leading-none text-white">
                            {chatUnread > 9 ? '9+' : chatUnread}
                          </span>
                        )}
                      </button>
                      {chatOpen && (
                        <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 -translate-x-1/2">
                          <div className={`${dockPanel} flex h-[420px] max-h-[65vh] w-[340px] flex-col overflow-hidden`}>
                            <div className="flex h-10 flex-none items-center justify-between border-b border-[#2B2C31] px-3">
                              <span className="truncate text-[12.5px] font-semibold text-white">Chat with {deviceName || 'the remote computer'}</span>
                              <button type="button" aria-label="Close chat" onClick={() => setChatOpen(false)} className="flex h-6 w-6 flex-none items-center justify-center rounded text-white/60 transition hover:bg-white/10 hover:text-white">
                                <X size={15} />
                              </button>
                            </div>
                            <div ref={chatListRef} className="flex flex-1 select-text flex-col gap-1.5 overflow-y-auto p-3">
                              {chatMessages.length === 0 && (
                                <p className="m-0 text-center text-[11px] leading-4 text-white/40">
                                  Messages appear on {deviceName || 'the remote PC'} next to the Remote365 dock.
                                </p>
                              )}
                              {chatMessages.map((message, messageIndex) => (
                                <div
                                  key={`${message.at}-${messageIndex}`}
                                  className={`max-w-[82%] rounded-lg px-3 py-2 text-[12.5px] leading-[18px] ${message.mine ? 'self-end bg-[#4A2E0F] text-white' : 'self-start bg-[#26272C] text-white/90'}`}
                                >
                                  {!message.mine && <span className="block text-[10px] font-medium" style={{ color: DOCK_TONES.talk }}>{message.from}</span>}
                                  <span className="whitespace-pre-wrap break-words">{message.text}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex h-[52px] flex-none items-center gap-2 border-t border-[#2B2C31] px-2">
                              <input
                                autoFocus
                                value={chatDraft}
                                onChange={(event) => setChatDraft(event.target.value)}
                                onKeyDown={(event) => { if (event.key === 'Enter') sendChat(); }}
                                placeholder="Type a message"
                                maxLength={500}
                                className="h-9 min-w-0 flex-1 rounded-lg border border-[#33343A] bg-[#131417] px-3 text-[12.5px] text-white outline-none placeholder:text-white/30 focus:border-[#F58A1F]"
                              />
                              <button
                                type="button"
                                onClick={sendChat}
                                className="flex h-9 flex-none items-center justify-center rounded-lg bg-[#F58A1F] px-4 text-[12.5px] font-semibold text-[#16171A] transition hover:brightness-110"
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </React.Fragment>
            );
          })}

          {dockDivider}
          <button
            type="button"
            onClick={() => setShowDisconnectConfirm(true)}
            title={lockOnEnd ? 'End session (locks the remote device)' : 'End session'}
            className="ml-0.5 flex h-[29px] flex-none items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#EF3B3B] px-3 text-[12px] font-semibold leading-none text-white transition-colors hover:bg-[#D92F2F] active:scale-[0.97]"
          >
            <Power size={13} strokeWidth={2.4} />
            Disconnect
          </button>
          <button
            type="button"
            onClick={() => { setOpenMenu(null); setOpenSubmenu(null); setChatOpen(false); setToolbarCollapsed(true); }}
            title="Hide the control bar"
            aria-label="Hide the control bar"
            className="ml-1.5 flex h-[30px] w-[26px] flex-none items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Panels opened from More. They sit above the middle of the dock. */}
        {(openMenu === 'participants' || openMenu === 'notes' || openMenu === 'connection-info' || openMenu === 'recap') && (
          <div className="absolute bottom-[calc(100%+2px)] left-1/2 z-50 -translate-x-1/2">
            {openMenu === 'participants' && (
              <div className={`${dockPanel} w-[280px] p-4`}>
                <h3 className="m-0 mb-3 text-[13px] font-semibold text-white">Participants</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F58A1F]/20 text-[11px] font-semibold text-[#F5A04A]">
                      {(user?.name || 'You').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13px] font-medium text-white">{user?.name || 'You'}</p>
                      <p className="m-0 text-[11px] text-white/50">{controlStatus === 'granted' ? 'In control' : 'Viewing'}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-[#4CC38A]" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60">
                      {isMobileDevice ? <Smartphone size={14} /> : <Monitor size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13px] font-medium text-white">{deviceName || 'Remote Device'}</p>
                      <p className="m-0 text-[11px] text-white/50">Host, sharing its screen</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-[#4CC38A]" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  disabled={!sessionCode}
                  className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-[12px] font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-40"
                >
                  {inviteCopied ? <Check size={14} className="text-[#4CC38A]" /> : <UserPlus size={14} />}
                  {inviteCopied ? 'Invite link copied' : 'Copy invite link'}
                </button>
              </div>
            )}

            {openMenu === 'notes' && (
              <div className={`${dockPanel} w-[320px] p-4`}>
                <h3 className="m-0 mb-1 text-[13px] font-semibold text-white">Session notes</h3>
                <p className="m-0 mb-3 text-[11px] text-white/50">Saved on this device for {deviceName || 'this session'}.</p>
                <textarea
                  autoFocus
                  value={notes}
                  onChange={(event) => saveNotes(event.target.value)}
                  placeholder="Type your notes"
                  className="h-[120px] w-full resize-none rounded-lg border border-[#33343A] bg-[#131417] p-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#F58A1F]"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Saved automatically</span>
                  <button
                    type="button"
                    onClick={() => setOpenMenu(null)}
                    className="rounded-lg bg-[#F58A1F] px-4 py-1.5 text-[12px] font-semibold text-[#16171A] transition hover:brightness-110"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {openMenu === 'connection-info' && (
              <div className={`${dockPanel} w-[260px] p-4`}>
                <h3 className="m-0 mb-3 text-[13px] font-semibold text-white">Connection info</h3>
                {connectionHealth ? (
                  <div className="flex flex-col gap-2 text-[12px]">
                    <div className={dockStat}><span className="text-white/50">Round-trip time</span><span className="font-medium tabular-nums">{connectionHealth.rttMs} ms</span></div>
                    <div className={dockStat}><span className="text-white/50">Packet loss</span><span className="font-medium tabular-nums">{connectionHealth.lossPct}%</span></div>
                    <div className={dockStat}><span className="text-white/50">Frames shown</span><span className="font-medium tabular-nums">{connectionHealth.fps} fps</span></div>
                    {streamState && <div className={dockStat}><span className="text-white/50">Frames sent</span><span className="font-medium tabular-nums">{streamState.fps} fps{streamState.fpsPinned ? '' : ' (auto)'}</span></div>}
                    <div className={dockStat}><span className="text-white/50">Quality</span><span className="font-medium capitalize">{qualityMode}</span></div>
                    <div className={dockStat}><span className="text-white/50">Scaling</span><span className="font-medium capitalize">{scaleMode}</span></div>
                  </div>
                ) : (
                  <p className="m-0 text-[12px] text-white/50">Waiting for the first measurement.</p>
                )}
                {connectionHealth && onBoostConnection && (connectionHealth.rttMs >= 60 || connectionHealth.lossPct >= 1) && (
                  <button
                    type="button"
                    onClick={onBoostConnection}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#F58A1F] text-[12px] font-semibold text-[#16171A] transition hover:brightness-110"
                  >
                    Boost connection
                  </button>
                )}
              </div>
            )}

            {openMenu === 'recap' && (
              <div className={`${dockPanel} w-[320px] p-4`}>
                <h3 className="m-0 mb-1 text-[13px] font-semibold text-white">Session recap</h3>
                <p className="m-0 mb-3 text-[11px] text-white/50">A running log of what happened this session. Share it with a teammate.</p>
                {sessionLog.length ? (
                  <div className="flex max-h-[220px] select-text flex-col gap-2 overflow-y-auto pr-1">
                    {sessionLog.slice().reverse().map((entry, entryIndex) => (
                      <div key={`${entry.time}-${entryIndex}`} className="flex items-start gap-2 text-[12px]">
                        <span className="mt-0.5 flex-shrink-0 font-mono text-[10px] text-white/40">{new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-white/80">{entry.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="m-0 text-[12px] text-white/40">Nothing logged yet. Screenshots, recordings and setting changes show up here.</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Kept on this device only</span>
                  <button
                    type="button"
                    onClick={copyRecap}
                    disabled={!sessionLog.length}
                    className="flex h-9 items-center justify-center gap-2 rounded-lg bg-white/10 px-3 text-[12px] font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-40"
                  >
                    {recapCopied ? <Check size={14} className="text-[#4CC38A]" /> : <Copy size={14} />}
                    {recapCopied ? 'Copied' : 'Copy recap'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {toolbarCollapsed && (
        <button
          type="button"
          onClick={() => setToolbarCollapsed(false)}
          title="Show the control bar"
          aria-label="Show the control bar"
          className="absolute bottom-2 right-0 z-[120] flex h-9 w-9 items-center justify-center rounded-l-xl border border-r-0 border-[#2B2C31] bg-[#16171A] text-white/75 shadow-2xl transition hover:w-10 hover:text-white"
        >
          <ChevronUp size={18} />
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
