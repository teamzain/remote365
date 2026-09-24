import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';

// Optional native module: a dev build that predates `expo-screen-orientation`
// won't have the native side, and a static import would crash at startup with
// "Cannot find native module 'ExpoScreenOrientation'". Load it defensively so
// the app still runs — rotation simply activates once the dev client is rebuilt.
let ScreenOrientation: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ScreenOrientation = require('expo-screen-orientation');
} catch {
  ScreenOrientation = null;
}
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { monaFontStyles } from '../lib/monaSans';
import { useTranslation } from '../lib/i18n';
import { useResponsive } from '../lib/useResponsive';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';
import { buildSignalUrl } from '../meetings/meetingUtils';
import { fetchIceServers } from './remoteApi';

const waitImage = require('../../assets/wait.png');

// Mobile remote-control viewer, feature- and design-matched to the web viewer's
// phone experience (apps/web/src/pages/session/SessionViewer.tsx):
//   - white 64px bottom bar (Actions · Gestures · Keyboard · Chat · Shortcuts ·
//     View · End · Hide), starting hidden with a floating right-edge tab
//   - automatic touch gestures: tap = left click, a STILL long-press = right
//     click, two fingers = scroll, pinch = local zoom. What one finger dragging
//     across the picture means depends on the host: on a desktop host it
//     SCROLLS (wheel), the way TeamViewer/AnyDesk/RDP touch mode does, because
//     a click-drag there just selects text; press and hold ~350ms first and the
//     same pan becomes a drag/selection. On a mobile host a one-finger pan
//     stays a drag, since that is how you swipe the phone's own UI.
//   - in-session chat over the `control` data channel
//   - disconnect confirm card, connecting cover, connection-lost screen
// Signaling protocol is the exact desktop one: join → host offers + creates the
// 'input' / 'input-critical' / 'control' channels → we answer and stream.

type Rect = { x: number; y: number; w: number; h: number };
type ViewerStatus = 'connecting' | 'waiting' | 'connected' | 'streaming' | 'error' | 'lost';
type SheetKind = 'actions' | 'gestures' | 'shortcuts' | 'view' | null;
type FitMode = 'fit' | 'fill';
type QualityMode = 'auto' | 'speed' | 'quality';
type ChatMsg = { from: string; text: string; at: number; mine: boolean };
type ConfirmSpec = {
  title: string;
  body: string;
  hint?: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const CONNECTING_MESSAGES = ['Making connection', 'Starting the screen', 'Getting things ready', 'Almost ready'];

// On a desktop host a one-finger pan scrolls. Pressing and HOLDING this long
// before moving turns the same pan into a drag (click-drag / text selection)
// instead. Kept under the 500ms right-click threshold, and both only ever fire
// while the finger is still, so a hold-then-move can never also right click.
const HOLD_TO_DRAG_MS = 350;

// Finger pixels → wheel pixels. Two reasons 1:1 feels like wading: the picture
// is a shrunken copy of the host screen (a 1080p desktop is ~3x smaller on a
// phone), and the host converts wheel pixels to Windows notches at 120/100, so
// 100px of finger buys about three text lines. 2.5x is the point where the
// content keeps up with the finger without a flick throwing away the page.
const SCROLL_SPEED = 2.5;

// The host injects Windows virtual-key codes (`event.keyCode`), not DOM key
// names — map the key names this screen uses onto VKs. Letters/digits map to
// their ASCII uppercase code, which matches the Windows VK table.
const KEY_TO_VK: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Shift: 16,
  Control: 17,
  Alt: 18,
  Escape: 27,
  ' ': 32,
  Space: 32,
  Delete: 46,
  Meta: 91,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
};

function vkForKey(key: string): number {
  if (KEY_TO_VK[key] != null) return KEY_TO_VK[key];
  if (key.length === 1) {
    const upper = key.toUpperCase().charCodeAt(0);
    if ((upper >= 48 && upper <= 57) || (upper >= 65 && upper <= 90)) return upper;
  }
  return 0;
}

// ── Small building blocks (web-mobile sheet design) ─────────────────────────

function SheetRow({
  icon,
  label,
  danger,
  active,
  onPress,
}: {
  icon?: React.ReactNode;
  label: string;
  danger?: boolean;
  active?: boolean;
  onPress: () => void;
}) {
  const { textSize, maxFontSizeMultiplier } = useResponsive();
  return (
    <Pressable style={sheetStyles.row} onPress={onPress}>
      {icon ? <View style={sheetStyles.rowIcon}>{icon}</View> : null}
      <Text
        style={[sheetStyles.rowLabel, textSize(14), danger ? sheetStyles.rowLabelDanger : null]}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
      >
        {label}
      </Text>
      {active ? <View style={sheetStyles.activeDot} /> : null}
    </Pressable>
  );
}

const sheetStyles = StyleSheet.create(monaFontStyles({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 150,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 8,
    // No maxHeight here: it is derived from the live viewport at the call site,
    // because a constant taller than a landscape phone pushes the first rows
    // above y=0 where they can never be scrolled back.
    // Tablets/unfolded foldables: keep the sheet a card rather than a 1300dp band.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    height: 4,
    width: 36,
    borderRadius: 2,
    backgroundColor: 'rgba(26,29,33,0.2)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rowIcon: { width: 20, alignItems: 'center' },
  rowLabel: { flex: 1, fontWeight: '500', color: '#111315' },
  rowLabelDanger: { color: '#FF383C' },
  activeDot: { height: 6, width: 6, borderRadius: 3, backgroundColor: '#FF8A00' },
  gestureTitle: { fontWeight: '600', color: '#111315', marginBottom: 8 },
  gestureLine: { color: 'rgba(17,19,21,0.7)', paddingVertical: 6 },
  rotateButton: {
    marginTop: 8,
    // minHeight (not height): 'Rotate to landscape' wraps to two lines at large
    // font scales and a fixed 40 clipped the second one.
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rotateButtonText: { flexShrink: 1, fontWeight: '600', color: '#111315' },
}));

// Windows-style arrow for the remote cursor (web parity: white fill, black
// stroke, tip offset so it lands exactly on the reported point).
function CursorArrow() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M4 1 L4 15 L7.5 11.8 L9.8 17 L12.4 15.9 L10.1 10.9 L15 10.6 Z"
        fill="#FFFFFF"
        stroke="#000000"
        strokeWidth={1.3}
      />
    </Svg>
  );
}

export function RemoteControl({
  apiBaseUrl,
  authToken,
  accessKey,
  accessToken,
  deviceName,
  deviceType,
  viewerClientId,
  onExit,
}: {
  apiBaseUrl: string;
  authToken: string | null;
  accessKey: string;
  accessToken: string;
  deviceName: string;
  deviceType?: string | null;
  viewerClientId: string;
  onExit: () => void;
}) {
  useKeepAwake();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const windowDims = useWindowDimensions();
  // Shared responsive foundation: font-scale-aware boxes (`control`), the
  // app-wide font-scale cap and the live modal ceiling.
  const { control, type, textSize, maxFontSizeMultiplier, modalMaxHeight } = useResponsive();
  // Chrome that eats into the video area. Declared up here because the surface
  // geometry (below) is derived from it.
  const TOOLBAR_HEIGHT = 64;

  const [status, setStatus] = useState<ViewerStatus>('connecting');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Web parity: the session opens with the toolbar hidden; a floating tab on
  // the right edge brings it back.
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [fitMode, setFitMode] = useState<FitMode>('fit');
  const [qualityMode, setQualityMode] = useState<QualityMode>('auto');
  // Phones are exempt from the desktop consent flow: the host grants control on
  // connect for clientKind 'mobile-viewer', so this starts granted and there is
  // no "Request control" action. It still tracks host messages so an unexpected
  // denial can recover itself (see the control-denied case below).
  const [controlStatus, setControlStatus] = useState<'granted' | 'pending' | 'denied'>('granted');
  const controlRetriedRef = useRef(false);
  const [isLandscape, setIsLandscape] = useState(false);

  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardValue, setKeyboardValue] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatDraft, setChatDraft] = useState('');

  const [connectingMsgIndex, setConnectingMsgIndex] = useState(0);

  // Video placement: one rect drives BOTH rendering and input mapping, so fit
  // modes and pinch zoom can never disagree with where touches land.
  const [surfaceSize, setSurfaceSize] = useState<{ w: number; h: number } | null>(null);
  const surfaceSizeRef = useRef<{ w: number; h: number } | null>(null);
  surfaceSizeRef.current = surfaceSize;
  // `contentRect` is the LAID-OUT box of the video view. `liveRectRef` is where
  // it currently *appears* — they differ only mid-pinch, while a GPU transform
  // provides smooth feedback before the (sharp) layout is committed on release.
  // Input mapping and the cursor overlay always read the live rect.
  const [contentRect, setContentRect] = useState<Rect | null>(null);
  const contentRectRef = useRef<Rect | null>(null);
  contentRectRef.current = contentRect;
  const liveRectRef = useRef<Rect | null>(null);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const pinchTX = useRef(new Animated.Value(0)).current;
  const pinchTY = useRef(new Animated.Value(0)).current;
  const resetPinchTransform = () => {
    pinchScale.setValue(1);
    pinchTX.setValue(0);
    pinchTY.setValue(0);
  };
  const surfaceOriginRef = useRef({ x: 0, y: 0 });
  const surfaceViewRef = useRef<View | null>(null);
  const streamAspectRef = useRef(16 / 9);
  // Real decoded video dimensions from RTCView.onDimensionsChange — the RN
  // equivalent of the web's videoWidth/videoHeight. Without this, a PORTRAIT
  // mobile-host stream was mapped with the 16:9 default and taps landed in the
  // wrong place.
  const [streamDims, setStreamDims] = useState<{ w: number; h: number } | null>(null);
  // Zoom model (web parity): `contentRect` IS the on-screen rectangle the video
  // occupies, and it drives BOTH the layout and the input mapping — so they can
  // never disagree. Pinch resizes that rect (the video view genuinely gets
  // bigger, so the renderer redraws from the decoded frame at the larger size)
  // rather than scaling an already-rendered surface, which is what made zoom
  // blurry. Mirrors the browser compositor re-rasterizing a CSS-transformed
  // <video>, and `getBoundingClientRect()` needing no inversion math.
  const [isZoomed, setIsZoomed] = useState(false); // gates the Reset-zoom menu item

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<any>(null);
  const inputChannelRef = useRef<any>(null);
  const criticalChannelRef = useRef<any>(null);
  const controlChannelRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);
  const lostGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoKeyboardRef = useRef(false);
  const keyboardClosedAtRef = useRef(0);
  const keyboardInputRef = useRef<TextInput | null>(null);
  // Auto-keyboard (web parity): remember the host's last pointer shape, and
  // after a tap allow a short window for an I-beam report to arrive.
  const lastCursorTypeRef = useRef('default');
  const keyboardProbeUntilRef = useRef(0);

  const chatListRef = useRef<ScrollView | null>(null);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;

  const cursorPos = useRef(new Animated.ValueXY({ x: -100, y: -100 })).current;
  const [cursorVisible, setCursorVisible] = useState(false);

  const statusRef = useRef(status);
  statusRef.current = status;
  // Mirror streamUrl into a ref so the long-lived socket handlers read the
  // live value instead of the null captured when the effect first ran.
  const streamUrlRef = useRef(streamUrl);
  streamUrlRef.current = streamUrl;

  const sessionId = useMemo(() => accessKey.replace(/\D/g, ''), [accessKey]);
  const hostIsMobileDevice = /mobile|android|ios/.test(String(deviceType || '').toLowerCase());

  // ── Orientation: free rotation during the session, back to portrait after ──
  useEffect(() => {
    ScreenOrientation?.unlockAsync?.().catch(() => {});
    return () => {
      ScreenOrientation?.lockAsync?.(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const toggleLandscape = () => {
    // Reset any pinch-zoom so the rotated orientation shows the full remote
    // screen (a leftover zoom made it look "cut off" after rotating).
    resetZoom();
    if (!ScreenOrientation) return;
    if (isLandscape) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      setIsLandscape(false);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      setIsLandscape(true);
    }
  };

  // ── Hardware back = disconnect confirm (web parity: nothing exits silently) ──
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirm) { setConfirm(null); return true; }
      if (sheet) { setSheet(null); return true; }
      if (chatOpen) { setChatOpen(false); return true; }
      openDisconnectConfirm();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, sheet, chatOpen]);

  // ── OS keyboard tracking (toolbar floats above it on iOS) ──
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setShowKeyboard((open) => {
        if (open) keyboardClosedAtRef.current = Date.now();
        return false;
      });
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Rotating status text on the connecting cover (web: every 1600ms).
  useEffect(() => {
    if (streamUrl || status === 'error' || status === 'lost') return;
    const timer = setInterval(() => {
      setConnectingMsgIndex((index) => (index + 1) % CONNECTING_MESSAGES.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [streamUrl, status]);

  // Indeterminate sweep on the connecting progress bar.
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(sweep, {
      toValue: 1,
      duration: 1600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }));
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  // ── Message routing (web parity: transient → input, critical → input-critical,
  //    everything else → control) ──
  const sendMessage = (payload: Record<string, unknown>) => {
    const type = String(payload.type || '');
    const transient = type === 'mousemove' || type === 'wheel';
    const critical = type === 'mousedown' || type === 'mouseup' || type === 'keydown'
      || type === 'keyup' || type === 'typeText' || type === 'keyCombo' || type === 'shortcut';
    const channel = transient
      ? inputChannelRef.current
      : critical
        ? (criticalChannelRef.current || inputChannelRef.current)
        : (controlChannelRef.current || criticalChannelRef.current);
    if (!channel || channel.readyState !== 'open') return;
    try {
      channel.send(JSON.stringify(payload));
    } catch {
      // Channel died mid-session; the connection watchers surface it.
    }
  };

  const hostAction = (action: string) => sendMessage({ type: 'action', action });

  const confirmHostAction = (action: string, title: string, body: string, confirmLabel: string) => {
    setSheet(null);
    setConfirm({
      title,
      body,
      confirmLabel,
      onConfirm: () => { hostAction(action); setConfirm(null); },
    });
  };

  const openDisconnectConfirm = () => {
    setSheet(null);
    setConfirm({
      title: 'Disconnect session?',
      body: `You are about to end the session with ${deviceName}.`,
      hint: 'You can reconnect at any time from your device list.',
      confirmLabel: 'Disconnect',
      onConfirm: () => onExit(),
    });
  };

  const pickQuality = (mode: QualityMode) => {
    setQualityMode(mode);
    sendMessage({ type: 'stream-quality', mode, reason: 'user' });
  };

  // ── Chat over the control channel ──
  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    sendMessage({ type: 'chat', text });
    setChatMessages((current) => [...current, { from: 'You', text, at: Date.now(), mine: true }]);
    setChatDraft('');
  };

  useEffect(() => {
    if (chatOpen) setChatUnread(0);
  }, [chatOpen, chatMessages.length]);

  // Adaptive stream quality (web parity: SessionViewer's 1.5s getStats loop).
  // Loss-driven ladder smooth→balanced→sharp→ultra: two lossy samples drop a
  // tier, three clean ones raise; rtt ≥ 300ms caps at sharp. Pinch-zoom pins
  // the top tier so the magnified picture stays sharp (the "blurry zoom" fix).
  // Stands down when the user pins a quality manually.
  const isZoomedRef = useRef(false);
  isZoomedRef.current = isZoomed;
  useEffect(() => {
    if (!streamUrl || qualityMode !== 'auto') return;
    const TIERS = ['smooth', 'balanced', 'sharp', 'ultra'] as const;
    let tier = 1; // phones start at 'balanced' (web parity)
    let lossyStreak = 0;
    let cleanStreak = 0;
    let lastLost = 0;
    let lastReceived = 0;
    let lastSent: string | null = null;

    const timer = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc?.getStats) return;
      let lost = 0;
      let received = 0;
      let fps = 0;
      let rttMs = 0;
      try {
        const report = await pc.getStats();
        report.forEach?.((stat: any) => {
          if (stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.mediaType === 'video')) {
            lost = Number(stat.packetsLost) || 0;
            received = Number(stat.packetsReceived) || 0;
            fps = Number(stat.framesPerSecond) || 0;
          } else if (stat.type === 'candidate-pair' && (stat.selected || stat.state === 'succeeded')) {
            if (stat.currentRoundTripTime != null) rttMs = Math.round(Number(stat.currentRoundTripTime) * 1000);
          }
        });
      } catch {
        return;
      }
      const dLost = Math.max(0, lost - lastLost);
      const dReceived = Math.max(0, received - lastReceived);
      lastLost = lost;
      lastReceived = received;
      if (dReceived + dLost === 0) return;
      const lossPct = (dLost / (dReceived + dLost)) * 100;

      if (lossPct > 2) { lossyStreak += 1; cleanStreak = 0; } else { cleanStreak += 1; lossyStreak = 0; }
      if (lossyStreak >= 2 && tier > 0) { tier -= 1; lossyStreak = 0; }
      else if (cleanStreak >= 3 && tier < TIERS.length - 1) { tier += 1; cleanStreak = 0; }
      if (rttMs >= 300 && tier > 2) tier = 2;
      // Zoomed-in: hold the top of the ladder so the enlarged pixels stay crisp.
      let effective = tier;
      if (isZoomedRef.current) effective = Math.max(effective, rttMs >= 300 ? 2 : 3);

      const mode = TIERS[effective];
      if (mode !== lastSent) {
        lastSent = mode;
        sendMessage({ type: 'stream-quality', mode, rttMs, lossPct: Math.round(lossPct * 10) / 10, fps, reason: 'auto' });
      }
    }, 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, qualityMode]);

  // Black-frame watchdog (web parity): a track can connect while the host sends
  // no frames — keep asking for an urgent keyframe until the peer is fully
  // connected. Capped so a genuinely unreachable host doesn't get spammed.
  useEffect(() => {
    if (!streamUrl) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (pcRef.current?.connectionState === 'connected' || attempts > 12) {
        clearInterval(timer);
        return;
      }
      const channel = controlChannelRef.current;
      if (channel?.readyState === 'open') {
        try { channel.send(JSON.stringify({ type: 'request-keyframe', urgent: true })); } catch { /* closing */ }
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [streamUrl]);

  // ── Connection ──
  useEffect(() => {
    let disposed = false;
    setStatus('connecting');
    setErrorText(null);
    setStreamUrl(null);

    const cleanup = () => {
      if (lostGraceRef.current) { clearTimeout(lostGraceRef.current); lostGraceRef.current = null; }
      [inputChannelRef, criticalChannelRef, controlChannelRef].forEach((ref) => {
        try { ref.current?.close?.(); } catch { /* closing */ }
        ref.current = null;
      });
      try { pcRef.current?.close?.(); } catch { /* closing */ }
      pcRef.current = null;
      try { wsRef.current?.close?.(); } catch { /* closing */ }
      wsRef.current = null;
    };

    const markLost = () => {
      if (disposed) return;
      setStatus('lost');
    };

    const attachDataChannel = (channel: any) => {
      const label = String(channel?.label || '');
      if (label === 'input') inputChannelRef.current = channel;
      else if (label === 'input-critical') criticalChannelRef.current = channel;
      else if (label === 'control') {
        controlChannelRef.current = channel;
        const requestKeyframe = () => {
          try { channel.send(JSON.stringify({ type: 'request-keyframe', urgent: true })); } catch { /* not open yet */ }
        };
        if (channel.readyState === 'open') requestKeyframe();
        channel.addEventListener?.('open', requestKeyframe);
        channel.onopen = requestKeyframe;
        channel.onmessage = (event: any) => {
          let data: any;
          try { data = JSON.parse(event.data); } catch { return; }
          switch (data?.type) {
            case 'focus-editable': {
              if (data.editable) {
                openKeyboardAuto();
              } else if (autoKeyboardRef.current) {
                autoKeyboardRef.current = false;
                setShowKeyboard(false);
                Keyboard.dismiss();
              }
              break;
            }
            case 'chat': {
              const text = String(data.text || '').slice(0, 2000);
              if (!text) break;
              const from = String(data.from || 'Remote user').slice(0, 80);
              setChatMessages((current) => [...current, { from, text, at: Number(data.at) || Date.now(), mine: false }]);
              if (!chatOpenRef.current) setChatUnread((count) => Math.min(count + 1, 99));
              break;
            }
            case 'control-granted': setControlStatus('granted'); break;
            case 'control-pending': setControlStatus('pending'); break;
            case 'control-denied':
              setControlStatus('denied');
              // There is no Request-control button on mobile any more, so
              // recover without the user. This only happens against a host or
              // signaling service too old to exempt phones; ask once so the
              // session isn't silently dead to touch.
              if (!controlRetriedRef.current) {
                controlRetriedRef.current = true;
                sendMessage({ type: 'request-control' });
              }
              break;
            case 'cursor': {
              // The host reports its pointer shape ~30Hz. An I-beam means the
              // thing under the pointer takes text — web parity: that's how the
              // keyboard knows to open after you tap a field.
              if (data.cursorType) {
                lastCursorTypeRef.current = String(data.cursorType);
                if (String(data.cursorType) === 'text' && Date.now() < keyboardProbeUntilRef.current) {
                  keyboardProbeUntilRef.current = 0;
                  openKeyboardAuto();
                }
              }
              const rect = liveRectRef.current || contentRectRef.current;
              if (!rect || data.x == null) break;
              cursorPos.setValue({
                x: rect.x + Number(data.x) * rect.w - 3,
                y: rect.y + Number(data.y) * rect.h - 2,
              });
              setCursorVisible(Boolean(data.visible));
              break;
            }
            default:
              break;
          }
        };
      }
    };

    const handleOffer = async (message: any) => {
      try {
        // The host addresses itself as `senderId` on the offer; the answer and
        // every ICE candidate MUST be sent back to it (falling back to the
        // session id). Getting this wrong = the host never receives our answer,
        // ICE fails, and the session drops with a black screen.
        const hostTarget = message.senderId || sessionId;
        const iceServers = await fetchIceServers(apiBaseUrl, authToken);
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        (pc as any).ontrack = (event: any) => {
          const stream = event.streams?.[0];
          if (!stream) return;
          const track = stream.getVideoTracks?.()[0];
          const settings = track?.getSettings?.();
          if (settings?.width && settings?.height) {
            streamAspectRef.current = settings.width / settings.height;
          }
          setStreamUrl(stream.toURL());
          setStatus('streaming');
        };
        (pc as any).onicecandidate = (event: any) => {
          if (!event.candidate) return;
          wsRef.current?.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sessionId,
            targetId: hostTarget,
          }));
        };
        (pc as any).onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === 'connected') {
            if (lostGraceRef.current) { clearTimeout(lostGraceRef.current); lostGraceRef.current = null; }
            if (statusRef.current !== 'streaming') setStatus('connected');
          } else if (state === 'disconnected') {
            // A brief blip often recovers; only declare loss if it stays down.
            // (Never on 'closed' — a `closed` state during setup is a benign
            // renegotiation, and the original build kept streaming through it.)
            if (!lostGraceRef.current) lostGraceRef.current = setTimeout(markLost, 8000);
          } else if (state === 'failed') {
            markLost();
          }
        };
        (pc as any).ondatachannel = (event: any) => attachDataChannel(event.channel);

        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: message.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: 'answer', sdp: answer.sdp, sessionId, targetId: hostTarget }));

        pendingIceRef.current.forEach((candidate) => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        });
        pendingIceRef.current = [];
      } catch (err: any) {
        if (!disposed) {
          setErrorText(err?.message || 'Could not start the stream.');
          setStatus('error');
        }
      }
    };

    const ws = new WebSocket(buildSignalUrl(apiBaseUrl));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join',
        sessionId,
        token: accessToken,
        viewerClientId,
        clientKind: 'mobile-viewer',
      }));
      if (!disposed) setStatus('waiting');
    };

    ws.onmessage = (event) => {
      let message: any;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'joined':
          if (message.success === false) {
            setErrorText(message.error || 'The host rejected the connection.');
            setStatus('error');
          }
          break;
        case 'offer':
          handleOffer(message);
          break;
        case 'ice-candidate': {
          const candidate = {
            candidate: message.candidate,
            sdpMid: message.sdpMid ?? message.mid,
            sdpMLineIndex: message.sdpMLineIndex ?? 0,
          };
          const pc = pcRef.current;
          if (pc?.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          else pendingIceRef.current.push(candidate);
          break;
        }
        default:
          break;
      }
    };

    // The signaling socket is ONLY needed to exchange the offer/answer + ICE.
    // Servers routinely drop it once media is flowing, and the original build
    // kept streaming right through that. So a ws close is NOT a session loss —
    // genuine media loss surfaces through the peer connection's own state.
    // Treat a close as fatal only while we're still pre-stream (never got an
    // offer through), so a failed connect still shows an error.
    ws.onerror = () => { /* onclose follows */ };
    ws.onclose = () => {
      if (!disposed && !streamUrlRef.current && statusRef.current === 'waiting') {
        setErrorText('Could not reach the device.');
        setStatus('error');
      }
    };

    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, authToken, accessToken, sessionId, viewerClientId, retryToken]);

  // ── Video placement (fit mode ∘ pinch zoom → one rect) ──
  const baseRect = (size: { w: number; h: number }, mode: FitMode): Rect => {
    const ar = streamAspectRef.current;
    let w: number;
    let h: number;
    if (mode === 'fit') {
      // Fit inside BOTH axes. Belt-and-braces: derive from each axis and take
      // the smaller, so a bad aspect or size can never overflow the viewport
      // (that overflow is what cut the desktop off in landscape).
      w = Math.min(size.w, size.h * ar);
      h = Math.min(size.h, w / ar);
      w = h * ar;
    } else {
      w = Math.max(size.w, size.h * ar);
      h = w / ar;
    }
    return { x: (size.w - w) / 2, y: (size.h - h) / 2, w, h };
  };

  // The video surface is sized EXPLICITLY from the window, never by flex.
  // After a rotation a flex-sized surface kept a stale height (measured
  // 1439x1058 inside a 1600x720 screen), so the picture was fitted to a box
  // taller than the display and the bottom was cut off. Sizing it ourselves
  // makes the layout and the coordinate math agree by construction.
  const bottomInset = toolbarCollapsed ? insets.bottom : TOOLBAR_HEIGHT + insets.bottom;
  // A phone host's portrait stream fills the viewport edge to edge, so the
  // floating controls landed on top of the remote screen. Reserve a strip for
  // them above the picture — the desktop viewer solves the same problem with a
  // phone bezel. Desktop hosts letterbox on their own and need no strip.
  const controlBand = hostIsMobileDevice ? 52 : 0;
  const surfaceTop = insets.top + controlBand;
  const surfaceW = Math.max(0, windowDims.width - insets.left - insets.right);
  const surfaceH = Math.max(0, windowDims.height - surfaceTop - bottomInset);

  // Bottom-sheet ceilings, derived from the LIVE viewport. This screen
  // deliberately goes landscape, where a phone is only ~360-411dp tall: the old
  // constants (520 sheet / 440 list) were taller than that, and because the
  // sheet is bottom-anchored in an absoluteFill overlay its grabber and first
  // rows were laid out above y=0 with no way to scroll them back.
  const sheetMaxHeight = Math.min(520, modalMaxHeight);
  const sheetScrollMaxHeight = Math.max(160, Math.min(440, sheetMaxHeight - 40));
  // 12dp from the edges on a phone; centred and capped on a tablet/foldable.
  const chatSideInset = Math.max(12, Math.round((surfaceW - 560) / 2));

  useEffect(() => {
    if (surfaceW > 0 && surfaceH > 0) {
      setSurfaceSize((prev) => (prev && prev.w === surfaceW && prev.h === surfaceH ? prev : { w: surfaceW, h: surfaceH }));
    }
  }, [surfaceW, surfaceH]);

  // measureInWindow is still used, but only for the ORIGIN — touches arrive in
  // window coordinates, so the offset must come from the same space.
  const measureSurface = useCallback(() => {
    surfaceViewRef.current?.measureInWindow?.((x: number, y: number) => {
      surfaceOriginRef.current = { x, y };
    });
  }, []);

  useEffect(() => {
    const first = setTimeout(measureSurface, 120);
    const second = setTimeout(measureSurface, 400);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [surfaceW, surfaceH, measureSurface]);

  // Keep the zoomed content covering the viewport — no gaps past the edges
  // (web parity: clampPinchPan).
  const clampRect = (rect: Rect, size: { w: number; h: number }): Rect => {
    let { x, y } = rect;
    if (rect.w <= size.w) x = (size.w - rect.w) / 2;
    else x = Math.min(0, Math.max(size.w - rect.w, x));
    if (rect.h <= size.h) y = (size.h - rect.h) / 2;
    else y = Math.min(0, Math.max(size.h - rect.h, y));
    return { ...rect, x, y };
  };

  const resetZoom = () => {
    const size = surfaceSizeRef.current;
    resetPinchTransform();
    if (size) {
      const base = baseRect(size, fitMode);
      liveRectRef.current = base;
      setContentRect(base);
    }
    setIsZoomed(false);
  };

  useEffect(() => {
    if (!surfaceSize) return;
    if (streamDims && streamDims.w > 0 && streamDims.h > 0) {
      streamAspectRef.current = streamDims.w / streamDims.h;
    }
    const base = baseRect(surfaceSize, fitMode);
    resetPinchTransform();
    liveRectRef.current = base;
    setContentRect(base);
    setIsZoomed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceSize, fitMode, streamUrl, streamDims]);

  // ── Touch gestures (web-mobile parity) ──
  const gestureRef = useRef({
    startX: 0, startY: 0, lastX: 0, lastY: 0,
    startedAt: 0, moved: false, dragging: false, scrolling: false, fingers: 1,
    pinchMidX: 0, pinchMidY: 0,
    pinchStartDist: 0, pinchAnchorX: 0, pinchAnchorY: 0,
    twoFingerMode: null as null | 'zoom' | 'scroll',
    startRect: null as Rect | null,
    startNearTopEdge: false,
    lastMoveAt: 0,
  });

  // Screen touch → normalized 0..1 host coordinate. `contentRect` is already the
  // real on-screen video rectangle (zoom and pan included), so this needs no
  // inverse-transform math — the same reason the web can just read
  // getBoundingClientRect().
  const toNormalized = (pageX: number, pageY: number) => {
    const rect = liveRectRef.current || contentRectRef.current;
    const origin = surfaceOriginRef.current;
    if (!rect) return { x: 0, y: 0 };
    const x = (pageX - origin.x - rect.x) / rect.w;
    const y = (pageY - origin.y - rect.y) / rect.h;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  };

  // In 'fit' mode the picture is letterboxed inside the (full-window) touch
  // surface — on a 20:9 phone showing a 16:9 host that black border is ~70% of
  // the touchable area. toNormalized CLAMPS to 0..1, so a tap there used to be
  // injected at the very top/bottom of the remote desktop (title bar, taskbar).
  // Refuse to take the responder outside the picture instead; the clamp stays
  // for drag-continuation, where the finger legitimately leaves the rect.
  const isInsidePicture = (e: any) => {
    const rect = liveRectRef.current || contentRectRef.current;
    if (!rect || !(rect.w > 0) || !(rect.h > 0)) return true;
    const ne = e?.nativeEvent;
    if (!ne) return true;
    // locationX/Y are already surface-relative — the same space `rect` lives in.
    const localX = typeof ne.locationX === 'number' ? ne.locationX : ne.pageX - surfaceOriginRef.current.x;
    const localY = typeof ne.locationY === 'number' ? ne.locationY : ne.pageY - surfaceOriginRef.current.y;
    // Fail open: an event without usable coordinates behaves exactly as before.
    if (!Number.isFinite(localX) || !Number.isFinite(localY)) return true;
    return localX >= rect.x && localX <= rect.x + rect.w && localY >= rect.y && localY <= rect.y + rect.h;
  };

  const surfaceResponder = {
    onStartShouldSetResponder: (e: any) => isInsidePicture(e),
    onMoveShouldSetResponder: (e: any) => isInsidePicture(e),
    onResponderGrant: (e: any) => {
      const touches = e.nativeEvent.touches || [];
      const g = gestureRef.current;
      // Derive the surface origin from THIS event: locationX/Y are relative to
      // the surface, pageX/Y to the window, so their difference is the exact
      // offset in the same coordinate space the touch arrived in.
      // measureInWindow disagreed with touch coords by the status-bar height,
      // which pushed every click slightly down-screen (missing small targets
      // like a window's close button).
      const ne = e.nativeEvent;
      if (typeof ne.locationX === 'number' && typeof ne.locationY === 'number') {
        surfaceOriginRef.current = { x: ne.pageX - ne.locationX, y: ne.pageY - ne.locationY };
      }
      g.fingers = touches.length;
      g.startX = e.nativeEvent.pageX;
      g.startY = e.nativeEvent.pageY;
      g.lastX = g.startX;
      g.lastY = g.startY;
      g.startedAt = Date.now();
      g.moved = false;
      g.dragging = false;
      g.scrolling = false;
      g.twoFingerMode = null;
      g.startNearTopEdge = toNormalized(g.startX, g.startY).y < 0.08;
      if (touches.length >= 2) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        g.pinchStartDist = Math.hypot(dx, dy);
        g.pinchMidX = (touches[0].pageX + touches[1].pageX) / 2;
        g.pinchMidY = (touches[0].pageY + touches[1].pageY) / 2;
        // Anchor in surface-local coords, plus the rect we're zooming from.
        g.pinchAnchorX = g.pinchMidX - surfaceOriginRef.current.x;
        g.pinchAnchorY = g.pinchMidY - surfaceOriginRef.current.y;
        g.startRect = contentRectRef.current;
      }
    },
    onResponderMove: (e: any) => {
      const now = Date.now();
      const g = gestureRef.current;
      if (now - g.lastMoveAt < 16) return;
      g.lastMoveAt = now;

      const touches = e.nativeEvent.touches || [];
      if (touches.length >= 2 && g.fingers < 2) {
        // Second finger arrived mid-gesture: promote and re-anchor.
        g.fingers = touches.length;
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        g.pinchStartDist = Math.hypot(dx, dy);
        g.pinchMidX = (touches[0].pageX + touches[1].pageX) / 2;
        g.pinchMidY = (touches[0].pageY + touches[1].pageY) / 2;
        g.pinchAnchorX = g.pinchMidX - surfaceOriginRef.current.x;
        g.pinchAnchorY = g.pinchMidY - surfaceOriginRef.current.y;
        g.startRect = contentRectRef.current;
        g.twoFingerMode = null;
        // A one-finger scroll simply hands over to the two-finger gesture.
        g.scrolling = false;
        if (g.dragging) {
          const point = toNormalized(g.lastX, g.lastY);
          sendMessage({ type: 'mouseup', button: 0, ...point });
          g.dragging = false;
        }
        return;
      }

      if (touches.length >= 2) {
        const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        const midX = (touches[0].pageX + touches[1].pageX) / 2;
        const midY = (touches[0].pageY + touches[1].pageY) / 2;

        // Classify once: a distance change is a pinch-zoom; a steady-distance
        // drag is a scroll (web-mobile parity). Zoom is skipped entirely for
        // mobile hosts — a phone screen already fits the viewport in either
        // orientation, so pinching there only got in the way of scrolling.
        if (!g.twoFingerMode) {
          if (!hostIsMobileDevice && Math.abs(dist - g.pinchStartDist) > 14) g.twoFingerMode = 'zoom';
          else if (Math.hypot(midX - g.pinchMidX, midY - g.pinchMidY) > 10) g.twoFingerMode = 'scroll';
        }

        if (g.twoFingerMode === 'zoom') {
          const size = surfaceSizeRef.current;
          const start = g.startRect;
          const laid = contentRectRef.current;
          if (size && start && laid) {
            const base = baseRect(size, fitMode);
            const factor = dist / (g.pinchStartDist || 1);
            const nextW = Math.min(base.w * 4, Math.max(base.w, start.w * factor));
            const applied = nextW / start.w;
            const mLocalX = midX - surfaceOriginRef.current.x;
            const mLocalY = midY - surfaceOriginRef.current.y;
            // Where the video should appear right now (fingers stay pinned to
            // the same pixels as they scale and pan).
            const next = clampRect({
              x: mLocalX - (g.pinchAnchorX - start.x) * applied,
              y: mLocalY - (g.pinchAnchorY - start.y) * applied,
              w: start.w * applied,
              h: start.h * applied,
            }, size);
            // Express that as a transform of the CURRENT layout box — a GPU
            // transform is smooth, whereas re-laying-out the surface every
            // frame stutters. The sharp resize is committed on release.
            const s = next.w / laid.w;
            pinchScale.setValue(s);
            pinchTX.setValue((next.x + next.w / 2) - (laid.x + laid.w / 2));
            pinchTY.setValue((next.y + next.h / 2) - (laid.y + laid.h / 2));
            liveRectRef.current = next;
          }
          g.moved = true;
          return;
        }

        // scroll
        const deltaX = midX - g.pinchMidX;
        const deltaY = midY - g.pinchMidY;
        g.pinchMidX = midX;
        g.pinchMidY = midY;
        if (Math.abs(deltaX) >= 1 || Math.abs(deltaY) >= 1) {
          const point = toNormalized(midX, midY);
          // Negated so the content follows the fingers, and amplified by the
          // same factor as the one-finger scroll so the two feel identical.
          sendMessage({
            type: 'wheel',
            deltaX: -deltaX * SCROLL_SPEED,
            deltaY: -deltaY * SCROLL_SPEED,
            ...point,
          });
        }
        g.moved = true;
        return;
      }

      // Single finger.
      const pageX = e.nativeEvent.pageX;
      const pageY = e.nativeEvent.pageY;
      // A pull-down from the very top of the remote screen (notification shade)
      // is short by nature, and the host applies its own drag threshold on top
      // of this one — so barely move before committing to a drag there.
      const threshold = g.startNearTopEdge ? 2 : 8;
      if (!g.moved && Math.abs(pageX - g.startX) + Math.abs(pageY - g.startY) <= threshold) return;
      if (!g.moved) {
        g.moved = true;
        // What does a one-finger pan mean? Decided once, here, and never
        // revisited for the rest of the gesture:
        //   - mobile host: a drag, always — that is how you swipe a phone's own
        //     UI, including the notification shade pulled from the top edge.
        //   - desktop host: a SCROLL, unless the finger was pressed and held
        //     first, which is the deliberate "I want to drag / select" signal.
        //     Emitting mousedown here for every pan is what made scrolling
        //     Notepad select text instead.
        const dragIntent = hostIsMobileDevice || now - g.startedAt >= HOLD_TO_DRAG_MS;
        const start = toNormalized(g.startX, g.startY);
        if (dragIntent) {
          // Drag starts at the ORIGINAL press point (web parity).
          sendMessage({ type: 'mousemove', ...start });
          sendMessage({ type: 'mousedown', button: 0, ...start });
          g.dragging = true;
        } else {
          g.scrolling = true;
          // Park the pointer where the finger went down: Windows delivers the
          // wheel to the window under the cursor, so without this the scroll
          // would land wherever the pointer happened to be left.
          sendMessage({ type: 'mousemove', ...start });
        }
      }
      if (g.scrolling) {
        const deltaX = pageX - g.lastX;
        const deltaY = pageY - g.lastY;
        g.lastX = pageX;
        g.lastY = pageY;
        if (Math.abs(deltaX) >= 1 || Math.abs(deltaY) >= 1) {
          // Negated so the content follows the finger (finger up = page down).
          sendMessage({
            type: 'wheel',
            deltaX: -deltaX * SCROLL_SPEED,
            deltaY: -deltaY * SCROLL_SPEED,
            ...toNormalized(pageX, pageY),
          });
        }
        return;
      }
      g.lastX = pageX;
      g.lastY = pageY;
      sendMessage({ type: 'mousemove', ...toNormalized(pageX, pageY) });
    },
    onResponderRelease: (e: any) => {
      const g = gestureRef.current;
      // Commit the pinch: lay the video view out at the size it's showing, and
      // drop the transform. The renderer then redraws from the decoded frame at
      // the new size, which is what makes zoomed-in content sharp.
      if (g.twoFingerMode === 'zoom') {
        const size = surfaceSizeRef.current;
        const live = liveRectRef.current;
        if (live) {
          resetPinchTransform();
          setContentRect(live);
        }
        const zoomed = Boolean(size && live && live.w > baseRect(size, fitMode).w * 1.01);
        setIsZoomed((prev) => (prev === zoomed ? prev : zoomed));
      }
      if (g.dragging) {
        sendMessage({ type: 'mouseup', button: 0, ...toNormalized(e.nativeEvent.pageX, e.nativeEvent.pageY) });
        g.dragging = false;
        return;
      }
      if (g.scrolling) {
        // A pan that scrolled is finished — no click, no wheel tail.
        g.scrolling = false;
        return;
      }
      if (g.fingers >= 2 || g.moved) return;
      // Nothing below here can run unless the finger never passed the movement
      // threshold, so a hold-then-drag can never also fire a right click.
      // Quick tap = left click; a still long-press (≥500ms) = right click.
      const button = Date.now() - g.startedAt > 500 ? 2 : 0;
      const point = toNormalized(g.startX, g.startY);
      sendMessage({ type: 'mousemove', ...point });
      sendMessage({ type: 'mousedown', button, ...point });
      // 12ms up-delay (web parity — longer delays trip Android hosts' paste bubble).
      setTimeout(() => sendMessage({ type: 'mouseup', button, ...point }), 12);
      if (button === 0) {
        // Tapped a field? If the pointer was already an I-beam, open the
        // keyboard now; otherwise give the host a moment to report one.
        if (lastCursorTypeRef.current === 'text') openKeyboardAuto();
        else keyboardProbeUntilRef.current = Date.now() + 1500;
      }
    },
    onResponderTerminate: () => {
      const g = gestureRef.current;
      g.scrolling = false;
      if (g.dragging) {
        const point = toNormalized(g.lastX, g.lastY);
        sendMessage({ type: 'mouseup', button: 0, ...point });
        g.dragging = false;
      }
    },
  };

  // ── Keyboard input (diff-based typeText; layout-independent) ──
  const sendKeystrokes = (nextValue: string) => {
    const previous = keyboardValue;
    if (nextValue.length > previous.length) {
      const appended = nextValue.slice(previous.length);
      if (appended) sendMessage({ type: 'typeText', text: appended });
    } else if (nextValue.length < previous.length) {
      const removed = previous.length - nextValue.length;
      for (let i = 0; i < removed; i += 1) {
        const vk = vkForKey('Backspace');
        sendMessage({ type: 'keydown', keyCode: vk, key: 'Backspace' });
        sendMessage({ type: 'keyup', keyCode: vk, key: 'Backspace' });
      }
    }
    setKeyboardValue(nextValue);
  };

  const sendSpecialKey = (key: string) => {
    const vk = vkForKey(key);
    if (!vk) return;
    sendMessage({ type: 'keydown', keyCode: vk, key });
    sendMessage({ type: 'keyup', keyCode: vk, key });
  };

  // Opened by the host telling us the focus takes text (focus-editable, or an
  // I-beam cursor after a tap) rather than by the user pressing the key button.
  // Respects a deliberate dismissal for 4s so it can't fight the user.
  const openKeyboardAuto = () => {
    if (Date.now() - keyboardClosedAtRef.current < 4000) return;
    autoKeyboardRef.current = true;
    setKeyboardValue('');
    setShowKeyboard(true);
  };

  const openKeyboard = () => {
    autoKeyboardRef.current = false;
    setKeyboardValue('');
    setShowKeyboard(true);
    setTimeout(() => keyboardInputRef.current?.focus?.(), 30);
  };

  const closeKeyboard = () => {
    keyboardClosedAtRef.current = Date.now();
    setShowKeyboard(false);
    Keyboard.dismiss();
  };

  // ── Sheet contents (labels/order copied from the web viewer) ──
  const shortcutItems: { label: string; icon: React.ReactNode; onPress: () => void }[] = hostIsMobileDevice
    ? [
        { label: 'Back', icon: <Feather name="corner-up-left" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => sendMessage({ type: 'globalAction', action: 1 }) },
        { label: 'Home', icon: <Feather name="home" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('home') },
        { label: 'Recent apps', icon: <Feather name="grid" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('recents') },
        { label: 'Notifications', icon: <Feather name="bell" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => sendMessage({ type: 'shortcut', key: 'notifications' }) },
      ]
    : [
        { label: 'Task Manager', icon: <Feather name="activity" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('task_manager') },
        { label: 'Switch window', icon: <Feather name="repeat" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => sendMessage({ type: 'keyCombo', keys: [0x12, 0x09] }) },
        { label: 'Show desktop', icon: <Feather name="monitor" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => sendMessage({ type: 'shortcut', key: 'show-desktop' }) },
        { label: 'File Explorer', icon: <Feather name="folder" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => sendMessage({ type: 'shortcut', key: 'file-explorer' }) },
        { label: 'Quick Settings', icon: <Feather name="sliders" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => sendMessage({ type: 'shortcut', key: 'control-center' }) },
        { label: 'Lock', icon: <Feather name="lock" size={16} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('lock') },
      ];

  const actionItems: { label: string; icon: React.ReactNode; danger?: boolean; onPress: () => void }[] = [
    {
      label: chatUnread > 0 ? `Chat with remote user (${chatUnread > 9 ? '9+' : chatUnread})` : 'Chat with remote user',
      icon: <Feather name="message-square" size={15} color="rgba(17,19,21,0.55)" />,
      onPress: () => setChatOpen(true),
    },
    { label: 'Refresh stream', icon: <Feather name="refresh-cw" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => sendMessage({ type: 'request-keyframe', urgent: true }) },
    { label: 'Ctrl + Alt + Del (Task Manager)', icon: <Feather name="command" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('task_manager') },
    { label: 'Minimize Remote 365 on host', icon: <Feather name="minimize-2" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('minimize_host_window') },
    { label: 'Open browser', icon: <Feather name="globe" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('browser') },
    { label: 'File explorer', icon: <Feather name="folder" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('explorer') },
    { label: 'Lock screen', icon: <Feather name="lock" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => hostAction('lock') },
    { label: 'Sign out remote user', icon: <Feather name="log-out" size={15} color="#FF383C" />, danger: true, onPress: () => confirmHostAction('sign_out', 'Sign out remote computer', 'The current Windows user on the remote computer will be signed out and their desktop session will end.', 'Sign out') },
    { label: 'Safe reboot (15s grace)', icon: <Feather name="rotate-ccw" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => confirmHostAction('safe_reboot', 'Safe reboot', 'The remote computer will restart after a 15-second grace period so open apps can react first.', 'Reboot') },
    { label: 'Restart device', icon: <Feather name="power" size={15} color="#FF383C" />, danger: true, onPress: () => confirmHostAction('reboot', 'Remote reboot', 'The remote computer is going to reboot immediately. Click Cancel to prevent it.', 'Restart') },
  ];

  const viewItems: { label: string; icon: React.ReactNode; active?: boolean; onPress: () => void }[] = [
    { label: 'Best fit', icon: <Feather name="monitor" size={15} color="rgba(17,19,21,0.55)" />, active: fitMode === 'fit', onPress: () => { setFitMode('fit'); resetZoom(); } },
    { label: 'Scaled (fill screen)', icon: <Feather name="maximize" size={15} color="rgba(17,19,21,0.55)" />, active: fitMode === 'fill', onPress: () => { setFitMode('fill'); resetZoom(); } },
    ...(isZoomed
      ? [{ label: 'Reset zoom', icon: <Feather name="zoom-out" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => resetZoom() }]
      : []),
    { label: 'Quality: Auto select', icon: <Feather name="check" size={15} color="rgba(17,19,21,0.55)" />, active: qualityMode === 'auto', onPress: () => pickQuality('auto') },
    { label: 'Quality: Optimal speed', icon: <Feather name="zap" size={15} color="rgba(17,19,21,0.55)" />, active: qualityMode === 'speed', onPress: () => pickQuality('speed') },
    { label: 'Quality: Optimal quality', icon: <Feather name="monitor" size={15} color="rgba(17,19,21,0.55)" />, active: qualityMode === 'quality', onPress: () => pickQuality('quality') },
    ...(hostIsMobileDevice
      ? []
      : [{ label: isLandscape ? 'Back to portrait' : 'Rotate to landscape', icon: <Feather name="rotate-cw" size={15} color="rgba(17,19,21,0.55)" />, onPress: () => { setSheet(null); toggleLandscape(); } }]),
  ];

  // ── Screens: connection lost / connecting cover ──
  if (status === 'lost') {
    return (
      <View style={styles.lostRoot}>
        <StatusBar style="dark" />
        {/* Scrolls instead of clipping: the stack is taller than a phone's
            landscape viewport, and it is centre-aligned, so it used to be cut
            at BOTH ends — taking Reconnect off-screen. */}
        <ScrollView
          style={styles.stateScroll}
          contentContainerStyle={[
            styles.stateScrollContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.lostIconTile}>
            <MaterialCommunityIcons name="monitor-off" size={36} color="#EF4444" />
          </View>
          <Text style={[styles.lostTitle, textSize(24)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Connection lost</Text>
          <Text style={[styles.lostBody, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>The session to {deviceName} ended or was interrupted.</Text>
          <View style={styles.lostButtons}>
            <Pressable style={styles.lostSecondary} onPress={onExit}>
              <Text style={[styles.lostSecondaryText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Back to devices</Text>
            </Pressable>
            <Pressable
              style={styles.lostPrimary}
              onPress={() => { setStatus('connecting'); setStreamUrl(null); setRetryToken((n) => n + 1); }}
            >
              <Text style={[styles.lostPrimaryText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Reconnect</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!streamUrl) {
    const isError = status === 'error';
    return (
      <View style={styles.connectingRoot}>
        <StatusBar style="dark" />
        {/* Same treatment as the lost screen: this stack is ~450dp tall and the
            screen genuinely renders in landscape (orientation is unlocked on
            mount), where it used to clip 'Cancel session' off the bottom. */}
        <ScrollView
          style={styles.stateScroll}
          contentContainerStyle={[
            styles.stateScrollContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.connectingInner}>
            <Image
              source={waitImage}
              style={[styles.connectingImage, {
                width: Math.min(230, windowDims.width - 48),
                height: Math.min(190, windowDims.height * 0.25),
              }]}
              resizeMode="contain"
            />
            <View style={[styles.connectingChip, control(32)]}>
              <View style={styles.connectingChipDot} />
              <Text style={[styles.connectingChipText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Connecting safely</Text>
            </View>
            <Text style={[styles.connectingTitle, type(24, 34 / 24)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {isError ? 'Could not connect' : `Connecting to ${deviceName}`}
            </Text>
            <Text style={[styles.connectingBody, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {isError
                ? (errorText || 'The device did not accept the session.')
                : 'Hold on while we reach the device and secure the session.'}
            </Text>
            {!isError ? (
              <>
                <View style={styles.connectingBarTrack}>
                  <Animated.View
                    style={[styles.connectingBarFill, {
                      transform: [{
                        translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-140, 280] }),
                      }],
                    }]}
                  />
                </View>
                <Text style={[styles.connectingStatus, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{CONNECTING_MESSAGES[connectingMsgIndex]}…</Text>
              </>
            ) : null}
            <Pressable style={styles.connectingCancel} onPress={onExit}>
              <Text style={[styles.connectingCancelText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isError ? 'Back to devices' : 'Cancel session'}</Text>
            </Pressable>
          </View>
        </ScrollView>
        {/* edgeToEdgeEnabled draws under the gesture bar, so a raw bottom: 16
            put this line inside it. */}
        <Text
          style={[styles.connectingFooter, textSize(8), { bottom: insets.bottom + 16 }]}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          Copyright 2026 (c) Remote 365. All right reserved.
        </Text>
      </View>
    );
  }

  // ── In-session UI ──
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Video surface — absolutely positioned and explicitly sized from the
          window + safe-area insets, so the remote picture is separated from the
          phone's own status/nav bars AND can't inherit a stale flex height
          after a rotation. */}
      <View
        ref={surfaceViewRef}
        style={[styles.surface, {
          position: 'absolute',
          left: insets.left,
          top: surfaceTop,
          width: surfaceW,
          height: surfaceH,
        }]}
        onLayout={measureSurface}
        {...surfaceResponder}
      >
        {/* The video view is laid out AT contentRect — the same rect the input
            mapping and the cursor overlay use. Never gated on measurement: it
            falls back to filling the surface so a missing rect can't blank the
            picture. */}
        <Animated.View
          style={[
            contentRect
              ? { position: 'absolute', left: contentRect.x, top: contentRect.y, width: contentRect.w, height: contentRect.h }
              : StyleSheet.absoluteFillObject,
            { transform: [{ translateX: pinchTX }, { translateY: pinchTY }, { scale: pinchScale }] },
          ]}
          pointerEvents="none"
        >
          <RTCView
            streamURL={streamUrl}
            style={styles.video}
            objectFit="contain"
            zOrder={0}
            onDimensionsChange={(e: any) => {
              const { width, height } = e?.nativeEvent || {};
              if (width > 0 && height > 0) {
                setStreamDims((prev) => (prev?.w === width && prev?.h === height ? prev : { w: width, h: height }));
              }
            }}
          />
        </Animated.View>
        {cursorVisible ? (
          <Animated.View pointerEvents="none" style={[styles.cursor, { transform: cursorPos.getTranslateTransform() }]}>
            <CursorArrow />
          </Animated.View>
        ) : null}
      </View>

      {/* Rotate chip (top-left, web parity) */}
      {/* Rotate is pointless for a phone host — its screen already fits either
          way — and the chip only covered the remote picture, so it's hidden. */}
      {hostIsMobileDevice ? null : (
        <Pressable style={[styles.rotateChip, { top: Math.max(insets.top, 12), left: insets.left + 12 }]} onPress={toggleLandscape}>
          <Feather name="rotate-cw" size={14} color="#FFFFFF" />
          <Text style={[styles.rotateChipText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Rotate</Text>
        </Pressable>
      )}

      {/* Top-right disconnect (web parity: always reachable, even with the bar hidden) */}
      {/* In landscape the phone's gesture/nav bar sits along one SIDE, so these
          must clear insets.right or the system swallows the taps. */}
      <Pressable style={[styles.topDisconnect, { top: Math.max(insets.top, 12), right: insets.right + 12 }]} onPress={openDisconnectConfirm}>
        <MaterialCommunityIcons name="monitor-off" size={16} color="#FFFFFF" />
      </Pressable>

      {/* Collapsed-toolbar floating tab (right edge) */}
      {toolbarCollapsed ? (
        <Pressable
          style={[styles.collapsedTab, { bottom: Math.max(insets.bottom, 12) + 24, right: insets.right }]}
          onPress={() => setToolbarCollapsed(false)}
        >
          {chatUnread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={[styles.unreadBadgeText, textSize(9)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
            </View>
          ) : null}
          <Feather name="chevron-up" size={22} color="#111315" />
        </Pressable>
      ) : null}

      {/* Chat panel */}
      {chatOpen ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          // The toolbar below carries a comment about this exact hazard: in
          // landscape the nav bar sits along one SIDE, so the Send button has
          // to clear insets.right or the system eats the taps. The side inset
          // also keeps the panel a card (not a 1300dp band) on a tablet.
          style={[styles.chatPanelWrap, {
            left: insets.left + chatSideInset,
            right: insets.right + chatSideInset,
            bottom: bottomInset + 14,
          }]}
          pointerEvents="box-none"
        >
          {/* Cap to the space actually available — a fixed 400 was taller than
              the whole screen in landscape, pushing the header off the top. */}
          <View style={[styles.chatPanel, { maxHeight: Math.max(200, surfaceH - 28) }]}>
            <View style={[styles.chatHeader, control(40)]}>
              <Text style={[styles.chatHeaderTitle, textSize(13)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>Chat — {deviceName}</Text>
              <Pressable hitSlop={14} onPress={() => setChatOpen(false)}>
                <Feather name="x" size={16} color="#111315" />
              </Pressable>
            </View>
            <ScrollView
              ref={chatListRef}
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            >
              {chatMessages.length === 0 ? (
                <Text style={[styles.chatEmpty, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Messages appear on {deviceName} next to the Remote 365 dock.</Text>
              ) : chatMessages.map((message, index) => (
                <View
                  key={`${message.at}-${index}`}
                  style={[styles.chatBubble, message.mine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}
                >
                  {!message.mine ? <Text style={[styles.chatSender, textSize(10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{message.from}</Text> : null}
                  <Text style={[styles.chatText, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{message.text}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={[styles.chatComposer, control(56)]}>
              <TextInput
                style={[styles.chatInput, control(36), textSize(13)]}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                placeholder="Type a message"
                placeholderTextColor="rgba(17,19,21,0.35)"
                value={chatDraft}
                onChangeText={setChatDraft}
                onSubmitEditing={sendChat}
                maxLength={500}
                returnKeyType="send"
              />
              <Pressable style={[styles.chatSend, control(36)]} onPress={sendChat}>
                <Text style={[styles.chatSendText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Send</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {/* Bottom toolbar (white 64px bar, web-mobile layout) */}
      {!toolbarCollapsed ? (
        <SafeAreaView
          // Keep the bar's buttons clear of the side nav bar in landscape.
          // SafeAreaView applies these edges as PADDING — the explicit
          // marginLeft/marginRight that used to sit here applied the same
          // insets a second time, so the white bar stopped ~2x the nav-bar
          // width short of the screen edge.
          edges={['bottom', 'left', 'right']}
          style={[
            styles.toolbar,
            Platform.OS === 'ios' && keyboardHeight > 0 ? { bottom: keyboardHeight } : null,
          ]}
        >
          {/* The row's children are 300dp of fixed boxes. Give the side padding
              back to them before anything is pushed off-screen (a 360dp phone at
              Android 'Largest' display size reports ~277dp of usable width). */}
          <View style={[styles.toolbarRow, { paddingHorizontal: Math.min(22, Math.max(8, Math.floor((surfaceW - 300) / 2))) }]}>
            {/* Icons match the web-mobile session bar 1:1 (lucide → Feather/MCI
                equivalents): Command · Hand · Keyboard · Zap · Settings ·
                ScreenShareOff · ChevronDown. */}
            <Pressable style={styles.toolButton} onPress={() => setSheet(sheet === 'actions' ? null : 'actions')}>
              <Feather name="command" size={20} color="#FF8A00" />
            </Pressable>
            <Pressable style={styles.toolButton} onPress={() => setSheet(sheet === 'gestures' ? null : 'gestures')}>
              <MaterialCommunityIcons name="gesture-tap" size={22} color="#111315" />
            </Pressable>
            <Pressable style={styles.toolButton} onPress={() => (showKeyboard ? closeKeyboard() : openKeyboard())}>
              <MaterialCommunityIcons name="keyboard-outline" size={22} color={showKeyboard ? '#FF8A00' : '#111315'} />
            </Pressable>
            <Pressable style={styles.toolButton} onPress={() => setSheet(sheet === 'shortcuts' ? null : 'shortcuts')}>
              <Feather name="zap" size={21} color="#111315" />
            </Pressable>
            <Pressable style={styles.toolButton} onPress={() => setSheet(sheet === 'view' ? null : 'view')}>
              <Feather name="settings" size={21} color="#111315" />
            </Pressable>
            <View style={styles.toolbarEndGroup}>
              <Pressable style={styles.endButton} onPress={openDisconnectConfirm}>
                <MaterialCommunityIcons name="monitor-off" size={22} color="#FF383C" />
              </Pressable>
              <Pressable
                style={styles.hideButton}
                hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                onPress={() => { setSheet(null); setToolbarCollapsed(true); }}
              >
                <Feather name="chevron-down" size={22} color="#111315" />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      ) : null}

      {/* Bottom sheets */}
      {sheet ? (
        <View style={sheetStyles.overlay}>
          <Pressable style={sheetStyles.backdrop} onPress={() => setSheet(null)} />
          <SafeAreaView edges={['bottom', 'left', 'right']} style={[sheetStyles.sheet, { maxHeight: sheetMaxHeight }]}>
            <View style={sheetStyles.grabber} />
            {sheet === 'gestures' ? (
              <ScrollView style={{ maxHeight: sheetScrollMaxHeight }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12 }}>
                <Text style={[sheetStyles.gestureTitle, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Touch gestures')}</Text>
                {(hostIsMobileDevice
                  ? [
                      t('Tap — left click'),
                      t('Drag one finger — swipe or drag'),
                      t('Long-press — right click'),
                      t('Two fingers — scroll'),
                    ]
                  : [
                      t('Tap — left click'),
                      t('Drag one finger — scroll'),
                      t('Press and hold, then move — drag or select text'),
                      t('Long-press — right click'),
                      t('Two fingers — scroll'),
                      t('Pinch — zoom'),
                    ]
                ).map((line) => (
                  <Text key={line} style={[sheetStyles.gestureLine, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{line}</Text>
                ))}
                {hostIsMobileDevice ? null : (
                  <Pressable style={[sheetStyles.rotateButton, control(40)]} onPress={() => { setSheet(null); toggleLandscape(); }}>
                    <Feather name="rotate-cw" size={15} color="#111315" />
                    <Text style={[sheetStyles.rotateButtonText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isLandscape ? t('Back to portrait') : t('Rotate to landscape')}</Text>
                  </Pressable>
                )}
              </ScrollView>
            ) : (
              <ScrollView style={{ maxHeight: sheetScrollMaxHeight }}>
                {(sheet === 'actions' ? actionItems : sheet === 'shortcuts' ? shortcutItems : viewItems).map((item: any) => (
                  <SheetRow
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    danger={item.danger}
                    active={item.active}
                    onPress={() => {
                      if (!item.danger) setSheet(null);
                      item.onPress();
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      ) : null}

      {/* Confirm card (disconnect + destructive host actions) */}
      {confirm ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={sheetStyles.backdrop} onPress={() => setConfirm(null)} />
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <Text style={[styles.confirmTitle, type(22, 30 / 22)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{confirm.title}</Text>
              <Pressable hitSlop={8} onPress={() => setConfirm(null)}>
                <Feather name="x" size={24} color="#111315" />
              </Pressable>
            </View>
            <View>
              <Text style={[styles.confirmBody, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{confirm.body}</Text>
              {confirm.hint ? <Text style={[styles.confirmHint, type(12, 16 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{confirm.hint}</Text> : null}
            </View>
            <View style={styles.confirmFooter}>
              <Pressable style={[styles.confirmCancel, control(40)]} onPress={() => setConfirm(null)}>
                <Text style={[styles.confirmCancelText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmDanger, control(40)]} onPress={confirm.onConfirm}>
                <Text style={[styles.confirmDangerText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{confirm.confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Hidden input that drives the remote keyboard */}
      {showKeyboard ? (
        <TextInput
          ref={keyboardInputRef}
          style={styles.hiddenInput}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          value={keyboardValue}
          onChangeText={sendKeystrokes}
          onSubmitEditing={() => sendSpecialKey('Enter')}
          onBlur={closeKeyboard}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  root: { flex: 1, backgroundColor: '#1A1D21' },
  // NOT flex — the size is set inline from the window (see surfaceW/surfaceH).
  surface: { backgroundColor: '#0A0A0A', overflow: 'hidden' },
  video: { flex: 1, backgroundColor: '#0A0A0A' },
  cursor: { position: 'absolute', left: 0, top: 0, zIndex: 60 },

  rotateChip: {
    position: 'absolute',
    left: 12,
    zIndex: 85,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rotateChipText: { color: '#FFFFFF' },
  topDisconnect: {
    position: 'absolute',
    right: 12,
    zIndex: 100,
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#FF383C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedTab: {
    position: 'absolute',
    right: 0,
    zIndex: 120,
    height: 44,
    width: 48,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 4,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  unreadBadge: {
    position: 'absolute',
    left: 4,
    top: 4,
    minWidth: 16,
    // minHeight + a pill radius: a fixed 16 cropped '9+' to unreadable stubs
    // once the OS font scale was raised.
    minHeight: 16,
    borderRadius: 999,
    backgroundColor: '#FF383C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 1,
    zIndex: 1,
  },
  unreadBadgeText: { fontWeight: '700', color: '#FFFFFF' },

  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 82,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  toolbarRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingHorizontal is set at the call site from the live width.
    paddingVertical: 10,
  },
  // flexShrink (RN defaults it to 0) + a floor: the row is 300dp of fixed boxes
  // and used to paint the Hide chevron and part of the End pill off-screen on a
  // narrow/scaled-display phone instead of tightening up.
  toolButton: { height: 40, width: 40, flexShrink: 1, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  toolBadge: {
    position: 'absolute',
    right: 2,
    top: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF383C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toolbarEndGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  endButton: {
    height: 44,
    width: 64,
    flexShrink: 1,
    minWidth: 44,
    borderRadius: 34,
    backgroundColor: 'rgba(255,56,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideButton: { height: 40, width: 24, alignItems: 'center', justifyContent: 'center' },

  // left/right are set at the call site so they can clear insets.left/right.
  chatPanelWrap: { position: 'absolute', zIndex: 90 },
  chatPanel: {
    height: 400,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  chatHeader: {
    // Height comes from control(40) at the call site so the title can't be
    // cropped by a fixed row at a raised font scale.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,29,33,0.08)',
  },
  chatHeaderTitle: { flex: 1, minWidth: 0, fontWeight: '600', color: '#111315' },
  chatList: { flex: 1, backgroundColor: '#F9FAFB' },
  chatListContent: { padding: 12, gap: 6 },
  chatEmpty: { color: 'rgba(17,19,21,0.45)', textAlign: 'center', paddingTop: 24 },
  chatBubble: { maxWidth: '82%', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chatBubbleMine: { alignSelf: 'flex-end', backgroundColor: '#FFE9D2' },
  chatBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  chatSender: { color: 'rgba(17,19,21,0.5)', marginBottom: 2 },
  // fontSize/lineHeight come from type(13, 18/13): RN scales fontSize with the
  // OS setting but never lineHeight, so a hardcoded 18 clipped scaled text.
  chatText: { color: '#111315' },
  chatComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,29,33,0.08)',
    backgroundColor: '#FFFFFF',
  },
  chatInput: {
    flex: 1,
    minWidth: 0,
    // Height comes from control(36); paddingVertical:0 keeps the box at exactly
    // 36 today (Android's EditText adds its own vertical padding otherwise) and
    // lets it grow with the text instead of cropping the caret.
    paddingVertical: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.25)',
    paddingHorizontal: 10,
    color: '#111315',
  },
  chatSend: {
    borderRadius: 8,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chatSendText: { fontWeight: '600', color: '#FFFFFF' },

  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 468,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 22,
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
  },
  confirmHeader: {
    // No fixed height — a 24px title can wrap to two lines and must not clip.
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 4,
  },
  // fontSize/lineHeight come from type() at the call site — RN scales fontSize
  // with the OS setting but never lineHeight, so a literal 30/20/16 clips.
  confirmTitle: { fontWeight: '700', color: '#111315', flex: 1 },
  confirmBody: { color: '#111315' },
  confirmHint: { color: 'rgba(17,19,21,0.55)', marginTop: 6 },
  confirmFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingBottom: 10 },
  confirmCancel: {
    flex: 1,
    // Height comes from control(40) at the call site.
    maxWidth: 124,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  confirmCancelText: { fontWeight: '500', color: '#111315' },
  confirmDanger: {
    flex: 1,
    // Height comes from control(40) at the call site.
    maxWidth: 124,
    borderRadius: 32,
    backgroundColor: '#FF383C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerText: { fontWeight: '600', color: '#FFFFFF' },

  connectingRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // Shared by the connecting and connection-lost screens: the content scrolls
  // rather than being clipped at both ends when the viewport is short.
  // flex:1 (RN's default flexShrink is 0): without it the ScrollView measures
  // to its ~452dp content and simply overflows a short landscape viewport at
  // both ends — i.e. it would not scroll at all, which is the bug being fixed.
  stateScroll: { flex: 1, alignSelf: 'stretch' },
  stateScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  connectingInner: { alignItems: 'center', gap: 14, maxWidth: 340, width: '100%' },
  // Overridden at the call site so the illustration shrinks on a short viewport.
  connectingImage: { width: 230, height: 190 },
  connectingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
  },
  connectingChipDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: '#34C759' },
  connectingChipText: { color: '#111315' },
  // fontSize/lineHeight come from type() at the call site — RN never scales a
  // hardcoded lineHeight, so it becomes a clipping box as the text grows.
  connectingTitle: { fontWeight: '700', color: '#111315', textAlign: 'center' },
  connectingBody: { color: 'rgba(26,29,33,0.7)', textAlign: 'center' },
  connectingBarTrack: {
    height: 6,
    width: '100%',
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    marginTop: 6,
  },
  connectingBarFill: { height: 6, width: 140, borderRadius: 3, backgroundColor: '#FF8A00' },
  connectingStatus: { color: 'rgba(26,29,33,0.55)' },
  connectingCancel: {
    marginTop: 10,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  connectingCancelText: { fontWeight: '500', color: '#FFFFFF' },
  connectingFooter: {
    position: 'absolute',
    // `bottom` is set at the call site from insets.bottom (edge-to-edge draws
    // under the gesture bar).
    color: 'rgba(26,29,33,0.45)',
  },

  lostRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lostIconTile: {
    height: 80,
    width: 80,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  lostTitle: { fontWeight: '600', color: '#111315', marginBottom: 8 },
  lostBody: { color: 'rgba(26,29,33,0.55)', marginBottom: 40, textAlign: 'center' },
  // The pair is ~308dp wide against 312dp of usable width on a 360dp phone, so
  // it clipped Reconnect the moment the font scale or the screen changed. Let
  // it wrap onto a second line instead.
  lostButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  lostSecondary: {
    flexShrink: 1,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.15)',
  },
  lostSecondaryText: { fontWeight: '500', color: 'rgba(26,29,33,0.7)' },
  lostPrimary: {
    flexShrink: 1,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FF8A00',
  },
  lostPrimaryText: { fontWeight: '500', color: '#FFFFFF' },

  hiddenInput: { position: 'absolute', bottom: 2, left: 2, width: 1, height: 1, opacity: 0 },
}));
