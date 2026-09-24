import { app, shell, dialog, BrowserWindow, BrowserView, ipcMain, safeStorage, clipboard, screen, Notification, session, Menu, Tray, desktopCapturer, globalShortcut, powerMonitor, powerSaveBlocker } from 'electron';
import { isViewerMediaActive, hasActiveMediaViewer, updateHostMediaActivity } from '../shared/viewerMediaPolicy';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { join, basename, resolve } from 'path';
import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { createWriteStream, readFileSync, writeFileSync, existsSync } from 'fs';
// Host dock mascot: the Lottie player is inlined into the dock page at build
// time (the packaged app ships no node_modules a window could load), and the
// robot animation is whichever src/renderer/assets/animations/dockRobot*.json
// exists. No file means the dock draws its built-in robot instead.
import lottiePlayerSource from 'lottie-web/build/player/lottie_light.min.js?raw';
const dockRobotAnimations = import.meta.glob('../renderer/assets/animations/dockRobot*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
import { WebSocket } from 'ws';
import {
  startLanDirect,
  stopLanDirect,
  sendToLanViewer,
  isLanViewer,
  isLanDirectRunning,
  discoverLanHosts,
  getLanAddresses,
  LAN_SIGNAL_PORT,
} from './lanDirect';
import * as os from 'os';
import * as http from 'http';
import { monitorEventLoopDelay } from 'perf_hooks';
// Routes injection through the elevated service when available, else the native addon.
import * as input from './elevatedInput';
import { startStreamWorker, startWorkerStream, stopWorkerStream, stopStreamWorker, setWorkerSecureForce, requestWorkerKeyframe, onWorkerNal, onWorkerEvent, isStreamWorkerEnabled, disableWorkerFallback } from './hostStreamClient';
import { SecureDesktopCapture } from './secureCapture';
import { RawFramePool, staticFrameInterval, shouldWriteFrame } from './rawFramePolicy';
import { ensureUnattendedCredential, readUnattendedCredential, setAppSupervision } from './unattendedHost';
import { clearHostIntent, hasNetworkLink, readHostIntent, saveHostIntent, startNetworkRestoreWatcher } from './hostAutostart';
import { armUpdateLock, clearUpdateLock, updateLockPath } from './updateGuard';
import { decodeCompactInput, isCompactInput } from '../shared/inputProtocol';
import { handleFileTransferCommand, handleFileTransferChunk, cancelAllFileTransfers, startHostPull } from './fileTransfer';
import { registerLocalFileHandlers, closeAllLocalWrites } from './localFiles';
import {
  showViewerCameraWindow,
  hideViewerCameraWindow,
  deliverViewerCameraFrame,
  setViewerCameraNotifier,
  isViewerCameraWindowOpen,
} from './viewerCameraWindow';
import * as crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let datachannel: any = null;

const buildEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const PRODUCTION_SERVER_HOST = 'remote365.ai';
const DEFAULT_SERVER_HOST = process.env.CONNECT_X_SERVER_HOST || buildEnv.VITE_SERVER_HOST || PRODUCTION_SERVER_HOST;
const DEFAULT_SERVER_ORIGIN = process.env.CONNECT_X_SERVER_ORIGIN || buildHttpOrigin(DEFAULT_SERVER_HOST);
let currentSignalingServer = DEFAULT_SERVER_HOST;

function usesPlainProtocol(host: string) {
  const hostname = host.split(':')[0];
  return /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|\d{1,3}(?:\.\d{1,3}){3})$/i.test(hostname);
}

function normalizeServerHost(value?: string) {
  const raw = String(value || DEFAULT_SERVER_HOST).trim();
  if (!raw) return DEFAULT_SERVER_HOST;
  try {
    const host = new URL(raw.includes('://') ? raw : `https://${raw}`).host;
    return host;
  } catch {
    const host = raw.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
    return host;
  }
}

function buildHttpOrigin(value?: string) {
  const raw = String(value || DEFAULT_SERVER_ORIGIN).trim();
  const host = normalizeServerHost(raw);
  return `${usesPlainProtocol(host) ? 'http' : 'https'}://${host}`;
}

function buildSignalUrl(value?: string) {
  const raw = String(value || DEFAULT_SERVER_HOST).trim();
  const host = normalizeServerHost(raw);
  return `${usesPlainProtocol(host) ? 'ws' : 'wss'}://${host}/api/signal`;
}

function safeCloseWebSocket(socket: WebSocket | null | undefined) {
  if (!socket) return;
  try {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  } catch (err: any) {
    log.warn(`[WebSocket] Ignored close error: ${err?.message || err}`);
  }
}

function ensureDatachannel() {
  if (datachannel) return datachannel;
  const candidates = [
    'node-datachannel',
    ...(app.isPackaged
      ? [
          join(
            process.resourcesPath,
            'app.asar.unpacked',
            'node_modules',
            'node-datachannel',
            'dist',
            'cjs',
            'lib',
            'index.cjs'
          )
        ]
      : [])
  ];

  let lastError: any = null;
  for (const candidate of candidates) {
    try {
      datachannel = require(candidate);
      return datachannel;
    } catch (error: any) {
      lastError = error;
      log.warn('[Host] node-datachannel load candidate failed:', candidate, error?.message || error);
    }
  }

  try {
    throw lastError;
  } catch (error: any) {
    const message = error?.message || String(error);
    log.error('[Host] Failed to load node-datachannel:', message);
    dialog.showErrorBox(
      'Remote Engine Unavailable',
      `Remote desktop streaming could not start because the native WebRTC module was not found.\n\n${message}`
    );
    throw error;
  }
}

// Keep GPU acceleration enabled by default so viewer playback can use hardware
// decode/compositing. Allow support to disable it only for machines with known
// graphics-driver capture issues.
app.name = 'Remote 365';

// Advanced settings persisted per-machine (Settings → Advanced). Read before the
// app is ready because GPU acceleration can only be toggled at this point.
// Windows toast attribution: without an explicit AppUserModelID, notifications
// are headed "electron.app.Remote 365". This ID must match electron-builder's
// appId (stamped on the Start Menu shortcut) so toasts show "Remote 365" with
// the app icon instead.
if (process.platform === 'win32') app.setAppUserModelId('com.connectx.desktop');

interface AdvancedFlags { disableGpu: boolean; launchMinimized: boolean; keepRunning: boolean; detailedLogs: boolean; autostartDefaultApplied?: boolean; }
const ADVANCED_FLAGS_PATH = () => join(app.getPath('userData'), 'connectx_advanced.json');
let advancedFlags: AdvancedFlags = { disableGpu: false, launchMinimized: false, keepRunning: true, detailedLogs: false };
try {
  const raw = readFileSync(ADVANCED_FLAGS_PATH(), 'utf8');
  advancedFlags = { ...advancedFlags, ...JSON.parse(raw) };
} catch {}
const persistAdvancedFlags = () => {
  try { require('fs').writeFileSync(ADVANCED_FLAGS_PATH(), JSON.stringify(advancedFlags)); } catch {}
};

if (process.env.REMOTE365_DISABLE_GPU === '1' || advancedFlags.disableGpu) {
  app.disableHardwareAcceleration();
}
try { log.transports.file.level = advancedFlags.detailedLogs ? 'debug' : 'info'; } catch {}

// Allow video autoplay in viewer windows opened programmatically (no prior user gesture).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Keep Electron on TCP/TLS for the app APIs. Caddy advertises HTTP/3, and Chromium
// can emit noisy SSL socket errors while probing QUIC even when HTTPS/WSS is healthy.
app.commandLine.appendSwitch('disable-quic');
// P2P latency: Chromium hides local IPs behind mDNS (.local) host candidates, which
// libdatachannel (the host peer) can't resolve — so same-LAN sessions fail to go direct
// and fall back to the TURN relay (London), adding ~300ms. Emit real local IPs so two
// machines on the same network connect directly. (Cross-network still uses STUN/TURN.)
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');

// Robust Native Capture Loading
let capture: any;
try {
  capture = require('@remotelink/native-capture');
} catch (e) {
  try {
    // Fallback for some monorepo/development environments
    capture = require('../../../../packages/native-capture/build/Release/capture.node');
  } catch (e2) {
    console.error('[Host] Failed to load native-capture module:', e2);
  }
}

// @ts-ignore: Module types
declare module '@remotelink/native-capture' {
  export function captureFrame(outputIndex?: number): { width: number; height: number; data: Buffer };
}

const PROTOCOL = 'remote365';
// Legacy scheme kept registered so invite/deep links shared before the rebrand still open the app.
const LEGACY_PROTOCOLS = ['remotelink'];
const ALL_PROTOCOLS = [PROTOCOL, ...LEGACY_PROTOCOLS];
const findDeepLinkArg = (args: any[]): string | undefined =>
  args.find((a: any) => typeof a === 'string' && ALL_PROTOCOLS.some((scheme) => a.startsWith(`${scheme}://`)));
let AUTH_STORE_PATH: string;

// --- State Management ---
let mainWindow: BrowserWindow | null = null;
let hostSignalingWs: WebSocket | null = null;
const viewerWindows = new Map<string, BrowserWindow>();
const viewerTabs = new Map<string, { view: BrowserView; sessionId: string; title: string; serverIP: string; token: string; deviceType: string }>();
const viewerSignalingSockets = new Map<string, WebSocket>();
const meetingWindows = new Map<string, BrowserWindow>();
const sessionWaitWindows = new Map<string, BrowserWindow>();
let viewerShellWindow: BrowserWindow | null = null;
let activeViewerTabId = '';
let hostDockWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let shownTrayHint = false;

let peerConnection: any = null;
let dataChannel: any = null;
let inputDataChannel: any = null;
let criticalInputDataChannel: any = null;
let videoTrack: any = null;
let videoRtpConfig: any = null;
let currentRtpTimestamp = 0;
let rtpStartTime = 0; // wall-clock ms when streaming started
let activeStreamFps = 30; // fps of the current encode — drives RTP frame cadence
let currentViewerId: string | null = null;
let ffmpegProcess: ChildProcess | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let cursorInterval: NodeJS.Timeout | null = null;
let hostHeartbeatInterval: NodeJS.Timeout | null = null;
let hostSignalingWatchdog: NodeJS.Timeout | null = null;
let lastSignalingActivityAt = 0;
let hostReconnectAttempts = 0;
let isHostGuestMode = false;
// Options → "Minimize App When A Session Starts"; the renderer pushes it at
// boot and on change (lib/hostPreferences).
let hostAutoMinimizeEnabled = true;
// Pre-logon mode: launched by Remote365InputSvc as SYSTEM while the machine sits
// at the Windows sign-in screen, so the device is reachable after a reboot with
// nobody signed in. No window, no tray, no updater — it registers with the
// machine credential (see unattendedHost.ts) and streams the sign-in screen
// through the service's secure-desktop capture. The service kills it the moment
// a user logs on, handing over to that user's normal instance.
const isPreLogonHost = process.argv.includes('--prelogon');
// The host secret replaces the user token while running unattended. The normal
// user-session host loads it too, as a fallback: the signaling server rejects a
// token-less registration for an OWNED device, so a machine whose refresh token
// finally expired (or whose user signed out) could never come back online even
// though a perfectly valid machine credential was sitting on disk.
let activeHostSecret = '';
/** Device the loaded credential belongs to, so a re-registered device drops it. */
let activeHostSecretKey = '';
// Consecutive credential rejections. One is usually just a stale access token
// (24h TTL) that a refresh fixes. Beyond that the app ALTERNATES between the
// user token and the machine credential — committing to either one forever
// would keep the device offline whenever that particular credential is the dead
// one, and there may be nobody at the machine to notice.
let hostTokenRejections = 0;
let isReconnectScheduled = false;
let isManualHostStop = false;
let iceCandidatesQueue: any[] = [];
let hasRemoteDescription = false;
let fileTransfers = new Map<string, {
  stream: ReturnType<typeof createWriteStream>;
  receivedIndices: Set<number>;
  received: number;
  total: number;
  name: string;
  filePath: string;
  totalSize?: number;
  transferredBytes: number;
  lastProgressAt: number;
  inactivityTimer: NodeJS.Timeout;
}>();

// Keep the machine (and its display) awake while a remote session is active in
// either direction: a sleeping host display stalls DXGI capture, and a viewer
// watching passively shouldn't have their screen blank mid-session. Synced by a
// cheap 5s poll so every connect/teardown path is covered without instrumenting
// each one.
let sessionPowerBlockerId: number | null = null;
function syncSessionPowerBlocker() {
  const active = viewerSignalingSockets.size > 0 || hostViewerPeers.size > 0;
  const held = sessionPowerBlockerId !== null && powerSaveBlocker.isStarted(sessionPowerBlockerId);
  if (active && !held) {
    sessionPowerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  } else if (!active && held) {
    powerSaveBlocker.stop(sessionPowerBlockerId!);
    sessionPowerBlockerId = null;
  }
}
setInterval(syncSessionPowerBlocker, 5000);

let lastClipboardText = '';
let clipboardInterval: NodeJS.Timeout | null = null;
let selectedDisplayId: number | null = null; // null means primary display
let currentHostSessionId = '';
let lastViewerJoinTime = 0;
let totalBytesSent = 0;
let statsInterval: NodeJS.Timeout | null = null;
let firstFrameSent = false;
let frameCount = 0;
let droppedEncodedFrames = 0;
let skippedCursorFrames = 0;
let lastLogTime = 0;
let activeHostToken = '';
let activeHostAccessKey = '';
let encoderDetectionPromise: Promise<void> | null = null;
let lastViewerJoinId = '';
let lastLogBytes = 0;
let lastSignalingPingLogTime = 0;
let pingInterval: NodeJS.Timeout | null = null;
let initPollInterval: NodeJS.Timeout | null = null;
let controlGranted = false;
let pendingControlViewerId: string | null = null;

// --- Two-stage control (view-only until the host consents) ---
// Sessions used to open with full mouse and keyboard the instant the control
// channel opened, which made the existing gate in handleControlMessage — and
// the whole request-control / ControlRequestModal path — unreachable. Under the
// AnyDesk-style model a viewer starts able to SEE only, and input stays dead
// until the person at the host allows it.
//
// Off by default: unset, every session opens in control exactly as before.
// Turning it on before the unattended claim is plumbed through makes EVERY
// session start view-only, including unattended ones — so the rollout order is
// backfill the device flag, ship the claim, then enable this.
const REQUIRE_CONTROL_CONSENT = process.env.CONNECT_X_REQUIRE_CONTROL_CONSENT === '1';

// Per-viewer "this device may be driven with nobody sitting at it", relayed
// from the access token by signaling's viewer-joined. Keyed by viewerId
// alongside hostViewerNames/hostViewerDeviceIds and cleared with them.
//
// Absence means attended. A viewer with no entry — LAN direct, a pre-Phase-3
// signaling service, a join that never carried the claim — starts view-only and
// has to ask, which is the safe direction to fail.
const hostViewerUnattended = new Map<string, boolean>();

// Viewers exempt from the two-stage flow because of what they are, not how the
// device is configured: phones and tablets. Connecting from a phone is already a
// deliberate, hands-on action, and a touch UI has nowhere comfortable to put a
// view-only mode. Desktop and laptop viewers still have to ask.
const hostViewerSkipsConsent = new Set<string>();

/** Does a freshly opened control channel start with input enabled? */
function grantsControlOnConnect(viewerId?: string | null) {
  if (!REQUIRE_CONTROL_CONSENT) return true;
  const id = String(viewerId || '');
  if (hostViewerSkipsConsent.has(id)) return true;
  return hostViewerUnattended.get(id) === true;
}

// --- Remote audio: the host machine's speakers, heard by the viewer ---------
// Capture happens in the renderer via getDisplayMedia loopback — the same
// driver-free Chromium path the meeting screen-share already uses (see
// setDisplayMediaRequestHandler) — and is encoded to Opus with WebCodecs there.
// Main owns only the RTP side, so audio rides the same peer connection as video.
//
// Opus is one frame per RTP packet: no fragmentation, so none of H.264's
// pacing/NACK/drop-to-IDR machinery applies.
const OPUS_PAYLOAD_TYPE = 111;
const OPUS_CLOCK_RATE = 48000;
// The person at the host can silence sharing from the dock without ending the
// session — the audio equivalent of the "Stop control" button.
let hostAudioMuted = false;
// Viewers that currently have "listen" switched on. Drives the dock indicator,
// so the host can see when someone can actually hear the machine.
const hostAudioListeners = new Set<string>();

// Who is recording this session, per viewer. The HOST is the authority: it
// notifies the person at the machine, rebroadcasts to every other viewer, and
// replays the state to late joiners — so nobody can be recorded unaware.
const hostSessionRecorders = new Map<string, string>();

function announceSessionRecording(on: boolean, byName: string, exceptViewerId?: string | null) {
  const payload = { type: 'recording-state', on, byName };
  for (const peer of hostViewerPeers.values()) {
    if (exceptViewerId && peer.viewerId === exceptViewerId) continue;
    if (peer.dataChannel?.isOpen?.()) {
      try { peer.dataChannel.sendMessage(JSON.stringify(payload)); } catch { /* closing */ }
    }
  }
  // The person AT the machine must know too. The main window is minimized for
  // the whole session, so the unmissable surface is the top-center notice.
  mainWindow?.webContents.send('host:recording-state', { on, byName });
  sendHostDockStatus(on ? `${byName} is recording this session` : `${byName} stopped recording`);
  showHostRecordingNotice(byName, on);
}

function updateHostAudioDock() {
  if (!hostDockWindow || hostDockWindow.isDestroyed()) return;
  hostDockWindow.webContents.send('host-dock:audio-state', {
    listening: hostAudioListeners.size > 0,
    muted: hostAudioMuted,
  });
}

/**
 * Push one encoded Opus frame to every connected viewer.
 *
 * `samples` is the frame's duration in 48kHz samples (960 for the standard 20ms
 * frame); the RTP clock advances by exactly that, so the viewer's jitter buffer
 * gets a monotonic timeline even when capture hiccups.
 */
function broadcastHostAudio(frame: Buffer, samples: number) {
  if (hostAudioMuted || frame.length === 0) return;
  for (const peer of hostViewerPeers.values()) {
    if (peer.mediaPaused || !peer.audioTrack || !peer.audioRtpConfig) continue;
    try {
      if (typeof peer.audioTrack.isOpen === 'function' && !peer.audioTrack.isOpen()) continue;
      peer.audioRtpConfig.timestamp = (peer.audioRtpConfig.timestamp + samples) >>> 0;
      peer.audioTrack.sendMessageBinary(frame, peer.audioRtpConfig);
    } catch {
      // A track can close between the check and the send during teardown.
    }
  }
}

/** Ask the renderer to start or stop loopback capture. */
function setHostAudioCapture(active: boolean, reason: string, preserveListeners = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  log.info(`[Host] Remote audio capture ${active ? 'ON' : 'OFF'} (${reason}).`);
  mainWindow.webContents.send('host:audio-capture', { active });
  if (!active && !preserveListeners) {
    hostAudioListeners.clear();
    updateHostAudioDock();
  }
}
// Connecting viewer's account display name per viewerId (from signaling
// viewer-request/viewer-joined) — shown in the approval modal and host dock.
const hostViewerNames = new Map<string, string>();
// The viewer machine's OWN Remote 365 id (self-reported in the join) — the
// bracket value on the dock row: "test cloud (198023658)" is the PC test cloud
// is sitting at, NOT this host's id.
const hostViewerDeviceIds = new Map<string, string>();

// Rows for the dock's session list: one per DISTINCT connected account (the
// same account from two places shows once), labeled with the REMOTE machine's
// id when it reported one. Viewers with no resolvable name collapse into one
// "Remote viewer" row (with a count when there are several).
function collectDockViewerNames(): string[] {
  const byName = new Map<string, string>(); // account name -> remote device id ('' if unknown)
  let unnamed = 0;
  for (const id of hostViewerPeers.keys()) {
    const name = (hostViewerNames.get(id) || '').trim();
    const deviceId = (hostViewerDeviceIds.get(id) || '').trim();
    if (name) {
      if (!byName.has(name) || (!byName.get(name) && deviceId)) byName.set(name, deviceId);
    } else {
      unnamed++;
    }
  }
  const rows = Array.from(byName.entries()).map(([name, deviceId]) => deviceId ? `${name} (${deviceId})` : name);
  if (unnamed > 0) rows.push(unnamed > 1 ? `Remote Viewer (${unnamed})` : 'Remote Viewer');
  return rows;
}
let hostStreamSettings = {
  quality: 'ultra',
  fps: '30',
  deviceName: '',
};

type HostViewerPeer = {
  viewerId: string;
  peerConnection: any;
  dataChannel: any;
  inputDataChannel: any;
  criticalInputDataChannel: any;
  fileDataChannel: any;
  videoTrack: any;
  videoRtpConfig: any;
  audioTrack: any;
  audioRtpConfig: any;
  iceCandidatesQueue: any[];
  hasRemoteDescription: boolean;
  clipboardInterval: NodeJS.Timeout | null;
  pingInterval: NodeJS.Timeout | null;
  controlGranted: boolean;
  pendingControlViewerId: string | null;
  currentRtpTimestamp: number;
  rtpStartTime: number;
  lastFrameSentAt: number;
  firstFrameSent: boolean;
  frameCount: number;
  droppedEncodedFrames: number;
  totalBytesSent: number;
  lastLogBytes: number;
  lastLogTime: number;
  sessionStartedAt: number;
  offerSentAt: number;
  connectedAt: number;
  // Set when a frame had to be dropped (congestion/send failure): a dropped
  // delta frame desyncs the decoder, so keep dropping until the next IDR —
  // a brief freeze instead of up to a GOP (0.5s) of macroblock corruption.
  waitingForIdr: boolean;
  mediaPaused?: boolean;
};

const hostViewerPeers = new Map<string, HostViewerPeer>();

function getPrimaryHostPeer() {
  return hostViewerPeers.values().next().value || null;
}

function syncLegacyPeerAliases(peer: HostViewerPeer | null = getPrimaryHostPeer()) {
  peerConnection = peer?.peerConnection || null;
  dataChannel = peer?.dataChannel || null;
  inputDataChannel = peer?.inputDataChannel || null;
  criticalInputDataChannel = peer?.criticalInputDataChannel || null;
  videoTrack = peer?.videoTrack || null;
  videoRtpConfig = peer?.videoRtpConfig || null;
  currentViewerId = peer?.viewerId || null;
  iceCandidatesQueue = peer?.iceCandidatesQueue || [];
  hasRemoteDescription = Boolean(peer?.hasRemoteDescription);
  clipboardInterval = peer?.clipboardInterval || null;
  pingInterval = peer?.pingInterval || null;
  controlGranted = Boolean(peer?.controlGranted);
  pendingControlViewerId = peer?.pendingControlViewerId || null;
}

function getHostPeerControlChannel(viewerId?: string | null) {
  const peer = viewerId ? hostViewerPeers.get(viewerId) : getPrimaryHostPeer();
  return peer?.dataChannel || dataChannel;
}

function sendToHostViewer(viewerId: string | null | undefined, payload: any) {
  const channel = getHostPeerControlChannel(viewerId);
  if (!channel || !channel.isOpen?.()) return false;
  channel.sendMessage(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return true;
}

function broadcastToHostViewers(payload: any, exceptViewerId?: string | null) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const peer of hostViewerPeers.values()) {
    if (exceptViewerId && peer.viewerId === exceptViewerId) continue;
    try {
      if (peer.dataChannel?.isOpen?.()) peer.dataChannel.sendMessage(serialized);
    } catch (err: any) {
      log.warn(`[Host] Failed to send message to viewer ${peer.viewerId}: ${err?.message || err}`);
    }
  }
}

// ---- Clipboard sync, both directions ----
// Host → viewer: short text goes as the single `clipboard` message every
// viewer (desktop, web, mobile) already understands. Longer text is split into
// `clipboard-chunk` frames that the desktop viewer reassembles — one oversized
// SCTP message is silently dropped by the data channel. origin:'host' lets the
// viewer tell it apart from its own echo (it ignores origin 'desktop').
const CLIPBOARD_CHUNK_CHARS = 32 * 1024;
function sendClipboardToViewers(text: string) {
  const value = String(text ?? '');
  if (value.length <= CLIPBOARD_CHUNK_CHARS) {
    broadcastToHostViewers({ type: 'clipboard', origin: 'host', text: value });
    return;
  }
  const id = `host-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const totalChunks = Math.ceil(value.length / CLIPBOARD_CHUNK_CHARS);
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    broadcastToHostViewers({
      type: 'clipboard-chunk',
      id,
      origin: 'host',
      chunkIndex,
      totalChunks,
      text: value.slice(chunkIndex * CLIPBOARD_CHUNK_CHARS, (chunkIndex + 1) * CLIPBOARD_CHUNK_CHARS),
    });
  }
}

// Viewer → host: the desktop viewer's automatic sync sends `clipboard-sync`
// (and `clipboard-chunk` above 32 KB); Ctrl+V on the desktop viewer and the
// web viewer send the older `clipboard`. Until Sep 2026 the host only handled
// `clipboard`, so anything copied on the viewer never reached the remote
// clipboard unless the viewer pressed Ctrl+V — right-click → Paste on the host
// pasted stale text. All three now land here.
const hostClipboardChunks = new Map<string, { chunks: string[]; received: number; total: number; startedAt: number }>();
function applyViewerClipboardText(text: unknown) {
  if (typeof text !== 'string' || !text || text === lastClipboardText) return;
  lastClipboardText = text;
  clipboard.writeText(text);
  log.info(`[Host] Clipboard updated from viewer (${text.length} chars).`);
}
function handleViewerClipboardChunk(event: any) {
  const id = String(event?.id || '');
  const total = Number(event?.totalChunks || 0);
  const chunkIndex = Number(event?.chunkIndex);
  if (!id || !Number.isFinite(total) || total <= 0 || total > 4096) return;
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0 || chunkIndex >= total) return;
  let transfer = hostClipboardChunks.get(id);
  if (!transfer) {
    // Forget transfers a vanished viewer never finished.
    const now = Date.now();
    for (const [key, value] of hostClipboardChunks) {
      if (now - value.startedAt > 60_000) hostClipboardChunks.delete(key);
    }
    transfer = { chunks: new Array(total).fill(''), received: 0, total, startedAt: now };
    hostClipboardChunks.set(id, transfer);
  }
  if (!transfer.chunks[chunkIndex]) {
    transfer.chunks[chunkIndex] = String(event?.text ?? '');
    transfer.received += 1;
  }
  if (transfer.received === transfer.total) {
    hostClipboardChunks.delete(id);
    applyViewerClipboardText(transfer.chunks.join(''));
  }
}

// Window must be tall enough for: top block (102) + session head (34) + session
// row (44 each) + Disconnect button (48) + footer (30) + borders. The old 210px
// window CLIPPED the Disconnect button whenever the session list was expanded.
// Additional connected viewers add rows, so the height scales with the count.
// Sized to the content rather than a round number: header 60 + session head 34
// + one viewer row 44 + status 46 + six labelled actions ~264 + disconnect 50 +
// footer 30. getHostDockBounds adds a row's height per EXTRA viewer, so the
// base only has to fit one. The old 266px dock could only fit 14px icon-only
// buttons nobody could identify; every control now carries a written label and
// a one-line explanation, and that needs the room.
// Three sizes: the mascot alone (tucked away), the compact card with the
// mascot under it, or card + the detailed panel. The card and panel widths
// include the shadow margin the transparent window needs.
type HostDockMode = 'mascot' | 'card' | 'full';
const HOST_DOCK_SIZES: Record<HostDockMode, { width: number; height: number }> = {
  mascot: { width: 136, height: 150 },
  card: { width: 380, height: 240 },
  full: { width: 380, height: 740 },
};
const HOST_DOCK_ROW_HEIGHT = 44;
let hostDockRowCount = 1;
// The mode the dock page is showing; the page reports it over host-dock:toggle.
let hostDockMode: HostDockMode = 'card';
const resolveHostDockMode = (mode: HostDockMode | boolean | undefined): HostDockMode =>
  typeof mode === 'boolean' ? (mode ? 'card' : 'mascot') : (mode || 'card');

function getAppLogoPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'logo.png')
    : join(__dirname, '../../src/logo.png');
}

function getAppLogoDataUrl() {
  try {
    const logo = readFileSync(getAppLogoPath());
    return `data:image/png;base64,${logo.toString('base64')}`;
  } catch (error: any) {
    log.warn('[HostDock] Failed to load dock logo:', error?.message || error);
    return '';
  }
}

function getHostDockBounds(mode: HostDockMode | boolean = 'card') {
  const resolved = resolveHostDockMode(mode);
  const extraRows = Math.max(0, hostDockRowCount - 1);
  const base = HOST_DOCK_SIZES[resolved];
  const height = base.height + (resolved === 'full' ? extraRows * HOST_DOCK_ROW_HEIGHT : 0);
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
  const area = display.workArea;
  // Anchored to the bottom-right corner so the mascot stays put while the
  // card and panel grow upwards from it.
  return {
    width: base.width,
    height,
    x: area.x + area.width - base.width,
    y: area.y + area.height - height - 8,
  };
}

function positionHostDock(mode: HostDockMode | boolean = 'card') {
  if (!hostDockWindow || hostDockWindow.isDestroyed()) return;
  hostDockWindow.setBounds(getHostDockBounds(mode), true);
}

/**
 * Bring the dashboard back when a session genuinely ends.
 *
 * Restoring used to happen the instant `hostViewerPeers.size` hit 0 after a
 * cleanup. During the approval path a stale peer is often torn down while the
 * replacement is still mid-negotiation and not yet in the map, so the map is
 * briefly empty — the window was raised and then stayed in front for the whole
 * session, and the viewer streamed a full-screen white app instead of the
 * desktop. Re-check after a beat so a session that is still coming up wins.
 */
function restoreHostWindowIfSessionOver(reason: string) {
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (hostViewerPeers.size > 0 || isRemoteSessionActive()) {
      log.info(`[Host] Skipping window restore (${reason}): a session is still active.`);
      return;
    }
    log.info(`[Host] Restoring host window after session close (${reason}).`);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }, 1500);
}

function showMainWindowFromDock() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function sendHostDockStatus(message: string) {
  if (!hostDockWindow || hostDockWindow.isDestroyed()) return;
  hostDockWindow.webContents.send('host-dock:status', message);
}

/**
 * Swap the dock between "Allow control" and "Stop control", and put the host
 * window's lock overlay in step.
 *
 * The overlay used to be raised the moment a viewer connected, so a view-only
 * session covered the host's own app with "<name> is controlling this computer"
 * while they were merely being watched. It exists to stop the host fighting the
 * remote user for the mouse, which only applies once control is actually
 * granted.
 */
function sendHostDockControlState(granted: boolean) {
  const primary = getPrimaryHostPeer();
  const viewerName = (primary ? hostViewerNames.get(primary.viewerId) : '') || '';
  setWebLockState(granted, viewerName);
  mainWindow?.webContents.send('host:remote-control', {
    active: granted,
    viewerName,
  });
  if (!hostDockWindow || hostDockWindow.isDestroyed()) return;
  hostDockWindow.webContents.send('host-dock:control-state', granted);
}

function approveCurrentControlFromDock() {
  const peer = getPrimaryHostPeer();
  if (peer) {
    peer.controlGranted = true;
    peer.pendingControlViewerId = null;
    syncLegacyPeerAliases(peer);
  }
  controlGranted = true;
  pendingControlViewerId = null;
  const targetChannel = peer?.dataChannel || dataChannel;
  if (targetChannel && targetChannel.isOpen()) {
    targetChannel.sendMessage(JSON.stringify({ type: 'control-granted' }));
    sendHostDockStatus('Control enabled');
    sendHostDockControlState(true);
    return true;
  }
  sendHostDockStatus('No active control channel');
  return false;
}

/**
 * Hand control back — the session stays up and the viewer keeps seeing the
 * screen, but their mouse and keyboard go dead until they ask again.
 *
 * Granting is deliberately narrow (the primary peer) while revoking is broad:
 * if the host hits Stop, every connected viewer's input must die, not just
 * whichever one happens to sit first in the map.
 */
function revokeControlFromDock() {
  hideHostConsentWindow();
  let notified = false;
  for (const peer of hostViewerPeers.values()) {
    peer.controlGranted = false;
    peer.pendingControlViewerId = null;
    if (peer.dataChannel?.isOpen?.()) {
      peer.dataChannel.sendMessage(JSON.stringify({ type: 'control-denied' }));
      notified = true;
    }
  }
  syncLegacyPeerAliases();
  controlGranted = false;
  pendingControlViewerId = null;
  // LAN/legacy sessions can hold a channel without a map entry.
  if (!notified && dataChannel?.isOpen?.()) {
    dataChannel.sendMessage(JSON.stringify({ type: 'control-denied' }));
    notified = true;
  }
  sendHostDockControlState(false);
  sendHostDockStatus(notified ? 'Control stopped — viewer can only watch' : 'No active control channel');
  return notified;
}

function copyHostDockSessionId() {
  const id = String(currentHostSessionId || activeHostAccessKey || '').replace(/\s+/g, '');
  if (!id) {
    sendHostDockStatus('No session ID yet');
    return false;
  }
  clipboard.writeText(id);
  sendHostDockStatus('Session ID copied');
  return true;
}

function hostDockHtml(sessionName: string, sessionId: string, viewerNames: string[] = []) {
  const esc = (value: string) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // One row per DISTINCT connected account (collectDockViewerNames dedupes the
  // same user connected twice). Labels arrive pre-built as
  // "account name (REMOTE machine's id)" — the bracket is the CONNECTING PC's
  // Remote 365 id, never this host's own id (showing the host's id here read
  // as "nothing about who's connecting").
  const names = (viewerNames || []).map((n) => esc(String(n || '').trim())).filter(Boolean);
  if (names.length === 0) names.push('Remote Viewer');
  const rowLabel = names[0];
  const optionsLabel = names.join(', ');
  const cardTitle = names.length > 1 ? `${rowLabel} +${names.length - 1}` : rowLabel;
  // Inline script payloads: the closing-tag guard keeps a "</script" inside the
  // player or the animation from ending the <script> block early.
  const inlineJs = (source: string) => source.replace(/<\/script/gi, '<\\/script');
  const robotAnimation = Object.values(dockRobotAnimations)[0];
  const robotJson = robotAnimation ? inlineJs(JSON.stringify(robotAnimation)) : 'null';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; font-family: "Mona Sans", "Segoe UI", system-ui, sans-serif; color: #F5F5F7; user-select: none; }
    body { display: flex; align-items: flex-end; justify-content: flex-end; padding: 18px 12px 10px; }
    .stage { display: flex; flex-direction: column; align-items: flex-end; }

    /* The compact card: who is connected and what they can do, plus the few
       actions a host reaches for while someone is on the machine. */
    .card-wrap { position: relative; width: 344px; }
    .x { position: absolute; top: -8px; left: -8px; z-index: 3; width: 22px; height: 22px; border: 0; border-radius: 999px; background: #3A3A41; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.45); }
    .x:hover { background: #4A4A52; }
    .card { border-radius: 16px; background: #1C1C1F; box-shadow: 0 14px 34px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.07); overflow: hidden; display: flex; flex-direction: column; }
    .card-main { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 18px; }
    .card-text { min-width: 0; flex: 1; }
    /* Long labels ("name (remote id)", "X Is Asking To Control This PC") scroll
       back and forth instead of being cut off with an ellipsis. */
    .marquee { overflow: hidden; white-space: nowrap; }
    .marquee .marquee-track { display: inline-block; white-space: nowrap; will-change: transform; }
    .marquee.scrolls .marquee-track { animation: r365marquee var(--marquee-duration, 8s) ease-in-out infinite; }
    @keyframes r365marquee { 0%, 14% { transform: translateX(0); } 50%, 64% { transform: translateX(var(--marquee-shift, 0px)); } 100% { transform: translateX(0); } }
    .title { font-size: 14px; line-height: 20px; font-weight: 700; }
    .subtitle { margin-top: 2px; font-size: 12px; line-height: 16px; color: rgba(255,255,255,0.62); }
    .subtitle.on { color: #FFB347; }
    .card-actions { display: flex; align-items: center; gap: 8px; flex: none; }
    .rbtn { width: 34px; height: 34px; border: 0; border-radius: 999px; background: #2C2C31; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: background .12s ease, transform .12s ease; }
    .rbtn:hover { background: #3A3A41; transform: translateY(-1px); }
    .rbtn.accent { background: #FF8A00; color: #111315; }
    .rbtn.accent:hover { background: #FF9D2B; }
    .rbtn.danger { background: #3A2628; color: #FF6B6B; }
    .rbtn.danger:hover { background: #4A2E31; }
    .rbtn svg { transition: transform .16s ease; }
    body.mode-full #more svg { transform: rotate(180deg); }
    @keyframes r365ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,138,0,0.6); } 50% { box-shadow: 0 0 0 9px rgba(255,138,0,0); } }
    .rbtn.pending { animation: r365ring 1.2s ease-in-out infinite; }
    .askbar { display: none; padding: 8px 18px; background: #FF8A00; color: #111315; font-size: 12px; line-height: 16px; font-weight: 600; }
    body.control-pending .askbar { display: block; }

    /* The detailed panel: every control written out. Opens under the card. */
    .panel { display: none; flex-direction: column; border-top: 1px solid rgba(255,255,255,0.08); background: #1C1C1F; }
    body.mode-full .panel { display: flex; }
    .status { padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
    .status-row { display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 15px; }
    .status-row .dot { width: 7px; height: 7px; border-radius: 999px; flex: none; background: #6B7280; }
    .status-row.on .dot { background: #22C55E; }
    .status-row.warn .dot { background: #FF8A00; }
    .status-row .k { color: rgba(255,255,255,0.55); }
    .status-row .v { font-weight: 600; }
    .actions { border-top: 1px solid rgba(255,255,255,0.08); }
    .act { width: 100%; padding: 8px 12px; border: 0; border-bottom: 1px solid rgba(255,255,255,0.06); background: transparent; display: flex; align-items: flex-start; gap: 10px; text-align: left; cursor: pointer; font: inherit; color: #F5F5F7; }
    .act:hover { background: rgba(255,255,255,0.06); }
    .act .ico { width: 16px; height: 16px; flex: none; margin-top: 1px; display: flex; align-items: center; justify-content: center; color: #FF8A00; }
    .act .txt { min-width: 0; display: block; }
    .act .lbl { display: block; font-size: 12px; line-height: 16px; font-weight: 600; }
    .act .sub { display: block; margin-top: 1px; font-size: 10px; line-height: 13px; color: rgba(255,255,255,0.55); }
    .act.pending { background: rgba(255,138,0,0.14); box-shadow: inset 3px 0 0 #FF8A00; }
    .act.pending .lbl::after { content: ' (waiting for you)'; font-weight: 500; color: #FFB347; }
    .sessions { border-top: 1px solid rgba(255,255,255,0.08); background: #232327; }
    .session-head { height: 34px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; }
    .session-title { border: 0; background: transparent; padding: 0; display: flex; align-items: center; gap: 8px; min-width: 0; font: inherit; font-size: 12px; line-height: 17px; font-weight: 500; color: #F5F5F7; cursor: pointer; }
    .session-title svg { transition: transform .16s ease; }
    body.list-closed .session-title svg { transform: rotate(-90deg); }
    .session-row { height: 44px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    body.list-closed .session-row { display: none; }
    .who { min-width: 0; display: flex; align-items: center; gap: 8px; }
    .avatar { width: 28px; height: 28px; border-radius: 999px; background: #FF8A00; color: #111315; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex: none; }
    .name { min-width: 0; max-width: 250px; font-size: 12.5px; line-height: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .settings-btn { width: 16px; height: 16px; border: 0; background: transparent; color: #F5F5F7; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; }
    .settings-btn:hover { color: #FF8A00; }
    .end { display: flex; align-items: center; justify-content: center; gap: 7px; width: calc(100% - 24px); margin: 8px 12px; height: 36px; border: 0; border-radius: 10px; background: #E81123; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(232,17,35,0.35); flex: none; }
    .end:hover { background: #F5222D; }
    .footer { height: 28px; padding: 0 12px 6px; display: flex; align-items: center; justify-content: flex-end; font-size: 10px; line-height: 14px; color: rgba(255,255,255,0.45); }
    .toast { position: absolute; left: 0; right: 0; top: -32px; height: 24px; padding: 5px 10px; border-radius: 8px; background: rgba(255,255,255,0.92); color: #111315; font-size: 10.5px; line-height: 14px; font-weight: 600; opacity: 0; transform: translateY(4px); transition: opacity .14s ease, transform .14s ease; pointer-events: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; z-index: 4; }
    .toast.show { opacity: 1; transform: translateY(0); }
    .modal-backdrop { position: absolute; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center; padding: 8px; background: rgba(0,0,0,0.45); }
    body.options-open .modal-backdrop { display: flex; }
    .options-modal { width: 100%; max-height: 100%; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; background: #232327; box-shadow: 0 18px 34px rgba(0,0,0,0.4); overflow: hidden; }
    .options-head { height: 36px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .options-head strong { font-size: 12px; line-height: 17px; font-weight: 600; }
    .options-close { width: 22px; height: 22px; border: 0; background: transparent; color: #F5F5F7; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .options-body { padding: 10px 12px; }
    .options-meta { margin-bottom: 8px; padding: 7px 8px; border-radius: 8px; background: rgba(255,255,255,0.06); }
    .options-meta span { display: block; font-size: 9px; line-height: 12px; color: rgba(255,255,255,0.55); }
    .options-meta strong { display: block; margin-top: 1px; font-size: 10px; line-height: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .option-action { height: 34px; border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; background: transparent; color: #F5F5F7; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 10.5px; line-height: 14px; cursor: pointer; }
    .option-action:hover { border-color: #FF8A00; background: rgba(255,138,0,0.12); }
    .option-action.primary { border-color: #FF8A00; background: #FF8A00; color: #111315; }
    .option-action.danger { color: #FF6B6B; }

    /* The mascot. Alone when the dock is tucked away; clicking it brings the
       card back. A dropped-in Lottie plays here, the built-in robot otherwise. */
    .mascot { width: 96px; height: 120px; margin-top: -6px; margin-right: 4px; border: 0; background: transparent; padding: 0; cursor: pointer; flex: none; filter: drop-shadow(0 10px 18px rgba(0,0,0,0.4)); }
    .mascot:hover { filter: drop-shadow(0 10px 18px rgba(0,0,0,0.4)) brightness(1.08); }
    #robot, #robotFallback { width: 96px; height: 120px; }
    #robot svg, #robotFallback svg { width: 100%; height: 100%; display: block; }
    @keyframes r365bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    #robotFallback { animation: r365bob 2.6s ease-in-out infinite; }
    /* "Hide Robot": the mascot gives way to a small orange handle so the dock
       can still be brought back; the card and panel are unaffected. */
    .mascot-handle { display: none; width: 44px; height: 44px; border-radius: 999px; background: linear-gradient(135deg, #FF8A00, #FFB347); color: #111315; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(0,0,0,0.35); }
    body.robot-hidden #robot, body.robot-hidden #robotFallback { display: none !important; }
    body.robot-hidden .mascot { width: 44px; height: 44px; margin-top: 8px; margin-right: 6px; }
    body.robot-hidden .mascot-handle { display: flex; }
    .option-action.wide { grid-column: span 2; }
    body.mode-mascot .card-wrap { display: none; }
    body.mode-mascot .mascot { margin-top: 0; }
  </style>
</head>
<body class="mode-card">
  <div class="stage">
    <div class="card-wrap">
      <button class="x" id="close" title="Hide Dock" aria-label="Hide Dock">
        <svg width="10" height="10" viewBox="0 0 18 18"><path d="M4.5 4.5 13.5 13.5M13.5 4.5 4.5 13.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      </button>
      <div class="toast" id="toast"></div>
      <div class="card">
        <div class="card-main">
          <div class="card-text">
            <div class="title marquee" id="cardTitle" title="${optionsLabel}"><span class="marquee-track">${cardTitle}</span></div>
            <div class="subtitle marquee" id="cardSubtitle"><span class="marquee-track">Viewing Only</span></div>
          </div>
          <div class="card-actions">
            <button class="rbtn accent" id="quickControl" title="Allow Keyboard &amp; Mouse" aria-label="Allow Keyboard And Mouse">
              <svg id="quickControlAllow" width="14" height="14" viewBox="0 0 24 24"><path d="M4 3 20 12 4 21 8 13 4 3Z" fill="currentColor"/></svg>
              <svg id="quickControlStop" width="14" height="14" viewBox="0 0 24 24" style="display:none"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/></svg>
            </button>
            <button class="rbtn" id="quickChat" title="Message The Person Connected" aria-label="Message The Person Connected">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            </button>
            <button class="rbtn danger" id="quickEnd" title="Disconnect The Remote Session" aria-label="Disconnect The Remote Session">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
            </button>
            <button class="rbtn" id="more" title="More Options" aria-label="More Options">
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div class="askbar" id="askBar">Someone is asking to control this PC.</div>

        <div class="panel" id="panel">
          <!-- Plain-language state: what the remote person can do at this moment. -->
          <div class="status">
            <div class="status-row" id="controlStatusRow">
              <span class="dot"></span><span class="k">Control</span><span class="v" id="controlStatusText">They can only watch</span>
            </div>
            <div class="status-row" id="audioStatusRow">
              <span class="dot"></span><span class="k">Sound</span><span class="v" id="audioStatusText">Nobody is listening</span>
            </div>
          </div>

          <!-- Every action written out. -->
          <div class="actions">
            <button class="act" id="approveControl">
              <span class="ico"><svg width="14" height="14" viewBox="0 0 24 24"><path d="M4 3 20 12 4 21 8 13 4 3Z" fill="currentColor"/></svg></span>
              <span class="txt"><span class="lbl">Allow Keyboard &amp; Mouse</span><span class="sub">Let them click and type on this PC.</span></span>
            </button>
            <button class="act" id="revokeControl" style="display:none">
              <span class="ico"><svg width="14" height="14" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/></svg></span>
              <span class="txt"><span class="lbl">Stop Their Control</span><span class="sub">They keep seeing the screen but cannot click or type.</span></span>
            </button>
            <button class="act" id="audioToggle">
              <span class="ico">
                <svg id="audioOnIcon" width="14" height="14" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                <svg id="audioOffIcon" width="14" height="14" viewBox="0 0 24 24" style="display:none"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </span>
              <span class="txt"><span class="lbl" id="audioActionLabel">Mute This PC's Sound</span><span class="sub" id="audioActionSub">Stop sending what this PC is playing.</span></span>
            </button>
            <button class="act" id="chatAction">
              <span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>
              <span class="txt"><span class="lbl">Message The Person Connected</span><span class="sub">Opens a chat window.</span></span>
            </button>
            <button class="act" id="sendFileAction">
              <span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
              <span class="txt"><span class="lbl">Send Them A File</span><span class="sub">Pick a file from this PC to transfer.</span></span>
            </button>
            <button class="act" id="copySession">
              <span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="2"/></svg></span>
              <span class="txt"><span class="lbl">Copy This PC's ID</span><span class="sub">The number someone needs to connect here.</span></span>
            </button>
          </div>

          <div class="sessions">
            <div class="session-head">
              <button class="session-title" id="listToggle" title="Toggle Session List" aria-label="Toggle Session List">
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>Session List</span>
              </button>
              <button class="settings-btn" id="openOptions" title="Session Options" aria-label="Session Options">
                <svg width="13" height="13" viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>
            ${names.map((n, i) => `<div class="session-row">
              <div class="who"><span class="avatar">${(n || 'R').slice(0, 1).toUpperCase()}</span><span class="name" title="${i === 0 ? rowLabel : n}">${i === 0 ? rowLabel : n}</span></div>
            </div>`).join('')}
          </div>

          <button class="end" id="endSession" title="Disconnect The Remote Session" aria-label="Disconnect The Remote Session">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
            Disconnect Session
          </button>
          <div class="footer">Remote365 · ${esc(sessionName)}</div>
        </div>
      </div>
    </div>

    <button class="mascot" id="toggle" title="Show Or Hide The Dock" aria-label="Show Or Hide The Dock">
      <span class="mascot-handle" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></span>
      <div id="robot"></div>
      <div id="robotFallback">
        <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="r365g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A96FF"/><stop offset="1" stop-color="#2F5BD9"/></linearGradient>
          </defs>
          <path d="M48 7c-3.5 0-6 2.5-6 6v4" stroke="#8FB6FF" stroke-width="3" fill="none" stroke-linecap="round"/>
          <circle cx="42" cy="7" r="3.2" fill="#B9D2FF"/>
          <rect x="14" y="17" width="68" height="46" rx="17" fill="url(#r365g)"/>
          <rect x="24" y="26" width="48" height="27" rx="8" fill="#0F1B3A"/>
          <text x="48" y="45.5" text-anchor="middle" font-family="Consolas, 'Courier New', monospace" font-size="15" font-weight="700" fill="#7CF29A">&gt;_</text>
          <rect x="30" y="63" width="36" height="22" rx="8" fill="url(#r365g)"/>
          <rect x="8" y="65" width="18" height="10" rx="5" fill="#3E6FE0"/>
          <rect x="70" y="65" width="18" height="10" rx="5" fill="#3E6FE0"/>
          <rect x="34" y="85" width="10" height="7" rx="3" fill="#2F5BD9"/>
          <rect x="52" y="85" width="10" height="7" rx="3" fill="#2F5BD9"/>
        </svg>
      </div>
    </button>
  </div>

  <div class="modal-backdrop" id="optionsBackdrop">
    <div class="options-modal" role="dialog" aria-modal="true" aria-label="Session Options">
      <div class="options-head">
        <strong>Session Options</strong>
        <button class="options-close" id="closeOptions" title="Close Options" aria-label="Close Options">
          <svg width="16" height="16" viewBox="0 0 18 18"><path d="M4.5 4.5 13.5 13.5M13.5 4.5 4.5 13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="options-body">
        <div class="options-meta">
          <span>Active Remote Session</span>
          <strong>${optionsLabel}</strong>
        </div>
        <div class="options-grid">
          <button class="option-action primary" id="modalSendFile">Send File</button>
          <button class="option-action" id="modalControl">Control</button>
          <button class="option-action" id="modalCopy">Copy ID</button>
          <button class="option-action danger" id="modalHide">Hide Dock</button>
          <button class="option-action wide" id="modalRobot">Hide Robot</button>
        </div>
      </div>
    </div>
  </div>

  <script>${inlineJs(lottiePlayerSource)}</script>
  <script>
    const { ipcRenderer } = require('electron');
    const body = document.body;
    const toast = document.getElementById('toast');
    let toastTimer = null;
    const flash = (message) => {
      if (!message) return;
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
    };

    // Mascot: a dropped-in Lottie plays here; the built-in robot shows otherwise.
    const ROBOT_ANIMATION = ${robotJson};
    let robotAnim = null;
    (() => {
      const robot = document.getElementById('robot');
      const fallback = document.getElementById('robotFallback');
      if (ROBOT_ANIMATION && window.lottie && robot) {
        try {
          robotAnim = window.lottie.loadAnimation({ container: robot, renderer: 'svg', loop: true, autoplay: true, animationData: ROBOT_ANIMATION });
          if (fallback) fallback.style.display = 'none';
          return;
        } catch (err) { console.warn('[HostDock] Mascot animation failed, using the built-in robot', err); }
      }
      if (robot) robot.style.display = 'none';
    })();
    // "Hide Robot" is remembered across sessions; a hidden robot also stops
    // animating so it costs nothing while a session runs.
    const ROBOT_HIDDEN_KEY = 'r365DockRobotHidden';
    const modalRobotBtn = document.getElementById('modalRobot');
    const applyRobotHidden = (hidden) => {
      body.classList.toggle('robot-hidden', hidden);
      if (modalRobotBtn) modalRobotBtn.textContent = hidden ? 'Show Robot' : 'Hide Robot';
      try { if (robotAnim) { if (hidden) robotAnim.pause(); else robotAnim.play(); } } catch (err) { /* player gone */ }
    };
    let robotHidden = false;
    try { robotHidden = localStorage.getItem(ROBOT_HIDDEN_KEY) === '1'; } catch (err) { /* storage unavailable */ }
    applyRobotHidden(robotHidden);
    if (modalRobotBtn) modalRobotBtn.addEventListener('click', () => {
      robotHidden = !robotHidden;
      try { localStorage.setItem(ROBOT_HIDDEN_KEY, robotHidden ? '1' : '0'); } catch (err) { /* storage unavailable */ }
      applyRobotHidden(robotHidden);
      body.classList.remove('options-open');
    });

    // Labels wider than the card scroll back and forth; ones that fit stay put.
    const fitMarquees = () => {
      document.querySelectorAll('.marquee').forEach((box) => {
        const track = box.querySelector('.marquee-track');
        if (!track) return;
        const overflow = track.scrollWidth - box.clientWidth;
        if (overflow > 4) {
          box.style.setProperty('--marquee-shift', (-(overflow + 8)) + 'px');
          box.style.setProperty('--marquee-duration', Math.max(6, overflow / 18) + 's');
          box.classList.add('scrolls');
        } else {
          box.classList.remove('scrolls');
        }
      });
    };
    window.addEventListener('load', () => requestAnimationFrame(fitMarquees));
    window.addEventListener('resize', fitMarquees);
    // Three sizes: just the mascot (tucked away), the card, or card + detailed
    // panel. The main process resizes the window to match.
    let mode = 'card';
    const setMode = (next) => {
      mode = next;
      body.classList.remove('mode-mascot', 'mode-card', 'mode-full');
      body.classList.add('mode-' + mode);
      ipcRenderer.send('host-dock:toggle', mode);
      requestAnimationFrame(fitMarquees);
    };
    document.getElementById('toggle').addEventListener('click', () => setMode(mode === 'mascot' ? 'card' : 'mascot'));
    document.getElementById('more').addEventListener('click', () => setMode(mode === 'full' ? 'card' : 'full'));
    // If the window ever ends up smaller than the content (the main process
    // resized it for a different mode), ask for the size that fits this mode.
    // It used to leave just the bottom of the expanded panel showing.
    window.addEventListener('resize', () => {
      // Content squeezed out of a too-short window overflows UPWARDS (the stage is
      // bottom-anchored), which scrollHeight never reports; the stage's top edge does.
      const stage = document.querySelector('.stage');
      if (stage && stage.getBoundingClientRect().top < -2) ipcRenderer.send('host-dock:toggle', mode);
    });
    // Announce the session, then get out of the way: the dock shows the card
    // when a viewer connects and tucks itself behind the mascot after 3s —
    // unless the host user is interacting with it (hover/click cancels).
    let autoCollapseTimer = setTimeout(() => { if (mode === 'card') setMode('mascot'); }, 3000);
    const cancelAutoCollapse = () => {
      if (autoCollapseTimer) { clearTimeout(autoCollapseTimer); autoCollapseTimer = null; }
    };
    body.addEventListener('mouseenter', cancelAutoCollapse, { once: true });
    body.addEventListener('mousedown', cancelAutoCollapse, { once: true });
    // Hiding tucks the card behind the robot (or its handle) rather than
    // removing the dock: once closed there was no way to bring it back.
    document.getElementById('close').addEventListener('click', () => setMode('mascot'));
    document.getElementById('listToggle').addEventListener('click', () => body.classList.toggle('list-closed'));
    document.getElementById('openOptions').addEventListener('click', () => body.classList.add('options-open'));
    document.getElementById('closeOptions').addEventListener('click', () => body.classList.remove('options-open'));
    document.getElementById('optionsBackdrop').addEventListener('click', (event) => {
      if (event.target.id === 'optionsBackdrop') body.classList.remove('options-open');
    });

    // Control state drives the quick button, the two panel rows, the options
    // modal button and the card subtitle. The main process is the source of
    // truth and pushes every transition (granted on connect, allowed, denied,
    // revoked).
    let controlGranted = false;
    let pendingWho = '';
    let someoneListening = false;
    let audioMuted = false;
    const approveBtn = document.getElementById('approveControl');
    const revokeBtn = document.getElementById('revokeControl');
    const quickControl = document.getElementById('quickControl');
    const quickControlAllow = document.getElementById('quickControlAllow');
    const quickControlStop = document.getElementById('quickControlStop');
    const modalControlBtn = document.getElementById('modalControl');
    const controlStatusRow = document.getElementById('controlStatusRow');
    const controlStatusText = document.getElementById('controlStatusText');
    const cardSubtitle = document.getElementById('cardSubtitle');
    const renderSubtitle = () => {
      if (!cardSubtitle) return;
      let text = pendingWho
        ? pendingWho + ' Is Asking To Control This PC'
        : controlGranted ? 'Controlling This PC' : 'Viewing Only';
      if (!pendingWho && someoneListening && !audioMuted) text += ' · Hearing This PC';
      const track = cardSubtitle.querySelector('.marquee-track');
      if (track) track.textContent = text; else cardSubtitle.textContent = text;
      cardSubtitle.classList.toggle('on', Boolean(controlGranted || pendingWho));
      requestAnimationFrame(fitMarquees);
    };
    const renderControlState = () => {
      if (approveBtn) approveBtn.style.display = controlGranted ? 'none' : '';
      if (revokeBtn) revokeBtn.style.display = controlGranted ? '' : 'none';
      if (quickControlAllow) quickControlAllow.style.display = controlGranted ? 'none' : '';
      if (quickControlStop) quickControlStop.style.display = controlGranted ? '' : 'none';
      if (quickControl) {
        quickControl.className = 'rbtn ' + (controlGranted ? '' : 'accent') + (pendingWho ? ' pending' : '');
        quickControl.title = controlGranted ? 'Stop Their Control' : 'Allow Keyboard & Mouse';
      }
      if (modalControlBtn) modalControlBtn.textContent = controlGranted ? 'Stop Control' : 'Allow Control';
      if (controlStatusText) {
        controlStatusText.textContent = controlGranted
          ? 'They can click and type'
          : 'They can only watch';
      }
      if (controlStatusRow) controlStatusRow.className = 'status-row' + (controlGranted ? ' warn' : '');
      renderSubtitle();
    };
    // A viewer asked for control. Show the card and point at the button rather
    // than raising the main app window, which used to cover the host's whole
    // desktop and leave the viewer staring at a blank app.
    const askBar = document.getElementById('askBar');
    ipcRenderer.on('host-dock:control-request', (_event, info) => {
      const who = (info && info.viewerName) ? String(info.viewerName) : 'Someone';
      pendingWho = who;
      if (askBar) askBar.textContent = who + ' is asking to control this PC.';
      body.classList.add('control-pending');
      if (approveBtn) approveBtn.classList.add('pending');
      cancelAutoCollapse();
      if (mode === 'mascot') setMode('card');
      renderControlState();
      flash(who + ' wants control');
    });
    const clearPending = () => {
      pendingWho = '';
      body.classList.remove('control-pending');
      if (approveBtn) approveBtn.classList.remove('pending');
    };
    ipcRenderer.on('host-dock:control-state', (_event, granted) => {
      controlGranted = Boolean(granted);
      clearPending();
      renderControlState();
    });
    renderControlState();

    // Remote audio. Reported the moment someone can hear the machine.
    const audioBtn = document.getElementById('audioToggle');
    const audioOnIcon = document.getElementById('audioOnIcon');
    const audioOffIcon = document.getElementById('audioOffIcon');
    const audioStatusRow = document.getElementById('audioStatusRow');
    const audioStatusText = document.getElementById('audioStatusText');
    const audioActionLabel = document.getElementById('audioActionLabel');
    const audioActionSub = document.getElementById('audioActionSub');
    ipcRenderer.on('host-dock:audio-state', (_event, state) => {
      const listening = Boolean(state && state.listening);
      const muted = Boolean(state && state.muted);
      const wasListening = someoneListening;
      someoneListening = listening;
      audioMuted = muted;
      if (audioOnIcon) audioOnIcon.style.display = muted ? 'none' : '';
      if (audioOffIcon) audioOffIcon.style.display = muted ? '' : 'none';
      if (audioActionLabel) audioActionLabel.textContent = muted ? "Share This PC's Sound" : "Mute This PC's Sound";
      if (audioActionSub) {
        audioActionSub.textContent = muted
          ? 'Let them hear what this PC is playing again.'
          : 'Stop sending what this PC is playing.';
      }
      if (audioStatusText) {
        audioStatusText.textContent = muted
          ? 'Muted by you'
          : listening ? 'They can hear this PC' : 'Nobody is listening';
      }
      if (audioStatusRow) {
        audioStatusRow.className = 'status-row' + (muted ? '' : listening ? ' warn' : '');
      }
      renderSubtitle();
      // Announce only the transition, so the host is told once rather than on
      // every dock reload while someone stays connected.
      if (listening && !muted && !wasListening) flash('Someone is listening to this PC');
    });
    if (audioBtn) audioBtn.addEventListener('click', () => ipcRenderer.send('host-dock:toggle-audio'));

    const openChat = () => { cancelAutoCollapse(); ipcRenderer.send('host-dock:open-chat'); };
    const chatActionBtn = document.getElementById('chatAction');
    if (chatActionBtn) chatActionBtn.addEventListener('click', openChat);
    document.getElementById('quickChat').addEventListener('click', openChat);
    const sendFileActionBtn = document.getElementById('sendFileAction');
    if (sendFileActionBtn) sendFileActionBtn.addEventListener('click', () => ipcRenderer.send('host-dock:send-file'));

    const toggleControl = () => ipcRenderer.send(controlGranted ? 'host-dock:revoke-control' : 'host-dock:approve-control');
    if (approveBtn) approveBtn.addEventListener('click', () => ipcRenderer.send('host-dock:approve-control'));
    if (revokeBtn) revokeBtn.addEventListener('click', () => ipcRenderer.send('host-dock:revoke-control'));
    if (quickControl) quickControl.addEventListener('click', toggleControl);
    document.getElementById('copySession').addEventListener('click', () => ipcRenderer.send('host-dock:copy-session'));
    document.getElementById('endSession').addEventListener('click', () => ipcRenderer.send('host-dock:end-session'));
    document.getElementById('quickEnd').addEventListener('click', () => ipcRenderer.send('host-dock:end-session'));
    document.getElementById('modalSendFile').addEventListener('click', () => ipcRenderer.send('host-dock:send-file'));
    if (modalControlBtn) modalControlBtn.addEventListener('click', toggleControl);
    document.getElementById('modalCopy').addEventListener('click', () => ipcRenderer.send('host-dock:copy-session'));
    document.getElementById('modalHide').addEventListener('click', () => { body.classList.remove('options-open'); setMode('mascot'); });
    ipcRenderer.on('host-dock:status', (_event, message) => flash(message));
  </script>
</body>
</html>`;
}

// The page carries the inlined Lottie player (~170 KB) plus the mascot
// animation, well past what a data: URL can safely hold, so it is written to
// disk and loaded as a file. Same node-integrated page either way.
function loadHostDockPage(win: BrowserWindow, html: string) {
  try {
    const pagePath = join(app.getPath('userData'), 'host-dock.html');
    writeFileSync(pagePath, html, 'utf8');
    void win.loadFile(pagePath);
  } catch (error: any) {
    log.warn('[HostDock] Failed to write the dock page, using a data URL:', error?.message || error);
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }
}

function showHostDesktopDock(options: { sessionName?: string; sessionId?: string; viewerName?: string; viewerNames?: string[] } = {}) {
  const sessionName = options.sessionName || hostStreamSettings.deviceName || os.hostname();
  const sessionId = options.sessionId || currentHostSessionId || activeHostAccessKey || '';
  const viewerNames = (options.viewerNames && options.viewerNames.length > 0)
    ? options.viewerNames
    : (options.viewerName ? [options.viewerName] : collectDockViewerNames());
  hostDockRowCount = Math.max(1, viewerNames.length || 1);

  if (hostDockWindow && !hostDockWindow.isDestroyed()) {
    hostDockMode = 'card';
    hostDockWindow.setBounds(getHostDockBounds('card'), false);
    loadHostDockPage(hostDockWindow, hostDockHtml(sessionName, sessionId, viewerNames));
    positionHostDock('card');
    hostDockWindow.showInactive();
    return;
  }

  hostDockMode = 'card';
  hostDockWindow = new BrowserWindow({
    ...getHostDockBounds('card'),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    title: 'Remote365 Dock',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  hostDockWindow.setAlwaysOnTop(true, 'screen-saver');
  hostDockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // The dock gets created or reloaded at arbitrary points in a session — often
  // after the control channel already opened, and again on every session-list
  // refresh — so push the current mode on each load, not only on transitions.
  hostDockWindow.webContents.on('did-finish-load', () => sendHostDockControlState(controlGranted));
  loadHostDockPage(hostDockWindow, hostDockHtml(sessionName, sessionId, viewerNames));
  hostDockWindow.once('ready-to-show', () => {
    positionHostDock('card');
    hostDockWindow?.showInactive();
  });
  hostDockWindow.on('closed', () => {
    hostDockWindow = null;
  });
}

function hideHostDesktopDock() {
  if (!hostDockWindow || hostDockWindow.isDestroyed()) return;
  hostDockWindow.close();
  hostDockWindow = null;
}

// ── Host chat window (its own floating dock) ────────────────────────────────
// Chat gets a SEPARATE always-on-top window beside the session dock: the dock
// stays a compact session panel, and the conversation can be moved around by
// its header, opened from the dock's chat button, and popped up (without
// stealing focus) whenever the viewer writes. History lives here in main so
// the window can be closed and reopened mid-session without losing messages.
// --- Control-request consent prompt -----------------------------------------
// Its own centred, always-on-top window rather than a modal in the main app
// window: that window is minimized for the whole session, and restoring it
// covered the host's entire desktop, so the viewer's picture went blank while
// they waited for an answer.
const HOST_CONSENT_SIZE = { width: 440, height: 300 };
let hostConsentWindow: BrowserWindow | null = null;
let hostConsentViewerId: string | null = null;

function hostConsentHtml(viewerName: string) {
  const logoUrl = getAppLogoDataUrl();
  const who = String(viewerName || 'A remote user')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: transparent; font-family: "Mona Sans", "Segoe UI", system-ui, sans-serif; user-select: none; }
  .card { height: 100%; padding: 22px; border-radius: 14px; border: 1px solid rgba(0,0,0,0.08); background: #fff; box-shadow: 0 24px 60px rgba(0,0,0,0.28); display: flex; flex-direction: column; align-items: center; text-align: center; }
  .icon { width: 54px; height: 54px; border-radius: 14px; background: #FFF3E2; display: flex; align-items: center; justify-content: center; }
  h2 { margin: 14px 0 6px; font-size: 17px; font-weight: 700; color: #111315; }
  p { margin: 0; font-size: 13px; line-height: 19px; color: rgba(26,29,33,0.7); }
  .bar { width: 100%; height: 6px; margin: 16px 0 6px; border-radius: 999px; background: #F1F2F4; overflow: hidden; }
  .fill { height: 100%; width: 100%; background: #FF8A00; transition: width 1s linear; }
  .count { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(26,29,33,0.5); }
  .row { margin-top: auto; display: flex; gap: 10px; width: 100%; }
  button { flex: 1; height: 44px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .deny { border: 1px solid rgba(26,29,33,0.15); background: #fff; color: #111315; }
  .deny:hover { background: #F6F7F8; }
  .allow { border: 0; background: #FF8A00; color: #fff; }
  .allow:hover { background: #E67C00; }
</style></head><body>
  <div class="card">
    <div class="icon"><img src="${logoUrl}" alt="" width="30" height="30" style="object-fit:contain"></div>
    <h2>${who} wants to control this PC</h2>
    <p>They can already see your screen. Allowing this lets them use your mouse and keyboard as well. You can stop it at any time from the Remote365 bar.</p>
    <div class="bar"><div class="fill" id="fill"></div></div>
    <div class="count" id="count">Declining Automatically In 20s</div>
    <div class="row">
      <button class="deny" id="deny">Not Now</button>
      <button class="allow" id="allow">Allow</button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    let left = 20;
    const fill = document.getElementById('fill');
    const count = document.getElementById('count');
    const timer = setInterval(() => {
      left -= 1;
      if (fill) fill.style.width = Math.max(0, (left / 20) * 100) + '%';
      if (count) count.textContent = 'Declining automatically in ' + Math.max(0, left) + 's';
      if (left <= 0) { clearInterval(timer); ipcRenderer.send('host-consent:deny'); }
    }, 1000);
    document.getElementById('allow').addEventListener('click', () => { clearInterval(timer); ipcRenderer.send('host-consent:allow'); });
    document.getElementById('deny').addEventListener('click', () => { clearInterval(timer); ipcRenderer.send('host-consent:deny'); });
  </script>
</body></html>`;
}

function showHostConsentWindow(viewerId: string, viewerName: string) {
  hostConsentViewerId = viewerId || null;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
  const area = display.workArea;
  const bounds = {
    width: HOST_CONSENT_SIZE.width,
    height: HOST_CONSENT_SIZE.height,
    x: Math.round(area.x + (area.width - HOST_CONSENT_SIZE.width) / 2),
    y: Math.round(area.y + (area.height - HOST_CONSENT_SIZE.height) / 2),
  };
  if (hostConsentWindow && !hostConsentWindow.isDestroyed()) {
    hostConsentWindow.setBounds(bounds, false);
    hostConsentWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hostConsentHtml(viewerName))}`);
    hostConsentWindow.show();
    return;
  }
  hostConsentWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    title: 'Remote365 Control Request',
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
  });
  hostConsentWindow.setAlwaysOnTop(true, 'screen-saver');
  hostConsentWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hostConsentWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hostConsentHtml(viewerName))}`);
  hostConsentWindow.once('ready-to-show', () => hostConsentWindow?.show());
  hostConsentWindow.on('closed', () => { hostConsentWindow = null; });
}

function hideHostConsentWindow() {
  hostConsentViewerId = null;
  // Destroy, don't hide: a hidden BrowserWindow keeps its whole renderer
  // process (~60-90 MB) alive for the rest of the app's life after the first
  // control request. destroy() is synchronous, so an immediate re-show can
  // never grab a window that is halfway through closing.
  if (hostConsentWindow && !hostConsentWindow.isDestroyed()) {
    const win = hostConsentWindow;
    hostConsentWindow = null;
    win.destroy();
  }
  // The in-app modal counts down independently; without this it would fire its
  // own auto-deny 20s after the host had already allowed control here.
  mainWindow?.webContents.send('host:control-request-resolved');
}

// ---- Loopback host-status endpoint (web dashboard lock overlay) -------------
// A web dashboard tab running in a browser ON THIS MACHINE has no way to know
// the machine is being remotely controlled — Electron IPC doesn't reach it.
// This loopback-only HTTP endpoint answers that single question so the web app
// can mirror HostLockOverlay. CORS is limited to our origins, and Chrome's
// Private Network Access preflight is answered explicitly. State is mirrored
// wherever `host:remote-control` is sent to the renderer.
const HOST_STATUS_PORT = 39867;
let webLockControlled = false;
let webLockViewerName = '';
function setWebLockState(active: boolean, viewerName?: string) {
  webLockControlled = Boolean(active);
  webLockViewerName = active ? String(viewerName || '') : '';
}
function hostStatusAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  if (/^https:\/\/(pp\.)?remote365\.ai$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin; // web dev server
  return null;
}
function startHostStatusServer() {
  try {
    const server = http.createServer((req, res) => {
      const origin = hostStatusAllowedOrigin(req.headers.origin as string | undefined);
      const headers: Record<string, string> = {
        'Access-Control-Allow-Private-Network': 'true',
        'Cache-Control': 'no-store',
      };
      if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }
      if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
      if (req.method === 'GET' && String(req.url || '').startsWith('/host-status')) {
        headers['Content-Type'] = 'application/json';
        res.writeHead(200, headers);
        res.end(JSON.stringify({ controlled: webLockControlled, viewerName: webLockViewerName }));
        return;
      }
      res.writeHead(404, headers);
      res.end();
    });
    // Another instance (or an unrelated app) on the port must not crash us —
    // the overlay simply won't show, which is the pre-feature behavior.
    server.on('error', (err: any) => log.warn(`[HostStatus] local status server error: ${err?.message || err}`));
    server.listen(HOST_STATUS_PORT, '127.0.0.1', () => log.info(`[HostStatus] serving on 127.0.0.1:${HOST_STATUS_PORT}`));
  } catch (err: any) {
    log.warn(`[HostStatus] could not start: ${err?.message || err}`);
  }
}

// Recording notice: a small top-center toast on the HOST's screen so the person
// at the machine cannot miss that a viewer is recording. The dock also shows it,
// but the dock is easy to overlook — this window sits above everything for a few
// seconds and then removes itself. Non-focusable so it never steals typing focus.
const HOST_RECORDING_NOTICE_SIZE = { width: 400, height: 64 };
let hostRecordingNoticeWindow: BrowserWindow | null = null;
let hostRecordingNoticeTimer: NodeJS.Timeout | null = null;

function hostRecordingNoticeHtml(byName: string, on: boolean) {
  const esc = (value: string) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const message = on
    ? `${esc(byName)} has started recording this session`
    : `${esc(byName)} stopped recording`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; font-family: "Mona Sans", "Segoe UI", system-ui, sans-serif; user-select: none; }
    .card { width: 100%; height: 100%; display: flex; align-items: center; gap: 10px; padding: 0 18px; background: #fff; border: 1px solid ${on ? '#FF383C' : '#E7E9ED'}; border-radius: 14px; box-shadow: 0 10px 34px rgba(17, 19, 21, 0.22); }
    .dot { flex: none; width: 12px; height: 12px; border-radius: 50%; background: ${on ? '#FF383C' : '#9AA1A9'}; ${on ? 'animation: pulse 1.1s ease-in-out infinite;' : ''} }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.78); } }
    .text { min-width: 0; flex: 1; font-size: 13px; font-weight: 600; line-height: 18px; color: #111315; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div class="card"><span class="dot"></span><span class="text">${message}</span></div>
</body>
</html>`;
}

function showHostRecordingNotice(byName: string, on: boolean) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
  const area = display.workArea;
  const bounds = {
    width: HOST_RECORDING_NOTICE_SIZE.width,
    height: HOST_RECORDING_NOTICE_SIZE.height,
    x: Math.round(area.x + (area.width - HOST_RECORDING_NOTICE_SIZE.width) / 2),
    y: area.y + 12,
  };
  if (hostRecordingNoticeTimer) { clearTimeout(hostRecordingNoticeTimer); hostRecordingNoticeTimer = null; }
  if (!hostRecordingNoticeWindow || hostRecordingNoticeWindow.isDestroyed()) {
    hostRecordingNoticeWindow = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      focusable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      title: 'Remote365 Recording Notice',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    hostRecordingNoticeWindow.setAlwaysOnTop(true, 'screen-saver');
    hostRecordingNoticeWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    hostRecordingNoticeWindow.on('closed', () => { hostRecordingNoticeWindow = null; });
  } else {
    hostRecordingNoticeWindow.setBounds(bounds, false);
  }
  const win = hostRecordingNoticeWindow;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hostRecordingNoticeHtml(byName, on))}`);
  // 'ready-to-show' fires ONCE per BrowserWindow, so a reused (hidden) window
  // would never re-show — the "notice only appears the first time" bug.
  // 'did-finish-load' fires for every loadURL; showInactive on a visible
  // window is a no-op, so no isVisible branching needed.
  win.webContents.once('did-finish-load', () => {
    if (hostRecordingNoticeWindow === win && !win.isDestroyed()) win.showInactive();
  });
  hostRecordingNoticeTimer = setTimeout(() => {
    hostRecordingNoticeTimer = null;
    // Destroy, don't hide — a hidden notice window held a renderer process
    // (~50-80 MB) forever after the first recording toggle. The next notice
    // simply builds a fresh window (see the isDestroyed branch above).
    if (hostRecordingNoticeWindow && !hostRecordingNoticeWindow.isDestroyed()) {
      const win = hostRecordingNoticeWindow;
      hostRecordingNoticeWindow = null;
      win.destroy();
    }
  }, on ? 7000 : 4000);
}

const HOST_CHAT_SIZE = { width: 320, height: 420 };
let hostChatWindow: BrowserWindow | null = null;
let hostChatHistory: { from: string; text: string; at: number; mine: boolean }[] = [];

function getHostChatBounds() {
  // Top-right corner of the work area — clear of the session dock, which
  // anchors bottom-right. The window stays movable, so this is only where it
  // first appears; the host user can drag it anywhere.
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
  const area = display.workArea;
  return {
    width: HOST_CHAT_SIZE.width,
    height: HOST_CHAT_SIZE.height,
    x: area.x + area.width - HOST_CHAT_SIZE.width - 16,
    y: area.y + 16,
  };
}

function hostChatHtml(viewerLabel: string) {
  const logoUrl = getAppLogoDataUrl();
  const esc = (value: string) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #fff; font-family: "Mona Sans", "Segoe UI", system-ui, sans-serif; color: #111315; user-select: none; }
    .frame { width: 100%; height: 100%; display: flex; flex-direction: column; border: 1px solid #FF8A00; }
    .head { height: 44px; flex: none; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #fff; border-bottom: 1px solid #E7E9ED; -webkit-app-region: drag; }
    .brand { min-width: 0; display: flex; align-items: center; gap: 8px; }
    .brand img { width: 24px; height: 24px; object-fit: contain; border-radius: 4px; }
    .brand div { min-width: 0; }
    .brand strong { display: block; font-size: 12px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .brand span { display: block; font-size: 9px; line-height: 12px; color: rgba(26,29,33,0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .icon-btn { width: 24px; height: 24px; border: 0; background: transparent; color: #111315; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; -webkit-app-region: no-drag; }
    .icon-btn:hover { background: #F3F4F6; }
    .list { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; background: #F9FAFB; }
    .msg { max-width: 82%; padding: 6px 9px; border-radius: 8px; font-size: 12px; line-height: 16px; word-wrap: break-word; white-space: pre-wrap; user-select: text; }
    .msg .who { display: block; font-size: 9px; opacity: .6; margin-bottom: 1px; }
    .msg.them { align-self: flex-start; background: #fff; border: 1px solid #E7E9ED; }
    .msg.me { align-self: flex-end; background: #FFE9D2; }
    .row { height: 48px; flex: none; padding: 8px 10px; display: flex; gap: 6px; background: #fff; border-top: 1px solid #E7E9ED; }
    .row input { flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid #D8DCE3; border-radius: 6px; font: inherit; font-size: 12px; color: #111315; outline: none; }
    .row input:focus { border-color: #FF8A00; }
    .row button { height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: #FF8A00; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; }
    .status { position: absolute; left: 10px; bottom: 56px; right: 10px; padding: 4px 8px; border-radius: 4px; background: rgba(17,19,21,0.88); color: #fff; font-size: 10px; line-height: 14px; opacity: 0; transition: opacity .14s ease; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="head">
      <div class="brand">
        <img src="${logoUrl}" alt="">
        <div>
          <strong>Chat</strong>
          <span>${esc(viewerLabel)}</span>
        </div>
      </div>
      <button class="icon-btn" id="close" title="Close Chat" aria-label="Close Chat">
        <svg width="16" height="16" viewBox="0 0 18 18"><path d="M4.5 4.5 13.5 13.5M13.5 4.5 4.5 13.5" stroke="#111315" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="list" id="list"></div>
    <div class="row">
      <input id="input" type="text" maxlength="500" placeholder="Type A Message..." />
      <button id="send">Send</button>
    </div>
    <div class="status" id="status"></div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const list = document.getElementById('list');
    const input = document.getElementById('input');
    const statusEl = document.getElementById('status');
    let statusTimer = null;
    const showStatus = (message) => {
      statusEl.textContent = message;
      statusEl.classList.add('show');
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => statusEl.classList.remove('show'), 1800);
    };
    const appendMsg = (who, text, mine) => {
      const el = document.createElement('div');
      el.className = 'msg ' + (mine ? 'me' : 'them');
      if (!mine) {
        const w = document.createElement('span');
        w.className = 'who';
        w.textContent = who;
        el.appendChild(w);
      }
      el.appendChild(document.createTextNode(text));
      list.appendChild(el);
      list.scrollTop = list.scrollHeight;
    };
    const sendChat = () => {
      const text = (input.value || '').trim();
      if (!text) return;
      ipcRenderer.send('host-chat:send', text);
      appendMsg('You', text, true);
      input.value = '';
    };
    document.getElementById('send').addEventListener('click', sendChat);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') sendChat(); });
    document.getElementById('close').addEventListener('click', () => ipcRenderer.send('host-chat:close'));
    ipcRenderer.on('host-chat:init', (_event, history) => {
      list.textContent = '';
      (history || []).forEach((m) => appendMsg(m.mine ? 'You' : (m.from || 'Viewer'), String(m.text || ''), Boolean(m.mine)));
    });
    ipcRenderer.on('host-chat:message', (_event, m) => {
      appendMsg((m && m.from) || 'Viewer', String((m && m.text) || ''), false);
    });
    ipcRenderer.on('host-chat:status', (_event, message) => showStatus(message));
    ipcRenderer.on('host-chat:focus-input', () => setTimeout(() => input.focus(), 80));
  </script>
</body>
</html>`;
}

function showHostChatWindow(focusInput: boolean) {
  const viewerLabel = collectDockViewerNames()[0] || 'Remote Viewer';
  if (hostChatWindow && !hostChatWindow.isDestroyed()) {
    if (!hostChatWindow.isVisible()) hostChatWindow.showInactive();
    if (focusInput) {
      hostChatWindow.focus();
      try { hostChatWindow.webContents.send('host-chat:focus-input'); } catch { }
    }
    return;
  }
  hostChatWindow = new BrowserWindow({
    ...getHostChatBounds(),
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    title: 'Remote365 Chat',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });
  hostChatWindow.setAlwaysOnTop(true, 'screen-saver');
  hostChatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hostChatWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hostChatHtml(viewerLabel))}`);
  hostChatWindow.webContents.once('did-finish-load', () => {
    try { hostChatWindow?.webContents.send('host-chat:init', hostChatHistory); } catch { }
    if (focusInput) try { hostChatWindow?.webContents.send('host-chat:focus-input'); } catch { }
  });
  hostChatWindow.once('ready-to-show', () => {
    // showInactive: an incoming message must never steal focus from the host
    // user's work; a deliberate open from the dock button MAY take focus.
    if (focusInput) hostChatWindow?.show();
    else hostChatWindow?.showInactive();
  });
  hostChatWindow.on('closed', () => {
    hostChatWindow = null;
  });
}

function hideHostChatWindow(clearHistory: boolean) {
  if (clearHistory) hostChatHistory = [];
  if (!hostChatWindow || hostChatWindow.isDestroyed()) return;
  hostChatWindow.close();
  hostChatWindow = null;
}

function deliverHostChatMessage(from: string, text: string) {
  hostChatHistory.push({ from, text, at: Date.now(), mine: false });
  if (hostChatHistory.length > 200) hostChatHistory = hostChatHistory.slice(-200);
  if (!hostChatWindow || hostChatWindow.isDestroyed()) {
    // did-finish-load's init delivers the history including this message.
    showHostChatWindow(false);
    return;
  }
  if (!hostChatWindow.isVisible()) hostChatWindow.showInactive();
  try { hostChatWindow.webContents.send('host-chat:message', { from, text, at: Date.now() }); } catch { }
}

// Tracks which modifier VKs we believe are currently held on the host from
// injected input. "Direct keyboard mode" on the viewer sends raw keydown/keyup
// for printable keys (instead of the batched typeText command), so a shifted
// character like "!" or "A" only comes out right if Shift is genuinely down on
// the host when the main key lands. The Shift/Ctrl/Alt key's own keydown
// normally arrives as its own event and handles this, but if it's ever missing
// or arrives late, this catches up defensively before injecting the main key.
const heldModifierVKs = new Set<number>();
const MODIFIER_VKS: Record<string, number> = { shiftKey: 0x10, ctrlKey: 0x11, altKey: 0x12 };
// Every modifier whose down/up we track so a dropped viewer never leaves it
// stuck. Win (0x5B/0x5C) is tracked but NOT in MODIFIER_VKS: the catch-up
// press below must never turn a Mac web viewer's Cmd+C into Win+C.
const HELD_MODIFIER_VKS = new Set<number>([0x10, 0x11, 0x12, 0x5B, 0x5C]);

// Hoisted out of handleControlMessage — it runs for every input event.
// Anything NOT listed here needs control first. Browsing the host's disk and
// pulling files off it is not "viewing", so the file-browser commands sit
// behind the gate alongside input: a view-only viewer can watch the screen and
// talk, and that is all.
const ALLOWED_BEFORE_CONTROL = new Set([
  'ping',
  'request-keyframe',
  'stream-quality',
  'stream-activity',
  // Chat is conversation, not control — it must work in view-only sessions.
  'chat',
  // Neither is showing your face: a view-only helper should still be able to
  // talk to the person whose machine they are looking at.
  'cam:start',
  'cam:stop',
  // Waking the screen is a precondition for viewing it, not control.
  'wake',
  // Listening to the host's speakers is watching, not driving.
  'audio-listen',
  // Recording notices must flow even in view-only sessions.
  'recording-state',
]);

// A view-only viewer that keeps sending input gets one 'control-denied' per
// dropped event. Pointer travel alone is 60+/s, and those replies ride the
// control channel that chat and file transfer share. Clients are gated their
// own side too, but the host cannot rely on that — old builds, other viewers,
// anything hand-rolled. One notice a second is plenty to correct a viewer's UI.
const CONTROL_DENIED_NOTICE_MS = 1000;
const lastControlDeniedAt = new Map<string, number>();


function normalizeHostStreamQuality(value: any) {
  const quality = String(value || '').toLowerCase();
  const aliases: Record<string, string> = {
    auto: 'ultra',
    high: 'ultra',
    quality: 'ultra',
    medium: 'balanced',
    low: 'smooth',
    speed: 'smooth',
  };
  const normalized = aliases[quality] || quality;
  return ['smooth', 'balanced', 'sharp', 'ultra'].includes(normalized) ? normalized : 'ultra';
}

// Streaming Accumulators (Annex-B Aggregator)
// Node 22 models transferred Uint8Array backing stores as ArrayBufferLike
// (which legitimately includes SharedArrayBuffer), while Buffer.alloc infers
// the narrower ArrayBuffer type. Keep the accumulator broad enough for both
// FFmpeg pipe Buffers and zero-copy worker-transferred chunks.
let bufferAccumulator: Buffer<ArrayBufferLike> = Buffer.alloc(0);
let accessUnitBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
let hasVcl = false;

// Pre-buffering and Handshake
let ffmpegPreChunks: Buffer[] = [];
let isPreBuffering = false;
// Pre-buffering is a LATENCY OPTIMISATION ONLY: it hides FFmpeg cold-start
// behind the ICE handshake. It must never be able to latch on, because while it
// is true sendFrameToAllViewers discards every encoded frame into a 3-frame
// ring — the viewer then sits on a permanently grey viewport even though
// capture and encoding are healthy. The flush used to depend on a bootstrap
// send succeeding, whose only retry was guarded on the peer already being
// 'connected' and shared one global timer; missing that window stranded the
// session forever. Releasing the buffer is always safe: a live P-frame stream
// becomes decodable at the next GOP, which is max(15, fps/2) frames (~0.5s).
const PREBUFFER_MAX_HOLD_MS = 3000;
let preBufferWatchdog: NodeJS.Timeout | null = null;

function clearPreBufferWatchdog() {
  if (preBufferWatchdog) { clearTimeout(preBufferWatchdog); preBufferWatchdog = null; }
}

function armPreBufferWatchdog() {
  clearPreBufferWatchdog();
  preBufferWatchdog = setTimeout(() => {
    preBufferWatchdog = null;
    if (!isPreBuffering) return;
    const peers = Array.from(hostViewerPeers.values());
    // Name the stage that stalled, so a grey screen in the field is diagnosable
    // from the log alone instead of guessing between capture/encode/transport.
    log.warn('[Host] STALL: pre-buffer never opened within '
      + `${PREBUFFER_MAX_HOLD_MS}ms. Releasing it and streaming live. `
      + `peers=${peers.length} bootstrapCached=${Boolean(latestBootstrapAccessUnit)} `
      + `queued=${ffmpegPreChunks.length} `
      + `pcStates=[${peers.map((x) => x.peerConnection?.state?.() || '?').join(',')}] `
      + `trackOpen=[${peers.map((x) => (typeof x.videoTrack?.isOpen === 'function' ? x.videoTrack.isOpen() : '?')).join(',')}]`);
    flushPreBuffer();
  }, PREBUFFER_MAX_HOLD_MS);
}
let prebufferFlushRetryTimer: NodeJS.Timeout | null = null;
// Keep the latest COMPLETE random-access AU separately from the rolling
// prebuffer. A slow ICE/DTLS handshake can easily evict the encoder's startup
// SPS/PPS/IDR from the three-frame FIFO on an otherwise static desktop. Sending
// only the following P-frames leaves Chromium unable to decode anything until
// the next GOP (or the viewer watchdog restarts the encoder).
let latestBootstrapAccessUnit: Buffer | null = null;
let activeAdaptiveQuality = '';
let lastAdaptiveQualityChange = 0;
// When the viewer pins a quality from the menu, the bandwidth auto-tuner stands down.
let userQualityLock: string | null = null;

// Hardware encoder detection cache
let detectedEncoder: string = 'libx264';
let encoderDetected = false;

// Last known-good raw frame per display, kept across stream (re)starts. DXGI
// desktop duplication only delivers a frame when the screen CHANGES, so on a
// static desktop a fresh pipeline gets nothing to encode — the viewer stares at
// a black screen until the host repaints. Seeding the pipeline with the last
// real frame (or a one-shot desktopCapturer grab on cold start) guarantees the
// encoder produces SPS/PPS+IDR immediately.
let lastPrimeFrame: { data: Buffer; width: number; height: number; displayId: number } | null = null;
let desktopPrimeInFlight = false;

async function primeViaDesktopCapturer(display: any, physWidth: number, physHeight: number) {
  if (desktopPrimeInFlight) return;
  desktopPrimeInFlight = true;
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physWidth, height: physHeight },
    });
    const source = sources.find((s: any) => String(s.display_id) === String(display.id)) || sources[0];
    const img = source?.thumbnail;
    if (!img || img.isEmpty()) return;
    const size = img.getSize();
    const bmp = img.toBitmap(); // BGRA on Windows — same layout the rawvideo pipe expects
    if (size.width === physWidth && size.height === physHeight && bmp.length === physWidth * physHeight * 4) {
      lastPrimeFrame = { data: Buffer.from(bmp), width: physWidth, height: physHeight, displayId: display.id };
      log.info('[Host] Primed first frame via desktopCapturer (static screen, no DXGI frame yet).');
    } else {
      log.warn(`[Host] desktopCapturer prime size mismatch (${size.width}x${size.height}, ${bmp.length} bytes) — skipping.`);
    }
  } catch (err: any) {
    log.warn(`[Host] desktopCapturer prime failed: ${err?.message || err}`);
  } finally {
    desktopPrimeInFlight = false;
  }
}

// Secure-desktop fallback for the in-process (worker-disabled) capture loop.
// Feeds the lock/PIN screen from the elevated agent when DXGI goes blank.
const mainSecureCapture = new SecureDesktopCapture((m) => log.info(`[SecureCapture] ${m}`));
// OS lock state (from powerMonitor). While locked, DXGI keeps returning the
// frozen Default-desktop wallpaper, so the capture loops must prefer the agent's
// secure-desktop frame — this is the authoritative trigger, not DXGI-blankness.
let hostSessionLocked = false;
function registerLockStateWatcher() {
  try {
    powerMonitor.on('lock-screen', () => {
      hostSessionLocked = true;
      log.info('[SecureCapture] Session LOCKED (powerMonitor) — switching capture to the secure desktop.');
      if (isStreamWorkerEnabled()) setWorkerSecureForce(true);
    });
    powerMonitor.on('unlock-screen', () => {
      hostSessionLocked = false;
      log.info('[SecureCapture] Session UNLOCKED (powerMonitor) — resuming normal capture.');
      if (isStreamWorkerEnabled()) setWorkerSecureForce(false);
      mainSecureCapture.deactivate();
    });
    // After sleep/hibernate the signaling socket is almost always half-open
    // (server already dropped us, client still believes readyState OPEN). Force
    // a clean reconnect with a fresh token instead of waiting for the watchdog.
    powerMonitor.on('resume', () => {
      if (!activeHostAccessKey || isManualHostStop) return;
      log.info('[Host] System resumed — forcing signaling reconnect.');
      hostReconnectAttempts = 0;
      try { hostSignalingWs?.terminate(); } catch { /* already dead */ }
      scheduleHostReconnect('system-resume');
    });
  } catch (err: any) {
    log.warn(`[SecureCapture] powerMonitor lock watcher unavailable: ${err?.message || err}`);
  }
}

// --- IPC Handlers ---
ipcMain.handle('system:getLocalIP', () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
});

ipcMain.handle('system:getSystemInfo', () => {
  const interfaces = os.networkInterfaces();
  let ipLocal = '127.0.0.1';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ipLocal = iface.address;
        break;
      }
    }
    if (ipLocal !== '127.0.0.1') break;
  }

  return {
    os: os.type(),
    osVersion: os.release(),
    ram: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
    cpu: os.cpus()?.[0]?.model || 'Unknown CPU',
    ipLocal,
    uptime: `${Math.floor(os.uptime() / 60)} min`,
  };
});

// Durable machine identity sent with /self-register so the server can find
// this machine's existing Device row even when the cached access key is gone
// (reinstall, cleared localStorage). Prefers the Windows MachineGuid, which
// survives NIC changes and VPN adapters; falls back to the set of physical
// MACs, then the hostname. Hashed so no raw hardware identifier leaves the box.
let cachedMachineFingerprint = '';
function computeMachineFingerprint(): string {
  if (cachedMachineFingerprint) return cachedMachineFingerprint;
  let source = '';
  if (process.platform === 'win32') {
    try {
      const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf8', windowsHide: true });
      const match = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
      if (match) source = `guid:${match[1].toLowerCase()}`;
    } catch { /* registry unavailable — fall back to MAC-based identity */ }
  }
  if (!source) {
    const macs = Object.values(os.networkInterfaces())
      .flat()
      .filter((i: any) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
      .map((i: any) => String(i.mac).toLowerCase());
    const unique = Array.from(new Set(macs)).sort();
    if (unique.length) source = `mac:${unique.join(',')}`;
  }
  if (!source) source = `host:${os.hostname()}`;
  cachedMachineFingerprint = crypto.createHash('sha256').update(source).digest('hex');
  return cachedMachineFingerprint;
}
ipcMain.handle('system:getMachineFingerprint', () => computeMachineFingerprint());

ipcMain.handle('system:getDeterministicKey', () => {
  const interfaces = os.networkInterfaces();
  let mac = '';
  for (const key of Object.keys(interfaces)) {
    const list = interfaces[key];
    if (list) {
      const valid = list.find((i: any) => !i.internal && i.mac !== '00:00:00:00:00:00');
      if (valid) { mac = valid.mac; break; }
    }
  }
  if (!mac) mac = os.hostname();
  const hash = crypto.createHash('sha256').update(mac).digest('hex');
  return (BigInt('0x' + hash.substring(0, 12)) % 1000000000n).toString().padStart(9, '0');
});

// --- Auto-Updater Handlers ---
const UPDATE_FEED_URL = process.env.CONNECT_X_UPDATE_URL || `${buildHttpOrigin(DEFAULT_SERVER_HOST)}/downloads/desktop/`;
let autoInstallUpdates = true;
let silentUpdateReady = false;
let isDownloadingUpdate = false;
let isInstallingUpdate = false;
let backgroundInstallFailureCount = 0;
let pendingDownloadedUpdateInfo: any = null;
let pendingDownloadedInstallerPath: string | null = null;
let updateInstallLaunchTimer: NodeJS.Timeout | null = null;
const getDeviceUpdatePreferencePath = () => join(app.getPath('userData'), 'update-preferences.json');

// Background auto-update failures must never nag the user. While a new build is
// being published the feed briefly points at files that aren't fully uploaded
// yet (latest.yml lands before the .exe finishes), so a background download 404s
// or fails its checksum — but the 60s poll retries on its own and succeeds the
// moment the upload completes. Only surface an update error in the UI when it
// follows an explicit user action (Check for updates / Download update); every
// background check/download error is logged and swallowed.
let lastUserUpdateActionAt = 0;
const USER_UPDATE_ERROR_WINDOW_MS = 30_000;
const isUserUpdateContext = () => Date.now() - lastUserUpdateActionAt < USER_UPDATE_ERROR_WINDOW_MS;
function sendUpdateErrorToUi(message: string) {
  if (!isUserUpdateContext()) {
    log.info(`[Updater] Background update issue (not shown to user; will retry): ${message}`);
    return;
  }
  mainWindow?.webContents.send('update:error', message);
}

function applyAutoUpdatePreference(enabled: boolean, persist = true) {
  autoInstallUpdates = Boolean(enabled);
  autoUpdater.autoDownload = autoInstallUpdates;
  // NEVER install-on-quit, regardless of preference. On-quit installs mostly
  // fire during Windows shutdown/reboot, where Windows kills the NSIS installer
  // mid-swap — leaving a half-updated install that can't start and a device
  // that's offline until a human reinstalls. The controlled path (idle
  // auto-restart via maybeInstallDownloadedUpdate + the relaunch watchdog)
  // is the only sanctioned way to apply an update.
  autoUpdater.autoInstallOnAppQuit = false;
  log.info(`[Updater] Automatic background updates ${autoInstallUpdates ? 'enabled' : 'disabled'}.`);
  if (persist) {
    // Store this under this Windows profile, not in the signed-in account. The
    // same account may be active on several PCs and every installation must
    // retain its own update policy and compare its own version with the feed.
    fs.writeFile(
      getDeviceUpdatePreferencePath(),
      JSON.stringify({ autoInstallUpdates }, null, 2),
      'utf8'
    ).catch((error: any) => log.warn(`[Updater] Failed to persist device update preference: ${error?.message || error}`));
  }
  return autoInstallUpdates;
}

function loadDeviceAutoUpdatePreference() {
  try {
    const stored = JSON.parse(readFileSync(getDeviceUpdatePreferencePath(), 'utf8'));
    if (typeof stored?.autoInstallUpdates === 'boolean') {
      applyAutoUpdatePreference(stored.autoInstallUpdates, false);
      log.info('[Updater] Loaded automatic-update preference for this device.');
    }
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      log.warn(`[Updater] Could not read device update preference; using enabled default: ${error?.message || error}`);
    }
  }
}

autoUpdater.autoDownload = false;
// See applyAutoUpdatePreference: on-quit installs race Windows shutdown and
// can brick the install; updates only apply through the controlled restart path.
autoUpdater.autoInstallOnAppQuit = false;
// Differential (blockmap) downloads are the #1 source of background update
// failures: they need the INSTALLED version's blockmap on the feed and a
// pristine updater cache, and fail with a generic error when either is off.
// A full download is ~137MB but succeeds every time — reliability wins.
(autoUpdater as any).disableDifferentialDownload = true;
autoUpdater.logger = log;
autoUpdater.setFeedURL({
  provider: 'generic',
  url: UPDATE_FEED_URL
});

const isMissingUpdateManifest = (err: any) => {
  const message = String(err?.message || err || '');
  return message.includes('latest.yml') && (message.includes('404') || message.includes('Not Found'));
};

// A stale/locked updater cache (left behind by manual installs or an aborted
// download) makes every background download fail with a generic error. Wiping
// it is always safe — the next download simply starts clean.
function clearUpdaterCache() {
  try {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return;
    const cacheDir = join(localAppData, `${app.getName()}-updater`);
    require('fs').rmSync(cacheDir, { recursive: true, force: true });
    log.info(`[Updater] Cleared updater cache at ${cacheDir}`);
  } catch (err: any) {
    log.warn('[Updater] Failed to clear updater cache:', err?.message || err);
  }
}

const isBackgroundUpdateInstallError = (err: any) => {
  const message = String(err?.message || err || '').toLowerCase();
  return (
    message.includes('background') ||
    message.includes('elevat') ||
    message.includes('permission') ||
    message.includes('access') ||
    message.includes('eperm') ||
    message.includes('eacces') ||
    message.includes('installer')
  );
};

const quotePowerShellArg = (value: string) => `'${value.replace(/'/g, "''")}'`;

function getDownloadedInstallerPath(info?: any) {
  const helper = (autoUpdater as any).downloadedUpdateHelper;
  return (
    info?.downloadedFile ||
    helper?.file ||
    helper?._file ||
    pendingDownloadedInstallerPath ||
    null
  );
}

// After quitAndInstall the app is gone. If NSIS then dies for ANY reason
// (locked file, AV kill, machine shutdown mid-install), nothing would ever
// restart Remote 365 and the device stays offline until a human logs in —
// the exact fleet failure this file exists to prevent. This detached cmd
// watchdog is the safety net: it outlives the app, waits out the installer,
// and if the app didn't come back it relaunches it; if the exe itself is
// gone (installer killed mid-swap) it re-runs the silent installer once.
// cmd.exe (not PowerShell) so client execution policies can't block it, and
// it runs from %TEMP% so it never holds a lock inside the install dir.
function spawnUpdateRelaunchWatchdog(installerPath: string | null) {
  if (process.platform !== 'win32') return;
  try {
    const exePath = app.getPath('exe');
    const exeName = basename(exePath);
    const setupPath = installerPath && existsSync(installerPath) ? installerPath : '';
    const setupName = setupPath ? basename(setupPath) : '';
    const lockPath = updateLockPath();
    const tmpDir = app.getPath('temp');
    // Unique name per arm: cmd reads batch files incrementally while they run,
    // so overwriting a still-running watchdog script would corrupt it mid-loop.
    // Stale copies self-delete when their loop ends.
    const scriptPath = join(tmpDir, `remote365-update-watchdog-${Date.now()}.cmd`);
    // ping (not timeout) for sleeps: with stdio 'ignore' the script's stdin is
    // NUL, and `timeout` errors out on redirected stdin — every wait would
    // become 0s and the watchdog would relaunch the app WHILE NSIS is still
    // swapping files, causing the very locked-file failure it exists to fix.
    const script = [
      '@echo off',
      'setlocal EnableExtensions',
      `set "APPEXE=${exePath}"`,
      `set "APPNAME=${exeName}"`,
      `set "SETUP=${setupPath}"`,
      `set "SETUPNAME=${setupName}"`,
      `set "LOCK=${lockPath}"`,
      'set /a TRIES=0',
      'set "RETRIED="',
      'rem ── Clear the stragglers that make the swap silently no-op ──────────',
      'rem quitAndInstall ends the main process, but Electron leaves renderer,',
      'rem GPU and utility children behind for a few seconds (and sometimes for',
      'rem good). They keep the exe and app.asar OPEN, so NSIS skips those files',
      'rem (customRemoveFiles deliberately tolerates locks rather than aborting),',
      'rem exits 0, and --force-run brings the OLD build back. Every recovery',
      'rem layer then reports success because a process is running. On PUREVOIP-4',
      'rem that scored 7 "successful" installs with ZERO files written; killing',
      'rem the leftovers first made the very next install swap cleanly. The',
      'rem installer is a different image name ("... Setup <ver>.exe"), so it is',
      'rem never a target here. NO /T: the installer is spawned as a CHILD of the',
      'rem main process, and a tree-kill while that process was still quitting',
      'rem took the installer down mid-swap — PUREVOIP-6 (Sep 2026) was left with',
      'rem an EMPTY install folder. Every Electron child shares the image name,',
      'rem so matching by name alone already catches all of them.',
      'ping -n 6 127.0.0.1 >nul 2>&1',
      'taskkill /F /IM "%APPNAME%" >nul 2>&1',
      'rem Second sweep, but only while the installer is still working — once it',
      'rem has finished, --force-run may legitimately have started the new build',
      'rem and killing that would just flap the machine.',
      'if not defined SETUPNAME goto headstart',
      'ping -n 9 127.0.0.1 >nul 2>&1',
      'tasklist /fi "IMAGENAME eq %SETUPNAME%" 2>nul | find /i "%SETUPNAME%" >nul',
      'if errorlevel 1 goto headstart',
      'taskkill /F /IM "%APPNAME%" >nul 2>&1',
      ':headstart',
      'rem Give the normal install+force-run path a full minute head start.',
      'ping -n 61 127.0.0.1 >nul 2>&1',
      ':watchloop',
      'set /a TRIES+=1',
      'rem ~30 checks x 20s = ~10 minutes of cover, then stand down.',
      'if %TRIES% gtr 30 goto done',
      'rem App back (force-run worked, or we restarted it)? Then stand down.',
      'tasklist /fi "IMAGENAME eq %APPNAME%" /fi "USERNAME eq %USERNAME%" 2>nul | find /i "%APPNAME%" >nul',
      'if not errorlevel 1 goto done',
      'rem Update lock still held? The app is deliberately down while NSIS swaps',
      'rem $INSTDIR. Relaunching here would relock the exe and app.asar and the',
      'rem install would silently no-op (see updateGuard.ts). Wait it out — but',
      'rem only for ~5 min of the 10-min budget, so a lock left behind by a dead',
      'rem installer can never keep this machine offline.',
      'if not exist "%LOCK%" goto nolock',
      'if %TRIES% leq 15 goto wait',
      'del "%LOCK%" >nul 2>&1',
      ':nolock',
      'rem Installer still busy? Never race it — just keep waiting.',
      'if not defined SETUPNAME goto appgone',
      'tasklist /fi "IMAGENAME eq %SETUPNAME%" 2>nul | find /i "%SETUPNAME%" >nul',
      'if not errorlevel 1 goto wait',
      ':appgone',
      'if not exist "%APPEXE%" goto reinstall',
      'start "" "%APPEXE%" --hidden',
      'goto wait',
      ':reinstall',
      'rem Exe missing: the swap was interrupted. The SILENT run just failed on',
      'rem this machine, so re-run the installer once WITH its window (one-click,',
      'rem no input needed) - on PUREVOIP-6 that is the run that lands.',
      'if defined RETRIED goto wait',
      'if not defined SETUP goto wait',
      'if not exist "%SETUP%" goto wait',
      'set "RETRIED=1"',
      'rem A crashed installer parked under Windows Error Reporting (PUREVOIP-6:',
      'rem access violation in the NSIS System plugin) keeps the setup mutex, and',
      'rem every new installer aborts with exit 2 until it is gone.',
      'taskkill /F /IM "Remote 365 Setup*" >nul 2>&1',
      'start "" "%SETUP%" --force-run',
      'goto wait',
      ':wait',
      'ping -n 21 127.0.0.1 >nul 2>&1',
      'goto watchloop',
      ':done',
      'del "%~dpn0.vbs" >nul 2>&1',
      'endlocal',
      '(goto) 2>nul & del "%~f0"',
      '',
    ].join('\r\n');
    writeFileSync(scriptPath, script, 'utf8');
    // Launch through wscript (a GUI-subsystem exe) with window style 0. The
    // old direct spawn ran cmd DETACHED, i.e. console-less — so the first
    // console child it spawned (`ping`, our sleep) allocated a fresh VISIBLE
    // console, and on Windows-Terminal-default machines that was a black
    // terminal titled "ping -n 61 127.0.0.1" parked on screen during every
    // update (fleet report, Jul 2026). Via wscript the cmd OWNS a hidden
    // console and every child inherits it — nothing can ever appear,
    // regardless of the machine's default terminal. The script deletes its
    // .vbs twin at :done, then itself.
    const vbsPath = scriptPath.replace(/\.cmd$/, '.vbs');
    writeFileSync(vbsPath, `CreateObject("WScript.Shell").Run """${scriptPath}""", 0, False\r\n`, 'utf8');
    const child = spawn('wscript.exe', ['//B', '//Nologo', vbsPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    log.info(`[Updater] Relaunch watchdog armed (hidden via wscript): ${scriptPath}`);
  } catch (err: any) {
    // The watchdog is belt-and-braces; never let it block the update itself.
    log.warn('[Updater] Failed to arm relaunch watchdog:', err?.message || err);
  }
}

// ── Permanent keep-alive (per-user Scheduled Task) ──────────────────────────
// The relaunch watchdog above only covers ~10 minutes around one install.
// Fleet reality (Jul 2026): devices still went offline after updates — the
// installer stalled past that window, or the app died later — and every one
// needed a human at the machine to reopen Remote 365. This is the permanent,
// updater-independent layer: a per-user Scheduled Task (created with plain
// user rights, no UAC) fires every 5 minutes and relaunches the app into the
// tray if it is not running, whatever killed it. The scripts live in
// userData, OUTSIDE the install dir, so a version swap never touches them
// and they never hold a lock NSIS would trip over. The task:
//   - does nothing while the app is running (per-user tasklist check);
//   - never races a LIVE update (skips while a "Remote 365 Setup" runs), but a
//     setup that lingers ~30 min with the app dead is a HUNG installer — real
//     installs finish in seconds. It gets killed and the app relaunched, so a
//     wedged update can no longer strand a machine offline (fleet report,
//     Jul 2026: one PC went offline on every update attempt);
//   - respects intent: gated on the "keep running in background" setting and
//     deleted on an explicit tray Quit (re-armed on the next launch).
const KEEPALIVE_TASK_NAME = `Remote365 KeepAlive (${(process.env.USERNAME || 'user').replace(/[^A-Za-z0-9._-]/g, '_')})`;

function removeKeepAliveTask(reason: string) {
  if (process.platform !== 'win32') return;
  try {
    // Detached: must be able to finish after app.quit() on the tray-Quit path.
    const child = spawn('schtasks.exe', ['/Delete', '/F', '/TN', KEEPALIVE_TASK_NAME], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    log.info(`[KeepAlive] Task removal requested (${reason}).`);
  } catch (err: any) {
    log.warn('[KeepAlive] Failed to remove task:', err?.message || err);
  }
}

function ensureKeepAliveTask() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  // The pre-logon instance runs as SYSTEM and is owned by Remote365InputSvc,
  // which starts and stops it. It must never register a per-user task (that
  // would land under the SYSTEM profile and fight the service for control).
  if (isPreLogonHost) return;
  if (!advancedFlags.keepRunning) {
    // "Keep running after closing" is off — this install is not meant to be
    // resident, so it must not resurrect either. Applies to BOTH recovery
    // layers: the task below and the service's supervision.
    setAppSupervision(false);
    removeKeepAliveTask('keepRunning disabled');
    return;
  }
  // Tell the service it may relaunch us. This is the layer that still works
  // when the Scheduled Task below cannot be created at all.
  setAppSupervision(true);
  try {
    const exePath = app.getPath('exe');
    const exeName = basename(exePath);
    const dir = app.getPath('userData');
    const cmdPath = join(dir, 'remote365-keepalive.cmd');
    const vbsPath = join(dir, 'remote365-keepalive.vbs');
    const stuckPath = join(dir, 'remote365-keepalive.stuck');
    const reinstallPath = join(dir, 'remote365-keepalive.reinstall');
    const lockPath = updateLockPath();
    const script = [
      '@echo off',
      'setlocal EnableExtensions',
      `set "APPEXE=${exePath}"`,
      `set "APPNAME=${exeName}"`,
      `set "STUCK=${stuckPath}"`,
      `set "REINST=${reinstallPath}"`,
      `set "SILENTBAD=${SILENT_INSTALL_UNRELIABLE_PATH()}"`,
      'set "UPDCACHE=%LOCALAPPDATA%\\remote-365-updater"',
      'set "PENDING=%LOCALAPPDATA%\\remote-365-updater\\pending"',
      `set "LOCK=${lockPath}"`,
      'rem Already running for this user? Nothing to do.',
      'tasklist /fi "IMAGENAME eq %APPNAME%" /fi "USERNAME eq %USERNAME%" 2>nul | find /i "%APPNAME%" >nul',
      'if not errorlevel 1 goto reset',
      'rem An update is mid-flight — never launch into a file swap. Relaunching',
      'rem here relocks Remote 365.exe/app.asar, NSIS then skips every locked',
      'rem file and the machine silently stays on the OLD build (PUREVOIP-4 did',
      'rem this 7 installs in a row, Aug 2026).',
      'rem',
      'rem The lock file is authoritative: the app writes it before it quits, so',
      'rem it covers the whole window INCLUDING the gap before the setup process',
      'rem exists — which the tasklist check below is blind to. The tasklist',
      'rem check stays as a second signal for installs started outside the app.',
      'if exist "%LOCK%" goto busy',
      'tasklist 2>nul | find /i "Remote 365 Setup" >nul',
      'if errorlevel 1 goto launch',
      ':busy',
      'rem Real installs finish in seconds, so a signal still here with the app',
      'rem dead means a wedged installer or a lock left behind by one. Waiting',
      'rem forever would keep the machine offline until a human visited, so count',
      'rem consecutive sightings (one per 5-min run) and on the 6th (~30 min)',
      'rem break the lock, kill the wedged setup and bring the app back.',
      'set /a CNT=0',
      'if exist "%STUCK%" set /p CNT=<"%STUCK%"',
      'set /a CNT+=1',
      'if %CNT% geq 6 goto killstuck',
      '>"%STUCK%" echo %CNT%',
      'goto done',
      ':killstuck',
      'taskkill /f /im "Remote 365 Setup*" >nul 2>&1',
      'del "%LOCK%" >nul 2>&1',
      ':launch',
      'del "%STUCK%" >nul 2>&1',
      'if exist "%APPEXE%" goto run',
      'rem The exe is GONE. An update was interrupted between the old build being',
      'rem removed and the new one being written (PUREVOIP-6, Sep 2026: install',
      'rem folder empty, the new installer still sitting fully downloaded in',
      'rem pending). Nothing else can recover that state - this task and the',
      'rem service supervisor both need an exe to launch - so re-run the newest',
      'rem downloaded installer silently, at most 3 times, and let --force-run',
      'rem bring the app back. The counter resets once the app is seen running.',
      'set /a RCNT=0',
      'if exist "%REINST%" set /p RCNT=<"%REINST%"',
      'if %RCNT% geq 3 goto done',
      'set "SETUP="',
      'for /f "delims=" %%F in (\'dir /b /o-d "%PENDING%\\Remote 365 Setup *.exe" 2^>nul\') do if not defined SETUP set "SETUP=%PENDING%\\%%F"',
      'if not defined SETUP if exist "%UPDCACHE%\\installer.exe" set "SETUP=%UPDCACHE%\\installer.exe"',
      'if not defined SETUP goto done',
      'set /a RCNT+=1',
      '>"%REINST%" echo %RCNT%',
      'rem First retry silently. If that still leaves no exe, the silent path is',
      'rem what is broken on this machine (PUREVOIP-6: silent /S exits in seconds',
      'rem writing nothing, the same installer run with its window succeeds), so',
      'rem the later retries run VISIBLY. One-click needs no clicks; a progress',
      'rem window on a signed-in desktop beats a host that stays offline.',
      'rem Visible install (no /S) on retries, and from the FIRST attempt on a',
      'rem machine marked "silent installs crash here" (SILENTBAD, see main).',
      'rem Before a visible run, clear any installer parked under Windows Error',
      'rem Reporting: it holds the setup mutex and makes the next one abort (exit 2).',
      'set "VIS="',
      'if %RCNT% geq 2 set "VIS=1"',
      'if exist "%SILENTBAD%" set "VIS=1"',
      'if defined VIS taskkill /F /IM "Remote 365 Setup*" >nul 2>&1',
      'if defined VIS (start "" "%SETUP%" --force-run) else (start "" "%SETUP%" /S --force-run)',
      'goto done',
      ':run',
      'del "%REINST%" >nul 2>&1',
      'start "" "%APPEXE%" --hidden',
      'goto done',
      ':reset',
      'del "%STUCK%" >nul 2>&1',
      'del "%REINST%" >nul 2>&1',
      ':done',
      'endlocal',
      '',
    ].join('\r\n');
    writeFileSync(cmdPath, script, 'utf8');
    // wscript wrapper runs the check with window style 0 — without it the
    // task would flash a console window on the user's screen every 5 minutes.
    writeFileSync(vbsPath, `CreateObject("WScript.Shell").Run """${cmdPath}""", 0, False\r\n`, 'utf8');
    const child = spawn('schtasks.exe', [
      '/Create', '/F',
      '/TN', KEEPALIVE_TASK_NAME,
      '/SC', 'MINUTE', '/MO', '5',
      '/TR', `wscript.exe "${vbsPath}"`,
    ], { stdio: 'ignore', windowsHide: true });
    child.on('close', (code: number | null) => {
      if (code === 0) log.info(`[KeepAlive] Task armed: ${KEEPALIVE_TASK_NAME} (every 5 min).`);
      else {
        log.warn(`[KeepAlive] schtasks /Create exited ${code} — trying the Task Scheduler API instead.`);
        armKeepAliveViaTaskScheduler(vbsPath);
      }
    });
    child.on('error', (err: any) => {
      log.warn('[KeepAlive] schtasks spawn failed:', err?.message || err);
      armKeepAliveViaTaskScheduler(vbsPath);
    });
  } catch (err: any) {
    // Keep-alive is a safety net; its failure must never affect the app.
    log.warn('[KeepAlive] Failed to arm task:', err?.message || err);
  }
}

// Fallback for machines where schtasks.exe itself is blocked. PUREVOIP-4 (Aug
// 2026) logged `[KeepAlive] Failed to arm task: spawn EPERM` on every launch
// and `schtasks /Create` returned "Access is denied" — an AV/EDR rule, since
// the same user creating the same task through the Task Scheduler API behind
// the ScheduledTasks module succeeded immediately. Losing this task is what
// leaves a machine offline after a failed update, so it is worth a second try
// down a different code path rather than giving up on the whole safety net.
function armKeepAliveViaTaskScheduler(vbsPath: string) {
  if (process.platform !== 'win32') return;
  try {
    // Single-quoted PowerShell literals: double any embedded quote so a user
    // profile like C:\Users\O'Brien cannot break (or inject into) the script.
    const psLiteral = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const script = [
      `$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + ${psLiteral(vbsPath)} + '"')`,
      `$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)`,
      `Register-ScheduledTask -TaskName ${psLiteral(KEEPALIVE_TASK_NAME)} -Action $a -Trigger $t -Force | Out-Null`,
    ].join('; ');
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('close', (code: number | null) => {
      if (code === 0) log.info(`[KeepAlive] Task armed via Task Scheduler API: ${KEEPALIVE_TASK_NAME} (every 5 min).`);
      else log.warn(`[KeepAlive] Task Scheduler API fallback exited ${code} — keep-alive not armed. The input service still supervises this app.`);
    });
    child.on('error', (err: any) => log.warn('[KeepAlive] Task Scheduler API fallback failed:', err?.message || err));
  } catch (err: any) {
    log.warn('[KeepAlive] Task Scheduler API fallback threw:', err?.message || err);
  }
}

function launchDownloadedInstallerWithWindowsPrompt(reason: string) {
  if (process.platform !== 'win32') return false;

  const installerPath = getDownloadedInstallerPath(pendingDownloadedUpdateInfo);
  if (!installerPath || !existsSync(installerPath)) {
    log.warn(`[Updater] Cannot launch installer fallback (${reason}); downloaded installer path is unavailable.`);
    return false;
  }

  log.info(`[Updater] Launching downloaded installer with Windows permission prompt (${reason}): ${installerPath}`);
  isInstallingUpdate = true;

  try {
    // Count this like any other attempt so the loop guard reflects reality: if
    // even an elevated install fails to move the version, the next boot logs it
    // instead of silently believing the update succeeded.
    noteUpdateInstallAttempt(String(pendingDownloadedUpdateInfo?.version || ''));
    // Same contract as the silent path: the recovery layers must know this app
    // is down on purpose, or they relaunch it into the elevated install too.
    armUpdateLock(String(pendingDownloadedUpdateInfo?.version || ''));
    spawnUpdateRelaunchWatchdog(installerPath);
    const script = [
      'Start-Process',
      '-FilePath',
      quotePowerShellArg(installerPath),
      '-ArgumentList',
      // --force-run relaunches the app after the silent install, so the machine
      // comes back online instead of staying quit (the PureVoip-7 failure).
      quotePowerShellArg('/S --force-run'),
      '-Verb',
      'RunAs',
    ].join(' ');
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    setTimeout(() => app.quit(), 500);
    return true;
  } catch (err: any) {
    log.error('[Updater] Failed to launch installer fallback:', err?.message || err);
    isInstallingUpdate = false;
    return false;
  }
}

function installDownloadedUpdate(trigger: string) {
  const userInitiated = trigger === 'manual';
  if (updateInstallLaunchTimer) return true;

  // Repeat offender: this version has already been "installed" here more than
  // once and the app still came back on the old build, so the silent per-user
  // install cannot win on this machine (a service, an AV lock, or a relaunch
  // mid-swap). Running it again would no-op again. When the user is the one
  // asking, escalate to the elevated installer — they are at the machine to
  // approve the prompt, and elevation is what finally landed the swap on
  // PUREVOIP-4. Background triggers never take this path: an unattended host
  // must not quit into a UAC prompt nobody will answer.
  if (userInitiated && hasFailedUpdateSwap(pendingDownloadedUpdateInfo?.version)) {
    log.warn(`[Updater] ${pendingDownloadedUpdateInfo?.version} has been installed here before without taking effect — escalating to an elevated install.`);
    if (launchDownloadedInstallerWithWindowsPrompt('stuck-version-escalation')) return true;
    log.warn('[Updater] Elevated escalation could not start; falling back to the normal install path.');
  }

  isInstallingUpdate = true;

  // Ask the stream worker to stop FFmpeg while Electron is still alive, then
  // give it a bounded window to close stdout/stdin and release resources\ffmpeg.exe.
  // Calling quitAndInstall immediately raced before-quit's hard worker teardown
  // on slower machines and left an orphaned FFmpeg process locking $INSTDIR.
  log.info(`[Updater] Preparing child processes for update installation (${trigger}).`);
  stopStreaming();
  input.shutdown();

  updateInstallLaunchTimer = setTimeout(() => {
    updateInstallLaunchTimer = null;
    // The worker has had time to process its graceful `stop` message. It is now
    // safe to terminate the idle utility process before NSIS removes the app.
    stopStreamWorker();
    // Record the attempt BEFORE the app quits: if this build boots again
    // still running the old version, the loop guard counts it and eventually
    // stops the install→relaunch cycle (see isUpdateInstallLooping).
    noteUpdateInstallAttempt(String(pendingDownloadedUpdateInfo?.version || ''));
    // Tell the keep-alive task and the watchdog that this app is about to be
    // down ON PURPOSE. Without it they see only "app is dead", relaunch it into
    // the middle of the file swap, and the install silently no-ops on the
    // locked files (see updateGuard.ts). Must be armed BEFORE the app quits.
    armUpdateLock(String(pendingDownloadedUpdateInfo?.version || ''));
    // Armed BEFORE quitAndInstall: once the app quits, only this watchdog can
    // bring the machine back online if the installer fails or is killed.
    spawnUpdateRelaunchWatchdog(getDownloadedInstallerPath(pendingDownloadedUpdateInfo));
    try {
      // A version this machine already tried to install silently and came
      // back without is installed VISIBLY the next time: same one-click
      // installer, no /S, so a progress window shows and any NSIS error box
      // is seen instead of silently defaulting to "cancel" (PUREVOIP-6, Sep
      // 2026: silent run exits in seconds writing nothing; visible run lands).
      const silent = !hasAttemptedUpdateSwap(pendingDownloadedUpdateInfo?.version) && !silentInstallUnreliable();
      if (!silent) log.warn(`[Updater] ${silentInstallUnreliable() ? 'Silent installs are marked unreliable on this machine' : `${pendingDownloadedUpdateInfo?.version} was already attempted silently here`} — installing with the installer window visible.`);
      // A crashed installer from an earlier attempt can be parked under
      // Windows Error Reporting holding the setup's single-instance mutex
      // (PUREVOIP-6, Sep 2026); the new one would abort with exit 2 before
      // writing a byte. Clear it first — nothing healthy is installing while
      // this app is still running.
      try { execSync('taskkill /F /IM "Remote 365 Setup*" /T', { windowsHide: true, stdio: 'ignore' }); } catch { /* none running */ }
      autoUpdater.quitAndInstall(silent, true);
      // quitAndInstall spawns the installer as OUR child and then asks Electron
      // to quit. If that quit stalls (on PUREVOIP-6 a window-teardown timer
      // threw "Object has been destroyed" and the process was still alive a
      // second later), we are still the installer's parent when the relaunch
      // watchdog sweeps app processes — and taking the parent down took the
      // installer with it, mid-swap. Make sure the parent is gone well before
      // that sweep (~6s) whatever the quit path does.
      setTimeout(() => {
        log.warn('[Updater] Still alive 3s after quitAndInstall — forcing exit so the installer runs on its own.');
        app.exit(0);
      }, 3000);
    } catch (err: any) {
      log.error(`[Updater] Silent install failed (${trigger}):`, err?.message || err);
      // The elevated-installer fallback quits the app and waits on a UAC prompt.
      // That is fine when the user just clicked "Restart to update" (they're at
      // the machine to approve it) but must NEVER run for a background install:
      // on an unattended host the app would quit into a prompt nobody answers
      // and the machine drops offline until someone logs in.
      if (userInitiated && isBackgroundUpdateInstallError(err) && launchDownloadedInstallerWithWindowsPrompt(`${trigger}: ${err?.message || err}`)) {
        return;
      }
      isInstallingUpdate = false;
      if (userInitiated) {
        mainWindow?.webContents.send(
          'update:error',
          'Remote365 could not start the installer. Close Remote365 and try the update again.'
        );
      } else {
        // Bounded retries: a machine where the installer can never start must
        // not churn through install→fail cycles forever. After 3 strikes the
        // update waits for the next app launch (or a manual click) instead.
        backgroundInstallFailureCount += 1;
        if (backgroundInstallFailureCount >= 3) {
          silentUpdateReady = false;
          log.warn('[Updater] Background install failed 3 times; deferring this update to the next app launch.');
        } else {
          log.warn('[Updater] Background install failed; the 120s idle loop will retry the install.');
        }
      }
    }
  }, 1_500);

  return true;
}

const readYamlScalar = (manifest: string, key: string) => {
  const match = manifest.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
};

const readYamlBlock = (manifest: string, key: string) => {
  const match = manifest.match(new RegExp(`^${key}:\\s*[|>]\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\S|$)`, 'm'));
  if (!match) return null;
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^ {2}/, '').trimEnd())
    .join('\n')
    .trim();
};

ipcMain.handle('update:getLatestInfo', async () => {
  const latestUrl = `${UPDATE_FEED_URL.replace(/\/+$/, '')}/latest.yml`;
  try {
    const response = await fetch(latestUrl, { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) return { feedUrl: latestUrl, available: false, error: 'No update manifest is published yet.' };
      throw new Error(`Manifest request failed with ${response.status}`);
    }
    const manifest = await response.text();
    const releaseNotes = readYamlBlock(manifest, 'releaseNotes') || readYamlScalar(manifest, 'releaseNotes');
    return {
      feedUrl: latestUrl,
      available: true,
      version: readYamlScalar(manifest, 'version'),
      releaseDate: readYamlScalar(manifest, 'releaseDate'),
      releaseName: readYamlScalar(manifest, 'releaseName'),
      releaseNotes,
    };
  } catch (err: any) {
    log.warn('[Updater] Failed to read latest update metadata:', err?.message || err);
    return {
      feedUrl: latestUrl,
      available: false,
      error: err?.message || 'Unable to read update metadata.',
    };
  }
});

let updateCheckInFlight = false;
let updateCheckInterval: NodeJS.Timeout | null = null;

async function checkForDesktopUpdates() {
  if (updateCheckInFlight) return null;
  updateCheckInFlight = true;
  try {
    return await autoUpdater.checkForUpdates();
  } finally {
    updateCheckInFlight = false;
  }
}

ipcMain.handle('update:check', async (_event: any, manual: boolean = false) => {
  // A manual "Check for updates" opens the error window; the 60s background poll
  // (manual omitted) stays silent so a half-published feed never nags.
  if (manual) lastUserUpdateActionAt = Date.now();
  try {
    const result = await checkForDesktopUpdates();
    // checkForUpdates() resolves to an UpdateCheckResult that carries a
    // CancellationToken and a downloadPromise — neither survives structured
    // clone across the IPC boundary, which throws "An object could not be
    // cloned" in the renderer. The banner/settings only need the plain update
    // info (the real UI is driven by the update:* events), so return a
    // serializable summary instead of the raw result.
    const info: any = result?.updateInfo;
    if (!info?.version) return { available: false };
    return {
      available: true,
      version: info.version ?? null,
      releaseDate: info.releaseDate ?? null,
      releaseName: info.releaseName ?? null,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    };
  } catch (err) {
    if (isMissingUpdateManifest(err)) {
      log.warn('[Updater] No latest.yml manifest is published yet. Skipping update banner.');
      return { available: false };
    }
    throw err;
  }
});
ipcMain.handle('update:download', async () => {
  // Always user-initiated (banner "Update now" / settings "Download update"),
  // so download failures are allowed to surface an error to the user.
  lastUserUpdateActionAt = Date.now();
  if (isDownloadingUpdate || silentUpdateReady) return null;
  isDownloadingUpdate = true;
  try {
    return await autoUpdater.downloadUpdate();
  } finally {
    isDownloadingUpdate = false;
  }
});
ipcMain.handle('update:quitAndInstall', () => {
  // Silent install (/S): the app is already installed, so re-running the NSIS
  // wizard on every update only makes the user click through it again. The
  // installer keeps the existing install dir/settings; true,true = silent + relaunch.
  return installDownloadedUpdate('manual');
});
ipcMain.handle('update:getAutoInstall', () => autoInstallUpdates);
ipcMain.handle('update:setAutoInstall', (_event: any, enabled: any) => {
  return applyAutoUpdatePreference(Boolean(enabled));
});

autoUpdater.on('update-available', (info: any) => {
  log.info('[Updater] Update available:', info.version);
  if (autoInstallUpdates) {
    log.info('[Updater] Auto-update is enabled. Downloading in background.');
    mainWindow?.webContents.send('update:auto-available', info);
    if (!isDownloadingUpdate && !silentUpdateReady) {
      isDownloadingUpdate = true;
      autoUpdater.downloadUpdate().catch((err: any) => {
        // First failure is almost always a poisoned updater cache — wipe it
        // and retry once before bothering the user.
        log.error('[Updater] Background download failed, clearing cache and retrying:', err);
        clearUpdaterCache();
        return autoUpdater.downloadUpdate().catch((retryErr: any) => {
          // Background retry failed — almost always a still-in-progress publish
          // (exe not fully uploaded). Log it and let the next 60s poll retry;
          // never surface it as an error banner. sendUpdateErrorToUi swallows
          // this unless the user just triggered an update action.
          log.error('[Updater] Background download failed after cache clear (will retry on next poll):', retryErr);
          const detail = String(retryErr?.message || retryErr || '').slice(0, 160);
          sendUpdateErrorToUi(`Unable to download update in the background.${detail ? ` (${detail})` : ''}`);
        });
      }).finally(() => {
        isDownloadingUpdate = false;
      });
    }
    return;
  }
  mainWindow?.webContents.send('update:available', info);
});

autoUpdater.on('update-not-available', (info: any) => {
  log.info('[Updater] Update not available:', info.version);
  mainWindow?.webContents.send('update:not-available');
});

autoUpdater.on('download-progress', (progressObj: any) => {
  if (!autoInstallUpdates) mainWindow?.webContents.send('update:download-progress', progressObj);
});

// ── Update-install loop breaker ─────────────────────────────────────────────
// The v1.2.56 installer tolerates locked files so a bad swap can't brick a
// machine — but on hosts where security software pins the old exe (stuck
// processes observed on the PureVoip fleet), the "successful" install leaves
// the OLD version on disk. The app then relaunches, sees the same update,
// downloads, restarts… an endless install→relaunch loop that keeps the device
// offline and visibly "restarting again and again". Persist attempts per
// target version: after two installs of a version that is provably not
// taking effect, pause auto-installing it for 24h (a manual "Restart to
// update" click or a reboot still works, and usually clears the lock).
// How many fresh boots may each earn one extra automatic install attempt for a
// version the loop guard has already given up on.
const UPDATE_BOOT_RETRY_MAX = 3;
const UPDATE_ATTEMPTS_PATH = () => join(app.getPath('userData'), 'update-install-attempts.json');
// Marker: on this machine the SILENT installer has crashed/hung before and a
// visible run is what landed (PUREVOIP-6: access violation in the NSIS System
// plugin, then parked under Windows Error Reporting). Once set, every install
// here runs with the installer window from the first attempt — the app, the
// keep-alive retries and the hosted repair script all honour it.
const SILENT_INSTALL_UNRELIABLE_PATH = () => join(app.getPath('userData'), 'silent-install-unreliable');
function silentInstallUnreliable(): boolean {
  try { return existsSync(SILENT_INSTALL_UNRELIABLE_PATH()); } catch { return false; }
}
function markSilentInstallUnreliable(why: string): void {
  try {
    writeFileSync(SILENT_INSTALL_UNRELIABLE_PATH(), `${new Date().toISOString()} ${why}\r\n`, 'utf8');
    log.warn(`[Updater] Marked this machine as "silent installs unreliable": ${why}. Future installs run with the installer window visible.`);
  } catch (err: any) {
    log.warn('[Updater] Could not write the silent-install marker:', err?.message || err);
  }
}
const UPDATE_LOOP_MAX_ATTEMPTS = 2;
const UPDATE_LOOP_RETRY_MS = 24 * 60 * 60 * 1000;
let updateLoopWarned = false;

function readUpdateAttempts(): { target?: string; attempts?: number; at?: number; bootRetries?: number } {
  try { return JSON.parse(readFileSync(UPDATE_ATTEMPTS_PATH(), 'utf8')) || {}; } catch { return {}; }
}
function noteUpdateInstallAttempt(target: string) {
  if (!target) return;
  const prev = readUpdateAttempts();
  const sameTarget = prev.target === target;
  const attempts = sameTarget ? (Number(prev.attempts) || 0) + 1 : 1;
  // Carry the boot-retry budget forward: resetting it on every attempt would
  // let a permanently-locked machine retry on every boot forever.
  const bootRetries = sameTarget ? (Number((prev as any).bootRetries) || 0) : 0;
  try { writeFileSync(UPDATE_ATTEMPTS_PATH(), JSON.stringify({ target, attempts, at: Date.now(), bootRetries })); } catch { }
}
function clearUpdateAttemptsIfSwapped() {
  const prev = readUpdateAttempts();
  if (!prev.target) return;
  if (prev.target === app.getVersion()) {
    // The swap took effect — this build IS the attempted version. Clean slate.
    // Two or more attempts means the silent first try did NOT land and a
    // later (visible) one did: remember that so the next update skips the
    // silent try altogether on this machine.
    if ((Number(prev.attempts) || 0) >= 2 && !silentInstallUnreliable()) {
      markSilentInstallUnreliable(`${prev.target} needed ${prev.attempts} attempts; the silent install did not take`);
    }
    try { writeFileSync(UPDATE_ATTEMPTS_PATH(), '{}'); } catch { }
    return;
  }

  const attempts = Number(prev.attempts) || 0;
  // Report the FIRST failed swap, not just the second. This used to warn only
  // once the loop guard had already tripped, so the single most diagnostic
  // fact — "we installed X and came back as Y" — was invisible exactly when it
  // would have been cheapest to act on. PUREVOIP-4 reached seven silent
  // failures before anyone could see one.
  log.warn(`[Updater] Update did not take effect: installed ${prev.target} ${attempts}x, still running ${app.getVersion()}. Something is pinning the old files in the install folder.`);

  // A reboot releases the locks that pin $INSTDIR (that is why "reboot then
  // install" is the manual remedy). Booting is therefore new evidence, not a
  // repeat of the same doomed attempt, so let a rebooted machine try again
  // instead of sitting out the full 24h. Bounded to a few boots so a machine
  // with a permanent locker cannot go back to flapping offline — the failure
  // mode the loop guard was added to stop.
  const bootRetries = Number((prev as any).bootRetries) || 0;
  // Only a REAL boot is new evidence. Every relaunch by the keep-alive task or
  // the service supervisor lands here too, and PUREVOIP-5 burned all three
  // "boot" retries in six minutes of restart-looping on 1.2.103 (Sep 4 2026)
  // without ever rebooting. Fifteen minutes of uptime is comfortably "just
  // booted" and comfortably not a relaunch on a machine that has been up.
  const freshBoot = os.uptime() < 15 * 60;
  if (attempts >= UPDATE_LOOP_MAX_ATTEMPTS && bootRetries < UPDATE_BOOT_RETRY_MAX && freshBoot) {
    try {
      writeFileSync(UPDATE_ATTEMPTS_PATH(), JSON.stringify({
        target: prev.target,
        attempts: UPDATE_LOOP_MAX_ATTEMPTS - 1,
        at: Date.now(),
        bootRetries: bootRetries + 1,
      }));
      log.info(`[Updater] Fresh boot — allowing one more automatic install of ${prev.target} (boot retry ${bootRetries + 1}/${UPDATE_BOOT_RETRY_MAX}).`);
    } catch { /* the guard simply stays as it was */ }
    return;
  }

  if (attempts >= UPDATE_LOOP_MAX_ATTEMPTS) {
    log.warn(`[Updater] Auto-install of ${prev.target} is paused (${bootRetries} boot retries used). Run the hosted fixer or reinstall manually to clear it.`);
  }
}
// True when this machine has repeatedly "installed" a version that never took
// effect. The silent per-user install is demonstrably not working here, so the
// next user-initiated attempt escalates instead of repeating the same no-op.
// One earlier attempt at this version that did not take: enough to stop
// repeating the silent install and show the installer window instead.
// (noteUpdateInstallAttempt for the CURRENT attempt runs before this check,
// so "1" here means the previous attempt, not this one.)
function hasAttemptedUpdateSwap(target: string | undefined | null): boolean {
  if (!target) return false;
  if (String(target) === app.getVersion()) return false;
  const prev = readUpdateAttempts();
  if (prev.target !== String(target)) return false;
  return (Number(prev.attempts) || 0) >= 2;
}
function hasFailedUpdateSwap(target: string | undefined | null): boolean {
  if (!target) return false;
  if (String(target) === app.getVersion()) return false;
  const prev = readUpdateAttempts();
  if (prev.target !== String(target)) return false;
  return (Number(prev.attempts) || 0) >= UPDATE_LOOP_MAX_ATTEMPTS;
}
function isUpdateInstallLooping(target: string | undefined | null): boolean {
  if (!target) return false;
  const prev = readUpdateAttempts();
  if (prev.target !== String(target)) return false;
  if ((Number(prev.attempts) || 0) < UPDATE_LOOP_MAX_ATTEMPTS) return false;
  if (Date.now() - (Number(prev.at) || 0) > UPDATE_LOOP_RETRY_MS) return false; // window expired — one fresh try
  if (!updateLoopWarned) {
    updateLoopWarned = true;
    log.warn(`[Updater] Install loop guard active: ${target} keeps not taking effect on this machine. Staying on ${app.getVersion()} instead of restart-looping; will retry in 24h.`);
  }
  return true;
}

// A silent auto-install quits and relaunches the app, which would drop a live
// remote session. Block the immediate install while this machine is hosting a
// viewer (peerConnection is set for the whole signaling+connected lifetime) or
// the user is viewing another device in the viewer shell; the install re-runs
// when the session ends (see maybeInstallDownloadedUpdate callers) and always
// falls back to autoInstallOnAppQuit.
function isUpdateInstallBlockedBySession() {
  if (hostViewerPeers.size > 0 || peerConnection) return true;
  if (viewerShellWindow && !viewerShellWindow.isDestroyed()) return true;
  return false;
}

// The ONLY thing that defers an auto-restart is an active remote session
// (dropping a live session is never acceptable); the install then runs the
// moment the session ends. Everything else restarts automatically as soon as
// the download is ready — the banner announces "Restarting…" instead of
// waiting for a manual "Restart to update" click.
let idleInstallInterval: NodeJS.Timeout | null = null;
function ensureIdleInstallLoop() {
  if (idleInstallInterval) return;
  idleInstallInterval = setInterval(() => {
    if (!silentUpdateReady || !autoInstallUpdates || isInstallingUpdate) return;
    maybeInstallDownloadedUpdate('catch-up-poll');
  }, 120_000);
}

function maybeInstallDownloadedUpdate(trigger: string) {
  if (!autoInstallUpdates || !silentUpdateReady || isInstallingUpdate) return false;
  if (isUpdateInstallLooping(pendingDownloadedUpdateInfo?.version)) return false;
  if (isUpdateInstallBlockedBySession()) {
    log.info(`[Updater] Update ${pendingDownloadedUpdateInfo?.version || ''} is ready but a remote session is active (${trigger}). Restarting when the session ends.`);
    return false;
  }
  log.info(`[Updater] Restarting to install the downloaded update (${trigger}).`);
  mainWindow?.webContents.send('update:restarting', { seconds: 0, version: pendingDownloadedUpdateInfo?.version || '' });
  return installDownloadedUpdate(trigger);
}

// Give a reconnecting viewer a moment to re-establish before treating a
// session teardown as "idle" and restarting the app for the update.
function scheduleDeferredUpdateInstall(trigger: string) {
  if (!autoInstallUpdates || !silentUpdateReady || isInstallingUpdate) return;
  setTimeout(() => maybeInstallDownloadedUpdate(trigger), 5000);
}

autoUpdater.on('update-downloaded', (info: any) => {
  log.info('[Updater] Update downloaded:', info.version);
  pendingDownloadedUpdateInfo = info;
  pendingDownloadedInstallerPath = getDownloadedInstallerPath(info);
  silentUpdateReady = true;
  const sessionActive = isUpdateInstallBlockedBySession();
  mainWindow?.webContents.send('update:downloaded', { ...info, sessionActive });
  if (!autoInstallUpdates) return;
  if (isUpdateInstallLooping(info?.version)) {
    // This machine keeps "installing" this version without the swap taking
    // effect — don't announce a restart that the loop guard will refuse.
    return;
  }
  ensureIdleInstallLoop();
  if (sessionActive) {
    // Never drop a live session — the session-end hook restarts the app then.
    log.info('[Updater] Update downloaded mid-session; restarting when the session ends.');
    return;
  }
  // Auto-restart with a short on-screen notice ("Restarting in 5s…") so the
  // swap never looks like a crash. No click required.
  mainWindow?.webContents.send('update:restarting', { seconds: 5, version: info?.version || '' });
  setTimeout(() => maybeInstallDownloadedUpdate('auto-restart'), 5000);
});

autoUpdater.on('error', (err: any) => {
  if (isMissingUpdateManifest(err)) {
    log.warn('[Updater] No update manifest found at feed URL.');
    return;
  }
  log.error('[Updater] Error:', err);
  if (isInstallingUpdate && silentUpdateReady && isBackgroundUpdateInstallError(err)) {
    // Elevation fallback only when the user just clicked an update action —
    // they're present to answer the UAC prompt. A background install must not
    // quit the app into a prompt nobody sees (unattended host = offline).
    if (isUserUpdateContext() && launchDownloadedInstallerWithWindowsPrompt(err?.message || 'silent install blocked')) {
      return;
    }
    isInstallingUpdate = false;
    mainWindow?.webContents.send('update:error', 'Windows needs permission to finish installing this update. Click Restart to update and approve the Windows prompt.');
    return;
  }
  // Only nag if the user just asked to check/download; a background poll hitting a
  // half-published feed retries silently on the next cycle.
  sendUpdateErrorToUi('Unable to check for updates right now.');
});

// Boot launches pass --hidden so a Windows-login start lands in the tray, not a
// window over the user's desktop. On Windows getLoginItemSettings matches the
// full command line, so queries must pass the same args or they report false.
const LOGIN_ITEM_ARGS = ['--hidden'];
const getStartWithWindowsSettings = () =>
  app.getLoginItemSettings({ path: app.getPath('exe'), args: LOGIN_ITEM_ARGS });
const setStartWithWindowsLoginItem = (enabled: any) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: false,
    path: app.getPath('exe'),
    args: LOGIN_ITEM_ARGS
  });
  return getStartWithWindowsSettings();
};

// The per-machine → per-user install migration moves the exe from Program
// Files to %LocalAppData%. An existing HKCU Run entry still points at the old
// (now uninstalled) path, so autostart would silently break and an unattended
// host would never come back after a reboot. If an entry exists for this app
// but points elsewhere, rewrite it to the current exe.
function repairLoginItemAfterMigration() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try {
    const out = execSync(`reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${app.name}"`, { encoding: 'utf8', windowsHide: true });
    const match = out.match(/REG_SZ\s+(.+)$/m);
    if (!match) return;
    const registered = match[1].trim();
    const currentExe = app.getPath('exe');
    if (registered.toLowerCase().includes(currentExe.toLowerCase())) return;
    log.info(`[Startup] Autostart entry points at an old install (${registered}); repointing to ${currentExe}.`);
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false, path: currentExe, args: LOGIN_ITEM_ARGS });
  } catch { /* no Run entry — autostart was never enabled */ }
}

// If a previous run's MAIN process froze (event loop hang: heartbeats stop, the
// device silently drops offline, only an app restart helps), the stream worker
// left a marker file. Surface it into the log on the next launch so "why did
// this machine go offline" is answerable from %AppData%/Remote 365/logs.
function reportPriorMainHangs() {
  try {
    const markerPath = join(os.tmpdir(), 'remote365-main-hang.log');
    if (!existsSync(markerPath)) return;
    const content = readFileSync(markerPath, 'utf8').trim();
    if (content) log.warn(`[Watchdog] Previous run's main process HUNG — evidence from the stream worker:\n${content}`);
    require('fs').renameSync(markerPath, `${markerPath}.${Date.now()}.reported`);
  } catch { /* evidence is best-effort */ }
}

ipcMain.handle('system:getMachineName', () => os.hostname());
ipcMain.handle('system:getStartWithWindows', () => getStartWithWindowsSettings().openAtLogin);
ipcMain.handle('system:setStartWithWindows', (_event: any, enabled: boolean) => setStartWithWindowsLoginItem(enabled).openAtLogin);
ipcMain.handle('system:setLaunchAtStartup', (_event: any, enabled: any) => setStartWithWindowsLoginItem(enabled));
ipcMain.handle('system:getLaunchAtStartup', () => getStartWithWindowsSettings());
ipcMain.handle('system:isPackaged', () => app.isPackaged);
ipcMain.handle('system:getAppVersion', () => app.getVersion());
ipcMain.handle('system:openPath', (_event: any, path: any) => shell.openPath(path));
ipcMain.handle('system:openLogsFolder', async () => {
  const logsPath = app.getPath('logs');
  await fs.mkdir(logsPath, { recursive: true });
  const result = await shell.openPath(logsPath);
  if (result) throw new Error(result);
  return logsPath;
});
ipcMain.handle('system:log', (_event: any, msg: any, level: any) => {
  const l = ['info', 'warn', 'error'].includes(String(level)) ? String(level) : 'info';
  const value = String(msg ?? '');
  const safeMessage = value.length > 4000 ? `${value.slice(0, 4000)}... [truncated ${value.length - 4000} chars]` : value;
  (log as any)[l]?.(safeMessage);
});
ipcMain.handle('window:toggle-fullscreen', (event: any) => {
  const viewerTab = [...viewerTabs.values()].find((tab) => tab.view.webContents.id === event.sender.id);
  const win = viewerTab && viewerShellWindow && !viewerShellWindow.isDestroyed()
    ? viewerShellWindow
    : BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return false;
  const nextFullScreen = !win.isFullScreen();
  win.setFullScreen(nextFullScreen);
  if (win === viewerShellWindow) {
    win.webContents.send('viewer-shell:fullscreen', nextFullScreen);
    setTimeout(updateViewerViewBounds, 80);
  }
  return nextFullScreen;
});
ipcMain.handle('window:set-title', (event: any, title: any) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return false;
  const viewerTab = [...viewerTabs.values()].find((tab) => tab.view.webContents.id === event.sender.id);
  if (viewerTab && viewerTab.sessionId !== activeViewerTabId) return false;
  const cleanTitle = String(title || '').trim();
  win.setTitle(cleanTitle || 'Remote365');
  return true;
});
ipcMain.handle('window:force-reload', (event: any) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return false;
  win.webContents.reloadIgnoringCache();
  return true;
});
ipcMain.on('host-dock:toggle', (_event: any, mode: HostDockMode | boolean) => {
  hostDockMode = resolveHostDockMode(mode);
  positionHostDock(hostDockMode);
});
ipcMain.on('host-dock:close', () => {
  hideHostDesktopDock();
});
ipcMain.on('host-dock:send-file', async () => {
  try {
    const targetChannel = getHostPeerControlChannel();
    if (!targetChannel || !targetChannel.isOpen()) {
      sendHostDockStatus('No active viewer');
      return;
    }
    sendHostDockStatus('Choose files');
    hostDockWindow?.setFocusable(true);
    const started = await sendFilesFromHost();
    hostDockWindow?.setFocusable(false);
    sendHostDockStatus(started ? 'File transfer started' : 'Nothing chosen');
  } catch (error: any) {
    hostDockWindow?.setFocusable(false);
    log.error('[HostDock] Send file failed:', error?.message || error);
    sendHostDockStatus('File transfer failed');
  }
});
// Encoded Opus frames arriving from the renderer's loopback capture. Hot path:
// ~50 messages/second, so it does no work beyond forwarding.
let hostAudioChunksIn = 0;
ipcMain.on('host:audio-chunk', (_event: any, payload: { data: Uint8Array; samples?: number }) => {
  if (!payload?.data) return;
  // One line when frames start arriving, so a silent session can be diagnosed
  // as capture-side or transport-side without attaching devtools.
  if (++hostAudioChunksIn === 25) {
    const peers = Array.from(hostViewerPeers.values());
    log.info(`[Host] Remote audio flowing: 25 Opus frames received; peers=${peers.length}, withAudioTrack=${peers.filter((p) => p.audioTrack).length}, muted=${hostAudioMuted}`);
  }
  broadcastHostAudio(Buffer.from(payload.data), Number(payload.samples) || 960);
});

// The host silences sharing from the dock. Capture keeps running so unmuting is
// instant; broadcastHostAudio simply stops forwarding.
ipcMain.on('host-dock:toggle-audio', () => {
  hostAudioMuted = !hostAudioMuted;
  log.info(`[Host] Remote audio ${hostAudioMuted ? 'MUTED' : 'unmuted'} by the host.`);
  sendHostDockStatus(hostAudioMuted ? 'Remote audio muted' : 'Remote audio shared');
  updateHostAudioDock();
});

ipcMain.on('host-consent:allow', () => {
  const viewerId = hostConsentViewerId;
  hideHostConsentWindow();
  const peer = (viewerId && hostViewerPeers.get(viewerId)) || getPrimaryHostPeer();
  if (peer) {
    peer.controlGranted = true;
    peer.pendingControlViewerId = null;
    syncLegacyPeerAliases(peer);
  }
  controlGranted = true;
  pendingControlViewerId = null;
  sendToHostViewer(peer?.viewerId || viewerId, { type: 'control-granted' });
  sendHostDockControlState(true);
  sendHostDockStatus('Control allowed');
});

ipcMain.on('host-consent:deny', () => {
  const viewerId = hostConsentViewerId;
  hideHostConsentWindow();
  const peer = (viewerId && hostViewerPeers.get(viewerId)) || getPrimaryHostPeer();
  if (peer) {
    peer.controlGranted = false;
    peer.pendingControlViewerId = null;
    syncLegacyPeerAliases(peer);
  }
  controlGranted = false;
  pendingControlViewerId = null;
  sendToHostViewer(peer?.viewerId || viewerId, { type: 'control-denied' });
  sendHostDockControlState(false);
  sendHostDockStatus('Control request declined');
});

ipcMain.on('host-dock:approve-control', () => {
  hideHostConsentWindow();
  approveCurrentControlFromDock();
});
// Drop back to view-only without ending the session — a softer option than
// hanging up on a support agent mid-call.
ipcMain.on('host-dock:revoke-control', () => {
  log.info('[Host] Dock revoked remote control — session continues in view-only.');
  revokeControlFromDock();
});
// The host ends the remote session from the dock: every connected viewer is
// dropped (their side shows connection lost) and the stream stops.
ipcMain.on('host-dock:end-session', () => {
  log.info('[Host] Dock requested end of remote session.');
  // Tell the viewers WHY before the transport dies. Without this their last
  // video frame just freezes and they sit staring at a dead picture until ICE
  // eventually times out, with no idea the host hung up.
  try {
    broadcastToHostViewers({ type: 'session-ended', reason: 'host-ended' });
  } catch (err: any) {
    log.warn('[Host] Could not announce session end: ' + (err?.message || err));
  }
  hideHostConsentWindow();
  // A beat for the notice to leave the wire before the channels close.
  setTimeout(() => {
    try { cleanUpWebRTC(); } catch (err: any) { log.warn('[Host] Dock end-session cleanup error: ' + (err?.message || err)); }
  }, 120);
  sendHostDockStatus('Remote session ended.');
});

ipcMain.on('host-dock:copy-session', () => {
  copyHostDockSessionId();
});
ipcMain.on('host-dock:open-chat', () => {
  showHostChatWindow(true);
});
ipcMain.on('host-chat:close', () => {
  // Hide only — history stays so reopening from the dock restores the thread.
  if (hostChatWindow && !hostChatWindow.isDestroyed()) {
    hostChatWindow.close();
    hostChatWindow = null;
  }
});
ipcMain.on('host-chat:send', (_event: any, text: any) => {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) return;
  hostChatHistory.push({ from: 'You', text: clean, at: Date.now(), mine: true });
  if (hostChatHistory.length > 200) hostChatHistory = hostChatHistory.slice(-200);
  const payload = JSON.stringify({ type: 'chat', from: hostStreamSettings.deviceName || os.hostname(), text: clean, at: Date.now() });
  let sent = false;
  for (const peer of hostViewerPeers.values()) {
    const channel = peer.dataChannel;
    if (!channel?.isOpen?.()) continue;
    try { channel.sendMessage(payload); sent = true; } catch { }
  }
  if (!sent) { try { hostChatWindow?.webContents.send('host-chat:status', 'Viewer not connected'); } catch { } }
});

function minimizeHostWindowForRemoteSession(reason: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!hostAutoMinimizeEnabled) {
    log.info(`[Host] Auto-minimise is off; leaving the host window as it is: ${reason}`);
    return;
  }
  if (mainWindow.isMinimized()) return;
  log.info(`[Host] Minimizing host window for remote session: ${reason}`);
  mainWindow.minimize();
}

function isRemoteSessionActive() {
  if (hostViewerPeers.size > 0) return true;
  const state = typeof peerConnection?.state === 'function' ? peerConnection.state() : '';
  return Boolean(currentViewerId && ['connecting', 'connected'].includes(String(state)));
}

function keepHostWindowOutOfRemoteView(reason: string) {
  // Allow the host window to be opened/used during a remote session (do not force-minimize).
  if (!isRemoteSessionActive()) return;
  log.info(`[Host] Remote session active; allowing host window interaction: ${reason}`);
}

ipcMain.handle('auth:getToken', () => getAuthTokens());
ipcMain.handle('auth:setToken', (_event: any, t: any, r: any) => setAuthTokens(t, r));
ipcMain.handle('auth:deleteToken', (event: any) => {
  // Signing out (manual, org removal, or a dead token) must not leave remote
  // sessions running in the viewer window for a user who is no longer there.
  // The viewer tabs' own renderers are ignored so a session tab can never
  // close the whole window (they don't call this today; the blast radius is
  // just too large to leave open).
  const fromViewerTab = [...viewerTabs.values()].some((tab) => tab.view.webContents.id === event?.sender?.id);
  if (!fromViewerTab) closeAllViewerTabs('signed out');
  return fs.unlink(AUTH_STORE_PATH).then(() => true).catch(() => false);
});
ipcMain.handle('shell:openExternal', (_event: any, url: any) => shell.openExternal(url));
ipcMain.handle('host:set-auto-minimize', (_event: any, enabled: any) => {
  hostAutoMinimizeEnabled = enabled !== false;
  return hostAutoMinimizeEnabled;
});
// Chat attachments: hand the URL to Chromium's download manager (native Save
// As) instead of letting a cross-origin <a download> navigate the app window.
ipcMain.handle('chat:download-file', (event: any, url: any) => {
  const clean = String(url || '');
  if (!/^https?:\/\//i.test(clean)) return false;
  event.sender.downloadURL(clean);
  return true;
});
ipcMain.handle('host:getStatus', async () => {
  if (hostSignalingWs && hostSignalingWs.readyState === 1) return { status: 'status', sessionId: currentHostSessionId };
  return { status: 'idle' };
});
// Lets the lock overlay tell REMOTE interaction apart from LOCAL interaction:
// injected viewer input stamps lastRemoteInputAt, physical input does not. A
// click that lands within this window came from the remote session, so the
// overlay steps aside for the technician while staying locked for local users.
ipcMain.handle('host:was-remote-input-recent', () => Date.now() - lastRemoteInputAt < 1500);
ipcMain.handle('host:start', async (_: any, accessKey: any, settings: any = {}) => {
  isHostGuestMode = Boolean(settings?.useGuestRegistration);
  hostReconnectAttempts = 0;
  // A user-driven start is a fresh chance for the token path — reset the
  // credential alternation so a re-login is honoured immediately.
  hostTokenRejections = 0;
  const token = isHostGuestMode ? '' : await getFreshHostToken();
  const serverIP = normalizeServerHost(process.env.CONNECT_X_SERVER_IP || DEFAULT_SERVER_HOST);
  const cleanAccessKey = String(accessKey || '').replace(/\s/g, '');
  hostStreamSettings = {
    quality: normalizeHostStreamQuality(settings?.quality),
    // '30' (the renderer default) means AUTO — the quality preset decides. Only
    // an explicit higher pick pins the rate; otherwise sharp/ultra could never
    // reach their 60fps preset because the default '30' always masked it.
    fps: ['45', '60', '75', '90', '120'].includes(String(settings?.fps)) ? String(settings.fps) : '',
    deviceName: String(settings?.deviceName || '').trim(),
  };
  activeAdaptiveQuality = hostStreamSettings.quality;
  lastAdaptiveQualityChange = 0;
  userQualityLock = null;

  // Coalesce overlapping host starts (React development StrictMode can invoke
  // the startup effect twice) so the expensive hardware probe runs only once.
  if (!encoderDetected) {
    if (!encoderDetectionPromise) {
      encoderDetectionPromise = detectBestEncoder().finally(() => {
        encoderDetectionPromise = null;
      });
    }
    await encoderDetectionPromise;
  }
  // AV1 capability discovery runs in the background — never gates the session.
  detectAv1Capability().catch(() => { /* discovery is best-effort */ });

  isManualHostStop = false;
  // Make sure the elevated service is installed so input + capture reach the
  // lock/PIN screen. Fire-and-forget (at most one UAC prompt per version); never
  // blocks hosting, and a decline just leaves the secure desktop uncapturable.
  ensureElevatedInputService().catch(() => { /* best-effort */ });
  // Refresh this machine's unattended credential so the same service can bring
  // the device back online after a reboot, before anyone signs in. Fire-and-
  // forget: it must never delay or fail an ordinary host start.
  if (token) {
    void ensureUnattendedCredential({
      accessKey: cleanAccessKey,
      token,
      serverOrigin: buildHttpOrigin(serverIP),
      serverHost: serverIP,
      exePath: app.getPath('exe'),
      fingerprint: computeMachineFingerprint(),
      deviceName: hostStreamSettings.deviceName || os.hostname(),
    });
  }
  // Remember that this machine is meant to be reachable, so the next boot can
  // arm signaling straight from disk instead of waiting on the renderer's
  // network-dependent bootstrap (see hostAutostart.ts).
  saveHostIntent({
    accessKey: cleanAccessKey,
    guestMode: isHostGuestMode,
    serverHost: serverIP,
    deviceName: hostStreamSettings.deviceName || undefined,
    quality: hostStreamSettings.quality || undefined,
    fps: hostStreamSettings.fps || undefined,
  });
  loadMachineHostSecret(cleanAccessKey);
  connectHostSignaling(serverIP, token || '', cleanAccessKey);
  return cleanAccessKey;

});
ipcMain.handle('host:stop', () => {
  isManualHostStop = true;
  // An explicit stop is the one signal that means "stay offline" — it must
  // survive a reboot, otherwise the next boot would put the machine back online
  // against the user's wishes.
  clearHostIntent('user stopped hosting');
  if (hostSignalingWatchdog) { clearInterval(hostSignalingWatchdog); hostSignalingWatchdog = null; }
  cleanUpWebRTC();
  safeCloseWebSocket(hostSignalingWs);
  return true;
});

ipcMain.on('host:approve-viewer', (_event: any, viewerId: string, trustDevice?: boolean) => {
  if (hostSignalingWs?.readyState === WebSocket.OPEN) {
    hostSignalingWs.send(JSON.stringify({ type: 'join-approve', viewerId, trustDevice: Boolean(trustDevice) }));
    minimizeHostWindowForRemoteSession('viewer-approved');
  }
});

ipcMain.on('host:deny-viewer', (_event: any, viewerId: string) => {
  hostViewerNames.delete(String(viewerId));
  hostViewerDeviceIds.delete(String(viewerId));
  if (hostSignalingWs?.readyState === WebSocket.OPEN) {
    hostSignalingWs.send(JSON.stringify({ type: 'join-deny', viewerId }));
  }
});

ipcMain.on('host:approve-control', (_event: any, viewerId: string) => {
  hideHostConsentWindow();
  const peer = hostViewerPeers.get(viewerId) || getPrimaryHostPeer();
  if (peer && viewerId !== peer.viewerId && viewerId !== peer.pendingControlViewerId) return;
  if (!peer && viewerId !== currentViewerId && viewerId !== pendingControlViewerId) return;
  if (peer) {
    peer.controlGranted = true;
    peer.pendingControlViewerId = null;
    syncLegacyPeerAliases(peer);
  }
  controlGranted = true;
  pendingControlViewerId = null;
  minimizeHostWindowForRemoteSession('control-approved');
  sendToHostViewer(peer?.viewerId || viewerId, { type: 'control-granted' });
  sendHostDockControlState(true);
});

ipcMain.on('host:deny-control', (_event: any, viewerId: string) => {
  hideHostConsentWindow();
  const peer = hostViewerPeers.get(viewerId) || getPrimaryHostPeer();
  if (peer && viewerId !== peer.viewerId && viewerId !== peer.pendingControlViewerId) return;
  if (!peer && viewerId !== currentViewerId && viewerId !== pendingControlViewerId) return;
  if (peer) {
    peer.controlGranted = false;
    peer.pendingControlViewerId = null;
    syncLegacyPeerAliases(peer);
  }
  controlGranted = false;
  pendingControlViewerId = null;
  sendToHostViewer(peer?.viewerId || viewerId, { type: 'control-denied' });
  sendHostDockControlState(false);
});

// --- Session security enforcement (Settings → Remote control) ---
// Timestamp of the last remote input we injected; drives idle-disconnect.
let lastRemoteInputAt = Date.now();
let idleDisconnectMs = 0; // 0 = never
let registeredPanicHotkey = '';
const RECEIVED_DIR_STORE = () => join(app.getPath('userData'), 'connectx_received_dir.txt');
let receivedFilesDir = '';
// Sends land here unless the host set "Save Received Files To". A subfolder
// of Downloads keeps a technician's drops apart from the user's own files
// while staying where non-technical users already look.
const defaultReceiveDir = () => receivedFilesDir || join(app.getPath('downloads'), 'Remote365');

// Settings → "Block File Transfer": every ft: request is refused while set.
const FT_BLOCK_STORE = () => join(app.getPath('userData'), 'remote365_block_file_transfer.txt');
let fileTransferBlocked = false;
const loadFileTransferBlocked = () => {
  try { fileTransferBlocked = readFileSync(FT_BLOCK_STORE(), 'utf8').trim() === '1'; } catch { fileTransferBlocked = false; }
};
ipcMain.handle('host:get-file-transfer-blocked', () => fileTransferBlocked);
ipcMain.handle('host:set-file-transfer-blocked', async (_event: any, blocked: boolean) => {
  fileTransferBlocked = Boolean(blocked);
  try {
    await fs.writeFile(FT_BLOCK_STORE(), fileTransferBlocked ? '1' : '0', 'utf8');
  } catch (err: any) {
    log.warn('[Files] Failed to persist the file-transfer block:', err?.message || err);
  }
  log.info(`[FileTransfer] Incoming file transfer ${fileTransferBlocked ? 'BLOCKED' : 'allowed'} by host setting`);
  return { ok: true, blocked: fileTransferBlocked };
});

const loadReceivedFilesDir = () => {
  try { receivedFilesDir = readFileSync(RECEIVED_DIR_STORE(), 'utf8').trim(); } catch { receivedFilesDir = ''; }
};

// B — Panic hotkey. Registers a system-wide shortcut that instantly ends the
// live session; the renderer decides the follow-up (stop hosting / lock out).
ipcMain.handle('host:set-panic-hotkey', (_event: any, accelerator: string) => {
  try {
    if (registeredPanicHotkey && globalShortcut.isRegistered(registeredPanicHotkey)) {
      globalShortcut.unregister(registeredPanicHotkey);
    }
  } catch {}
  registeredPanicHotkey = '';
  const accel = String(accelerator || '').trim();
  if (!accel) return { ok: true, registered: false };
  try {
    const ok = globalShortcut.register(accel, () => {
      log.warn(`[Panic] Hotkey ${accel} triggered — ending session.`);
      if (isRemoteSessionActive()) cleanUpWebRTC();
      mainWindow?.webContents.send('host:panic-triggered');
      try {
        new Notification({ title: 'Panic Lockdown', body: 'All remote sessions were disconnected.' }).show();
      } catch {}
    });
    registeredPanicHotkey = ok ? accel : '';
    return { ok, registered: ok };
  } catch (err: any) {
    log.error('[Panic] Failed to register hotkey:', err?.message || err);
    return { ok: false, registered: false, error: String(err?.message || err) };
  }
});

// C — Idle auto-disconnect. 0 disables it.
ipcMain.handle('host:set-idle-timeout', (_event: any, minutes: number) => {
  const m = Number(minutes);
  idleDisconnectMs = Number.isFinite(m) && m > 0 ? Math.min(1440, m) * 60 * 1000 : 0;
  lastRemoteInputAt = Date.now();
  return { ok: true, minutes: idleDisconnectMs / 60000 };
});

setInterval(() => {
  if (idleDisconnectMs <= 0) return;
  if (!isRemoteSessionActive()) return;
  if (Date.now() - lastRemoteInputAt < idleDisconnectMs) return;
  log.warn('[Idle] No remote input past the idle limit — disconnecting viewer.');
  cleanUpWebRTC();
  mainWindow?.webContents.send('host:idle-disconnected');
  try {
    new Notification({ title: 'Session Ended', body: 'A remote session was closed after being idle.' }).show();
  } catch {}
  lastRemoteInputAt = Date.now();
}, 15000);

// D — Received-files folder. Empty string means the default Downloads folder.
ipcMain.handle('system:pickFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('host:set-received-dir', async (_event: any, dir: string) => {
  receivedFilesDir = String(dir || '').trim();
  try {
    if (receivedFilesDir) await fs.writeFile(RECEIVED_DIR_STORE(), receivedFilesDir, 'utf8');
    else await fs.unlink(RECEIVED_DIR_STORE()).catch(() => {});
  } catch (err: any) {
    log.warn('[Files] Failed to persist received dir:', err?.message || err);
  }
  return { ok: true, dir: receivedFilesDir };
});

ipcMain.handle('host:get-received-dir', () => ({ dir: receivedFilesDir, fallback: app.getPath('downloads') }));

// --- Network settings enforcement (Settings → Network) ---

// Proxy — routes the app's own HTTP/WebSocket traffic (API + signaling).
async function applyProxyMode(mode: string, manual?: string) {
  const s = session.defaultSession;
  try {
    if (mode === 'No proxy') await s.setProxy({ mode: 'direct' });
    else if (mode === 'System proxy') await s.setProxy({ mode: 'system' });
    else if (mode === 'Manual proxy' && manual) await s.setProxy({ proxyRules: manual });
    else await s.setProxy({ mode: 'system' }); // Recommended → follow the OS
    log.info(`[Net] Proxy mode applied: ${mode}${manual ? ` (${manual})` : ''}`);
    return { ok: true };
  } catch (err: any) {
    log.error('[Net] Failed to apply proxy:', err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}
ipcMain.handle('net:set-proxy', (_event: any, mode: string, manual?: string) => applyProxyMode(mode, manual));

// Incoming LAN / direct connections — "Block" forces every WebRTC session
// through the TURN relay (no host/LAN candidates); otherwise all paths allowed.
let iceTransportPref: 'all' | 'relay' = 'all';
// ── LAN Direct IPC ────────────────────────────────────────────────────────────
ipcMain.handle('lan:get-status', () => ({
  enabled: lanConfig.enabled,
  hasPassword: !!lanConfig.passwordHash,
  running: isLanDirectRunning(),
  addresses: getLanAddresses(),
  port: LAN_SIGNAL_PORT,
}));

ipcMain.handle('lan:configure', (_event: any, options: { enabled?: boolean; password?: string }) => {
  if (typeof options?.password === 'string' && options.password.length > 0) {
    if (options.password.length < 6) {
      return { ok: false, error: 'Use at least 6 characters for the LAN password.' };
    }
    setLanPassword(options.password);
  }
  if (typeof options?.enabled === 'boolean') {
    lanConfig.enabled = options.enabled;
    persistLanConfig();
  }
  if (!lanConfig.enabled) {
    stopLanDirect();
    return { ok: true, enabled: false, running: false, addresses: [] };
  }
  const result = startLanDirectIfConfigured();
  return {
    ok: result.ok,
    error: result.error,
    enabled: lanConfig.enabled,
    running: isLanDirectRunning(),
    addresses: result.addresses,
    port: LAN_SIGNAL_PORT,
  };
});

/** Viewer side: probe the subnet for hosts advertising LAN Direct. */
ipcMain.handle('lan:discover', async () => {
  try {
    return await discoverLanHosts();
  } catch {
    return [];
  }
});

ipcMain.handle('net:set-ice-policy', (_event: any, policy: string) => {
  iceTransportPref = policy === 'relay' ? 'relay' : 'all';
  log.info(`[Net] ICE transport policy: ${iceTransportPref}`);
  return { ok: true, policy: iceTransportPref };
});

// Wake-on-LAN — this machine's primary MAC + a magic-packet sender. WoL is a
// LAN broadcast, so it only wakes a target on the same network segment.
function getPrimaryMac(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac;
      }
    }
  }
  return '';
}
// Advanced settings (Settings → Advanced). keepRunning + detailedLogs apply
// live; disableGpu + launchMinimized take effect on the next launch.
ipcMain.handle('system:set-advanced', (_event: any, patch: Partial<AdvancedFlags>) => {
  advancedFlags = { ...advancedFlags, ...patch };
  persistAdvancedFlags();
  if (typeof patch.detailedLogs === 'boolean') {
    try { log.transports.file.level = patch.detailedLogs ? 'debug' : 'info'; } catch {}
  }
  // keepRunning drives the offline-recovery task: arm or disarm it live.
  if (typeof patch.keepRunning === 'boolean') ensureKeepAliveTask();
  return { ok: true, flags: advancedFlags, needsRestart: 'disableGpu' in patch || 'launchMinimized' in patch };
});
ipcMain.handle('system:get-advanced', () => ({ flags: advancedFlags }));

ipcMain.handle('net:get-mac', () => ({ mac: getPrimaryMac() }));
ipcMain.handle('net:wake', (_event: any, mac: string) => {
  try {
    const clean = String(mac || '').replace(/[^0-9a-fA-F]/g, '');
    if (clean.length !== 12) return { ok: false, error: 'Invalid MAC address' };
    const macBytes = Buffer.from(clean, 'hex');
    // Magic packet = 6× 0xFF followed by the MAC repeated 16 times.
    const packet = Buffer.alloc(102, 0xff);
    for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6);
    const dgram = require('dgram');
    const socket = dgram.createSocket('udp4');
    socket.once('error', (err: any) => { log.warn('[WoL] socket error:', err?.message || err); try { socket.close(); } catch {} });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, 9, '255.255.255.255', (err: any) => {
        if (err) log.warn('[WoL] send failed:', err?.message || err);
        else log.info(`[WoL] Magic packet sent to ${clean}`);
        try { socket.close(); } catch {}
      });
    });
    return { ok: true };
  } catch (err: any) {
    log.error('[WoL] Failed to send magic packet:', err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('host:get-screens', () => {
  const displays = screen.getAllDisplays();
  return displays.map((d: any) => ({
    id: d.id,
    label: `${d.label || 'Display'} (${d.bounds.width}x${d.bounds.height})`,
    bounds: d.bounds
  }));
});

ipcMain.handle('meeting:get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false
    });
    return sources.map((source: any) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail?.toDataURL?.() || '',
      isScreen: String(source.id || '').startsWith('screen')
    }));
  } catch (err: any) {
    log.error(`[Meeting] get-screen-sources failed: ${err.message}`);
    return [];
  }
});

ipcMain.handle('host:set-capture-screen', (_: any, displayId: any) => {
  log.info(`[Host] Switching capture screen to: ${displayId}`);
  selectedDisplayId = displayId;
  if (hostViewerPeers.size > 0 || (videoTrack && peerConnection?.state() === 'connected')) {
    startStreaming();
  }
  return true;
});
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:writeText', (_event: any, text: any) => {
  const value = String(text ?? '');
  lastClipboardText = value;
  clipboard.writeText(value);
  return true;
});

const VIEWER_TAB_BAR_HEIGHT = 38;

function viewerShellHtml() {
  let logoUrl = '';
  const appVersion = app.getVersion();
  try {
    logoUrl = `data:image/png;base64,${readFileSync(getAppLogoPath()).toString('base64')}`;
  } catch (error: any) {
    log.warn(`[ViewerTabs] Failed to inline logo: ${error?.message || error}`);
  }
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #111315; font-family: "Segoe UI", Arial, sans-serif; }
    #titlebar { height: ${VIEWER_TAB_BAR_HEIGHT}px; display: flex; align-items: stretch; background: #1A1D21; border-bottom: 1px solid #000; user-select: none; -webkit-app-region: drag; }
    body.fullscreen #titlebar { display: none; }
    #brand { width: auto; display: flex; align-items: center; justify-content: flex-start; gap: 7px; flex: 0 0 auto; padding: 0 12px 0 14px; -webkit-app-region: drag; }
    #brand img { width: 20px; height: 20px; object-fit: contain; display: block; border-radius: 5px; }
    #brand .brand-name { font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,.92); letter-spacing: .1px; white-space: nowrap; }
    #brand .brand-version { margin-left: -3px; padding-top: 1px; font-size: 8.5px; font-weight: 500; color: rgba(255,255,255,.48); letter-spacing: .15px; white-space: nowrap; }
    /* Tabs shrink Chrome-style down to 96px, then the strip scrolls horizontally
       (mouse wheel; scrollbar hidden). Every open session stays reachable — the
       old overflow:hidden simply clipped tabs past the window edge. */
    #tabs { min-width: 0; flex: 1; display: flex; align-items: flex-end; gap: 4px; padding: 6px 10px 0 2px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
    #tabs::-webkit-scrollbar { display: none; }
    /* While overflowing there is no empty strip left to drag the window by, so
       giving the strip no-drag (needed for reliable wheel/scroll) costs nothing. */
    #tabs.overflowing { -webkit-app-region: no-drag; }
    .tab { height: 30px; max-width: 240px; min-width: 96px; flex: 1 1 auto; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 12px; border: 1px solid transparent; border-bottom: 0; border-radius: 8px 8px 0 0; color: rgba(255,255,255,.68); background: rgba(255,255,255,.06); font-size: 12.5px; font-weight: 500; line-height: 16px; cursor: default; -webkit-app-region: no-drag; transition: background .12s ease, color .12s ease, box-shadow .12s ease; box-shadow: inset 0 2px 0 transparent; }
    .tab:hover { background: rgba(255,255,255,.11); color: rgba(255,255,255,.92); }
    .tab.active { background: #F3F4F6; color: #111315; box-shadow: inset 0 2px 0 #FF8A00; }
    .tab.active:hover { background: #F3F4F6; }
    .tab-dot { width: 6px; height: 6px; border-radius: 50%; background: #34C759; flex: 0 0 auto; }
    .tab-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tab-close { width: 18px; height: 18px; border: 0; border-radius: 5px; background: transparent; color: inherit; opacity: .6; font-size: 15px; line-height: 15px; display: grid; place-items: center; padding: 0; }
    .tab-close:hover { background: rgba(255,45,85,.15); color: #FF383C; opacity: 1; }
    #tab-overflow { height: 30px; margin: 6px 4px 0 0; padding: 0 8px; border: 0; border-radius: 8px 8px 0 0; background: transparent; color: rgba(255,255,255,.65); display: none; align-items: center; gap: 5px; flex: 0 0 auto; font-size: 11.5px; font-weight: 600; -webkit-app-region: no-drag; cursor: default; }
    #tab-overflow:hover { background: rgba(255,255,255,.11); color: #fff; }
    #tab-overflow.visible { display: flex; }
    /* "+" after the last tab: start another session (opens the Devices list). */
    .tab-new { height: 30px; width: 30px; flex: 0 0 auto; margin-left: 2px; padding: 0; border: 0; border-radius: 8px 8px 0 0; background: transparent; color: rgba(255,255,255,.65); display: grid; place-items: center; -webkit-app-region: no-drag; cursor: default; }
    .tab-new:hover { background: rgba(255,255,255,.11); color: #fff; }
    #window-controls { display: flex; flex: 0 0 auto; -webkit-app-region: no-drag; }
    .window-button { width: 46px; height: ${VIEWER_TAB_BAR_HEIGHT}px; border: 0; background: transparent; color: rgba(255,255,255,.65); font-size: 15px; display: grid; place-items: center; }
    .window-button:hover { background: rgba(255,255,255,.08); color: #fff; }
    .window-button.close:hover { background: #e81123; color: white; }
  </style>
</head>
<body>
  <div id="titlebar">
    <div id="brand"><img src="${logoUrl}" alt=""><span class="brand-name">Remote365</span><span class="brand-version">v${appVersion}</span></div>
    <div id="tabs"></div>
    <button id="tab-overflow" title="Show All Sessions"><span id="tab-count"></span><svg width="9" height="6" viewBox="0 0 9 6"><path d="M1 1 L4.5 4.5 L8 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
    <div id="window-controls">
      <button class="window-button" id="minimize" title="Minimize"><svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>
      <button class="window-button" id="maximize" title="Maximize"><svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>
      <button class="window-button close" id="close" title="Close"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0 L10 10 M10 0 L0 10" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const tabs = document.getElementById('tabs');
    const overflowButton = document.getElementById('tab-overflow');
    const tabCount = document.getElementById('tab-count');
    document.getElementById('minimize').onclick = () => ipcRenderer.send('viewer-shell:minimize');
    document.getElementById('maximize').onclick = () => ipcRenderer.send('viewer-shell:maximize');
    document.getElementById('close').onclick = () => ipcRenderer.send('viewer-shell:close');
    overflowButton.onclick = () => ipcRenderer.send('viewer-tabs:menu');
    // Vertical wheel scrolls the strip horizontally (there is no vertical axis
    // here, and most mice have no horizontal wheel).
    tabs.addEventListener('wheel', (event) => {
      if (!event.deltaX && event.deltaY) {
        tabs.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }, { passive: false });
    function syncOverflowState() {
      tabs.classList.toggle('overflowing', tabs.scrollWidth > tabs.clientWidth + 1);
    }
    window.addEventListener('resize', syncOverflowState);
    function render(payload) {
      tabs.innerHTML = '';
      let activeItem = null;
      for (const tab of payload.tabs || []) {
        const item = document.createElement('div');
        item.className = 'tab' + (tab.sessionId === payload.activeSessionId ? ' active' : '');
        item.title = tab.title;
        item.onclick = () => ipcRenderer.send('viewer-tabs:switch', tab.sessionId);
        const dot = document.createElement('span');
        dot.className = 'tab-dot';
        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;
        const close = document.createElement('button');
        close.className = 'tab-close';
        close.innerHTML = '&times;';
        close.onclick = (event) => {
          event.stopPropagation();
          ipcRenderer.send('viewer-tabs:close', tab.sessionId);
        };
        item.append(dot, title, close);
        tabs.append(item);
        if (tab.sessionId === payload.activeSessionId) activeItem = item;
      }
      const add = document.createElement('button');
      add.className = 'tab-new';
      add.title = 'New Session';
      add.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 V10 M1 5.5 H10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
      add.onclick = () => ipcRenderer.send('viewer-tabs:new');
      tabs.append(add);
      const count = (payload.tabs || []).length;
      tabCount.textContent = String(count);
      overflowButton.classList.toggle('visible', count > 1);
      syncOverflowState();
      // Keep the tab you just switched to on screen even when the strip scrolls.
      if (activeItem) activeItem.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
    ipcRenderer.on('viewer-tabs:update', (_event, payload) => render(payload));
    ipcRenderer.on('viewer-shell:fullscreen', (_event, active) => {
      document.body.classList.toggle('fullscreen', Boolean(active));
    });
    ipcRenderer.send('viewer-tabs:ready');
  </script>
</body>
</html>`;
}

function getViewerTabPayload() {
  return {
    activeSessionId: activeViewerTabId,
    tabs: [...viewerTabs.values()].map((tab) => ({
      sessionId: tab.sessionId,
      title: tab.title
    }))
  };
}

function sendViewerTabsUpdate() {
  if (!viewerShellWindow || viewerShellWindow.isDestroyed()) return;
  viewerShellWindow.webContents.send('viewer-tabs:update', getViewerTabPayload());
  const active = viewerTabs.get(activeViewerTabId);
  viewerShellWindow.setTitle(active ? `Remote365 - ${active.title}` : 'Remote365');
}

// Push the set of devices this user is actively viewing (open viewer tabs, keyed by
// access key) to the main window so the Devices page can show a real "In Active
// Session" count instead of a placeholder.
function broadcastActiveViewers() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('viewer:active-changed', Array.from(viewerTabs.keys()));
    }
  } catch {}
}

function viewerTabMediaActive(sessionId: string) {
  return Boolean(viewerShellWindow && !viewerShellWindow.isDestroyed() &&
    isViewerMediaActive(sessionId, activeViewerTabId, viewerShellWindow.isVisible(), viewerShellWindow.isMinimized()));
}

function syncViewerMediaActivity() {
  for (const tab of viewerTabs.values()) {
    if (tab.view.webContents.isDestroyed()) continue;
    const active = viewerTabMediaActive(tab.sessionId);
    tab.view.webContents.send('viewer:media-active', active);
    tab.view.webContents.setBackgroundThrottling(!active);
  }
}

ipcMain.handle('viewer:get-media-active', (event) => {
  const tab = [...viewerTabs.values()].find((item) => item.view.webContents.id === event.sender.id);
  return tab ? viewerTabMediaActive(tab.sessionId) : true;
});

function updateViewerViewBounds() {
  if (!viewerShellWindow || viewerShellWindow.isDestroyed()) return;
  const bounds = viewerShellWindow.getContentBounds();
  const titlebarHeight = viewerShellWindow.isFullScreen() ? 0 : VIEWER_TAB_BAR_HEIGHT;
  for (const tab of viewerTabs.values()) {
    tab.view.setBounds({
      x: 0,
      y: tab.sessionId === activeViewerTabId ? titlebarHeight : bounds.height + 100,
      width: bounds.width,
      height: Math.max(1, bounds.height - titlebarHeight)
    });
    tab.view.setAutoResize({ width: true, height: true });
  }
}

function syncViewerShellFullscreenState() {
  if (!viewerShellWindow || viewerShellWindow.isDestroyed()) return;
  const active = viewerShellWindow.isFullScreen();
  viewerShellWindow.webContents.send('viewer-shell:fullscreen', active);
  updateViewerViewBounds();
}

function activateViewerTab(sessionId: string) {
  const tab = viewerTabs.get(sessionId);
  if (!tab || !viewerShellWindow || viewerShellWindow.isDestroyed()) return false;
  activeViewerTabId = sessionId;
  updateViewerViewBounds();
  sendViewerTabsUpdate();
  viewerShellWindow.show();
  viewerShellWindow.focus();
  tab.view.webContents.focus();
  syncViewerMediaActivity();
  refreshSystemKeyHook();
  return true;
}

// ---- System keys → remote (viewer side) ----
// Win, Alt+Tab, Alt+F4, Ctrl+Esc, PrintScreen... are eaten by the LOCAL shell
// before Chromium ever sees them, so a viewer pressing Win+E opened Explorer
// on their own laptop. The native-input addon's low-level keyboard hook
// swallows those chords while the viewer window is in the foreground and
// hands them here; they go to the ACTIVE session tab, whose renderer forwards
// them over the control channel like any other key. A tab opts in
// (`viewer:system-keys`) only while it streams a desktop host with the
// toolbar's "Send System Keys To Remote" switched on, so the hook is armed
// only when a remote desktop is actually on screen.
const systemKeyOptIns = new Map<string, boolean>();
let systemKeyHookInstalled = false;

function viewerShellHwnd(): number {
  if (!viewerShellWindow || viewerShellWindow.isDestroyed()) return 0;
  try {
    const handle = viewerShellWindow.getNativeWindowHandle();
    return handle.length >= 8 ? Number(handle.readBigUInt64LE(0)) : handle.readUInt32LE(0);
  } catch {
    return 0;
  }
}

function refreshSystemKeyHook() {
  const wanted = Boolean(
    activeViewerTabId && systemKeyOptIns.get(activeViewerTabId) && viewerShellWindow && !viewerShellWindow.isDestroyed()
  );
  if (!wanted) {
    if (systemKeyHookInstalled) input.setKeyboardHookEnabled(false);
    return;
  }
  if (!systemKeyHookInstalled) {
    systemKeyHookInstalled = input.startKeyboardHook((event) => {
      const tab = viewerTabs.get(activeViewerTabId);
      if (!tab || tab.view.webContents.isDestroyed()) return;
      tab.view.webContents.send('viewer:system-key', event);
    });
    if (!systemKeyHookInstalled) {
      log.warn('[Viewer] System-key hook could not be installed; Win / Alt+Tab stay on this machine.');
      return;
    }
    log.info('[Viewer] System-key hook installed.');
  }
  input.setKeyboardHookTarget(viewerShellHwnd());
  input.setKeyboardHookEnabled(true);
}

function stopSystemKeyHook() {
  systemKeyOptIns.clear();
  if (!systemKeyHookInstalled) return;
  systemKeyHookInstalled = false;
  input.stopKeyboardHook();
}

ipcMain.on('viewer:system-keys', (event: any, enabled: any) => {
  for (const [tabId, tab] of viewerTabs.entries()) {
    if (tab.view.webContents.id !== event.sender.id) continue;
    if (enabled) systemKeyOptIns.set(tabId, true);
    else systemKeyOptIns.delete(tabId);
    refreshSystemKeyHook();
    return;
  }
});

function closeViewerTab(sessionId: string) {
  const tab = viewerTabs.get(sessionId);
  if (!tab || !viewerShellWindow || viewerShellWindow.isDestroyed()) return;
  try { viewerShellWindow.removeBrowserView(tab.view); } catch {}
  try { tab.view.webContents.close(); } catch {}
  viewerTabs.delete(sessionId);
  viewerWindows.delete(sessionId);
  systemKeyOptIns.delete(sessionId);
  broadcastActiveViewers();
  const ws = viewerSignalingSockets.get(sessionId);
  if (ws) { safeCloseWebSocket(ws); viewerSignalingSockets.delete(sessionId); }
  if (activeViewerTabId === sessionId) {
    activeViewerTabId = viewerTabs.keys().next().value || '';
  }
  if (!activeViewerTabId) {
    viewerShellWindow.close();
    return;
  }
  activateViewerTab(activeViewerTabId);
}

// Closing the last tab closes the viewer window itself (see closeViewerTab).
function closeAllViewerTabs(reason: string) {
  const ids = [...viewerTabs.keys()];
  if (ids.length === 0) return 0;
  log.info(`[ViewerTabs] Closing ${ids.length} session tab(s): ${reason}`);
  for (const sessionId of ids) closeViewerTab(sessionId);
  return ids.length;
}

async function confirmCloseAllViewerTabs() {
  if (!viewerShellWindow || viewerShellWindow.isDestroyed() || viewerTabs.size === 0) return;
  const count = viewerTabs.size;
  const { response } = await dialog.showMessageBox(viewerShellWindow, {
    type: 'question',
    title: 'Close All Sessions',
    message: count === 1 ? 'Close this session?' : `Close all ${count} sessions?`,
    detail: 'Every remote session in this window will be disconnected.',
    buttons: [count === 1 ? 'Close Session' : 'Close All Sessions', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (response === 0) closeAllViewerTabs('user chose Close All Sessions');
}

function ensureViewerShellWindow(isMobile: boolean) {
  if (viewerShellWindow && !viewerShellWindow.isDestroyed()) return viewerShellWindow;
  viewerShellWindow = new BrowserWindow({
    width: 1280,
    height: isMobile ? 900 : 760,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#111315',
    title: 'Remote365',
    icon: app.isPackaged
      ? join(process.resourcesPath, 'logo.png')
      : join(__dirname, '../../src/logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      // An occluded/minimized viewer must keep its timers at full rate —
      // throttling collapses the input trailing-flush and cursor coalescer to ~1Hz.
      backgroundThrottling: false
    }
  });
  viewerShellWindow.setMenuBarVisibility(false);
  viewerShellWindow.setAutoHideMenuBar(true);
  viewerShellWindow.setMenu(null);
  // Open MAXIMIZED (standard remote-desktop behavior — the remote screen wants
  // every pixel it can get). Still a normal window, not fullscreen/kiosk:
  // minimize / restore / close all behave normally via the titlebar buttons.
  viewerShellWindow.maximize();
  viewerShellWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(viewerShellHtml())}`);
  viewerShellWindow.on('resize', updateViewerViewBounds);
  viewerShellWindow.on('minimize', syncViewerMediaActivity);
  viewerShellWindow.on('restore', syncViewerMediaActivity);
  viewerShellWindow.on('hide', syncViewerMediaActivity);
  viewerShellWindow.on('show', syncViewerMediaActivity);
  viewerShellWindow.on('enter-full-screen', syncViewerShellFullscreenState);
  viewerShellWindow.on('leave-full-screen', syncViewerShellFullscreenState);
  viewerShellWindow.on('closed', () => {
    for (const sessionId of [...viewerTabs.keys()]) {
      const tab = viewerTabs.get(sessionId);
      try { tab?.view.webContents.close(); } catch {}
      const ws = viewerSignalingSockets.get(sessionId);
      if (ws) safeCloseWebSocket(ws);
    }
    viewerTabs.clear();
    viewerWindows.clear();
    viewerShellWindow = null;
    activeViewerTabId = '';
    stopSystemKeyHook();
    broadcastActiveViewers();
    scheduleDeferredUpdateInstall('viewer-shell-closed');
  });
  return viewerShellWindow;
}

ipcMain.on('viewer-tabs:ready', () => sendViewerTabsUpdate());
ipcMain.on('viewer-tabs:switch', (_event: any, sessionId: string) => activateViewerTab(String(sessionId || '')));
ipcMain.on('viewer-tabs:close', (_event: any, sessionId: string) => closeViewerTab(String(sessionId || '')));
// "+" on the tab strip: bring the main window up on the Devices list so the
// user can start another session. The strip itself has no device list.
ipcMain.on('viewer-tabs:new', () => {
  showMainWindowFromDock();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:navigate', 'devices');
});
// "Show all sessions" dropdown. A native menu, not HTML: the session
// BrowserViews are always composited above the shell page, so any in-page
// dropdown would be hidden underneath them.
ipcMain.on('viewer-tabs:menu', () => {
  if (!viewerShellWindow || viewerShellWindow.isDestroyed() || viewerTabs.size === 0) return;
  const truncate = (value: string) => (value.length > 48 ? `${value.slice(0, 47)}…` : value);
  const menu = Menu.buildFromTemplate([
    { label: `${viewerTabs.size} Open Session${viewerTabs.size === 1 ? '' : 's'}`, enabled: false },
    { type: 'separator' },
    ...[...viewerTabs.values()].map((tab) => ({
      label: truncate(tab.title || tab.sessionId),
      type: 'checkbox' as const,
      checked: tab.sessionId === activeViewerTabId,
      click: () => activateViewerTab(tab.sessionId),
    })),
    { type: 'separator' },
    {
      label: 'Close Current Session',
      enabled: Boolean(activeViewerTabId),
      click: () => { if (activeViewerTabId) closeViewerTab(activeViewerTabId); },
    },
    {
      label: 'Close All Sessions',
      click: () => { void confirmCloseAllViewerTabs(); },
    },
  ]);
  menu.popup({ window: viewerShellWindow });
});
ipcMain.on('viewer:close-current-tab', (event: any, sessionId?: string) => {
  const requestedId = String(sessionId || '').trim();
  if (requestedId) {
    closeViewerTab(requestedId);
    return;
  }
  for (const [tabId, tab] of viewerTabs.entries()) {
    if (tab.view.webContents.id === event.sender.id) {
      closeViewerTab(tabId);
      return;
    }
  }
});
ipcMain.handle('viewer:get-active', () => Array.from(viewerTabs.keys()));
ipcMain.on('viewer-shell:minimize', () => {
  if (viewerShellWindow && !viewerShellWindow.isDestroyed()) viewerShellWindow.minimize();
});
ipcMain.on('viewer-shell:maximize', () => {
  if (!viewerShellWindow || viewerShellWindow.isDestroyed()) return;
  if (viewerShellWindow.isMaximized()) viewerShellWindow.unmaximize();
  else viewerShellWindow.maximize();
});
ipcMain.on('viewer-shell:close', () => {
  if (viewerShellWindow && !viewerShellWindow.isDestroyed()) viewerShellWindow.close();
});

ipcMain.handle('viewer:open-window', (_event: any, sessionId: any, serverIP: any, token: any, deviceName: any, deviceType: any) => {
  const cleanSessionId = String(sessionId || '').trim();
  if (!cleanSessionId) return false;
  const isMobile = deviceType?.toLowerCase() === 'android' || deviceType?.toLowerCase() === 'ios';
  if (viewerTabs.has(cleanSessionId)) {
    activateViewerTab(cleanSessionId);
    return true;
  }
  const normalizedServer = normalizeServerHost(serverIP || DEFAULT_SERVER_HOST);
  const shellWin = ensureViewerShellWindow(isMobile);
  const title = String(deviceName || cleanSessionId || 'Remote Session').trim();
  const viewerView = new BrowserView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      // Active video needs responsive input timers. syncViewerMediaActivity
      // enables throttling after a tab is parked.
      backgroundThrottling: false
    }
  });

  // Allow inception to be naturally prevented by auto-hiding the host window

  const query = `?view=viewer&sessionId=${encodeURIComponent(cleanSessionId)}&serverIP=${encodeURIComponent(normalizedServer)}&token=${encodeURIComponent(token || '')}&deviceName=${encodeURIComponent(deviceName || '')}&deviceType=${encodeURIComponent(deviceType || '')}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    viewerView.webContents.loadURL(`${process.env.VITE_DEV_SERVER_URL}${query}`);
  } else {
    viewerView.webContents.loadFile(join(__dirname, '../../dist/index.html'), { query: { view: 'viewer', sessionId: cleanSessionId, serverIP: normalizedServer, token: token || '', deviceName: deviceName || '', deviceType: deviceType || '' } });
  }

  viewerView.webContents.on('destroyed', () => {
    if (viewerTabs.get(cleanSessionId)?.view === viewerView) {
      viewerTabs.delete(cleanSessionId);
      viewerWindows.delete(cleanSessionId);
    }
    systemKeyOptIns.delete(cleanSessionId);
    refreshSystemKeyHook();
    broadcastActiveViewers();
  });

  viewerTabs.set(cleanSessionId, { view: viewerView, sessionId: cleanSessionId, title, serverIP: normalizedServer, token: token || '', deviceType: deviceType || '' });
  viewerWindows.set(cleanSessionId, shellWin);
  shellWin.addBrowserView(viewerView);
  activateViewerTab(cleanSessionId);
  broadcastActiveViewers();
  return true;
});

// asHost: the meeting was just CREATED here (landing page, possibly signed
// out); the meeting window then claims the host seat of the new room.
function openMeetingWindow(meetingId: any, options?: { asHost?: boolean }) {
  // Bare alphanumerics only: "977-577-588" (Recent Meetings) and "977577588"
  // (Quick Join) are the same room and must share one window.
  const cleanMeetingId = String(meetingId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!cleanMeetingId) return false;
  const displayMeetingId = cleanMeetingId.length === 9
    ? `${cleanMeetingId.slice(0, 3)}-${cleanMeetingId.slice(3, 6)}-${cleanMeetingId.slice(6, 9)}`
    : cleanMeetingId;

  if (meetingWindows.has(cleanMeetingId)) {
    const existing = meetingWindows.get(cleanMeetingId);
    if (existing && !existing.isDestroyed()) {
      if (!existing.isMaximized()) existing.maximize();
      existing.show();
      existing.focus();
      return true;
    }
  }

  const meetingWin = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#050505',
    title: `Remote365 Meeting ${displayMeetingId}`,
    icon: app.isPackaged
      ? join(process.resourcesPath, 'logo.png')
      : join(__dirname, '../../src/logo.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  // Strip the default Electron application menu (File/Edit/View/Window/Help) so
  // the meeting window has a clean frame like the main window.
  meetingWin.setMenuBarVisibility(false);
  meetingWin.setMenu(null);

  // Open the meeting in a full (maximized) window rather than a small one.
  meetingWin.once('ready-to-show', () => {
    meetingWin.maximize();
    meetingWin.show();
    meetingWin.focus();
  });

  const hostFlag = options?.asHost ? '1' : '';
  const query = `?view=meeting&meetingId=${encodeURIComponent(cleanMeetingId)}${hostFlag ? '&host=1' : ''}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    meetingWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}${query}`);
  } else {
    meetingWin.loadFile(join(__dirname, '../../dist/index.html'), {
      query: hostFlag ? { view: 'meeting', meetingId: cleanMeetingId, host: '1' } : { view: 'meeting', meetingId: cleanMeetingId }
    });
  }

  meetingWin.on('closed', () => meetingWindows.delete(cleanMeetingId));
  meetingWindows.set(cleanMeetingId, meetingWin);
  return true;
}

ipcMain.handle('meeting:open-window', (_event: any, meetingId: any, options: any) => openMeetingWindow(meetingId, options && typeof options === 'object' ? { asHost: Boolean(options.asHost) } : undefined));

ipcMain.handle('session:open-wait-window', (_event: any, session: { code?: string; name?: string; link?: string }) => {
  const cleanCode = String(session?.code || '').replace(/\D/g, '');
  if (!cleanCode) return false;

  const existing = sessionWaitWindows.get(cleanCode);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return true;
  }

  const waitWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#FFFFFF',
    title: `Remote365 - ${session?.name || 'Session'}`,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  });
  waitWin.setMenuBarVisibility(false);
  waitWin.maximize();

  const queryParts = `view=host-wait&sessionCode=${encodeURIComponent(cleanCode)}&sessionName=${encodeURIComponent(session?.name || '')}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    waitWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}?${queryParts}`);
  } else {
    waitWin.loadFile(join(__dirname, '../../dist/index.html'), {
      query: { view: 'host-wait', sessionCode: cleanCode, sessionName: session?.name || '' }
    });
  }

  waitWin.on('closed', () => sessionWaitWindows.delete(cleanCode));
  sessionWaitWindows.set(cleanCode, waitWin);
  return true;
});

function notifySessionWaitWindowsParticipantJoined() {
  if (sessionWaitWindows.size === 0) return;
  for (const win of sessionWaitWindows.values()) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('session:participant-joined');
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('session:participant-joined');
  }
}

ipcMain.handle('viewer:connect', async (_event: any, sessionId: any, serverIP: any, token: any, viewerClientId: any, viewerDeviceId?: any) => {
  log.info(`[Viewer] Connecting to session: ${sessionId} at ${serverIP}`);
  const existing = viewerSignalingSockets.get(sessionId);
  if (existing) {
    log.info(`[Viewer] Replacing existing signaling socket for session: ${sessionId}`);
    viewerSignalingSockets.delete(sessionId);
    safeCloseWebSocket(existing);
  }
  connectViewerSignaling(sessionId, serverIP || DEFAULT_SERVER_HOST, token || '', viewerClientId, viewerDeviceId);
  return true;
});

/** Connect to a host over the local network, with no cloud involvement at all. */
ipcMain.handle('viewer:connect-lan', async (_event: any, options: { sessionId: string; address: string; password: string; port?: number }) => {
  const sessionId = String(options?.sessionId || options?.address || '').trim();
  const address = String(options?.address || '').trim();
  if (!sessionId || !address) return { ok: false, error: 'Missing host address.' };
  const existing = viewerSignalingSockets.get(sessionId);
  if (existing) {
    viewerSignalingSockets.delete(sessionId);
    safeCloseWebSocket(existing);
  }
  connectViewerLanDirect(sessionId, address, String(options?.password || ''), options?.port);
  return { ok: true };
});

ipcMain.on('viewer:send-signaling', (_event: any, msg: any) => {
  const sessionId = msg.sessionId || msg.targetId;
  if (!sessionId) return;
  const ws = viewerSignalingSockets.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
});
// --- Utility Functions ---
const getFFmpegPath = () => {
  if (app.isPackaged) return join(process.resourcesPath, 'ffmpeg.exe');
  
  // Dev mode: try common monorepo and local paths
  const paths = [
    join(app.getAppPath(), '../../node_modules/ffmpeg-static/ffmpeg.exe'),
    join(app.getAppPath(), 'node_modules/ffmpeg-static/ffmpeg.exe'),
  ];
  
  const fs = require('fs');
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback to module resolution
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch (e) {}

  return 'ffmpeg'; // System PATH fallback
};

// Path to the bundled elevated input/capture service exe (Remote365InputSvc).
const getInputServicePath = () => {
  if (app.isPackaged) return join(process.resourcesPath, 'Remote365InputSvc.exe');
  const candidates = [
    join(app.getAppPath(), '../../service/Remote365InputSvc/Remote365InputSvc.exe'),
    join(app.getAppPath(), 'service/Remote365InputSvc/Remote365InputSvc.exe'),
  ];
  for (const p of candidates) { if (existsSync(p)) return p; }
  return '';
};

// The elevated service is what lets injected input AND screen capture reach the
// Windows secure desktop (lock / UAC / PIN screen). It must run as a LocalSystem
// service; installing/updating it needs one admin (UAC) prompt.
//
// It is installed from an app-managed copy at C:\ProgramData\Remote365\ — NOT
// straight from the app's resources dir. That matters: the running service locks
// its own exe, so if it ran from resources, an app auto-update could never
// replace that exe (NSIS can't overwrite a locked file) and the service would be
// stuck on the old build forever. Running from ProgramData lets the app always
// refresh the bundled resources copy, then propagate it here (stopping the
// service first) on the next host-start. The install is IDEMPOTENT and never
// deletes a working service, so it can't strand the machine without input
// (which previously broke Task Manager control).
const SECURE_SERVICE_STAMP = () => join(app.getPath('userData'), 'secure_input_service_version.txt');
const SECURE_SERVICE_INSTALL_PATH = 'C:\\ProgramData\\Remote365\\Remote365InputSvc.exe';

function readSecureInputServiceState() {
  try {
    const config = execSync('sc.exe qc Remote365InputSvc', { encoding: 'utf8', windowsHide: true });
    const status = execSync('sc.exe query Remote365InputSvc', { encoding: 'utf8', windowsHide: true });
    const binaryLine = config.match(/BINARY_PATH_NAME\s*:\s*(.+)/i)?.[1]?.trim() || '';
    return {
      installed: true,
      usesManagedPath: binaryLine.toLowerCase().includes(SECURE_SERVICE_INSTALL_PATH.toLowerCase()),
      running: /STATE\s*:\s*4\s+RUNNING/i.test(status),
      binaryPath: binaryLine,
    };
  } catch {
    return { installed: false, usesManagedPath: false, running: false, binaryPath: '' };
  }
}

let secureServiceInstallInFlight = false;
let secureServiceAttemptedThisRun = false;
async function ensureElevatedInputService(force = false): Promise<{ ok: boolean; reason?: string }> {
  if (process.platform !== 'win32') return { ok: false, reason: 'not-windows' };
  if (secureServiceInstallInFlight) return { ok: false, reason: 'in-flight' };
  // Don't re-prompt for UAC within one app run if the user already declined.
  if (!force && secureServiceAttemptedThisRun) return { ok: false, reason: 'attempted-this-run' };

  const src = getInputServicePath();
  if (!src || !existsSync(src)) {
    log.warn(`[SecureInput] Service exe not found (looked at "${src}"); skipping install.`);
    return { ok: false, reason: 'exe-missing' };
  }

  // Stamp by the SERVICE BINARY's content hash — not the app version. Stamping
  // by app version re-prompted UAC after every routine app update even when
  // the service exe was byte-identical, which is exactly the "UAC on every
  // update" complaint. Now the prompt only appears when the service itself
  // actually changed.
  const serviceHash = (() => {
    try { return crypto.createHash('sha256').update(readFileSync(src)).digest('hex'); } catch { return ''; }
  })();
  if (!serviceHash) return { ok: false, reason: 'exe-unreadable' };
  const stampPath = SECURE_SERVICE_STAMP();
  if (!force) {
    try {
      const stampedHash = readFileSync(stampPath, 'utf8').trim();
      const installedHash = crypto.createHash('sha256')
        .update(readFileSync(SECURE_SERVICE_INSTALL_PATH))
        .digest('hex');
      let serviceState = readSecureInputServiceState();
      if (installedHash === serviceHash && serviceState.installed && serviceState.usesManagedPath) {
        if (!serviceState.running) {
          // Starting may succeed without elevation when the service ACL permits
          // it. Otherwise the elevated repair path below takes over.
          try {
            execSync('sc.exe start Remote365InputSvc', { windowsHide: true, stdio: 'ignore' });
          } catch { /* elevation may be required */ }
          serviceState = readSecureInputServiceState();
        }
        if (serviceState.running) return { ok: true, reason: 'already-current' };
      }
      if (stampedHash === serviceHash) {
        // Older updaters could keep the stamp while deleting or stopping the
        // real service. Repair instead of trusting stale metadata.
        log.warn(
          `[SecureInput] Version stamp is current but service health is not ` +
          `(installed=${serviceState.installed}, managedPath=${serviceState.usesManagedPath}, running=${serviceState.running}); repairing.`
        );
      }
    } catch { /* no stamp yet — proceed to install */ }
  }

  secureServiceInstallInFlight = true;
  secureServiceAttemptedThisRun = true;
  log.info(`[SecureInput] Installing/updating elevated service (binary ${serviceHash.slice(0, 12)}…) from ${src} (one UAC prompt)...`);
  try {
    // Elevated, one shell: stop the service (releases the ProgramData exe), copy
    // the fresh bundled build over it, then `--install` (idempotent: repoints an
    // existing service + restarts, or creates one). No `--uninstall`, so a
    // working service is never torn down.
    const dst = SECURE_SERVICE_INSTALL_PATH;
    const dstDir = 'C:\\ProgramData\\Remote365';
    const inner = [
      `New-Item -ItemType Directory -Force -Path ${quotePowerShellArg(dstDir)} | Out-Null`,
      `sc.exe stop Remote365InputSvc | Out-Null`,
      `Start-Sleep -Milliseconds 1200`,
      `Copy-Item -Force ${quotePowerShellArg(src)} ${quotePowerShellArg(dst)}`,
      `& ${quotePowerShellArg(dst)} --install`,
    ].join('; ');
    const encoded = Buffer.from(inner, 'utf16le').toString('base64');
    const script = `Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}')`;
    await new Promise<void>((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
      let stderr = '';
      child.stderr?.on('data', (d) => { stderr += d.toString(); });
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr || `exit ${code}`)));
    });
    try { require('fs').writeFileSync(stampPath, serviceHash); } catch { /* stamp is best-effort */ }
    log.info('[SecureInput] Elevated service installed/updated.');
    return { ok: true };
  } catch (err: any) {
    // User declined UAC or install failed — log and carry on with the fallback.
    log.warn(`[SecureInput] Could not install elevated service (lock-screen control unavailable): ${err?.message || err}`);
    return { ok: false, reason: String(err?.message || err) };
  } finally {
    secureServiceInstallInFlight = false;
  }
}

// Renderer can trigger the install explicitly (e.g. a "Enable lock-screen control"
// action), forcing a reinstall regardless of the version stamp.
ipcMain.handle('system:installSecureDesktopService', () => ensureElevatedInputService(true));

async function getAuthTokens() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { token: null, refresh: null };
    const data = await fs.readFile(AUTH_STORE_PATH, 'utf8');
    const { encToken, encRefresh } = JSON.parse(data);
    return {
      token: safeStorage.decryptString(Buffer.from(encToken, 'hex')),
      refresh: safeStorage.decryptString(Buffer.from(encRefresh, 'hex'))
    };
  } catch (e) { return { token: null, refresh: null }; }
}

async function setAuthTokens(token: string, refresh: string) {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const encrypted = {
      encToken: safeStorage.encryptString(token).toString('hex'),
      encRefresh: safeStorage.encryptString(refresh).toString('hex')
    };
    await fs.writeFile(AUTH_STORE_PATH, JSON.stringify(encrypted));
    return true;
  } catch (e) { return false; }
}

// ---- Host annotation overlay -------------------------------------------------
// A transparent, click-through, always-on-top window over the host's primary
// display that renders the whiteboard strokes a viewer draws and fades each one
// out after its TTL — so the person sitting at the host machine can see them.
let hostAnnotationWindow: BrowserWindow | null = null;
let hostAnnotationReady = false;
let hostAnnotationBuffer: any[] = [];

function hostAnnotationOverlayHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;cursor:default;}
canvas{display:block;width:100%;height:100%;}</style></head>
<body><canvas id="c"></canvas>
<script>
  const { ipcRenderer } = require('electron');
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const FADE = 900;
  function resize(){ const dpr = window.devicePixelRatio || 1; canvas.width = Math.floor(innerWidth*dpr); canvas.height = Math.floor(innerHeight*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); }
  resize(); window.addEventListener('resize', resize);
  let prims = [];
  const dn = (p) => ({ x: ((p&&p.x)||0) * innerWidth, y: ((p&&p.y)||0) * innerHeight });
  ipcRenderer.on('host-annotation:draw', (_e, ev) => {
    if (!ev) return;
    if (ev.action === 'clear') { prims = []; return; }
    const now = performance.now();
    const ttl = Math.max(1200, ev.ttlMs || 6500);
    if (ev.action === 'line' && ev.tool !== 'eraser') prims.push({ kind:'line', from: dn(ev.from), to: dn(ev.to), color: ev.color||'#FF8A00', tool: ev.tool, bornAt: now, ttl });
    else if (ev.action === 'shape') prims.push({ kind:'shape', tool: ev.tool, start: dn(ev.start), end: dn(ev.end), color: ev.color||'#FF8A00', bornAt: now, ttl });
    else if (ev.action === 'text') prims.push({ kind:'text', point: dn(ev.point), text: String(ev.text||''), color: ev.color||'#FF8A00', bornAt: now, ttl });
  });
  function frame(){
    const now = performance.now();
    ctx.clearRect(0,0,innerWidth,innerHeight);
    prims = prims.filter(p => now - p.bornAt < p.ttl);
    for (const p of prims){
      const remain = p.ttl - (now - p.bornAt);
      ctx.globalAlpha = remain >= FADE ? 1 : Math.max(0, remain/FADE);
      if (p.kind === 'line'){ ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth = p.tool==='marker'?9:3; ctx.strokeStyle = p.tool==='marker' ? (p.color+'99') : p.color; ctx.beginPath(); ctx.moveTo(p.from.x,p.from.y); ctx.lineTo(p.to.x,p.to.y); ctx.stroke(); }
      else if (p.kind === 'shape'){ ctx.strokeStyle=p.color; ctx.lineWidth=3; const w=p.end.x-p.start.x, h=p.end.y-p.start.y; if (p.tool==='rect'){ ctx.strokeRect(p.start.x,p.start.y,w,h); } else { ctx.beginPath(); ctx.ellipse(p.start.x+w/2,p.start.y+h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2); ctx.stroke(); } }
      else if (p.kind === 'text'){ ctx.fillStyle=p.color; ctx.font='600 18px "Segoe UI", system-ui, sans-serif'; ctx.fillText(p.text, p.point.x, p.point.y); }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
</script></body></html>`;
}

function ensureHostAnnotationOverlay(): BrowserWindow | null {
  if (hostAnnotationWindow && !hostAnnotationWindow.isDestroyed()) return hostAnnotationWindow;
  try {
    const { screen } = require('electron');
    const b = screen.getPrimaryDisplay().bounds;
    const win = new BrowserWindow({
      x: b.x, y: b.y, width: b.width, height: b.height,
      transparent: true, frame: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, skipTaskbar: true,
      focusable: false, hasShadow: false, alwaysOnTop: true,
      fullscreenable: false, show: false, backgroundColor: '#00000000',
      webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false }
    });
    win.setIgnoreMouseEvents(true, { forward: true });
    try { win.setAlwaysOnTop(true, 'screen-saver'); } catch {}
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
    hostAnnotationReady = false;
    hostAnnotationBuffer = [];
    win.webContents.once('did-finish-load', () => {
      hostAnnotationReady = true;
      for (const ev of hostAnnotationBuffer) { try { win.webContents.send('host-annotation:draw', ev); } catch {} }
      hostAnnotationBuffer = [];
    });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(hostAnnotationOverlayHtml()));
    win.on('closed', () => { hostAnnotationWindow = null; hostAnnotationReady = false; hostAnnotationBuffer = []; });
    hostAnnotationWindow = win;
    return win;
  } catch (e: any) {
    log.warn('[HostAnnotation] Failed to create overlay: ' + (e?.message || e));
    return null;
  }
}

function showHostAnnotation(event: any) {
  const win = ensureHostAnnotationOverlay();
  if (!win) return;
  if (!win.isVisible()) { try { win.showInactive(); } catch {} }
  if (hostAnnotationReady) { try { win.webContents.send('host-annotation:draw', event); } catch {} }
  else hostAnnotationBuffer.push(event);
}

function destroyHostAnnotationOverlay() {
  if (hostAnnotationWindow && !hostAnnotationWindow.isDestroyed()) {
    try { hostAnnotationWindow.close(); } catch {}
  }
  hostAnnotationWindow = null;
  hostAnnotationReady = false;
  hostAnnotationBuffer = [];
}

function closeHostPeerResource(peer: HostViewerPeer, key: 'dataChannel' | 'inputDataChannel' | 'criticalInputDataChannel' | 'fileDataChannel' | 'videoTrack' | 'peerConnection') {
  const resource = peer[key];
  if (!resource) return;
  try {
    if (typeof resource.close === 'function') resource.close();
  } catch (err: any) {
    log.warn(`[Host] Error closing ${key} for ${peer.viewerId}: ${err?.message || err}`);
  }
  peer[key] = null;
}

function cleanupHostViewerPeer(viewerId: string | null | undefined, reason = 'ended') {
  if (!viewerId) return;
  // initiateHostWebRTC pre-cleans with reason 'reconnecting-same-viewer' RIGHT
  // AFTER viewer-joined stored the connecting user's name — deleting the name
  // there would blank the dock ("Remote viewer" instead of the account name).
  // Only forget the identity when the viewer is actually going away.
  if (reason !== 'reconnecting-same-viewer') {
    hostViewerNames.delete(viewerId);
    hostViewerDeviceIds.delete(viewerId);
    hostViewerUnattended.delete(viewerId);
    hostViewerSkipsConsent.delete(viewerId);
    lastControlDeniedAt.delete(viewerId);
    hostViewerFileCaps.delete(viewerId);
    // Their camera tile has nothing left to show once they are gone.
    if (viewerCameraOwnerId === viewerId) {
      viewerCameraOwnerId = null;
      hideViewerCameraWindow();
    }
    if (hostAudioListeners.delete(viewerId)) updateHostAudioDock();
    const recorderName = hostSessionRecorders.get(viewerId);
    if (recorderName) {
      hostSessionRecorders.delete(viewerId);
      announceSessionRecording(false, recorderName, viewerId);
    }
  }
  const peer = hostViewerPeers.get(viewerId);
  if (!peer) return;
  log.info(`[Host] Cleaning up viewer peer ${viewerId} (${reason})...`);
  hostViewerPeers.delete(viewerId);

  if (peer.clipboardInterval) { clearInterval(peer.clipboardInterval); peer.clipboardInterval = null; }
  if (peer.pingInterval) { clearInterval(peer.pingInterval); peer.pingInterval = null; }
  closeHostPeerResource(peer, 'dataChannel');
  closeHostPeerResource(peer, 'inputDataChannel');
  closeHostPeerResource(peer, 'criticalInputDataChannel');
  closeHostPeerResource(peer, 'fileDataChannel');
  closeHostPeerResource(peer, 'videoTrack');
  closeHostPeerResource(peer, 'peerConnection');
  // The audio track dies with its peer connection; just drop the references so
  // the native wrapper and its RTP config can be collected with the peer.
  peer.audioTrack = null;
  peer.audioRtpConfig = null;
  syncLegacyPeerAliases(getPrimaryHostPeer());

  if (hostViewerPeers.size === 0) {
    scheduleStreamWorkerIdleKill();
    setTimeout(updateMainWindowThrottling, 5000);
    setWebLockState(false);
    mainWindow?.webContents.send('host:remote-control', false);
    setHostAudioCapture(false, 'session-ended');
    hideHostConsentWindow();
    hideHostDesktopDock();
    hideHostChatWindow(true);
    destroyHostAnnotationOverlay();
    for (const vk of heldModifierVKs) {
      try { input.injectKeyAction(vk, 'up'); } catch {}
    }
    heldModifierVKs.clear();
    stopStreaming();
    currentViewerId = null;
    controlGranted = false;
    pendingControlViewerId = null;
    iceCandidatesQueue = [];
    hasRemoteDescription = false;
    scheduleDeferredUpdateInstall('host-session-ended');
  } else {
    if (!hasActiveMediaViewer(hostViewerPeers.values())) {
      stopStreaming();
      setHostAudioCapture(false, 'viewers-parked', true);
    }
    // Viewers remain — refresh the dock so the departed user's row disappears.
    showHostDesktopDock({ viewerNames: collectDockViewerNames() });
  }
}

function cleanUpWebRTC() {
  if (hostViewerPeers.size > 0) {
    log.info('[Host] Cleaning up all WebRTC viewer peers...');
    for (const viewerId of Array.from(hostViewerPeers.keys())) {
      cleanupHostViewerPeer(viewerId, 'full-cleanup');
    }
    return;
  }

  log.info('[Host] Cleaning up WebRTC resources...');
  // Remote control has ended — release the main-window UI lock.
  setWebLockState(false);
  mainWindow?.webContents.send('host:remote-control', false);
  setHostAudioCapture(false, 'webrtc-cleanup');
  hideHostConsentWindow();
  hideHostDesktopDock();
  hideHostChatWindow(true);
  destroyHostAnnotationOverlay();
  // Release any modifier keys left "held" from injected input so a dropped
  // connection mid-Shift/Ctrl/Alt never leaves the host stuck with a phantom
  // modifier down.
  for (const vk of heldModifierVKs) {
    try { input.injectKeyAction(vk, 'up'); } catch {}
  }
  heldModifierVKs.clear();
  stopStreaming();

  if (dataChannel) {
    try {
      // Ensure we only close if still open to avoid native crashes
      if (typeof dataChannel.close === 'function') dataChannel.close();
    } catch (err) {
      log.warn('[Host] Error closing dataChannel:', err);
    }
    dataChannel = null;
  }

  if (inputDataChannel) {
    try {
      if (typeof inputDataChannel.close === 'function') inputDataChannel.close();
    } catch (err) {
      log.warn('[Host] Error closing inputDataChannel:', err);
    }
    inputDataChannel = null;
  }

  if (criticalInputDataChannel) {
    try {
      if (typeof criticalInputDataChannel.close === 'function') criticalInputDataChannel.close();
    } catch (err) {
      log.warn('[Host] Error closing criticalInputDataChannel:', err);
    }
    criticalInputDataChannel = null;
  }

  if (videoTrack) {
    try {
      if (typeof videoTrack.close === 'function') videoTrack.close();
    } catch (err) {
      log.warn('[Host] Error closing videoTrack:', err);
    }
    videoTrack = null;
  }

  if (peerConnection) {
    try {
      if (typeof peerConnection.close === 'function') peerConnection.close();
    } catch (err) {
      log.warn('[Host] Error closing peerConnection:', err);
    }
    peerConnection = null;
  }

  iceCandidatesQueue = [];
  hasRemoteDescription = false;
  currentViewerId = null;
  controlGranted = false;
  pendingControlViewerId = null;
  if (clipboardInterval) { clearInterval(clipboardInterval); clipboardInterval = null; }
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
  // cleanUpWebRTC also runs when a NEW offer arrives (state reset), so the
  // deferred install re-checks for an active session after a grace period.
  scheduleDeferredUpdateInstall('host-session-ended');
}


// ---- Stream worker lifetime ----
// The capture/encode utilityProcess used to be forked at app launch and kept
// forever. Now it exists only around sessions: forked the moment a viewer
// starts connecting (signaling arrives well before WebRTC finishes, so the
// process spawn never delays the first frame) and killed after two idle
// minutes, which also returns its 3 full-screen BGRA frame buffers.
// ---- Main-window throttling while tucked away ----
// The main window is created with backgroundThrottling:false because host
// sessions lean on its renderer (audio capture, approval UI). But "closing" it
// only hides it to the tray, and an un-throttled hidden renderer keeps every
// timer, the 1 Hz stats re-render and any looping animation running at full
// rate all day. So throttle it whenever it is hidden or minimized AND no
// session is live or starting; lift the throttle the moment either changes.
let mainWindowThrottleHoldUntil = 0;
let mainWindowThrottleTimer: NodeJS.Timeout | null = null;
function updateMainWindowThrottling() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const tuckedAway = !mainWindow.isVisible() || mainWindow.isMinimized();
  const sessionLive = hostViewerPeers.size > 0 || Boolean(videoTrack) || Date.now() < mainWindowThrottleHoldUntil;
  try { mainWindow.webContents.setBackgroundThrottling(tuckedAway && !sessionLive); } catch { /* window going away */ }
}
/** A session is starting: keep the renderer at full rate through the handshake. */
function holdMainWindowFullRate(ms = 90_000) {
  mainWindowThrottleHoldUntil = Date.now() + ms;
  updateMainWindowThrottling();
  if (mainWindowThrottleTimer) clearTimeout(mainWindowThrottleTimer);
  mainWindowThrottleTimer = setTimeout(() => { mainWindowThrottleTimer = null; updateMainWindowThrottling(); }, ms + 1000);
}

const STREAM_WORKER_IDLE_KILL_MS = 120_000;
let streamWorkerIdleTimer: NodeJS.Timeout | null = null;
function preforkStreamWorker() {
  holdMainWindowFullRate();
  if (streamWorkerIdleTimer) { clearTimeout(streamWorkerIdleTimer); streamWorkerIdleTimer = null; }
  if (isStreamWorkerEnabled()) startStreamWorker();
  // A denied or abandoned request never reaches peer teardown, so arm the idle
  // kill here too; it re-checks for a live session when it fires.
  scheduleStreamWorkerIdleKill();
}
function scheduleStreamWorkerIdleKill() {
  if (streamWorkerIdleTimer) clearTimeout(streamWorkerIdleTimer);
  streamWorkerIdleTimer = setTimeout(() => {
    streamWorkerIdleTimer = null;
    if (hostViewerPeers.size > 0 || videoTrack) return;
    log.info('[Host] No session for 2 minutes — stopping the stream worker to free memory.');
    stopStreamWorker();
  }, STREAM_WORKER_IDLE_KILL_MS);
}

function stopStreaming() {
  onDemandKeyframesActive = false;
  if (forcedKeyframeTimer) { clearTimeout(forcedKeyframeTimer); forcedKeyframeTimer = null; }
  if (isStreamWorkerEnabled()) stopWorkerStream();
  try { (capture as any)?.setHighResTimers?.(false); } catch { /* older binary */ }
  mainSecureCapture.deactivate();
  // A pending AU stall-flush must not fire into a stopped/restarting pipeline
  // with the previous stream's leftover bytes.
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  if (cursorInterval) {
    clearInterval(cursorInterval);
    cursorInterval = null;
  }
  if (ffmpegProcess) {
    ffmpegProcess.stdin?.end();
    ffmpegProcess.kill();
    ffmpegProcess = null;
  }
  if (initPollInterval) {
    clearInterval(initPollInterval);
    initPollInterval = null;
  }
}

// --- Encoder Detection ---

/** Build encoder-specific FFmpeg args for low-latency, high-quality streaming.
 *  ALL encoders must emit AUD NAL units so the frame splitter works correctly. */
// Intel QSV rate-control retreat. The VBR arguments below could not be measured
// (no Intel GPU on the build machine), so the first unexpected encoder exit on
// QSV flips this and the stream restarts on the previous CBR arguments BEFORE
// the generic fall-back to libx264 is considered. Worst case = old behaviour.
let qsvVbrRejected = false;
function nvencRateControl(): 'vbr' | 'cbr' {
  return String(process.env.REMOTE365_NVENC_RC || '').toLowerCase() === 'cbr' ? 'cbr' : 'vbr';
}
/** Short label for logs: which rate-control mode the active encoder runs. */
function describeRateControl(encoder: string): string {
  if (encoder === 'h264_nvenc') return nvencRateControl();
  if (encoder === 'h264_qsv') return qsvVbrRejected ? 'cbr(retreat)' : 'vbr';
  if (encoder === 'h264_amf') return 'cbr-nofiller';
  return 'capped-crf';
}

/** Encoders the on-demand keyframe mechanism was verified on (bundled FFmpeg 6.1.1). */
function encoderSupportsOnDemandKeyframes(encoder: string): boolean {
  // NVENC and libx264 were verified directly. QSV exposes the same control
  // (-forced_idr) but could not be tried on the build machine, so it runs under
  // the keyframe watchdog in requestHostKeyframe: if forced keyframes are asked
  // for and no IDR ever comes out, on-demand mode is switched off for the run.
  // AMF in FFmpeg 6.1 has no forced-IDR option, so AMD keeps the periodic GOP.
  return encoder === 'h264_nvenc' || encoder === 'libx264' || encoder === 'h264_qsv';
}

function getEncoderArgs(encoder: string, bitrate: string, fps: string, gopSeconds = 2, onDemand = false): string[] {
  const args = buildEncoderArgs(encoder, bitrate, fps, onDemand ? ON_DEMAND_SAFETY_GOP_SECONDS : gopSeconds);
  if (!onDemand) return args;
  const fpsInt = Math.max(1, Math.round(parseFloat(fps) || 30));
  return [
    // Timestamps come from the worker's IVF framing and must reach the encoder
    // untouched: passthrough (no dup/drop), encoder timebase = one tick/frame.
    '-fps_mode', 'passthrough',
    '-enc_time_base', `1:${fpsInt}`,
    // ticks seen - frames seen = keyframe requests so far (each skips a tick);
    // force a keyframe whenever that exceeds the keyframes already forced.
    // (Plain comma: spawn() passes this without a shell, and FFmpeg takes
    // everything after "expr:" as one expression — verified both ways.)
    '-force_key_frames', `expr:gt(round(t*${fpsInt})-n,n_forced)`,
    // A forced I-frame must be a real IDR or Chromium will not resume on it.
    // (The option is spelled with an underscore on QSV.)
    encoder === 'h264_qsv' ? '-forced_idr' : '-forced-idr', '1',
    ...args,
  ];
}
// With keyframes on demand a periodic keyframe is only a belt-and-braces net
// for a decoder that went wrong without ever asking. One minute, not two
// seconds: each one is still a 120-250 ms hitch.
const ON_DEMAND_SAFETY_GOP_SECONDS = Math.max(2, Number(process.env.REMOTE365_ONDEMAND_GOP_SECONDS) || 60);

function buildEncoderArgs(encoder: string, bitrate: string, fps: string, gopSeconds = 2): string[] {
  const bitrateKbps = parseInt(bitrate, 10) || 6500;
  // VBV buffer = ~0.5s of bitrate. The old 0.12 (~120ms) was the cause of the
  // "click Back -> everything goes blurry, then sharpens a moment later" complaint:
  // a navigation changes every macroblock at once, but with scenecut disabled that
  // arrives as a DELTA frame, and a 120ms buffer let it spend barely a tenth of a
  // second of bits. The encoder's only lever is to raise QP across the whole frame,
  // so the picture goes soft until the next periodic IDR refines it.
  // A 0.5s buffer lets a burst frame borrow from neighbouring frames and stay sharp,
  // while -maxrate still caps the long-run average so the send queue never floods.
  //
  // ...but capped at 2250 kbit, the size the default 4500k tier has always run.
  // Uncapped, the VBV scaled with the tier, so a keyframe on the 12000k tier was
  // allowed 750 kbit of burst and really took it: measured Sep 2026 on a real
  // 1080p desktop capture, 370 KB per keyframe = 253 ms to leave the 12 Mbps
  // pacer, with every following frame queued behind it. Capped: 195 KB / 133 ms,
  // and the keyframe's quality is unchanged (PSNR min 44.0 vs 44.5 dB).
  const vbvCapKbit = Number(process.env.REMOTE365_VBV_KBITS) || 2250;
  const bufferSize = `${Math.min(vbvCapKbit, Math.max(500, Math.round(bitrateKbps * 0.5)))}k`;
  // ~0.5s GOP. The old ~167ms GOP (5-6 keyframes/sec) wasted most of a CBR
  // budget re-sending full frames, which crushed delta-frame detail and made the
  // encoder VBV oscillate — the main cause of stutter and "soft" video on
  // long-haul links. A 0.5s keyframe interval keeps loss-recovery fast while
  // freeing ~3x more bits for real motion detail and smoother bandwidth.
  //
  // Sep 2026: 0.5 s was still far too often. A keyframe of a real text-heavy
  // 1080p desktop is 160-330 KB; the RTP pacer needs 120-220 ms to send one and
  // every frame behind it waits in the same FIFO. Measured on a real desktop
  // capture, the share of frames arriving >40 ms late was 20% at the 4500k tier
  // and 40% at 12000k — a judder twice a second that reads as "the refresh rate
  // is not stable", in CBR and VBR alike. At a 2 s interval it is 6% / 10%, the
  // idle bitrate falls 3.1 -> 1.4 Mbps (keyframes WERE the idle traffic) and
  // average quality rises 43.7 -> 50.0 dB because the bits go to real content.
  // The cost is loss recovery: Chromium resumes only on a keyframe, so an
  // unrepaired loss can now freeze for up to the GOP. RTCP NACK repairs ordinary
  // loss well inside that; the lossy 'smooth' tier asks for 1 s (see call site).
  // Intra-refresh measured even better (0 late frames) but is NOT usable here:
  // it never emits a keyframe and this FFmpeg-CLI pipeline cannot force one on
  // demand, so one unrepaired loss would freeze the viewer until a restart.
  const gopSecondsEff = Number(process.env.REMOTE365_GOP_SECONDS) || gopSeconds;
  const gop = String(Math.max(15, Math.round((parseInt(fps, 10) || 30) * gopSecondsEff)));
  switch (encoder) {
    case 'h264_nvenc':
      return [
        '-c:v', 'h264_nvenc',
        '-preset', 'p4',
        // 'ull' (ultra-low-latency), not 'll': 'll' keeps more of NVENC's internal
        // pipelining. Same p4 quality point.
        '-tune', 'ull',
        // Zero output-queue depth: emit encoded frame N before accepting N+1.
        '-delay', '0',
        // HIGH profile, not baseline. Baseline has no CABAC and no 8x8 transform, which
        // costs roughly 10-15% efficiency outright and hurts worst on exactly what we send:
        // sharp-edged text and UI. It exists for legacy handset decoders; every browser and
        // Electron build we target decodes High fine. B-frames stay off (-bf 0) so latency
        // is unchanged — this is free quality at the same bitrate.
        '-profile:v', 'high',
        // VBR with the SAME -maxrate/-bufsize ceiling, not CBR. FFmpeg 6.1's NVENC
        // CBR pads the stream with filler up to the target: measured Sep 2026 on a
        // static 1080p frame it emitted exactly 4499 kbps at the 4500k tier and
        // 10000 kbps at the 10000k tier — a desktop nobody was touching cost the
        // full tier rate, forever. VBR on the same frame: 1315 / 1767 kbps (the
        // remainder is the 0.5 s keyframes). Under full motion both modes emit the
        // identical 4507 / 10023 kbps because the VBV ceiling is what binds, so
        // burst size, queueing and latency under load are unchanged.
        // REMOTE365_NVENC_RC=cbr restores the old padded mode on one host, so a
        // "video feels different" report can be A/B-tested in the field.
        '-rc:v', nvencRateControl(),
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        // Keep keyframes STRICTLY periodic. Without this, a scene-change (the
        // remote user dragging a window, switching apps, video playback) makes
        // NVENC emit an unscheduled full IDR. On a constrained/long-haul link
        // that bitrate spike floods the send queue -> frames pile up then flush
        // together, which is exactly the "delayed, then all at once" symptom.
        '-no-scenecut', '1',
        '-strict_gop', '1',
        '-bf', '0',
        '-rc-lookahead', '0',
        '-spatial-aq', '1',
        // temporal-aq removed: NVENC temporal AQ needs lookahead, which we run at 0 —
        // at best it was inert, at worst the driver grew a hidden lookahead to satisfy it.
        // Strength 4, down from 10. Spatial AQ moves bits INTO flat regions
        // (anti-banding) and AWAY from high-detail regions — and on a desktop,
        // "high-detail" is exactly the text. Strength 10 systematically starved
        // text macroblocks of bits (soft, smudged glyphs); 4 keeps gradients
        // clean without taxing the content people actually read.
        '-aq-strength', '4',
        '-zerolatency', '1',
        // Write BT.709 into the SPS VUI so the decoder stops guessing the color
        // space. Pairs with out_color_matrix=bt709 in the scale filter — the
        // stream is now both CONVERTED and TAGGED as 709 end to end. The avctx
        // flags cover encoders that honor them; the h264_metadata bsf below
        // rewrites the SPS bits directly, so the tag lands even on driver paths
        // that ignore avctx colorimetry (1 = BT.709 for all three fields).
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        // dump_extra forces SPS+PPS before every IDR so the browser decoder can always init
        '-bsf:v', 'dump_extra,h264_metadata=aud=insert:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
        // Push every encoded packet to stdout immediately — without this, small
        // delta frames (the common case on a mostly-static desktop) pool in the
        // muxer's 32KB AVIO buffer across several frame intervals.
        '-flush_packets', '1',
        '-f', 'h264', '-'
      ];
    case 'h264_amf':
      return [
        '-c:v', 'h264_amf',
        '-usage', 'ultlowlatency',
        // Left at 'balanced': no AMD GPU was available to verify a change here, and the
        // profile bump below is the win that matters. Don't tune this path blind.
        '-quality', 'balanced',
        '-profile:v', 'high',
        // CBR is kept here on purpose. Unlike NVENC, FFmpeg's AMF wrapper always
        // sets AMF_VIDEO_ENCODER_FILLER_DATA_ENABLE from -filler_data, which
        // defaults to false (amfenc_h264.c, release/6.1) — so an AMD host does
        // not pad a static desktop up to the target. Stated explicitly below so
        // a future FFmpeg default change can't silently turn padding on. No AMD
        // GPU was available to measure a different mode, so none is guessed at.
        '-rc', 'cbr',
        '-filler_data', '0',
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        '-bf', '0',
        // BT.709 VUI tagging — see the nvenc case.
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-bsf:v', 'dump_extra,h264_metadata=aud=insert:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
        '-flush_packets', '1',
        '-f', 'h264', '-'
      ];
    case 'h264_qsv':
      return [
        '-c:v', 'h264_qsv',
        '-preset', 'faster',
        '-profile:v', 'high',
        // libmfx defaults to async_depth=4 — four frames (~133ms at 30fps) held
        // INSIDE the encoder pipeline. Depth 1 = submit, encode, emit.
        '-async_depth', '1',
        // FFmpeg picks the QSV rate-control mode from these two numbers
        // (qsvenc.c select_rc_mode, release/6.1): maxrate == bitrate selects
        // MFX CBR, anything else selects MFX VBR. CBR is HRD-conformant, which
        // means filler up to the target — the same "static desktop costs the
        // full tier" behaviour measured on NVENC. One kbps under the ceiling
        // flips the mode to VBR while leaving target and ceiling effectively
        // unchanged. UNMEASURED (no Intel GPU on the build machine): see
        // qsvVbrRejected for the automatic retreat to the old arguments.
        '-b:v', qsvVbrRejected ? bitrate : `${Math.max(500, bitrateKbps - 1)}k`,
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        '-bf', '0',
        // BT.709 VUI tagging — see the nvenc case.
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-bsf:v', 'dump_extra,h264_metadata=aud=insert:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
        '-flush_packets', '1',
        '-f', 'h264', '-'
      ];
    default: // libx264 â€” CPU fallback
      return [
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-tune', 'zerolatency',
        '-profile:v', 'high',
        // Capped CRF, not average bitrate. ABR keeps spending toward its target
        // even when nothing moves (measured 2489 kbps on a static 1080p frame at
        // the 4500k tier); CRF 18 is visually lossless for text and stops once it
        // gets there (1535 kbps), while -maxrate/-bufsize still bind under motion
        // (4776 vs 4645 kbps — the same ceiling). -crf and -b:v are mutually
        // exclusive in libx264, so -b:v is intentionally absent here.
        '-crf', '18',
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        // scenecut=0: never insert an unscheduled keyframe on scene changes.
        // Periodic-only IDRs keep CBR bandwidth flat so motion bursts don't
        // spike the send queue and cause the freeze-then-burst symptom.
        // cabac + 8x8dct come with High profile and are the whole point of leaving
        // baseline behind; -tune zerolatency would otherwise leave cabac off.
        // weightp=0: DISABLE weighted P-prediction. libx264 High turns it on by
        // default, but Chromium's H.264 receiver can't parse pred_weight_table
        // slice headers ("Streams with pred_weight_table unsupported" spam, one
        // line PER SLICE) — it degrades decode and floods the viewer. Weighted
        // pred only helps fades/dissolves; for desktop/screen content it costs
        // encode time for ~nothing. Off = parseable stream + faster CPU encode.
        '-x264-params', `keyint=${gop}:bframes=0:aud=1:scenecut=0:cabac=1:8x8dct=1:weightp=0`,
        // BT.709 VUI tagging — see the nvenc case.
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-bsf:v', 'dump_extra',
        '-flush_packets', '1',
        '-f', 'h264', '-'
      ];
  }
}

/** Probe one encoder with a tiny synthetic test clip. 2s timeout. */
function probeEncoder(ffmpegPath: string, encoder: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok); } };
    try {
      const p = spawn(ffmpegPath, [
        '-f', 'lavfi', '-i', 'color=black:s=64x64:r=1:d=0.1',
        '-c:v', encoder, '-f', 'null', '-'
      ]);
      p.on('close', (code: any) => finish(code === 0));
      p.on('error', () => finish(false));
      setTimeout(() => { try { p.kill(); } catch { } finish(false); }, 2000);
    } catch { finish(false); }
  });
}

/** Detect best available encoder once, cache result.
 *  Always runs in the background â€” never blocks the UI or a connection. */
async function detectBestEncoder(): Promise<void> {
  if (encoderDetected) return;
  if (process.env.REMOTE365_ENABLE_HW_ENCODER === '0') {
    detectedEncoder = 'libx264';
    encoderDetected = true;
    log.info('[Host] Hardware encoder disabled by REMOTE365_ENABLE_HW_ENCODER=0. Using libx264.');
    mainWindow?.webContents.send('host:status', 'Encoder: libx264');
    return;
  }
  const ffmpegPath = getFFmpegPath();
  log.info('[Host] Probing hardware encoders in background...');
  for (const enc of ['h264_nvenc', 'h264_amf', 'h264_qsv']) {
    const ok = await probeEncoder(ffmpegPath, enc);
    if (ok) {
      detectedEncoder = enc;
      encoderDetected = true;
      log.info(`[Host] Hardware encoder selected: ${enc}`);
      mainWindow?.webContents.send('host:status', `Encoder: ${enc}`);
      return;
    }
  }
  detectedEncoder = 'libx264';
  encoderDetected = true;
  log.info('[Host] Using libx264 (no GPU encoder found).');
}

// --- AV1 capability discovery (P3 groundwork) -------------------------------
// AV1 screen-content coding is the codec-level answer to sharp UI/text at low
// bitrate (see docs/latency-audit-2026-07-26.md §6/P3). Streaming AV1 needs an
// OBU temporal-unit splitter + AV1RtpPacketizer + SDP negotiation — not wired
// yet. This probe only DISCOVERS whether the host could encode AV1 in hardware
// (av1_nvenc = RTX 40-series+, av1_qsv = Intel Arc/Xe, av1_amf = RX 7000+), so
// fleet capability is known before the pipeline work is scheduled. Logged and
// exposed on the health line; changes no streaming behavior.
let detectedAv1Encoder: string | null = null;
let av1Probed = false;
async function detectAv1Capability(): Promise<void> {
  if (av1Probed) return;
  // Opt-in: this spawns up to three FFmpeg probes. It is pure survey work with
  // no effect on streaming, and on a CPU-bound host those spawns compete with
  // the encoder at the worst possible moment (session start).
  if (process.env.REMOTE365_PROBE_AV1 !== '1') return;
  av1Probed = true;
  const ffmpegPath = getFFmpegPath();
  for (const enc of ['av1_nvenc', 'av1_qsv', 'av1_amf']) {
    if (await probeEncoder(ffmpegPath, enc)) {
      detectedAv1Encoder = enc;
      log.info(`[Host] AV1 hardware encode AVAILABLE: ${enc} (pipeline not yet wired — capability discovery only).`);
      return;
    }
  }
  log.info('[Host] No AV1 hardware encoder found (H264 remains the streaming codec).');
}

// --- NAL Scanning ---

/** Simple Annex-B Scanner (Round 4).
 *  Finds 00 00 01 boundaries and returns complete NAL units. */
// Hoisted: drainNALBuffer used to allocate this 3-byte needle on every loop
// iteration of the encode hot path.
const NAL_START_CODE = Buffer.from([0, 0, 1]);
function frameHasIdr(frame: Buffer) {
  // Log-only helper: the IDR slice, when present, follows AUD/SPS/PPS/SEI at
  // the head of the AU — cap the scan instead of walking megabytes of delta
  // frames on the main thread just to label a stats line.
  const scanEnd = Math.min(frame.length - 4, 512);
  for (let i = 0; i < scanEnd; i++) {
    const isStartCode3 = frame[i] === 0 && frame[i + 1] === 0 && frame[i + 2] === 1;
    const isStartCode4 = frame[i] === 0 && frame[i + 1] === 0 && frame[i + 2] === 0 && frame[i + 3] === 1;
    if (!isStartCode3 && !isStartCode4) continue;
    const headerIndex = i + (isStartCode4 ? 4 : 3);
    const nalType = frame[headerIndex] & 0x1f;
    if (nalType === 5) return true;
  }
  return false;
}

function injectKeyCombo(keys: number[]) {
  const cleanKeys = keys.map((key: any) => Number(key)).filter(Boolean);
  for (const key of cleanKeys) input.injectKeyAction(key, 'down');
  for (const key of [...cleanKeys].reverse()) input.injectKeyAction(key, 'up');
}

function describeIceCandidate(candidate: string) {
  const type = candidate.match(/\btyp\s+(\w+)/)?.[1] || 'unknown';
  const protocol = candidate.match(/\b(udp|tcp)\b/i)?.[1]?.toLowerCase() || 'unknown';
  return `${type}/${protocol}`;
}

function drainNALBuffer() {
  while (true) {
    // Find next Annex-B start code (00 00 01)
    const syncPos = bufferAccumulator.indexOf(NAL_START_CODE, 1);
    if (syncPos === -1) {
      // No more start codes. The tail of the accumulator is an OPEN NAL and it
      // MUST NOT be sent: in Annex-B a NAL only ends where the next start code
      // begins, so there is no way to tell a complete slice from one still in
      // flight. FFmpeg's stdout is a pipe and the OS splits a large AU (any
      // keyframe) across several 'data' events — `-flush_packets 1` makes FFmpeg
      // WRITE promptly, it does not make the reader receive an AU in one chunk.
      // Emitting the tail on a quiet timer therefore ships a TRUNCATED slice
      // whenever a read gap lands mid-frame: the decoder draws the macroblocks
      // it got and smears the rest (vertical streaking across the bottom of the
      // picture), and dropping the consumed tail desyncs every following NAL
      // until the next IDR. Only completed access units are ever flushed here.
      // Never timer-flush here. Even though every NAL already appended to
      // accessUnitBuffer is individually closed, the open tail may be another
      // slice belonging to the SAME picture. Timer-flushing earlier slices
      // produces the vertical barcode/streak corruption seen on encoders that
      // emit multi-slice frames. The next AUD/SPS is the only safe AU boundary.
      break;
    }

    let nalUnitEnd = syncPos;
    // Adjust for 4-byte start code (00 00 00 01)
    if (syncPos > 0 && bufferAccumulator[syncPos - 1] === 0) {
      nalUnitEnd--;
    }

    if (nalUnitEnd > 0) {
      const nalUnit = bufferAccumulator.subarray(0, nalUnitEnd);
      
      // Parse NAL type
      let headerIdx = 0;
      while (headerIdx < nalUnit.length && nalUnit[headerIdx] === 0) headerIdx++;
      if (headerIdx < nalUnit.length && nalUnit[headerIdx] === 1) headerIdx++;
      const nalType = (headerIdx < nalUnit.length) ? (nalUnit[headerIdx] & 0x1F) : 0;

      const isNewFrame = (nalType === 9 || nalType === 7); // AUD or SPS
      const isSlice = (nalType === 1 || nalType === 5); // VCL slices

      if (isNewFrame && accessUnitBuffer.length > 0 && hasVcl) {
        sendFrame(accessUnitBuffer);
        accessUnitBuffer = Buffer.alloc(0);
        hasVcl = false;
      }

      if (isSlice) hasVcl = true;
      accessUnitBuffer = Buffer.concat([accessUnitBuffer, nalUnit]);
    }

    bufferAccumulator = bufferAccumulator.subarray(syncPos);
  }
}

// --- Video Handlers ---
function startStreaming() {
  // Delayed retries must not restart a deliberately parked stream.
  if (hostViewerPeers.size > 0 && !hasActiveMediaViewer(hostViewerPeers.values())) return;
  const displays = screen.getAllDisplays();
  const selectedDisplay = displays.find((d: any) => d.id === selectedDisplayId) || screen.getPrimaryDisplay();
  const selectedDisplayIndex = Math.max(0, displays.findIndex((d: any) => d.id === selectedDisplay.id));
  const { width, height } = selectedDisplay.bounds;
  const useNativeCapture = process.platform === 'win32' && !!capture?.captureFrame;

  const qualityKey = activeAdaptiveQuality || hostStreamSettings.quality;
  log.info(`[Host] Starting stream with encoder: ${detectedEncoder}, quality=${qualityKey} on display: ${selectedDisplay.id} / output ${selectedDisplayIndex} (${width}x${height})`);
  stopStreaming();
  // A replacement encoder begins with SPS/PPS/IDR. Never prefix it with the
  // unclosed Annex-B tail or partial access unit from the previous process.
  bufferAccumulator = Buffer.alloc(0);
  accessUnitBuffer = Buffer.alloc(0);
  hasVcl = false;
  // Geometry/profile may change across an encoder restart. Never bootstrap a
  // new decoder with an access unit produced by the previous configuration.
  latestBootstrapAccessUnit = null;
  // 1ms timer resolution while streaming (in-process path paces with setTimeout
  // too; the worker requests it for itself). Harmless if the addon is older.
  try { (capture as any)?.setHighResTimers?.(true); } catch { /* older binary */ }

  const ffmpegPath = getFFmpegPath();
  // Presets tuned for high-latency international links. High RTT alone should
  // not make the picture blurry; only real congestion/loss should step the
  // stream down. These tiers keep 1080p available for normal PK<->KSA routes.
  const qualityPresets: Record<string, { bitrate: string; maxWidth: string; fps?: string }> = {
    // Preserve native 1080p text even when the link is congested. Reducing
    // motion cadence and bitrate before spatial resolution keeps terminals,
    // menus, and small UI labels readable after a short loss event.
    smooth: { bitrate: '2800k', maxWidth: '1920', fps: '20' },
    balanced: { bitrate: '4500k', maxWidth: '1920', fps: '30' },
    // sharp keeps a 1440p desktop NATIVE. Capping it at 1920 downscaled every 2560-wide
    // display even on a healthy link — the exact "permanent text blur" the ultra comment
    // below calls out. effBitrate already lifts anything wider than 2200px to 16000k on
    // hardware encoders, so the bits to cover those extra pixels are already allocated.
    // 60fps on the top tiers (hardware encoders only — maxFps caps CPU at 30):
    // halves capture quantization AND the per-frame AU holdback, and motion
    // (scrolling, dragging) reads as glass-smooth. This is the single biggest
    // perceived-latency lever on healthy links; loss-driven tiers still step
    // down to 30fps presets when the link can't carry it.
    sharp: { bitrate: '7000k', maxWidth: '2560', fps: '60' },
    // ultra = native resolution (up to 4K) on hardware encoders. Downscaling a
    // 1440p/4K/HiDPI desktop to 1920 wide is permanent text blur — the reason
    // competitors look "crystal clear" side by side. CPU encoding still caps at
    // 1920 (weak CPUs can't do native 4K in realtime), and the bitrate steps up
    // automatically for very wide captures (see effBitrate below).
    ultra: { bitrate: '10000k', maxWidth: '3840', fps: '60' },
  };
  const preset = qualityPresets[qualityKey] || qualityPresets.sharp;
  const isCpuEncoder = detectedEncoder === 'libx264';
  const fps = process.env.REMOTE365_STREAM_FPS || hostStreamSettings.fps || preset.fps || '30';
  // Software encoding on a weak CPU cannot sustain the 9-12 Mbps tiers in real
  // time — the encoder falls behind, input frames drop (low fps) and CBR
  // starvation blurs the picture. Cap the CPU path at the balanced tier.
  const cpuMaxBitrateK = 6500;
  const presetBitrateK = parseInt(preset.bitrate, 10) || 6500;
  const bitrate = process.env.REMOTE365_STREAM_BITRATE
    || (isCpuEncoder && presetBitrateK > cpuMaxBitrateK ? `${cpuMaxBitrateK}k` : preset.bitrate);
  const maxWidth = process.env.REMOTE365_STREAM_MAX_WIDTH || (isCpuEncoder ? String(Math.min(Number(preset.maxWidth), 1920)) : preset.maxWidth);
  // 60 fps is for discrete-GPU encoders only. An Intel iGPU host still does the
  // BGRA->NV12 convert and scale on the CPU and pushes 8 MB per frame through a
  // pipe: the field log of Sep 18 2026 (h264_qsv, 1080p, 60 fps tier) shows the
  // worker managing anywhere from 208 to 298 writes per 5 s with late ticks and
  // a 20-24 ms loop p95 — a frame rate that wanders between ~40 and ~58 fps,
  // which is exactly the "refresh rate is not stable" report. 30 fps on the same
  // machine is rock steady (150 writes per 5 s, 0 late ticks).
  const isQsvEncoder = detectedEncoder === 'h264_qsv';
  const maxFps = Number(process.env.REMOTE365_STREAM_MAX_FPS || (isCpuEncoder || isQsvEncoder ? 30 : 60));
  const targetFps = Math.max(15, Math.min(maxFps, parseInt(fps, 10) || 30));
  const effectiveFps = String(targetFps);
  const frameInterval = 1000 / targetFps;
  activeStreamFps = targetFps;

  const probeStartedAt = Date.now();
  initPollInterval = setInterval(() => {
    let physWidth = Math.round(width * selectedDisplay.scaleFactor);
    let physHeight = Math.round(height * selectedDisplay.scaleFactor);
    let firstFrameBuffer: Buffer | null = null;

    // Locked machine (or pre-logon, where nothing else exists yet): DXGI cannot
    // touch the secure desktop and desktopCapturer returns nothing usable, so
    // the probe below would spin forever and the stream would never start. The
    // elevated agent is the only thing that can see this screen — prime from it.
    if (hostSessionLocked) {
      mainSecureCapture.activate(physWidth, physHeight);
      const secureFrame = mainSecureCapture.latest;
      if (!secureFrame || secureFrame.length !== physWidth * physHeight * 4) return; // next tick
      firstFrameBuffer = secureFrame;
      lastPrimeFrame = { data: secureFrame, width: physWidth, height: physHeight, displayId: selectedDisplay.id };
      log.info(`[Host] Primed first frame from the secure desktop (${physWidth}x${physHeight}).`);
      // The agent serves ONE capture client at a time (single pipe instance).
      // With the worker on it is the worker that streams these frames, so hand
      // the pipe back now — holding it would lock the worker out permanently.
      if (isStreamWorkerEnabled()) mainSecureCapture.deactivate();
    } else if (useNativeCapture) {
      try {
        const probe = capture.captureFrame(selectedDisplayIndex);
        if (probe && probe.width && probe.height && probe.data) {
          physWidth = probe.width;
          physHeight = probe.height;
          firstFrameBuffer = probe.data;
          lastPrimeFrame = { data: firstFrameBuffer, width: physWidth, height: physHeight, displayId: selectedDisplay.id };
        } else if (lastPrimeFrame && lastPrimeFrame.displayId === selectedDisplay.id) {
          // Static screen on a (re)start: DXGI returns nothing until the desktop
          // repaints. Reuse the last real frame so the stream starts instantly
          // instead of stalling black — DXGI takes over on the next change.
          physWidth = lastPrimeFrame.width;
          physHeight = lastPrimeFrame.height;
          firstFrameBuffer = lastPrimeFrame.data;
        } else if (Date.now() - probeStartedAt > 1000) {
          // Cold start on a static screen (no cached frame yet): grab one via
          // desktopCapturer, which snapshots regardless of damage events.
          void primeViaDesktopCapturer(selectedDisplay, physWidth, physHeight);
          return;
        } else {
          return; // Screen hasn't composited yet, wait a tick!
        }
      } catch (e) {
        // DXGI can't initialize on a secure desktop (locked machine / UAC). The
        // pipeline must still start — once it runs, the elevated agent supplies
        // the lock/PIN-screen frames. Prime from cache or desktopCapturer.
        if (lastPrimeFrame && lastPrimeFrame.displayId === selectedDisplay.id) {
          physWidth = lastPrimeFrame.width;
          physHeight = lastPrimeFrame.height;
          firstFrameBuffer = lastPrimeFrame.data;
        } else if (Date.now() - probeStartedAt > 1000) {
          void primeViaDesktopCapturer(selectedDisplay, physWidth, physHeight);
          return;
        } else {
          return;
        }
      }
    }

    // Got a frame! Stop polling and start the encoder
    if (initPollInterval) clearInterval(initPollInterval);

    // Wider-than-1080p captures need more bits to stay sharp: same CBR spread
    // over 2-4× the pixels is visibly softer. Only for hardware encoders and
    // only when no explicit env override pins the bitrate.
    const effBitrate = (!isCpuEncoder && !process.env.REMOTE365_STREAM_BITRATE
      && physWidth > 2200 && parseInt(bitrate, 10) < 12000) ? '12000k' : bitrate;

    log.info(`[Host] Frame acquired. Locking bounds at: ${physWidth}x${physHeight} (Scale: ${selectedDisplay.scaleFactor}). target=${effectiveFps}fps bitrate=${effBitrate} maxWidth=${maxWidth} nativeCapture=${useNativeCapture}`);

    // Shared scaler for both capture paths. Three deliberate choices:
    // - mod-2 alignment, NOT mod-16. H.264 only needs even dimensions; every
    //   encoder we use pads to macroblocks internally and signals the true size
    //   via cropping metadata (that's how all standard 1920x1080 video works).
    //   The old /16 rounding RESAMPLED 1080 -> 1072 rows (and 1366 -> 1360),
    //   a full-frame subpixel resample that softened every line of text on the
    //   most common display sizes. With mod-2, a 1080p desktop passes through
    //   bit-exact — no resample at all.
    // - lanczos + accurate_rnd + full_chroma_int: when a real downscale does
    //   happen (4K host on the 'sharp' tier, CPU-encoder cap), lanczos keeps
    //   text edges crisp where the bicubic default smears them, and the chroma
    //   flags make swscale do RGB->4:2:0 chroma decimation on the slow accurate
    //   path instead of the fast one (the fast path visibly fringes colored
    //   text and UI accents).
    // - out_color_matrix=bt709: swscale converts RGB->YUV with BT.601
    //   coefficients by default, but Chromium renders HD streams assuming
    //   BT.709 — every session had a silent 601-encode/709-display mismatch
    //   that shifted colors and discolored ClearType subpixel antialiasing.
    //   Convert with the matrix the decoder actually assumes, and tag it in
    //   the bitstream VUI (see getEncoderArgs).
    const videoFilter = `scale=w=trunc(min(iw\\,${maxWidth})/2)*2:h=trunc(ih*min(1\\,${maxWidth}/iw)/2)*2:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p`;
    // Keyframes on demand need the worker's IVF framing, so: stream worker +
    // native capture + a verified encoder. Anything else keeps the periodic GOP.
    // REMOTE365_ONDEMAND_IDR=0 switches it off on one host for a field A/B.
    const useOnDemandKeyframes = useNativeCapture && isStreamWorkerEnabled()
      && encoderSupportsOnDemandKeyframes(detectedEncoder)
      && physWidth <= 0xffff && physHeight <= 0xffff
      && !onDemandKeyframesRejected
      && process.env.REMOTE365_ONDEMAND_IDR !== '0';
    const captureArgs = useNativeCapture && useOnDemandKeyframes ? [
      // Raw BGRA frames inside IVF framing (size + timestamp per frame). The
      // fourcc in the worker's header selects bgra; size and rate ride in it too.
      '-f', 'ivf',
      '-c:v', 'rawvideo',
      '-thread_queue_size', '2',
      '-i', '-',
      '-vf', videoFilter,
    ] : useNativeCapture ? [
      '-f', 'rawvideo',
      '-pixel_format', 'bgra',
      '-video_size', `${physWidth}x${physHeight}`,
      '-framerate', effectiveFps,
      // 2 frames of input queue. History: 1 made fps fragile (every encoder
      // hiccup dropped input), but 4 was ~130ms of standing latency at 30fps —
      // frames queued here are frames the viewer sees late. 2 keeps one frame
      // of hiccup absorption at half the worst-case delay.
      '-thread_queue_size', '2',
      '-i', '-', // feed from stdin
      '-vf', videoFilter,
    ] : [
      '-f', 'gdigrab',
      '-framerate', effectiveFps,
      '-thread_queue_size', '2',
      '-offset_x', `${Math.round(selectedDisplay.bounds.x * selectedDisplay.scaleFactor)}`,
      '-offset_y', `${Math.round(selectedDisplay.bounds.y * selectedDisplay.scaleFactor)}`,
      '-video_size', `${physWidth}x${physHeight}`,
      '-i', 'desktop',
      '-vf', videoFilter,
    ];

    // 'smooth' is the tier the viewer asks for when the link is losing packets:
    // keep keyframes closer together there so an unrepaired loss heals sooner.
    const encoderArgs = getEncoderArgs(detectedEncoder, effBitrate, effectiveFps, qualityKey === 'smooth' ? 1 : 2, useOnDemandKeyframes);
    const args = [...captureArgs, ...encoderArgs];
    log.info(`[Host] FFmpeg launch: ${ffmpegPath} ${args.join(' ')}`);

    // P2.1: when the stream worker is enabled, offload capture+encode to the utilityProcess
    // (keeps the ~8MB/frame DXGI grab off the main thread so the host window stays responsive).
    // Its encoded output is fed into the same NAL path via onWorkerNal (registered at startup).
    // WebRTC, data channels, input, and the cursor loop stay in main.
    if (isStreamWorkerEnabled()) {
      bufferAccumulator = Buffer.alloc(0);
      accessUnitBuffer = Buffer.alloc(0);
      hasVcl = false;
      preforkStreamWorker();
      log.info('[Host] Stream worker ON — capture+encode offloaded to utilityProcess.');
      // width/height = the raw BGRA size FFmpeg expects, so the worker can pull
      // same-sized secure-desktop frames from the elevated agent when locked.
      startWorkerStream({ ffmpegPath, ffmpegArgs: args, displayIndex: selectedDisplayIndex, fps: targetFps, width: physWidth, height: physHeight, firstFrame: firstFrameBuffer || undefined, ivf: useOnDemandKeyframes });
      onDemandKeyframesActive = useOnDemandKeyframes;
      lastForcedKeyframeAt = Date.now();   // the stream opens with a keyframe of its own
      log.info(`[Host] Keyframes: ${useOnDemandKeyframes ? `ON DEMAND (safety GOP ${ON_DEMAND_SAFETY_GOP_SECONDS}s)` : 'periodic GOP'}.`);
      // If the machine is already locked when the stream (re)starts, tell the worker.
      if (hostSessionLocked) setWorkerSecureForce(true);
      // Cursor metadata loop still runs here (uses the data channel + main-process cursor pos).
      let lastCursorPayload = '';
      cursorInterval = setInterval(() => {
        try {
          const { x, y } = screen.getCursorScreenPoint();
          const nx = Math.max(0, Math.min(1, (x - selectedDisplay.bounds.x) / selectedDisplay.bounds.width));
          const ny = Math.max(0, Math.min(1, (y - selectedDisplay.bounds.y) / selectedDisplay.bounds.height));
          const payload = JSON.stringify({ type: 'cursor', x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)), visible: true, cursorType: ((capture as any)?.getCursorType ? (capture as any).getCursorType() : 'default') });
          if (payload === lastCursorPayload) return;
          lastCursorPayload = payload;
          let sent = false;
          for (const peer of hostViewerPeers.values()) {
            const channel = peer.dataChannel;
            if (!channel?.isOpen?.()) continue;
            if (typeof channel.bufferedAmount === 'function' && channel.bufferedAmount() > 32 * 1024) continue;
            channel.sendMessage(payload);
            sent = true;
          }
          if (!sent) skippedCursorFrames++;
        } catch (err) { }
      }, 33);
      return;
    }

    ffmpegProcess = spawn(ffmpegPath, args);
    const streamProcess = ffmpegProcess;
    ffmpegProcess.on('error', (err) => {
      if (ffmpegProcess !== streamProcess) return;
      log.error(`[Host] FFmpeg failed to start: ${err.message}`);
      stopStreaming();
    });
    bufferAccumulator = Buffer.alloc(0);
    accessUnitBuffer = Buffer.alloc(0);
    hasVcl = false;

    // Capture Loop
    let lastFrameBuffer: Buffer | null = firstFrameBuffer;
    const captureBufferPool = new RawFramePool(physWidth * physHeight * 4, lastFrameBuffer);
    const stdinBuffersInFlight = new Set<Buffer>();
    let droppedInputFrames = 0;
    let lastDropLogTime = Date.now();
    let captureSamples = 0;
    let captureDurationMs = 0;
    let lateTicks = 0;
    let backpressureWaits = 0;
    let mainDxgiThrowStreak = 0;   // consecutive DXGI throws → secure desktop (UAC); nulls don't count
    let mainGeometryMismatchReported = false;  // one restart per pipeline run
    const MAIN_STATIC_KEEPALIVE_MS = staticFrameInterval(false, process.env.REMOTE365_STATIC_KEEPALIVE_MS);
    let mainLastWriteAt = 0;
    let mainWritesSinceStart = 0;

    let nextFrameAt = performance.now();
    let waitingForDrain = false;
    const scheduleCapture = () => {
      const delay = Math.max(0, nextFrameAt - performance.now());
      captureInterval = setTimeout(captureTick, delay);
    };
    const captureTick = () => {
      captureInterval = null;
      if (ffmpegProcess !== streamProcess || !streamProcess.stdin?.writable || streamProcess.stdin.writableEnded) {
        return;
      }

      nextFrameAt += frameInterval;
      const now = performance.now();
      if (nextFrameAt < now - frameInterval) {
        lateTicks++;
        nextFrameAt = now + frameInterval;
      }

      const captureStarted = performance.now();
      let gotDxgiFrame = false;
      let dxgiThrew = false;
      let mainFrameIsNew = false;   // genuinely new pixels this tick
      try {
        const target = hostSessionLocked ? undefined : captureBufferPool.acquire(lastFrameBuffer, stdinBuffersInFlight);
        const result = hostSessionLocked || !target ? null : capture.captureFrame(selectedDisplayIndex, target);
        if (result?.data) {
          // Same geometry guard as the worker path: FFmpeg is locked to
          // `-video_size physWidth x physHeight`, so a differently-sized frame
          // (resolution/DPI change, display swap) would be read at the wrong
          // stride and encode the shortfall as green filler rows. Hold the last
          // good frame and restart the pipeline with fresh bounds instead.
          const expectedFrameBytes = physWidth * physHeight * 4;
          const frameBytes = result.data.byteLength ?? result.data.length;
          if (expectedFrameBytes > 0 && frameBytes !== expectedFrameBytes) {
            gotDxgiFrame = true;
            if (!mainGeometryMismatchReported) {
              mainGeometryMismatchReported = true;
              log.warn(`[Host] Capture geometry changed (declared ${physWidth}x${physHeight}, ${expectedFrameBytes} vs ${frameBytes} bytes) — restarting pipeline.`);
              if (videoTrack) setTimeout(() => { if (videoTrack) startStreaming(); }, 150);
            }
          } else {
            lastFrameBuffer = result.data;
            gotDxgiFrame = true;
            mainFrameIsNew = true;   // real damage — encode it now
          }
        }
      } catch (e: any) {
        dxgiThrew = true; // DXGI can't init = secure desktop (machine locked)
      }
      // Switch to the agent's secure-desktop frame only when the OS says we're
      // LOCKED (powerMonitor; DXGI still hands back the frozen wallpaper) or when
      // DXGI *throws* for a sustained run (a UAC secure desktop with no lock
      // event). A plain null is just a static screen and must NOT switch sources,
      // or the picture flip-flops DXGI<->agent and appears to zoom in and out.
      if (dxgiThrew) mainDxgiThrowStreak++; else if (gotDxgiFrame) mainDxgiThrowStreak = 0;
      const useSecure = physWidth > 0 && physHeight > 0 && (hostSessionLocked || mainDxgiThrowStreak >= 5);
      if (useSecure) {
        mainSecureCapture.activate(physWidth, physHeight);
        // A repeated pipe response keeps the same Buffer identity.
        if (mainSecureCapture.latest) { mainFrameIsNew = lastFrameBuffer !== mainSecureCapture.latest; lastFrameBuffer = mainSecureCapture.latest; }
      } else {
        mainSecureCapture.deactivate();   // idempotent; no-op unless it was active
      }
      captureDurationMs += performance.now() - captureStarted;
      captureSamples++;

      const writableLength = ffmpegProcess.stdin.writableLength || 0;
      const maxQueueBytes = Math.max(1024 * 1024, Math.round((lastFrameBuffer?.length || 0) * 0.75));
      // Static-screen throttle (same rationale as the worker path): re-encoding
      // an UNCHANGED frame at full fps burns a CPU core for nothing and starves
      // input injection on GPU-less hosts. New pixels go immediately; duplicates
      // only keep the pipeline warm at STATIC_KEEPALIVE_MS.
      const nowWriteMs = Date.now();
      const mainShouldWrite = shouldWriteFrame(mainWritesSinceStart, mainFrameIsNew, false, nowWriteMs - mainLastWriteAt, MAIN_STATIC_KEEPALIVE_MS);
      if (lastFrameBuffer && writableLength < maxQueueBytes && !waitingForDrain && mainShouldWrite) {
        mainLastWriteAt = nowWriteMs;
        try {
          const frameBeingWritten = lastFrameBuffer;
          stdinBuffersInFlight.add(frameBeingWritten);
          const canContinue = streamProcess.stdin!.write(frameBeingWritten, () => stdinBuffersInFlight.delete(frameBeingWritten));
          mainWritesSinceStart++;
          if (!canContinue) {
            droppedInputFrames++;
            backpressureWaits++;
            waitingForDrain = true;
            streamProcess.stdin!.once('drain', () => {
              waitingForDrain = false;
              if (ffmpegProcess === streamProcess && !captureInterval && streamProcess.stdin?.writable) scheduleCapture();
            });
          }
        }
        catch (err: any) { return; }
      } else if (lastFrameBuffer) {
        droppedInputFrames++;
      }

      const dropLogNow = Date.now();
      if (dropLogNow - lastDropLogTime > 5000) {
        if (droppedInputFrames > 0) {
          const avgCaptureMs = captureSamples > 0 ? captureDurationMs / captureSamples : 0;
          log.info(`[Host] Capture health: droppedInput=${droppedInputFrames} backpressureWaits=${backpressureWaits} lateTicks=${lateTicks} avgCaptureMs=${avgCaptureMs.toFixed(1)} targetFps=${effectiveFps} stdinQueueKB=${Math.round(writableLength / 1024)}`);
        }
        droppedInputFrames = 0;
        backpressureWaits = 0;
        lateTicks = 0;
        captureSamples = 0;
        captureDurationMs = 0;
        lastDropLogTime = dropLogNow;
      }

      if (!waitingForDrain) scheduleCapture();
    };
    scheduleCapture();

    // --- Remote Cursor Metadata Loop ---
    let lastCursorPayload = '';
    cursorInterval = setInterval(() => {
      try {
        const { x, y } = screen.getCursorScreenPoint();
        const nx = Math.max(0, Math.min(1, (x - selectedDisplay.bounds.x) / selectedDisplay.bounds.width));
        const ny = Math.max(0, Math.min(1, (y - selectedDisplay.bounds.y) / selectedDisplay.bounds.height));
        const payload = JSON.stringify({ type: 'cursor', x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)), visible: true, cursorType: ((capture as any)?.getCursorType ? (capture as any).getCursorType() : 'default') });
        if (payload === lastCursorPayload) return;
        lastCursorPayload = payload;
        let sent = false;
        for (const peer of hostViewerPeers.values()) {
          const channel = peer.dataChannel;
          if (!channel?.isOpen?.()) continue;
          if (typeof channel.bufferedAmount === 'function' && channel.bufferedAmount() > 32 * 1024) continue;
          channel.sendMessage(payload);
          sent = true;
        }
        if (!sent) skippedCursorFrames++;
      } catch (err) { }
    }, 33);

    ffmpegProcess.stdin?.on('error', (err: any) => {
      if (ffmpegProcess !== streamProcess) return;
      if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
    });

    ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
      if (ffmpegProcess !== streamProcess) return;
      bufferAccumulator = bufferAccumulator.length ? Buffer.concat([bufferAccumulator, chunk]) : chunk;
      drainNALBuffer();
    });

    ffmpegProcess.stderr?.on('data', (data: any) => {
      const str = data.toString().trim();
      if (!str.includes('kB time=') && !str.includes('fps=')) log.info(`[Host-FFmpeg] ${str}`);
    });

    ffmpegProcess.on('exit', (code: any, signal: any) => {
      if (ffmpegProcess !== streamProcess) return;
      if (code !== 0 && code !== null && signal !== 'SIGTERM') {
        log.warn(`[Host-FFmpeg] Exited with code ${code}. Restarting in 1s...`);
        setTimeout(() => { if (videoTrack) startStreaming(); }, 1000);
      }
    });

  }, 10); // Check every 10ms until first frame is acquired
}



// Browser viewers hide their host candidates behind mDNS names (privacy):
// "candidate:... 1a2b3c4d-....local 54321 typ host". libdatachannel/libjuice on
// this host has no mDNS resolver, so passing those in stalls resolution and can
// throw — which used to force same-LAN *web* sessions onto the TURN relay
// (~+100-300ms). Dropping them is safe and unlocks the direct path: the
// viewer's REAL address is learned via peer-reflexive discovery the moment its
// connectivity checks hit our real-IP candidates, and ICE forms the pair from
// that. Non-mDNS candidates still get a guard so one malformed candidate can't
// abort the handler mid-session.
function addRemoteCandidateSafe(peer: HostViewerPeer, candidate: string, mid: string) {
  if (/\.local\s/i.test(candidate)) {
    log.info(`[Host] Skipping unresolvable mDNS candidate for ${peer.viewerId} (direct path relies on prflx discovery).`);
    return;
  }
  try {
    peer.peerConnection?.addRemoteCandidate(candidate, mid);
  } catch (err: any) {
    log.warn(`[Host] addRemoteCandidate failed for ${peer.viewerId}: ${err?.message || err}`);
  }
}

// Drop-to-IDR state for the legacy single-viewer path: its peer object is
// rebuilt from module vars on every frame, so the flag must live here.
let legacyWaitingForIdr = false;
// Off unless explicitly enabled — see the comment at the drop site.
const dropToIdrEnabled = process.env.REMOTE365_DROP_TO_IDR === '1';
let lastUrgentKeyframeRestartAt = 0;

// ---- Keyframes on demand ----
// Periodic keyframes were the visible judder: a keyframe of a real desktop is
// 160-330 KB, the RTP pacer needs 120-250 ms to send one, and every frame behind
// it waits in the same FIFO. With on-demand keyframes the stream is one keyframe
// at the start and deltas from then on; a new keyframe is produced only when
// somebody actually needs one:
//   - the viewer's browser asks (RTCP PLI/FIR on the video track),
//   - the viewer app asks ('request-keyframe' on the control channel),
//   - a viewer joins / the pre-buffer opens / a cached bootstrap was delivered,
//   - this host had to drop a frame (the delta chain is broken for that peer).
// True only while the ACTIVE pipeline was launched with IVF input (stream worker
// + native capture + an encoder the mechanism was verified on).
let onDemandKeyframesActive = false;
// Set when FFmpeg died while running the on-demand pipeline; see the worker
// 'ffmpeg-exit' handler. Sticky for the run, like the encoder fallbacks.
let onDemandKeyframesRejected = false;
let lastForcedKeyframeAt = 0;
let forcedKeyframeTimer: NodeJS.Timeout | null = null;
let forcedKeyframeCount = 0;
let forcedKeyframesSinceIdr = 0;   // reset whenever an IDR actually leaves the encoder
let forcedKeyframeDueAt = 0;
// Loss -> keyframe burst -> more loss must not become a storm (a browser
// repeats PLI until a keyframe arrives). Joins may go sooner than recoveries.
const KEYFRAME_MIN_INTERVAL_MS = Math.max(100, Number(process.env.REMOTE365_KEYFRAME_MIN_INTERVAL_MS) || 1000);
const KEYFRAME_JOIN_MIN_INTERVAL_MS = 250;

/** Ask the encoder for a keyframe. Returns false when the active pipeline can't do it. */
function requestHostKeyframe(reason: string, opts?: { join?: boolean }): boolean {
  if (!onDemandKeyframesActive) return false;
  const minGap = opts?.join ? KEYFRAME_JOIN_MIN_INTERVAL_MS : KEYFRAME_MIN_INTERVAL_MS;
  const wait = lastForcedKeyframeAt + minGap - Date.now();
  const fire = () => {
    forcedKeyframeTimer = null;
    if (!onDemandKeyframesActive) return;
    lastForcedKeyframeAt = Date.now();
    // Watchdog: keyframes are being asked for but none ever comes out of the
    // encoder (an encoder/driver that ignores the forced-IDR control). Left
    // alone, a waiting viewer would sit on a frozen picture until the 60 s
    // safety GOP. Give up on on-demand mode for this run and restart on the
    // periodic pipeline, which needs nothing from the encoder.
    forcedKeyframesSinceIdr++;
    if (forcedKeyframesSinceIdr > 8) {
      onDemandKeyframesRejected = true;
      const asked = forcedKeyframesSinceIdr;
      forcedKeyframesSinceIdr = 0;
      log.warn(`[Host] ${asked} forced keyframes requested but no IDR produced by ${detectedEncoder}; switching to the periodic-GOP pipeline for this run.`);
      setTimeout(() => { if (hostViewerPeers.size > 0 || videoTrack) startStreaming(); }, 0);
      return;
    }
    forcedKeyframeCount++;
    requestWorkerKeyframe();
    log.info(`[Host] Keyframe on demand #${forcedKeyframeCount} (${reason}).`);
  };
  if (wait <= 0) {
    if (forcedKeyframeTimer) { clearTimeout(forcedKeyframeTimer); forcedKeyframeTimer = null; }
    fire();
  } else if (!forcedKeyframeTimer || Date.now() + wait < forcedKeyframeDueAt) {
    // Coalesce everything inside the window into one keyframe; a join may pull
    // an already-scheduled recovery keyframe EARLIER, never later.
    if (forcedKeyframeTimer) clearTimeout(forcedKeyframeTimer);
    forcedKeyframeDueAt = Date.now() + wait;
    forcedKeyframeTimer = setTimeout(fire, wait);
  }
  return true;
}

/** True when an RTCP compound packet carries a PLI (PSFB fmt 1) or FIR (fmt 4). */
function rtcpRequestsKeyframe(buf: Buffer): boolean {
  let offset = 0;
  while (offset + 4 <= buf.length) {
    if ((buf[offset] >> 6) !== 2) return false;               // not RTCP v2
    const fmt = buf[offset] & 0x1f;
    const packetType = buf[offset + 1];
    const length = (buf.readUInt16BE(offset + 2) + 1) * 4;
    if (packetType === 206 && (fmt === 1 || fmt === 4)) return true;
    if (length <= 0) return false;
    offset += length;
  }
  return false;
}

function sendFrameToAllViewers(frame: Buffer, targetViewerId?: string, bypassPrebuffer = false) {
  const isIdr = frameHasIdr(frame);
  if (isIdr) {
    // `frame` is emitted only after the Annex-B scanner observes the next safe
    // AU boundary, so this cache can never contain the truncated multi-slice
    // data that caused the vertical barcode corruption on affected devices.
    latestBootstrapAccessUnit = frame;
    forcedKeyframesSinceIdr = 0;
  }

  if (isPreBuffering && !bypassPrebuffer) {
    ffmpegPreChunks.push(frame);
    if (ffmpegPreChunks.length > 3) ffmpegPreChunks.shift();
    return;
  }

  const peers = hostViewerPeers.size > 0 ? Array.from(hostViewerPeers.values()) : [];
  if (peers.length === 0) {
    if (!videoTrack || !videoRtpConfig || !peerConnection || peerConnection.state?.() !== 'connected') return;
    peers.push({
      viewerId: currentViewerId || 'legacy',
      peerConnection,
      dataChannel,
      inputDataChannel,
      criticalInputDataChannel,
      // The legacy fallback predates the dedicated file channel; ft: traffic
      // simply rides the control channel here.
      fileDataChannel: null,
      videoTrack,
      videoRtpConfig,
      // Legacy single-peer fallback predates the audio track; it only ever
      // carries video, so audio simply does not broadcast down this path.
      audioTrack: null,
      audioRtpConfig: null,
      iceCandidatesQueue,
      hasRemoteDescription,
      clipboardInterval,
      pingInterval,
      controlGranted,
      pendingControlViewerId,
      currentRtpTimestamp,
      rtpStartTime,
      lastFrameSentAt: 0,
      firstFrameSent,
      frameCount,
      droppedEncodedFrames,
      totalBytesSent,
        lastLogBytes,
        lastLogTime,
        sessionStartedAt: lastViewerJoinTime || Date.now(),
        offerSentAt: 0,
        connectedAt: 0,
        waitingForIdr: legacyWaitingForIdr,
    });
  }

  let sentToAnyPeer = false;
  let lastBufferedAmount = 0;
  for (const peer of peers) {
    try {
      if (peer.mediaPaused) continue;
      if (targetViewerId && peer.viewerId !== targetViewerId) continue;
      if (!peer.videoTrack || !peer.videoRtpConfig || !peer.peerConnection || peer.peerConnection.state?.() !== 'connected') continue;
      if (peer.rtpStartTime === 0) {
        peer.rtpStartTime = Date.now();
        peer.currentRtpTimestamp = 0;
      } else {
        // Content-cadence RTP timestamps. The encoder output is CFR (the input
        // is paced at -framerate), so advance exactly one frame interval per
        // access unit. The old wall-clock-at-send stamping let every ffmpeg/
        // pipe/event-loop burst land in the timestamps — the viewer plays
        // frames AT those timestamps, which showed up as juddery, unstable
        // motion. Resync to wall time only when the content clock drifts >0.5s
        // (encoder stall, quality restart, dropped output).
        const nowMs = Date.now();
        const frameIntervalMs = 1000 / (activeStreamFps || 30);
        const step = Math.max(1, Math.round(90000 / (activeStreamFps || 30)));
        let nextTs = (peer.currentRtpTimestamp + step) >>> 0;
        const wallTs = Math.floor((nowMs - peer.rtpStartTime) * 90) >>> 0;
        const drift = (wallTs - nextTs) | 0; // signed modular distance, wrap-safe
        const sendGapMs = peer.lastFrameSentAt ? nowMs - peer.lastFrameSentAt : frameIntervalMs;
        // Static desktops are intentionally encoded only every 500ms. Giving
        // those keepalives 30/60fps timestamps makes their 500ms arrival gap
        // look like ~470ms of network jitter, so Chromium grows its playout
        // buffer into the hundreds of milliseconds. Use wall time after a real
        // cadence gap; retain CFR steps for active motion/short FFmpeg bursts.
        if (sendGapMs > frameIntervalMs * 2.5 || Math.abs(drift) > 45000) nextTs = wallTs;
        peer.currentRtpTimestamp = nextTs;
      }
      peer.videoRtpConfig.timestamp = peer.currentRtpTimestamp;

      const bufferedAmount = typeof peer.videoTrack.bufferedAmount === 'function' ? peer.videoTrack.bufferedAmount() : 0;
      lastBufferedAmount = Math.max(lastBufferedAmount, bufferedAmount);
      // Keep at most ~80ms queued at 6.5Mbps (and much less at higher tiers).
      // The previous 128KB default permitted ~160ms of stale video before
      // dropping, which directly turns into sluggish click-to-photon feedback.
      const maxBufferedBytes = Number(process.env.REMOTE365_TRACK_BUFFER_LIMIT || 64 * 1024);
      // Drop-to-IDR is OPT-IN and OFF by default. Rationale: skipping deltas
      // after a drop avoids decoder corruption, but IDRs only arrive on the
      // periodic GOP (~0.5s) because forcing one on demand isn't possible with
      // the FFmpeg-CLI pipeline yet. So enabling it trades brief corruption for
      // a HALF-SECOND FREEZE on every congestion blip — which reads to the user
      // as click lag. Re-enable only once PLI -> forced IDR exists (P2).
      // With keyframes on demand the clean path is finally affordable: after a
      // drop (or for a peer that has not had a keyframe yet) skip deltas — they
      // would only decode as corruption — and ask for a keyframe, which arrives
      // in ~10 ms instead of "whenever the next GOP comes round".
      const idrGate = dropToIdrEnabled || onDemandKeyframesActive || peer.waitingForIdr;
      if (idrGate) {
        if (peer.waitingForIdr && !isIdr) {
          // Never let a peer starve: whoever is waiting gets a keyframe asked
          // for (coalesced + rate-limited, so this is cheap to repeat).
          requestHostKeyframe('peer-awaiting-keyframe', { join: true });
          peer.droppedEncodedFrames++;
          droppedEncodedFrames++;
          continue;
        }
        if (isIdr) peer.waitingForIdr = false;
      }
      if (bufferedAmount > maxBufferedBytes) {
        if (idrGate) peer.waitingForIdr = true;
        requestHostKeyframe('send-queue-drop');
        peer.droppedEncodedFrames++;
        droppedEncodedFrames++;
        continue;
      }

      // The boolean this returns is NOT "delivered / failed". With a
      // PacingHandler in the chain every packet is parked in the pacer's queue,
      // so libdatachannel reports false ("not sent synchronously") for frames
      // that go out perfectly well a few milliseconds later. A real failure
      // THROWS and is handled by the catch below. Reading false as failure was
      // wrong for months — the field log of Sep 18 2026 shows
      // "sentFrames=0 droppedEncoded=150" and "throughput=0.00Mbps" on every
      // healthy session — and it had real effects: firstFrameSent never became
      // true (so the cached bootstrap was re-sent ~50 times and the pre-buffer
      // only ever opened through its 3 s STALL watchdog), lastFrameSentAt stayed
      // 0 (so the RTP clock never resynced after a static gap), and in v1.2.122
      // the keyframe gate treated every frame as a failed send and dropped all
      // deltas, leaving ~4 fps of keyframes.
      peer.videoTrack.sendMessageBinary(frame, peer.videoRtpConfig);
      const sent = true;
      if (sent) {
        if (!peer.firstFrameSent) {
          const requestToFirstFrameMs = Date.now() - peer.sessionStartedAt;
          const connectedToFirstFrameMs = peer.connectedAt ? Date.now() - peer.connectedAt : -1;
          log.info(`[Host] First video frame fully assembled (${frame.length} bytes). Delivering to viewer ${peer.viewerId}...`);
          log.info(`[Perf] Session waterfall viewer=${peer.viewerId} request-to-first-frame=${requestToFirstFrameMs}ms connected-to-first-frame=${connectedToFirstFrameMs}ms`);
          peer.firstFrameSent = true;
        }
        peer.totalBytesSent += frame.length;
        peer.frameCount++;
        peer.lastFrameSentAt = Date.now();
        totalBytesSent += frame.length;
        frameCount++;
        sentToAnyPeer = true;
      } else {
        if (idrGate) peer.waitingForIdr = true;
        requestHostKeyframe('send-failed');
        peer.droppedEncodedFrames++;
        droppedEncodedFrames++;
      }
    } catch (err: any) {
      if (err?.message?.includes('closed') || err?.message?.includes('not open')) {
        log.warn(`[Host] Video track closed for viewer ${peer.viewerId}: ${err?.message}`);
      } else {
        log.error(`[Host] Error sending frame to viewer ${peer.viewerId}: ${err?.message}`);
      }
    }
  }

  // Persist the drop-to-IDR flag for the legacy path (its peer object is
  // transient — see legacyWaitingForIdr above).
  if (hostViewerPeers.size === 0 && peers.length > 0) {
    legacyWaitingForIdr = peers[0].waitingForIdr;
  }

  const primary = getPrimaryHostPeer();
  if (primary) {
    currentRtpTimestamp = primary.currentRtpTimestamp;
    rtpStartTime = primary.rtpStartTime;
    firstFrameSent = primary.firstFrameSent;
  }

  const now = Date.now();
  if (now - lastLogTime > 5000) {
    const duration = (now - lastLogTime) / 1000;
    const bytesTransmitted = totalBytesSent - lastLogBytes;
    const mbps = ((bytesTransmitted * 8) / (1024 * 1024)) / duration;
    log.info(`[Host] Media health: viewers=${hostViewerPeers.size || (sentToAnyPeer ? 1 : 0)} quality=${activeAdaptiveQuality || hostStreamSettings.quality} sentFrames=${frameCount} droppedEncoded=${droppedEncodedFrames} skippedCursor=${skippedCursorFrames} trackBufferKB=${Math.round(lastBufferedAmount / 1024)} lastFrame=${isIdr ? 'IDR' : 'delta'} bandwidthMbps=${mbps.toFixed(2)} enc=${detectedEncoder} av1cap=${detectedAv1Encoder || 'none'}`);
    droppedEncodedFrames = 0;
    skippedCursorFrames = 0;
    lastLogBytes = totalBytesSent;
    lastLogTime = now;
  }
}

function sendCachedBootstrapToViewer(peer: HostViewerPeer | null, trigger: string) {
  if (!peer || peer.mediaPaused || peer.firstFrameSent || !latestBootstrapAccessUnit) return false;
  if (!peer.videoTrack || !peer.peerConnection || peer.peerConnection.state?.() !== 'connected') return false;
  log.info(`[Host] Delivering cached decoder bootstrap to ${peer.viewerId} (${latestBootstrapAccessUnit.length} bytes, trigger=${trigger}).`);
  // This is the frame that OPENS the prebuffer. Routing it through the normal
  // prebuffer guard would append it to the FIFO again and return without ever
  // touching RTP, leaving a perfectly connected viewer at decoded FPS=0.
  sendFrameToAllViewers(latestBootstrapAccessUnit, peer.viewerId, true);
  // The cached keyframe can be arbitrarily old now that keyframes are no longer
  // periodic; live deltas would decode against the wrong reference. Hold this
  // peer's deltas and fetch a fresh keyframe (~10 ms).
  if (onDemandKeyframesActive) {
    peer.waitingForIdr = true;
    requestHostKeyframe('bootstrap-delivered', { join: true });
  }
  return peer.firstFrameSent;
}

function openPrebufferForViewer(peer: HostViewerPeer | null, trigger: string) {
  if (!isPreBuffering) {
    sendCachedBootstrapToViewer(peer, trigger);
    return;
  }
  // A delta frame can be accepted by the RTP sender even though Chromium
  // cannot decode it. Therefore the cached SPS/PPS/IDR must be queued BEFORE
  // the rolling P-frame prebuffer, and the FIFO must remain intact if the media
  // track is not open yet.
  if (latestBootstrapAccessUnit) {
    if (!sendCachedBootstrapToViewer(peer, trigger)) {
      // PeerConnection can report connected a few milliseconds before the
      // media track accepts its first packet, and onOpen may already have
      // fired. Retry without waiting for another screen change/keyframe.
      if (
        !prebufferFlushRetryTimer &&
        peer &&
        hostViewerPeers.get(peer.viewerId) === peer &&
        peer.peerConnection?.state?.() === 'connected'
      ) {
        prebufferFlushRetryTimer = setTimeout(() => {
          prebufferFlushRetryTimer = null;
          if (isPreBuffering && hostViewerPeers.get(peer.viewerId) === peer) {
            openPrebufferForViewer(peer, 'track-ready-retry');
          }
        }, 50);
      }
      return;
    }
    // If ICE completed quickly the same IDR may still be in the rolling FIFO.
    // It has just been delivered explicitly, so avoid spending bandwidth and
    // an extra RTP timestamp on a duplicate copy.
    ffmpegPreChunks = ffmpegPreChunks.filter((chunk) => chunk !== latestBootstrapAccessUnit);
  }
  if (prebufferFlushRetryTimer) {
    clearTimeout(prebufferFlushRetryTimer);
    prebufferFlushRetryTimer = null;
  }
  flushPreBuffer();
}

function sendFrame(frame: Buffer) {
  return sendFrameToAllViewers(frame);

  if (isPreBuffering) {
    ffmpegPreChunks.push(frame);
    if (ffmpegPreChunks.length > 3) ffmpegPreChunks.shift();
    return;
  }

  if (!videoTrack || !videoRtpConfig || !peerConnection) {
    return;
  }

  try {
    if (peerConnection.state() !== 'connected') {
      return;
    }

    // Time-based RTP timestamp: 90000 Hz clock relative to stream start
    if (rtpStartTime === 0) rtpStartTime = Date.now();
    currentRtpTimestamp = Math.floor((Date.now() - rtpStartTime) * 90) & 0xFFFFFFFF;
    videoRtpConfig.timestamp = currentRtpTimestamp;

    const bufferedAmount = typeof videoTrack.bufferedAmount === 'function' ? videoTrack.bufferedAmount() : 0;
    // Cap the outgoing media queue tighter (was 512KB ≈ 0.4-1s of video). A big
    // send buffer is exactly what produced "freeze, then everything happens at
    // once": frames pile up during a congestion blip, then flush in a burst.
    // Dropping sooner keeps glass-to-glass latency bounded; the ~0.5s GOP resyncs
    // quickly afterwards.
    const maxBufferedBytes = Number(process.env.REMOTE365_TRACK_BUFFER_LIMIT || 64 * 1024);
    if (bufferedAmount > maxBufferedBytes) {
      droppedEncodedFrames++;
      return;
    }

    const isIdr = frameHasIdr(frame);
    const sent = videoTrack.sendMessageBinary(frame, videoRtpConfig);
    if (sent) {
      if (!firstFrameSent) {
        log.info(`[Host] First video frame fully assembled (${frame.length} bytes). Delivering to peer...`);
        firstFrameSent = true;
      }
      totalBytesSent += frame.length;
      frameCount++;
    } else {
      droppedEncodedFrames++;
    }

    const now = Date.now();
    if (now - lastLogTime > 5000) {
      const duration = (now - lastLogTime) / 1000;
      const bytesTransmitted = totalBytesSent - lastLogBytes;
      const mbps = ((bytesTransmitted * 8) / (1024 * 1024)) / duration;
      log.info(`[Host] Media health: quality=${activeAdaptiveQuality || hostStreamSettings.quality} sentFrames=${frameCount} droppedEncoded=${droppedEncodedFrames} skippedCursor=${skippedCursorFrames} trackBufferKB=${Math.round(bufferedAmount / 1024)} lastFrame=${isIdr ? 'IDR' : 'delta'} bandwidthMbps=${mbps.toFixed(2)}`);
      droppedEncodedFrames = 0;
      skippedCursorFrames = 0;
      lastLogBytes = totalBytesSent;
      lastLogTime = now;
    }
  } catch (err: any) {
    // Silently handle "Track is non-open" or "Track is closed" at this layer
    // This prevents the native C++ throw from crashing the Node process
    if (err?.message?.includes('closed') || err?.message?.includes('not open')) {
      stopStreaming();
    } else {
      log.error(`[Host] Error sending frame: ${err?.message}`);
    }
  }
}

function flushPreBuffer() {
  clearPreBufferWatchdog();
  if (!isPreBuffering) return;
  log.info(`[Host] Flushing ${ffmpegPreChunks.length} pre-buffered frames to track...`);
  isPreBuffering = false;
  // The 3-frame ring may have evicted the stream's only keyframe.
  requestHostKeyframe('prebuffer-flush', { join: true });
  
  const chunks = [...ffmpegPreChunks];
  ffmpegPreChunks = [];
  
  for (const chunk of chunks) {
    sendFrame(chunk);
  }
}

// Short-lived ICE server cache: resolveHostIceServers sits directly in the
// viewer-join path (join -> fetch -> THEN build peer/offer), so a cold HTTPS
// round-trip to the backend delays every session start. Prefetched when host
// signaling connects; 5 minutes is safely inside the TURN credential TTL.
let hostIceServersCache: { host: string; list: any[]; at: number } | null = null;

async function resolveHostIceServers(serverHost: string, token: string) {
  const fallback = [
    { hostname: 'stun.l.google.com', port: 19302 },
    { hostname: 'stun1.l.google.com', port: 19302 }
  ];
  // Unattended (pre-logon) hosting has no user token. STUN-only would leave the
  // device Online but unable to connect on any network that needs a relay, so
  // authenticate to the ICE endpoint with the machine credential instead. Sent
  // as headers, never a query string — credentials in URLs end up in access logs.
  const machineAuthHeaders = !token && activeHostSecret && activeHostAccessKey
    ? { 'X-Device-Key': activeHostAccessKey, 'X-Host-Secret': activeHostSecret }
    : null;
  if (!token && !machineAuthHeaders) return fallback;
  if (hostIceServersCache && hostIceServersCache.host === serverHost && Date.now() - hostIceServersCache.at < 5 * 60_000) {
    return hostIceServersCache.list;
  }

  try {
    // Bounded: this is awaited on the offer path, so an unresponsive network
    // (or captive portal) would otherwise stall the session start indefinitely.
    // On timeout we use the STUN fallback list and still connect.
    const iceAbort = new AbortController();
    const iceTimer = setTimeout(() => iceAbort.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(`${buildHttpOrigin(serverHost)}/api/auth/ice-servers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : (machineAuthHeaders as Record<string, string>),
        signal: iceAbort.signal
      });
    } finally {
      clearTimeout(iceTimer);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }> };
    const servers: any[] = [];
    for (const server of data.iceServers || []) {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      for (const url of urls) {
        if (typeof url !== 'string') continue;
        if (url.startsWith('stun:')) {
          const hostPort = url.replace(/^stun:/, '').split('?')[0];
          const [hostname, port = '19302'] = hostPort.split(':');
          servers.push({ hostname, port: Number(port) || 19302 });
        } else if (url.startsWith('turn:') && server.username && server.credential) {
          const hostPort = url.replace(/^turn:/, '').split('?')[0];
          const [hostname, port = '3478'] = hostPort.split(':');
          const relayType = url.includes('transport=tcp') ? 'TurnTcp' : 'TurnUdp';
          servers.push({ hostname, port: Number(port) || 3478, username: server.username, password: server.credential, relayType });
        }
      }
    }
    if (servers.length > 0) {
      hostIceServersCache = { host: serverHost, list: servers, at: Date.now() };
      return servers;
    }
    return fallback;
  } catch (err: any) {
    log.warn(`[Host] Failed to fetch ICE servers from backend; using STUN fallback: ${err?.message || err}`);
    return fallback;
  }
}

// ── LAN Direct ────────────────────────────────────────────────────────────────
// Offline/local access. Persisted locally (NOT on the server) because its whole
// purpose is to work when the server is unreachable — including after a reboot
// with no internet. Only a salted hash of the password is stored; the plaintext
// never touches disk.
const LAN_CONFIG_PATH = () => join(app.getPath('userData'), 'connectx_lan_direct.json');
type LanConfig = { enabled: boolean; passwordSalt: string; passwordHash: string };
let lanConfig: LanConfig = { enabled: false, passwordSalt: '', passwordHash: '' };
try {
  lanConfig = { ...lanConfig, ...JSON.parse(readFileSync(LAN_CONFIG_PATH(), 'utf8')) };
} catch {}
const persistLanConfig = () => {
  try { require('fs').writeFileSync(LAN_CONFIG_PATH(), JSON.stringify(lanConfig)); } catch {}
};

const hashLanPassword = (password: string, salt: string) =>
  require('crypto').createHash('sha256').update(`${salt}:${password}`).digest('hex');

function setLanPassword(password: string) {
  const salt = require('crypto').randomBytes(16).toString('hex');
  lanConfig.passwordSalt = salt;
  lanConfig.passwordHash = hashLanPassword(password, salt);
  persistLanConfig();
}

function verifyLanPassword(password: string): boolean {
  if (!lanConfig.passwordHash || !lanConfig.passwordSalt) return false;
  const candidate = hashLanPassword(String(password || ''), lanConfig.passwordSalt);
  try {
    return require('crypto').timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(lanConfig.passwordHash, 'hex'),
    );
  } catch {
    return false;
  }
}

function startLanDirectIfConfigured(): { ok: boolean; error?: string; addresses: string[] } {
  if (!lanConfig.enabled) return { ok: false, error: 'LAN Direct is disabled.', addresses: [] };
  // No password, no LAN access. Online, "easy access" is safe because the server
  // still authenticates the viewer; offline nothing else does, so the password is
  // the entire authorization and cannot be optional.
  if (!lanConfig.passwordHash) {
    return { ok: false, error: 'Set a LAN access password first.', addresses: [] };
  }
  return startLanDirect({
    verifyPassword: verifyLanPassword,
    getIdentity: () => ({
      deviceName: hostStreamSettings.deviceName || os.hostname(),
      deviceId: String(currentHostSessionId || activeHostAccessKey || ''),
      accessKey: activeHostAccessKey || '',
    }),
    onViewerJoin: (viewerId: string, viewerName: string) => {
      hostViewerNames.set(viewerId, viewerName);
      // Same entry point a cloud viewer takes, so the session behaves identically.
      handleHostSignalingMessage({ type: 'request-offer', viewerId }, () => {});
    },
    onSignal: (data: any) => handleHostSignalingMessage(data, (payload: any) => sendToLanViewer(data.senderId, payload)),
    onViewerLeave: (viewerId: string) => {
      hostViewerNames.delete(viewerId);
      cleanupHostViewerPeer(viewerId, 'lan-viewer-left');
    },
    log: (message: string) => log.info(message),
  });
}

/**
 * Route a signaling payload to one viewer over whichever transport that viewer
 * arrived on. Cloud viewers go out via the signaling WebSocket; LAN Direct viewers
 * go straight down their local socket. Everything above this line is transport
 * agnostic, which is what lets LAN sessions reuse the identical WebRTC path.
 */
function sendSignalToViewer(viewerId: string, payload: any) {
  if (isLanViewer(viewerId)) {
    if (!sendToLanViewer(viewerId, payload)) {
      log.warn(`[Host] LAN viewer ${viewerId} unreachable; dropping ${payload?.type}`);
    }
    return;
  }
  hostSignalingWs?.send(JSON.stringify(payload));
}

// --- WebRTC Logic ---
async function initiateHostWebRTC(viewerId: string) {
  const sessionStartedAt = Date.now();
  log.info(`[Host] Initializing session for: ${viewerId}`);
  cleanupHostViewerPeer(viewerId, 'reconnecting-same-viewer');
  ensureDatachannel();
  currentViewerId = viewerId;
  const viewerPeerId = viewerId;
  const shouldStartHostStream = hostViewerPeers.size === 0 && !ffmpegProcess && !captureInterval && !initPollInterval;
  let hostPeer: HostViewerPeer | null = null;
  // Start automatic sessions at full-HD/balanced bandwidth. The previous
  // ultra-first policy pushed a 12-16Mbps IDR through an unmeasured WAN path,
  // and the affected 250ms route lost up to 93% of that burst before the
  // adaptive loop could react. Clean links can climb after proving capacity;
  // an explicit user quality pin still wins.
  if (shouldStartHostStream && !userQualityLock) {
    activeAdaptiveQuality = 'balanced';
  }

  // â”€â”€ Pre-start FFmpeg BEFORE WebRTC is ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // This hides FFmpeg cold-start latency behind the ICE handshake (~200-500ms).
  // Output is buffered until the video track opens, then flushed.
  if (shouldStartHostStream) {
    log.info('[Host] Pre-starting FFmpeg to eliminate cold-start lag...');
    isPreBuffering = true;
    ffmpegPreChunks = [];
    armPreBufferWatchdog();
  } else {
    log.info(`[Host] Reusing active desktop stream for additional viewer: ${viewerId}`);
    requestHostKeyframe('viewer-joined-running-stream', { join: true });
  }

  // Start capture immediately and overlap encoder warm-up with auth/ICE
  // resolution. The previous fixed 200ms handover delay had no dependency
  // behind it and appeared directly in every first-frame waterfall.
  if (shouldStartHostStream) {
    startStreaming();
  }

  const { token } = await getAuthTokens();
  const iceServers = await resolveHostIceServers(currentSignalingServer, token || '');

  peerConnection = new datachannel.PeerConnection("Host", {
    iceServers: iceServers,
    // "Block incoming LAN connections" (Settings → Network) forces relay-only.
    iceTransportPolicy: iceTransportPref
  });
  const localPeerConnection = peerConnection;




  localPeerConnection.onGatheringStateChange((state: string) => {
    log.info(`[Host] ICE Gathering state for ${viewerPeerId}: ${state}`);
  });

  localPeerConnection.onLocalDescription((sdp: string) => {
    if (hostPeer) hostPeer.offerSentAt = Date.now();
    log.info(`[Host] Sending SDP Offer to ${viewerPeerId} (len: ${sdp.length})...`);
    // log.info(`[Host] Offer SDP:\n${sdp}`);
    sendSignalToViewer(viewerPeerId, { type: 'offer', sdp, targetId: viewerPeerId });
  });

  localPeerConnection.onLocalCandidate((candidate: string, mid: string) => {
    const mLineIndex = (mid === '0' || mid === 'video') ? 0 : 1;
    log.info(`[Host] Local ICE candidate for ${viewerPeerId}: ${describeIceCandidate(candidate)} mid=${mid}`);
    sendSignalToViewer(viewerPeerId, {
      type: 'ice-candidate', candidate, sdpMid: mid, sdpMLineIndex: mLineIndex, targetId: viewerPeerId
    });
  });

  // Per-viewer grace timer for transient 'disconnected' states (see below).
  let disconnectGraceTimer: NodeJS.Timeout | null = null;
  localPeerConnection.onStateChange((state: string) => {
    log.info(`[Host] WebRTC State for ${viewerPeerId}: ${state}`);
    mainWindow?.webContents.send('host:status', `WebRTC: ${state}`);

    if (state === 'connected') {
      if (hostPeer && !hostPeer.connectedAt) {
        hostPeer.connectedAt = Date.now();
        log.info(`[Perf] Session waterfall viewer=${viewerPeerId} request-to-connected=${hostPeer.connectedAt - hostPeer.sessionStartedAt}ms offer-to-connected=${hostPeer.offerSentAt ? hostPeer.connectedAt - hostPeer.offerSentAt : -1}ms`);
      }
      if (disconnectGraceTimer) {
        clearTimeout(disconnectGraceTimer);
        disconnectGraceTimer = null;
        log.info(`[Host] Viewer ${viewerPeerId} recovered from transient disconnect.`);
      }
      log.info(`[Host] WebRTC connected for ${viewerPeerId}. Active viewers=${hostViewerPeers.size}.`);
      if (hostPeer) syncLegacyPeerAliases(hostPeer);
      // This machine is now being controlled remotely — tell the main window so it
      // can lock its own UI (only the title bar stays interactive). The payload
      // carries who is controlling so the lock overlay can say the name.
      // Only lock the host's own app once the viewer can actually drive it.
      // sendHostDockControlState re-sends this on every grant/deny/revoke.
      setWebLockState(controlGranted, hostViewerNames.get(viewerPeerId) || '');
      mainWindow?.webContents.send('host:remote-control', {
        active: controlGranted,
        viewerName: hostViewerNames.get(viewerPeerId) || '',
      });
      showHostDesktopDock({
        sessionName: hostStreamSettings.deviceName || os.hostname(),
        sessionId: currentHostSessionId || activeHostAccessKey || viewerPeerId || '',
        viewerNames: collectDockViewerNames(),
      });

      // Prevent "Inception" infinite recursion naturally by hiding the Host UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        minimizeHostWindowForRemoteSession('webrtc-connected');
      }

      // The startup IDR may have fallen out of the rolling prebuffer while ICE
      // was negotiating. Queue the separately retained complete AU first; if
      // the media track has not opened yet, its onOpen callback retries.
      openPrebufferForViewer(hostPeer, 'peer-connected');
    } else if (state === 'failed' || state === 'closed') {
      if (disconnectGraceTimer) { clearTimeout(disconnectGraceTimer); disconnectGraceTimer = null; }
      log.warn(`[Host] Viewer ${viewerPeerId} session ended (${state}). Cleaning only that viewer...`);
      cleanupHostViewerPeer(viewerPeerId, `state-${state}`);

      // Restore the Dashboard UI naturally (guarded — see the helper).
      restoreHostWindowIfSessionOver(`state-${state}`);
    } else if (state === 'disconnected') {
      // 'disconnected' is often a transient blip that ICE self-heals within
      // seconds; an instant teardown turns every blip into a full reconnect
      // (new ICE gather + DTLS + first keyframe). Grace it; 'failed' stays hard.
      if (!disconnectGraceTimer) {
        log.warn(`[Host] Viewer ${viewerPeerId} transiently disconnected — 5s grace before cleanup.`);
        disconnectGraceTimer = setTimeout(() => {
          disconnectGraceTimer = null;
          if (localPeerConnection?.state?.() === 'disconnected') {
            log.warn(`[Host] Viewer ${viewerPeerId} did not recover. Cleaning only that viewer...`);
            cleanupHostViewerPeer(viewerPeerId, 'state-disconnected');
            restoreHostWindowIfSessionOver('state-disconnected');
          }
        }, 5000);
      }
    }
  });

  const video = new datachannel.Video("0", "SendOnly");
  // 42e01f = Constrained Baseline L3.1 — required by node-datachannel's RTP sender
  // Chromium accepts this interoperable offer and can answer it even when the
  // encoded SPS later selects a higher profile. Advertising High (640c1f)
  // unconditionally caused Chromium viewers to produce no answer and remain
  // in ICE state "new".
  video.addH264Codec(96, "profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1");
  // node-datachannel: (ssrc, cname, payloadType, clockRate)
  videoRtpConfig = new datachannel.RtpPacketizationConfig(1, "video", 96, 90000);
  const packetizer = new datachannel.H264RtpPacketizer("StartSequence", videoRtpConfig);
  // A packetizer alone cannot repair UDP loss. Keep enough already-packetized
  // RTP data for at least a long-haul RTT and retransmit fragments requested by
  // Chromium via RTCP NACK. Without this chain, losing one FU-A fragment from a
  // large IDR permanently poisoned the decoder reference picture and produced
  // the black/multicolour barcode mosaic seen on affected devices.
  const srReporter = new datachannel.RtcpSrReporter(videoRtpConfig);
  packetizer.addToChain(srReporter);
  // H.264 IDRs fragment into hundreds of RTP packets. Sending the whole access
  // unit at once created a microburst that lost 40-93% of packets on the
  // measured 250-400ms route. Pace the packet train at the configured 12Mbps
  // ceiling so normal frames do not queue while keyframes are spread over the
  // wire instead of dumped into one UDP burst.
  const pacingHandler = new datachannel.PacingHandler(12_000_000, 5);
  packetizer.addToChain(pacingHandler);
  const nackResponder = new datachannel.RtcpNackResponder(2048);
  packetizer.addToChain(nackResponder);

  firstFrameSent = false;
  frameCount = 0;
  lastLogTime = Date.now();
  currentRtpTimestamp = 0;
  rtpStartTime = 0;
  videoTrack = localPeerConnection.addTrack(video);
  videoTrack.setMediaHandler(packetizer);
  // The browser asks for a keyframe itself (RTCP PLI/FIR) the moment its decoder
  // cannot continue. Verified against this exact handler chain in a two-peer
  // loopback: the request surfaces here as a 12-byte PSFB packet.
  try {
    videoTrack.onMessage((message: any) => {
      try {
        if (!onDemandKeyframesActive || typeof message === 'string') return;
        const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
        if (rtcpRequestsKeyframe(buf)) requestHostKeyframe('rtcp-pli');
      } catch { /* malformed RTCP is not our problem */ }
    });
  } catch (err: any) {
    log.warn(`[Host] Could not listen for RTCP keyframe requests: ${err?.message || err}`);
  }

  videoTrack.onOpen(() => {
    log.info('[Host] Video track open callback triggered.');
    // Only flush pre-buffer if the peer connection is already 'connected'.
    // If not, leave isPreBuffering=true so onStateChange('connected') handles it —
    // prevents sendFrame() from silently dropping the first SPS+PPS+IDR due to the
    // state check inside sendFrame.
    if (localPeerConnection?.state() === 'connected') {
      openPrebufferForViewer(hostPeer, 'track-open');
    }
  });

  // Remote audio track. Always offered, even when nothing is playing on the
  // host: adding it later would force a mid-session renegotiation, and the
  // viewer keeps it muted until the user asks to listen.
  const audio = new datachannel.Audio("1", "SendOnly");
  audio.addOpusCodec(OPUS_PAYLOAD_TYPE);
  const localAudioRtpConfig = new datachannel.RtpPacketizationConfig(2, "audio", OPUS_PAYLOAD_TYPE, OPUS_CLOCK_RATE);
  // The generic packetizer IS the Opus one — a frame always fits a single RTP
  // packet, so there is nothing to fragment.
  const audioPacketizer = new datachannel.RtpPacketizer(localAudioRtpConfig);
  audioPacketizer.addToChain(new datachannel.RtcpSrReporter(localAudioRtpConfig));
  const localAudioTrack = localPeerConnection.addTrack(audio);
  localAudioTrack.setMediaHandler(audioPacketizer);

  // Adding DataChannel AFTER the Media Track ensures `node-datachannel`'s implicit asynchronous SDP generator packages BOTH into the singular Offer.
  const localDataChannel = localPeerConnection.createDataChannel("control");
  dataChannel = localDataChannel;
  dataChannel.onOpen(() => {
    const startsWithControl = grantsControlOnConnect(viewerPeerId);
    log.info(`[Host] Control DataChannel open for ${viewerPeerId} — starting in ${startsWithControl ? 'CONTROL' : 'VIEW-ONLY'} mode. Starting Heartbeat & Clipboard loops...`);
    if (hostPeer) {
      hostPeer.controlGranted = startsWithControl;
      hostPeer.pendingControlViewerId = null;
      syncLegacyPeerAliases(hostPeer);
    }
    controlGranted = startsWithControl;
    pendingControlViewerId = null;
    // State the mode explicitly rather than only announcing the good case: the
    // web viewer defaults its local status to 'granted', so silence would leave
    // it showing "In control" while every event it sent bounced off the gate.
    localDataChannel.sendMessage(JSON.stringify({ type: startsWithControl ? 'control-granted' : 'control-denied' }));
    sendHostDockControlState(startsWithControl);
    // Safe to call per viewer — the renderer ignores a start it already honoured.
    setHostAudioCapture(true, 'control-channel-open');
    // Anyone joining while a recording is running is told immediately.
    for (const byName of hostSessionRecorders.values()) {
      try { localDataChannel.sendMessage(JSON.stringify({ type: 'recording-state', on: true, byName })); } catch { /* closing */ }
    }
    localDataChannel.sendMessage(JSON.stringify({ type: 'input-capabilities', compactV1: true }));
    minimizeHostWindowForRemoteSession('control-channel-open');

    // 1. Start Ping Heartbeat (1s)
    if (hostPeer?.pingInterval) clearInterval(hostPeer.pingInterval);
    const localPingInterval = setInterval(() => {
      if (localDataChannel && localDataChannel.isOpen()) {
        localDataChannel.sendMessage(JSON.stringify({ type: 'ping' }));
      }
    }, 1000);
    if (hostPeer) hostPeer.pingInterval = localPingInterval;
    pingInterval = localPingInterval;

    // 2. Start Clipboard Sync (500ms)
    if (hostPeer?.clipboardInterval) clearInterval(hostPeer.clipboardInterval);
    lastClipboardText = clipboard.readText();
    log.info(`[Host] Initialized clipboard sync. Current text length: ${lastClipboardText?.length || 0}`);

    const localClipboardInterval = setInterval(() => {
      try {
        if (!localDataChannel || !localDataChannel.isOpen()) return;
        const text = clipboard.readText();
        if (text && text !== lastClipboardText) {
          lastClipboardText = text;
          log.info(`[Host] Local clipboard changed. Syncing to viewer... (${text.length} chars)`);
          sendClipboardToViewers(text);
        }
      } catch (err: any) {
        log.error(`[Host] Clipboard poll failed: ${err.message}`);
      }
    }, 500);
    if (hostPeer) hostPeer.clipboardInterval = localClipboardInterval;
    clipboardInterval = localClipboardInterval;
  });
  dataChannel.onMessage((msg: any) => handleControlMessage(msg, viewerPeerId));

  // Pointer travel must never queue for seconds behind reliable control
  // traffic. An unordered, time-limited channel drops stale movement during
  // congestion so the cursor catches up to the viewer's current position.
  inputDataChannel = localPeerConnection.createDataChannel("input", {
    unordered: true,
    maxPacketLifeTime: 100
  });
  inputDataChannel.onOpen(() => {
    log.info('[Host] Low-latency input DataChannel open.');
  });
  inputDataChannel.onMessage((msg: any) => handleControlMessage(msg, viewerPeerId));

  // Clicks and keyboard state transitions must arrive exactly once and in
  // order: an unordered/lossy channel can invert a down/up pair (stuck key,
  // stuck button) or silently swallow a click after its packet lifetime.
  // Reliable+ordered on a dedicated channel keeps them off the control
  // channel's file-transfer traffic, so the only added delay is an SCTP
  // retransmit on actual packet loss.
  criticalInputDataChannel = localPeerConnection.createDataChannel("input-critical");
  criticalInputDataChannel.onOpen(() => {
    log.info('[Host] Critical input DataChannel open.');
  });
  criticalInputDataChannel.onMessage((msg: any) => handleControlMessage(msg, viewerPeerId));

  // File transfer gets its own reliable+ordered channel. On the shared
  // control channel a bulk transfer and everything else starved each other
  // both ways: chat/clipboard/camera queued behind megabytes of file bytes,
  // and the transfer's own progress messages queued behind its own chunks —
  // which is how a healthy transfer READ as frozen at 0 B/s. Old viewers
  // never open this channel and keep using the control channel; the ft:
  // handlers accept traffic from either.
  const fileDataChannel = localPeerConnection.createDataChannel("file");
  fileDataChannel.onOpen(() => {
    log.info('[Host] File transfer DataChannel open.');
  });
  fileDataChannel.onMessage((msg: any) => handleControlMessage(msg, viewerPeerId));

  // Explicitly trigger the Offer generation to ensure all configured tracks are included.
  hostPeer = {
    viewerId: viewerPeerId,
    peerConnection: localPeerConnection,
    dataChannel: localDataChannel,
    inputDataChannel,
    criticalInputDataChannel,
    fileDataChannel,
    videoTrack,
    videoRtpConfig,
    audioTrack: localAudioTrack,
    audioRtpConfig: localAudioRtpConfig,
    iceCandidatesQueue: [],
    hasRemoteDescription: false,
    clipboardInterval: null,
    pingInterval: null,
    controlGranted: false,
    pendingControlViewerId: null,
    currentRtpTimestamp: 0,
    rtpStartTime: 0,
    lastFrameSentAt: 0,
    firstFrameSent: false,
    frameCount: 0,
    droppedEncodedFrames: 0,
    totalBytesSent: 0,
    lastLogBytes: 0,
    lastLogTime: Date.now(),
    sessionStartedAt,
    offerSentAt: 0,
    connectedAt: 0,
    // A peer has nothing to decode deltas against until its first keyframe.
    // Only consulted when the keyframe gate is active (see sendFrameToAllViewers).
    waitingForIdr: true,
  };
  const resumeParkedStream = hostViewerPeers.size > 0 && !hasActiveMediaViewer(hostViewerPeers.values());
  hostViewerPeers.set(viewerPeerId, hostPeer);
  if (resumeParkedStream) startStreaming();
  syncLegacyPeerAliases(hostPeer);
  localPeerConnection.setLocalDescription();
}

// Debounced "did that click land in a text field?" probe. Runs shortly after
// the click so the target app has settled focus, then tells the viewer over
// its control/input channel. Mobile viewers use it to auto-open the keyboard;
// the desktop viewer ignores the message.
let focusEditableProbeTimer: NodeJS.Timeout | null = null;
function scheduleFocusEditableProbe(replyChannel: any) {
  if (focusEditableProbeTimer) clearTimeout(focusEditableProbeTimer);
  focusEditableProbeTimer = setTimeout(() => {
    focusEditableProbeTimer = null;
    input.focusIsEditable().then((editable) => {
      if (replyChannel?.isOpen?.()) {
        replyChannel.sendMessage(JSON.stringify({ type: 'focus-editable', editable }));
      }
    }).catch(() => { /* probe is best-effort */ });
  }, 350);
}

// Frame geometry announced by the viewer's cam:start, used to size the canvas
// in the camera window. Kept out of that module so it stays a pure renderer.
let viewerCameraSize = { width: 640, height: 360 };
// Which viewer's camera we are showing, so the window's Close/keyframe
// requests go back to the right peer in a multi-viewer session.
let viewerCameraOwnerId: string | null = null;

setViewerCameraNotifier(
  (payload: any) => { sendToHostViewer(viewerCameraOwnerId, payload); },
  (message: string) => log.info(message),
);

// Everything the v2 transfer engine needs from the app shell. Passed in rather
// than imported so fileTransfer.ts stays free of Electron globals.
// viewerId -> per-file byte cap the server stamped on the join (their plan).
const hostViewerFileCaps = new Map<string, number>();

const fileTransferDeps = {
  defaultReceiveDir,
  log: {
    info: (message: string) => log.info(message),
    error: (message: string) => log.error(message),
  },
  notify: (title: string, body: string, openPath?: string) => {
    try {
      const notification = new Notification({ title, body });
      // "Where did it go?" — one click on the toast opens the folder.
      if (openPath) notification.on('click', () => { shell.openPath(openPath).catch(() => {}); });
      notification.show();
    } catch { /* notifications disabled */ }
  },
};

function handleControlMessage(msg: any, viewerId?: string) {
  try {
    const activePeer = viewerId ? hostViewerPeers.get(viewerId) : getPrimaryHostPeer();
    const replyChannel = activePeer?.dataChannel || dataChannel;
    let event: any = null;
    // 1. Handle Binary File Chunks
    if (Buffer.isBuffer(msg)) {
      if (isCompactInput(msg)) {
        event = decodeCompactInput(msg);
        if (!event) return;
      } else {
      const view = new DataView(msg.buffer, msg.byteOffset, 4);
      const headerLen = view.getUint32(0, true);
      const headerStr = msg.slice(4, 4 + headerLen).toString();
      const header = JSON.parse(headerStr);
      const chunk = msg.slice(4 + headerLen);

      // Protocol v2 frames are streamed straight to disk by the transfer
      // engine. v1's file-chunk handling below stays for web/mobile viewers.
      // ft: replies and bulk bytes go over the dedicated file channel when the
      // viewer opened one, so transfers and the control plane stop starving
      // each other; older viewers fall back to the control channel.
      const ftChannel = activePeer?.fileDataChannel?.isOpen?.() ? activePeer.fileDataChannel : replyChannel;
      if (handleFileTransferChunk(header, chunk, ftChannel, fileTransferDeps)) return;

      // The viewer's camera/mic. Main is a relay here — it forwards the bytes
      // to the camera window, which owns the decoders.
      if (header.type === 'cam:v' || header.type === 'cam:a') {
        if (isViewerCameraWindowOpen()) {
          deliverViewerCameraFrame(header, chunk, viewerCameraSize.width, viewerCameraSize.height);
        }
        return;
      }

      if (header.type === 'file-chunk') {
        // Protocol-v1 writes used to bypass the control gate entirely (the
        // job was created from the chunk header itself), so a view-only
        // viewer could still drop files onto this machine. Same rule as
        // every ft: command, and the same Block File Transfer switch.
        if (!(activePeer?.controlGranted ?? controlGranted) || fileTransferBlocked) return;
        const transferId = header.transferId || `${header.name}-${header.totalSize || header.totalChunks}`;
        let transfer = fileTransfers.get(transferId);
        if (!transfer) {
          const safeName = basename(String(header.name || 'received-file'));
          const targetDir = receivedFilesDir || app.getPath('downloads');
          const filePath = join(targetDir, safeName);
          log.info(`[Host] File transfer started: ${safeName} (${header.totalChunks} chunks)`);
          const stream = createWriteStream(filePath, { flags: 'w' });
          const inactivityTimer = setTimeout(() => {
            const stale = fileTransfers.get(transferId);
            if (!stale) return;
            stale.stream.destroy(new Error('File transfer timed out'));
            fileTransfers.delete(transferId);
          }, 120_000);
          transfer = {
            stream,
            receivedIndices: new Set<number>(),
            received: 0,
            total: Number(header.totalChunks) || 0,
            name: safeName,
            filePath,
            totalSize: header.totalSize,
            transferredBytes: 0,
            lastProgressAt: 0,
            inactivityTimer,
          };
          fileTransfers.set(transferId, transfer);
          stream.on('error', (err: any) => {
            const failed = fileTransfers.get(transferId);
            if (failed) {
              clearTimeout(failed.inactivityTimer);
              fileTransfers.delete(transferId);
            }
            log.error(`[Host] Failed to stream received file: ${err.message}`);
            if (replyChannel?.isOpen?.()) {
              replyChannel.sendMessage(JSON.stringify({
                type: 'file-transfer-error',
                direction: 'send',
                transferId,
                name: safeName,
                totalSize: header.totalSize,
                message: `Could not save ${safeName} on the remote computer.`,
              }));
            }
          });
        }

        const chunkIndex = Number(header.chunkIndex);
        if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= transfer.total) {
          transfer.stream.destroy(new Error('Invalid file chunk index'));
          return;
        }
        if (chunkIndex > transfer.received) {
          // The underlying control channel is ordered. A gap therefore means a
          // malformed/corrupt transfer; never write later bytes at the wrong
          // file offset.
          transfer.stream.destroy(new Error('Out-of-order file chunk'));
          return;
        }
        if (!transfer.receivedIndices.has(chunkIndex)) {
          transfer.receivedIndices.add(chunkIndex);
          transfer.stream.write(chunk);
          transfer.received++;
          transfer.transferredBytes += chunk.length;
          clearTimeout(transfer.inactivityTimer);
          transfer.inactivityTimer = setTimeout(() => {
            const stale = fileTransfers.get(transferId);
            if (!stale) return;
            stale.stream.destroy(new Error('File transfer timed out'));
            fileTransfers.delete(transferId);
          }, 120_000);
          // Per-chunk logging + progress sends share the event loop with input
          // injection — a 16KB-chunk transfer used to add 20-200ms of input lag.
          // Progress is throttled to ~250ms (final chunk always reported).
          const now = Date.now();
          const isFinal = transfer.received === transfer.total;
          if (isFinal || now - transfer.lastProgressAt >= 250) {
            transfer.lastProgressAt = now;
            const progress = Math.round((transfer.received / transfer.total) * 100);
            if (replyChannel && replyChannel.isOpen()) {
              replyChannel.sendMessage(JSON.stringify({
                type: 'file-transfer-progress',
                direction: 'send',
                transferId,
                name: transfer.name,
                progress,
                totalSize: transfer.totalSize,
                transferredBytes: transfer.transferredBytes
              }));
            }
          }
        }

        if (transfer.received === transfer.total) {
          clearTimeout(transfer.inactivityTimer);
          fileTransfers.delete(transferId);
          transfer.stream.end(() => {
            log.info(`[Host] File transfer complete: ${transfer!.name} -> ${transfer!.filePath}`);
            new Notification({ title: 'File Transferred', body: `${transfer!.name} was saved to ${basename(receivedFilesDir || app.getPath('downloads'))}` }).show();
            if (replyChannel?.isOpen?.()) {
              replyChannel.sendMessage(JSON.stringify({
                type: 'file-sent',
                transferId,
                name: transfer!.name,
                path: transfer!.filePath,
                totalSize: transfer!.totalSize || transfer!.transferredBytes,
              }));
            }
          });
          // D — save into the user's chosen received-files folder, or Downloads.
        }
      }
      return;
      }
    }

    // 2. Handle JSON Commands
    if (!event) event = JSON.parse(msg.toString());

    if (event.type === 'viewer-disconnect') {
      log.info(`[Host] Viewer ${viewerId || currentViewerId || ''} ended the remote session.`);
      setTimeout(() => cleanupHostViewerPeer(viewerId || currentViewerId, 'viewer-disconnect'), 0);
      return;
    }

    if (event.type === 'whiteboard-event') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('session:whiteboard-event', event);
      }
      // Render the viewer's strokes on the host's actual screen (fades out per TTL).
      showHostAnnotation(event);
      broadcastToHostViewers(event, null);
      return;
    }

    if (event.type === 'request-control') {
      const requesterId = viewerId || currentViewerId;
      if (activePeer) activePeer.pendingControlViewerId = requesterId || null;
      pendingControlViewerId = requesterId || null;
      // Ask on the DOCK, not by restoring the main window. Bringing the app
      // window up covered the host's whole desktop, so the viewer's picture
      // turned into a blank app window while they waited. The dock is already
      // always-on-top and already carries "Allow keyboard & mouse", so just
      // open it and draw attention to it.
      const requesterName = hostViewerNames.get(String(requesterId || '')) || '';
      if (hostDockWindow && !hostDockWindow.isDestroyed()) {
        hostDockWindow.webContents.send('host-dock:control-request', { viewerName: requesterName });
        // Bring a tucked-away dock out; an expanded one keeps its size (sizing it
        // as the card while the page still showed the panel cut the panel off).
        if (hostDockMode === 'mascot') hostDockMode = 'card';
        positionHostDock(hostDockMode);
        hostDockWindow.showInactive();
      }
      // The primary prompt: a centred window the host cannot miss, which leaves
      // their desktop (and so the viewer's picture) fully visible behind it.
      showHostConsentWindow(String(requesterId || ''), requesterName);
      mainWindow?.webContents.send('host:control-request', {
        viewerId: requesterId,
        viewerName: hostViewerNames.get(String(requesterId || '')) || '',
        requestedAt: Date.now()
      });
      if (replyChannel && replyChannel.isOpen()) {
        replyChannel.sendMessage(JSON.stringify({ type: 'control-pending' }));
      }
      return;
    }

    const requiresControl = !ALLOWED_BEFORE_CONTROL.has(event.type);
    if (requiresControl && !(activePeer?.controlGranted ?? controlGranted)) {
      if (replyChannel && replyChannel.isOpen()) {
        const denyKey = String(viewerId || currentViewerId || '');
        const deniedAt = Date.now();
        if (deniedAt - (lastControlDeniedAt.get(denyKey) || 0) >= CONTROL_DENIED_NOTICE_MS) {
          lastControlDeniedAt.set(denyKey, deniedAt);
          replyChannel.sendMessage(JSON.stringify({ type: 'control-denied' }));
        }
      }
      return;
    }

    // Protocol v2 file transfer. Deliberately placed AFTER the control gate:
    // browsing the host's disk and pulling files off it is not "viewing", so a
    // view-only viewer gets none of it — same policy as the v1 commands below.
    {
      const ftReplyChannel = activePeer?.fileDataChannel?.isOpen?.() ? activePeer.fileDataChannel : replyChannel;
      if (fileTransferBlocked && typeof event.type === 'string' && event.type.startsWith('ft:')) {
        // The host turned file transfer off in Settings. Answer every request
        // with the reason so the viewer's panel says so instead of spinning.
        const message = 'File transfer is turned off on this computer.';
        const refusal = event.type === 'ft:list' || event.type === 'ft:mkdir' || event.type === 'ft:walk'
          ? { type: 'ft:list-error', reqId: event.reqId, message }
          : { type: 'ft:error', jobId: event.jobId, message };
        try { ftReplyChannel?.sendMessage(JSON.stringify(refusal)); } catch { /* channel gone */ }
        return;
      }
      const ftViewerKey = String(viewerId || currentViewerId || '');
      if (handleFileTransferCommand(event, ftReplyChannel, fileTransferDeps, listFilesystem, {
        maxFileBytes: hostViewerFileCaps.get(ftViewerKey) ?? null,
      })) return;
    }

    // Any real input from the viewer resets the idle-disconnect clock.
    if (['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup'].includes(event.type)) {
      lastRemoteInputAt = Date.now();
    }

    switch (event.type) {
      case 'recording-state': {
        const recorderId = String(viewerId || currentViewerId || '');
        const byName = hostViewerNames.get(recorderId) || 'The remote viewer';
        const wasRecording = hostSessionRecorders.has(recorderId);
        if (Boolean(event.on) === wasRecording) return; // dedupe re-sends
        if (event.on) hostSessionRecorders.set(recorderId, byName);
        else hostSessionRecorders.delete(recorderId);
        log.info(`[Host] ${byName} ${event.on ? 'STARTED' : 'stopped'} recording the session.`);
        announceSessionRecording(Boolean(event.on), byName, recorderId);
        return;
      }
      case 'audio-listen': {
        // The viewer turned "listen to remote audio" on or off. Purely so the
        // host can see it on the dock — the track streams regardless.
        const listenerId = String(viewerId || currentViewerId || '');
        if (event.on) hostAudioListeners.add(listenerId);
        else hostAudioListeners.delete(listenerId);
        updateHostAudioDock();
        return;
      }
      case 'mousemove':
        // Inject SYNCHRONOUSLY. A setImmediate-based "latest-wins" coalescer was
        // tried here and reverted: it defers every move behind whatever I/O is
        // already queued on the loop, so on a busy host it made the cursor feel
        // worse all the time to avoid stale-move replay that only happens after
        // a stall. Coalescing belongs upstream (the viewer already gates moves
        // to ~60Hz) or in a future non-blocking injector.
        {
          const point = mapRemotePointToVirtualDesktop(event.x, event.y);
          input.injectMouseMove(point.x, point.y);
        }
        break;
      case 'mousedown': case 'mouseup':
        // Sync movement before click to ensure accuracy
        if (event.x !== undefined && event.y !== undefined) {
          const point = mapRemotePointToVirtualDesktop(event.x, event.y);
          input.injectMouseMove(point.x, point.y);
        }
        const btns: any = { 0: 'left', 1: 'middle', 2: 'right' };
        input.injectMouseAction(btns[event.button] || 'left', event.type === 'mousedown' ? 'down' : 'up');
        // Input-latency echo: events stamped with a seq get an ack AFTER
        // injection, so the viewer can display true click-to-injected RTT.
        if (event.seq !== undefined && replyChannel?.isOpen?.()) {
          replyChannel.sendMessage(JSON.stringify({ type: 'input-ack', seq: event.seq }));
        }
        // After a click lands, report whether focus ended up in an editable
        // text field so mobile viewers can auto-open their on-screen keyboard.
        if (event.type === 'mouseup') scheduleFocusEditableProbe(replyChannel);
        break;
      case 'wheel':
        input.injectMouseScroll(event.deltaX, event.deltaY);
        break;
      case 'keydown': case 'keyup':
        {
          const keyCode = Number(event.keyCode);
          if (!keyCode) break;
          const isDown = event.type === 'keydown';
          const isModifierKey = HELD_MODIFIER_VKS.has(keyCode);
          // CapsLock STATE sync (viewers report it with every key event and
          // never forward the CapsLock key itself — replaying toggle presses
          // double-fires on key-repeat and drifts the two machines apart).
          // When the host's toggle state differs from the viewer's, tap
          // VK_CAPITAL once so typing case always matches what the viewer sees
          // on their own keyboard LED.
          if (isDown && typeof event.capsLock === 'boolean' && typeof (input as any).isKeyToggled === 'function') {
            try {
              if (Boolean((input as any).isKeyToggled(0x14)) !== Boolean(event.capsLock)) {
                input.injectKeyAction(0x14, 'down');
                input.injectKeyAction(0x14, 'up');
              }
            } catch { /* older native binary without isKeyToggled */ }
          }
          // Defensive catch-up: if this event says a modifier should be held
          // but we haven't seen that modifier's own keydown, press it first so
          // the main key lands with the right case/symbol.
          if (isDown && !isModifierKey) {
            for (const [flag, vk] of Object.entries(MODIFIER_VKS)) {
              if ((event as any)[flag] && !heldModifierVKs.has(vk)) {
                input.injectKeyAction(vk, 'down');
                heldModifierVKs.add(vk);
              }
            }
          }
          if (isModifierKey) {
            if (isDown) heldModifierVKs.add(keyCode); else heldModifierVKs.delete(keyCode);
          }
          // No logging here: electron-log file writes are synchronous and this
          // sits directly in front of every keystroke's injection.
          input.injectKeyAction(keyCode, isDown ? 'down' : 'up');
        }
        break;
      case 'stream-activity': {
        if (!activePeer || typeof event.active !== 'boolean') break;
        const transition = updateHostMediaActivity([...hostViewerPeers.values()], activePeer, event.active);
        if (transition === 'pause') {
          stopStreaming();
          setHostAudioCapture(false, 'viewer-tabs-paused', true);
          latestBootstrapAccessUnit = null;
          ffmpegPreChunks = [];
        } else if (transition === 'resume' || transition === 'keyframe') {
          activePeer.waitingForIdr = true;
          if (transition === 'resume') {
            startStreaming();
            setHostAudioCapture(true, 'viewer-tab-resumed');
          }
          else requestHostKeyframe('viewer-tab-resumed', { join: true });
        }
        break;
      }
      case 'stream-quality':
        if (activePeer?.mediaPaused) break;
        {
          // While the machine is locked we stream the secure desktop through the
          // agent, and a stream restart here can't re-probe DXGI (it's blocked)
          // and would change the encoded width between quality tiers — which the
          // viewer sees as the lock/PIN screen zooming in and out. Freeze quality
          // changes until unlock; the tuner resumes automatically after.
          if (hostSessionLocked) break;
          const now = Date.now();
          // Explicit choice from the viewer's Quality menu. "auto" releases the lock
          // and hands control back to the bandwidth-driven adaptation; a fixed choice
          // pins quality so the auto-tuner can't override the user.
          if (event.reason === 'user') {
            if (String(event.mode).toLowerCase() === 'auto') {
              userQualityLock = null;
              log.info('[Host] Quality: user selected Auto — resuming adaptive.');
              break;
            }
            const pinned = normalizeHostStreamQuality(event.mode);
            userQualityLock = pinned;
            if (pinned !== activeAdaptiveQuality) {
              activeAdaptiveQuality = pinned;
              lastAdaptiveQualityChange = now;
              log.info(`[Host] Quality: user pinned -> ${pinned}.`);
              if ((hostViewerPeers.size > 0 || videoTrack) && (ffmpegProcess || isStreamWorkerEnabled())) startStreaming();
            }
            break;
          }
          // Bandwidth-driven adaptation — never fight an explicit user lock.
          if (userQualityLock) break;
          const requested = normalizeHostStreamQuality(event.mode);
          if (requested !== activeAdaptiveQuality) {
            const rank: Record<string, number> = { smooth: 0, balanced: 1, sharp: 2, ultra: 3 };
            const isDownshift = (rank[requested] ?? 1) < (rank[activeAdaptiveQuality] ?? 1);
            // React fast to congestion (downshift) so latency is shed quickly, but
            // rate-limit quality increases so a restart storm can't itself stutter.
            const minGap = isDownshift ? 1500 : 6000;
            if (now - lastAdaptiveQualityChange > minGap) {
              activeAdaptiveQuality = requested;
              lastAdaptiveQualityChange = now;
              log.info(`[Host] Adaptive stream quality -> ${requested} (rtt=${event.rttMs || 0}ms loss=${event.lossPct || 0}% fps=${event.fps || 0} reason=${event.reason || 'viewer-stats'}).`);
              if ((hostViewerPeers.size > 0 || videoTrack) && (ffmpegProcess || isStreamWorkerEnabled())) startStreaming();
            }
          }
        }
        break;
      case 'chat':
        {
          // Viewer → host chat. Surface it in the dedicated chat window —
          // created (or re-shown) beside the dock without stealing focus.
          const text = String(event.text || '').trim().slice(0, 2000);
          if (!text) break;
          const from = String(event.from || collectDockViewerNames()[0] || 'Remote Viewer').slice(0, 80);
          deliverHostChatMessage(from, text);
        }
        break;
      case 'keyCombo':
        {
          injectKeyCombo(Array.isArray(event.keys) ? event.keys : []);
        }
        break;
      case 'paste-clipboard':
        if (typeof event.text === 'string') {
          lastClipboardText = event.text;
          clipboard.writeText(event.text);
        }
        injectKeyCombo([0x11, 0x56]);
        break;
      case 'clipboard-select-all':
        injectKeyCombo([0x11, 0x41]);
        break;
      case 'clipboard-copy':
        injectKeyCombo([0x11, 0x43]);
        break;
      case 'clipboard-cut':
        injectKeyCombo([0x11, 0x58]);
        break;
      case 'clipboard':
      case 'clipboard-sync':
        applyViewerClipboardText(event.text);
        break;
      case 'clipboard-chunk':
        handleViewerClipboardChunk(event);
        break;
      case 'release-keys':
        // The viewer window lost focus (Alt+Tab away, another app clicked):
        // let go of every modifier we injected so the host isn't left with
        // Shift / Ctrl / Alt / Win held down.
        for (const vk of heldModifierVKs) {
          try { input.injectKeyAction(vk, 'up'); } catch {}
        }
        heldModifierVKs.clear();
        break;
      case 'cam:start': {
        // The viewer turned their camera on. Open (or reuse) the floating tile
        // and remember the geometry so the window can size its canvas.
        viewerCameraSize = {
          width: Math.max(64, Number(event.width) || 640),
          height: Math.max(64, Number(event.height) || 360),
        };
        viewerCameraOwnerId = viewerId || currentViewerId || null;
        const cameraViewerName = hostViewerNames.get(String(viewerCameraOwnerId || '')) || 'Remote viewer';
        // hasVideo is absent on older viewers, which always sent a picture.
        const cameraHasVideo = event.hasVideo !== false;
        // The viewer negotiates its own codec and tells us which one it picked,
        // so we decode what was actually sent instead of assuming H.264 —
        // GPU-less hosts have no H.264 decoder in WebCodecs at all. Older
        // viewers send no codec field and were always H.264.
        const cameraCodec = String(event.codec || 'avc1.42E01F');
        showViewerCameraWindow(cameraViewerName, cameraHasVideo, cameraCodec);
        log.info(`[Host] Viewer camera started (${cameraHasVideo ? `${viewerCameraSize.width}x${viewerCameraSize.height} ${cameraCodec}` : 'audio only'}) from ${cameraViewerName}`);
        break;
      }
      case 'cam:stop':
        hideViewerCameraWindow();
        viewerCameraOwnerId = null;
        log.info('[Host] Viewer camera stopped.');
        break;
      case 'request-file-from-host':
        sendFileFromHost(undefined, viewerId).catch((err: any) => log.error(`[Host] Failed to send requested file: ${err.message}`));
        break;
      case 'file-browser-list':
        listFilesystem(event.path).then((listing) => {
          replyChannel?.sendMessage?.(JSON.stringify({ type: 'file-browser-list', side: 'remote', ...listing }));
        }).catch((err: any) => {
          replyChannel?.sendMessage?.(JSON.stringify({ type: 'file-browser-error', side: 'remote', message: err?.message || 'Could not list remote folder.' }));
        });
        break;
      case 'request-file-from-host-path':
        sendFileFromHost(event.path, viewerId).catch((err: any) => log.error(`[Host] Failed to send selected file: ${err.message}`));
        break;
      case 'typeText':
        input.injectText(event.text);
        break;
      case 'globalAction':
        if (event.action === 1) {
          injectKeyCombo([0x1B]);
        } else if (event.action === 2) {
          injectKeyCombo([0x12, 0x24]); // Alt + Home
        } else if (event.action === 3) {
          injectKeyCombo([0x12, 0x09]); // Alt + Tab
        } else if (event.action === 4) {
          injectKeyCombo([0x12, 0x28]); // Alt + Down
        }
        break;
      case 'shortcut':
        if (event.key === 'notifications') {
          // Win + N: Notifications (Windows 11)
          injectKeyCombo([0x5B, 0x4E]);
        } else if (event.key === 'control-center') {
          // Win + A: Quick Settings (Windows 11)
          injectKeyCombo([0x5B, 0x41]);
        } else if (event.key === 'show-desktop') {
          injectKeyCombo([0x5B, 0x44]);
        } else if (event.key === 'file-explorer') {
          injectKeyCombo([0x5B, 0x45]);
        }
        break;
      case 'action':
        if (event.action === 'task_manager') {
          spawn('taskmgr.exe', [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
        } else if (event.action === 'explorer') {
          spawn('explorer.exe', [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
        } else if (event.action === 'browser') {
          shell.openExternal('https://www.google.com').catch((err: any) => log.warn(`[Host] Failed to open browser: ${err.message}`));
        } else if (event.action === 'lock') {
          injectKeyCombo([0x5B, 0x4C]);
        } else if (event.action === 'reboot') {
          new Notification({ title: 'Remote365', body: 'Remote reboot requested.' }).show();
          spawn('shutdown.exe', ['/r', '/t', '0'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        } else if (event.action === 'safe_reboot') {
          // Graceful restart: 15s delay so open apps can prompt/save before going down.
          new Notification({ title: 'Remote365', body: 'Safe reboot requested. Restarting in 15 seconds.' }).show();
          spawn('shutdown.exe', ['/r', '/t', '15'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        } else if (event.action === 'sign_out') {
          new Notification({ title: 'Remote365', body: 'Remote sign-out requested.' }).show();
          spawn('shutdown.exe', ['/l'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        } else if (event.action === 'wake') {
          const point = mapRemotePointToVirtualDesktop(0.5, 0.5);
          input.injectMouseMove(point.x, point.y);
        } else if (event.action === 'minimize_host_window') {
          // The host window can't take an injected click while it's busy streaming, so
          // the viewer drives minimize/restore over the data channel instead.
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) mainWindow.minimize();
        } else if (event.action === 'restore_host_window') {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
          }
        }
        break;
      case 'request-keyframe':
        if (activePeer?.mediaPaused) break;
        // Keyframes on demand: answer every request with a real keyframe
        // (rate-limited inside). The encoder RESTART below stays as the last
        // resort for a viewer that reports a long stall anyway.
        if (requestHostKeyframe(`viewer-request:${event.reason || (event.urgent ? 'urgent' : 'probe')}`)) {
          if (!event.urgent || Number(event.stalledMs || 0) < 6000) break;
        }
        if (!event.urgent) {
          // Startup probes are advisory. The 100ms static keepalive now reaches
          // the next natural GOP quickly, so these must not restart the encoder.
          log.info('[Host] Non-urgent keyframe request will use the next GOP.');
          break;
        }
        if (Date.now() - lastUrgentKeyframeRestartAt >= 15_000) {
          // Only a measured black/stalled/corrupt decoder may restart capture
          // and encode. A long cooldown prevents packet loss -> IDR burst ->
          // more packet loss from becoming a self-sustaining restart storm.
          lastUrgentKeyframeRestartAt = Date.now();
          log.warn(`[Host] Keyframe recovery: restarting encoder (urgent=${!!event.urgent}, reason=${event.reason || 'viewer-request'}, stalledMs=${Number(event.stalledMs || 0)}, loss=${Number(event.lossPct || 0)}%, lostDelta=${Number(event.packetsLostDelta || 0)}).`);
          startStreaming();
          break;
        }
        log.info('[Host] Urgent keyframe recovery suppressed by the 15s restart cooldown.');
        break;
    }
  } catch (err: any) {
    // A swallowed exception here makes a lost input indistinguishable from a
    // late one — always leave a trace.
    log.warn(`[Host] handleControlMessage failed: ${err?.message || err}`);
  }
}

// --- Signaling & App Setup ---

function jwtExpiryMs(token: string): number | null {
  try {
    const part = String(token).split('.')[1];
    const payload = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// The access token expires 24h after login. A host that stays online longer than
// that must never replay the token captured at host:start — every (re)connect
// re-reads the store and refreshes through /api/auth/refresh when it is stale,
// otherwise the next reconnect registers with a dead token and the device drops
// offline until the app is restarted.
async function getFreshHostToken(): Promise<string> {
  const { token, refresh } = await getAuthTokens();
  if (!token) return '';
  const expMs = jwtExpiryMs(token);
  if (expMs && expMs - Date.now() > 5 * 60 * 1000) return token;
  if (!refresh) return token;
  try {
    const origin = buildHttpOrigin(currentSignalingServer || DEFAULT_SERVER_HOST);
    // HARD TIMEOUT — this sits inside the reconnect path. Without it, a dead or
    // captive-portal'd network makes this await hang indefinitely (undici has no
    // total-request timeout), and because the reconnect flag is already cleared
    // by then, the host would never retry: offline until the app restarts.
    // On timeout we fall through to the stored token; the register attempt
    // either works or fails fast into the normal reconnect loop.
    const refreshAbort = new AbortController();
    const refreshTimer = setTimeout(() => refreshAbort.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(`${origin}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
        signal: refreshAbort.signal,
      });
    } finally {
      clearTimeout(refreshTimer);
    }
    if (!res.ok) {
      log.warn(`[Host] Token refresh failed (HTTP ${res.status}); registering with the stored token.`);
      return token;
    }
    const fresh: any = await res.json();
    const newToken = fresh?.accessToken || fresh?.token || '';
    if (newToken) {
      await setAuthTokens(newToken, fresh?.refreshToken || refresh);
      log.info('[Host] Access token refreshed for signaling registration.');
      return newToken;
    }
  } catch (err: any) {
    log.warn(`[Host] Token refresh error: ${err?.message || err}`);
  }
  return token;
}

/**
 * Adopt this machine's credential for the given device, if one was provisioned.
 *
 * connectHostSignaling only sends it when there is no token, so this is a pure
 * safety net: normal operation still registers as the signed-in user, and the
 * secret takes over exactly when the token path is unusable.
 */
function loadMachineHostSecret(accessKey: string) {
  const key = String(accessKey || '').replace(/\s/g, '');
  if (!key) return;
  if (activeHostSecret && activeHostSecretKey === key) return;
  try {
    const credential = readUnattendedCredential();
    const credentialKey = String(credential?.accessKey || '').replace(/\s/g, '');
    if (!credential?.hostSecret || credentialKey !== key) {
      // The device identity changed (backend reset, re-registration) and the
      // stored credential belongs to the old one. Never offer it for a device
      // it wasn't issued for.
      if (activeHostSecretKey && activeHostSecretKey !== key) {
        activeHostSecret = '';
        activeHostSecretKey = '';
      }
      return;
    }
    activeHostSecret = credential.hostSecret;
    activeHostSecretKey = key;
    log.info('[Host] Machine credential loaded — registration can fall back to it if the user token fails.');
  } catch (err: any) {
    log.warn(`[Host] Could not read the machine credential: ${err?.message || err}`);
  }
}

/**
 * Should the next registration attempt use the machine credential instead of the
 * signed-in user's token?
 *
 * Alternates once the token has been rejected twice, so a device recovers as
 * soon as EITHER credential becomes valid again: the user signs back in, or the
 * machine credential outlives an expired refresh token.
 */
function shouldRegisterWithMachineSecret(): boolean {
  if (isHostGuestMode || isPreLogonHost) return false;
  if (hostTokenRejections < 2 || hostTokenRejections % 2 !== 0) return false;
  loadMachineHostSecret(activeHostAccessKey);
  return Boolean(activeHostSecret);
}

function scheduleHostReconnect(reason: string) {
  if (isReconnectScheduled || isManualHostStop || !activeHostAccessKey) return;
  isReconnectScheduled = true;
  hostReconnectAttempts += 1;
  const delayMs = Math.min(30000, 5000 * hostReconnectAttempts) + Math.floor(Math.random() * 1000);
  log.info(`[Host] Scheduling reconnection in ${Math.round(delayMs / 1000)}s (attempt ${hostReconnectAttempts}, reason: ${reason})...`);
  setTimeout(async () => {
    isReconnectScheduled = false;
    try {
      if (isManualHostStop) return;
      if (hostSignalingWs && hostSignalingWs.readyState === WebSocket.OPEN) return;
      // Pre-logon has no user token by definition — it re-registers with the
      // machine credential, which connectHostSignaling attaches on its own.
      // An empty token is also how we hand this attempt to that credential when
      // the user token keeps being rejected.
      const useMachineSecret = shouldRegisterWithMachineSecret();
      if (useMachineSecret) log.info('[Host] Registering with the machine credential this attempt (user token was rejected).');
      const token = (isHostGuestMode || isPreLogonHost || useMachineSecret) ? '' : await getFreshHostToken();
      if (isManualHostStop) return;
      log.info('[Host] Retrying signaling connection...');
      connectHostSignaling(currentSignalingServer, token, activeHostAccessKey);
    } catch (err: any) {
      // Any failure in here (token refresh, socket construction, DNS) must not
      // end the retry chain — without this the host stays offline until restart.
      log.warn(`[Host] Reconnect attempt failed: ${err?.message || err}`);
      scheduleHostReconnect('retry-threw');
    }
  }, delayMs);
}

// Self-healing supervisor. scheduleHostReconnect is edge-triggered (it fires on
// a 'close'/'error' event), so any path that loses that edge — a stalled await,
// a swallowed error, an OS-level socket state we never get an event for —
// strands the host offline until the app restarts. This level-triggered check
// asks the only question that matters: "we should be online; are we?" and
// re-arms if not. Cheap (every 20s) and idempotent: scheduleHostReconnect
// no-ops when a retry is already pending.
let hostConnectionSupervisor: NodeJS.Timeout | null = null;
function startHostConnectionSupervisor() {
  if (hostConnectionSupervisor) return;
  hostConnectionSupervisor = setInterval(() => {
    if (isManualHostStop || !activeHostAccessKey) return;
    const state = hostSignalingWs?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
    if (isReconnectScheduled) return;
    log.warn('[Host] Supervisor: host should be online but has no signaling socket — re-arming reconnect.');
    scheduleHostReconnect('supervisor');
  }, 20000);
  hostConnectionSupervisor.unref?.();
}

function setupSignalingHandlers(ws: WebSocket) {
  ws.on('message', (message: any) => {
    lastSignalingActivityAt = Date.now();
    let data: any;
    try {
      data = JSON.parse(message.toString());
    } catch {
      return; // one malformed frame must not kill the socket via an uncaught throw
    }
    handleHostSignalingMessage(data, (payload: any) => ws.send(JSON.stringify(payload)));
  });
}

/**
 * Transport-agnostic host signaling handler. Called with messages from the cloud
 * WebSocket AND from LAN Direct viewers, so an offline LAN session drives exactly
 * the same session logic (offer/answer/candidates/cleanup) as an online one.
 * `reply` sends back over whichever transport the message arrived on.
 */
function handleHostSignalingMessage(data: any, reply: (payload: any) => void) {
  {
    if (data.type === 'registered') {
      currentHostSessionId = data.sessionId;
      hostReconnectAttempts = 0;
      hostTokenRejections = 0;
      mainWindow?.webContents.send('host:status', `Online: ${data.sessionId}`);
    } else if (data.type === 'registration-error') {
      const errText = String(data.error || '');
      if (/token|authentication/i.test(errText) && !isHostGuestMode) {
        // Recoverable: the token went stale while we were connected (24h TTL).
        // Close and let the reconnect path register again with a refreshed token
        // instead of going permanently offline until the app restarts.
        hostTokenRejections += 1;
        if (hostTokenRejections === 2) {
          loadMachineHostSecret(activeHostAccessKey);
          if (activeHostSecret) {
            log.warn(`[Host] Registration rejected again (${errText}) — alternating with the machine credential to stay online.`);
          } else {
            log.error(`[Host] Registration rejected (${errText}) and this machine has no credential to fall back on — sign in again to bring the device back online.`);
          }
        } else {
          log.warn(`[Host] Registration rejected (${errText}) — retrying (attempt ${hostTokenRejections}).`);
        }
        safeCloseWebSocket(hostSignalingWs);
      } else if (isPreLogonHost) {
        // Unattended: there is no user to read an error or click retry, and
        // giving up would leave the machine offline until someone signs in —
        // the exact failure pre-logon hosting exists to prevent. Keep retrying
        // on the normal backoff; a rotated credential is refreshed the next
        // time a user hosts.
        log.warn(`[Unattended] Registration rejected (${errText}) — retrying.`);
        safeCloseWebSocket(hostSignalingWs);
      } else {
        log.error(`[Host] Registration denied: ${data.error}`);
        mainWindow?.webContents.send('host:status', 'error');
        // The saved key is no longer valid (device deleted server-side, backend
        // reset). Drop it so future boots don't retry a dead identity; the
        // renderer's self-register issues a fresh one and hosts again, which
        // re-arms everything including a new intent.
        clearHostIntent(`registration denied: ${errText || 'unknown'}`);
        isManualHostStop = true;
        safeCloseWebSocket(hostSignalingWs);
      }
    } else if (data.type === 'viewer-request') {
      preforkStreamWorker();
      // Restore the window for the approval dialog ONLY when nothing is
      // streaming yet. Signaling can re-send viewer-request (retries, a second
      // viewer): restoring mid-session put this app's window in the foreground
      // of the very screen being captured, so the connected viewer watched a
      // full-screen white app instead of the desktop — and it stayed that way,
      // because nothing minimizes it again after the join handshake.
      if (mainWindow && !isRemoteSessionActive()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
      } else if (isRemoteSessionActive()) {
        log.info('[Host] viewer-request during an active session — leaving the window minimized (dock will flash).');
        sendHostDockStatus(`${String(data.viewerName || 'Someone')} wants to join this session`);
      }
      if (data.viewerName) hostViewerNames.set(String(data.viewerId), String(data.viewerName));
      if (data.viewerDeviceId) hostViewerDeviceIds.set(String(data.viewerId), String(data.viewerDeviceId));
      // Forward the approval dialog request to the renderer
      mainWindow?.webContents.send('host:viewer-request', {
        viewerId: data.viewerId,
        viewerClientId: data.viewerClientId,
        viewerName: String(data.viewerName || ''),
      });
      notifySessionWaitWindowsParticipantJoined();
    } else if (data.type === 'viewer-request-cancelled') {
      hostViewerNames.delete(String(data.viewerId));
      hostViewerDeviceIds.delete(String(data.viewerId));
      mainWindow?.webContents.send('host:viewer-request-cancelled', { viewerId: data.viewerId });
    } else if (data.type === 'viewer-joined' || data.type === 'request-offer') {
      preforkStreamWorker();
      const viewerId = data.viewerId || data.senderId;
      if (viewerId && data.viewerName) hostViewerNames.set(String(viewerId), String(data.viewerName));
      if (viewerId && data.viewerDeviceId) hostViewerDeviceIds.set(String(viewerId), String(data.viewerDeviceId));
      // Only viewer-joined carries the claim. request-offer shares this branch
      // but is a re-negotiation of a session already running, so recording it
      // there would silently downgrade an unattended session to view-only on
      // every renegotiation.
      if (viewerId && data.type === 'viewer-joined') {
        hostViewerUnattended.set(String(viewerId), Boolean(data.unattended));
        // Per-file transfer cap for THIS viewer, stamped by the server from
        // their billing plan. -1 / absent = no server figure (older signaling
        // or an unlimited plan); the transfer engine then falls back to the
        // viewer's own claim.
        const cap = Number(data.viewerFileTransferMaxBytes);
        if (Number.isFinite(cap) && cap > 0) hostViewerFileCaps.set(String(viewerId), cap);
        else hostViewerFileCaps.delete(String(viewerId));
        const clientKind = String(data.viewerClientKind || '');
        const isPhone = /^mobile/i.test(clientKind);
        if (isPhone) hostViewerSkipsConsent.add(String(viewerId));
        else hostViewerSkipsConsent.delete(String(viewerId));
        log.info(`[Host] Viewer ${viewerId} joined (${clientKind || 'unknown client'}) as ${
          isPhone ? 'PHONE (consent flow not applied)'
            : data.unattended ? 'UNATTENDED (control pre-granted)'
            : 'attended (must request control)'
        }.`);
      }
      const now = Date.now();

      // Debounce frequent join requests to prevent signaling loops
      if (viewerId === lastViewerJoinId && (now - lastViewerJoinTime) < 500) {
        log.info(`[Host] Ignoring duplicate join request for: ${viewerId}`);
        return;
      }

      lastViewerJoinId = viewerId;
      lastViewerJoinTime = now;
      minimizeHostWindowForRemoteSession('viewer-joined');
      notifySessionWaitWindowsParticipantJoined();
      initiateHostWebRTC(viewerId);
    } else if (data.type === 'answer') {
      try {
        const answerViewerId = data.senderId || data.viewerId || data.targetId || currentViewerId;
        const peer = answerViewerId ? hostViewerPeers.get(answerViewerId) : getPrimaryHostPeer();
        if (!peer) {
          log.warn(`[Host] Ignoring answer without matching viewer peer: ${answerViewerId || 'unknown'}`);
          return;
        }
        log.info(`[Host] Applying remote answer from ${answerViewerId} (len: ${data.sdp.length})...`);
        log.info(`[Host] Full Answer SDP:\n${data.sdp}`);
        peer.peerConnection?.setRemoteDescription(data.sdp, 'answer');
        peer.hasRemoteDescription = true;
        syncLegacyPeerAliases(peer);

        log.info(`[Host] Remote answer applied for ${answerViewerId}. Processing ${peer.iceCandidatesQueue.length} queued candidates.`);
        peer.iceCandidatesQueue.forEach(c => addRemoteCandidateSafe(peer, c.candidate, c.mid));
        peer.iceCandidatesQueue = [];
      } catch (err: any) {
        log.error(`[Host] libdatachannel error during setRemoteDescription: ${err.message}`);
        log.error(`[Host] Error Stack: ${err.stack}`);
      }
    } else if (data.type === 'ice-candidate') {
      // Mobile viewer sends candidate as a flat string; guard for legacy object format
      const candStr: string = typeof data.candidate === 'string'
        ? data.candidate
        : (data.candidate?.candidate ?? '');
      const mid: string = data.sdpMid
        ?? (typeof data.candidate === 'object' ? data.candidate?.sdpMid : null)
        ?? '';
      if (candStr) {
        const candidateViewerId = data.senderId || data.viewerId || data.targetId || currentViewerId;
        const peer = candidateViewerId ? hostViewerPeers.get(candidateViewerId) : getPrimaryHostPeer();
        if (!peer) {
          log.warn(`[Host] Ignoring ICE candidate without matching viewer peer: ${candidateViewerId || 'unknown'}`);
          return;
        }
        log.info(`[Host] Received candidate from ${candidateViewerId}: ${candStr.substring(0, 40)}... (mid: ${mid})`);
        if (peer.hasRemoteDescription) {
          addRemoteCandidateSafe(peer, candStr, mid);
        } else {
          peer.iceCandidatesQueue.push({ candidate: candStr, mid });
        }
      }
    } else if (data.type === 'viewer-left') {
      log.info(`[Host] Viewer ${data.viewerId} left. Cleaning up...`);
      cleanupHostViewerPeer(data.viewerId, 'viewer-left');
    } else if (data.type === 'host-password-updated') {
      // An owner/admin changed this device's access password remotely. Relay the new
      // secret to the renderer so the host screen shows it in real time.
      log.info('[Host] Received remote access-password update from server.');
      mainWindow?.webContents.send('host:password-updated', {
        password: data.password,
        passwordRequired: data.passwordRequired,
      });
    } else if (data.type === 'ping') {
      reply({ type: 'pong' });
    }
  }
}

function connectHostSignaling(serverIP: string, token: string, accessKey: string) {
  const nextAccessKey = String(accessKey || '').replace(/\s/g, '');
  if (
    activeHostAccessKey === nextAccessKey &&
    hostSignalingWs &&
    (hostSignalingWs.readyState === WebSocket.CONNECTING || hostSignalingWs.readyState === WebSocket.OPEN)
  ) {
    log.info('[Host] Signaling connection already active for this access key; duplicate start ignored.');
    return;
  }
  if (hostSignalingWs) {
    safeCloseWebSocket(hostSignalingWs);
    hostSignalingWs = null;
  }

  activeHostAccessKey = nextAccessKey;
  currentSignalingServer = serverIP || DEFAULT_SERVER_HOST;
  const wsUrl = buildSignalUrl(currentSignalingServer);
  log.info(`[Host] Connecting to signaling server at ${wsUrl}...`);
  // Warm the ICE-server cache now so the first viewer join doesn't pay the
  // backend round-trip inside the offer path.
  void resolveHostIceServers(currentSignalingServer, token || '');
  hostSignalingWs = new WebSocket(wsUrl);
  setupSignalingHandlers(hostSignalingWs);
  // Arm the supervisor from the first attempt, not just after a successful
  // open: a host that starts while the network is down must still self-heal.
  startHostConnectionSupervisor();

  hostSignalingWs.on('open', () => {
    log.info('[Host] Signaling socket open. Registering host...');
    isReconnectScheduled = false;
    // Reset the backoff — otherwise a host that reconnected after a long outage
    // keeps the 30s ceiling for the rest of its life, so the NEXT blip costs a
    // full 30s of being offline instead of ~5s.
    hostReconnectAttempts = 0;
    startHostConnectionSupervisor();
    lastSignalingActivityAt = Date.now();
    const registration: any = {
      type: 'register',
      role: 'host',
      accessKey,
      clientKind: 'desktop-host',
      appVersion: app.getVersion(),
      platform: process.platform
    };
    if (token) registration.token = token;
    // Unattended: no signed-in user means no access token, so the machine
    // credential authenticates the registration instead.
    if (!token && activeHostSecret) registration.hostSecret = activeHostSecret;
    hostSignalingWs?.send(JSON.stringify(registration));

    // Start heartbeat to keep the session alive in Redis
    if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
    hostHeartbeatInterval = setInterval(() => {
      if (hostSignalingWs?.readyState === WebSocket.OPEN) {
        // console.log('[Host] Pulse...'); // Debug logging
        hostSignalingWs.send(JSON.stringify({
          type: 'heartbeat',
          clientKind: 'desktop-host',
          appVersion: app.getVersion(),
          platform: process.platform
        }));
      }
    }, 10000); // 10s heartbeat for high stability

    // Liveness watchdog. After sleep or a network drop the socket can go
    // half-open: readyState stays OPEN, no 'close' ever fires, and the server
    // silently expires our presence (TTL 5 min). The server pings every 20s, so
    // >25s of silence means trouble (probe it), and >65s means the link is dead
    // — terminate() to force the 'close' event that drives reconnection.
    // close() is useless here: it waits for a handshake that can never finish.
    if (hostSignalingWatchdog) clearInterval(hostSignalingWatchdog);
    hostSignalingWatchdog = setInterval(() => {
      if (!hostSignalingWs || hostSignalingWs.readyState !== WebSocket.OPEN) return;
      const silentMs = Date.now() - lastSignalingActivityAt;
      if (silentMs > 65000) {
        log.warn(`[Host] Signaling socket silent for ${Math.round(silentMs / 1000)}s — terminating zombie connection.`);
        try { hostSignalingWs.terminate(); } catch { /* already destroyed */ }
      } else if (silentMs > 25000) {
        try { hostSignalingWs.ping(); } catch { /* teardown race */ }
      }
    }, 10000);
  });

  hostSignalingWs.on('ping', () => {
    lastSignalingActivityAt = Date.now();
    const now = Date.now();
    if (now - lastSignalingPingLogTime > 60000) {
      log.info('[Host] Received signaling protocol ping from server.');
      lastSignalingPingLogTime = now;
    }
  });

  hostSignalingWs.on('pong', () => {
    lastSignalingActivityAt = Date.now();
  });

  hostSignalingWs.on('close', () => {
    log.warn('[Host] Signaling connection closed.');
    if (hostHeartbeatInterval) { clearInterval(hostHeartbeatInterval); hostHeartbeatInterval = null; }
    if (hostSignalingWatchdog) { clearInterval(hostSignalingWatchdog); hostSignalingWatchdog = null; }
    scheduleHostReconnect('socket-closed');
  });

  hostSignalingWs.on('error', (err: any) => {
    log.error(`[Host] Signaling error: ${err.message}`);
    // Reuse the close logic for reconnection
    if (!isReconnectScheduled) {
      safeCloseWebSocket(hostSignalingWs);
    }
  });
}

// --- Deep Link Handling ---
function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.host === 'onboard') {
      const token = parsed.searchParams.get('token');
      if (token) {
        log.info('[DeepLink] Received onboarding token:', token);
        mainWindow?.webContents.send('auth:onboarding-token', token);
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }

    if (parsed.host === 'join') {
      const code = parsed.searchParams.get('code');
      const password = parsed.searchParams.get('password') || '';
      if (code) {
        log.info('[DeepLink] Received session join link:', code);
        mainWindow?.webContents.send('session:join-link', { code, password });
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }

    if (parsed.host === 'meeting') {
      const code = parsed.searchParams.get('code');
      if (code) {
        log.info('[DeepLink] Received meeting join link:', code);
        openMeetingWindow(code);
      }
    }

    if (parsed.host === 'auth' && parsed.pathname === '/callback') {
      const accessToken = parsed.searchParams.get('accessToken');
      const refreshToken = parsed.searchParams.get('refreshToken');
      const oauthError = parsed.searchParams.get('error');
      if (oauthError) {
        log.info('[DeepLink] OAuth sign-in refused:', oauthError);
        mainWindow?.webContents.send('auth:deep-link-error', { message: oauthError });
        if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
      }
      if (accessToken && refreshToken) {
        setAuthTokens(accessToken, refreshToken).then(() => {
          mainWindow?.webContents.send('auth:deep-link-success', { accessToken, refreshToken });
        });
      }
    }

    if (parsed.host === 'auth' && parsed.pathname === '/2fa') {
      const tempToken = parsed.searchParams.get('tempToken');
      if (tempToken) {
        log.info('[DeepLink] Received 2FA temp token');
        mainWindow?.webContents.send('auth:temp-2fa-token', tempToken);
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }
  } catch (e) {
    log.error('[DeepLink] Failed to parse URL:', e);
  }
}

// macOS: register open-url before whenReady
app.on('open-url', (event: any, url: any) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Register custom protocol & single-instance lock (Windows / Linux deep links)
for (const scheme of ALL_PROTOCOLS) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(scheme, process.execPath, [resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(scheme);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  log.warn('[Host] Another instance is already running. Quitting.');
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', (_event: any, argv: any) => {
    log.info('[Host] Second instance detected. Restoring main window.');
    // The deep-link URL is the last element on Windows
    const url = findDeepLinkArg(argv);
    if (url) handleDeepLink(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Display geometry cache: mapRemotePointToVirtualDesktop runs for every mouse
// event, and screen.getAllDisplays() + the min/max sweeps are too expensive for
// a 60Hz hot path. Invalidated by the display change events wired up below.
let cachedDesktopGeometry: {
  displays: Electron.Display[];
  virtualLeft: number;
  virtualTop: number;
  virtualWidth: number;
  virtualHeight: number;
} | null = null;

function invalidateDesktopGeometry() {
  cachedDesktopGeometry = null;
}

function getDesktopGeometry() {
  if (!cachedDesktopGeometry) {
    const displays = screen.getAllDisplays();
    const virtualLeft = Math.min(...displays.map((display) => display.bounds.x));
    const virtualTop = Math.min(...displays.map((display) => display.bounds.y));
    const virtualRight = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
    const virtualBottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
    cachedDesktopGeometry = {
      displays,
      virtualLeft,
      virtualTop,
      virtualWidth: Math.max(1, virtualRight - virtualLeft),
      virtualHeight: Math.max(1, virtualBottom - virtualTop),
    };
  }
  return cachedDesktopGeometry;
}

function mapRemotePointToVirtualDesktop(x: number, y: number) {
  const geo = getDesktopGeometry();
  const selectedDisplay = geo.displays.find((d) => d.id === selectedDisplayId) || screen.getPrimaryDisplay();
  const absoluteX = selectedDisplay.bounds.x + Math.max(0, Math.min(1, x)) * selectedDisplay.bounds.width;
  const absoluteY = selectedDisplay.bounds.y + Math.max(0, Math.min(1, y)) * selectedDisplay.bounds.height;

  return {
    x: (absoluteX - geo.virtualLeft) / geo.virtualWidth,
    y: (absoluteY - geo.virtualTop) / geo.virtualHeight
  };
}

// --- Electron Initialization ---
// Custom title-bar window controls (main window is frameless via titleBarStyle:'hidden').
ipcMain.on('window-controls:minimize', () => mainWindow?.minimize());
ipcMain.on('window-controls:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
});
ipcMain.on('window-controls:close', () => mainWindow?.close());
ipcMain.handle('window-controls:is-maximized', () => !!mainWindow?.isMaximized());

function createWindow() {
  log.info('[Host] Starting BrowserWindow construction...');
  try {
    mainWindow = new BrowserWindow({
      width: 1200, height: 800,
      show: false, // Create hidden, then show once content is ready
      autoHideMenuBar: true,
      // Hide the native title bar and render our own (in the renderer) so the window
      // controls are app content — which IS reachable over a remote session, unlike the
      // native caption buttons. Keeps resize borders on Windows (unlike frame:false).
      titleBarStyle: 'hidden',
      icon: app.isPackaged
        ? join(process.resourcesPath, 'logo.png')
        : join(__dirname, '../../src/logo.png'),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: false,
        // Sessions run inside this window's renderer: keep timers full-rate
        // while occluded so input flushing/adaptive loops don't drop to ~1Hz.
        backgroundThrottling: false
      }
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.setMenu(null);
    // Keep the custom title bar's maximize/restore icon in sync.
    // White-screen guard: the app's own maximized window sitting over the
    // desktop is exactly what the viewer streams. Whatever restores it during
    // a session handshake (signaling retries, focus side effects) gets logged
    // by name-of-moment and undone: within 15s of a viewer joining, the window
    // goes straight back to the tray. Later in the session the host may open
    // it deliberately, so only the handshake window is enforced.
    const reMinimizeIfSessionStarting = (trigger: string) => {
      if (!isRemoteSessionActive()) return;
      const sinceJoin = Date.now() - (lastViewerJoinTime || 0);
      log.warn(`[Host] Main window ${trigger} DURING an active session (${Math.round(sinceJoin / 1000)}s after join).`);
      if (sinceJoin < 15_000 && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
        log.warn('[Host] Re-minimizing: the session is still starting, the viewer would only see this app.');
        mainWindow.minimize();
      }
    };
    // A crashed renderer is a permanently WHITE window — and it stays white
    // after the session ends, because nothing reloads it. Whatever kills it
    // (the audio-capture crash did, and anything else that might), log the
    // reason and bring the app back instead of leaving a dead white surface
    // over the desktop for the viewer to stream.
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      log.error(`[Host] RENDERER CRASHED: reason=${details.reason} exitCode=${details.exitCode} — reloading the window.`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
      }, 500);
    });

    mainWindow.on('restore', () => reMinimizeIfSessionStarting('restored'));
    mainWindow.on('show', () => reMinimizeIfSessionStarting('shown'));

    mainWindow.on('maximize', () => mainWindow?.webContents.send('window-controls:maximized', true));
    mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-controls:maximized', false));

    mainWindow.once('ready-to-show', () => {
      log.info('[Host] Main window ready to show.');
      // Normal launches (double-click, run-after-install, and the relaunch
      // after an auto-update) open the window maximized. Only two cases land
      // in the tray: the Windows-login autostart (passes --hidden) and the
      // opt-in "Open minimized" advanced setting (default off). Closing the
      // window hides to the tray via the 'close' handler below.
      const startHidden = advancedFlags.launchMinimized
        || (app.isPackaged && process.argv.includes('--hidden'));
      if (!startHidden) {
        mainWindow?.maximize();
        mainWindow?.show();
        mainWindow?.focus();
        return;
      }
      if (tray && !shownTrayHint) {
        shownTrayHint = true;
        tray.displayBalloon({
          title: 'Remote365 Is Running',
          content: 'Remote365 started in the system tray. Click the icon to open it.',
          iconType: 'info'
        });
      }
    });

    mainWindow.on('close', (event: any) => {
      if (!isQuitting) {
        // "Keep Remote 365 running after closing" off → actually quit.
        if (!advancedFlags.keepRunning) {
          isQuitting = true;
          app.quit();
          return;
        }
        event.preventDefault();
        mainWindow?.hide();
        // Show a one-time balloon so the user knows where to find it
        if (tray && !shownTrayHint) {
          shownTrayHint = true;
          tray.displayBalloon({
            title: 'Still Running In Background',
            content: 'Remote365 is in the system tray. Click the icon to reopen it.',
            iconType: 'info'
          });
        }
      }
      return false;
    });
    for (const evt of ['show', 'hide', 'minimize', 'restore'] as const) {
      mainWindow.on(evt as any, () => updateMainWindowThrottling());
    }
    mainWindow.on('show', () => keepHostWindowOutOfRemoteView('host-window-shown-during-session'));
    mainWindow.on('focus', () => keepHostWindowOutOfRemoteView('host-window-focused-during-session'));
    mainWindow.on('restore', () => keepHostWindowOutOfRemoteView('host-window-restored-during-session'));
    log.info('[Host] BrowserWindow object created.');

    mainWindow.webContents.on('did-finish-load', () => {
      log.info('[Host] Renderer: did-finish-load');
      // A --hidden boot launch never fires show/hide, so settle throttling here
      // once the renderer has had time to finish its start-up work.
      setTimeout(updateMainWindowThrottling, 30_000);
    });
    mainWindow.webContents.on('did-fail-load', (e: any, code: any, desc: any) => log.error(`[Host] Renderer: did-fail-load (${code}): ${desc}`));
    mainWindow.webContents.on('crashed', () => log.error('[Host] Renderer process CRASHED'));
    mainWindow.webContents.on('render-process-gone', (_event: any, details: any) => {
      log.error(`[Host] Renderer process gone: reason=${details?.reason || 'unknown'} exitCode=${details?.exitCode ?? 'unknown'}`);
    });
    mainWindow.webContents.on('unresponsive', () => log.warn('[Host] Renderer became unresponsive'));
    mainWindow.webContents.on('responsive', () => log.info('[Host] Renderer became responsive'));

    if (process.env.VITE_DEV_SERVER_URL) {
      const url = process.env.VITE_DEV_SERVER_URL.replace('localhost', '127.0.0.1');
      log.info(`[Host] Loading URL: ${url}`);
      mainWindow.loadURL(url).catch((e: any) => log.error(`[Host] loadURL failed: ${e.message}`));
    } else {
      log.info('[Host] Loading local production file...');
      mainWindow.loadFile(join(__dirname, '../../dist/index.html')).catch((e: any) => log.error(`[Host] loadFile failed: ${e.message}`));
    }
  } catch (err: any) {
    log.error(`[Host] CRITICAL ERROR in createWindow: ${err.message}\n${err.stack}`);
  }
}

/**
 * Bring this machine online with nobody signed in.
 *
 * Runs as SYSTEM in the console session, started by Remote365InputSvc while the
 * PC sits at the Windows sign-in screen. There is no renderer here: registration
 * uses the machine credential, and the sign-in screen itself is captured through
 * the elevated agent (the same path the lock screen already uses), so a viewer
 * can see the PIN prompt and type into it exactly as they can on a locked PC.
 */
async function startPreLogonHost() {
  const credential = readUnattendedCredential();
  if (!credential) {
    log.warn('[Unattended] No machine credential on this PC — nothing to host before logon. Sign in once with Remote 365 running to provision it.');
    app.quit();
    return;
  }

  log.info(`[Unattended] Pre-logon host starting for device ${credential.accessKey} (no user signed in).`);
  activeHostSecret = credential.hostSecret;
  isManualHostStop = false;
  isHostGuestMode = false;
  hostReconnectAttempts = 0;
  hostStreamSettings = {
    quality: normalizeHostStreamQuality(undefined),
    fps: '',
    deviceName: String(credential.deviceName || os.hostname()),
  };
  activeAdaptiveQuality = hostStreamSettings.quality;

  // The sign-in screen lives on the Winlogon desktop, which DXGI cannot capture
  // from this session — the elevated agent's GDI grab is the only source that
  // sees it. This is the same switch the lock screen uses; here it is simply on
  // from the start, because there is no unlocked desktop to fall back to.
  hostSessionLocked = true;

  try {
    if (!encoderDetected) await detectBestEncoder();
  } catch (err: any) {
    log.warn(`[Unattended] Encoder detection failed: ${err?.message || err}`);
  }

  connectHostSignaling(credential.serverHost || DEFAULT_SERVER_HOST, '', credential.accessKey);
}

/**
 * Bring the machine back online at boot without waiting for the renderer.
 *
 * This is the fix for "after a restart the device stays Offline until someone
 * physically toggles Grant Easy Access". Hosting used to begin only after the
 * renderer completed two one-shot HTTP calls, and at boot those lose the race
 * against Wi-Fi/DHCP/DNS — one network error and nothing ever retried.
 *
 * Registration needs nothing but the access key and the signaling socket, both
 * of which we already have on disk, so this runs before any HTTP: if the network
 * is not up yet the socket simply fails and the existing reconnect supervisor
 * keeps retrying until it works. The renderer's own host:start later coalesces
 * (connectHostSignaling ignores a duplicate start for the same key).
 */
async function startHostFromSavedIntent() {
  if (isPreLogonHost) return; // the SYSTEM instance registers with its own credential
  const intent = readHostIntent();
  if (!intent) {
    log.info('[Autostart] No saved host intent — waiting for the renderer to register this device.');
    return;
  }
  if (activeHostAccessKey && !isManualHostStop) {
    log.info('[Autostart] Signaling already active; saved intent not needed.');
    return;
  }

  const serverIP = normalizeServerHost(intent.serverHost || process.env.CONNECT_X_SERVER_IP || DEFAULT_SERVER_HOST);
  isHostGuestMode = Boolean(intent.guestMode);
  isManualHostStop = false;
  hostReconnectAttempts = 0;
  hostStreamSettings = {
    quality: normalizeHostStreamQuality(intent.quality),
    fps: ['45', '60', '75', '90', '120'].includes(String(intent.fps)) ? String(intent.fps) : '',
    deviceName: String(intent.deviceName || os.hostname()),
  };
  activeAdaptiveQuality = hostStreamSettings.quality;

  // Best-effort: a signed-in host wants its user token, but a boot with no
  // network (or an expired refresh) must still ATTEMPT to register rather than
  // abort — the retry loop is what eventually gets us online.
  let token = '';
  if (!isHostGuestMode) {
    try {
      // With no link yet, a token refresh can only burn its 8s timeout and
      // delay the first attempt. Use whatever is stored; the reconnect path
      // refreshes properly once the network is actually usable.
      token = hasNetworkLink() ? await getFreshHostToken() : ((await getAuthTokens()).token || '');
    } catch (err: any) {
      log.warn(`[Autostart] Could not read a host token at boot: ${err?.message || err}`);
    }
  }

  // Fallback credential for the case where no usable token exists at all (never
  // signed in on this profile, or the refresh token expired while powered off).
  loadMachineHostSecret(intent.accessKey);

  log.info(`[Autostart] Restoring hosting for device ${intent.accessKey} (network link: ${hasNetworkLink() ? 'up' : 'down'}).`);
  connectHostSignaling(serverIP, token, intent.accessKey);

  // Warm the encoder in the background so the first viewer join isn't slowed by
  // the hardware probe. Never gates registration.
  if (!encoderDetected && !encoderDetectionPromise) {
    encoderDetectionPromise = detectBestEncoder().finally(() => { encoderDetectionPromise = null; });
    encoderDetectionPromise.catch((err: any) => log.warn(`[Autostart] Encoder detection failed: ${err?.message || err}`));
  }
}

process.on('uncaughtException', (err: any) => {
  log.error(`[Host] UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  log.error('[Host] UNHANDLED REJECTION:', reason);
});

app.whenReady().then(() => {
  log.info('[Host] App is ready. Initializing subsystems...');
  loadDeviceAutoUpdatePreference();
  // Reset (or arm) the update-install loop guard for the version we booted as.
  clearUpdateAttemptsIfSwapped();
  // We are alive, so no install can still be swapping our files. Releasing the
  // lock here is what stops a marker left behind by a dead installer from
  // permanently muzzling the keep-alive task (the scripts also break it after
  // ~30 min, but this is the normal, immediate path).
  clearUpdateLock('app started');

  // Arm the offline-recovery keep-alive once startup has settled. Runs every
  // launch so a deleted/stale task or script self-heals.
  setTimeout(() => ensureKeepAliveTask(), 15_000);

  // Loopback status endpoint for the web dashboard's session lock overlay.
  startHostStatusServer();

  // Keep the input-mapping geometry cache honest across monitor changes.
  screen.on('display-added', invalidateDesktopGeometry);
  screen.on('display-removed', invalidateDesktopGeometry);
  screen.on('display-metrics-changed', invalidateDesktopGeometry);

  // LAN Direct comes up independently of cloud signaling and of login — the whole
  // point is that a machine which reboots with no internet is still reachable from
  // the same network. It never waits for (or needs) a server round-trip.
  if (lanConfig.enabled && lanConfig.passwordHash) {
    const lan = startLanDirectIfConfigured();
    log.info(`[LAN] Autostart ${lan.ok ? `ok on ${lan.addresses.join(', ')}` : `failed: ${lan.error}`}`);
  }

  // Watch OS lock/unlock so the host streams the secure desktop (lock/PIN screen)
  // to viewers while locked (see mainSecureCapture / the capture loops).
  registerLockStateWatcher();

  // Restore the persisted received-files folder (Settings → Remote control).
  loadReceivedFilesDir();
  loadFileTransferBlocked();

  // Stream-decoupling (P2.1): fork the media utilityProcess only when CONNECT_X_STREAM_WORKER=1.
  // No effect on default builds. See docs/capture-service-decoupling.md.
  // The worker process itself is NOT forked here any more: it cost 40-70 MB on
  // every machine from launch, including ones that never host. It is forked
  // when a viewer starts connecting (preforkStreamWorker) and exits two minutes
  // after the last viewer leaves (scheduleStreamWorkerIdleKill). Only the
  // callbacks are registered up front.
  try {
    // Encoded H.264 from the worker -> same NAL/RTP path the local ffmpeg.stdout used.
    onWorkerNal((u8) => {
      // Zero-copy view: the chunk's ArrayBuffer was transferred from the worker,
      // so main owns it exclusively — Buffer.from(u8) would copy it again.
      const chunk = Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
      bufferAccumulator = bufferAccumulator.length ? Buffer.concat([bufferAccumulator, chunk]) : chunk;
      drainNALBuffer();
    });
    let workerRestarts = 0;
    onWorkerEvent((evt, msg) => {
      if (evt === 'started') { workerRestarts = 0; return; }
      if (evt === 'metrics') {
        log.info(`[Host] Capture health: avgCaptureMs=${Number(msg?.avgCaptureMs || 0).toFixed(2)} samples=${msg?.captureSamples || 0} writes=${msg?.writes || 0} lateTicks=${msg?.lateTicks || 0} backpressureWaits=${msg?.backpressureWaits || 0} targetFps=${msg?.targetFps || 0} workerLoopP95Ms=${Number(msg?.eventLoopP95Ms || 0).toFixed(1)} workerLoopMaxMs=${Number(msg?.eventLoopMaxMs || 0).toFixed(1)}`);
      } else if (evt === 'error') {
        // Worker can't stream (e.g. native-capture unavailable) -> fall back to in-process capture.
        log.warn(`[Host] Stream worker error (${msg?.where}): ${msg?.message} — falling back to in-process capture.`);
        disableWorkerFallback();
        stopWorkerStream();
        if (videoTrack) setTimeout(() => startStreaming(), 200);
      } else if (evt === 'exit') {
        // Worker process died: re-fork + restart a few times, then fall back.
        if (videoTrack && isStreamWorkerEnabled() && workerRestarts < 4) {
          workerRestarts++;
          log.warn(`[Host] Stream worker exited — restarting (${workerRestarts}/4).`);
          setTimeout(() => { if (videoTrack) startStreaming(); }, 400);
        } else if (videoTrack && isStreamWorkerEnabled()) {
          log.warn('[Host] Stream worker keeps exiting — falling back to in-process capture.');
          disableWorkerFallback();
          setTimeout(() => startStreaming(), 200);
        }
      } else if (evt === 'ffmpeg-exit' && msg?.unexpected && videoTrack && isStreamWorkerEnabled()) {
        // Tiny probes can pass while real resolution/profile settings fail,
        // especially on older Intel QSV/MFX drivers. Do not retry a broken
        // hardware encoder forever and leave the viewer black/corrupt.
        if (onDemandKeyframesActive && !onDemandKeyframesRejected) {
          // The on-demand pipeline (IVF input + keyframe expression) died. It is
          // new; the raw-input periodic-GOP pipeline is the proven one. Retreat
          // to it for the rest of this run and keep the same encoder.
          onDemandKeyframesRejected = true;
          log.warn('[Host] FFmpeg exited in on-demand keyframe mode; retreating to the periodic-GOP pipeline for this run.');
        } else if (detectedEncoder === 'h264_qsv' && !qsvVbrRejected) {
          // First failure on the new VBR arguments: retreat to the previous
          // CBR arguments and stay on the hardware encoder.
          qsvVbrRejected = true;
          log.warn('[Host] h264_qsv exited on VBR arguments; retrying with the previous CBR arguments.');
        } else if (detectedEncoder !== 'libx264') {
          log.warn(`[Host] ${detectedEncoder} failed with real stream settings; falling back to libx264 for this run.`);
          detectedEncoder = 'libx264';
          encoderDetected = true;
        }
        setTimeout(() => { if (videoTrack) startStreaming(); }, 150);
      } else if (evt === 'geometry-mismatch') {
        // The captured surface no longer matches the size FFmpeg was launched
        // with (resolution/DPI change, display swap, session reconnect). Left
        // alone this renders as a green band across the bottom of the viewer.
        // startStreaming() re-reads the display bounds and relaunches FFmpeg.
        log.warn(`[Host] Capture geometry changed (declared ${msg?.declared} / actual ${msg?.actual}, ${msg?.expectedBytes} vs ${msg?.actualBytes} bytes) — restarting pipeline.`);
        if (videoTrack) setTimeout(() => { if (videoTrack) startStreaming(); }, 150);
      }
    });
  } catch (e: any) { log.warn(`[StreamWorker] start skipped: ${e?.message || e}`); }

  session.defaultSession.webRequest.onErrorOccurred(
    { urls: ['https://*/*', 'wss://*/*'] },
    (details) => {
      const error = String(details.error || '');
      if (error.includes('SSL') || error.includes('CERT') || error.includes('CONNECTION')) {
        log.warn(`[Network] ${error} ${details.url}`);
      }
    }
  );

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'display-capture'].includes(permission));
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });
      const primaryDisplayId = String(screen.getPrimaryDisplay().id);
      const source = sources.find((item) => item.display_id === primaryDisplayId) || sources[0];
      if (!source) {
        callback({});
        return;
      }
      callback({
        video: source,
        audio: 'loopback' as any
      });
    } catch (err: any) {
      log.error(`[Meeting] Display media request failed: ${err.message}`);
      callback({});
    }
  });

  // ── Pre-logon (unattended) boot ───────────────────────────────────────────
  // Nobody is signed in, so there is no window to show, no tray to sit in, and
  // no user profile to update into. Register with the machine credential and
  // stop here: everything below is user-session setup.
  if (isPreLogonHost) {
    startPreLogonHost();
    return;
  }

  // Tray Initialization
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'logo.png') // Path in build
    : join(__dirname, '../../src/logo.png'); // Path in dev

  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Remote365', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      {
        label: 'Restart Remote365', click: () => {
          isQuitting = true;
          app.relaunch();
          app.exit();
        }
      },
      {
        label: 'Quit Remote365', click: () => {
          isQuitting = true;
          // An explicit Quit means "stay quit" — disarm BOTH recovery layers so
          // neither resurrects the app minutes later. Re-armed on next launch.
          setAppSupervision(false);
          removeKeepAliveTask('user quit from tray');
          app.quit();
        }
      }
    ]);
    tray.setToolTip('Remote365');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    log.error('[Host] Failed to initialize Tray:', e);
  }

  // Initialize paths that require app to be ready
  AUTH_STORE_PATH = join(app.getPath('userData'), 'connectx_auth.json');
  log.info(`[Host] Auth store path: ${AUTH_STORE_PATH}`);

  // First run on this machine: default "Start Remote 365 with Windows" to ON
  // (the login item launches with --hidden, so boot starts land in the tray).
  // Applied once, so a later opt-out in Settings is never overridden.
  if (app.isPackaged && !advancedFlags.autostartDefaultApplied) {
    try {
      if (!getStartWithWindowsSettings().openAtLogin) setStartWithWindowsLoginItem(true);
      advancedFlags.autostartDefaultApplied = true;
      persistAdvancedFlags();
      log.info('[Host] Enabled start-with-Windows by default (first run).');
    } catch (e: any) {
      log.warn('[Host] Failed to apply default autostart:', e?.message || e);
    }
  }

  createWindow();
  startStatsMonitoring();

  // Come back online by ourselves after a reboot. Deliberately NOT awaited and
  // not gated on the renderer: this is the whole point of the saved intent.
  startHostFromSavedIntent().catch((err: any) => log.warn(`[Autostart] Restore failed: ${err?.message || err}`));

  // A machine that booted before its network was usable must not wait out the
  // reconnect backoff. Recover the moment a link appears.
  startNetworkRestoreWatcher(() => {
    if (!activeHostAccessKey) {
      // Never registered yet this run (boot with no intent, or the very first
      // launch) — try the saved intent again now that there is a network.
      startHostFromSavedIntent().catch(() => { /* retried on the next link change */ });
      return;
    }
    if (isManualHostStop) return;
    if (hostSignalingWs?.readyState === WebSocket.OPEN) return;
    hostReconnectAttempts = 0; // fresh link, no reason to keep a long backoff
    try { hostSignalingWs?.terminate(); } catch { /* already dead */ }
    scheduleHostReconnect('network-restored');
  });

  // Lazy detection: Probing HW encoders is now deferred until a host session is actually requested
  // to avoid cold startup crashes or unnecessary resource usage.
  // detectBestEncoder().catch((err) => log.warn('[Host] Encoder detection failed:', err));


  // Handle startup deep link: when the app was launched fresh by a remote365:// (or legacy
  // remotelink://) URL
  const startupUrl = findDeepLinkArg(process.argv);
  if (startupUrl) {
    mainWindow?.webContents.once('did-finish-load', () => {
      log.info(`[Host] Processing startup deep link: ${startupUrl}`);
      handleDeepLink(startupUrl);
    });
  }

  // Check for updates on startup. The renderer also checks when the banner mounts,
  // which covers the case where this event fires before React listeners are ready.
  if (app.isPackaged) {
    repairLoginItemAfterMigration();
    reportPriorMainHangs();
    checkForDesktopUpdates().catch((e: any) => {
      if (isMissingUpdateManifest(e)) {
        log.warn('[Updater] No update manifest found during startup check.');
        return;
      }
      log.error('[Updater] Failed initial check:', e);
    });
    if (updateCheckInterval) clearInterval(updateCheckInterval);
    updateCheckInterval = setInterval(() => {
      checkForDesktopUpdates().catch((e: any) => {
        if (isMissingUpdateManifest(e)) return;
        log.warn('[Updater] Background update check failed:', e?.message || e);
      });
    }, 60_000);
  }
});

ipcMain.handle('host:save-file-locally', async (_event: any, name: string, data: Uint8Array) => {
  const downloadsPath = app.getPath('downloads');
  const filePath = join(downloadsPath, name);
  await fs.writeFile(filePath, Buffer.from(data));
  return filePath;
});

// Drive roots (C:\, D:\, a plugged-in USB stick…) so the file manager can reach
// anything on the machine. The panes used to offer only four profile folders
// and refused to go above Home, which read as "it doesn't show everything".
// A: and B: are skipped on purpose — probing a floppy letter can hang.
async function listDriveRoots(): Promise<Array<{ name: string; path: string; type: string }>> {
  if (process.platform !== 'win32') return [{ name: 'Computer', path: '/', type: 'directory' }];
  const drives: Array<{ name: string; path: string; type: string }> = [];
  await Promise.all('CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async (letter) => {
    const root = `${letter}:\\`;
    try {
      await fs.access(root);
      drives.push({ name: `Drive (${letter}:)`, path: root, type: 'directory' });
    } catch { /* no such drive */ }
  }));
  return drives.sort((a, b) => a.path.localeCompare(b.path));
}

// Plain words for the errno codes a folder listing actually hits.
function describeFsError(err: any, what: string): string {
  const code = String(err?.code || '');
  if (code === 'EACCES' || code === 'EPERM') return `You don't have permission to open ${what}.`;
  if (code === 'ENOENT') return `${what.charAt(0).toUpperCase()}${what.slice(1)} no longer exists.`;
  if (code === 'ENOTDIR') return `${what.charAt(0).toUpperCase()}${what.slice(1)} is not a folder.`;
  if (code === 'EBUSY') return `${what.charAt(0).toUpperCase()}${what.slice(1)} is busy right now. Try again in a moment.`;
  return err?.message || `Could not open ${what}.`;
}

// Used by BOTH sides of a session: the viewer lists its own disk through
// files:list-local and the host answers ft:list with the same function.
//
// "It doesn't show everything" had four causes, all fixed here rather than in
// the panel: symlinks/junctions were dropped (OneDrive and redirected profile
// folders vanished), hidden items had no toggle, the 5,000 cap was applied in
// disk order BEFORE sorting so the visible set was arbitrary, and one stat
// failure inside a folder threw the whole listing away.
type ListOptions = { showHidden?: boolean; offset?: number; limit?: number; query?: string };
const LIST_PAGE_DEFAULT = 2000;
const LIST_PAGE_MAX = 5000;

// Typed paths: "%USERPROFILE%\Desktop", "~\Documents" and friends.
function expandTypedPath(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/%([^%]+)%/g, (match, name) => process.env[name] ?? match)
    .replace(/^~(?=[\\/]|$)/, app.getPath('home'));
}

async function listFilesystem(pathValue?: string, options?: ListOptions) {
  const showHidden = Boolean(options?.showHidden);
  const offset = Math.max(0, Number(options?.offset) || 0);
  const limit = Math.min(LIST_PAGE_MAX, Math.max(1, Number(options?.limit) || LIST_PAGE_DEFAULT));
  const query = String(options?.query || '').trim().toLowerCase();
  if (pathValue) pathValue = expandTypedPath(pathValue);
  const roots: Array<{ name: string; path: string; type: string }> = [];
  // The received-files folder comes first: it is where transfers land, so it
  // is the folder people open right after one. Only offered once it exists.
  const receiveDir = defaultReceiveDir();
  try {
    await fs.access(receiveDir);
    roots.push({ name: 'Remote365 Files', path: receiveDir, type: 'directory' });
  } catch { /* created by the first transfer */ }
  roots.push(
    { name: 'Home', path: app.getPath('home'), type: 'directory' },
    { name: 'Desktop', path: app.getPath('desktop'), type: 'directory' },
    { name: 'Downloads', path: app.getPath('downloads'), type: 'directory' },
    { name: 'Documents', path: app.getPath('documents'), type: 'directory' },
    ...(await listDriveRoots()),
  );
  const currentPath = pathValue || app.getPath('home');
  const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch((err: any) => {
    throw new Error(describeFsError(err, pathValue ? `“${basename(currentPath) || currentPath}”` : 'that folder'));
  });
  const hiddenWindowsProfileNames = new Set([
    'Application Data',
    'Cookies',
    'Local Settings',
    'My Documents',
    'NetHood',
    'PrintHood',
    'Recent',
    'SendTo',
    'Start Menu',
    'Templates',
  ]);
  const isHiddenName = (name: string) =>
    name.startsWith('.') || /^ntuser\./i.test(name) || /^(desktop\.ini|thumbs\.db)$/i.test(name) || hiddenWindowsProfileNames.has(name);
  // A query searches the WHOLE folder on disk, not just the page the panel
  // has — that is how a file in a 30,000-entry folder stays one keystroke away.
  const candidates = entries.filter((entry) =>
    entry.name
    && (showHidden || !isHiddenName(entry.name))
    && (!query || entry.name.toLowerCase().includes(query)));

  // readdir reports junctions and OneDrive reparse points as symlinks. Follow
  // each to learn whether it is a folder so it sorts with the folders; a
  // dangling one is kept and tagged, not hidden.
  const typed = await Promise.all(candidates.map(async (entry) => {
    const itemPath = join(currentPath, entry.name);
    const link = entry.isSymbolicLink();
    let isDir = entry.isDirectory();
    let broken = false;
    if (link) {
      try { isDir = (await fs.stat(itemPath)).isDirectory(); } catch { broken = true; }
    }
    return { entry, itemPath, link, isDir, broken };
  }));
  // Sort FIRST, then cap: folders first, natural order ("file2" before
  // "file10"), case-insensitive — the same order Explorer shows.
  typed.sort((a, b) => (a.isDir === b.isDir
    ? a.entry.name.localeCompare(b.entry.name, undefined, { numeric: true, sensitivity: 'base' })
    : a.isDir ? -1 : 1));
  // Paged: the panel asks for the next page with `offset` ("Show More"), so a
  // directory with a million entries can neither freeze the session nor hide
  // anything. totalCount lets the UI say "showing N of M".
  const totalCount = typed.length;
  const page = typed.slice(offset, offset + limit);
  const items = await Promise.all(page.map(async ({ entry, itemPath, link, isDir, broken }) => {
    let size = 0;
    let modifiedAt = '';
    let locked = false;
    if (!broken) {
      try {
        const stat = await fs.stat(itemPath);
        size = isDir ? 0 : stat.size;
        modifiedAt = stat.mtime.toISOString();
      } catch (err: any) {
        // A single unreadable entry used to be silently zeroed; now it is
        // tagged so the panel can show a lock instead of pretending.
        locked = err?.code === 'EACCES' || err?.code === 'EPERM';
      }
    }
    return {
      name: entry.name,
      path: itemPath,
      type: isDir ? 'directory' : 'file',
      size,
      modifiedAt,
      link: link || undefined,
      broken: broken || undefined,
      locked: locked || undefined,
      hidden: isHiddenName(entry.name) || undefined,
    };
  }));
  return {
    path: currentPath,
    // Up works all the way to the drive / filesystem root, not just to Home.
    parentPath: resolve(currentPath, '..') !== resolve(currentPath) ? resolve(currentPath, '..') : '',
    roots,
    items,
    totalCount,
    offset,
    truncated: offset + items.length < totalCount,
    showHidden,
    query,
  };
}

ipcMain.handle('files:list-local', async (_event: any, pathValue?: string, options?: ListOptions) => listFilesystem(pathValue, options));

// Streaming read/write + recursive walk for the file manager (protocol v2).
registerLocalFileHandlers(defaultReceiveDir);
ipcMain.handle('files:read-local-file', async (_event: any, pathValue: string) => {
  const stat = await fs.stat(pathValue);
  if (!stat.isFile()) throw new Error('Choose a file, not a folder.');
  const data = await fs.readFile(pathValue);
  return { name: basename(pathValue), size: stat.size, data };
});

ipcMain.handle('system:getHistory', async () => {
  try {
    const path = join(app.getPath('userData'), 'connectx_history.json');
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
});

ipcMain.handle('system:saveHistory', async (_event: any, history: any[]) => {
  try {
    const path = join(app.getPath('userData'), 'connectx_history.json');
    await fs.writeFile(path, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
});

async function sendFileFromHost(selectedPath?: string, targetViewerId?: string) {
  const targetChannel = getHostPeerControlChannel(targetViewerId);
  let filePath = selectedPath;
  if (!filePath) {
    const result = await dialog.showOpenDialog({
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      if (targetChannel && targetChannel.isOpen()) {
        targetChannel.sendMessage(JSON.stringify({ type: 'file-transfer-cancelled', direction: 'receive' }));
      }
      return;
    }
    filePath = result.filePaths[0];
  }

  if (targetChannel && filePath) {
    const fileName = basename(filePath);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error('Choose a file, not a folder.');
    const totalSize = stats.size;

    // Chunking 16KB
    const CHUNK_SIZE = 16 * 1024;
    const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));
    const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    targetChannel.sendMessage(JSON.stringify({ type: 'file-transfer-start', direction: 'receive', transferId, name: fileName, totalSize, totalChunks }));
    const fd = await fs.open(filePath, 'r');
    let bytesSent = 0;
    let lastSendProgressAt = 0;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const buffer = Buffer.alloc(CHUNK_SIZE);
        const { bytesRead } = await fd.read(buffer, 0, CHUNK_SIZE, i * CHUNK_SIZE);
        const chunk = buffer.slice(0, bytesRead);

        const header = JSON.stringify({ type: 'file-chunk', transferId, name: fileName, totalSize, chunkIndex: i, totalChunks });
        const headerBuffer = Buffer.from(header);
        const fullBuffer = Buffer.alloc(4 + headerBuffer.length + chunk.length);
        fullBuffer.writeUInt32LE(headerBuffer.length, 0);
        headerBuffer.copy(fullBuffer, 4);
        chunk.copy(fullBuffer, 4 + headerBuffer.length);

        targetChannel.sendMessageBinary(fullBuffer);
        bytesSent += bytesRead;
        // Progress throttled to ~250ms (final chunk always reported) — a
        // per-chunk send doubles the message count on the shared control channel.
        const isFinalChunk = i === totalChunks - 1;
        if (targetChannel.isOpen() && (isFinalChunk || Date.now() - lastSendProgressAt >= 250)) {
          lastSendProgressAt = Date.now();
          targetChannel.sendMessage(JSON.stringify({
            type: 'file-transfer-progress',
            direction: 'receive',
            transferId,
            name: fileName,
            totalSize,
            transferredBytes: bytesSent,
            progress: Math.round(((i + 1) / totalChunks) * 100)
          }));
        }
        // Small delay to prevent saturation
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
      }
    } catch (err: any) {
      if (targetChannel && targetChannel.isOpen()) {
        targetChannel.sendMessage(JSON.stringify({
          type: 'file-transfer-error',
          direction: 'receive',
          transferId,
          name: fileName,
          totalSize,
          message: err?.message || `Could not send ${fileName} from the remote computer.`
        }));
      }
      throw err;
    } finally {
      await fd.close();
    }
  }
}

/**
 * Host → viewer, the host's own "Send Files" (dock button / host page). On a
 * viewer that opened the dedicated file channel (desktop ≥ 1.2.98) this is a
 * protocol-v2 pull the HOST starts: folders, cancel, back-pressure, size
 * checks, and it lands in the viewer's transfers tray. Web and phone viewers
 * still get the v1 one-file-at-a-time path.
 */
async function sendFilesFromHost(targetViewerId?: string): Promise<boolean> {
  const peer = targetViewerId ? hostViewerPeers.get(targetViewerId) : getPrimaryHostPeer();
  const result = await dialog.showOpenDialog({
    title: 'Send To The Viewer',
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled || !result.filePaths.length) return false;
  const fileChannel = peer?.fileDataChannel?.isOpen?.() ? peer.fileDataChannel : null;
  if (fileChannel) {
    const jobId = `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const label = result.filePaths.length === 1
      ? basename(result.filePaths[0])
      : `${result.filePaths.length} files from ${os.hostname()}`;
    log.info(`[FileTransfer] Host sending ${result.filePaths.length} file(s) to viewer ${peer?.viewerId || 'primary'} as ${jobId} (v2)`);
    startHostPull(jobId, result.filePaths, fileChannel, fileTransferDeps, { fromHost: true, label });
    return true;
  }
  for (const filePath of result.filePaths) await sendFileFromHost(filePath, targetViewerId);
  return true;
}

ipcMain.on('host:send-file', async () => {
  await sendFilesFromHost();
});

// Stats emitter
let lastCpuStats = os.cpus();
const mainEventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
mainEventLoopDelay.enable();
let lastEventLoopWarnAt = 0;
function startStatsMonitoring() {
  if (statsInterval) clearInterval(statsInterval);
  let prevBytes = 0;
  let lastProcessMetricLogAt = 0;

  statsInterval = setInterval(() => {
    if (!mainWindow) return;

    const currentBytes = totalBytesSent;
    const bps = currentBytes - prevBytes;
    prevBytes = currentBytes;

    const mbps = (bps * 8) / (1024 * 1024);
    const activePeers = hostViewerPeers.size || ((peerConnection && peerConnection.state() === 'connected') ? 1 : 0);

    // CPU Load
    const currentCpuStats = os.cpus();
    let totalDelta = 0;
    let idleDelta = 0;
    for (let i = 0; i < currentCpuStats.length; i++) {
      const prev = lastCpuStats[i].times;
      const curr = currentCpuStats[i].times;
      totalDelta += (curr.user + curr.nice + curr.sys + curr.idle + curr.irq) - (prev.user + prev.nice + prev.sys + prev.idle + prev.irq);
      idleDelta += curr.idle - prev.idle;
    }
    const cpuLoad = totalDelta === 0 ? 0 : (1 - idleDelta / totalDelta) * 100;
    lastCpuStats = currentCpuStats;

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = ((totalMem - freeMem) / totalMem) * 100;
    let appCpu = 0;
    let appMemoryMB = 0;
    let gpuMemoryMB = 0;
    try {
      const processMetrics = app.getAppMetrics();
      for (const metric of processMetrics) {
        appCpu += Number(metric.cpu?.percentCPUUsage || 0);
        const workingSetMB = Number(metric.memory?.workingSetSize || 0) / 1024;
        appMemoryMB += workingSetMB;
        if (String(metric.type || '').toLowerCase() === 'gpu') gpuMemoryMB += workingSetMB;
      }
    } catch { /* metrics are best-effort on older Electron builds */ }
    const eventLoopP95Ms = mainEventLoopDelay.percentile(95) / 1e6;
    const eventLoopMaxMs = mainEventLoopDelay.max / 1e6;
    mainEventLoopDelay.reset();
    if (
      activePeers > 0 &&
      (eventLoopP95Ms > 20 || eventLoopMaxMs > 50) &&
      Date.now() - lastEventLoopWarnAt > 5000
    ) {
      lastEventLoopWarnAt = Date.now();
      log.warn(`[Perf] Main event-loop delay p95=${eventLoopP95Ms.toFixed(1)}ms max=${eventLoopMaxMs.toFixed(1)}ms`);
    }
    if (activePeers > 0 && Date.now() - lastProcessMetricLogAt >= 5000) {
      lastProcessMetricLogAt = Date.now();
      log.info(
        `[Perf] App resources cpu=${appCpu.toFixed(1)}% memory=${appMemoryMB.toFixed(0)}MB ` +
        `gpuProcessMemory=${gpuMemoryMB.toFixed(0)}MB throughput=${mbps.toFixed(2)}Mbps peers=${activePeers} ` +
        `encoder=${detectedEncoder} rc=${describeRateControl(detectedEncoder)} tier=${activeAdaptiveQuality} ` +
        `keyframes=${onDemandKeyframesActive ? `ondemand(${forcedKeyframeCount} forced)` : 'periodic'}`
      );
    }

    // Nobody can see the dashboard while the window is in the tray or
    // minimized; skipping the send stops a pointless 1 Hz re-render of the
    // whole renderer tree (two root state updates per tick).
    if (mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) return;
    mainWindow.webContents.send('host:stats', {
      bandwidth: mbps.toFixed(2),
      activeUsers: activePeers,
      cpu: cpuLoad.toFixed(1),
      memory: memUsage.toFixed(1),
      appCpu: Number(appCpu.toFixed(1)),
      appMemoryMB: Number(appMemoryMB.toFixed(0)),
      gpuMemoryMB: Number(gpuMemoryMB.toFixed(0)),
      eventLoopP95Ms: Number(eventLoopP95Ms.toFixed(1)),
      eventLoopMaxMs: Number(eventLoopMaxMs.toFixed(1)),
    });
  }, 1000);
}

// window-all-closed handler

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isQuitting) {
    // On Windows/Linux we just stay in tray
  } else if (isQuitting) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  // electron-updater starts NSIS only after this process exits. Explicitly tear
  // down every child/pipe that can retain a handle beneath $INSTDIR so the old
  // application directory is removable on the first update attempt.
  stopStreaming();
  stopStreamWorker();
  stopSystemKeyHook();
  input.shutdown();
  try { hostSignalingWs?.terminate(); } catch {}
  for (const socket of viewerSignalingSockets.values()) {
    try { socket.terminate(); } catch {}
  }
  viewerSignalingSockets.clear();
  for (const transfer of fileTransfers.values()) {
    try { transfer.stream.destroy(new Error('Application is updating')); } catch {}
    if (transfer.inactivityTimer) clearTimeout(transfer.inactivityTimer);
  }
  fileTransfers.clear();
  cancelAllFileTransfers();
  closeAllLocalWrites();
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  if (idleInstallInterval) {
    clearInterval(idleInstallInterval);
    idleInstallInterval = null;
  }
  try { globalShortcut.unregisterAll(); } catch {}
});

// Ensure we don't quit when main window is closed
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/**
 * Viewer side of LAN Direct: talk straight to a host's local signaling server
 * instead of the cloud. The socket is registered in viewerSignalingSockets under
 * the same sessionId key the cloud path uses, so 'viewer:send-signaling' and the
 * renderer's whole message pipeline work unchanged — only the pipe differs.
 */
function connectViewerLanDirect(sessionId: string, address: string, password: string, port?: number) {
  const url = `ws://${address}:${port || LAN_SIGNAL_PORT}`;
  log.info(`[Viewer] LAN Direct connecting to ${url}`);
  const ws = new WebSocket(url);
  viewerSignalingSockets.set(sessionId, ws);

  const deliver = (msg: any) => {
    const tab = viewerTabs.get(sessionId);
    const win = viewerWindows.get(sessionId);
    if (tab && !tab.view.webContents.isDestroyed()) tab.view.webContents.send('viewer:signaling-message', msg);
    else if (win && !win.isDestroyed()) win.webContents.send('viewer:signaling-message', msg);
    else mainWindow?.webContents.send('viewer:signaling-message', msg);
  };

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'lan-auth', password, viewerName: os.hostname() }));
  });

  ws.on('message', (data: any) => {
    let msg: any;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.type === 'lan-auth-ok') {
      log.info(`[Viewer] LAN Direct authenticated with ${msg.deviceName || address}`);
      // Mirror the cloud 'joined' so the renderer follows its normal flow, then ask
      // for the offer exactly as the cloud path does.
      deliver({ type: 'joined', success: true, sessionId, hostName: msg.deviceName, lanDirect: true });
      ws.send(JSON.stringify({ type: 'request-offer', sessionId }));
      return;
    }
    if (msg.type === 'lan-auth-failed' || msg.type === 'lan-error') {
      deliver({ type: 'joined', success: false, error: msg.error || 'Incorrect LAN password.' });
      return;
    }
    if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
    deliver(msg);
  });

  ws.on('error', (err: any) => {
    log.error(`[Viewer] LAN Direct error: ${err?.message || err}`);
    deliver({ type: 'joined', success: false, error: `Could not reach ${address} on this network.` });
  });

  ws.on('close', () => {
    if (viewerSignalingSockets.get(sessionId) === ws) viewerSignalingSockets.delete(sessionId);
  });
}

function connectViewerSignaling(sessionId: string, serverIP: string, token: string, viewerClientId?: string, viewerDeviceId?: string) {
  const wsUrl = buildSignalUrl(serverIP);
  const ws = new WebSocket(wsUrl);
  viewerSignalingSockets.set(sessionId, ws);

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'join',
      sessionId,
      token,
      viewerClientId,
      // This machine's OWN Remote 365 id — shown in the host's dock so the
      // person at the host sees WHICH PC is connected, not just the account.
      viewerDeviceId: String(viewerDeviceId || '').replace(/\D/g, '') || undefined,
      clientKind: 'desktop-viewer',
      appVersion: app.getVersion(),
      platform: process.platform
    }));
  });

  ws.on('ping', () => {
    log.info(`[Viewer] Received signaling protocol ping for session ${sessionId}.`);
  });

  ws.on('message', (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      // Handle ping/pong at the main-process level so the signaling server
      // doesn't terminate the socket for missed heartbeats.
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      const tab = viewerTabs.get(sessionId);
      const win = viewerWindows.get(sessionId);
      if (tab && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('viewer:signaling-message', msg);
        if (msg.type === 'joined' && msg.success === false) {
          setTimeout(() => {
            closeViewerTab(sessionId);
            dialog.showMessageBox({
              type: 'info',
              title: 'Connection Not Approved',
              message: msg.error || 'No response from the other machine.',
              detail: 'The remote viewer window was closed because the host did not approve the request.'
            }).catch(() => {});
          }, 4500);
        }
      } else if (win && !win.isDestroyed()) {
        win.webContents.send('viewer:signaling-message', msg);
      }
    } catch (e) {
      log.error('[Viewer] Failed to process signaling message:', e);
    }
  });

  ws.on('close', () => {
    const tab = viewerTabs.get(sessionId);
    const win = viewerWindows.get(sessionId);
    if (tab && !tab.view.webContents.isDestroyed()) tab.view.webContents.send('viewer:signaling-disconnected');
    else if (win && !win.isDestroyed()) win.webContents.send('viewer:signaling-disconnected');
    if (viewerSignalingSockets.get(sessionId) === ws) {
      viewerSignalingSockets.delete(sessionId);
    }
  });
}
