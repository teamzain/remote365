import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
    Activity, Monitor, Network, Video, MessageSquare, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield, Smartphone, Plus, Search, MoreVertical, CheckCircle2, X,
    RefreshCw, Eye, EyeOff, CreditCard, Power, Lock, Mail, Link, Sun, Moon, Edit2, Trash2, ShieldOff, LayoutGrid, PlusCircle, Radio, ShieldCheck, ArrowRightCircle, Check, DownloadCloud, MonitorOff, User,
    Globe, Folder, Maximize, Info, Home, ChevronLeft, ChevronRight, ChevronDown, Layers, BellDot, Command, Book, Bell, ExternalLink, HelpCircle, Keyboard, Wifi, Clock3, MinusCircle,
    MessageCircle, UserCheck, UserX, Ban, Volume2, VolumeX
} from 'lucide-react';
import waitIllustration from '../assets/wait.png';
import { RemoteSessionChrome } from './sessions/RemoteSessionChrome';
import Modal from './ui/Modal';
import api from '../lib/api';
import type { FileTransferStatus } from '../types';
import { subscribeControlJson } from '../lib/sessionControlBus';

// Recorder bitrate tiers behind the platform "Recording Quality" policy —
// MediaRecorder can't resample the incoming stream, so quality maps to the
// encode bitrate cap of the saved file.
const RECORDING_BPS: Record<string, number> = { '720p': 4_000_000, '1080p': 8_000_000, '1440p': 14_000_000 };

const CONNECTING_MESSAGES = [
    'Making Connection',
    'Starting The Screen',
    'Getting Things Ready',
    'Almost Ready',
];

type RemoteShortcutAction = {
    label: string;
    hint: string;
    detail: string;
    danger?: boolean;
    run: () => void | Promise<void>;
};

type ConfirmableRemoteAction = {
    action: 'reboot';
    title: string;
    message: string;
    confirmLabel: string;
    detail: string;
};

interface VideoPlayerProps {
    mediaActive?: boolean;
    viewerStatus: string;
    setViewerStatus: (status: any) => void;
    sessionCode: string;
    onDisconnect: () => void;
    onControlEvent: (event: any) => void;
    /** Talk-back: true while the operator's mic is streaming to the host. */
    talkActive?: boolean;
    /** Talk-back: toggle streaming the local mic to the host (undefined = feature unavailable). */
    onToggleTalk?: () => void;
    remoteStream: MediaStream | null;
    deviceType?: string;
    deviceName?: string;
    controlChannelRef: React.RefObject<RTCDataChannel | null>;
    remoteCursor: { x: number, y: number, visible: boolean, cursorType?: string } | null;
    remoteWhiteboardEvent?: any;
    remoteChatEvent?: any;
    remoteFileBrowserEvent?: any;
    controlStatus: 'granted' | 'pending' | 'denied';
    fileTransferStatus: FileTransferStatus | null;
    setFileTransferStatus: React.Dispatch<React.SetStateAction<FileTransferStatus | null>>;
    /** Live RTT/loss/fps snapshot from the parent's adaptive-quality loop. */
    connectionHealth?: { rttMs: number; lossPct: number; fps: number };
    /** Forces the stream to the lowest-bandwidth tier immediately. */
    onBoostConnection?: () => void;
    /** Fires once Chromium has actually presented this stream's first frame. */
    onFirstFramePresented?: () => void;
}
/**
 * Is the frame currently on screen effectively blank (black)?
 *
 * Used to tell a genuinely hidden/protected/asleep remote screen apart from one
 * that is merely STATIC. Both stop producing frames; only one is a problem.
 * Samples a tiny 32x18 downscale — enough to catch "a few lit pixels" while
 * keeping the GPU→CPU readback cheap — and is called rarely (see the caller).
 * Errors resolve to "not blank": refusing to accuse on missing evidence beats a
 * false alarm on a working session.
 */
let blankProbeCanvas: HTMLCanvasElement | null = null;
function isRenderedFrameBlank(video: HTMLVideoElement): boolean {
    try {
        if (!video.videoWidth || !video.videoHeight) return false;
        if (!blankProbeCanvas) blankProbeCanvas = document.createElement('canvas');
        const canvas = blankProbeCanvas;
        canvas.width = 32;
        canvas.height = 18;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return false;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let peak = 0;
        for (let i = 0; i < data.length; i += 4) {
            // Peak, not mean: a mostly-dark screen with a lit clock or one icon is
            // still a screen the person can see, and averaging would hide it.
            const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            if (luma > peak) peak = luma;
        }
        // 12/255 clears black-with-encoder-noise while still catching dim content.
        return peak <= 12;
    } catch {
        return false;
    }
}

const VideoPlayer = forwardRef<any, VideoPlayerProps>(({
    viewerStatus,
    mediaActive = true,
    setViewerStatus,
    sessionCode,
    onDisconnect,
    onControlEvent: onControlEventProp,
    talkActive,
    onToggleTalk,
    remoteStream,
    deviceType,
    deviceName,
    controlChannelRef,
    remoteCursor,
    remoteWhiteboardEvent,
    remoteChatEvent,
    remoteFileBrowserEvent,
    controlStatus,
    fileTransferStatus,
    setFileTransferStatus,
    connectionHealth,
    onBoostConnection,
    onFirstFramePresented
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const firstPresentedStreamRef = useRef<MediaStream | null>(null);
    const decoderRef = useRef<any>(null);
    const [latency, setLatency] = useState(0);
    const [transferProgress, setTransferProgress] = useState<{ name: string, p: number } | null>(null);
    const [scaleMode, setScaleMode] = useState<'fit' | 'fill' | 'actual'>('fit');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hasReceivedKeyframe, setHasReceivedKeyframe] = useState(false);
    const [packetsReceived, setPacketsReceived] = useState(0);
    const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);
    const [decodeErrors, setDecodeErrors] = useState(0);
    const reassemblyMap = useRef(new Map<bigint, { fragments: (Uint8Array | null)[], count: number, total: number }>());
    const [isAutoPlayBlocked, setIsAutoPlayBlocked] = useState(false);
    const [showShortcutsHUD, setShowShortcutsHUD] = useState(false);
    const [shortcutsTab, setShortcutsTab] = useState<'essential' | 'power' | 'transfer'>('essential');
    const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(false);
    const [remoteAudioNotice, setRemoteAudioNotice] = useState('');
    const [hostAudioStatus, setHostAudioStatus] = useState('');
    useEffect(() => {
        setHostAudioStatus('');
        return subscribeControlJson((data) => {
            if (data?.type !== 'audio-status' || typeof data.message !== 'string') return false;
            setHostAudioStatus(data.message.slice(0, 240));
            return true;
        });
    }, [sessionCode]);
    // Distinguishes "not enabled yet" from "this viewer chose mute": auto-play
    // must never undo an explicit mute when tracks re-arrive after a reconnect.
    const userMutedAudioRef = useRef(false);
    const [protectedSurfaceNotice, setProtectedSurfaceNotice] = useState(false);
    const [pendingRemoteAction, setPendingRemoteAction] = useState<ConfirmableRemoteAction | null>(null);
    const [connectingMessageIndex, setConnectingMessageIndex] = useState(0);
    const [remoteVideoSize, setRemoteVideoSize] = useState<{ width: number; height: number } | null>(null);
    const lastPresentedFrameAtRef = useRef<number>(0);
    const isMobileDevice = deviceType?.toLowerCase() === 'mobile' || deviceType?.toLowerCase() === 'android' || deviceType?.toLowerCase() === 'ios';

    // "Direct Keyboard Mode" (toggleable from the Actions menu): printable keys
    // are forwarded as real per-key keydown/keyup — a physical-keyboard-faithful
    // stream, like TeamViewer. This is the DEFAULT for desktop hosts: batched
    // `typeText` injection only produces WM_CHAR text events on the host, which
    // ordinary edit fields accept but raw-input apps (scrcpy, games, terminals,
    // VMs) ignore or mangle — and it loses key-repeat/hold semantics. Android
    // hosts keep the batched-text path (their accessibility injection needs the
    // character, not a keycode), and the menu toggle still switches either way
    // (e.g. for exotic keyboard layouts where positional VKs type wrong glyphs).
    const [directKeyboardMode, setDirectKeyboardMode] = useState(() => !isMobileDevice);
    const directKeyboardModeRef = useRef(!isMobileDevice);
    useEffect(() => { directKeyboardModeRef.current = directKeyboardMode; }, [directKeyboardMode]);

    // "Send System Keys To Remote" (Actions menu, desktop hosts only). Chromium
    // never sees Win, Alt+Tab, Alt+F4, Ctrl+Esc or PrintScreen — the local
    // shell acts on them first — so the main process swallows them with a
    // low-level keyboard hook while this window is in the foreground and hands
    // them here (electronAPI.systemKeys). With it on, the viewer's keyboard
    // behaves like the remote machine's own; off, those keys act on the
    // viewer's laptop as before. Remembered across sessions, default on.
    const SYSTEM_KEYS_STORAGE_KEY = 'remote365.systemKeys';
    const systemKeysSupported = !isMobileDevice && Boolean((window as any).electronAPI?.systemKeys?.setEnabled);
    const [systemKeysMode, setSystemKeysMode] = useState(() => {
        if (!systemKeysSupported) return false;
        try { return window.localStorage.getItem(SYSTEM_KEYS_STORAGE_KEY) !== '0'; } catch { return true; }
    });
    useEffect(() => {
        if (!systemKeysSupported) return;
        try { window.localStorage.setItem(SYSTEM_KEYS_STORAGE_KEY, systemKeysMode ? '1' : '0'); } catch { /* still applies this session */ }
    }, [systemKeysMode, systemKeysSupported]);
    useEffect(() => {
        const api = (window as any).electronAPI?.systemKeys;
        if (!systemKeysSupported || !api?.setEnabled) return;
        const live = systemKeysMode && (viewerStatus === 'streaming' || viewerStatus === 'connected') && Boolean(onControlEventProp);
        api.setEnabled(live);
        return () => { api.setEnabled(false); };
    }, [systemKeysMode, systemKeysSupported, viewerStatus, onControlEventProp]);
    // Keys the hook is holding down for us (Win while Win+E is typed, Tab
    // during Alt+Tab). While Win is held every key is forwarded raw — never
    // batched into typed text — and carries metaKey so the host sees the chord.
    const hookHeldVKsRef = useRef<Set<number>>(new Set());
    // Every key we've forwarded as keydown and not yet as keyup, so losing
    // focus mid-chord can release them all on the host.
    const pressedVKsRef = useRef<Set<number>>(new Set());

    // --- Macro recorder ------------------------------------------------------
    // Records a sequence of real input events sent to the remote host, with the
    // gap between them, and can replay that sequence on demand. Every existing
    // call site in this file still calls `onControlEvent(...)` — shadowing the
    // prop (renamed above to `onControlEventProp`) with the wrapper below is
    // what lets recording capture them without touching each call site.
    const MACRO_STORAGE_KEY = 'remote365_saved_macros';
    const MACRO_RECORDABLE_TYPES = new Set(['mousedown', 'mouseup', 'wheel', 'keydown', 'keyup', 'keyCombo', 'typeText', 'pasteText', 'clipboard']);
    const [savedMacros, setSavedMacros] = useState<{ id: string; name: string; events: { event: any; dt: number }[]; createdAt: number }[]>(() => {
        try {
            const raw = localStorage.getItem(MACRO_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });
    const [isMacroRecording, setIsMacroRecording] = useState(false);
    const [macroRecordingCount, setMacroRecordingCount] = useState(0);
    const [isMacroPlaying, setIsMacroPlaying] = useState(false);
    const [pendingMacroSave, setPendingMacroSave] = useState<{ event: any; dt: number }[] | null>(null);
    const [macroNameInput, setMacroNameInput] = useState('');
    const macroEventsRef = useRef<{ event: any; dt: number }[]>([]);
    const macroLastTsRef = useRef(0);
    const macroPlaybackTimeoutsRef = useRef<number[]>([]);

    const persistMacros = (macros: typeof savedMacros) => {
        setSavedMacros(macros);
        try { localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(macros)); } catch { /* storage may be full/unavailable */ }
    };

    // Input-latency probe: clicks are stamped with a seq; the host acks AFTER
    // injection and onInputAck (imperative handle) turns that into the real
    // click-to-injected RTT shown in the health chip (was hardwired 0 before).
    const inputSeqRef = useRef(0);
    const pendingInputAcksRef = useRef(new Map<number, number>());
    const lastLatencyUpdateRef = useRef(0);
    const inputRttSamplesRef = useRef<number[]>([]);
    const inputToPresentSamplesRef = useRef<number[]>([]);
    const inputHostMsSamplesRef = useRef<number[]>([]);

    const onControlEvent = useCallback((event: any) => {
        if (isMacroRecording && !(event instanceof Uint8Array) && event?.type && MACRO_RECORDABLE_TYPES.has(event.type)) {
            const now = Date.now();
            const dt = macroLastTsRef.current ? now - macroLastTsRef.current : 0;
            macroLastTsRef.current = now;
            macroEventsRef.current.push({ event, dt });
            setMacroRecordingCount(macroEventsRef.current.length);
        }
        if (!(event instanceof Uint8Array) && (event?.type === 'mousedown' || event?.type === 'mouseup')) {
            const seq = ++inputSeqRef.current;
            event.seq = seq;
            const pending = pendingInputAcksRef.current;
            pending.set(seq, Date.now());
            // Bound the map: unacked entries (old hosts never ack) must not grow.
            if (pending.size > 64) {
                const oldest = pending.keys().next().value;
                if (oldest !== undefined) pending.delete(oldest);
            }
        }
        onControlEventProp(event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMacroRecording, onControlEventProp]);

    const startMacroRecording = () => {
        macroEventsRef.current = [];
        macroLastTsRef.current = 0;
        setMacroRecordingCount(0);
        setIsMacroRecording(true);
    };

    const stopMacroRecording = () => {
        setIsMacroRecording(false);
        if (macroEventsRef.current.length) {
            setPendingMacroSave([...macroEventsRef.current]);
            setMacroNameInput(`Macro ${savedMacros.length + 1}`);
        }
    };

    const discardMacroRecording = () => {
        macroEventsRef.current = [];
        setPendingMacroSave(null);
        setMacroNameInput('');
    };

    const confirmSaveMacro = () => {
        if (!pendingMacroSave || !pendingMacroSave.length) { discardMacroRecording(); return; }
        const macro = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: macroNameInput.trim() || `Macro ${savedMacros.length + 1}`,
            events: pendingMacroSave,
            createdAt: Date.now(),
        };
        persistMacros([...savedMacros, macro]);
        setPendingMacroSave(null);
        setMacroNameInput('');
    };

    const deleteMacro = (id: string) => {
        persistMacros(savedMacros.filter((m) => m.id !== id));
    };

    const playMacro = (macro: typeof savedMacros[number]) => {
        if (isMacroPlaying || !macro.events.length) return;
        setIsMacroPlaying(true);
        macroPlaybackTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
        macroPlaybackTimeoutsRef.current = [];
        let cumulative = 0;
        macro.events.forEach((step, index) => {
            cumulative += step.dt;
            const timeoutId = window.setTimeout(() => {
                onControlEventProp(step.event);
                if (index === macro.events.length - 1) setIsMacroPlaying(false);
            }, cumulative);
            macroPlaybackTimeoutsRef.current.push(timeoutId);
        });
    };

    useEffect(() => () => {
        macroPlaybackTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
    }, []);

    const confirmReboot = () => {
        setShowShortcutsHUD(false);
        setPendingRemoteAction({
            action: 'reboot',
            title: isMobileDevice ? 'Remote Power Menu' : 'Remote Reboot',
            message: isMobileDevice
                ? 'The remote phone power menu is going to open. If you want to prevent this action click Cancel.'
                : 'The remote computer is going to reboot. If you want to prevent the computer from rebooting click Cancel.',
            confirmLabel: 'Confirm',
            detail: isMobileDevice
                ? 'Opens the phone power controls on the remote device.'
                : 'Restarts the remote computer immediately.',
        });
    };

    const runPendingRemoteAction = () => {
        if (!pendingRemoteAction) return;
        onControlEvent({ type: 'action', action: pendingRemoteAction.action });
        setPendingRemoteAction(null);
    };

    useEffect(() => {
        if (hasReceivedKeyframe) return;
        const timer = setInterval(() => {
            setConnectingMessageIndex((index) => (index + 1) % CONNECTING_MESSAGES.length);
        }, 1600);
        return () => clearInterval(timer);
    }, [hasReceivedKeyframe]);

    const connectingText = CONNECTING_MESSAGES[connectingMessageIndex];

    const renderConnectingLoader = () => (
        <div className="absolute inset-0 z-20 flex h-full w-full max-w-full flex-col items-center justify-center overflow-hidden bg-white text-[#111315] animate-in fade-in duration-300 cursor-default">
            <div className="pointer-events-none absolute left-1/2 top-[-390px] h-[517px] w-[min(1748px,calc(100vw+320px))] -translate-x-1/2 rounded-full bg-[linear-gradient(360deg,rgba(255,255,255,0.375)_-16.83%,rgba(255,179,71,0.58)_29.84%,rgba(255,138,0,0.72)_76.5%)] blur-[39.5px]" />
            <div className="relative z-10 flex w-[440px] max-w-[calc(100%-40px)] flex-col items-center text-center">
                <div className="relative">
                    <div className="absolute inset-6 rounded-full bg-[#FFB347]/20 blur-2xl" />
                    <img src={waitIllustration} alt="" className="relative h-[190px] w-[230px] object-contain sm:h-[214px] sm:w-[251px]" />
                </div>

                <div className="mt-12 flex w-full flex-col items-center gap-3">
                    <div className="inline-flex h-8 items-center gap-2 rounded-full bg-[#F3F4F6] px-3 text-[12px] font-medium text-[#1A1D21]/70">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#34C759]" />
                        Connecting Safely
                    </div>
                    <h1 className="m-0 text-[24px] font-medium leading-[34px] text-black sm:text-[28px] sm:leading-[39px]">
                        Connecting To Remote Computer
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
                </div>
                <button
                    type="button"
                    onClick={onDisconnect}
                    className="mt-12 h-10 min-w-[153px] rounded px-4 text-[14px] font-medium text-[#111315] shadow-sm transition hover:brightness-105"
                    style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                >
                    Cancel Session
                </button>
            </div>
            <div className="absolute bottom-2 left-1/2 flex w-[226px] -translate-x-1/2 flex-col items-center text-center text-black/50">
                <div className="text-[10px] leading-[14px]">Privacy Policy</div>
                <div className="text-[8px] leading-[11px]">Copyright 2026 (c) Remote365. All Rights Reserved.</div>
            </div>
        </div>
    );

    useEffect(() => {
        const updateFullscreenState = () => setIsFullScreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', updateFullscreenState);
        return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
    }, []);

    // Keyboard Lock: send system shortcuts (Alt+Tab, Win, Alt+F4...) to the
    // REMOTE machine instead of having the local OS eat them. Scoped strictly
    // to fullscreen — holding a global key capture for the whole session
    // intercepts the user's own machine shortcuts, which is worse than the
    // problem it solves. Released as soon as fullscreen exits.
    useEffect(() => {
        const kb = (navigator as any).keyboard;
        if (!kb?.lock || !isFullScreen) return;
        kb.lock().catch(() => { /* permission/platform-dependent */ });
        return () => { try { kb.unlock(); } catch { /* best-effort */ } };
    }, [isFullScreen]);

    const toggleViewerFullscreen = async () => {
        const electronApi = (window as any).electronAPI;
        if (electronApi?.toggleFullscreen) {
            try {
                const next = await electronApi.toggleFullscreen();
                setIsFullScreen(Boolean(next));
                return;
            } catch (err) {
                console.warn('[Viewer] Electron fullscreen failed, trying browser fullscreen:', err);
            }
        }
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                setIsFullScreen(false);
            } else {
                await (containerRef.current || viewerContainerRef.current || document.documentElement).requestFullscreen();
                setIsFullScreen(true);
            }
        } catch (err) {
            console.warn('[Viewer] Fullscreen failed:', err);
        }
    };


    // --- Black Screen Watchdog ---
    // If we have a stream but videoWidth is 0, request a recovery keyframe every 2s
    useEffect(() => {
        if (!mediaActive || viewerStatus !== 'streaming' || !remoteStream) return;

        const watchdog = setInterval(() => {
            const vw = videoRef.current?.videoWidth || 0;
            const vh = videoRef.current?.videoHeight || 0;

            if ((vw === 0 || vh === 0) && controlChannelRef?.current?.readyState === 'open') {
                console.warn('[Watchdog] Black screen detected (0x0). Requesting recovery keyframe from host...');
                try {
                    controlChannelRef.current.send(JSON.stringify({ type: 'request-keyframe', urgent: true, reason: 'no-decoded-dimensions' }));
                } catch (err) {
                    console.error('[Watchdog] Failed to send keyframe request:', err);
                }
            }
        }, 5000); // Check every 5s instead of 2s

        // Immediate check on mount/stream change
        if (controlChannelRef?.current?.readyState === 'open') {
            controlChannelRef.current.send(JSON.stringify({ type: 'request-keyframe' }));
        }

        return () => clearInterval(watchdog);
    }, [mediaActive, viewerStatus, remoteStream, controlChannelRef]);

    useEffect(() => {
        lastPresentedFrameAtRef.current = performance.now();
        setProtectedSurfaceNotice(false);
    }, [remoteStream]);

    useEffect(() => {
        if (!mediaActive || viewerStatus !== 'streaming' || !remoteStream) return;

        const video = videoRef.current as any;
        if (!video || typeof video.requestVideoFrameCallback !== 'function') return;
        let cancelled = false;
        let callbackId: number | null = null;
        const onPresentedFrame = () => {
            if (cancelled) return;
            lastPresentedFrameAtRef.current = performance.now();
            setProtectedSurfaceNotice(false);
            callbackId = video.requestVideoFrameCallback(onPresentedFrame);
        };
        callbackId = video.requestVideoFrameCallback(onPresentedFrame);

        const probe = setInterval(() => {
            if (!video || video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) return;

            const stalledMs = performance.now() - lastPresentedFrameAtRef.current;
            if (stalledMs < 5000) return;
            // "No New Frames" is NOT the same as "nothing to see". A phone sitting
            // on a static screen (notification shade, a settings page, anything not
            // animating) encodes nothing at all, so frame callbacks stop while the
            // picture on screen stays perfectly good — and the old time-only test
            // then accused a healthy session of being "hidden or locked". Worse, it
            // was sticky: clearing the notice required a NEW frame, which a static
            // screen never produces.
            //
            // So before accusing, look at what is actually being displayed. The
            // readback is a synchronous GPU→CPU stall, which is why it does not run
            // on every 2s tick — only at the moment we would otherwise raise the
            // notice, i.e. once per stall episode.
            if (stalledMs >= 12000) setProtectedSurfaceNotice(isRenderedFrameBlank(video));
            if (controlChannelRef.current?.readyState === 'open') {
                controlChannelRef.current.send(JSON.stringify({
                    type: 'request-keyframe',
                    urgent: true,
                    reason: 'presentation-stalled',
                    stalledMs: Math.round(stalledMs),
                }));
            }
        }, 2000);

        return () => {
            cancelled = true;
            clearInterval(probe);
            if (callbackId != null && typeof video.cancelVideoFrameCallback === 'function') {
                video.cancelVideoFrameCallback(callbackId);
            }
        };
    }, [mediaActive, viewerStatus, remoteStream, controlChannelRef]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = !remoteAudioEnabled;
            videoRef.current.volume = remoteAudioEnabled ? 1 : 0;
        }
    }, [remoteAudioEnabled]);

    // Auto-play: sound starts the moment the host stream carries an audio track,
    // unless this viewer explicitly muted it. The audio track usually folds into
    // the stream after the video track (see the ontrack merge in App.tsx), hence
    // the addtrack listener rather than a one-shot check. The listen announcement
    // is re-sent on status changes because control messages are dropped while the
    // channel is still opening — the host keeps listeners in a Set, so duplicates
    // are harmless.
    useEffect(() => {
        if (!remoteStream) return;
        const autoEnable = () => {
            if (userMutedAudioRef.current) return;
            if (!remoteStream.getAudioTracks?.().length) return;
            setRemoteAudioEnabled(true);
            onControlEvent({ type: 'audio-listen', on: true });
        };
        autoEnable();
        remoteStream.addEventListener('addtrack', autoEnable);
        return () => remoteStream.removeEventListener('addtrack', autoEnable);
    }, [remoteStream, viewerStatus]);

    useImperativeHandle(ref, () => ({
        onInputAck: (seq: number, hostMs?: number) => {
            const pending = pendingInputAcksRef.current;
            const t0 = pending.get(seq);
            if (t0 === undefined) return;
            pending.delete(seq);
            const rtt = Date.now() - t0;
            const rttSamples = inputRttSamplesRef.current;
            rttSamples.push(rtt);
            if (rttSamples.length > 120) rttSamples.shift();
            // Time the host itself spent on the click (receive → SendInput);
            // the rest of the RTT is network. Only newer hosts report it.
            if (typeof hostMs === 'number' && Number.isFinite(hostMs)) {
                const hostSamples = inputHostMsSamplesRef.current;
                hostSamples.push(hostMs);
                if (hostSamples.length > 120) hostSamples.shift();
            }

            // The first frame presented after injection is an observable upper
            // bound for input-to-display feedback. It may be an unchanged frame,
            // so the metric is named inputToNextPresent rather than claiming
            // optical click-to-photon without a visual marker.
            const video = videoRef.current as any;
            if (video?.requestVideoFrameCallback) {
                video.requestVideoFrameCallback(() => {
                    const elapsed = Date.now() - t0;
                    const presentSamples = inputToPresentSamplesRef.current;
                    presentSamples.push(elapsed);
                    if (presentSamples.length > 120) presentSamples.shift();
                });
            }

            if (rttSamples.length >= 10 && rttSamples.length % 10 === 0) {
                const percentile = (values: number[], p: number) => {
                    if (!values.length) return 0;
                    const sorted = [...values].sort((a, b) => a - b);
                    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
                };
                const presentSamples = inputToPresentSamplesRef.current;
                const hostSamples = inputHostMsSamplesRef.current;
                (window as any).electronAPI?.log?.(
                    `[Perf] Input latency samples=${rttSamples.length} injectRttP50=${percentile(rttSamples, 0.5)}ms injectRttP95=${percentile(rttSamples, 0.95)}ms ` +
                    `inputToNextPresentP50=${percentile(presentSamples, 0.5)}ms inputToNextPresentP95=${percentile(presentSamples, 0.95)}ms` +
                    (hostSamples.length ? ` hostSideP50=${percentile(hostSamples, 0.5)}ms hostSideP95=${percentile(hostSamples, 0.95)}ms` : '')
                );
            }
            // Throttle the display update to 1/s — this is a health readout,
            // not a per-click re-render.
            const now = Date.now();
            if (now - lastLatencyUpdateRef.current >= 1000) {
                lastLatencyUpdateRef.current = now;
                setLatency(rtt);
            }
        },
        feed: (data: Uint8Array) => {
            if (remoteStream) return; // Ignore custom data if using standard stream
            // Legacy data-channel path only: these setStates re-render per packet,
            // so they must stay behind the early-return above.
            setPacketsReceived(p => p + 1);
            setLastPacketTime(Date.now());

            if (data.length < 10) return;
            const view = new DataView(data.buffer, data.byteOffset, 10);
            const ts = view.getBigInt64(0, true);
            const fragIdx = view.getUint8(8);
            const totalFrags = view.getUint8(9);

            let entry = reassemblyMap.current.get(ts);
            if (!entry) {
                entry = { fragments: new Array(totalFrags).fill(null), count: 0, total: totalFrags };
                reassemblyMap.current.set(ts, entry);
                // Bound the map HERE, where entries are created. The old trim sat
                // inside the "frame completed" branch, so on a lossy link — where
                // frames never complete — half-built frames piled up for the whole
                // session. A Map iterates in insertion order, so the first key is
                // the oldest frame.
                while (reassemblyMap.current.size > 20) {
                    const oldest = reassemblyMap.current.keys().next().value;
                    if (oldest === undefined) break;
                    reassemblyMap.current.delete(oldest);
                }
            }

            if (!entry.fragments[fragIdx]) {
                entry.fragments[fragIdx] = data.slice(10);
                entry.count++;
            }

            if (entry.count === entry.total) {
                const totalSize = entry.fragments.reduce((acc, f) => acc + (f ? f.length : 0), 0);
                const fullNAL = new Uint8Array(totalSize);
                let offset = 0;
                for (const f of entry.fragments) {
                    if (f) {
                        fullNAL.set(f, offset);
                        offset += f.length;
                    }
                }

                feedToDecoder(fullNAL, ts);
                reassemblyMap.current.delete(ts);
            }
        }
    }));

    const feedToDecoder = (chunkData: Uint8Array, timestamp: bigint) => {
        if (!decoderRef.current) return;

        // 1. Manually Split Annex-B Chunk into individual NALs
        const nals: Uint8Array[] = [];
        let i = 0;
        while (i < chunkData.length - 3) {
            if (chunkData[i] === 0 && chunkData[i + 1] === 0 && chunkData[i + 2] === 1) {
                const start = i + 3;
                let end = chunkData.length;
                for (let j = start; j < chunkData.length - 2; j++) {
                    if (chunkData[j] === 0 && chunkData[j + 1] === 0 && (chunkData[j + 2] === 1 || (chunkData[j + 2] === 0 && chunkData[j + 3] === 1))) {
                        end = j;
                        break;
                    }
                }
                nals.push(chunkData.subarray(start, end));
                i = end;
            } else if (chunkData[i] === 0 && chunkData[i + 1] === 0 && chunkData[i + 2] === 0 && chunkData[i + 3] === 1) {
                const start = i + 4;
                let end = chunkData.length;
                for (let j = start; j < chunkData.length - 2; j++) {
                    if (chunkData[j] === 0 && chunkData[j + 1] === 0 && (chunkData[j + 2] === 1 || (chunkData[j + 2] === 0 && chunkData[j + 3] === 1))) {
                        end = j;
                        break;
                    }
                }
                nals.push(chunkData.subarray(start, end));
                i = end;
            } else {
                i++;
            }
        }

        if (nals.length === 0) {
            console.warn(`[VideoPlayer] Received chunk of ${chunkData.length} bytes but NO NAL units found!`);
            return;
        }

        // 2. Extract SPS / PPS & Reconfigure WebCodecs (Required on Windows)
        let sps: Uint8Array | null = null;
        let pps: Uint8Array | null = null;
        let type: 'key' | 'delta' = 'delta';
        let nalTypesFound = [];

        for (const nal of nals) {
            const nalType = nal[0] & 0x1F;
            nalTypesFound.push(nalType);
            if (nalType === 7) sps = nal;
            if (nalType === 8) pps = nal;
            if (nalType === 5) type = 'key';
        }

        let isCurrentlyConfigured = hasReceivedKeyframe;

        if (sps && pps && !hasReceivedKeyframe) {
            console.log(`[VideoPlayer] Constructing Extradata... SPS Length: ${sps.length}, PPS Length: ${pps.length}`);
            const extradata = new Uint8Array(11 + sps.length + pps.length);
            extradata.set([0x01, sps[1], sps[2], sps[3], 0xFF, 0xE1, (sps.length >> 8) & 0xFF, sps.length & 0xFF], 0);
            extradata.set(sps, 8);
            extradata.set([0x01, (pps.length >> 8) & 0xFF, pps.length & 0xFF], 8 + sps.length);
            extradata.set(pps, 8 + sps.length + 3);

            const codecString = `avc1.${[sps[1], sps[2], sps[3]].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
            console.log(`[VideoPlayer] Configuring Hardware Engine: ${codecString}`);

            decoderRef.current.configure({
                codec: codecString,
                description: extradata,
                optimizeForLatency: true
            });

            console.log(`[VideoPlayer] Decoder successfully configured with AVCDecoderConfigurationRecord.`);
            setHasReceivedKeyframe(true);
            isCurrentlyConfigured = true; // Local override to allow this specific chunk to decode
        }

        if (!isCurrentlyConfigured) {
            if (Math.random() < 0.05) console.warn(`[VideoPlayer] Dropping ${nalTypesFound.join(',')} frame because no SPS/PPS Keyframe initialized engine yet.`);
            return;
        }

        if (viewerStatus !== 'streaming') {
            console.log(`[VideoPlayer] Transitioning to STREAMING. UI should update.`);
            setViewerStatus('streaming');
        }

        // 3. Rebuild chunk in AVCC 4-byte length-prefix format
        // CRITICAL: We MUST filter out SPS/PPS if they are also provided in the 'description' 
        // to prevent decoder failures on Windows Media Foundation.
        const vclNals = nals.filter(nal => {
            const type = nal[0] & 0x1F;
            return type === 1 || type === 5;
        });

        if (vclNals.length === 0) return; // No actual video data in this chunk

        const avccLength = vclNals.reduce((acc, nal) => acc + 4 + nal.length, 0);
        const avccData = new Uint8Array(avccLength);
        let offset = 0;
        for (const nal of vclNals) {
            const view = new DataView(avccData.buffer, avccData.byteOffset + offset, 4);
            view.setUint32(0, nal.length, false);
            avccData.set(nal, offset + 4);
            offset += 4 + nal.length;
        }

        try {
            const EncodedVideoChunk = (window as any).EncodedVideoChunk;
            if (!EncodedVideoChunk) return;

            const encodedChunk = new EncodedVideoChunk({
                type: type,
                timestamp: Number(timestamp),
                data: avccData,
            });
            decoderRef.current.decode(encodedChunk);
        } catch (e) {
            console.error('[VideoPlayer] Decoder CRASHED on chunk processing:', e);
        }
    };

    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const textInputBufferRef = useRef('');
    const textInputFlushTimerRef = useRef<number | null>(null);
    const hasFocusedContainerRef = useRef(false);

    // --- Handshake Watchdog (Force Image Recovery) ---
    useEffect(() => {
        let timer: any;
        // Focus the container once per stream so keyboard events are captured.
        // This effect's deps include `onControlEvent`, which is a fresh function
        // reference on most parent re-renders — running the focus() call on every
        // re-run (instead of once, edge-triggered) was yanking focus away from
        // whatever local input the user had open (whiteboard text tool, session
        // notes, macro name field), making them impossible to type into.
        if (viewerStatus === 'streaming' && !hasFocusedContainerRef.current) {
            const active = document.activeElement;
            const activeIsLocalInput = active instanceof HTMLElement &&
                (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            if (!activeIsLocalInput) viewerContainerRef.current?.focus();
            hasFocusedContainerRef.current = true;
        }
        if (viewerStatus !== 'streaming') hasFocusedContainerRef.current = false;

        // Watchdog should start if we are "connecting" or "connected" but no data has flowed for 5 seconds
        if ((viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connecting') && !hasReceivedKeyframe) {
            timer = setTimeout(() => {
                console.log('[VideoPlayer] Screen timeout (black) - Requesting keyframe recovery...');
                onControlEvent({ type: 'request-keyframe', urgent: true, reason: 'initial-video-timeout' });
            }, 10000); // 10s timeout for initial handshake recovery
        }
        return () => clearTimeout(timer);
    }, [viewerStatus, hasReceivedKeyframe, remoteStream, onControlEvent]);

    // --- Keyboard Handlers ---
    useEffect(() => {
        if ((viewerStatus !== 'streaming' && viewerStatus !== 'connected') || !onControlEvent) return;

        console.warn(`[DIAGNOSTIC] REMOTE CAPTURE ACTIVE. Monitoring all keystrokes in ${viewerStatus} mode.`);

        const flushTextInput = () => {
            const text = textInputBufferRef.current;
            textInputBufferRef.current = '';
            if (textInputFlushTimerRef.current) {
                window.clearTimeout(textInputFlushTimerRef.current);
                textInputFlushTimerRef.current = null;
            }
            if (text) onControlEvent({ type: 'typeText', text });
        };

        const queueTextInput = (text: string) => {
            textInputBufferRef.current += text;
            if (textInputFlushTimerRef.current) window.clearTimeout(textInputFlushTimerRef.current);
            textInputFlushTimerRef.current = window.setTimeout(flushTextInput, 35);
        };

        const isLocalEditableTarget = (target: EventTarget | null) => {
            const element = target instanceof HTMLElement ? target : null;
            if (!element) return false;
            const tagName = element.tagName.toLowerCase();
            return tagName === 'input' || tagName === 'textarea' || element.isContentEditable;
        };

        const getVirtualKey = (event: KeyboardEvent) => {
            const keyMap: Record<string, number> = {
                'Enter': 0x0D, 'Backspace': 0x08, 'Tab': 0x09, 'Escape': 0x1B, ' ': 0x20,
                'ArrowLeft': 0x25, 'ArrowUp': 0x26, 'ArrowRight': 0x27, 'ArrowDown': 0x28,
                'Delete': 0x2E, 'Home': 0x24, 'End': 0x23, 'Insert': 0x2D, 'PageUp': 0x21, 'PageDown': 0x22,
                'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75, 'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
                'Shift': 0x10, 'Control': 0x11, 'Alt': 0x12, 'Meta': 0x5B, 'CapsLock': 0x14, 'ScrollLock': 0x91, 'NumLock': 0x90,
            };
            if (keyMap[event.key]) return keyMap[event.key];
            if (/^Key[A-Z]$/.test(event.code)) return event.code.charCodeAt(3);
            if (/^Digit[0-9]$/.test(event.code)) return event.code.charCodeAt(5);
            if (/^Numpad[0-9]$/.test(event.code)) return 0x60 + Number(event.code.slice(6));
            const codeMap: Record<string, number> = {
                NumpadMultiply: 0x6A, NumpadAdd: 0x6B, NumpadSubtract: 0x6D, NumpadDecimal: 0x6E, NumpadDivide: 0x6F,
                Semicolon: 0xBA, Equal: 0xBB, Comma: 0xBC, Minus: 0xBD, Period: 0xBE, Slash: 0xBF,
                Backquote: 0xC0, BracketLeft: 0xDB, Backslash: 0xDC, BracketRight: 0xDD, Quote: 0xDE,
            };
            return codeMap[event.code] || event.keyCode;
        };

        // Win is being held for us by the native hook (the local OS never saw
        // it go down, so the keys typed after it arrive here without metaKey).
        const hookWinHeld = () => hookHeldVKsRef.current.has(0x5B) || hookHeldVKsRef.current.has(0x5C);

        const forwardKeyEvent = (event: KeyboardEvent, type: 'keydown' | 'keyup') => {
            // Never forward the CapsLock KEY: replaying toggle presses double-
            // fires on key-repeat and drifts the host's caps state. Instead the
            // viewer's live CapsLock STATE rides on every event (below) and the
            // host mirrors it (see the keydown handler's VK_CAPITAL sync).
            if (event.key === 'CapsLock') return;
            const vk = getVirtualKey(event);
            if (!vk) return;
            if (type === 'keydown') pressedVKsRef.current.add(vk);
            else pressedVKsRef.current.delete(vk);
            onControlEvent({
                type,
                key: event.key,
                code: event.code,
                keyCode: vk,
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                metaKey: event.metaKey || hookWinHeld(),
                capsLock: typeof event.getModifierState === 'function' ? event.getModifierState('CapsLock') : undefined,
                repeat: event.repeat,
            });
        };

        const handleKeyDown = async (e: KeyboardEvent) => {
            // Let any focused local text field (session notes, whiteboard text, etc.)
            // keep its keystrokes instead of forwarding them to the host.
            if (isLocalEditableTarget(e.target)) return;

            const shortcutKey = String(e.key || '').toLowerCase();
            const hasSystemModifier = e.ctrlKey || e.metaKey || e.altKey;

            if ((e.ctrlKey || e.metaKey) && e.altKey && shortcutKey === 'k') {
                e.preventDefault();
                setShowShortcutsHUD((show) => !show);
                return;
            }

            // Every key that reaches here belongs to the remote machine. Nothing
            // may fall through to this window's own defaults — Chromium would
            // otherwise scroll the page on Space/PageDown, move focus on Tab, or
            // run its own F-key / Ctrl shortcuts on top of the remote's.
            e.preventDefault();

            if (hasSystemModifier) {
                flushTextInput();
                if ((e.ctrlKey || e.metaKey) && !e.altKey && shortcutKey === 'v' && !e.repeat) {
                    const electronApi = (window as any).electronAPI;
                    const text = electronApi?.clipboard?.readText
                        ? await electronApi.clipboard.readText()
                        : await navigator.clipboard?.readText?.();
                    if (text) onControlEvent(isMobileDevice ? { type: 'pasteText', text } : { type: 'clipboard', text });
                    if (isMobileDevice) return;
                }
            }

            if (['Tab', 'Backspace', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                flushTextInput();
            }

            if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
                if (directKeyboardModeRef.current || hookWinHeld()) {
                    flushTextInput();
                    forwardKeyEvent(e, 'keydown');
                    return;
                }
                queueTextInput(e.key);
                return;
            }

            flushTextInput();
            forwardKeyEvent(e, 'keydown');
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (isLocalEditableTarget(e.target)) return;
            if (!directKeyboardModeRef.current && !hookWinHeld() && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) return;
            e.preventDefault();
            forwardKeyEvent(e, 'keyup');
        };

        // System keys the native hook swallowed on this machine (Win, Alt+Tab,
        // Alt+F4, Ctrl+Esc, PrintScreen...). They arrive as raw Windows virtual
        // keys and go straight to the host as keydown/keyup — the host is the
        // one that should switch apps, open Start or lock its screen.
        const SYSTEM_KEY_NAMES: Record<number, string> = {
            0x5B: 'Meta', 0x5C: 'Meta', 0x09: 'Tab', 0x1B: 'Escape', 0x73: 'F4', 0x20: ' ', 0x2C: 'PrintScreen',
        };
        const handleSystemKey = (ev: any) => {
            const vk = Number(ev?.vk);
            if (!vk) return;
            const held = hookHeldVKsRef.current;
            const repeat = Boolean(ev.down) && held.has(vk);
            if (ev.down) held.add(vk); else held.delete(vk);
            flushTextInput();
            onControlEvent({
                type: ev.down ? 'keydown' : 'keyup',
                key: SYSTEM_KEY_NAMES[vk] || '',
                code: '',
                keyCode: vk,
                shiftKey: Boolean(ev.shift),
                ctrlKey: Boolean(ev.ctrl),
                altKey: Boolean(ev.alt),
                metaKey: vk === 0x5B || vk === 0x5C || hookWinHeld(),
                repeat,
            });
        };
        const unsubscribeSystemKeys = (window as any).electronAPI?.systemKeys?.onKey?.(handleSystemKey);

        // Focus left this window mid-chord (Alt+Tab away with system keys off,
        // a click on another app, a tab switch): release everything we're
        // holding on the host, or it keeps Alt/Ctrl/Win pressed until the next
        // keystroke — sometimes for the rest of the session.
        const releaseAllKeys = () => {
            flushTextInput();
            const held = new Set<number>([...pressedVKsRef.current, ...hookHeldVKsRef.current]);
            pressedVKsRef.current.clear();
            hookHeldVKsRef.current.clear();
            if (held.size === 0) return;
            for (const vk of held) {
                onControlEvent({ type: 'keyup', key: '', code: '', keyCode: vk, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false });
            }
            onControlEvent({ type: 'release-keys' });
        };

        // Use capturing phase to ensure we beat button/input focus
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('blur', releaseAllKeys);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('blur', releaseAllKeys);
            if (typeof unsubscribeSystemKeys === 'function') unsubscribeSystemKeys();
            try { releaseAllKeys(); } catch { /* channel may already be gone */ }
        };
    }, [viewerStatus, onControlEvent, isMobileDevice]);

    const initDecoder = () => {
        if (remoteStream || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        if (decoderRef.current) {
            try { decoderRef.current.close(); } catch { }
        }

        const VideoDecoder = (window as any).VideoDecoder;
        if (!VideoDecoder) {
            console.warn('[VideoPlayer] VideoDecoder not available in this environment.');
            return;
        }

        const decoder = new VideoDecoder({
            output: (frame: any) => {
                if (!canvasRef.current || (decoderRef.current && decoderRef.current.state === 'closed')) {
                    frame.close();
                    return;
                }
                const frameWidth = frame.displayWidth || frame.codedWidth || canvasRef.current.width;
                const frameHeight = frame.displayHeight || frame.codedHeight || canvasRef.current.height;
                if (frameWidth > 0 && frameHeight > 0 && (canvasRef.current.width !== frameWidth || canvasRef.current.height !== frameHeight)) {
                    canvasRef.current.width = frameWidth;
                    canvasRef.current.height = frameHeight;
                }
                if (!hasReceivedKeyframe) setHasReceivedKeyframe(true);
                if (Math.random() < 0.01) console.log(`[VideoPlayer] Output Frame: ${frame.displayWidth}x${frame.displayHeight}`);
                try {
                    ctx.drawImage(frame, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                } catch (err) {
                    console.error('[VideoPlayer] Draw error:', err);
                }
                frame.close();
            },
            error: (e: any) => {
                console.error('[VideoPlayer] Decoder hardware error:', e);
                setDecodeErrors(d => d + 1);
                setHasReceivedKeyframe(false);
                setTimeout(initDecoder, 1000);
            },
        });

        decoder.configure({
            codec: 'avc1.42E01F', // Baseline 3.1 - Most universal H264 profile
            optimizeForLatency: true,
        });

        decoderRef.current = decoder;
        console.log('[VideoPlayer] Decoder initialized.');
    };

    useEffect(() => {
        initDecoder();
        return () => {
            if (decoderRef.current) decoderRef.current.close();
            decoderRef.current = null;
        };
    }, [remoteStream]);

    // Assign stream to video element whenever it changes
    useEffect(() => {
        if (!videoRef.current) return;
        if (!mediaActive || !remoteStream) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
            return;
        }
        lastPresentedFrameAtRef.current = performance.now();

        console.log('[VideoPlayer] Stream received. Initializing decoder...');
        const video = videoRef.current;
        // Guarded: a redundant srcObject re-assignment resets the element's decode
        // pipeline and drops frames. Audio flags live in their own effect.
        if (video.srcObject !== remoteStream) {
            video.srcObject = remoteStream;
        }

        const tryPlay = async () => {
            try {
                await video.play();
                setIsAutoPlayBlocked(false);
            } catch (err: any) {
                console.warn('[VideoPlayer] Auto-play blocked:', err);
                if (err.name !== 'AbortError') {
                    setIsAutoPlayBlocked(true);
                }
            }
        };
        tryPlay();

        let presentationCallbackId: number | null = null;
        const requestPresentedFrame = (video as any).requestVideoFrameCallback;
        if (typeof requestPresentedFrame === 'function' && firstPresentedStreamRef.current !== remoteStream) {
            presentationCallbackId = requestPresentedFrame.call(video, () => {
                if (firstPresentedStreamRef.current === remoteStream) return;
                firstPresentedStreamRef.current = remoteStream;
                const now = Date.now();
                const timeline = (remoteStream as any).__r365PipelineTimeline || {};
                const elapsed = (startedAt: unknown) =>
                    typeof startedAt === 'number' && startedAt > 0 ? Math.max(0, now - startedAt) : -1;
                const sessionMs = elapsed(timeline.startedAt);
                const offerMs = elapsed(timeline.offerAt);
                const connectedMs = elapsed(timeline.connectedAt);
                const trackMs = elapsed(timeline.trackAt);
                const message = `[Perf] Viewer first-presented-frame session-to-present=${sessionMs}ms offer-to-present=${offerMs}ms connected-to-present=${connectedMs}ms track-to-present=${trackMs}ms`;
                console.log(message);
                (window as any).electronAPI?.log?.(message);
                onFirstFramePresented?.();
            });
        }

        const markVideoReady = () => {
            const width = video.videoWidth || 0;
            const height = video.videoHeight || 0;
            if (width <= 0 || height <= 0) {
                return;
            }
            if (width < 16 || height < 16) {
                console.warn(`[VideoPlayer] Ignoring invalid remote video dimensions: ${width}x${height}`);
                if (controlChannelRef.current?.readyState === 'open') {
                    controlChannelRef.current.send(JSON.stringify({ type: 'request-keyframe' }));
                }
                return;
            }

            console.log(`[VideoPlayer] Remote video ready: ${width}x${height}`);
            setRemoteVideoSize({ width, height });
            setProtectedSurfaceNotice(false);
            setHasReceivedKeyframe(true);
            setViewerStatus((prev: any) => (prev !== 'streaming' ? 'streaming' : prev));
        };

        video.addEventListener('loadedmetadata', markVideoReady);
        video.addEventListener('loadeddata', markVideoReady);
        video.addEventListener('canplay', markVideoReady);
        video.addEventListener('playing', markVideoReady);
        video.addEventListener('resize', markVideoReady);
        markVideoReady();

        const fallbackId = window.setTimeout(() => {
            if (remoteStream.getVideoTracks().some((track) => track.readyState === 'live')) {
                console.warn('[VideoPlayer] Live remote track has no decoded dimensions yet. Requesting keyframe.');
                if (controlChannelRef.current?.readyState === 'open') {
                    controlChannelRef.current.send(JSON.stringify({ type: 'request-keyframe' }));
                }
            }
        }, 1800);

        // Round 10: Elite Mode Guard
        // Browser sometimes "freezes" the video tag if the tab was inactive. 
        // We just ensure play() is active without destructive srcObject resets.
        const recoveryId = setInterval(() => {
            const width = video.videoWidth || 0;
            const height = video.videoHeight || 0;
            if (width >= 16 && height >= 16) {
                setHasReceivedKeyframe(true);
            } else if (sessionCode) {
                console.log(`[VideoPlayer] Resolution ${width}x${height}. Ensuring play() active...`);
                tryPlay();
            }
        }, 5000);

        return () => {
            if (presentationCallbackId != null && typeof (video as any).cancelVideoFrameCallback === 'function') {
                (video as any).cancelVideoFrameCallback(presentationCallbackId);
            }
            window.clearTimeout(fallbackId);
            clearInterval(recoveryId);
            video.removeEventListener('loadedmetadata', markVideoReady);
            video.removeEventListener('loadeddata', markVideoReady);
            video.removeEventListener('canplay', markVideoReady);
            video.removeEventListener('playing', markVideoReady);
            video.removeEventListener('resize', markVideoReady);
        };
        // Deliberately narrow deps: re-running this effect re-attaches listeners and
        // used to re-assign srcObject on every status flip mid-session.
    }, [mediaActive, remoteStream, sessionCode, setViewerStatus, onFirstFramePresented]);

    // --- Manual Wheel Listener (Fixes Passive event error) ---
    // Deltas are ACCUMULATED and flushed on a 16ms trailing edge instead of one
    // message per event: high-resolution trackpads emit small-delta events at
    // frame rate, and under congestion those per-event messages were dropped
    // wholesale (chunky scroll). Merging preserves total scroll distance.
    const wheelAccumRef = useRef<{ dx: number; dy: number } | null>(null);
    const wheelFlushTimerRef = useRef<number | null>(null);
    const lastWheelSentRef = useRef<number>(0);
    useEffect(() => {
        const target = remoteStream ? videoRef.current : canvasRef.current;
        if (!target) return;

        const WHEEL_GATE_MS = 16;
        const flushWheel = () => {
            wheelFlushTimerRef.current = null;
            const acc = wheelAccumRef.current;
            wheelAccumRef.current = null;
            if (!acc) return;
            lastWheelSentRef.current = Date.now();
            const { x, y } = normalizedMouseRef.current;
            onControlEvent({ type: 'wheel', deltaX: acc.dx, deltaY: acc.dy, x, y });
        };
        const onWheel = (e: Event) => {
            const we = e as WheelEvent;
            we.preventDefault();
            const acc = wheelAccumRef.current;
            if (acc) {
                // A flush is already scheduled — merge into it.
                acc.dx += we.deltaX;
                acc.dy += we.deltaY;
                return;
            }
            const now = Date.now();
            const since = now - lastWheelSentRef.current;
            if (since >= WHEEL_GATE_MS) {
                // Gate open: first event of a burst goes out immediately.
                lastWheelSentRef.current = now;
                const { x, y } = normalizedMouseRef.current;
                onControlEvent({ type: 'wheel', deltaX: we.deltaX, deltaY: we.deltaY, x, y });
                return;
            }
            wheelAccumRef.current = { dx: we.deltaX, dy: we.deltaY };
            wheelFlushTimerRef.current = window.setTimeout(flushWheel, Math.max(1, WHEEL_GATE_MS - since + 1));
        };

        target.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            target.removeEventListener('wheel', onWheel);
            if (wheelFlushTimerRef.current != null) {
                window.clearTimeout(wheelFlushTimerRef.current);
                wheelFlushTimerRef.current = null;
            }
            wheelAccumRef.current = null;
        };
    }, [remoteStream, onControlEvent, scaleMode, isMobileDevice]);

    const lastMouseMoveRef = useRef<number>(0);
    const MOUSE_THROTTLE_MS = 16; // ~60Hz keeps control smooth without crowding the data channel
    // Trailing-edge flush: the plain time-gate silently dropped the LAST move
    // before the pointer paused, leaving the remote cursor one gate (~16ms of
    // travel) short of where the user actually stopped — visible as clicks
    // landing next to slow, precise targets. Rejected moves are stashed and the
    // freshest one is sent when the gate reopens.
    const pendingMoveRef = useRef<{ x: number; y: number; button: number } | null>(null);
    const pendingMoveTimerRef = useRef<number | null>(null);
    useEffect(() => () => {
        if (pendingMoveTimerRef.current != null) window.clearTimeout(pendingMoveTimerRef.current);
    }, []);
    const cancelPendingMove = () => {
        pendingMoveRef.current = null;
        if (pendingMoveTimerRef.current != null) {
            window.clearTimeout(pendingMoveTimerRef.current);
            pendingMoveTimerRef.current = null;
        }
    };
    const gateMouseMove = (x: number, y: number, button: number): boolean => {
        const now = Date.now();
        const since = now - lastMouseMoveRef.current;
        if (since < MOUSE_THROTTLE_MS) {
            pendingMoveRef.current = { x, y, button };
            if (pendingMoveTimerRef.current == null) {
                pendingMoveTimerRef.current = window.setTimeout(() => {
                    pendingMoveTimerRef.current = null;
                    const pending = pendingMoveRef.current;
                    pendingMoveRef.current = null;
                    if (pending) {
                        lastMouseMoveRef.current = Date.now();
                        onControlEvent({ type: 'mousemove', button: pending.button, x: pending.x, y: pending.y });
                    }
                }, Math.max(1, MOUSE_THROTTLE_MS - since + 1));
            }
            return false;
        }
        lastMouseMoveRef.current = now;
        pendingMoveRef.current = null;
        return true;
    };
    // Track the last normalized mouse position so wheel events can include it
    const normalizedMouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
    const inputGeometryRef = useRef<{
        rect: { left: number; top: number; width: number; height: number };
        videoWidth: number;
        videoHeight: number;
    } | null>(null);
    const isDraggingRef = useRef<boolean>(false);
    const activeDragRef = useRef<boolean>(false);

    const uiTimeoutRef = useRef<any>(null);

    const resetUITimeout = () => {
        if (viewerContainerRef.current) {
            viewerContainerRef.current.setAttribute('data-ui-hidden', 'false');
        }
        clearTimeout(uiTimeoutRef.current);
        uiTimeoutRef.current = setTimeout(() => {
            if (viewerContainerRef.current) {
                viewerContainerRef.current.setAttribute('data-ui-hidden', 'true');
            }
        }, 2000);
    };

    // Mousemove is a 60Hz hot path. Calling getBoundingClientRect() for every
    // event can force Chromium to synchronously flush layout before input can
    // be sent. Refresh geometry only when the element/video/window changes.
    useEffect(() => {
        const target = remoteStream ? videoRef.current : canvasRef.current;
        if (!target) {
            inputGeometryRef.current = null;
            return;
        }
        const updateGeometry = () => {
            const rect = target.getBoundingClientRect();
            inputGeometryRef.current = {
                rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                videoWidth: remoteStream && videoRef.current ? videoRef.current.videoWidth : canvasRef.current?.width || 0,
                videoHeight: remoteStream && videoRef.current ? videoRef.current.videoHeight : canvasRef.current?.height || 0,
            };
        };
        updateGeometry();
        const observer = new ResizeObserver(updateGeometry);
        observer.observe(target);
        target.addEventListener('resize', updateGeometry);
        window.addEventListener('resize', updateGeometry);
        return () => {
            observer.disconnect();
            target.removeEventListener('resize', updateGeometry);
            window.removeEventListener('resize', updateGeometry);
            inputGeometryRef.current = null;
        };
    }, [remoteStream, scaleMode, isMobileDevice]);

    const getNormalizedPoint = (clientX: number, clientY: number) => {
        const target = remoteStream ? videoRef.current : canvasRef.current;
        const geometry = inputGeometryRef.current;
        const rect = geometry?.rect || target?.getBoundingClientRect();
        if (!rect || !target) return null;

        const videoWidth = geometry?.videoWidth ?? (remoteStream && videoRef.current ? videoRef.current.videoWidth : canvasRef.current?.width || 0);
        const videoHeight = geometry?.videoHeight ?? (remoteStream && videoRef.current ? videoRef.current.videoHeight : canvasRef.current?.height || 0);
        let x = (clientX - rect.left) / Math.max(rect.width, 1);
        let y = (clientY - rect.top) / Math.max(rect.height, 1);

        if (videoWidth > 0 && videoHeight > 0) {
            const containerRatio = rect.width / rect.height;
            const videoRatio = videoWidth / videoHeight;
            const useCoverMapping = !isMobileDevice && scaleMode === 'fill';
            let actualWidth: number;
            let actualHeight: number;
            let offsetX: number;
            let offsetY: number;

            if (useCoverMapping) {
                if (containerRatio > videoRatio) {
                    actualWidth = rect.width;
                    actualHeight = rect.width / videoRatio;
                    offsetX = 0;
                    offsetY = (rect.height - actualHeight) / 2;
                } else {
                    actualHeight = rect.height;
                    actualWidth = rect.height * videoRatio;
                    offsetX = (rect.width - actualWidth) / 2;
                    offsetY = 0;
                }
            } else if (containerRatio > videoRatio) {
                actualHeight = rect.height;
                actualWidth = rect.height * videoRatio;
                offsetX = (rect.width - actualWidth) / 2;
                offsetY = 0;
            } else {
                actualWidth = rect.width;
                actualHeight = rect.width / videoRatio;
                offsetX = 0;
                offsetY = (rect.height - actualHeight) / 2;
            }

            x = (clientX - (rect.left + offsetX)) / Math.max(actualWidth, 1);
            y = (clientY - (rect.top + offsetY)) / Math.max(actualHeight, 1);
        }

        if (y < 0.01) y = 0;
        if (y > 0.99) y = 1;
        if (x < 0.01) x = 0;
        if (x > 0.99) x = 1;

        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
            rect,
        };
    };

    useEffect(() => {
        const onWindowMouseUp = (event: MouseEvent) => {
            if (!isDraggingRef.current || !activeDragRef.current) return;
            const currentTarget = remoteStream ? videoRef.current : canvasRef.current;
            if (currentTarget && event.target instanceof Node && currentTarget.contains(event.target)) return;
            const point = getNormalizedPoint(event.clientX, event.clientY);
            if (!point) return;
            normalizedMouseRef.current = { x: point.x, y: point.y };
            cancelPendingMove();
            onControlEvent({ type: 'mouseup', button: event.button ?? 0, x: point.x, y: point.y });
            isDraggingRef.current = false;
            activeDragRef.current = false;
        };

        window.addEventListener('mouseup', onWindowMouseUp, true);
        return () => window.removeEventListener('mouseup', onWindowMouseUp, true);
    }, [onControlEvent, remoteStream, scaleMode, isMobileDevice]);

    const handleMouseEvent = (e: React.MouseEvent, type: string) => {
        resetUITimeout();

        const target = remoteStream ? videoRef.current : canvasRef.current;
        const geometry = inputGeometryRef.current;
        const rect = geometry?.rect || target?.getBoundingClientRect();
        if (rect && target) {
            // Get intrinsic video/canvas dimensions for letterbox correction
            let videoWidth: number, videoHeight: number;
            if (geometry) {
                videoWidth = geometry.videoWidth;
                videoHeight = geometry.videoHeight;
            } else if (remoteStream && videoRef.current) {
                videoWidth = videoRef.current.videoWidth;
                videoHeight = videoRef.current.videoHeight;
            } else if (canvasRef.current) {
                videoWidth = canvasRef.current.width;   // intrinsic 1920
                videoHeight = canvasRef.current.height; // intrinsic 1080
            } else {
                videoWidth = 0; videoHeight = 0;
            }

            if (videoWidth === 0 || videoHeight === 0) {
                // Fallback to simple client-to-element ratio if stream isn't reporting intrinsic dimensions yet
                let x = (e.clientX - rect.left) / rect.width;
                let y = (e.clientY - rect.top) / rect.height;
                if (type === 'mousedown') console.warn('[Diagnostic] Tap: Fallback used (videoWidth 0)');

                // Clamp to 0.0–1.0
                x = Math.max(0, Math.min(1, x));
                y = Math.max(0, Math.min(1, y));

                normalizedMouseRef.current = { x, y };

                if (type === 'mousedown') {
                    cancelPendingMove();
                    isDraggingRef.current = true;
                    activeDragRef.current = true;
                } else if (type === 'mouseup') {
                    cancelPendingMove();
                    isDraggingRef.current = false;
                    activeDragRef.current = false;
                } else if (type === 'mousemove') {
                    const mobileRemote = isMobileDevice || deviceType?.toLowerCase?.() === 'android' || deviceType?.toLowerCase?.() === 'ios';
                    if (mobileRemote && e.buttons === 0) {
                        return;
                    }
                    if (e.buttons === 0) {
                        if (isDraggingRef.current) {
                            onControlEvent({ type: 'mouseup', button: 0, x, y });
                            isDraggingRef.current = false;
                            activeDragRef.current = false;
                        }
                        if (scaleMode !== 'actual') return; // Don't spam layout with hover moves unless in 1:1 scroll mode
                    }
                    if (!gateMouseMove(x, y, (e as any).button)) return;
                }

                onControlEvent({ type, button: (e as any).button, x, y });
                return;
            }

            let x: number, y: number;

            // Fill mode uses cover math; fit and actual use containment so the
            // remote screen stays fully visible without scrolling.
            const containerWidth = rect.width;
            const containerHeight = rect.height;
            const containerRatio = containerWidth / containerHeight;
            const videoRatio = videoWidth / videoHeight;
            const useCoverMapping = !isMobileDevice && scaleMode === 'fill';

            let actualWidth, actualHeight, offsetX, offsetY;
            if (useCoverMapping) {
                if (containerRatio > videoRatio) {
                    actualWidth = containerWidth;
                    actualHeight = containerWidth / videoRatio;
                    offsetX = 0;
                    offsetY = (containerHeight - actualHeight) / 2;
                } else {
                    actualHeight = containerHeight;
                    actualWidth = containerHeight * videoRatio;
                    offsetX = (containerWidth - actualWidth) / 2;
                    offsetY = 0;
                }
            } else {
                if (containerRatio > videoRatio) {
                    actualHeight = containerHeight;
                    actualWidth = containerHeight * videoRatio;
                    offsetX = (containerWidth - actualWidth) / 2;
                    offsetY = 0;
                } else {
                    actualWidth = containerWidth;
                    actualHeight = containerWidth / videoRatio;
                    offsetX = 0;
                    offsetY = (containerHeight - actualHeight) / 2;
                }
            }

            // Avoid division by zero if video dimensions are not yet available
            x = actualWidth > 0 ? (e.clientX - (rect.left + offsetX)) / actualWidth : 0.5;
            y = actualHeight > 0 ? (e.clientY - (rect.top + offsetY)) / actualHeight : 0.5;

            // -- Round 9: Edge-to-Edge Calibration --
            // If we are at the very top (y < 0.01), ensure mathematical 0.0 to trigger notifications easily
            if (y < 0.01) y = 0;
            if (y > 0.99) y = 1;
            if (x < 0.01) x = 0;
            if (x > 0.99) x = 1;

            // Clamp to 0.0–1.0
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));

            // Always keep the latest normalized position for wheel events
            normalizedMouseRef.current = { x, y };

            if (type === 'mousedown') {
                cancelPendingMove();
                isDraggingRef.current = true;
                activeDragRef.current = true;
            } else if (type === 'mouseup') {
                cancelPendingMove();
                isDraggingRef.current = false;
                activeDragRef.current = false;
            } else if (type === 'mousemove') {
                const mobileRemote = isMobileDevice || deviceType?.toLowerCase?.() === 'android' || deviceType?.toLowerCase?.() === 'ios';
                if (mobileRemote && e.buttons === 0) {
                    return;
                }
                if (e.buttons === 0) {
                    // Mouse released without us catching onMouseUp (dragged outside the window or iframe)
                    if (isDraggingRef.current) {
                        onControlEvent({ type: 'mouseup', button: 0, x, y });
                        isDraggingRef.current = false;
                    }
                    // For mobile, hover is irrelevant. Keep it purely to valid drags.
                    // For Desktop PC, we might still want hover tracking. 
                    // But if scaleMode !== 'actual', it's fitted/mobile viewing.
                    // Let's filter it generally if no button is pushed for mobile.
                }

                // Early exit for Mobile specifically — BEFORE the throttle gate, so a
                // suppressed hover can never be stashed for the trailing flush.
                // An UNKNOWN device type is treated as a desktop: dropping its
                // hover moves made the host cursor teleport only at the click,
                // so hover effects trailed the click and it read as input lag.
                if (e.buttons === 0 && deviceType && (deviceType.toLowerCase() === 'mobile' || deviceType.toLowerCase() === 'android' || deviceType.toLowerCase() === 'ios')) {
                    return;
                }

                if (!gateMouseMove(x, y, (e as any).button)) return;
            }

            onControlEvent({ type, button: (e as any).button, x, y });
        }
    };

    const handleWheelEvent = (e: React.WheelEvent) => {
        // Handled by manual listener above to avoid passive event error
    };

    const remoteAudioTrackCount = remoteStream?.getAudioTracks?.().length || 0;
    const toggleRemoteAudio = () => {
        if (!remoteAudioTrackCount) {
            setRemoteAudioEnabled(false);
            setRemoteAudioNotice('Remote audio is not available. The host is sending video only.');
            window.setTimeout(() => setRemoteAudioNotice(''), 2600);
            return;
        }
        setRemoteAudioNotice('');
        setRemoteAudioEnabled((enabled) => {
            const next = !enabled;
            // Muting is local-only (the host keeps capturing for other viewers),
            // and it must stick: auto-play checks this ref before re-enabling.
            userMutedAudioRef.current = !next;
            // Let the host know someone can hear the machine — it surfaces on
            // their dock, where they can mute the share.
            onControlEvent({ type: 'audio-listen', on: next });
            return next;
        });
    };
    const sendKeyCombo = (keys: number[]) => onControlEvent({ type: 'keyCombo', keys });
    const triggerFilePicker = () => {
        setTransferProgress(null);
        fileInputRef.current?.click();
    };

    // Relay-routing override. Read once per render so the menu label reflects the real state.
    const relayForced = (() => {
        try { return window.localStorage?.getItem('r365_force_relay') === '1'; } catch { return false; }
    })();
    const toggleRelayRouting = () => {
        try {
            const next = relayForced ? '0' : '1';
            window.localStorage.setItem('r365_force_relay', next);
            setFileTransferStatus({
                direction: 'send',
                progress: 0,
                state: 'complete',
                message: next === '1'
                    ? 'Relay routing enabled. Disconnect and reconnect for it to take effect.'
                    : 'Direct routing restored. Disconnect and reconnect for it to take effect.',
            });
        } catch { /* storage unavailable — nothing to toggle */ }
    };
    const sendLocalFilePath = async (path: string) => {
        const electronApi = (window as any).electronAPI;
        if (!electronApi?.files?.read) return triggerFilePicker();
        const file = await electronApi.files.read(path);
        const bytes = file.data instanceof Uint8Array
            ? file.data
            : file.data?.data
                ? new Uint8Array(file.data.data)
                : new Uint8Array(file.data);
        const CHUNK_SIZE = 16 * 1024;
        const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);
        setTransferProgress({ name: file.name, p: 0 });
        setFileTransferStatus({ direction: 'send', name: file.name, progress: 0, state: 'transferring', message: `Sending ${file.name} to the remote computer...` });

        // FLOW CONTROL — this loop previously pushed every chunk straight at the data channel
        // with no backpressure whatsoever. On a large file (a 118MB APK is ~7,400 chunks) that
        // buries the SCTP send buffer and blocks the JS thread, the peer connection gives up,
        // the session reconnects and the transfer restarts — which is why the percentage
        // climbed, jumped BACKWARDS and then stalled. The file-picker path below already did
        // this correctly; this path just never got it.
        const channel = controlChannelRef.current;
        if (channel) channel.bufferedAmountLowThreshold = 65536; // 64KB
        const waitForBuffer = () => {
            if (!channel || channel.bufferedAmount < 262144) return Promise.resolve(); // 256KB target
            return new Promise<void>((resolve) => {
                const handler = () => {
                    channel.removeEventListener('bufferedamountlow', handler);
                    resolve();
                };
                channel.addEventListener('bufferedamountlow', handler);
            });
        };

        try {
            for (let i = 0; i < totalChunks; i++) {
                await waitForBuffer();
                const start = i * CHUNK_SIZE;
                const chunk = bytes.slice(start, Math.min(start + CHUNK_SIZE, bytes.length));
                const header = JSON.stringify({ type: 'file-chunk', name: file.name, mimeType: 'application/octet-stream', totalSize: bytes.length, offset: start, chunkIndex: i, totalChunks });
                const headerBuffer = new TextEncoder().encode(header);
                const fullBuffer = new Uint8Array(4 + headerBuffer.length + chunk.byteLength);
                const view = new DataView(fullBuffer.buffer);
                view.setUint32(0, headerBuffer.length, true);
                fullBuffer.set(headerBuffer, 4);
                fullBuffer.set(chunk, 4 + headerBuffer.length);
                onControlEvent(fullBuffer);
                if (i % 20 === 0 || i === totalChunks - 1) {
                    const progress = Math.round(((i + 1) / totalChunks) * 100);
                    setTransferProgress({ name: file.name, p: progress });
                    setFileTransferStatus({ direction: 'send', name: file.name, progress, state: 'transferring', message: `Sending ${file.name} to the remote computer...` });
                }
            }
            setTransferProgress({ name: file.name, p: 100 });
            setFileTransferStatus({ direction: 'send', name: file.name, progress: 100, state: 'complete', message: `${file.name} was sent to the remote computer.` });
        } catch (err: any) {
            console.error('[FileTransfer] FAILED:', err);
            setFileTransferStatus({ direction: 'send', name: file.name, progress: 0, state: 'error', message: err?.message || 'File transfer failed.' });
        }
    };
    const requestFileFromHost = () => {
        setFileTransferStatus({
            direction: 'receive',
            progress: 0,
            state: 'waiting',
            message: 'Waiting for the remote computer to choose a file...',
        });
        onControlEvent({ type: 'request-file-from-host' });
    };
    const requestRemoteFilePath = (path: string) => {
        setFileTransferStatus({
            direction: 'receive',
            progress: 0,
            state: 'waiting',
            message: 'Preparing The Remote File...',
        });
        onControlEvent({ type: 'request-file-from-host-path', path });
    };
    const pasteLocalClipboard = async () => {
        const electronApi = (window as any).electronAPI;
        const text = electronApi?.clipboard?.readText
            ? await electronApi.clipboard.readText()
            : await navigator.clipboard?.readText?.();
        if (text) onControlEvent(isMobileDevice ? { type: 'pasteText', text } : { type: 'typeText', text });
    };

    // --- Screenshot & screen recording of the remote stream ---
    // 'idle' -> 'recording' -> 'stopped' (chunks held, waiting on Save/Discard) -> 'idle'
    const [recordingPhase, setRecordingPhase] = useState<'idle' | 'recording' | 'stopped'>('idle');
    // Tell the host (and through it, everyone in the session) when this viewer
    // starts or stops recording. Keyed on the phase so every entry/exit path is
    // covered, and a re-render can't re-announce.
    const announcedRecordingRef = useRef(false);
    useEffect(() => {
        const recording = recordingPhase === 'recording';
        if (recording === announcedRecordingRef.current) return;
        announcedRecordingRef.current = recording;
        onControlEvent({ type: 'recording-state', on: recording });
    }, [recordingPhase, onControlEvent]);
    const [recordingElapsed, setRecordingElapsed] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<number | null>(null);

    // --- Platform recording policy (super admin → Recording Policies) -------
    // Fetched once per session and enforced here: auto-record mode, the
    // recorder's bitrate tier, watermark burn-in, and whether this user may
    // record at all (recordings save to this machine, so "Only Admins can
    // download" gates the whole Record control).
    const [recordingPolicy, setRecordingPolicy] = useState<{ autoRecord: string; quality: string; watermark: boolean; canDownload: boolean } | null>(null);
    const [showAutoRecordPrompt, setShowAutoRecordPrompt] = useState(false);
    const autoRecordHandledRef = useRef(false);
    const watermarkCleanupRef = useRef<(() => void) | null>(null);
    const watermarkPlaybackRef = useRef<((active: boolean) => void) | null>(null);
    const mediaActiveRef = useRef(mediaActive);
    mediaActiveRef.current = mediaActive;

    useEffect(() => {
        const recorder = mediaRecorderRef.current;
        if (!mediaActive && recorder?.state === 'recording') recorder.pause();
        if (mediaActive && recorder?.state === 'paused') recorder.resume();
        watermarkPlaybackRef.current?.(mediaActive);
    }, [mediaActive, recordingPhase]);

    useEffect(() => {
        if (!remoteStream) {
            autoRecordHandledRef.current = false;
            setShowAutoRecordPrompt(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get('/api/auth/recording-policy');
                if (!cancelled && data) setRecordingPolicy(data);
            } catch { /* policy unreachable — manual recording stays available */ }
        })();
        return () => { cancelled = true; };
    }, [remoteStream]);

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    const sessionFileStamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const takeScreenshot = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
            if (blob) downloadBlob(blob, `remote365-screenshot-${sessionFileStamp()}.png`);
        }, 'image/png');
    };

    const startRecording = () => {
        if (!mediaActive || !remoteStream || recordingPhase !== 'idle') return;
        // Policy: "Only Admins Can Download" — recordings save locally, so a
        // user who may not download may not record either.
        if (recordingPolicy?.canDownload === false) return;
        try {
            const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
                .find((type) => (window as any).MediaRecorder?.isTypeSupported?.(type)) || 'video/webm';
            // Watermark policy: composite the live video plus a corner caption
            // onto a canvas and record THAT stream, so the mark is burned into
            // the saved file (an on-screen overlay would not survive saving).
            let streamToRecord: MediaStream = remoteStream;
            const videoEl = videoRef.current;
            if (recordingPolicy?.watermark !== false && videoEl && videoEl.videoWidth > 0 && typeof (document.createElement('canvas') as any).captureStream === 'function') {
                const canvas = document.createElement('canvas');
                canvas.width = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    let raf = 0;
                    const fontPx = Math.max(14, Math.round(canvas.height / 45));
                    const draw = () => {
                        if (!mediaActiveRef.current) return;
                        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                        const label = `Remote365 • ${deviceName || 'remote session'} • ${new Date().toLocaleString()}`;
                        ctx.font = `${fontPx}px sans-serif`;
                        const width = ctx.measureText(label).width;
                        const pad = Math.round(fontPx / 2);
                        const x = canvas.width - width - pad * 3;
                        const y = canvas.height - pad * 2;
                        ctx.fillStyle = 'rgba(0,0,0,0.35)';
                        ctx.fillRect(x - pad, y - fontPx - pad / 2, width + pad * 2, fontPx + pad * 1.5);
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        ctx.fillText(label, x, y);
                        raf = requestAnimationFrame(draw);
                    };
                    raf = requestAnimationFrame(draw);
                    watermarkPlaybackRef.current = (active) => {
                        cancelAnimationFrame(raf);
                        if (active) raf = requestAnimationFrame(draw);
                    };
                    const canvasStream = canvas.captureStream(30);
                    remoteStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
                    streamToRecord = canvasStream;
                    watermarkCleanupRef.current = () => {
                        cancelAnimationFrame(raf);
                        canvasStream.getVideoTracks().forEach((track) => track.stop());
                        watermarkCleanupRef.current = null;
                        watermarkPlaybackRef.current = null;
                    };
                }
            }
            const recorder = new MediaRecorder(streamToRecord, {
                mimeType,
                // Quality policy tier; the platform default is 1080p/8Mbps.
                videoBitsPerSecond: RECORDING_BPS[recordingPolicy?.quality || '1080p'] || 8_000_000,
            });
            recordedChunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data?.size) recordedChunksRef.current.push(event.data);
            };
            recorder.onstop = () => {
                mediaRecorderRef.current = null;
                watermarkCleanupRef.current?.();
                // Chunks stay in recordedChunksRef — the top-right pill now shows
                // "Save Recording" / discard until the user decides, instead of
                // auto-downloading the instant the recorder stops.
                setRecordingPhase(recordedChunksRef.current.length ? 'stopped' : 'idle');
            };
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            setRecordingElapsed(0);
            if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = window.setInterval(() => { if (mediaActiveRef.current) setRecordingElapsed((s) => s + 1); }, 1000);
            setRecordingPhase('recording');
        } catch (err) {
            watermarkCleanupRef.current?.();
            console.error('[Viewer] Screen recording failed to start:', err);
        }
    };

    const stopRecording = () => {
        if (recordingTimerRef.current) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        mediaRecorderRef.current?.stop();
    };

    const saveRecording = () => {
        if (recordedChunksRef.current.length) {
            downloadBlob(new Blob(recordedChunksRef.current, { type: 'video/webm' }), `remote365-recording-${sessionFileStamp()}.webm`);
        }
        recordedChunksRef.current = [];
        setRecordingElapsed(0);
        setRecordingPhase('idle');
    };

    const discardRecording = () => {
        recordedChunksRef.current = [];
        setRecordingElapsed(0);
        setRecordingPhase('idle');
    };

    // Auto-record enforcement: 'always' starts silently once the first frame
    // is up (the watermark compositor needs real video dimensions); 'ask'
    // raises a one-time prompt. Never fires for users the policy bars from
    // saving recordings, and never re-fires within one session.
    useEffect(() => {
        if (!mediaActive) return;
        if (!recordingPolicy || !remoteStream || !hasReceivedKeyframe || autoRecordHandledRef.current) return;
        if (recordingPolicy.canDownload === false || recordingPhase !== 'idle') {
            autoRecordHandledRef.current = true;
            return;
        }
        if (recordingPolicy.autoRecord === 'always') {
            autoRecordHandledRef.current = true;
            startRecording();
        } else if (recordingPolicy.autoRecord === 'ask') {
            autoRecordHandledRef.current = true;
            setShowAutoRecordPrompt(true);
        }
    }, [mediaActive, recordingPolicy, remoteStream, hasReceivedKeyframe, recordingPhase]);

    // The "Record This Session?" prompt sits over the remote screen, so it must not
    // wait for an answer forever — an unanswered prompt is just an obstruction. It
    // dismisses itself after 10s, which reads as "not now" (the safe default: the
    // policy asked rather than mandated). Answering it either way cancels the timer.
    useEffect(() => {
        if (!showAutoRecordPrompt) return;
        const timer = window.setTimeout(() => setShowAutoRecordPrompt(false), 10_000);
        return () => window.clearTimeout(timer);
    }, [showAutoRecordPrompt]);

    // Stop the recorder if the session ends mid-recording.
    useEffect(() => () => {
        try { mediaRecorderRef.current?.stop(); } catch { }
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    }, []);
    const remoteShortcutActions: Record<'essential' | 'power' | 'transfer', RemoteShortcutAction[]> = {
        essential: isMobileDevice ? [
            { label: 'Home', hint: 'Android', detail: 'Go to the phone home screen.', run: () => onControlEvent({ type: 'action', action: 'home' }) },
            { label: 'Back', hint: 'Esc', detail: 'Go back in the current app.', run: () => onControlEvent({ type: 'globalAction', action: 1 }) },
            { label: 'Recent Apps', hint: 'Switcher', detail: 'Open Android recent apps.', run: () => onControlEvent({ type: 'action', action: 'recents' }) },
            { label: 'Notifications', hint: 'Shade', detail: 'Open the notification shade.', run: () => onControlEvent({ type: 'shortcut', key: 'notifications' }) },
            { label: 'Quick Settings', hint: 'Panel', detail: 'Open Android quick settings.', run: () => onControlEvent({ type: 'shortcut', key: 'control-center' }) },
            { label: 'Paste Clipboard', hint: 'Text', detail: 'Type your local clipboard into the phone.', run: pasteLocalClipboard },
        ] : [
            { label: 'Task Manager', hint: 'Ctrl + Shift + Esc', detail: 'Open recovery and process controls.', run: () => sendKeyCombo([0x11, 0x10, 0x1B]) },
            { label: 'Switch App', hint: 'Alt + Tab', detail: 'Move through open windows.', run: () => sendKeyCombo([0x12, 0x09]) },
            { label: 'Close Window', hint: 'Alt + F4', detail: 'Close the foreground app.', run: () => sendKeyCombo([0x12, 0x73]) },
            { label: 'Show Desktop', hint: 'Win + D', detail: 'Minimize all windows.', run: () => onControlEvent({ type: 'shortcut', key: 'show-desktop' }) },
            { label: 'File Explorer', hint: 'Win + E', detail: 'Open files on the remote device.', run: () => onControlEvent({ type: 'shortcut', key: 'file-explorer' }) },
            { label: 'Lock Device', hint: 'Win + L', detail: 'Lock the remote session securely.', run: () => onControlEvent({ type: 'action', action: 'lock' }) },
            { label: 'Notifications', hint: 'Win + N', detail: 'Open Windows notifications.', run: () => onControlEvent({ type: 'shortcut', key: 'notifications' }) },
            { label: 'Quick Settings', hint: 'Win + A', detail: 'Open network/audio quick settings.', run: () => onControlEvent({ type: 'shortcut', key: 'control-center' }) },
        ],
        power: isMobileDevice ? [
            { label: 'Wake Phone', hint: 'Wake', detail: 'Wake the phone display before controlling it.', run: () => onControlEvent({ type: 'action', action: 'wake' }) },
            { label: 'Volume Up', hint: 'Audio', detail: 'Raise Android media volume.', run: () => onControlEvent({ type: 'action', action: 'volume_up' }) },
            { label: 'Volume Down', hint: 'Audio', detail: 'Lower Android media volume.', run: () => onControlEvent({ type: 'action', action: 'volume_down' }) },
            { label: 'Lock Phone', hint: 'Lock', detail: 'Lock the Android screen.', run: () => onControlEvent({ type: 'action', action: 'lock' }) },
            { label: 'Power Menu', hint: 'Reboot', detail: 'Open Android power options; select restart on the phone UI.', danger: true, run: confirmReboot },
        ] : [
            { label: 'Reboot Device', hint: 'Admin', detail: 'Restart the remote computer now.', danger: true, run: confirmReboot },
            { label: 'Lock Device', hint: 'Win + L', detail: 'Lock without ending the connection.', run: () => onControlEvent({ type: 'action', action: 'lock' }) },
            { label: 'Wake Display', hint: 'Mouse Nudge', detail: 'Move the pointer to wake a dimmed screen.', run: () => onControlEvent({ type: 'action', action: 'wake' }) },
            { label: 'Open Task Manager', hint: 'Recovery', detail: 'Use this instead of Ctrl + Alt + Del.', run: () => onControlEvent({ type: 'action', action: 'task_manager' }) },
        ],
        transfer: [
            { label: 'Send File', hint: 'Upload', detail: 'Transfer a local file to the remote Downloads folder.', run: triggerFilePicker },
            { label: 'Paste Clipboard', hint: 'Text', detail: 'Type your local clipboard into the remote device.', run: pasteLocalClipboard },
            { label: 'Refresh Stream', hint: 'Keyframe', detail: 'Recover a stuck or blurry video stream.', run: () => onControlEvent({ type: 'request-keyframe', urgent: true, reason: 'manual-refresh' }) },
            { label: remoteAudioEnabled ? 'Mute Remote Audio' : 'Listen To Remote Audio', hint: hostAudioStatus || (remoteAudioTrackCount ? 'Audio Ready' : 'No Audio Track'), detail: remoteAudioTrackCount ? (remoteAudioEnabled ? 'Stop playing the remote sound on this device only — the host is unaffected.' : 'Play audio from the remote stream on this device.') : 'The host stream is currently video-only, so there is no remote audio to play.', run: toggleRemoteAudio },
            // ICE ranks routes by fixed priority (host > srflx > relay), never by measured
            // latency, so it will sit on a slow direct path forever. A real session here ran
            // direct at 450ms while this machine reaches the TURN relay in 162ms. Exposing the
            // override in the menu rather than devtools so it is actually reachable in the field.
            {
                label: relayForced ? 'Use Direct Routing' : 'Route Via Relay (Fixes Lag)',
                hint: relayForced ? 'Relay On' : 'High Latency',
                detail: relayForced
                    ? 'Go back to letting the connection pick its own route. Reconnect to apply.'
                    : 'Force traffic through the relay server. Helps when the direct peer-to-peer path is slower than going via the relay. Reconnect to apply.',
                run: toggleRelayRouting,
            },
        ]
    };

    const renderContent = () => {
        // When inside the phone mockup frame, the video must fill the bezel directly.
        // Wrapping with p-8 or a nested aspect-ratio div causes getBoundingClientRect()
        // to return wrong geometry, making taps land ~32-44px above the intended target.
        const isInMockup = isMobileDevice && scaleMode === 'fit';
        const isDesktopMockup = false;
        const fitClass = !isMobileDevice && !isDesktopMockup && scaleMode === 'fill' ? 'object-cover' : 'object-contain';
        const mobileAspectRatio = remoteVideoSize?.width && remoteVideoSize?.height
            ? `${remoteVideoSize.width} / ${remoteVideoSize.height}`
            : '9 / 19.5';

        // Mirror the host's cursor shape (I-beam over text, hand over links, resize arrows…).
        const remoteCursorCss = (remoteCursor?.cursorType && remoteCursor.cursorType !== 'default')
            ? remoteCursor.cursorType : 'default';
        const videoProps = {
            className: `select-none h-full w-full ${fitClass} ${(!hasReceivedKeyframe) ? 'opacity-0' : 'opacity-100'}`,
            style: { backgroundColor: '#000', outline: 'none', imageRendering: 'auto' as const, cursor: remoteCursorCss },
            onMouseMove: (e: React.MouseEvent) => handleMouseEvent(e, 'mousemove'),
            onMouseDown: (e: React.MouseEvent) => handleMouseEvent(e, 'mousedown'),
            onMouseUp: (e: React.MouseEvent) => handleMouseEvent(e, 'mouseup'),
            onWheel: handleWheelEvent,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        };

        const contentNode = remoteStream ? (
            <div className="relative w-full h-full group flex items-center justify-center bg-[#0a0a0c] overflow-hidden cursor-default">
                {!hasReceivedKeyframe && renderConnectingLoader()}
                {/* Heavy chrome (animated transition + 100px-blur shadow) only for the
                    phone-mockup frame. The full-bleed desktop path stays bare: a huge
                    box-shadow + transition-all on the element wrapping the live video
                    forces oversized compositor layers and repaints on class flips. */}
                <div
                    className={`relative ${!isInMockup && isMobileDevice ? 'transition-all duration-300 ease-out shadow-[0_40px_100px_rgba(0,0,0,0.8)] h-full rounded-[3rem] border-[12px] border-[#1a1a1c] bg-black overflow-hidden' : 'w-full h-full'}`}
                    style={!isInMockup && isMobileDevice ? { aspectRatio: mobileAspectRatio } : undefined}
                >
                    <video
                        ref={videoRef}
                        autoPlay={mediaActive}
                        muted={!remoteAudioEnabled}
                        playsInline
                        onLoadedMetadata={(e) => {
                            if (!mediaActive) return;
                            const video = e.currentTarget;
                            const width = video.videoWidth || 0;
                            const height = video.videoHeight || 0;
                            if (width >= 16 && height >= 16) {
                                console.log(`[VideoPlayer] Decoder ACTIVE: ${width}x${height}`);
                                setRemoteVideoSize({ width, height });
                                setHasReceivedKeyframe(true);
                                setProtectedSurfaceNotice(false);
                                video.play().then(() => {
                                    setIsAutoPlayBlocked(false);
                                }).catch((err: any) => {
                                    console.warn('[VideoPlayer] Play failed on metadata:', err);
                                    if (err.name !== 'AbortError') {
                                        setIsAutoPlayBlocked(true);
                                    }
                                });
                            } else if (width > 0 || height > 0) {
                                console.warn(`[VideoPlayer] Ignoring invalid decoder dimensions: ${width}x${height}`);
                            }
                        }}
                        onResize={(e) => {
                            const video = e.currentTarget;
                            const width = video.videoWidth || 0;
                            const height = video.videoHeight || 0;
                            if (width >= 16 && height >= 16) {
                                setRemoteVideoSize({ width, height });
                                setHasReceivedKeyframe(true);
                                setProtectedSurfaceNotice(false);
                                if (viewerStatus !== 'streaming') setViewerStatus('streaming');
                            } else if (width > 0 || height > 0) {
                                console.warn(`[VideoPlayer] Ignoring invalid resize dimensions: ${width}x${height}`);
                            }
                        }}
                        {...videoProps}
                    />
                </div>

                {/* Auto-play recovery overlay */}
                {isAutoPlayBlocked && (
                    <div
                        className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-default"
                        onClick={() => {
                            videoRef.current?.play().then(() => setIsAutoPlayBlocked(false)).catch(console.error);
                        }}
                    >
                        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-blue-500/40 flex items-center justify-center mb-4 animate-pulse">
                            <Play size={32} className="text-blue-400 fill-blue-400" />
                        </div>
                        <span className="text-white/80 font-bold text-sm tracking-widest uppercase">Click To Resume Stream</span>
                    </div>
                )}

                {protectedSurfaceNotice && (
                    <div className="absolute inset-x-4 top-4 z-[120] rounded-lg border border-white/10 bg-black/80 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
                        <div className="flex items-start gap-3">
                            <ShieldOff size={18} className="mt-0.5 shrink-0 text-[#FFB347]" />
                            <div className="min-w-0 flex-1">
                                <p className="m-0 text-[13px] font-semibold">{isMobileDevice ? 'Phone Screen Is Hidden Or Locked' : 'Remote Screen Is Black Or Hidden'}</p>
                                <p className="m-0 mt-1 text-[11px] leading-4 text-white/65">{isMobileDevice ? 'Use Actions > Wake phone, or tap the button below. If Android still hides this view, switch away from secure, DRM, banking, password, or permission screens.' : 'The connection is alive, but the remote device is sending black frames. Try refreshing the stream, changing the captured display, or ask the host to unlock/close protected full-screen content.'}</p>
                                <button
                                    type="button"
                                    onClick={() => onControlEvent(isMobileDevice ? { type: 'wake' } : { type: 'request-keyframe', urgent: true, reason: 'manual-refresh' })}
                                    className="mt-3 rounded bg-[#FF8A00] px-3 py-1.5 text-[11px] font-semibold text-[#111315] transition hover:brightness-105"
                                >
                                    {isMobileDevice ? 'Wake Screen' : 'Refresh Stream'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Side-Notches have been removed for mobile view to prevent UI overlap --- */}
                {/* Command Deck */}
                {showShortcutsHUD && (
                    <div className="absolute inset-0 z-[130] bg-[#05070b]/75 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="bg-[#0d1016] border border-white/10 rounded-[24px] p-6 max-w-4xl w-full shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Command size={16} className="text-[#FFB347]" /> Remote Command Deck
                                    </h3>
                                    <p className="text-[11px] text-white/45 mt-1">Run trusted navigation, transfer, audio, and recovery actions without leaving the stream.</p>
                                </div>
                                <button onClick={() => setShowShortcutsHUD(false)} className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center"><X size={18} /></button>
                            </div>
                            <div className="mb-4 flex rounded-xl bg-white/[0.055] p-1 border border-white/[0.06]">
                                {[
                                    { id: 'essential', label: 'Navigation' },
                                    { id: 'transfer', label: 'Transfer' },
                                    { id: 'power', label: 'Recovery' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setShortcutsTab(tab.id as any)}
                                        className={`h-9 flex-1 rounded-lg text-[12px] font-bold transition-all ${shortcutsTab === tab.id ? 'bg-[#FF8A00] text-[#111315]' : 'text-white/55 hover:text-white'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                                {remoteShortcutActions[shortcutsTab].map((item) => (
                                    <button
                                        key={item.label}
                                        onClick={() => {
                                            item.run();
                                            if (shortcutsTab !== 'transfer' || !item.label.toLowerCase().includes('audio')) {
                                                setShowShortcutsHUD(false);
                                            }
                                        }}
                                        className={`flex min-h-[92px] flex-col justify-between gap-3 p-4 rounded-2xl border transition-all text-left ${item.danger ? 'bg-red-500/10 hover:bg-red-500/15 border-red-400/20' : 'bg-white/[0.045] hover:bg-white/[0.085] hover:border-[#FFB347]/25 border-white/[0.07]'}`}
                                    >
                                        <span>
                                            <span className="block text-[12px] font-semibold text-white/90">{item.label}</span>
                                            <span className="mt-1 block text-[10px] leading-4 text-white/45">{item.detail}</span>
                                        </span>
                                        <span className={`w-fit px-2 py-1 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap border ${item.danger ? 'bg-red-950/40 text-red-200 border-red-400/15' : 'bg-black/30 text-[#FFCE8A] border-white/[0.06]'}`}>{item.hint}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="rounded-xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-[11px] leading-relaxed text-amber-100/85">
                                    Windows blocks normal apps from sending the secure Ctrl + Alt + Del screen. Use Task Manager for the same recovery path.
                                </div>
                                <div className="rounded-xl border border-blue-400/15 bg-blue-400/10 px-4 py-3 text-[11px] leading-relaxed text-blue-100/85">
                                    Remote audio plays automatically when the host stream includes sound. Muting it here only silences this device — the host keeps its own mute on the dock.
                                </div>
                            </div>
                            <div className="hidden">
                                {[
                                    { k: 'Esc', v: 'Back' },
                                    { k: 'Alt + Home', v: 'Home Screen' },
                                    { k: 'Alt + Tab', v: 'Recent Apps' },
                                    { k: 'Alt + ↓', v: 'Notifications' },
                                    { k: 'Ctrl + Alt + K', v: 'Show Or Hide This Panel' },
                                    { k: 'Toolbar', v: 'File, Paste, Refresh, Fullscreen' }
                                ].map((s, i) => (
                                    <div key={i} className="flex justify-between items-center gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                                        <span className="text-[12px] font-semibold text-white/90">{s.v}</span>
                                        <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono text-blue-200 font-bold whitespace-nowrap">{s.k}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        ) : (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
                {!hasReceivedKeyframe && renderConnectingLoader()}
                <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    {...videoProps}
                />
            </div>
        );
        return (
            <div className="w-full h-full flex items-center justify-center relative bg-[#1A1D21]">
                {isInMockup ? (
                    <div className="relative flex items-center justify-center py-5 px-6 w-full h-full max-h-screen">
                        {/* The aspect ratio belongs to the SCREEN, not to the padded frame. Putting it
                            on the frame meant the p-3 bezel was subtracted from a box already sized to
                            the video's ratio, so the screen inside ended up a different ratio than the
                            stream — and object-contain letterboxed it with black slivers above and below
                            the phone's status/navigation bars. Sizing the screen and letting the frame
                            shrink-wrap it makes the fit exact at any host resolution. */}
                        <div
                            className="relative rounded-[48px] p-3 bg-[#1C1C1C] border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.8)] h-full w-auto flex-shrink-0 flex items-center justify-center max-h-[920px]"
                        >
                            <div
                                className="relative h-full w-auto rounded-[38px] overflow-hidden bg-black pointer-events-auto"
                                style={{ aspectRatio: mobileAspectRatio }}
                            >
                                {contentNode}
                            </div>
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[100px] h-[26px] bg-black rounded-full pointer-events-none z-50 flex items-center justify-center border border-white/[0.04]">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-900/30 ml-auto mr-3 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />
                                </div>
                            </div>
                            <div className="absolute top-32 -left-1 w-1 h-12 bg-[#2A2A2A] rounded-l-md" />
                            <div className="absolute top-48 -left-1 w-1 h-20 bg-[#2A2A2A] rounded-l-md" />
                            <div className="absolute top-48 -right-1 w-1 h-24 bg-[#2A2A2A] rounded-r-md" />
                        </div>
                    </div>
                ) : isDesktopMockup ? (
                    // Desktop monitor mockup — gray bezel sized to 16:9 so the screen fits it.
                    <div className="relative flex h-full w-full flex-col items-center justify-center px-4 py-3 sm:px-8 sm:py-5">
                        <div className="relative flex aspect-video h-full max-h-[calc(100%-22px)] w-auto max-w-full items-center justify-center rounded-[16px] border border-[#6c7077] bg-gradient-to-b from-[#5a5e64] to-[#3f4247] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
                            <div className="relative h-full w-full overflow-hidden rounded-[8px] bg-black pointer-events-auto">
                                {contentNode}
                            </div>
                            {/* webcam dot */}
                            <div className="pointer-events-none absolute top-[5px] left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#2a2c30]" />
                        </div>
                        {/* stand */}
                        <div className="mt-1.5 h-3 w-24 flex-shrink-0 bg-gradient-to-b from-[#52565c] to-[#3a3d42]" />
                        <div className="h-1.5 w-40 flex-shrink-0 rounded-full bg-[#3a3d42]" />
                    </div>
                ) : (
                    contentNode
                )}
            </div>
        );
    };

    return (
        <div
            ref={viewerContainerRef}
            tabIndex={0}
            data-ui-hidden="false"
            className="w-full h-full flex flex-col animate-in fade-in duration-700 relative bg-[#1A1D21] outline-none"
        >
            <RemoteSessionChrome
                deviceName={deviceName}
                getControlChannel={() => controlChannelRef.current}
                sessionCode={sessionCode}
                isMobileDevice={isMobileDevice}
                controlStatus={controlStatus}
                scaleMode={scaleMode}
                isFullScreen={isFullScreen}
                remoteAudioEnabled={remoteAudioEnabled}
                remoteAudioTrackCount={remoteAudioTrackCount}
                latency={latency}
                hasReceivedKeyframe={hasReceivedKeyframe}
                isRecording={recordingPhase === 'recording'}
                hasUnsavedRecording={recordingPhase === 'stopped'}
                recordingElapsed={recordingElapsed}
                recordingAllowed={recordingPolicy?.canDownload !== false}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onSaveRecording={saveRecording}
                onDiscardRecording={discardRecording}
                onTakeScreenshot={takeScreenshot}
                connectionHealth={connectionHealth}
                onBoostConnection={onBoostConnection}
                isMacroRecording={isMacroRecording}
                macroRecordingCount={macroRecordingCount}
                isMacroPlaying={isMacroPlaying}
                savedMacros={savedMacros}
                onStartMacroRecording={startMacroRecording}
                onStopMacroRecording={stopMacroRecording}
                onPlayMacro={playMacro}
                onDeleteMacro={deleteMacro}
                directKeyboardMode={directKeyboardMode}
                onSetDirectKeyboardMode={setDirectKeyboardMode}
                systemKeysMode={systemKeysMode}
                onSetSystemKeysMode={systemKeysSupported ? setSystemKeysMode : undefined}
                onDisconnect={onDisconnect}
                onRequestControl={() => onControlEvent({ type: 'request-control' })}
                onSetScaleMode={setScaleMode}
                onToggleFullscreen={toggleViewerFullscreen}
                onOpenCommandDeck={() => setShowShortcutsHUD(true)}
                onPasteClipboard={pasteLocalClipboard}
                onSendFile={triggerFilePicker}
                onSendLocalFilePath={sendLocalFilePath}
                onReceiveFile={requestFileFromHost}
                onReceiveRemoteFilePath={requestRemoteFilePath}
                onRefreshStream={() => onControlEvent({ type: 'request-keyframe', urgent: true, reason: 'manual-refresh' })}
                onToggleAudio={toggleRemoteAudio}
                talkActive={!!talkActive}
                onToggleTalk={onToggleTalk}
                onPowerActions={() => { setShortcutsTab('power'); setShowShortcutsHUD(true); }}
                onControlEvent={onControlEvent}
                remoteWhiteboardEvent={remoteWhiteboardEvent}
                remoteChatEvent={remoteChatEvent}
                remoteFileBrowserEvent={remoteFileBrowserEvent}
                fileTransferStatus={fileTransferStatus}
                remoteCursor={remoteCursor}
            >
                {/* Main Video Area */}
                <div
                    ref={containerRef}
                    className={`w-full h-full flex items-center justify-center relative overflow-hidden bg-[#1A1D21] ${scaleMode === 'actual' ? 'cursor-grab active:cursor-grabbing overflow-auto' : ''}`}
                >
                    <div className="w-full h-full relative">
                        {renderContent()}
                    </div>
                </div>
            </RemoteSessionChrome>
                {/* Auto-record policy set to "Ask Before Recording" */}
                {showAutoRecordPrompt && (
                    <div className="absolute right-6 top-6 z-[210] flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                        <Video size={18} className="shrink-0 text-[#FF383C]" />
                        <span className="text-[13px] font-medium text-[#111315]">Record This Session?</span>
                        <button
                            type="button"
                            onClick={() => { setShowAutoRecordPrompt(false); startRecording(); }}
                            className="flex h-8 items-center justify-center rounded-[32px] bg-[#FF383C] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#E62E32]"
                        >
                            Record
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAutoRecordPrompt(false)}
                            className="flex h-8 items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[12px] font-medium text-[#111315] transition hover:bg-[#F3F4F6]"
                        >
                            Not Now
                        </button>
                    </div>
                )}
                <Modal open={Boolean(pendingRemoteAction)} onClose={() => setPendingRemoteAction(null)} className="z-[240] bg-black/45 p-6">
                    <div className="relative flex w-full max-w-[468px] flex-col items-start gap-[22px] rounded-xl bg-white px-6 py-3 text-[#111315] shadow-2xl">
                        <div className="flex h-11 w-full items-center justify-between gap-[22px]">
                            <h2 className="m-0 flex-1 text-[24px] font-bold leading-[34px] text-[#111315]">
                                {pendingRemoteAction?.title}
                            </h2>
                            <button
                                type="button"
                                aria-label="Close Remote Action Confirmation"
                                onClick={() => setPendingRemoteAction(null)}
                                className="flex h-6 w-6 flex-none items-center justify-center text-[#111315] transition hover:opacity-70"
                            >
                                <X size={24} strokeWidth={2.4} />
                            </button>
                        </div>
                        <div className="flex w-full flex-col items-start gap-[22px]">
                            <div>
                                <p className="m-0 text-[14px] font-normal leading-5 text-[#111315]">
                                    {pendingRemoteAction?.message}
                                </p>
                                <p className="m-0 mt-2 text-[12px] leading-4 text-[#111315]/55">
                                    {pendingRemoteAction?.detail}
                                </p>
                            </div>
                            <div className="flex w-full justify-end">
                                <div className="flex h-10 items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPendingRemoteAction(null)}
                                        className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-[#F3F4F6]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={runPendingRemoteAction}
                                        className="flex h-10 w-[124px] items-center justify-center rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 text-[14px] font-medium leading-5 text-[#111315] transition hover:brightness-105"
                                    >
                                        {pendingRemoteAction?.confirmLabel || 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
                <Modal open={Boolean(pendingMacroSave)} onClose={discardMacroRecording} className="z-[240] bg-black/45 p-6">
                    <div className="relative flex w-full max-w-[420px] flex-col items-start gap-[18px] rounded-xl bg-white px-6 py-5 text-[#111315] shadow-2xl">
                        <div className="flex h-8 w-full items-center justify-between">
                            <h2 className="m-0 flex-1 text-[18px] font-bold leading-6 text-[#111315]">Save Macro</h2>
                            <button
                                type="button"
                                aria-label="Discard Macro"
                                onClick={discardMacroRecording}
                                className="flex h-6 w-6 flex-none items-center justify-center text-[#111315] transition hover:opacity-70"
                            >
                                <X size={20} strokeWidth={2.4} />
                            </button>
                        </div>
                        <p className="m-0 text-[13px] leading-5 text-[#111315]/60">
                            Recorded {pendingMacroSave?.length || 0} step{(pendingMacroSave?.length || 0) === 1 ? '' : 's'}. Give it a name so you can replay it later.
                        </p>
                        <input
                            autoFocus
                            type="text"
                            value={macroNameInput}
                            onChange={(e) => setMacroNameInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmSaveMacro(); }}
                            placeholder="Macro Name"
                            className="h-10 w-full rounded-lg border border-black/10 bg-[#F9FAFB] px-3 text-[14px] text-[#111315] outline-none placeholder:text-[#111315]/35 focus:border-[#FF8A00]"
                        />
                        <div className="flex w-full justify-end gap-2">
                            <button
                                type="button"
                                onClick={discardMacroRecording}
                                className="flex h-10 items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-[#F3F4F6]"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={confirmSaveMacro}
                                className="flex h-10 items-center justify-center rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 text-[14px] font-medium leading-5 text-[#111315] transition hover:brightness-105"
                            >
                                Save Macro
                            </button>
                        </div>
                    </div>
                </Modal>
                <input type="file" ref={fileInputRef} className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const channel = controlChannelRef.current;
                    if (!channel) {
                        console.error('[FileTransfer] No active control channel.');
                        return;
                    }

                    // Ensure threshold is set for onbufferedamountlow
                    channel.bufferedAmountLowThreshold = 65536; // 64KB

                    const waitForBuffer = () => {
                        if (channel.bufferedAmount < 262144) return Promise.resolve(); // 256KB target
                        return new Promise<void>((resolve) => {
                            const handler = () => {
                                channel.removeEventListener('bufferedamountlow', handler);
                                resolve();
                            };
                            channel.addEventListener('bufferedamountlow', handler);
                        });
                    };

                    const CHUNK_SIZE = 16 * 1024;
                    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                    setTransferProgress({ name: file.name, p: 0 });
                    setFileTransferStatus({ direction: 'send', name: file.name, progress: 0, state: 'transferring', message: `Sending ${file.name} to the remote computer...` });

                    try {
                        for (let i = 0; i < totalChunks; i++) {
                            // FLOW CONTROL: Wait if network buffer is saturated
                            await waitForBuffer();

                            const start = i * CHUNK_SIZE;
                            const end = Math.min(start + CHUNK_SIZE, file.size);
                            const chunk = file.slice(start, end);
                            const arrayBuffer = await chunk.arrayBuffer();
                            const header = JSON.stringify({ type: 'file-chunk', name: file.name, mimeType: file.type || 'application/octet-stream', totalSize: file.size, offset: start, chunkIndex: i, totalChunks });
                            const headerBuffer = new TextEncoder().encode(header);
                            const fullBuffer = new Uint8Array(4 + headerBuffer.length + arrayBuffer.byteLength);
                            const view = new DataView(fullBuffer.buffer);
                            view.setUint32(0, headerBuffer.length, true);
                            fullBuffer.set(headerBuffer, 4);
                            fullBuffer.set(new Uint8Array(arrayBuffer), 4 + headerBuffer.length);

                            onControlEvent(fullBuffer);

                            if (i % 20 === 0) {
                                console.log(`[Diagnostic] File Upload: Sent chunk ${i + 1}/${totalChunks} (${Math.round((i + 1) / totalChunks * 100)}%)`);
                                const progress = Math.round(((i + 1) / totalChunks) * 100);
                                setTransferProgress({ name: file.name, p: progress });
                                setFileTransferStatus({ direction: 'send', name: file.name, progress, state: 'transferring', message: `Sending ${file.name} to the remote computer...` });
                            }
                        }
                        setTransferProgress({ name: file.name, p: 100 });
                        setFileTransferStatus({ direction: 'send', name: file.name, progress: 100, state: 'complete', message: `${file.name} was sent to the remote computer.` });
                    } catch (err: any) {
                        console.error('[FileTransfer] FAILED:', err);
                        setFileTransferStatus({ direction: 'send', name: file.name, progress: 0, state: 'error', message: err?.message || 'File transfer failed.' });
                    }

                    setTimeout(() => setTransferProgress(null), 2000);
                    setTimeout(() => setFileTransferStatus(null), 4000);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }} />
        </div>
    );
});

// NOT memoized. React.memo was tried here and reverted: App passes several
// inline props, so the shallow compare rarely hit, and skipping renders on a
// forwardRef component whose imperative handle closes over props risks the
// handle going stale — real behavioural risk for no measured win. Revisit only
// with a profile showing this render is actually costly.
export default VideoPlayer;
