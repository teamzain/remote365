import React, { useState, useEffect, useRef, useCallback } from 'react';
import { encodeCompactInput } from '../shared/inputProtocol';
import logo from '../logo.png';
import { StatusFooter } from './components/shell/StatusFooter';
import VideoPlayer from './components/VideoPlayer';
import { Modal } from './components/ui/Modal';
import AboutRemote365Modal from './components/modals/AboutRemote365Modal';
import AccessPasswordModal from './components/modals/AccessPasswordModal';
import ArchivedDevicesModal from './components/modals/ArchivedDevicesModal';
import CopyrightModal from './components/modals/CopyrightModal';
import ErrorModal from './components/modals/ErrorModal';
import AuthResultModal, { type AuthResultState } from './components/modals/AuthResultModal';
import PrivacyPolicyModal from './components/modals/PrivacyPolicyModal';
import SupportIdentifierModal from './components/modals/SupportIdentifierModal';
import UpdateCheckModal from './components/modals/UpdateCheckModal';
import ViewerRequestModal from './components/modals/ViewerRequestModal';
import ControlRequestModal from './components/modals/ControlRequestModal';
import { subscribeHostAudioCapture } from './lib/hostAudioCapture';
import type { FileTransferStatus } from './types';
import { dispatchControlChunk, dispatchControlJson, setSessionFileChannel } from './lib/sessionControlBus';
import { searchCandidates } from './lib/globalSearch';
import { DEFAULT_SERVER_HOST, normalizeServerHost, buildHttpOrigin, buildSignalUrl } from './utils/server';
import { formatCode, getRecentAccountKey } from './utils/format';
import { canViewPlatformAnalytics } from './utils/roles';
import { getStoredDevicePassword, isRemotePasswordRequired, isRemotePasswordConfigured, getMachineDisplayName, getMachineFingerprint } from './utils/device';
import { getDevicesNeedingPasswordUpdate, deviceNeedsPasswordUpdate, markDeviceNeedsPasswordUpdate, clearDeviceNeedsPasswordUpdate, isDeviceRemembered, markDeviceRemembered, clearDeviceRemembered } from './utils/devicePasswordStatus';
import { SESSION_INVITE_PREFIX, parseSessionInviteContent } from './utils/session';
import waitIllustration from './assets/wait.png';
import faultIllustration from './assets/fault.png';
// Force-syncing file state to resolve HMR/Vite discrepancies.
import {
    Activity, Monitor, Network, Video, MessageSquare, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield, Smartphone, Plus, Search, MoreVertical, CheckCircle2, X,
    RefreshCw, Eye, EyeOff, CreditCard, Power, Lock, Mail, Link, Sun, Moon, Edit2, Trash2, ShieldOff, LayoutGrid, PlusCircle, Radio, ShieldCheck, ArrowRightCircle, Check, DownloadCloud, MonitorOff, User,
    Globe, Folder, Maximize, Info, ChevronLeft, ChevronRight, ChevronDown, Layers, BellDot, Command, Book, Bell, ExternalLink, HelpCircle, Keyboard, Wifi, Clock3, MinusCircle,
    MessageCircle, UserCheck, UserX, Ban, Volume2, VolumeX, AlertCircle, CircleHelp } from 'lucide-react';

import { useImperativeHandle, forwardRef } from 'react';
import api from './lib/api';
import { useAuthStore } from './store/authStore';
import { useLicenseStore } from './store/licenseStore';
import { applyCustomizationPreferences, readCustomizationPreferences } from './lib/customizationPreferences';
import { applyEasyAccess, isEasyAccessEnabled, subscribeEasyAccess } from './lib/easyAccess';
import { areConnectionAlertsEnabled, pushHostAutoMinimize } from './lib/hostPreferences';
import { isClipboardSyncEnabled } from './lib/clipboardSyncPreference';
import { reportLegacyTransfer } from './lib/fileTransferEngine';
import { collectExpiredTempCodes } from './lib/tempAccessCodes';
import { getHiddenDeviceKeys as readHiddenDeviceKeys, setHiddenDeviceKeys as writeHiddenDeviceKeys } from './lib/hiddenDevices';
import { SnowPremiumDashboard } from './components/SnowPremiumDashboard';
import { SnowPremiumSidebar } from './components/SnowPremiumSidebar';
import { SnowSettingsModal } from './components/SnowSettingsModal';
import { SnowSidebar } from './components/SnowSidebar';
import { SnowRightBar } from './components/SnowRightBar';
import { SnowHost } from './components/SnowHost';
import { SnowSplashScreen } from './components/SnowSplashScreen';
import { BusinessSignupSteps, BusinessStepper } from './components/BusinessSignupSteps';
import { hasErrors, validateBusiness, validateBusinessEmail, validateCompanyStep } from './lib/businessValidation';
import { SnowOnboard } from './components/SnowOnboard';
import { SnowNotificationPanel } from './components/SnowNotificationPanel';
import { SnowLanding } from './components/SnowLanding';
import { MeetingPreviewModal } from './components/MeetingPreviewModal';
import { MeetingsWhatsNew } from './components/MeetingsWhatsNew';
import { FeedbackModal } from './components/FeedbackModal';
import { LandingHelpModal } from './components/LandingHelpModal';
import { SupportWorkstation } from './components/sessions/SupportWorkstation';
import { EndUserHome } from './components/sessions/EndUserHome';
import { HostWaitingView } from './components/sessions/HostWaitingView';
import { RemoteSessionChrome } from './components/sessions/RemoteSessionChrome';
import { canAccessAdminSettings } from './components/admin-settings/adminSettingsData';
import { hasUserFeature, hasUserPermission } from './lib/permissions';
import UpdateBanner from './components/UpdateBanner';
import TrialExpiredLock from './components/billing/TrialExpiredLock';
import { playUISound, fireNotification } from './components/SnowUserSettings';
import { useChatStore } from './store/chatStore';
import { applyGlobalTranslations, t } from './lib/translations';
import { getViewTitle } from './lib/viewTitles';
import { getRecentConnections, recordRecentConnection, type RecentConnection } from './lib/recentConnections';
import { ToastViewport } from './components/ui/Toast';
import { toast } from './lib/toastStore';

const SuperAdminConsole = React.lazy(() => import('./components/superadmin/SuperAdminConsole'));
const SnowBilling = React.lazy(() => import('./components/SnowBilling').then((module) => ({ default: module.SnowBilling })));
const SnowAdminSettings = React.lazy(() => import('./components/SnowAdminSettings').then((module) => ({ default: module.SnowAdminSettings })));
const SnowMembers = React.lazy(() => import('./components/SnowMembers').then((module) => ({ default: module.SnowMembers })));
const SnowAnalytics = React.lazy(() => import('./components/SnowAnalytics').then((module) => ({ default: module.SnowAnalytics })));
const SnowChat = React.lazy(() => import('./components/SnowChat').then((module) => ({ default: module.SnowChat })));
const SnowMeeting = React.lazy(() => import('./components/SnowMeeting').then((module) => ({ default: module.SnowMeeting })));
const SnowPremiumSettings = React.lazy(() => import('./components/SnowPremiumSettings').then((module) => ({ default: module.SnowPremiumSettings })));
const SnowDevices = React.lazy(() => import('./components/SnowDevices').then((module) => ({ default: module.SnowDevices })));
const SnowSupport = React.lazy(() => import('./components/SnowSupport').then((module) => ({ default: module.SnowSupport })));
const SnowSettings = React.lazy(() => import('./components/SnowSettings').then((module) => ({ default: module.SnowSettings })));
const SnowOrgs = React.lazy(() => import('./components/SnowOrgs').then((module) => ({ default: module.SnowOrgs })));
const SnowRemoteSupport = React.lazy(() => import('./components/SnowRemoteSupport').then((module) => ({ default: module.SnowRemoteSupport })));
const SnowOrgDetail = React.lazy(() => import('./components/SnowOrgDetail').then((module) => ({ default: module.SnowOrgDetail })));
const SnowMeetingsHome = React.lazy(() => import('./components/SnowMeetingsHome').then((module) => ({ default: module.SnowMeetingsHome })));

const LazyScreenFallback = () => (
    <div className="flex h-full min-h-[240px] w-full items-center justify-center bg-white dark:bg-[#080808]">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF8A00]" aria-label="Loading Screen" />
    </div>
);

const HOST_IDENTITY_BOOTSTRAP_MARKER = 'remote365_host_identity_bootstrap_v2';

// Does an RTCIceServer list carry a TURN relay? STUN-only lists only work when
// the two machines can reach each other directly (same LAN, or friendly NATs).
const iceListHasTurn = (list: any[]): boolean => Array.isArray(list) && list.some((s: any) =>
    (Array.isArray(s?.urls) ? s.urls : [s?.urls]).some((u: any) => typeof u === 'string' && u.startsWith('turn')));

// First-run host password: 8 digits, like the server's own generateAccessPassword.
const generateFirstRunPassword = (): string => {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return String(10_000_000 + (buf[0] % 90_000_000));
};

const mockPerformanceData = [
    { time: '10:00', latency: 45, network: 120 },
    { time: '10:01', latency: 48, network: 132 },
    { time: '10:02', latency: 40, network: 145 },
    { time: '10:03', latency: 50, network: 110 },
    { time: '10:04', latency: 38, network: 160 },
    { time: '10:05', latency: 42, network: 155 },
];


// Server host, account and role helpers moved to ./utils (server.ts, format.ts, roles.ts).



// Pixel-accurate Windows arrow cursor (white fill, black outline).
// Hotspot is the top-left tip, matching the real OS pointer.
const WindowsCursor = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
            d="M4 2 L4 18.4 L8.5 14.1 L11.4 20.7 L13.9 19.6 L11.1 13.2 L16.9 13.2 Z"
            fill="#FFFFFF"
            stroke="#000000"
            strokeWidth="1.3"
            strokeLinejoin="round"
        />
    </svg>
);

// --- Premium Mobile Device Frame ---
// Legacy frames removed for clean theater mode.

// --- Video Player Component (Hybrid: WebRTC Track + Legacy WebCodecs) ---

// Device, format and session-invite helpers moved to ./utils (device.ts, format.ts, session.ts).

// --- Main App Component ---
// Input-event classifiers for data-channel routing. Module scope on purpose:
// they run for every mouse/keyboard event on the session hot path.
// - transient: stale ones are worthless; ride the lossy unordered 'input' channel.
// - critical: state transitions and composed input that must arrive exactly once
//   and in order; ride the reliable ordered 'input-critical' channel so file
//   transfers on 'control' can never head-of-line-block a click or typed text.
const TRANSIENT_INPUT_TYPES = new Set(['mousemove', 'wheel']);
const CRITICAL_INPUT_TYPES = new Set(['mousedown', 'mouseup', 'keydown', 'keyup', 'typeText', 'keyCombo', 'shortcut']);
const isTransientInputEvent = (event: any) => Boolean(event && TRANSIENT_INPUT_TYPES.has(event.type));
const isCriticalInputEvent = (event: any) => Boolean(event && CRITICAL_INPUT_TYPES.has(event.type));
const isRealtimeInputEvent = (event: any) => isTransientInputEvent(event) || isCriticalInputEvent(event);

// Mirrors the host's ALLOWED_BEFORE_CONTROL (main/index.ts) plus the messages it
// handles before that gate. In a view-only session everything else is pointless
// to send: the host drops it and answers 'control-denied', so 60Hz of pointer
// travel would just congest the channel chat and file transfer share.
const SENDABLE_BEFORE_CONTROL = new Set([
  'ping', 'request-keyframe', 'stream-quality', 'stream-activity', 'chat',
  'request-control', 'viewer-disconnect', 'whiteboard-event',
  'audio-listen', 'audio-talk', 'recording-state',
  // Showing your face is conversation, not control — it has to work in a
  // view-only session, and the host allows these before control too.
  'cam:start', 'cam:stop',
  // Waking a sleeping phone is a precondition for SEEING it, not a way to
  // drive it — same category as request-keyframe. Sent as a generic 'action'
  // it was dropped here, so on a view-only session the "Wake Screen" button
  // did nothing at all.
  'wake',
]);

export default function App() {
    const isElectron = !!(window as any).electronAPI;

    const [loading, setLoading] = useState(true);
    const [showSplash, setShowSplash] = useState(false);
    const [isSplashComplete, setIsSplashComplete] = useState(false);
    const { user, accessToken, temp2faToken, login: storeLogin, verify2fa: storeVerify2fa, setTemp2faToken, register: storeRegister, requestVerification: storeRequestVerification, logout: storeLogout, checkAuth, setAuth } = useAuthStore();

    // --- Global Theme, Font Size & Locale ---
    useEffect(() => {
        if (user) {
            applyCustomizationPreferences({
                darkMode: user.darkMode ?? readCustomizationPreferences().darkMode,
                searchBehavior: user.searchBehavior === 'Direct connect' ? 'Direct connect' : 'Search for result',
                useNewInterface: user.useNewInterface ?? true,
                marketingMessages: user.marketingMessages ?? false,
                fontSize: user.fontSize || 16,
            });

            const language = user.language || 'en';
            document.documentElement.lang = language;
            document.documentElement.dir = language === 'ar-SA' ? 'rtl' : 'ltr';
        }
    }, [user?.darkMode, user?.fontSize, user?.language, user?.marketingMessages, user?.searchBehavior, user?.useNewInterface]);

    // Automatic-update policy is intentionally device-local. Account refreshes
    // must not overwrite another PC's updater preference.

    const translationPausedRef = useRef(false);
    // The full-DOM translation sweep costs 1-10ms per pass and competes with
    // input dispatch, so it pauses while a remote session is streaming
    // (translationPausedRef, flipped by the remoteStream effect below).
    useEffect(() => {
        if (!user) return;
        const language = user.language || 'en';
        const translate = () => {
            if (translationPausedRef.current) return;
            applyGlobalTranslations(document.body, language);
        };
        const frame = window.requestAnimationFrame(translate);
        // English needs no ongoing sweep: the initial pass restores any
        // previously-translated nodes, and new nodes already render in English.
        if (language === 'en') {
            return () => window.cancelAnimationFrame(frame);
        }
        const interval = window.setInterval(translate, 800);
        const observer = new MutationObserver((mutations) => {
            if (translationPausedRef.current) return;
            for (const mutation of mutations) {
                if (mutation.type === 'characterData' && mutation.target instanceof Text) {
                    applyGlobalTranslations(mutation.target.parentElement || document.body, language);
                }
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof Element || node instanceof Text) {
                        applyGlobalTranslations(node instanceof Text ? node.parentElement || document.body : node, language);
                    }
                });
                if (mutation.type === 'attributes' && mutation.target instanceof Element) {
                    applyGlobalTranslations(mutation.target, language);
                }
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['placeholder', 'title', 'aria-label'],
        });
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearInterval(interval);
            observer.disconnect();
        };
    }, [user?.language, user]);
    const isAuthenticated = !!accessToken;
    const [totpCode, setTotpCode] = useState('');
    const [viewerStep, setViewerStep] = useState<1 | 2>(1);
    const [targetDeviceName, setTargetDeviceName] = useState<string | null>(null);
    const [targetPasswordRequired, setTargetPasswordRequired] = useState(true);
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [globalAppToast, setGlobalAppToast] = useState<{ title: string; body: string; target?: any; iconType?: 'message' | 'session' | 'accepted' | 'system'; createdAt: string } | null>(null);
    const chatConversations = useChatStore((state) => state.conversations);
    const [twoFaError, setTwoFaError] = useState<string | null>(null);
    const [isVerifying2fa, setIsVerifying2fa] = useState(false);

    type ViewType = 'home' | 'dashboard' | 'devices' | 'settings' | 'host' | 'billing' | 'profile' | 'support' | 'members' | 'organizations' | 'analytics' | 'connect' | 'org-detail' | 'admin_settings' | 'meetings' | 'support_workstation' | 'end_user_home';
    const [currentView, _setCurrentView] = useState<ViewType>(() => {
        const stored = localStorage.getItem('last_view') as ViewType | 'documentation' | null;
        // Legacy stored values ('documentation', 'home', 'dashboard') no longer
        // have their own screen — fall through to 'home' so resolvedCurrentView
        // remaps to the role's landing view.
        if (stored === 'documentation') return 'home';
        return stored || 'home';
    });
    const currentViewRef = useRef<ViewType>(currentView);
    useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
    useEffect(() => {
        const migrationKey = 'remote365_stream_defaults_v7';
        if (localStorage.getItem(migrationKey)) return;
        const currentQuality = localStorage.getItem('remote365_video_quality');
        if (!currentQuality || currentQuality === 'smooth' || currentQuality === 'balanced' || currentQuality === 'sharp') {
            localStorage.setItem('remote365_video_quality', 'ultra');
        }
        const currentFps = localStorage.getItem('remote365_stream_fps');
        if (!currentFps || currentFps === '15' || currentFps === '45' || currentFps === '60' || currentFps === '75' || currentFps === '90' || currentFps === '120') {
            localStorage.setItem('remote365_stream_fps', '30');
        }
        localStorage.setItem(migrationKey, 'true');
    }, []);
    const [history, setHistory] = useState<ViewType[]>([currentView]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const getDefaultHomeView = (_role?: string | null): ViewType => {
        // The Home/Dashboard screen was removed — every role now lands on
        // Devices as the default view.
        return 'devices';
    };

    const canSeeAdminSettings = canAccessAdminSettings(user);
    // All shell gates read the resolved effective permissions/features from
    // /auth/me (role default → org role features → per-user overrides), so the
    // owner's grants and revokes are what actually shape the app — never the
    // raw role. Owners/super admins always pass every check.
    const canSeeBilling = hasUserPermission(user, 'billing:view') && hasUserFeature(user, 'licenses');
    const canSeeSessionsView = hasUserPermission(user, 'sessions:viewHistoryAll');
    // The "Get Help" support-session flow has been removed.
    const canSeeGetHelpView = false;
    const canSeeDevicesView = true;
    // Remote support needs both the page (feature) and the action (permission):
    // a Viewer granted sessions:start gets it, an Admin revoked it loses it.
    const canUseRemoteSupportView = hasUserFeature(user, 'remoteSupport') && hasUserPermission(user, 'sessions:start');

    const resolvedCurrentView: ViewType = (
        !currentView ||
        currentView === 'home' ||
        currentView === 'dashboard' ||
        (currentView === 'admin_settings' && !canSeeAdminSettings) ||
        (currentView === 'billing' && !canSeeBilling) ||
        ((currentView as any) === 'documentation') ||
        (currentView === 'support_workstation' && !canSeeSessionsView) ||
        (currentView === 'end_user_home' && !canSeeGetHelpView) ||
        (currentView === 'devices' && !canSeeDevicesView) ||
        (currentView === 'connect' && !canUseRemoteSupportView)
    )
        ? getDefaultHomeView(user?.role)
        : currentView;

    const setCurrentView = (view: ViewType | ((prev: ViewType) => ViewType)) => {
        if (typeof view === 'function') {
            view = view(currentView);
        }
        if (view === currentView) return;
        
        if (view as any === 'Notifications') {
            setShowNotifications(true);
            return;
        }

        if (view === 'admin_settings' && !canSeeAdminSettings) {
            view = getDefaultHomeView(user?.role);
        }
        if (view === 'billing' && !canSeeBilling) {
            view = getDefaultHomeView(user?.role);
        }
        if (view === 'support_workstation' && !canSeeSessionsView) {
            view = getDefaultHomeView(user?.role);
        }
        if (view === 'end_user_home' && !canSeeGetHelpView) {
            view = getDefaultHomeView(user?.role);
        }
        if (view === 'devices' && !canSeeDevicesView) {
            view = getDefaultHomeView(user?.role);
        }
        if (view === 'connect' && !canUseRemoteSupportView) {
            view = getDefaultHomeView(user?.role);
        }
        
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(view);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        _setCurrentView(view);
        localStorage.setItem('last_view', view);
    };

    const handleBack = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            const view = history[historyIndex - 1];
            _setCurrentView(view);
            localStorage.setItem('last_view', view);
        }
    };

    const handleForward = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            const view = history[historyIndex + 1];
            _setCurrentView(view);
            localStorage.setItem('last_view', view);
        }
    };

    const [orgDetailId, setOrgDetailId] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<'login' | 'signup' | 'connect' | 'forgot' | 'reset'>('login');
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetMsg, setResetMsg] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    // Help & Support for the signed-out landing and sign-in screens.
    const [showLandingHelp, setShowLandingHelp] = useState(false);
    const [showArchivedDevicesModal, setShowArchivedDevicesModal] = useState(false);
    const [showUpdateCheckModal, setShowUpdateCheckModal] = useState(false);
    const [showSupportIdentifierModal, setShowSupportIdentifierModal] = useState(false);
    const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
    const [showCopyrightModal, setShowCopyrightModal] = useState(false);
    const [showAboutRemoteModal, setShowAboutRemoteModal] = useState(false);
    const [updateCheckMessage, setUpdateCheckMessage] = useState('Checking For Updates...');
    const [updateCheckBusy, setUpdateCheckBusy] = useState(false);
    const [supportIdentifierVersion, setSupportIdentifierVersion] = useState('--');
    const [aboutReleaseDate, setAboutReleaseDate] = useState('--');
    const [archivedDevicesSearch, setArchivedDevicesSearch] = useState('');
    const [archivedDevicesRefreshTick, setArchivedDevicesRefreshTick] = useState(0);
    const [isSidebarCustomizationOpen, setIsSidebarCustomizationOpen] = useState(false);
    const [email, setEmail] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('remote365_remembered_email')) || '');
    const [password, setPassword] = useState('');
    // "Remember Me" persists the email and keeps the login prefilled next launch.
    // Defaults on (most users expect to stay remembered); turning it off clears it.
    const [rememberMe, setRememberMe] = useState(() => typeof window === 'undefined' || localStorage.getItem('remote365_remember_me') !== 'false');
    const [signupName, setSignupName] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
    // Sign-up account type. Business asks for company details and a company email.
    const [signupAccountType, setSignupAccountType] = useState<'personal' | 'business'>('personal');
    const [business, setBusiness] = useState({ companyName: '', businessNumber: '', website: '', country: '', state: '', city: '', addressLine: '', postalCode: '' });
    const [businessStep, setBusinessStep] = useState(1);
    const updateBusiness = (key: keyof typeof business, value: string) => setBusiness((current) => ({ ...current, [key]: value }));
    const businessExtras = () => (signupAccountType === 'business' ? { accountType: 'business', ...business } : {});
    const businessMissing = () => signupAccountType === 'business' && hasErrors(validateBusiness(business));
    // Sign-in / sign-up outcome shown as an animated modal (tick or cross).
    const [authResult, setAuthResult] = useState<AuthResultState | null>(null);
    // false when the server could not deliver the code (SMTP down): the code
    // screen then says so instead of "check your inbox".
    const [verificationEmailSent, setVerificationEmailSent] = useState(true);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [authError, setAuthError] = useState<string | null>(null);
    const [sessionCode, setSessionCode] = useState('');
    const [accessPassword, setAccessPassword] = useState('');
    const [showManualPassword, setShowManualPassword] = useState(false);
    // Initialize as viewer window early if URL points to it
    const windowParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isViewer = windowParams.get('view') === 'viewer';
    const isMeetingWindow = windowParams.get('view') === 'meeting';
    const isHostWaitWindow = windowParams.get('view') === 'host-wait';
    const [isViewerWindow, setIsViewerWindow] = useState(isViewer);
    const [remoteCursor, setRemoteCursor] = useState<{ x: number, y: number, visible: boolean, cursorType?: string } | null>(null);
    // Coalesce the high-frequency cursor stream to one state update per frame so it
    // doesn't re-render the whole app on every packet (that was the lag).
    const pendingCursorRef = useRef<{ x: number, y: number, visible: boolean, cursorType?: string } | null>(null);
    const cursorRafRef = useRef<number | null>(null);
    const [remoteWhiteboardEvent, setRemoteWhiteboardEvent] = useState<any>(null);
    const [remoteFileBrowserEvent, setRemoteFileBrowserEvent] = useState<any>(null);
    const [remoteChatEvent, setRemoteChatEvent] = useState<any>(null);
    const [fileTransferStatus, setFileTransferStatus] = useState<FileTransferStatus | null>(null);
    // Protocol-v1 transfers (the host's dock "Send File") show up in the file
    // panel's tray like every other job instead of a modal of their own.
    useEffect(() => { reportLegacyTransfer(fileTransferStatus as any); }, [fileTransferStatus]);
    const [onboardingToken, setOnboardingToken] = useState<string | null>(null);
    const [controlStatus, setControlStatus] = useState<'granted' | 'pending' | 'denied'>('denied');
    // Read inside onControlEvent, which has to keep a stable identity: it is
    // handed to VideoPlayer's window-level input listeners, and rebinding those
    // every time control is granted or revoked is avoidable churn on the input
    // path. A ref keeps the callback's deps empty while staying current.
    // Grey-screen watchdog bookkeeping (see the stats loop).
    const noFrameSinceRef = useRef(0);
    const noFrameEscalationRef = useRef(0);
    const controlStatusRef = useRef(controlStatus);
    controlStatusRef.current = controlStatus;
    // Did this host ever tell us a control mode? Android phone hosts never do:
    // they implement no control handshake at all, so 'denied' would sit there
    // forever, the local gate would eat every tap, and "Request Control" would
    // send a message nothing answers. Silence means a host that has no concept
    // of view-only, so we must not gate it.
    const [hostAnnouncedControl, setHostAnnouncedControl] = useState(false);
    const hostAnnouncedControlRef = useRef(false);
    hostAnnouncedControlRef.current = hostAnnouncedControl;

    const handleJoinSessionInvite = async (code: string, password?: string) => {
        const cleanCode = String(code || '').replace(/\D/g, '');
        if (!cleanCode) return;

        // Support-session codes are unique per session (not device IDs). Try the
        // session join first: on success THIS machine becomes the host and the
        // session creator is notified to connect here. Unknown codes fall back to
        // the classic direct device connect below.
        if (isAuthenticated && !password) {
            try {
                // Probe without a device key first: validates the code is a real
                // session (404 falls through to device connect) without notifying.
                await api.post('/api/chat/remote-sessions/join', { code: cleanCode });
                // Register this machine as a host BEFORE completing the join — the
                // full join makes the session creator auto-connect here, so the
                // signaling registration must already exist or they hit
                // "Session Not Found".
                await handleStartHosting();
                const { data } = await api.post('/api/chat/remote-sessions/join', {
                    code: cleanCode,
                    deviceAccessKey: String(localAuthKey || '').replace(/\D/g, '') || undefined,
                    deviceName: localStorage.getItem('remote365_device_name') || undefined
                });
                const supporter = data?.creatorName || 'The Supporter';
                addNotification(`You're in "${data?.session?.name || 'the support session'}". ${supporter} can connect to this computer whenever they're ready.`, 'session', 'Session Joined');
                pushSlidingToast('Session Joined', `Waiting for ${supporter} to start the remote session.`, undefined, 'accepted');
                return;
            } catch (err: any) {
                // 404 = not a session code; anything else surfaces to the device flow too.
                if (err?.response?.status && err.response.status !== 404) {
                    const message = err.response?.data?.error;
                    if (message) {
                        showError('Could Not Join Session', message);
                        return;
                    }
                }
            }
        }

        const localCodes = [localAuthKey, hostAccessKey, hostSessionId]
            .map((value) => String(value || '').replace(/\D/g, ''))
            .filter(Boolean);
        if (localCodes.includes(cleanCode)) {
            setViewerStatus('idle');
            setViewerError('');
            showError(
                'Cannot Use This ID Here',
                'That Is This Computer\'s Remote365 ID. Enter the other device\'s ID to join a remote session.'
            );
            return;
        }
        setSessionCode(formatCode(cleanCode));
        setViewerError('');
        setViewerStep(1);

        if (!isElectron) {
            setAccessPassword('');
            setTargetDeviceName(null);
            setCurrentView('connect');
            addNotification('Device found. Choose Connect to start the session.', 'session', 'Ready To Connect');
            return;
        }

        // An invite carrying a password (deep link / notification) connects straight through.
        // Otherwise fall back to the shared Devices-page flow: remembered/trusted sessions
        // connect automatically, and new ones prompt for the password in the same modal.
        if (password) {
            setCurrentView('connect');
            await handleConnectToHost(password, cleanCode);
            return;
        }
        await handleDashboardConnect(cleanCode);
    };

    const pushSlidingToast = (title: string, body: string, target?: any, iconType: 'message' | 'session' | 'accepted' | 'system' = 'system') => {
        setGlobalAppToast({ title, body, target, iconType, createdAt: new Date().toISOString() });
    };

    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;
        // A remote-session tab has no chat UI (in-session chat rides the control
        // channel). Each one used to open its own authenticated chat socket,
        // refetch the whole conversation list on every reconnect, and raise a
        // duplicate desktop notification per message.
        if (isViewerWindow) return;
        useChatStore.getState().connectWebSocket();
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => undefined);
        }
        return () => useChatStore.getState().disconnectWebSocket();
    }, [isAuthenticated, user?.id, isViewerWindow]);

    // --- Chat Notifications & Global Events ---
    useEffect(() => {
        // Set the callback for new messages to trigger notifications
        useChatStore.setState({
            onNewMessage: (msg: any, convId: string) => {
                if (msg.senderId === user?.id) return;
                // Respect per-user conversation mute — no toast/sound/notification.
                const mutedHere = useChatStore.getState().conversations
                    .find((c: any) => c.id === convId)?.participants
                    ?.some((p: any) => p.userId === user?.id && p.muted);
                if (mutedHere) return;

                const senderName = msg.sender?.name || msg.sender?.email || 'Someone';
                const event = parseSessionInviteContent(msg.content);
                const title = event?.kind === 'remote-access-request'
                    ? 'Remote Access Request Received'
                    : event?.kind === 'remote-access-response'
                        ? `Remote access request ${event.approved ? 'accepted' : 'declined'}`
                        : event?.kind === 'meeting-invite-response'
                            ? `Meeting invite ${event.accepted ? 'accepted' : 'declined'}`
                        : event?.sessionType === 'VIDEO_MEETING'
                            ? 'Meeting Invite Received'
                            : event
                                ? 'Remote Session Invite Received'
                                : `New message from ${senderName}`;
                const preview = event?.kind === 'remote-access-request'
                    ? `${senderName} requested access to your computer.`
                    : event?.kind === 'remote-access-response'
                        ? `${senderName} ${event.approved ? 'accepted' : 'declined'} your remote access request.`
                        : event?.kind === 'meeting-invite-response'
                            ? `${event.responderName || senderName} ${event.accepted ? 'accepted' : 'declined'} your meeting invite.`
                        : event
                            ? `${senderName} invited you to join ${event.sessionName || (event.sessionType === 'VIDEO_MEETING' ? 'a meeting' : 'a remote session')}.`
                            : (msg.content || '').substring(0, 100);
                const isAcceptedResponse = (event?.kind === 'remote-access-response' && event.approved) ||
                    (event?.kind === 'meeting-invite-response' && event.accepted);
                const iconType = event ? (isAcceptedResponse ? 'accepted' : 'session') : 'message';

                // A live meeting invite should let the recipient JOIN on click, not
                // just open the chat. Other messages open the conversation as before.
                const isMeetingInvite = event?.sessionType === 'VIDEO_MEETING'
                    && event?.kind !== 'meeting-invite-response'
                    && Boolean(event?.sessionCode);
                const notifTarget: any = isMeetingInvite
                    ? { view: 'meeting', meetingId: event.sessionCode }
                    : { view: 'chat', chatId: convId };

                pushSlidingToast(title, preview, notifTarget, iconType);
                addNotification(preview, iconType, title, notifTarget);

                fireNotification(title, preview);

                // Play sound
                playUISound('connect');
            },
            onInvite: (conv) => {
                const requester = conv.participants?.find((p: any) => p.userId === conv.requestedById)?.user;
                const requesterName = requester?.name || requester?.email || 'Someone';
                addNotification(`${requesterName} wants to add you as a contact.`, 'session', 'New Contact Request', {
                    view: 'chat',
                    chatId: conv.id
                });
                pushSlidingToast('New Contact Request', `${requesterName} wants to add you as a contact.`, {
                    view: 'chat',
                    chatId: conv.id
                }, 'session');
                
                // Fire native system notification
                fireNotification('New Contact Request', `${requesterName} wants to add you as a contact.`);
                
                // Play sound
                playUISound('connect');
            },
            onSessionInvite: (invite) => {
                const senderName = invite?.senderName || 'Someone';
                if (invite?.type === 'SESSION_JOINED') {
                    // Someone joined a session we created: their PC is now hosting and
                    // we hold an access grant — open the viewer straight to their machine.
                    const joinerName = invite?.joinerName || senderName;
                    // Close any creator-side waiting room — the session is starting.
                    window.dispatchEvent(new CustomEvent('remote365:session-joined', { detail: { sessionId: invite?.sessionId } }));
                    addNotification(`${joinerName} joined "${invite?.sessionName || 'your session'}". Connecting to their computer now.`, 'accepted', 'Session Joined');
                    pushSlidingToast('Session Joined', `${joinerName} is in. Connecting to their computer now.`, undefined, 'accepted');
                    fireNotification('Session Joined', `${joinerName} joined your session. Connecting now.`, 'session');
                    playUISound('connect');
                    (async () => {
                        try {
                            if (!invite?.grantId || !invite?.joinerDeviceKey) return;
                            // Brief buffer so the joiner's host registration settles
                            // across services before the viewer connects.
                            await new Promise((resolve) => setTimeout(resolve, 1200));
                            const { data } = await api.post(`/api/chat/remote-access-grants/${invite.grantId}/token`);
                            if ((window as any).electronAPI?.openViewerWindow) {
                                await (window as any).electronAPI.openViewerWindow(
                                    String(invite.joinerDeviceKey),
                                    serverIP,
                                    data.token,
                                    invite?.joinerDeviceName || joinerName,
                                    'desktop'
                                );
                            }
                        } catch (err: any) {
                            console.error('[Session] Auto-connect to joiner failed:', err);
                            addNotification(err?.response?.data?.error || "Couldn't connect to their computer automatically. Open the session and try again.", 'system', 'Connection Failed');
                        }
                    })();
                    return;
                }
                if (invite?.type === 'VIDEO_MEETING') {
                    addNotification(`${senderName} is inviting you to a video meeting. Open to join.`, 'session', 'Meeting Invitation', {
                        view: 'meeting',
                        meetingId: invite?.sessionCode
                    });
                    pushSlidingToast('Meeting Invitation', `${senderName} is inviting you to a video meeting.`, {
                        view: 'meeting',
                        meetingId: invite?.sessionCode
                    }, 'session');
                    fireNotification('Meeting Invitation', `${senderName} is inviting you to a video meeting.`);
                } else {
                    addNotification(`${senderName} is inviting you to ${invite?.sessionName || 'a remote session'}. Open to join.`, 'session', 'Session Invitation', {
                        view: 'connect',
                        sessionCode: invite?.sessionCode,
                        sessionPassword: invite?.sessionPassword
                    });
                    pushSlidingToast('Session Invitation', `${senderName} is inviting you to ${invite?.sessionName || 'a remote session'}.`, {
                        view: 'connect',
                        sessionCode: invite?.sessionCode,
                        sessionPassword: invite?.sessionPassword
                    }, 'session');
                    fireNotification('Session Invitation', `${senderName} is inviting you to ${invite?.sessionName || 'a remote session'}.`);
                }
                playUISound('connect');
            },
            onConversationEvent: (event) => {
                if (event.actorUserId === user?.id) return;
                const conversation = event.conversation;
                const actor = conversation?.participants?.find((p: any) => p.userId === event.actorUserId)?.user;
                const actorName = actor?.name || actor?.email || 'Someone';

                if (event.reason === 'accepted') {
                    addNotification(`${actorName} accepted your contact request. You can chat and send invitations now.`, 'accepted', 'Contact Added', {
                        view: 'chat',
                        chatId: conversation?.id
                    });
                    pushSlidingToast('Contact Added', `${actorName} accepted your contact request.`, {
                        view: 'chat',
                        chatId: conversation?.id
                    }, 'accepted');
                    fireNotification('Contact Added', `${actorName} accepted your contact request.`);
                    playUISound('connect');
                } else if (event.reason === 'group-created') {
                    addNotification(`${actorName} added you to ${conversation?.name || 'a group chat'}.`, 'session', 'Added To Group', {
                        view: 'chat',
                        chatId: conversation?.id
                    });
                    pushSlidingToast('Added To Group', `${actorName} added you to ${conversation?.name || 'a group'}.`, {
                        view: 'chat',
                        chatId: conversation?.id
                    }, 'session');
                    fireNotification('Added To Group', `${actorName} added you to ${conversation?.name || 'a group'}.`);
                    playUISound('connect');
                } else if (event.reason === 'renamed') {
                    addNotification(`${actorName} renamed the group to "${conversation?.name || 'a new name'}".`, 'session', 'Group Renamed', {
                        view: 'chat',
                        chatId: conversation?.id
                    });
                    pushSlidingToast('Group Renamed', `${actorName} renamed the group to "${conversation?.name || 'a new name'}".`, {
                        view: 'chat',
                        chatId: conversation?.id
                    }, 'session');
                } else if (event.reason === 'members-added') {
                    addNotification(`${actorName} added new members to ${conversation?.name || 'the group'}.`, 'session', 'Members Added', {
                        view: 'chat',
                        chatId: conversation?.id
                    });
                    pushSlidingToast('Members Added', `${actorName} added new members to ${conversation?.name || 'the group'}.`, {
                        view: 'chat',
                        chatId: conversation?.id
                    }, 'session');
                } else if (event.reason === 'rejected') {
                    addNotification(`${actorName} declined your contact request.`, 'removed', 'Request Declined');
                    pushSlidingToast('Request Declined', `${actorName} declined your contact request.`, undefined, 'system');
                    fireNotification('Request Declined', `${actorName} declined your contact request.`);
                } else if (event.reason === 'unfriended') {
                    addNotification(`${actorName} removed you from their contacts.`, 'removed', 'Contact Removed');
                    pushSlidingToast('Contact Removed', `${actorName} removed you from their contacts.`, undefined, 'system');
                } else if (event.reason === 'blocked') {
                    addNotification('This conversation is no longer available.', 'blocked', 'Conversation Closed');
                    pushSlidingToast('Conversation Closed', 'This conversation is no longer available.', undefined, 'system');
                }
            }
        });
        return () => useChatStore.setState({
            onNewMessage: undefined,
            onInvite: undefined,
            onSessionInvite: undefined,
            onConversationEvent: undefined
        });
    }, [user?.id]);

    useEffect(() => {
        if (!globalAppToast) return;
        const timeout = setTimeout(() => setGlobalAppToast(null), 4500);
        return () => clearTimeout(timeout);
    }, [globalAppToast]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isRightBarOpen, setIsRightBarOpen] = useState(false);

    // Persistent Client ID for signaling stability (survives re-mounts/Strict Mode)
    const [viewerClientId] = useState(() => {
        if (typeof window === 'undefined') return '';
        let cid = sessionStorage.getItem('viewer_client_id');
        if (!cid) {
            cid = 'v-' + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('viewer_client_id', cid);
            return cid;
        }
        return cid;
    });

    const [windowDeviceName, setWindowDeviceName] = useState('');
    const [windowDeviceType, setWindowDeviceType] = useState('');
    const [errorModal, setErrorModal] = useState<{ show: boolean, title: string, message: string } | null>(null);

    const showError = (title: string, message: string) => {
        setErrorModal({ show: true, title: title || 'System Error', message });
    };

    const [hostSessionId, setHostSessionId] = useState('');
    const [hostStatus, setHostStatus] = useState<'idle' | 'connecting' | 'error' | 'status' | ''>('');
    const [hostMessage, setHostMessage] = useState('');
    const [hostError, setHostError] = useState('');
    const [hostAccessKey, setHostAccessKey] = useState('');
    const [devicePassword, setDevicePassword] = useState(getStoredDevicePassword);
    // Whether the SERVER holds an access password for this device. The stored
    // hash is the source of truth (permanent until the user changes it); the
    // local plaintext copy is only for display and may legitimately be missing.
    const [serverHasDevicePassword, setServerHasDevicePassword] = useState(false);
    const [isAutoHostEnabled, setAutoHostEnabledState] = useState(() => localStorage.getItem('is_auto_host_enabled') !== 'false');
    useEffect(() => {
        if (localStorage.getItem('is_auto_host_enabled') === null) {
            localStorage.setItem('is_auto_host_enabled', 'true');
        }
    }, []);
    const setIsAutoHostEnabled = useCallback((enabled: boolean) => {
        setAutoHostEnabledState(enabled);
        localStorage.setItem('is_auto_host_enabled', String(enabled));
    }, []);
    const [showHostPassword, setShowHostPassword] = useState(false);
    const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
    const [isLocalHostRegistered, setIsLocalHostRegistered] = useState(false);

    const [serverIP, setServerIPState] = useState(() => normalizeServerHost(DEFAULT_SERVER_HOST));
    const setServerIP = useCallback((value: string) => {
        const normalized = normalizeServerHost(value || DEFAULT_SERVER_HOST);
        setServerIPState(normalized);
        if (value && normalized !== value) {
            localStorage.setItem('remote_link_server_ip', normalized);
        }
    }, []);
    const [localAuthKey, setLocalAuthKey] = useState('');
    const [localIP, setLocalIP] = useState('127.0.0.1');
    const [showSettings, setShowSettings] = useState(false);
    const [isPackaged, setIsPackaged] = useState(false);
    const [analyticsSummary, setAnalyticsSummary] = useState<any>(null);

    useEffect(() => {
        if ((window as any).electronAPI?.isPackaged) {
            (window as any).electronAPI.isPackaged().then(setIsPackaged);
        }

        const cleanups: (() => void)[] = [];

        if ((window as any).electronAPI?.onTemp2faToken) {
            const cleanup = (window as any).electronAPI.onTemp2faToken((token: string) => {
                console.log('[Auth] Received 2FA temp token via deep link');
                setTemp2faToken(token);
            });
            if (cleanup) cleanups.push(cleanup);
        }

        return () => {
            cleanups.forEach(c => c());
        };
    }, []);


    const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'error' | 'connected' | 'streaming' | 'connection_lost'>('idle');
    const [viewerError, setViewerError] = useState('');
    // Live connection-health snapshot surfaced in the session toolbar (real
    // getStats() numbers from the adaptive-quality loop below, not estimates).
    const [connectionHealth, setConnectionHealth] = useState({ rttMs: 0, lossPct: 0, fps: 0 });
    const lastConnectionHealthUiAtRef = useRef(0);
    const videoPlayerRef = useRef<any>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const candidatesBuffer = useRef<RTCIceCandidateInit[]>([]);
    const controlChannelRef = useRef<RTCDataChannel | null>(null);
    // Talk-back: send the viewer's mic to the host on the existing (sendrecv) audio m-line.
    // The sender is captured at answer time; the mic track is attached/removed with
    // replaceTrack so toggling never renegotiates (viewers can't offer — the relay refuses it).
    const talkSenderRef = useRef<RTCRtpSender | null>(null);
    const talkStreamRef = useRef<MediaStream | null>(null);
    const [talkActive, setTalkActive] = useState(false);
    const [viewerMediaActive, setViewerMediaActive] = useState(true);
    const viewerMediaActiveRef = useRef(true);
    const viewerMediaEpochRef = useRef(0);
    const syncViewerMedia = useCallback(() => {
        const active = viewerMediaActiveRef.current;
        for (const receiver of pcRef.current?.getReceivers() || []) receiver.track.enabled = active;
        for (const track of talkStreamRef.current?.getTracks() || []) track.enabled = active;
        const channel = controlChannelRef.current;
        if (channel?.readyState === 'open') {
            channel.send(JSON.stringify({ type: 'stream-activity', active }));
            if (active) channel.send(JSON.stringify({ type: 'request-keyframe', reason: 'tab-resumed' }));
        }
    }, []);
    useEffect(() => {
        const api = (window as any).electronAPI;
        if (!api?.onViewerMediaActive) return;
        let disposed = false;
        let receivedEvent = false;
        const apply = (active: boolean) => {
            if (disposed) return;
            if (viewerMediaActiveRef.current !== active) viewerMediaEpochRef.current++;
            viewerMediaActiveRef.current = active;
            setViewerMediaActive(active);
            syncViewerMedia();
        };
        const unsubscribe = api.onViewerMediaActive((active: boolean) => {
            receivedEvent = true;
            apply(active);
        });
        // Subscribe first; an old snapshot must not overwrite a newer switch event.
        api.getViewerMediaActive().then((active: boolean) => {
            if (!receivedEvent) apply(active);
        }).catch(() => {});
        return () => { disposed = true; unsubscribe(); };
    }, [syncViewerMedia]);
    const inputChannelRef = useRef<RTCDataChannel | null>(null);
    const criticalInputChannelRef = useRef<RTCDataChannel | null>(null);
    const lastRealtimeInputAtRef = useRef(0);
    const compactInputSupportedRef = useRef(false);
    const reconnectingViewerRef = useRef(false);
    const adaptiveStatsIntervalRef = useRef<number | null>(null);
    const lastAdaptiveModeRef = useRef<string>('balanced');
    const lastAdaptiveStatsLogRef = useRef<number>(0);
    const lastIceRouteRef = useRef<string>('');
    const lastIceRouteTopologyRef = useRef<string>('');
    const volumeIntervalRef = useRef<any>(null);
    const reassemblyMap = useRef<Map<bigint, any>>(new Map());
    const monitorWsRef = useRef<WebSocket | null>(null);
    const videoReceiverRef = useRef<any>(null);
    const firstFramePresentedRef = useRef(false);
    const viewerPipelineTimelineRef = useRef({
        startedAt: 0,
        offerAt: 0,
        connectedAt: 0,
        trackAt: 0,
    });
    const handleFirstFramePresented = useCallback(() => {
        firstFramePresentedRef.current = true;
    }, []);

    // Mouse-move throttling lives in VideoPlayer (single 16ms gate); App adds none.
    const lastBufferWarningRef = useRef<number>(0);

    // ICE servers, prefetched at session start and cached briefly so the offer
    // handler never blocks on an HTTPS round-trip in the middle of the WebRTC
    // handshake (TURN credentials carry an hour TTL; 5 minutes is safely fresh).
    const iceServersCacheRef = useRef<{ list: any[]; at: number } | null>(null);
    const iceServersInflightRef = useRef<Promise<any[]> | null>(null);
    // ICE servers the signaling server attached to this session's `joined`
    // message. Signaling already authorized us for this exact session, so it
    // hands over TURN credentials with no account or machine credential needed.
    // This is the only relay a signed-out viewer on a fresh install can get.
    const signalingIceServersRef = useRef<any[]>([]);
    const logIce = (msg: string) => {
        console.info(msg);
        if (isElectron) (window as any).electronAPI?.log?.(msg);
    };
    const fetchIceServers = useCallback((): Promise<any[]> => {
        const cached = iceServersCacheRef.current;
        if (cached && Date.now() - cached.at < 5 * 60_000) return Promise.resolve(cached.list);
        if (iceServersInflightRef.current) return iceServersInflightRef.current;
        const hasTurn = iceListHasTurn;
        const inflight = api.get('/api/auth/ice-servers')
            .then((res: any) => (Array.isArray(res.data?.iceServers) ? res.data.iceServers : []))
            .catch((err: any) => {
                logIce(`[Viewer] ICE servers from the account unavailable (${err?.response?.status || err?.message || err})`);
                return [] as any[];
            })
            .then(async (list: any[]) => {
                if (hasTurn(list)) {
                    logIce('[Viewer] ICE servers: account credentials (TURN relay available)');
                    return list;
                }
                // Signed out (no user token): without this the session gets STUN only
                // and can never use the relay, so it fails on any pair of networks
                // that can't connect directly. This PC's machine credential works.
                const machine = await Promise.resolve((window as any).electronAPI?.getMachineIceServers?.()).catch(() => []);
                if (Array.isArray(machine) && hasTurn(machine)) {
                    logIce('[Viewer] ICE servers: this device\'s machine credential (TURN relay available)');
                    return machine;
                }
                if (hasTurn(signalingIceServersRef.current)) {
                    logIce('[Viewer] ICE servers: session credentials from signaling (TURN relay available)');
                    return signalingIceServersRef.current;
                }
                logIce('[Viewer] ICE servers: STUN only, no TURN relay (direct connections only)');
                return list;
            })
            .then((list: any[]) => {
                // Only a list with a relay is worth keeping; retry the rest next time.
                if (hasTurn(list)) iceServersCacheRef.current = { list, at: Date.now() };
                return list;
            })
            .finally(() => { iceServersInflightRef.current = null; });
        iceServersInflightRef.current = inflight;
        return inflight;
    }, []);

    // (classifiers are module-scope, above the component — they must not be
    // recreated per render, they sit under every outgoing input event)

    const describeSelectedIceRoute = (stats: RTCStatsReport) => {
        let selectedPair: any = null;
        const reports: Record<string, any> = {};
        stats.forEach((report: any) => {
            reports[report.id] = report;
            if (report.type === 'candidate-pair' && (report.nominated || report.selected) && report.state !== 'failed') {
                selectedPair = report;
            }
            if (report.type === 'transport' && report.selectedCandidatePairId) {
                selectedPair = reports[report.selectedCandidatePairId] || selectedPair;
            }
        });
        if (!selectedPair) return '';
        const local = reports[selectedPair.localCandidateId] || {};
        const remote = reports[selectedPair.remoteCandidateId] || {};
        const localType = local.candidateType || 'unknown';
        const remoteType = remote.candidateType || 'unknown';
        const protocol = String(local.protocol || remote.protocol || '').toLowerCase() || 'unknown';

        // Also report every OTHER usable candidate pair and its measured RTT. ICE picks by
        // fixed priority (host > srflx > relay), never by latency — so it will happily sit on
        // a 450ms direct path while an available relay pair is materially faster. Without this
        // there is no way to tell from a log whether a better route existed, and the selected
        // route alone made the direct path look like the only option.
        const alternatives: string[] = [];
        stats.forEach((report: any) => {
            if (report.type !== 'candidate-pair' || report.id === selectedPair.id) return;
            if (report.state !== 'succeeded' && report.state !== 'in-progress') return;
            const altLocal = reports[report.localCandidateId] || {};
            const altRemote = reports[report.remoteCandidateId] || {};
            const rtt = typeof report.currentRoundTripTime === 'number'
                ? `${Math.round(report.currentRoundTripTime * 1000)}ms`
                : 'n/a';
            alternatives.push(`${altLocal.candidateType || '?'}->${altRemote.candidateType || '?'}:${rtt}`);
        });

        const selectedRtt = typeof selectedPair.currentRoundTripTime === 'number'
            ? `${Math.round(selectedPair.currentRoundTripTime * 1000)}ms`
            : 'n/a';
        const altText = alternatives.length ? ` alts=[${alternatives.slice(0, 6).join(' ')}]` : ' alts=none';
        return `local=${localType}/${protocol} remote=${remoteType}/${protocol} rtt=${selectedRtt}${altText}`;
    };

    // Stable identity (all state via refs): these are props of VideoPlayer, and a
    // fresh function per App render used to invalidate its useCallbacks and force
    // window listener re-attachment while the pointer was moving.
    const getChannelForEvent = useCallback((event: any) => {
        if (!(event instanceof Uint8Array) && isCriticalInputEvent(event) && criticalInputChannelRef.current?.readyState === 'open') {
            return criticalInputChannelRef.current;
        }
        if (!(event instanceof Uint8Array) && isTransientInputEvent(event) && inputChannelRef.current?.readyState === 'open') {
            return inputChannelRef.current;
        }
        return controlChannelRef.current;
    }, []);

    const onControlEvent = useCallback((event: any) => {
        // Background video recovery must not wake a parked host. Key-up events
        // still pass through so switching tabs cannot leave a remote key held.
        if (!viewerMediaActiveRef.current && ['request-keyframe', 'stream-quality', 'mousemove', 'wheel', 'keydown', 'mousedown'].includes(event?.type)) return;
        // View-only session: drop input here rather than shipping it across the
        // network to be refused. Binary (file chunks) is exempt — the host
        // handles it before the control gate.
        if (!(event instanceof Uint8Array)
            && hostAnnouncedControlRef.current
            && controlStatusRef.current !== 'granted'
            && !SENDABLE_BEFORE_CONTROL.has(event?.type)) {
            return;
        }
        const channel = getChannelForEvent(event);
        if (channel?.readyState === 'open') {
            try {
                if (!(event instanceof Uint8Array) && isRealtimeInputEvent(event)) {
                    lastRealtimeInputAtRef.current = Date.now();
                }
                if (event instanceof Uint8Array) {
                    // Binary packets (files) are critical, never drop them here.
                    // Flow control is handled by the caller.
                    channel.send(event as any);
                } else {
                    // Congestion guard. Critical events (down/up transitions, typed
                    // text) are NEVER dropped: discarding a mouseup/keyup while its
                    // mousedown/keydown got through leaves the host with a stuck
                    // button or key. Their channel is reliable+ordered, so queued
                    // means delivered.
                    if (!isCriticalInputEvent(event)) {
                        const bufferLimit = isTransientInputEvent(event) ? 65536 : 262144;
                        if (channel.bufferedAmount > bufferLimit) {
                            if (isTransientInputEvent(event)) return; // Drop stale travel/scroll

                            // Extreme congestion: shed non-input sync traffic
                            if (channel.bufferedAmount > 524288) {
                                const now = Date.now();
                                if (now - lastBufferWarningRef.current > 5000) {
                                    console.warn(`[Diagnostic] DataChannel Saturated: ${Math.round(channel.bufferedAmount / 1024)}KB queued. Dropping sync...`);
                                    lastBufferWarningRef.current = now;
                                }
                                return;
                            }
                        }
                    }
                    const compactInput = compactInputSupportedRef.current ? encodeCompactInput(event) : null;
                    channel.send(compactInput || JSON.stringify(event));
                }
            } catch (err: any) {
                console.error(`[Diagnostic] Failed to send control event: ${err.message}`);
            }
        }
    }, [getChannelForEvent]);

    // Talk-back: capture the local mic and stream it to the host over the existing audio
    // m-line (replaceTrack — no renegotiation). Pressing again stops the mic and releases it.
    // The host plays received audio through its media route, so whoever holds the phone hears
    // the operator. `audio-talk` lets the host surface a "viewer is speaking" indicator.
    const toggleTalk = useCallback(async () => {
        const sender = talkSenderRef.current;
        if (!sender) {
            addNotification("The remote computer isn't accepting microphone audio right now.", 'system', 'Microphone Unavailable');
            return;
        }
        if (talkStreamRef.current) {
            // Stop talking.
            try { await sender.replaceTrack(null); } catch { /* sender may be gone on teardown */ }
            talkStreamRef.current.getTracks().forEach((t) => t.stop());
            talkStreamRef.current = null;
            setTalkActive(false);
            onControlEvent({ type: 'audio-talk', on: false });
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false,
            });
            const track = stream.getAudioTracks()[0];
            if (!track) throw new Error('no microphone track');
            await sender.replaceTrack(track);
            talkStreamRef.current = stream;
            setTalkActive(true);
            onControlEvent({ type: 'audio-talk', on: true });
        } catch (e: any) {
            console.error('[Viewer] talk-back mic failed:', e);
            addNotification(
                e?.name === 'NotAllowedError'
                    ? 'Microphone access is blocked. Allow it in Windows privacy settings to talk during sessions.'
                    : "Couldn't start your microphone. Check that another app isn't using it.",
                'system',
            );
        }
    }, [onControlEvent]);

    // sessionIdForSignal / hostTargetId are only needed by the auto-reroute below, which has
    // to ask the host to re-offer. They live in the signaling handler's scope, so they are
    // threaded in rather than lifted to component state.
    const startAdaptiveStreamStats = (pc: RTCPeerConnection, sessionIdForSignal?: string, hostTargetId?: string) => {
        if (adaptiveStatsIntervalRef.current) window.clearInterval(adaptiveStatsIntervalRef.current);
        // Per-interval loss tracking. The old code summed packetsLost over the whole
        // session, so a single early loss burst pinned the stream at the lowest tier
        // for the rest of the call. We diff against the previous sample instead.
        let prevReceived = 0;
        let prevLost = 0;
        let upshiftStreak = 0; // consecutive healthy samples required before raising quality
        let downshiftStreak = 0; // consecutive lossy samples required before dropping quality
        let warmedUp = false; // first sample uses cumulative totals — never act on it
        // Chromium does not populate inbound-rtp.framesPerSecond in this Electron build, so
        // every log line read "fps=0" even while video was clearly playing — which made the
        // stream stats useless for diagnosing exactly the "laggy / low framerate" reports they
        // exist to answer. Derive it from the framesDecoded counter instead.
        let prevFramesDecoded = 0;
        let prevFrameSampleAt = 0;
        let prevFramesDropped = 0;
        let prevJbDelay = 0;
        let prevJbEmitted = 0;
        const statsStartedAt = Date.now();
        let lastLossRecoveryAt = 0;
        let lastLossObservedAt = 0;
        // Separate clock for the upshift gate. lastLossObservedAt moves on ANY
        // lost packet (decoder recovery needs that sensitivity), but gating the
        // quality climb on it meant one stray packet per 20s — ~0.005% loss on a
        // relayed path — kept sessions pinned at 'balanced' (a downscale on any
        // >1920-wide display) for the whole call. Only meaningful loss samples
        // (>=0.5% in a 500ms window) should block the climb.
        let lastMeaningfulLossAt = 0;
        let decoderRecoveryPending = false;
        let rerouteAttempted = false; // auto route repair fires at most once per session
        let relayAdvantageStreak = 0;
        const rank: Record<string, number> = { smooth: 0, balanced: 1, sharp: 2, ultra: 3 };
        const order = ['smooth', 'balanced', 'sharp', 'ultra'];
        let mediaEpoch = viewerMediaEpochRef.current;
        adaptiveStatsIntervalRef.current = window.setInterval(async () => {
            if (!viewerMediaActiveRef.current || mediaEpoch !== viewerMediaEpochRef.current) {
                mediaEpoch = viewerMediaEpochRef.current;
                warmedUp = false;
                prevFrameSampleAt = 0;
                prevFramesDecoded = 0;
                noFrameSinceRef.current = 0;
                noFrameEscalationRef.current = 0;
                decoderRecoveryPending = false;
                relayAdvantageStreak = 0;
                upshiftStreak = 0;
                downshiftStreak = 0;
                return;
            }
            const channel = controlChannelRef.current;
            if (!channel || channel.readyState !== 'open' || pc.connectionState !== 'connected') return;
            try {
                const stats = await pc.getStats();
                if (!viewerMediaActiveRef.current || mediaEpoch !== viewerMediaEpochRef.current) return;
                let rttMs = 0;
                let fps = 0;
                let received = prevReceived;
                let lost = prevLost;
                let framesDropped = prevFramesDropped;
                let frameWidth = 0;
                let frameHeight = 0;
                let jbDelay = 0;        // cumulative seconds frames waited in the jitter buffer
                let jbEmitted = 0;      // count of frames emitted from the jitter buffer

                stats.forEach((report: any) => {
                    if (report.type === 'candidate-pair' && (report.nominated || report.selected) && typeof report.currentRoundTripTime === 'number') {
                        rttMs = Math.max(rttMs, Math.round(report.currentRoundTripTime * 1000));
                    }
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        received = Number(report.packetsReceived || 0);
                        lost = Math.max(0, Number(report.packetsLost || 0));
                        fps = Number(report.framesPerSecond || report.framesDecodedPerSecond || 0);
                        // Fall back to differentiating framesDecoded when the browser omits
                        // framesPerSecond (it does here), so the number is real either way.
                        const framesDecoded = Number(report.framesDecoded || 0);
                        framesDropped = Math.max(0, Number(report.framesDropped || 0));
                        frameWidth = Math.max(0, Number(report.frameWidth || 0));
                        frameHeight = Math.max(0, Number(report.frameHeight || 0));
                        const sampleAt = Number(report.timestamp || 0);
                        if (!fps && framesDecoded && prevFramesDecoded && sampleAt > prevFrameSampleAt) {
                            const elapsedSec = (sampleAt - prevFrameSampleAt) / 1000;
                            if (elapsedSec > 0) fps = Math.max(0, (framesDecoded - prevFramesDecoded) / elapsedSec);
                        }
                        if (framesDecoded) { prevFramesDecoded = framesDecoded; prevFrameSampleAt = sampleAt; }
                        // Grey-viewport recovery. A connected session that has
                        // decoded nothing is a stalled pipeline, not a slow one:
                        // escalate rather than leave the user staring at grey.
                        // Reset the moment anything decodes so a mid-session
                        // freeze gets the same treatment.
                        if (framesDecoded > 0) {
                            noFrameSinceRef.current = 0;
                            noFrameEscalationRef.current = 0;
                        } else if (pc.connectionState === 'connected') {
                            const now = Date.now();
                            if (!noFrameSinceRef.current) noFrameSinceRef.current = now;
                            const stalledMs = now - noFrameSinceRef.current;
                            // 1) ~2s: ask for an urgent IDR. Covers a viewer that
                            //    joined mid-GOP or missed the bootstrap access unit.
                            if (stalledMs > 2000 && noFrameEscalationRef.current < 1) {
                                noFrameEscalationRef.current = 1;
                                (window as any).electronAPI?.log?.('[Viewer] STALL: connected but 0 frames decoded after 2s — requesting urgent keyframe.');
                                onControlEvent({ type: 'request-keyframe', urgent: true });
                            }
                            // 2) ~6s: the host is not producing decodable video.
                            //    Say so, instead of showing a broken viewport.
                            if (stalledMs > 6000 && noFrameEscalationRef.current < 2) {
                                noFrameEscalationRef.current = 2;
                                (window as any).electronAPI?.log?.(`[Viewer] STALL: still 0 frames after ${Math.round(stalledMs / 1000)}s (packetsReceived=${received}). Surfacing recovery state.`);
                                setViewerError('The remote screen has not started. Retrying…');
                                onControlEvent({ type: 'request-keyframe', urgent: true });
                            }
                        }
                        jbDelay = Number(report.jitterBufferDelay || 0);
                        jbEmitted = Number(report.jitterBufferEmittedCount || 0);
                    }
                });
                const iceRoute = describeSelectedIceRoute(stats);
                if (iceRoute) {
                    lastIceRouteRef.current = iceRoute;
                    // RTT and alternate-pair samples change constantly. Comparing
                    // the complete diagnostic string logged the same selected
                    // route every 500ms and pushed synchronous log work through
                    // the renderer/main IPC hot path. Log only topology changes;
                    // the 5s stream-stat sample still carries current RTT.
                    const topology = iceRoute
                        .replace(/\s+rtt=\d+ms/g, '')
                        .replace(/\s+alts=.*/, '');
                    if (topology !== lastIceRouteTopologyRef.current) {
                        lastIceRouteTopologyRef.current = topology;
                        if (isElectron) (window as any).electronAPI?.log?.(`[Viewer] Selected ICE route: ${iceRoute}`);
                    }
                }

                const dReceived = Math.max(0, received - prevReceived);
                const dLost = Math.max(0, lost - prevLost);
                const dFramesDropped = Math.max(0, framesDropped - prevFramesDropped);
                prevReceived = received;
                prevLost = lost;
                prevFramesDropped = framesDropped;
                const lossPct = (dReceived + dLost) > 0 ? Math.round((dLost / (dReceived + dLost)) * 1000) / 10 : 0;

                // A decoder can keep reporting frames/FPS after a fragmented
                // H.264 reference frame is lost while the picture itself becomes
                // a persistent mosaic. Do not request a keyframe during the loss
                // burst: a large IDR sent into an already-congested path creates
                // another burst, more loss, and an endless restart loop. Mark the
                // decoder for repair, let adaptation reduce bitrate, then request
                // one fresh IDR after the path has been clean for a short window.
                const inStartupWindow = Date.now() - statsStartedAt < 12_000;
                const referenceMayBeCorrupt =
                    dLost > 0 &&
                    (inStartupWindow || lossPct >= 2 || dFramesDropped > 0);
                if (dLost > 0) lastLossObservedAt = Date.now();
                if (lossPct >= 0.5) lastMeaningfulLossAt = Date.now();
                if (referenceMayBeCorrupt) decoderRecoveryPending = true;
                const pathStableForRecovery =
                    decoderRecoveryPending &&
                    dLost === 0 &&
                    lastLossObservedAt > 0 &&
                    Date.now() - lastLossObservedAt >= 2_000;
                if (pathStableForRecovery && Date.now() - lastLossRecoveryAt >= 20_000) {
                    lastLossRecoveryAt = Date.now();
                    decoderRecoveryPending = false;
                    const recoveryReason = inStartupWindow ? 'startup-packet-loss' : 'rtp-packet-loss';
                    channel.send(JSON.stringify({
                        type: 'request-keyframe',
                        urgent: true,
                        reason: recoveryReason,
                        lossPct,
                        packetsLostDelta: dLost,
                        framesDroppedDelta: dFramesDropped,
                    }));
                    if (isElectron) {
                        (window as any).electronAPI?.log?.(
                            `[Viewer] Decoder recovery requested reason=${recoveryReason} loss=${lossPct}% lostDelta=${dLost} framesDroppedDelta=${dFramesDropped}`,
                        );
                    }
                }

                // --- Adaptive playout buffer -----------------------------------
                // Retune Chromium's jitter buffer to live conditions. A clean,
                // low-RTT P2P link only needs a small buffer (~55ms), which removes
                // the glass-to-glass latency the fixed 100ms target was adding.
                // Loss or high RTT raises it again so we don't trade latency for
                // stutter. This is the WebRTC-native equivalent of AnyDesk's
                // dynamic buffering.
                // Floor at 45ms (~1.4 frame intervals at 30fps): a sub-frame
                // playout buffer turns ANY delivery wobble into visible repaint
                // stutter — smoothness beats the last 25ms of latency here.
                // Floor 30ms on snappy links (LAN/near region) — the fixed 45ms floor
                // taxed exactly the sessions that could be fastest. Long-haul keeps 45+.
                // While the user is actively clicking, typing, dragging, or
                // scrolling, favor immediate visual feedback. Once input has
                // been idle for a moment, restore the larger stability buffer.
                const inputActive = Date.now() - lastRealtimeInputAtRef.current < 1_250;
                const jitterFloorMs = inputActive ? (rttMs > 0 && rttMs < 80 ? 18 : 25) : (rttMs > 0 && rttMs < 80 ? 30 : 45);
                const latencyBaseMs = inputActive ? 6 + rttMs * 0.04 : 18 + rttMs * 0.08;
                const jitterTargetMs = Math.round(Math.min(95, Math.max(jitterFloorMs, latencyBaseMs + lossPct * 12)));
                if (videoReceiverRef.current) {
                    try {
                        if ('jitterBufferTarget' in videoReceiverRef.current) videoReceiverRef.current.jitterBufferTarget = jitterTargetMs;
                        if ('playoutDelayHint' in videoReceiverRef.current) videoReceiverRef.current.playoutDelayHint = jitterTargetMs / 1000;
                    } catch { /* receiver may be gone */ }
                }
                // Estimated glass-to-glass latency = one-way network hop + time
                // frames spend waiting in the playout buffer (encode/decode add a
                // few ms on top). Lets us verify latency wins from the logs.
                // Use interval deltas, not the lifetime cumulative average.
                // The cumulative value can stay elevated for minutes after one
                // congestion episode and made the HUD look as if 250ms was
                // still queued when current frames had already recovered.
                const dJbDelay = Math.max(0, jbDelay - prevJbDelay);
                const dJbEmitted = Math.max(0, jbEmitted - prevJbEmitted);
                prevJbDelay = jbDelay;
                prevJbEmitted = jbEmitted;
                const intervalJbMs = dJbEmitted > 0 ? Math.round((dJbDelay / dJbEmitted) * 1000) : 0;
                const e2eEstMs = Math.round(rttMs / 2 + intervalJbMs);

                // High RTT and low decoded FPS are common on static mobile screens:
                // WebRTC may simply have no changed frames to decode. Only reduce
                // capture quality for packet loss, otherwise the phone looks blurry
                // even when the connection is healthy.
                const reason = lossPct >= 5
                    ? 'loss-high'
                    : lossPct >= 1.5
                        ? 'loss-moderate'
                        : 'healthy';
                // Long-haul ceiling. 'ultra' asks the host for 12Mbps — and 16Mbps once the
                // capture is wider than 2200px. Over a ~450ms path that is simply more than
                // the link carries: measured sessions sat at 0% loss and then spiked to 8.9%,
                // which is the signature of oversending, and every one of those spikes forced
                // a quality downshift. A steady 9Mbps ('sharp') looks BETTER than 16Mbps that
                // is losing 9% of its packets, because loss corrupts far more than a modestly
                // lower bitrate does. RTT alone never lowers quality below this ceiling — it
                // only stops us reaching for the top tier on a link that cannot hold it.
                const longHaul = rttMs >= 180;
                const healthyCeiling = longHaul ? 'sharp' : 'ultra';
                const target = lossPct >= 5
                    ? 'smooth'
                    : lossPct >= 1.5
                        ? 'balanced'
                        : healthyCeiling;

                const current = lastAdaptiveModeRef.current || 'balanced';
                let next = current;
                if (!firstFramePresentedRef.current) {
                    // Never restart the encoder while Chromium is still waiting
                    // for the startup keyframe. An early RTT-based downshift used
                    // to discard SPS/PPS/IDR and extend first presentation by
                    // several seconds on long-haul sessions.
                    upshiftStreak = 0;
                    downshiftStreak = 0;
                } else if (!warmedUp) {
                    // First sample's counters are cumulative since connect (handshake
                    // losses included) — acting on it caused a spurious quality drop
                    // right at session start. Just record the baseline.
                    warmedUp = true;
                } else if (rank[target] < rank[current]) {
                    // A single 500ms loss sample is commonly an IDR microburst,
                    // not sustained congestion. Confirm loss on the next sample
                    // before restarting the host encoder; only catastrophic loss
                    // should react immediately.
                    downshiftStreak++;
                    upshiftStreak = 0;
                    const catastrophicLoss = lossPct >= 30;
                    if (catastrophicLoss || downshiftStreak >= 2) {
                        // Step down one tier at a time, mirroring the upshift below.
                        // Persistent congestion degrades motion before resolution.
                        // Catastrophic loss still drops directly to the safe tier.
                        next = catastrophicLoss
                            ? target
                            : order[Math.max(rank[current] - 1, rank[target])];
                        downshiftStreak = 0;
                    }
                } else if (rank[target] > rank[current]) {
                    // Spare headroom — raise quality only after a sustained clean
                    // window, and step up one tier at a time.
                    downshiftStreak = 0;
                    // Gate on MEANINGFUL loss only (see lastMeaningfulLossAt
                    // above) — trace single-packet loss must not freeze the
                    // ladder at a blurry tier forever.
                    const cleanLongEnough =
                        lastMeaningfulLossAt === 0 ||
                        Date.now() - lastMeaningfulLossAt >= 20_000;
                    if (!cleanLongEnough) {
                        upshiftStreak = 0;
                    } else {
                        upshiftStreak++;
                    }
                    // Stats run at 500ms: require ten clean seconds per tier.
                    if (upshiftStreak >= 20) {
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
                    if (isElectron) (window as any).electronAPI?.log?.(`[Viewer] Adaptive quality request mode=${next} reason=${reason} rtt=${rttMs}ms loss=${lossPct}% fps=${Math.round(fps)}`);
                }

                // --- Automatic route repair -------------------------------------------
                // ICE nominates by candidate PRIORITY (host > srflx > relay) and never
                // revisits that choice, so it will happily sit on a direct path that is both
                // slower AND lossier than an available relay. Measured on a real session:
                // selected srflx<->srflx at ~390ms with 11-16% packet loss, while a Cloudflare
                // relay pair sat right there at ~257ms. At that loss rate frames cannot be
                // reassembled, so no keyframe ever completes and the session appears to hang
                // on "Making Connection" — the user-visible symptom.
                //
                // So: measure both, and if relay is clearly better, move to it. Switching is
                // done by narrowing the policy to 'relay' and asking the HOST to re-offer
                // (main/index.ts already handles 'request-offer'), which renegotiates without
                // tearing the session down. Guarded to fire at most once per session so a
                // flapping link can never turn this into a reconnect loop.
                if (!rerouteAttempted && warmedUp) {
                    let bestRelayRtt = Number.POSITIVE_INFINITY;
                    let selectedIsRelay = false;
                    const pairReports: Record<string, any> = {};
                    stats.forEach((r: any) => { pairReports[r.id] = r; });
                    stats.forEach((r: any) => {
                        if (r.type !== 'candidate-pair') return;
                        if (r.state !== 'succeeded' && r.state !== 'in-progress') return;
                        const localCand = pairReports[r.localCandidateId];
                        const isRelay = localCand?.candidateType === 'relay';
                        const nominated = r.nominated || r.selected;
                        if (nominated && isRelay) selectedIsRelay = true;
                        if (isRelay && typeof r.currentRoundTripTime === 'number') {
                            bestRelayRtt = Math.min(bestRelayRtt, r.currentRoundTripTime * 1000);
                        }
                    });

                    // Candidate-pair RTTs are noisy and are not sampled at the
                    // same instant. Never pin the next session to TURN from one
                    // apparent win: the measured regression was direct=313ms,
                    // relay=245ms for one sample, followed by 313-506ms click RTT
                    // after relay was forced. Require a clear advantage for three
                    // consecutive samples before persisting the one-shot route.
                    const pathIsBad = rttMs >= 450 || lossPct >= 8;
                    const relayIsBetter = Number.isFinite(bestRelayRtt) && bestRelayRtt < rttMs - 100;
                    if (!selectedIsRelay && pathIsBad && relayIsBetter) {
                        relayAdvantageStreak++;
                    } else {
                        relayAdvantageStreak = 0;
                    }
                    if (!selectedIsRelay && relayAdvantageStreak >= 3) {
                        rerouteAttempted = true;
                        try {
                            // Record the preference for the NEXT peer connection instead of
                            // renegotiating this one.
                            //
                            // The first attempt at this narrowed iceTransportPolicy to 'relay'
                            // mid-session and asked the host to re-offer. That KILLED the
                            // session every time: narrowing the policy invalidates the live
                            // srflx pairs before a relay pair is nominated, so the transport
                            // fails. Worse, this guard is recreated on every reconnect, so the
                            // failure re-triggered the switch and produced a connect/fail loop.
                            //
                            // iceTransportPolicy is only safely applied at RTCPeerConnection
                            // construction, so persist it and let the next connection pick it
                            // up. The app's own reconnect then lands on the relay cleanly.
                            window.localStorage?.setItem('r365_force_relay', '1');
                            window.localStorage?.setItem('r365_force_relay_at', String(Date.now()));
                            window.localStorage?.setItem('r365_force_relay_confidence', 'sustained-v2');
                            if (isElectron) {
                                (window as any).electronAPI?.log?.(`[Viewer] Relay preferred for next connect: direct ${rttMs}ms loss=${lossPct}% vs relay ${Math.round(bestRelayRtt)}ms.`);
                            }
                        } catch (err: any) {
                            if (isElectron) (window as any).electronAPI?.log?.(`[Viewer] Relay preference store failed: ${err?.message || err}`);
                        }
                    }
                }

                const logNow = Date.now();
                if (logNow - lastAdaptiveStatsLogRef.current > 5000) {
                    lastAdaptiveStatsLogRef.current = logNow;
                    if (isElectron) (window as any).electronAPI?.log?.(`[Viewer] Stream stats rtt=${rttMs}ms loss=${lossPct}% fps=${Math.round(fps)} resolution=${frameWidth || '?'}x${frameHeight || '?'} interactive=${inputActive ? 1 : 0} jitterTarget=${jitterTargetMs}ms playoutBuf=${intervalJbMs}ms e2e~${e2eEstMs}ms target=${target} current=${current} reason=${reason} ice="${iceRoute || lastIceRouteRef.current || 'unknown'}"`);
                }

                // Network control samples at 500ms, but the toolbar does not
                // need to re-render the large session tree twice per second.
                // Keep control responsive while limiting UI telemetry to 1Hz.
                const healthUiNow = Date.now();
                if (healthUiNow - lastConnectionHealthUiAtRef.current >= 1000) {
                    lastConnectionHealthUiAtRef.current = healthUiNow;
                    const roundedFps = Math.round(fps);
                    setConnectionHealth((prev) => (
                        prev.rttMs === rttMs && prev.lossPct === lossPct && prev.fps === roundedFps
                            ? prev
                            : { rttMs, lossPct, fps: roundedFps }
                    ));
                }
            } catch (err) {
                console.warn('[Viewer] Adaptive stats failed:', err);
            }
        }, 500);
    };

    // Manual escape hatch for the toolbar's "Boost Connection" button: drop to
    // the lowest-bandwidth tier immediately instead of waiting on the adaptive
    // loop's loss-based detection, then let it re-evaluate normally from there.
    const boostConnection = () => {
        const channel = controlChannelRef.current;
        if (!channel || channel.readyState !== 'open') return;
        lastAdaptiveModeRef.current = 'smooth';
        channel.send(JSON.stringify({ type: 'stream-quality', mode: 'smooth', rttMs: connectionHealth.rttMs, lossPct: connectionHealth.lossPct, fps: connectionHealth.fps, reason: 'manual-boost' }));
        if (isElectron) (window as any).electronAPI?.log?.('[Viewer] Manual connection boost requested — forcing smooth tier.');
    };

    const handleLogout = async () => {
        await storeLogout();
        setAuth({} as any, '', '');
        setCurrentView('dashboard');
    };

    // The viewer window's tab strip "+" asks this window to show the Devices
    // list so another session can be started from here.
    useEffect(() => {
        if (!isElectron || isViewerWindow) return;
        const off = (window as any).electronAPI?.onNavigateRequest?.((view: string) => {
            if (view === 'devices') setCurrentView('devices');
        });
        return () => { if (typeof off === 'function') off(); };
    }, [isViewerWindow]);

    // asHost: the meeting was just created here, so the meeting window claims
    // the host seat (a signed-out creator used to wait for a host forever).
    const [meetingClaimHost, setMeetingClaimHost] = useState(false);
    const openMeeting = async (meetingId: string, options?: { asHost?: boolean }) => {
        const cleanMeetingId = String(meetingId || '').trim();
        if (!cleanMeetingId) return;
        if (isElectron && !isMeetingWindow && (window as any).electronAPI?.openMeetingWindow) {
            await (window as any).electronAPI.openMeetingWindow(cleanMeetingId, options?.asHost ? { asHost: true } : undefined);
            return;
        }
        setMeetingClaimHost(Boolean(options?.asHost));
        setActiveMeetingId(cleanMeetingId);
    };
    // The host window's minimise-on-session switch lives in renderer storage;
    // main is told at boot (and on change, see lib/hostPreferences).
    useEffect(() => { pushHostAutoMinimize(); }, []);

    // Show the device preview before entering a meeting (mic/camera choices made
    // here are persisted and honoured by SnowMeeting when it acquires media).
    const [pendingMeetingId, setPendingMeetingId] = useState<string | null>(null);
    const requestJoinMeeting = (meetingId: string) => {
        const cleanMeetingId = String(meetingId || '').trim();
        if (!cleanMeetingId) return;
        setPendingMeetingId(cleanMeetingId);
    };
    const lastClipboardRef = useRef<string>('');
    const clipboardChunksRef = useRef<Map<string, { chunks: string[]; received: number; total: number; origin: string }>>(new Map());
    const CLIPBOARD_CHUNK_SIZE = 32 * 1024;

    const readClipboardText = async () => {
        if (isElectron && (window as any).electronAPI?.clipboard?.readText) {
            return String(await (window as any).electronAPI.clipboard.readText() ?? '');
        }
        return String(await navigator.clipboard?.readText?.() ?? '');
    };

    const writeClipboardText = async (text: string) => {
        const value = String(text ?? '');
        if (isElectron && (window as any).electronAPI?.clipboard?.writeText) {
            await (window as any).electronAPI.clipboard.writeText(value);
            return;
        }
        await navigator.clipboard?.writeText?.(value);
    };

    const sendClipboardSync = (channel: RTCDataChannel, text: string, origin = 'desktop') => {
        const value = String(text ?? '');
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (value.length <= CLIPBOARD_CHUNK_SIZE) {
            channel.send(JSON.stringify({ type: 'clipboard-sync', id, origin, text: value }));
            return;
        }

        const totalChunks = Math.ceil(value.length / CLIPBOARD_CHUNK_SIZE);
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
            const chunk = value.slice(chunkIndex * CLIPBOARD_CHUNK_SIZE, (chunkIndex + 1) * CLIPBOARD_CHUNK_SIZE);
            channel.send(JSON.stringify({
                type: 'clipboard-chunk',
                id,
                origin,
                chunkIndex,
                totalChunks,
                text: chunk,
            }));
        }
    };

    const applyRemoteClipboardSync = async (text: string) => {
        const value = String(text ?? '');
        lastClipboardRef.current = value;
        await writeClipboardText(value);
    };

    const handleClipboardChunk = async (data: any) => {
        const id = String(data.id || '');
        const total = Number(data.totalChunks || 0);
        const chunkIndex = Number(data.chunkIndex);
        if (!id || !Number.isFinite(total) || total <= 0 || !Number.isFinite(chunkIndex)) return;

        let transfer = clipboardChunksRef.current.get(id);
        if (!transfer) {
            transfer = { chunks: new Array(total).fill(''), received: 0, total, origin: String(data.origin || 'remote') };
            clipboardChunksRef.current.set(id, transfer);
        }

        if (!transfer.chunks[chunkIndex]) {
            transfer.chunks[chunkIndex] = String(data.text ?? '');
            transfer.received += 1;
        }

        if (transfer.received === transfer.total) {
            clipboardChunksRef.current.delete(id);
            if (transfer.origin !== 'desktop') {
                await applyRemoteClipboardSync(transfer.chunks.join(''));
            }
        }
    };


    // --- New Device Management State ---
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    // ontrack delivers audio as a separate track, often after video. A ref lets
    // that handler fold the late track into the stream already playing without
    // reading state that may be stale inside the callback closure.
    const remoteStreamRef = useRef<MediaStream | null>(null);
    remoteStreamRef.current = remoteStream;
    // Bumped when a track joins the existing stream. The MediaStream keeps its
    // identity (so <video> never re-binds srcObject and the picture never
    // restarts), so this is what tells React to re-read getAudioTracks().
    // VideoPlayer is deliberately not memoized, so re-rendering App suffices.
    const [, setRemoteTrackRevision] = useState(0);
    // Pause the translation DOM sweep while a session is streaming; the 800ms
    // interval catches back up as soon as the session ends.
    useEffect(() => {
        translationPausedRef.current = !!remoteStream;
    }, [remoteStream]);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [topSearchQuery, setTopSearchQuery] = useState('');
    const [connectInitialTab, setConnectInitialTab] = useState<'id' | 'sessions'>('id');
    const [openCreateSessionSignal, setOpenCreateSessionSignal] = useState(0);
    const [openJoinSessionSignal, setOpenJoinSessionSignal] = useState(0);
    const [recentConnections, setRecentConnections] = useState<RecentConnection[]>([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [showUserDropdownHelp, setShowUserDropdownHelp] = useState(false);
    const [userPresence, setUserPresence] = useState<'online' | 'away' | 'busy' | 'invisible'>(() => {
        const saved = localStorage.getItem('remote365_presence');
        return ['online', 'away', 'busy', 'invisible'].includes(String(saved)) ? saved as any : 'online';
    });
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);

    const [showPasswordPrompt, setShowPasswordPrompt] = useState<any | null>(null); // { device }
    const [promptPassword, setPromptPassword] = useState('');
    const [promptRemember, setPromptRemember] = useState(true);
    const [promptError, setPromptError] = useState<string | null>(null);
    const [passwordUpdateKeys, setPasswordUpdateKeys] = useState<string[]>(getDevicesNeedingPasswordUpdate);
    // Access keys of devices this user currently has open viewer sessions to (live from
    // the main process). Drives the Devices page "In Active Session" count.
    const [activeViewerKeys, setActiveViewerKeys] = useState<string[]>([]);
    const [showPromptPassword, setShowPromptPassword] = useState(false);

    const [showAddModal, setShowAddModal] = useState(false);
    const [addDeviceError, setAddDeviceError] = useState('');
    const [isAddingDevice, setIsAddingDevice] = useState(false);
    useEffect(() => { if (!showAddModal) { setAddDeviceError(''); setIsAddingDevice(false); } }, [showAddModal]);
    const [addKey, setAddKey] = useState('');
    const [addPassword, setAddPassword] = useState('');
    const [addName, setAddName] = useState('');
    const [addGroup, setAddGroup] = useState('My Computers');
    const [addDescription, setAddDescription] = useState('');
    const [addRemember, setAddRemember] = useState(true);
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [accountDeviceGroups, setAccountDeviceGroups] = useState<any[]>([]);

    const syncServerPasswordUpdateFlags = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((device: any) => {
            // The server flag means "no trust row for this account" — which is a
            // password ROTATION only when passwordless access was expected here:
            // the device was remembered, it's our own device, or it's already
            // flagged. A device deliberately added without "Remember this
            // device" simply prompts on connect — no scary badge. And a machine
            // never connects to itself, so never badge the local row.
            if (device?.needs_password_update && !isLocalHostDevice(device)) {
                const expectedPasswordless = isDeviceRemembered(device.access_key)
                    || device?.is_owned
                    || deviceNeedsPasswordUpdate(device.access_key);
                if (expectedPasswordless) {
                    setPasswordUpdateKeys(markDeviceNeedsPasswordUpdate(device.access_key));
                }
            } else if (device?.needs_password_update === false) {
                // Server says this device is trusted again (the new password was
                // saved from any of this account's machines) — retire the badge
                // here as well instead of leaving a stale local flag.
                setPasswordUpdateKeys(clearDeviceNeedsPasswordUpdate(device.access_key));
            }
        });
    };

    const refreshRecentConnections = useCallback(() => {
        setRecentConnections(getRecentConnections(getRecentAccountKey(user)));
    }, [user?.email, user?.id]);

    const recordAccountRecentConnection = useCallback((accessKey: string, name?: string, avatar?: string | null) => {
        const next = recordRecentConnection(accessKey, name, avatar, getRecentAccountKey(user));
        setRecentConnections(next);
        return next;
    }, [user?.email, user?.id]);

    useEffect(() => {
        refreshRecentConnections();
    }, [refreshRecentConnections]);

    useEffect(() => {
        if (showAddModal && isAuthenticated) {
            loadAccountDeviceGroups();
        }
    }, [showAddModal, isAuthenticated]);

    const loadAccountDeviceGroups = async () => {
        const plan = String(user?.plan || '').toUpperCase();
        const canUseAccountGroups = ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(plan);
        if (!canUseAccountGroups) {
            setAccountDeviceGroups([]);
            return [];
        }

        try {
            const { data } = await api.get('/api/devices/user-groups');
            setAccountDeviceGroups(data.groups || []);
            return data.groups || [];
        } catch (err: any) {
            if (err?.response?.status === 401 || err?.response?.status === 403) {
                setAccountDeviceGroups([]);
                return [];
            }
            console.error('[Devices] Failed to load account groups:', err);
            return [];
        }
    };

    const getAccountGroupNames = () => Array.from(new Set([
        ...accountDeviceGroups.map((group: any) => group.name),
        ...devices.flatMap((d: any) => [
            ...((d.device_groups || []).map((group: any) => group.name))
        ])
    ].filter(Boolean))).sort((a: string, b: string) => a.localeCompare(b));

    const getAddGroupOptions = () => {
        const names = getAccountGroupNames().filter((name: string) => name.toLowerCase() !== 'my computers');
        if (addGroup.trim() && addGroup.trim().toLowerCase() !== 'my computers' && !names.some((name: string) => name.toLowerCase() === addGroup.trim().toLowerCase())) {
            names.unshift(addGroup.trim());
        }
        return ['My Computers', ...names];
    };

    // Mirrors the backend's devices:configure gate (per-user effective), which
    // decides whether name/tags may accompany an add-existing-device request.
    const canConfigureDeviceMetadata = () => hasUserPermission(user, 'devices:configure');

    const addExistingDevice = async (payload: any) => {
        const requestPayload = canConfigureDeviceMetadata()
            ? payload
            : (({ name: _name, tags: _tags, ...minimalPayload }) => minimalPayload)(payload);

        try {
            return await api.post('/api/devices/add-existing', requestPayload);
        } catch (err: any) {
            const message = String(err?.response?.data?.error || '').toLowerCase();
            const optionalMetadataRejected = err?.response?.status === 403
                && (requestPayload.name || requestPayload.tags)
                && (message.includes('configuration') || message.includes('configure'));

            if (!optionalMetadataRejected) throw err;

            const { name: _name, tags: _tags, ...minimalPayload } = requestPayload;
            return api.post('/api/devices/add-existing', minimalPayload);
        }
    };

    const ensureAccountDeviceGroup = async (name: string) => {
        const cleanName = name.trim();
        if (!cleanName || cleanName.toLowerCase() === 'my computers') return null;

        const groups = accountDeviceGroups.length > 0 ? accountDeviceGroups : await loadAccountDeviceGroups();
        const existing = groups.find((group: any) => group.name.toLowerCase() === cleanName.toLowerCase());
        if (existing) return existing;

        try {
            const created = await api.post('/api/devices/user-groups', { name: cleanName });
            setAccountDeviceGroups((prev) => [...prev, created.data.group].sort((a: any, b: any) => a.name.localeCompare(b.name)));
            return created.data.group;
        } catch (err: any) {
            if (err?.response?.status === 401 || err?.response?.status === 403) return null;
            // 409 = the name is already taken (our cached list was stale). Re-read
            // the groups and reuse the existing one instead of failing the add.
            if (err?.response?.status === 409) {
                const fresh = await loadAccountDeviceGroups();
                return fresh.find((group: any) => group.name.toLowerCase() === cleanName.toLowerCase()) || null;
            }
            throw err;
        }
    };

    const getDeviceAccessKey = (device: any) => String(device?.access_key || device?.accessKey || '').replace(/\D/g, '');
    const pendingAddedDevicesStorageKey = (userId?: string | null) => `remote365_pending_added_devices_${userId || 'default'}`;

    const getHiddenDeviceKeys = () => readHiddenDeviceKeys(user?.id);
    const setHiddenDeviceKeys = (keys: Set<string>) => writeHiddenDeviceKeys(user?.id, keys);

    /**
     * Archive state lives on the server (`settings.archivedBy`, exposed as
     * `is_archived`) so desktop and web agree. The local Set is kept as the
     * in-memory index that every existing device filter already reads — it is a
     * cache of the server's answer, not the source of truth.
     */
    // accessKey -> deviceId, built from the raw /mine payload. `devices` has
    // archived entries filtered out, so it can never resolve them for restore.
    const archiveIdIndexRef = useRef<Map<string, string>>(new Map());
    // Unfiltered /mine payload — the archive view needs real device rows, and
    // the filtered `devices` state has archived entries removed.
    const rawDeviceListRef = useRef<any[]>([]);
    const [showArchivedView, setShowArchivedView] = useState(false);

    const pushArchiveState = async (deviceId: string, archived: boolean) => {
        if (!deviceId) return;
        try {
            await api.post(`/api/devices/${deviceId}/archive`, { archived });
        } catch (error) {
            console.error('[Devices] Could not sync archive state:', error);
        }
    };

    /**
     * Reconcile the local cache with a freshly fetched device list, and migrate
     * anything archived locally before this was server-backed. Local-only keys
     * are pushed UP rather than dropped, so nobody's existing archive is lost
     * the first time they run this build.
     */
    const reconcileArchivedDevices = (list: any[]) => {
        // An EMPTY account list is a real answer too: it used to return early
        // here, so a stale cached key kept "Archived (1)" alive on an account
        // with zero devices.
        if (!Array.isArray(list)) return;
        rawDeviceListRef.current = list;
        const local = getHiddenDeviceKeys();
        const next = new Set<string>();
        for (const device of list) {
            const key = getDeviceAccessKey(device);
            if (!key) continue;
            if (device?.id) archiveIdIndexRef.current.set(key, device.id);
            if (Boolean((device as any).is_archived)) next.add(key);
        }
        // The payload is always the full /devices/mine list, so a cached key
        // whose device is no longer on the account (deleted, unlinked, or this
        // guest machine) is dropped instead of staying "archived" forever.
        if (local.size !== next.size || [...local].some((key) => !next.has(key))) {
            console.info("[Devices] Archive cache reconciled with the server (" + next.size + " archived).");
        }
        // READ-ONLY mirror — reconcile never writes archive state to the server.
        // The old local→server "migration" push meant any of the ~120 fleet
        // installs (every host app is logged into the same account) could
        // re-archive or fight state from a stale cache. Aug 12: an archive was
        // silently reverted within 49s by exactly such background pushes.
        // Archive/restore now ONLY happen from explicit user actions.
        setHiddenDeviceKeys(next);
    };

    const getPendingAddedDevices = () => {
        try {
            const raw = localStorage.getItem(pendingAddedDevicesStorageKey(user?.id));
            const values = raw ? JSON.parse(raw) : [];
            return Array.isArray(values) ? values : [];
        } catch {
            return [];
        }
    };

    const setPendingAddedDevices = (items: any[]) => {
        const seen = new Set<string>();
        const deduped = items.filter((device: any) => {
            const key = getDeviceAccessKey(device);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 20);
        localStorage.setItem(pendingAddedDevicesStorageKey(user?.id), JSON.stringify(deduped));
    };

    const rememberPendingAddedDevice = (device: any) => {
        const key = getDeviceAccessKey(device);
        if (!key) return;
        const pending = getPendingAddedDevices().filter((item: any) => getDeviceAccessKey(item) !== key);
        setPendingAddedDevices([{ ...device, _pending_added: true }, ...pending]);
    };

    const mergePendingAddedDevices = (list: any[]) => {
        const pending = getPendingAddedDevices();
        if (pending.length === 0) return list;

        const serverKeys = new Set(list.map((device: any) => getDeviceAccessKey(device)).filter(Boolean));
        const remainingPending = pending.filter((device: any) => !serverKeys.has(getDeviceAccessKey(device)));
        if (remainingPending.length !== pending.length) setPendingAddedDevices(remainingPending);
        return [...list, ...remainingPending];
    };

    // Deleting is the opposite of archiving: forget the key locally and clear
    // the server flag (only matters for a row that stays on the account, i.e.
    // this machine). Delete used to ARCHIVE as well, so the deleted device
    // reappeared under Archived Devices.
    const forgetArchivedDevice = async (device: any) => {
        const key = getDeviceAccessKey(device);
        const hiddenKeys = getHiddenDeviceKeys();
        const wasArchived = Boolean(key && hiddenKeys.delete(key));
        if (wasArchived) setHiddenDeviceKeys(hiddenKeys);
        setArchivedDevicesRefreshTick((tick) => tick + 1);
        if ((wasArchived || Boolean(device?.is_archived)) && device?.id) await pushArchiveState(device.id, false);
    };

    const hideDeviceFromList = (device: any) => {
        const key = getDeviceAccessKey(device);
        if (!key) return;
        const hiddenKeys = getHiddenDeviceKeys();
        hiddenKeys.add(key);
        setHiddenDeviceKeys(hiddenKeys);
        // Cache first so the row disappears immediately, then persist.
        void pushArchiveState(device?.id, true);
    };

    const unhideDeviceKey = (key: string) => {
        const cleanKey = String(key || '').replace(/\D/g, '');
        if (!cleanKey) return;
        const hiddenKeys = getHiddenDeviceKeys();
        if (!hiddenKeys.delete(cleanKey)) return;
        setHiddenDeviceKeys(hiddenKeys);
        // The cache is keyed by access key; the API by device id. Resolve it
        // from whichever list already holds the device.
        const resolvedId = archiveIdIndexRef.current.get(cleanKey)
            || (devices || []).find((d: any) => getDeviceAccessKey(d) === cleanKey)?.id;
        if (resolvedId) void pushArchiveState(resolvedId, false);
        else console.warn(`[Devices] Restore could not resolve a device id for ${cleanKey}; it may re-archive on refresh.`);
    };

    const getLocalHostKeys = () => new Set([
        localStorage.getItem('remote365_device_access_key'),
        hostAccessKey,
        localAuthKey,
        hostSessionId
    ].map((key) => String(key || '').replace(/\D/g, '')).filter(Boolean));

    const normalizeDeviceName = (name?: string | null) => String(name || '').trim().toLowerCase();

    const getLocalHostName = () => {
        const name = normalizeDeviceName(localStorage.getItem('remote365_device_name'));
        return name && name !== 'unknown machine' && name !== 'remote 365 device' ? name : '';
    };

    const isLocalHostDevice = (device: any) => {
        const deviceKey = getDeviceAccessKey(device);
        return Boolean(deviceKey && getLocalHostKeys().has(deviceKey));
    };

    const isLocalHostNamedDevice = (device: any) => {
        const localName = getLocalHostName();
        if (!localName) return false;
        const deviceName = normalizeDeviceName(device?.device_name || device?.name);
        return Boolean(deviceName && deviceName === localName);
    };

    const applyDeviceListVisibility = (list: any[]) => {
        if (!Array.isArray(list)) return [];
        const showCurrentDevice = localStorage.getItem('remote365_current_device_added_to_list') === 'true';
        // Set when the user deletes THIS machine from their list. It permanently
        // hides the local device without deregistering it (so it stays connectable).
        // Deliberately NOT keyed by user id — the per-user hiddenKeys set is read
        // before /auth/me finishes on reload, which let the machine slip back in.
        const localDeviceHidden = localStorage.getItem('remote365_local_device_hidden') === 'true';
        const localName = getLocalHostName();
        const hiddenKeys = getHiddenDeviceKeys();
        const seenIds = new Set<string>();
        const seenKeys = new Set<string>();

        return list.filter((device: any) => {
            const id = String(device?.id || '');
            const key = getDeviceAccessKey(device);
            if (id && seenIds.has(id)) return false;
            if (key && seenKeys.has(key)) return false;
            if (key && hiddenKeys.has(key)) return false;

            const isLocalKey = isLocalHostDevice(device);
            const isLocalName = localName && isLocalHostNamedDevice(device);
            const isAccountDevice = Boolean(device?.id || device?.is_owned);
            // Local machine hidden by the user → keep it out regardless of ownership.
            if (localDeviceHidden && (isLocalKey || isLocalName)) return false;
            if (!isAccountDevice && !showCurrentDevice && (isLocalKey || isLocalName)) return false;
            if (showCurrentDevice && isLocalName && !isLocalKey) return false;

            if (id) seenIds.add(id);
            if (key) seenKeys.add(key);
            return true;
        });
    };

    const upsertDeviceInList = (device: any) => {
        if (!device?.id && !getDeviceAccessKey(device)) return;
        setDevices(prev => {
            const deviceKey = getDeviceAccessKey(device);
            const exists = prev.some((item: any) => (device.id && item.id === device.id) || (deviceKey && getDeviceAccessKey(item) === deviceKey));
            const next = exists
                ? prev.map((item: any) => ((device.id && item.id === device.id) || (deviceKey && getDeviceAccessKey(item) === deviceKey)) ? { ...item, ...device } : item)
                : [device, ...prev];
            return applyDeviceListVisibility(next);
        });
    };

    const [contextMenuMsg, setContextMenuMsg] = useState(''); // Tooltip offline
    const [contextMenuId, setContextMenuId] = useState<string | null>(null);
    const [globalError, setGlobalError] = useState('');
    const [actionModal, setActionModal] = useState<{ type: 'rename' | 'password' | 'remove' | 'regenerate' | 'assign-group', device: any } | null>(null);
    const [showActionPassword, setShowActionPassword] = useState(false);
    const [actionValue, setActionValue] = useState('');
    const [actionError, setActionError] = useState('');

    useEffect(() => {
        if (currentView !== 'connect') {
            setConnectInitialTab('id');
            setOpenCreateSessionSignal(0);
            setOpenJoinSessionSignal(0);
        }
    }, [currentView]);

    useEffect(() => {
        // Wizard no longer auto-opens on login — user found it noisy. The
        // modal, steps, and completeOnboardingWizard are kept so a Help menu
        // entry can still trigger the tour on demand. Signing out still
        // dismisses it in case it was opened manually.
        if (!isAuthenticated || !user?.id) {
            setShowOnboardingWizard(false);
        }
    }, [isAuthenticated, user?.id]);

    const completeOnboardingWizard = () => {
        if (user?.id) localStorage.setItem(`remote365_onboarding_seen_${user.id}`, 'true');
        setShowOnboardingWizard(false);
        setOnboardingStep(0);
    };

    // --- Dynamic Notifications ---
    const [notifications, setNotifications] = useState<any[]>([
        { id: 'boot-security', action: 'Security scan completed.', time: 'Just Now', icon: ShieldCheck, color: 'bg-[#E6F1FD]', read: true },
        { id: 'boot-client', action: 'Client initialized.', time: 'Just Now', icon: Activity, color: 'bg-[#E6F1FD]', read: true },
    ]);
    const [activeSessionCount, setActiveSessionCount] = useState(0);

    const addNotification = (action: string, iconType: 'host' | 'security' | 'session' | 'system' | 'message' | 'accepted' | 'removed' | 'blocked' = 'system', title?: string, target?: any, options?: { id?: string }) => {
        const iconMap = {
            host: Radio,
            security: ShieldCheck,
            session: User,
            system: Activity,
            message: MessageCircle,
            accepted: UserCheck,
            removed: UserX,
            blocked: Ban
        };
        const colorMap = {
            host: 'bg-[#EDEEFC]',
            security: 'bg-[#E6F1FD]',
            session: 'bg-[#F2F2F2]',
            system: 'bg-[#E6F1FD]',
            message: 'bg-[#E6F1FD]',
            accepted: 'bg-emerald-50',
            removed: 'bg-orange-50',
            blocked: 'bg-red-50'
        };

        // Every entry opens the page it is about; callers may pass a more
        // specific target (a chat, a meeting, a session code).
        const defaultTarget: Record<string, any> = {
            host: { view: 'devices' },
            system: { view: 'devices' },
            security: { view: 'settings', tab: 'security' },
            session: { view: 'connect' },
            message: { view: 'chat' },
            accepted: { view: 'chat' },
            removed: { view: 'chat' },
            blocked: { view: 'chat' },
        };
        const resolvedTarget = target || defaultTarget[iconType] || null;
        const newNotif = {
            id: options?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title,
            action,
            time: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
            createdAt: Date.now(),
            kind: iconType,
            icon: iconMap[iconType],
            color: colorMap[iconType],
            read: false,
            target: resolvedTarget
        };
        setNotifications(prevAll => {
            // A fixed id (rolling entries such as the device-status summary)
            // replaces its previous version instead of stacking.
            const prev = options?.id ? prevAll.filter((item) => item.id !== options.id) : prevAll;
            // Identical lines inside a minute just refresh the newest one.
            const last = prev[0];
            if (last && last.action === action && last.title === title && Date.now() - (last.createdAt || 0) < 60000) {
                return [{ ...last, createdAt: Date.now(), time: newNotif.time, read: false }, ...prev.slice(1)];
            }
            return [newNotif, ...prev.slice(0, 9)];
        });
    };

    useEffect(() => {
        const handleSupportResolved = (event: Event) => {
            const detail = (event as CustomEvent).detail || {};
            addNotification(
                detail.message || 'Your support request has been resolved by a technician. Please review and confirm that the issue has been fixed.',
                'accepted',
                detail.title || 'Support Request Resolved',
                { view: 'end_user_home', sessionId: detail.sessionId }
            );
        };
        window.addEventListener('remote365:support-resolved', handleSupportResolved as EventListener);
        return () => window.removeEventListener('remote365:support-resolved', handleSupportResolved as EventListener);
    }, []);

    // Device status changes are summarised, not listed: with a fleet, one
    // line per online/offline event buried everything else ("test is now
    // online" ten times a minute). Changes are collected for a short window,
    // a device that flips back inside it cancels out, and ONE rolling entry
    // ("2 Devices Went Offline") is written or refreshed in place.
    const DEVICE_STATUS_ROLLUP_ID = 'device-status-rollup';
    const DEVICE_STATUS_WINDOW_MS = 45000;
    const deviceStatusRollupRef = useRef<{ changes: Map<string, { name: string; first: string; last: string }>; timer: ReturnType<typeof setTimeout> | null }>({ changes: new Map(), timer: null });
    const flushDeviceStatusRollup = () => {
        const rollup = deviceStatusRollupRef.current;
        rollup.timer = null;
        const offline: string[] = [];
        const online: string[] = [];
        for (const change of rollup.changes.values()) {
            if (change.first === change.last) continue; // flapped back: nothing to say
            (change.last === 'online' ? online : offline).push(change.name);
        }
        rollup.changes.clear();
        if (!offline.length && !online.length) return;
        const names = (list: string[]) => list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`;
        const parts: string[] = [];
        if (offline.length) parts.push(`Offline: ${names(offline)}`);
        if (online.length) parts.push(`Online: ${names(online)}`);
        const title = offline.length && !online.length
            ? (offline.length === 1 ? 'Device Went Offline' : `${offline.length} Devices Went Offline`)
            : online.length && !offline.length
                ? (online.length === 1 ? 'Device Came Online' : `${online.length} Devices Came Online`)
                : 'Device Status Changed';
        addNotification(parts.join(' · '), 'host', title, { view: 'devices' }, { id: DEVICE_STATUS_ROLLUP_ID });
    };
    const queueDeviceStatusChange = (name: string, status: string) => {
        const rollup = deviceStatusRollupRef.current;
        const key = String(name || '').trim() || 'Device';
        const existing = rollup.changes.get(key);
        const normalized = status === 'online' ? 'online' : 'offline';
        if (existing) existing.last = normalized;
        else rollup.changes.set(key, { name: key, first: normalized === 'online' ? 'offline' : 'online', last: normalized });
        if (!rollup.timer) rollup.timer = setTimeout(flushDeviceStatusRollup, DEVICE_STATUS_WINDOW_MS);
    };

    const handleNotificationClick = (notification: any) => {
        setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));
        setShowNotifications(false);

        if (notification.target?.view === 'chat') {
            setCurrentView('chat' as any);
            if (notification.target.chatId) {
                useChatStore.getState().setActiveChat(notification.target.chatId);
            }
        } else if (notification.target?.view === 'connect') {
            if (notification.target.sessionCode) {
                handleJoinSessionInvite(notification.target.sessionCode, notification.target.sessionPassword);
            } else {
                setCurrentView('connect');
            }
        } else if (notification.target?.view === 'meeting') {
            setCurrentView('meetings' as any);
            requestJoinMeeting(notification.target.meetingId);
        } else if (notification.target?.view === 'end_user_home') {
            setCurrentView('end_user_home');
        } else if (notification.target?.view === 'devices') {
            setCurrentView('devices');
        } else if (notification.target?.view === 'meetings') {
            setCurrentView('meetings' as any);
        } else if (notification.target?.view === 'settings') {
            setCurrentView('settings' as any);
        } else if (notification.target?.view === 'support') {
            setCurrentView('support' as any);
        }
    };

    // Sync actionValue when modal opens
    useEffect(() => {
        if (actionModal) {
            setActionError('');
            if (actionModal.type === 'rename') setActionValue(actionModal.device?.device_name || '');
            else if (actionModal.type === 'password') setActionValue('');
            else setActionValue('');
        }
    }, [actionModal]);

    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            if (contextMenuId) setContextMenuId(null);
            if (showUserDropdown && userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
                setShowUserDropdown(false);
                setShowUserDropdownHelp(false);
            }
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [contextMenuId, showUserDropdown]);

    const cleanupViewerConnection = () => {
        if (adaptiveStatsIntervalRef.current) {
            window.clearInterval(adaptiveStatsIntervalRef.current);
            adaptiveStatsIntervalRef.current = null;
        }
        [controlChannelRef, inputChannelRef, criticalInputChannelRef].forEach((channelRef) => {
            try { channelRef.current?.close(); } catch { }
            channelRef.current = null;
        });
        setSessionFileChannel(null);
        compactInputSupportedRef.current = false;
        // Release the talk-back mic so the OS mic indicator clears on disconnect.
        if (talkStreamRef.current) {
            talkStreamRef.current.getTracks().forEach((t) => t.stop());
            talkStreamRef.current = null;
        }
        talkSenderRef.current = null;
        setTalkActive(false);
        try { pcRef.current?.close(); } catch { }
        pcRef.current = null;
        candidatesBuffer.current = [];
        videoReceiverRef.current = null;
        setRemoteStream(null);
        setControlStatus('denied');
        setRemoteCursor(null);
        setRemoteWhiteboardEvent(null);
        setRemoteChatEvent(null);
        setFileTransferStatus(null);
    };

    const handleDisconnect = () => {
        reconnectingViewerRef.current = false;
        cleanupViewerConnection();
        setViewerStatus('idle');
        pollDevices();
    };

    const endViewerSession = () => {
        const leavingMessage = JSON.stringify({ type: 'viewer-disconnect' });
        const leavingChannel = controlChannelRef.current || inputChannelRef.current || criticalInputChannelRef.current;
        if (leavingChannel?.readyState === 'open') {
            try { leavingChannel.send(leavingMessage); } catch { }
        }
        handleDisconnect();
        if (isViewerWindow) {
            const params = new URLSearchParams(window.location.search);
            const sid = params.get('sessionId') || sessionCode.replace(/\s/g, '');
            (window as any).electronAPI?.closeViewerTab?.(sid);
            window.setTimeout(() => {
                try { window.close(); } catch { }
            }, 80);
        }
    };

    // Initialize Viewer Window from URL - runs only once on true mount
    const viewerConnectedRef = useRef(false);
    const hasAutoStartedHost = useRef(false);
    const manuallyStoppedHost = useRef(false);
    // Backoff state for automatic host starts. An automatic start that fails must
    // keep trying by itself — the machine being unreachable is the bug we are
    // fixing, and there may be nobody in front of the screen to retry it.
    const autoHostRetryCount = useRef(0);
    const autoHostRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!isMeetingWindow) return;
        const params = new URLSearchParams(window.location.search);
        const meetingId = params.get('meetingId') || params.get('code') || '';
        setMeetingClaimHost(params.get('host') === '1');
        if (meetingId) setActiveMeetingId(meetingId);
        setLoading(false);
    }, [isMeetingWindow]);

    useEffect(() => {
        if (!isHostWaitWindow) return;
        setLoading(false);
        const eAPI = (window as any).electronAPI;
        const unsub = eAPI?.onSessionWaitParticipantJoined?.(() => {
            window.close();
        });
        return () => unsub?.();
    }, [isHostWaitWindow]);

    useEffect(() => {
        if (viewerConnectedRef.current) return; // Guard for React Strict Mode double-fire
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'viewer') {
            viewerConnectedRef.current = true;
            const sid = params.get('sessionId') || '';
            const sip = normalizeServerHost(params.get('serverIP') || DEFAULT_SERVER_HOST);
            const tok = params.get('token') || '';
            const dname = params.get('deviceName') || '';
            const dtype = params.get('deviceType') || '';

            setSessionCode(sid);
            setServerIP(sip);
            setAuth({ id: 'viewer', email: 'node.viewer@connect-x.io', name: 'Viewer', plan: 'FREE', role: 'VIEWER', organizationId: null, avatar: null }, tok, '', false);
            if (isElectron) localStorage.setItem('viewer_token', tok);
            setWindowDeviceName(dname);
            setWindowDeviceType(dtype);

            console.log(`[Window] Launched in Viewer Mode for Node: ${sid}`);
            console.log(`[Window] Joining with Persistent ID: ${viewerClientId}`);

            setViewerStatus('connecting');
            viewerPipelineTimelineRef.current = {
                startedAt: Date.now(),
                offerAt: 0,
                connectedAt: 0,
                trackAt: 0,
            };
            firstFramePresentedRef.current = false;
            lastAdaptiveModeRef.current = 'balanced';
            lastIceRouteRef.current = '';
            lastIceRouteTopologyRef.current = '';
            void fetchIceServers(); // warm the cache so the offer handler doesn't block on it
            if (isElectron) {
                (window as any).electronAPI.connectToHost(sid, sip, tok, viewerClientId, String(localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, '')).then(() => {
                    // We wait for the 'joined' signaling message before setting connected status
                    console.log('[Viewer] Signaling link established. Waiting for session join confirmation...');
                }).catch((e: any) => {
                    viewerConnectedRef.current = false; // Allow retry on error
                    showError('Mesh Fault', e.message || 'The secure connection could not be established.');
                });
            } else {
                showError('Browser Limitation', 'Mesh connections require the native desktop application.');
                setViewerStatus('error');
            }
        }
    }, []); // Empty deps: only run once on mount

    useEffect(() => {
        if (!isElectron) return;
        // Request notification permission on first load
        if (Notification.permission === 'default') Notification.requestPermission();

        const removeHostStatusListener = (window as any).electronAPI.onHostStatus((status: string) => {
            console.log(`[Renderer] Host Status: ${status}`);
            if (status.startsWith('Registered:') || status.startsWith('Online:')) {
                const sid = status.replace(/^Registered:\s*/, '').replace(/^Online:\s*/, '').replace(/\D/g, '');
                if (sid) {
                    localStorage.setItem('remote365_device_access_key', sid);
                    setHostAccessKey(sid);
                    setLocalAuthKey(sid);
                    setHostSessionId(sid);
                }
                setHostStatus('status');
            } else if (status.startsWith('WebRTC:')) {
                setHostStatus('status');
                // Viewer just connected. Both the legacy notify pref and
                // Settings → Device management → "Notify Me When Accessed" gate it.
                if (localStorage.getItem('pref_notify_session') !== 'false' && localStorage.getItem('pref_dm_notify_access') !== 'false') {
                    fireNotification('Remote Session Started', 'Someone is now viewing this computer.', 'session');
                }
                playUISound('connect');
            } else if (status === 'error' || status === 'disconnected') {
                setHostStatus('idle');
                // Unexpected disconnect
                if (localStorage.getItem('pref_notify_disconnect') !== 'false') {
                    fireNotification('Remote Session Ended', 'The viewer disconnected from this computer.', 'session');
                }
                playUISound('disconnect');
                if (!manuallyStoppedHost.current) {
                    setTimeout(() => handleStartHosting(undefined, { silent: true }), 5000);
                }
            }
        });

        // Auto-host on mount logic moved to reactive effect

        return () => removeHostStatusListener();
    }, [isElectron]);

    const pollDevices = async (showLoader = false) => {
        if (!isAuthenticated) return;
        if (showLoader) setIsRefreshing(true);
        try {
            const endpoint = '/api/devices/mine';
            const { data } = await api.get(endpoint);
            syncServerPasswordUpdateFlags(data);
            // Reconcile the archive cache from the server BEFORE applying it:
            // applyDeviceListVisibility filters with the cached set, so running
            // it first hid a device that had just been restored elsewhere (web,
            // another install) until the NEXT poll — "I unarchived it but it
            // did not show up in the devices list".
            reconcileArchivedDevices(data);
            setDevices(applyDeviceListVisibility(mergePendingAddedDevices(data)));
            setGlobalError('');

            // Auto-sync local host status if we find ourselves in the list as online

            // BUT: Don't override if we just manually clicked 'Stop' and the server is lagging.
            const self = data.find((d: any) => d.access_key === hostAccessKey);
            if (self && self.is_online && !manuallyStoppedHost.current) {
                setHostStatus('status');
                setHostSessionId(self.access_key);
            }
        } catch (e: any) {
            if ((e.response?.status === 401 || e.response?.status === 403) && !isViewerWindow) {
                // Token expired, role changed, or refresh failed — log out to reset state
                handleLogout();
            }
        } finally {
            if (showLoader) setIsRefreshing(false);
        }
    };

    const getArchivedDeviceKeys = () => Array.from(getHiddenDeviceKeys());

    const restoreArchivedDevices = async () => {
        // Server first, THEN refetch — concurrent fire let the refetch win and
        // re-archive everything from the server's stale answer.
        const pending: Promise<void>[] = [];
        for (const key of getHiddenDeviceKeys()) {
            const id = archiveIdIndexRef.current.get(key);
            if (id) pending.push(pushArchiveState(id, false));
        }
        setHiddenDeviceKeys(new Set());
        setArchivedDevicesRefreshTick((tick) => tick + 1);
        await Promise.allSettled(pending);
        pollDevices(true);
    };

    const restoreSingleArchivedDevice = async (device: any) => {
        const cleanKey = getDeviceAccessKey(device);
        const hiddenKeys = getHiddenDeviceKeys();
        hiddenKeys.delete(cleanKey);
        setHiddenDeviceKeys(hiddenKeys);
        setArchivedDevicesRefreshTick((tick) => tick + 1);
        // AWAIT the server before refetching: firing both concurrently let the
        // GET beat the POST, and the reconcile re-archived the row from the
        // server's stale answer — which read as "Restore Does Nothing".
        const resolvedId = device?.id || archiveIdIndexRef.current.get(cleanKey);
        if (resolvedId) await pushArchiveState(resolvedId, false);
        await pollDevices(true);
    };

    const deleteArchivedDevices = () => {
        setHiddenDeviceKeys(new Set());
        setArchivedDevicesRefreshTick((tick) => tick + 1);
        setShowArchivedDevicesModal(false);
    };

    const compareVersionStrings = (a?: string | null, b?: string | null) => {
        const pa = String(a || '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
        const pb = String(b || '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i += 1) {
            if ((pa[i] || 0) > (pb[i] || 0)) return 1;
            if ((pa[i] || 0) < (pb[i] || 0)) return -1;
        }
        return 0;
    };

    const formatReleaseDate = (value?: string | null) => {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        const dateTime = new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
        const offsetMinutes = -date.getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const absoluteMinutes = Math.abs(offsetMinutes);
        const hours = Math.floor(absoluteMinutes / 60);
        const minutes = absoluteMinutes % 60;
        const timezone = minutes ? `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}` : `GMT${sign}${hours}`;
        return `${dateTime} ${timezone}`;
    };

    const openUpdateCheckModal = async () => {
        setShowUpdateCheckModal(true);
        setUpdateCheckBusy(true);
        setUpdateCheckMessage('Checking For Updates...');
        const electronApi = (window as any).electronAPI;
        try {
            const [installedVersion, latestInfo] = await Promise.all([
                electronApi?.getAppVersion?.().catch(() => null),
                electronApi?.updates?.getLatestInfo?.().catch(() => null),
            ]);
            if (electronApi?.updates?.check) {
                await electronApi.updates.check().catch(() => null);
            }
            const latestVersion = latestInfo?.version;
            if (latestVersion && installedVersion && compareVersionStrings(latestVersion, installedVersion) > 0) {
                setUpdateCheckMessage(`Remote365 ${latestVersion} is available.`);
            } else {
                setUpdateCheckMessage('Your version of Remote365 is up-to-date.');
            }
        } catch (error: any) {
            setUpdateCheckMessage(error?.message || 'Unable to check for updates right now.');
        } finally {
            setUpdateCheckBusy(false);
        }
    };

    const openSupportIdentifierModal = async () => {
        setShowSupportIdentifierModal(true);
        const electronApi = (window as any).electronAPI;
        try {
            const version = await electronApi?.getAppVersion?.().catch(() => null);
            setSupportIdentifierVersion(version || '--');
        } catch {
            setSupportIdentifierVersion('--');
        }
    };

    const openAboutRemoteModal = async () => {
        setShowAboutRemoteModal(true);
        const electronApi = (window as any).electronAPI;
        try {
            const [version, latestInfo] = await Promise.all([
                electronApi?.getAppVersion?.().catch(() => null),
                electronApi?.updates?.getLatestInfo?.().catch(() => null),
            ]);
            setSupportIdentifierVersion(version || latestInfo?.version || '--');
            setAboutReleaseDate(formatReleaseDate(latestInfo?.releaseDate));
        } catch {
            setSupportIdentifierVersion('--');
            setAboutReleaseDate('--');
        }
    };

    const openFileLogs = async () => {
        const electronApi = (window as any).electronAPI;
        try {
            if (!electronApi?.openLogsFolder) {
                showError('Logs Unavailable', 'File logs can only be opened from the desktop app.');
                return;
            }
            await electronApi.openLogsFolder();
        } catch (error: any) {
            showError('Unable To Open Logs', error?.message || 'Remote365 could not open the logs folder.');
        }
    };

    useEffect(() => {
        if (!isAuthenticated || isViewerWindow || !canViewPlatformAnalytics(user?.role)) {
            setAnalyticsSummary(null);
            return;
        }

        api.get('/api/analytics/summary').then(res => {
            setAnalyticsSummary(res.data);
        }).catch(e => {
            if (e?.response?.status === 401 || e?.response?.status === 403) {
                setAnalyticsSummary(null);
                return;
            }
            console.error('[Analytics] Failed to fetch background summary:', e);
        });
    }, [isAuthenticated, isViewerWindow, user?.role, currentView]);

    useEffect(() => {
        if (!isAuthenticated || (!accessToken && !isViewerWindow)) return;

        let monitor: WebSocket | null = null;
        let reconnectTimeout: any = null;
        let monitorDisposed = false;
        let deviceSyncTimer: ReturnType<typeof setTimeout> | null = null;
        let retryCount = 0;

        const connect = () => {
            const wsUrl = buildSignalUrl(serverIP);
            monitor = new WebSocket(wsUrl);
            monitorWsRef.current = monitor;

            monitor.onopen = () => {
                console.log('[Monitor] Presence WebSocket connected.');
                retryCount = 0; // Reset on success
                pollDevices(); // Immediate sync on connect
                const clientMetaPromise = Promise.resolve((window as any).electronAPI?.getAppVersion?.())
                    .catch(() => undefined)
                    .then((appVersion) => ({
                        clientKind: 'desktop-presence',
                        appVersion,
                        platform: navigator.platform,
                    }));

                // Register this socket under the signed-in user. Presence/org
                // subscriptions are keyed by device/org, but account-sync pushes
                // (devices password-updated, billing, features) are delivered
                // per-user — without this registration they never reach this
                // socket and the Devices page only catches up on manual reload.
                if (accessToken) {
                    clientMetaPromise.then((meta) => {
                        if (monitor?.readyState === WebSocket.OPEN) {
                            monitor.send(JSON.stringify({ type: 'authenticate-chat', token: accessToken, ...meta }));
                        }
                    });
                }

                if (devices.length > 0) {
                    const keys = devices.map((d: any) => String(d.access_key || '').toLowerCase().replace(/\s/g, ''));
                    clientMetaPromise.then((meta) => {
                        if (monitor?.readyState === WebSocket.OPEN) {
                            monitor.send(JSON.stringify({ type: 'subscribe-presence', accessKeys: keys, ...meta }));
                        }
                    });
                }

                // Subscribe to Org Updates for real-time team management
                if (user?.organizationId) {
                    clientMetaPromise.then((meta) => {
                        if (monitor?.readyState === WebSocket.OPEN) {
                            monitor.send(JSON.stringify({ type: 'subscribe-org', organizationId: user.organizationId, ...meta }));
                        }
                    });
                }
            };

            monitor.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'ping') {
                        monitor?.send(JSON.stringify({ type: 'pong' }));
                    } else if (data.type === 'presence-update') {
                        const incomingId = String(data.sessionId || '').toLowerCase().replace(/\s/g, '');
                        setDevices(prev => {
                            const deviceMatch = prev.find(d => String(d.access_key || '').toLowerCase().replace(/\s/g, '') === incomingId);
                            if (deviceMatch && deviceMatch.is_online !== (data.status === 'online')) {
                                queueDeviceStatusChange(deviceMatch.device_name, String(data.status || ''));
                            }
                            return prev.map(d => {
                                const localId = String(d.access_key || '').toLowerCase().replace(/\s/g, '');
                                return localId === incomingId ? { ...d, is_online: data.status === 'online' } : d;
                            });
                        });
                    } else if (data.type === 'session-status') {
                        // A device entered/left an exclusive remote session — reflect it live so
                        // the Devices "Activity" column and the Connect button update immediately.
                        const incomingId = String(data.sessionId || '').toLowerCase().replace(/\s/g, '');
                        setDevices(prev => prev.map(d => {
                            const localId = String(d.access_key || '').toLowerCase().replace(/\s/g, '');
                            return localId === incomingId ? { ...d, in_session: Boolean(data.inSession) } : d;
                        }));
                    } else if (data.type === 'global-stats') {
                        setActiveSessionCount(data.activeSessions || 0);
                    } else if (data.type === 'team-update') {
                        console.log('[Monitor] Real-time team update received:', data.payload);
                        // Dispatch a custom event to notify SnowMembers or other components
                        window.dispatchEvent(new CustomEvent('team-refresh'));
                    } else if (data.type === 'account-sync') {
                        if (data.scope === 'remote-sessions' || data.scope === 'meetings') {
                            window.dispatchEvent(new CustomEvent('remote365:remote-sessions-changed', { detail: data }));
                        } else if (data.scope === 'devices') {
                            // Coalesce bursts. A bulk change on the server fans out as
                            // one event per device, and each used to trigger a full
                            // device-list + groups download immediately.
                            if (deviceSyncTimer) clearTimeout(deviceSyncTimer);
                            deviceSyncTimer = setTimeout(() => {
                                deviceSyncTimer = null;
                                pollDevices();
                                loadAccountDeviceGroups();
                            }, 1500);
                        } else if (data.scope === 'billing') {
                            // Plan changed (upgrade/downgrade/cancel) — refresh plan state
                            // everywhere without an app reload. user.plan drives the profile
                            // badge, sidebar plan card, and member limits; the license store
                            // drives the trial countdown/lock; open billing pages listen for
                            // the event to refetch their own data.
                            useAuthStore.getState().checkAuth();
                            useLicenseStore.getState().refresh();
                            window.dispatchEvent(new CustomEvent('remote365:billing-changed', { detail: data }));
                        } else if (data.scope === 'features') {
                            // Owner changed what this role can see — re-pull /me so
                            // user.features updates and the sidebar/settings re-gate live.
                            useAuthStore.getState().checkAuth();
                            window.dispatchEvent(new CustomEvent('remote365:features-changed', { detail: data }));
                        } else if (data.scope === 'account') {
                            // An org admin deactivated or permanently deleted this
                            // account — sign out on the spot and explain why on the
                            // login screen (login itself is also blocked server-side).
                            const message = data.message || 'Your access has been removed by your organization.';
                            useAuthStore.getState().logout();
                            setAuthError(message);
                            setAuthMode('login');
                        }
                    } else if (data.type === 'device-report') {
                        // A viewer reported a device problem — surface it to this
                        // owner/admin as an in-app notification + toast.
                        const who = data.reporterName || 'A Team Member';
                        const dev = data.deviceName || 'a device';
                        const title = 'Device Problem Reported';
                        const preview = `${who} reported an issue on ${dev}: ${data.message || ''}`.trim();
                        pushSlidingToast(title, preview, { view: 'devices' }, 'system');
                        addNotification(preview, 'system', title, { view: 'devices' });
                        fireNotification(title, preview);
                    }
                } catch (err) {
                    console.error('[Monitor] Message parse error:', err);
                }
            };

            const thisSocket = monitor;
            monitor.onclose = () => {
                // This effect instance was torn down (token refresh, server
                // change, sign-out). Without this guard close() in the cleanup
                // fired onclose AFTER the cleanup ran and scheduled connect()
                // from a dead closure: one orphan socket per re-run, each
                // reconnecting forever, refetching the device list on open and
                // receiving every presence broadcast.
                if (monitorDisposed) return;
                console.log('[Monitor] Presence WebSocket closed. Retrying...');
                if (monitorWsRef.current === thisSocket) monitorWsRef.current = null;
                // Exponential backoff: 2s, 4s, 8s... max 30s
                const delay = Math.min(Math.pow(2, retryCount) * 1000, 30000);
                reconnectTimeout = setTimeout(() => {
                    retryCount++;
                    connect();
                }, delay);
            };

            monitor.onerror = (err) => {
                console.error('[Monitor] Presence WebSocket error:', err);
                monitor?.close();
            };
        };

        connect();

        const handleFocus = () => pollDevices();
        window.addEventListener('focus', handleFocus);

        return () => {
            monitorDisposed = true;
            if (deviceSyncTimer) clearTimeout(deviceSyncTimer);
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (monitor) {
                monitor.onclose = null;
                monitor.onerror = null;
                monitor.onmessage = null;
                monitor.onopen = null;
                try { monitor.close(); } catch { /* already closed */ }
            }
            monitorWsRef.current = null;
            window.removeEventListener('focus', handleFocus);
        };
    }, [isAuthenticated, accessToken, serverIP, isViewerWindow]);

    // Reactive subscription update: Whenever 'devices' list changes, refresh the monitor's watch list
    useEffect(() => {
        const monitor = monitorWsRef.current;
        if (monitor && monitor.readyState === WebSocket.OPEN && devices.length > 0) {
            const keys = devices.map((d: any) => String(d.access_key || '').toLowerCase().replace(/\s/g, ''));
            Promise.resolve((window as any).electronAPI?.getAppVersion?.())
                .catch(() => undefined)
                .then((appVersion) => {
                    if (monitor.readyState === WebSocket.OPEN) {
                        monitor.send(JSON.stringify({
                            type: 'subscribe-presence',
                            accessKeys: keys,
                            clientKind: 'desktop-presence',
                            appVersion,
                            platform: navigator.platform,
                        }));
                    }
                });
        }
    }, [devices.length]); // Only re-subscribe if device list count changes (optimization)

    // Handlers for the UI
    const handleDeviceClick = async (device: any) => {
        if (!device.is_online) {
            // Wake-on-LAN: if this device opted in and we have its MAC, broadcast a
            // magic packet (only wakes it when we're on the same network segment).
            const wolMac = device?.settings?.wolEnabled ? device?.settings?.wolMac : '';
            if (wolMac && isElectron && (window as any).electronAPI?.net?.wake) {
                (window as any).electronAPI.net.wake(wolMac).catch(() => {});
                pushSlidingToast('Waking Device', `Wake packet sent to ${device.device_name}. It usually comes online within a minute.`, undefined, 'system');
                addNotification(`Wake packet sent to ${device.device_name}. It usually comes online within a minute.`, 'system', 'Wake-on-LAN');
                return;
            }
            showError('Endpoint Unreachable', `${device.device_name} is currently offline. Please ensure the host service is running.`);
            return;
        }

        const key = String(device.access_key || '').replace(/\s/g, '');
        if (device?.needs_password_update || passwordUpdateKeys.includes(key)) {
            setShowPasswordPrompt(device);
            setPromptPassword('');
            setPromptRemember(true);
            setPromptError('This device password changed. Enter the new password to reconnect.');
            setPasswordUpdateKeys(markDeviceNeedsPasswordUpdate(device.access_key));
            return;
        }

        // Attempt direct connection bypass
        try {
            const { data } = await api.post('/api/devices/verify-access', { accessKey: device.access_key, password: '' });
            // Launch in NEW WINDOW
            if (isElectron) {
                await (window as any).electronAPI.openViewerWindow(device.access_key, serverIP, data.token, device.device_name, device.device_type);
            }
            // Connected without a password (owner / trusted / Easy Access). Remember that
            // this device is passwordless for us, and drop any stale "update password" flag.
            markDeviceRemembered(device.access_key);
            setPasswordUpdateKeys(clearDeviceNeedsPasswordUpdate(device.access_key));
            // Devices-page sessions are NOT added to Quick Connect's recent list;
            // that list only tracks devices connected to by ID.
        } catch (e: any) {
            if (e.response?.status === 401) {
                const key = String(device.access_key || '').replace(/\s/g, '');
                // Only call it a "password change" when we previously connected to this
                // device WITHOUT a prompt (Remember this machine / Easy Access) and now
                // can't — that means the host rotated its password and our trust was
                // dropped. A device we never remembered simply needs its password each
                // time (e.g. "Remember This Machine" was left unchecked), so we show a
                // plain prompt without the alarming "changed" wording.
                const wasPasswordless = isDeviceRemembered(device.access_key) || passwordUpdateKeys.includes(key);
                setShowPasswordPrompt(device);
                setPromptPassword('');
                setPromptRemember(true);
                if (wasPasswordless) {
                    setPasswordUpdateKeys(markDeviceNeedsPasswordUpdate(device.access_key));
                    setPromptError('This device’s password changed. Enter the new password to reconnect.');
                } else {
                    setPromptError(null);
                }
            } else {
                showError('Handshake Failed', e.response?.data?.error || e.message || 'The secure connection could not be established.');
            }
        }
    };

    // A device chip mentioned in chat ("@Device") was clicked: connect to that
    // device. handleDeviceClick first tries verify-access with no password,
    // which only succeeds when this account has the device's password saved
    // (trusted/passwordless); otherwise the password prompt opens. Devices not
    // in our list go through the standard connect-by-ID flow with the same
    // saved-credential check server-side.
    const handleOpenDeviceMention = (accessKey: string, _name?: string) => {
        const clean = String(accessKey || '').replace(/\s/g, '');
        if (!clean) return;
        const device = devices.find((d: any) => String(d.access_key || '').replace(/\s/g, '') === clean);
        if (device) {
            handleDeviceClick(device);
            return;
        }
        handleFindDevice(clean);
    };

    const handleBulkDelete = async (ids: string[]) => {
        try {
            const removedDevices = devices.filter((device: any) => ids.includes(device.id));
            const removedLocalHost = removedDevices.some((device: any) => isLocalHostDevice(device));
            // Deleting is not archiving (see handleRemove).
            await Promise.all(removedDevices.map(forgetArchivedDevice));
            await Promise.all(ids.map(id => api.delete(`/api/devices/${id}`)));
            if (removedLocalHost) localStorage.removeItem('remote365_current_device_added_to_list');
            setDevices(prev => applyDeviceListVisibility(prev.filter((device: any) => !ids.includes(device.id))));
            await pollDevices();
            setGlobalError(`Successfully removed ${ids.length} devices.`);
        } catch (e: any) {
            setGlobalError('Failed To Remove Some Devices: ' + e.message);
        }
    };

    const submitPasswordPrompt = async () => {
        if (!showPasswordPrompt || !promptPassword) return;
        const device = showPasswordPrompt;
        setViewerStatus('connecting');
        setPromptError(null);
        try {
            const { data } = await api.post('/api/devices/verify-access', { accessKey: device.access_key, password: promptPassword });
            // Correct password — drop any "update password" flag for this device.
            setPasswordUpdateKeys(clearDeviceNeedsPasswordUpdate(device.access_key));
            // Honor "Remember This Machine": when checked we persist trust (server) and
            // remember it locally so a later password rotation surfaces as "changed".
            // When unchecked we forget it, so the password is requested again next time.
            if (promptRemember) {
                markDeviceRemembered(device.access_key);
                // "Remember" only persists passwordless reconnect (trust) for a device
                // that's ALREADY in the table. It must never add a new device — Quick
                // Connect stays ephemeral; saving a device is an explicit "Add Device".
                if (device.id) await api.post(`/api/devices/${device.id}/trust`);
            } else {
                clearDeviceRemembered(device.access_key);
            }
            if (isElectron) {
                await (window as any).electronAPI.openViewerWindow(device.access_key, serverIP, data.token, device.device_name, device.device_type);
            }
            // This modal serves both the Devices page and Quick Connect. Only a
            // Quick Connect (by-ID) session belongs in Quick Connect's recent list.
            if (device.source === 'quick-connect') {
                recordAccountRecentConnection(device.access_key, device.device_name || device.name || undefined, device.avatar || null);
            }
            setViewerStatus('idle');
            setShowPasswordPrompt(null);
            setPromptError(null);
        } catch (e: any) {
            setViewerStatus('idle');
            const status = e?.response?.status;
            if (status === 401) {
                // Wrong password — the host likely changed it. Flag the device row and
                // keep the prompt open with an inline hint so the user can update it.
                setPasswordUpdateKeys(markDeviceNeedsPasswordUpdate(device.access_key));
                setPromptError('Incorrect password. The host may have changed it — enter the new password.');
            } else {
                setPromptError(e.response?.data?.error || e.message || 'Connection failed.');
            }
        }
    };

    const handleAddDevice = async () => {
        setAddDeviceError('');
        const localKey = String(localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, '');
        const requestedKey = String(addKey || '').replace(/\D/g, '');
        if (localKey && requestedKey === localKey) {
            setAddDeviceError('That ID belongs to this computer. Use "Add This Device" instead.');
            return;
        }
        if (!requestedKey) {
            setAddDeviceError('Please enter the Remote365 ID.');
            return;
        }
        // Password is optional: a device with Easy Access (no password required) can be
        // added with just its ID. If the device does require one, the backend returns 401
        // and we surface a prompt to enter it (see explainCredentialError below).

        // Turn a failed add/verify response into an inline prompt (and toast) so the
        // user can correct the ID/password without the modal closing on them.
        const explainCredentialError = (err: any): boolean => {
            const status = err?.response?.status;
            const msg = String(err?.response?.data?.error || '');
            if (status === 401 || /incorrect password|password required/i.test(msg)) {
                if (!addPassword.trim()) {
                    // They added with just the ID, but this device isn't on Easy Access.
                    setAddDeviceError('This device requires a password. Enter it and try again.');
                    toast.error('This Device Requires A Password');
                } else {
                    setAddDeviceError('Incorrect password. Please enter the correct password and try again.');
                    toast.error('Please Enter The Correct Password');
                }
                return true;
            }
            if (status === 404) {
                setAddDeviceError("We couldn't find a device with that ID. Double-check the Remote365 ID.");
                toast.error('Device ID Not Found');
                return true;
            }
            return false;
        };

        // One ID can only be in the list once — adding it again would just
        // duplicate a row the user already has.
        const alreadyListed = devices.find((item: any) => getDeviceAccessKey(item) === requestedKey);
        if (alreadyListed) {
            const label = alreadyListed.device_name || alreadyListed.name || 'this device';
            setAddDeviceError(`This device is already in your list as "${label}".`);
            toast.error('That device is already in your list');
            return;
        }
        const cleanAddName = addName.trim();
        if (cleanAddName) {
            const duplicateName = findDuplicateDeviceName(cleanAddName);
            if (duplicateName) {
                setAddDeviceError(`Another device is already named "${duplicateName.device_name || duplicateName.name}". Pick a different name.`);
                return;
            }
        }

        const cleanGroup = addGroup.trim();
        // Re-adding a device the user archived locally is a restore, not a
        // duplicate — tell the server so it re-links instead of rejecting.
        const restoringArchived = getHiddenDeviceKeys().has(requestedKey);
        setIsAddingDevice(true);
        try {
            unhideDeviceKey(requestedKey);
            let data: any;
            let group: any = null;
            let savedToAccount = true;

            try {
                const response = await addExistingDevice({
                    accessKey: requestedKey,
                    password: addPassword,
                    name: addName || undefined,
                    // Restoring an archived device is an intentional re-link.
                    allowRelink: restoringArchived,
                    // Claim the device so it's owned by this account and adopted into the
                    // user's organization (otherwise it stays unowned/org-less and never
                    // shows up under the organization in Super Admin).
                    claimOwnership: true,
                    // "Remember This Device" — unchecked means the server must NOT keep
                    // a trust row, so the device asks for its password on every connect.
                    remember: addRemember
                });
                data = response.data;
                group = await ensureAccountDeviceGroup(cleanGroup);
                const deviceId = data.device?.id || data.id;
                if (group && deviceId) {
                    await api.patch(`/api/devices/${deviceId}/user-groups`, { groupIds: [group.id] });
                }
            } catch (addError: any) {
                // Wrong password / wrong ID -> keep the modal open and prompt.
                if (explainCredentialError(addError)) return;
                // 403 = account not allowed to persist on the backend. Verify the
                // credentials and add the device locally so it's still usable.
                if (addError?.response?.status !== 403) {
                    const msg = addError?.response?.data?.error || addError?.message || 'Could not add the device. Please try again.';
                    setAddDeviceError(msg);
                    toast.error(msg);
                    return;
                }
                try {
                    const verified = await api.post('/api/devices/verify-access', {
                        accessKey: requestedKey,
                        password: addPassword
                    });
                    savedToAccount = false;
                    data = {
                        device: {
                            ...(verified.data?.device || {}),
                            id: `pending-${requestedKey}`,
                            access_key: requestedKey,
                            device_name: addName || verified.data?.device?.name || `Device ${requestedKey}`,
                            device_type: verified.data?.device?.device_type || 'android',
                            is_online: true
                        }
                    };
                } catch (verifyError: any) {
                    if (explainCredentialError(verifyError)) return;
                    const msg = verifyError?.response?.data?.error || verifyError?.message || 'Could not add the device. Please try again.';
                    setAddDeviceError(msg);
                    toast.error(msg);
                    return;
                }
            }

            const optimisticDevice = {
                ...(data.device || data),
                id: data.device?.id || data.id || `pending-${requestedKey}`,
                access_key: data.device?.access_key || data.access_key || requestedKey,
                device_name: data.device?.device_name || data.device?.name || data.device_name || data.name || addName || `Device ${requestedKey}`,
                device_type: data.device?.device_type || data.deviceType || data.device_type || 'android',
                is_online: Boolean(data.device?.is_online || data.is_online),
                ...(group ? { device_groups: [group] } : {})
            };
            if (isLocalHostDevice(optimisticDevice) || isLocalHostNamedDevice(optimisticDevice)) {
                await pollDevices();
                setShowAddModal(false);
                toast.error('That device appears to be this computer. Use "Add This Device" for the current machine.');
                return;
            }
            rememberPendingAddedDevice(optimisticDevice);
            upsertDeviceInList(optimisticDevice);
            // Honor the "Remember This Device" checkbox: remember it locally (so a future
            // host password rotation surfaces as "changed") and persist trust server-side
            // for passwordless reconnects. Unchecked → forget it, so it prompts next time.
            const addedDeviceId = data.device?.id || data.id;
            if (addRemember) {
                markDeviceRemembered(requestedKey);
                if (addedDeviceId && !String(addedDeviceId).startsWith('pending-')) {
                    api.post(`/api/devices/${addedDeviceId}/trust`).catch(() => {});
                }
            } else {
                clearDeviceRemembered(requestedKey);
            }
            setAddKey('');
            setAddPassword('');
            setAddName('');
            setAddDescription('');
            setAddGroup('My Computers');
            setAddRemember(true);
            setAddDeviceError('');
            setShowAddModal(false);
            await pollDevices();
            upsertDeviceInList(optimisticDevice);
            toast.success(savedToAccount ? 'Device Added Successfully' : 'Device Verified And Added Locally');
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.message || 'Network Error Adding Device';
            setAddDeviceError(msg);
            toast.error(msg);
        } finally {
            setIsAddingDevice(false);
        }
    };

    const handleAddCurrentDevice = async () => {
        try {
            setShowAddModal(false);
            setIsRefreshing(true);
            const machineName = addName.trim() || (isElectron ? await getMachineDisplayName() : 'Remote365 Web User');
            const localKey = isElectron ? localStorage.getItem('remote365_device_access_key') : null;
            const cleanGroup = addGroup.trim();
            const localPassword = addPassword || devicePassword || '';
            // Explicitly re-adding this machine un-hides it (reverses a prior delete).
            localStorage.removeItem('remote365_local_device_hidden');
            if (localKey) unhideDeviceKey(localKey);
            const { data: newDevice } = await api.post('/api/devices/register', {
                name: machineName,
                accessKey: localKey || undefined,
                password: localPassword || undefined,
                passwordRequired: isRemotePasswordRequired(),
                claimExisting: true
            });

            const group = await ensureAccountDeviceGroup(cleanGroup);
            if (group && newDevice.id) {
                await api.patch(`/api/devices/${newDevice.id}/user-groups`, { groupIds: [group.id] });
            }

            localStorage.setItem('remote365_current_device_added_to_list', 'true');
            if (newDevice.access_key) {
                localStorage.setItem('remote365_device_access_key', newDevice.access_key);
                setDeviceId(newDevice.id);
                setHostAccessKey(newDevice.access_key);
                setLocalAuthKey(newDevice.access_key);
                setHostSessionId(newDevice.access_key);
                setIsLocalHostRegistered(true);
            }

            const optimisticDevice = {
                ...newDevice,
                ...(group ? { device_groups: [group] } : {})
            };
            upsertDeviceInList(optimisticDevice);
            setAddKey('');
            setAddPassword('');
            setAddName('');
            setAddDescription('');
            setAddGroup('My Computers');
            await pollDevices();
            upsertDeviceInList(optimisticDevice);
            addNotification('This computer is in your device list now and can be reached from any of your sign-ins.', 'system', 'Device Added');
        } catch (e: any) {
            setGlobalError(e.response?.data?.error || e.message || 'Network Error Adding This Computer');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Device names must stay unique in the list — two machines called "Reception"
    // are impossible to tell apart when picking one to connect to.
    const findDuplicateDeviceName = (name: string, exceptId?: string) => {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) return undefined;
        return devices.find((item: any) =>
            item.id !== exceptId && String(item.device_name || item.name || '').trim().toLowerCase() === normalized
        );
    };

    const handleRename = async (device: any) => {
        try {
            const cleanName = actionValue.trim();
            if (!cleanName) {
                setActionError('Device name is required.');
                return;
            }
            const duplicate = findDuplicateDeviceName(cleanName, device?.id);
            if (duplicate) {
                setActionError(`Another device is already named "${duplicate.device_name || duplicate.name}".`);
                return;
            }
            setActionError('');
            await api.patch(`/api/devices/${device.id}/name`, { device_name: cleanName });
            await pollDevices();
            setActionModal(null);
            if (selectedDevice?.id === device.id) setSelectedDevice({ ...selectedDevice, device_name: cleanName });
            toast.success('Name Changed Successfully');
        } catch (e: any) {
            setActionError(e.response?.data?.error || e.message || 'Failed to rename device.');
        }
    };

    // Track which devices we have open viewer sessions to (live from the main process)
    // so the Devices page shows a true "In Active Session" count.
    useEffect(() => {
        const api = (window as any).electronAPI?.viewers;
        if (!api) return;
        const normalize = (keys: any) => Array.isArray(keys)
            ? keys.map((k: any) => String(k || '').replace(/\D/g, '')).filter(Boolean)
            : [];
        api.getActive?.().then((keys: string[]) => setActiveViewerKeys(normalize(keys))).catch(() => {});
        const unsubscribe = api.onActiveChanged?.((keys: string[]) => setActiveViewerKeys(normalize(keys)));
        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
    }, []);

    useEffect(() => {
        const handleDeviceRenamed = (event: Event) => {
            const detail = (event as CustomEvent<{ id?: string; name?: string }>).detail;
            if (!detail?.id || !detail.name) return;
            setDevices(prev => prev.map((device: any) => (
                device.id === detail.id ? { ...device, name: detail.name, device_name: detail.name } : device
            )));
            setSelectedDevice((prev: any) => (
                prev?.id === detail.id ? { ...prev, name: detail.name, device_name: detail.name } : prev
            ));
        };

        const handleDeviceRemoved = (event: Event) => {
            const detail = (event as CustomEvent<{ id?: string }>).detail;
            if (!detail?.id) return;
            setDevices(prev => prev.filter((device: any) => device.id !== detail.id));
            setSelectedDevice((prev: any) => (prev?.id === detail.id ? null : prev));
        };

        window.addEventListener('remote365:device-renamed', handleDeviceRenamed);
        window.addEventListener('remote365:device-removed', handleDeviceRemoved);
        return () => {
            window.removeEventListener('remote365:device-renamed', handleDeviceRenamed);
            window.removeEventListener('remote365:device-removed', handleDeviceRemoved);
        };
    }, []);

    const handleRemove = async (device: any) => {
        try {
            // Deleting THIS machine just hides it from your list — it stays
            // registered/connectable (a running host can't truly delete itself,
            // and re-registering would only bring it back). The dedicated flag
            // hides it permanently and survives reload.
            // Deleting is not archiving: the device must not show under
            // Archived Devices afterwards.
            await forgetArchivedDevice(device);
            if (isLocalHostDevice(device)) {
                localStorage.setItem('remote365_local_device_hidden', 'true');
                localStorage.removeItem('remote365_current_device_added_to_list');
                setDevices(prev => applyDeviceListVisibility(prev.filter((item: any) => item.id !== device.id)));
                setActionModal(null);
                if (selectedDevice?.id === device.id) setSelectedDevice(null);
                return;
            }
            await api.delete(`/api/devices/${device.id}`);
            setDevices(prev => applyDeviceListVisibility(prev.filter((item: any) => item.id !== device.id)));
            await pollDevices();
            setActionModal(null);
            if (selectedDevice?.id === device.id) setSelectedDevice(null);
        } catch (e: any) { setGlobalError(e.message); }
    };

    const handleArchiveDevice = (device: any) => {
        // Archive = hide from the active list without deleting from the account. The key is
        // remembered locally so the device shows under "Archived Devices" and can be restored.
        hideDeviceFromList(device);
        setDevices(prev => applyDeviceListVisibility(prev));
        setArchivedDevicesRefreshTick((tick) => tick + 1);
        if (selectedDevice && getDeviceAccessKey(selectedDevice) === getDeviceAccessKey(device)) setSelectedDevice(null);
        const label = device?.device_name || device?.name || 'Device';
        toast.success(`${label} archived`);
        addNotification(`${label} moved to Archived Devices. Restore it from there any time.`, 'system', 'Device Archived');
    };

    const handleRevokeTrust = async (id: string) => {
        try {
            const creds = await (window as any).electronAPI.getToken();
            await api.delete(`/api/devices/${id}/trust`);
            setGlobalError('Success: Trust revoked for this device.');
            pollDevices();
        } catch (e) { }
    };



    const handleSetPassword = async (device: any) => {
        try {
            const creds = await (window as any).electronAPI.getToken();

            // If "device" is null, we are updating the local machine's access password
            if (!device) {
                setDevicePassword(actionValue);
                localStorage.setItem('device_password', actionValue);

                const requirePwd = isRemotePasswordRequired();
                const localKey = String(hostAccessKey || localStorage.getItem('remote365_device_access_key') || '').replace(/\s/g, '');

                // Push the new secret to the backend so other accounts/devices can
                // authenticate with it. The local machine is usually a self-registered
                // GUEST host (no owner), and /set-password requires device ownership —
                // so it 403s for a guest and the new password never reaches the server,
                // leaving the on-screen password out of sync with the stored hash (the
                // "correct password is incorrect" symptom). /self-register is the
                // unauthenticated host-bootstrap path: it updates the stored hash by
                // access key, so a guest host can change its own password. set-password
                // stays as the authoritative path for genuinely owned devices.
                let synced = false;
                if (deviceId && isAuthenticated) {
                    try {
                        await api.post('/api/devices/set-password', { deviceId, password: actionValue, passwordRequired: requirePwd });
                        synced = true;
                    } catch { /* not the owner (guest host) — fall back to self-register below */ }
                }
                if (!synced && localKey) {
                    const machineName = await getMachineDisplayName();
                    await api.post('/api/devices/self-register', {
                        accessKey: localKey,
                        name: machineName,
                        password: actionValue,
                        passwordRequired: requirePwd,
                        deviceType: 'windows',
                    });
                }

                setActionModal(null);
                setActionValue('');
            } else {
                await api.post('/api/devices/set-password', { deviceId: device.id, password: actionValue });
                pollDevices();
                setActionModal(null);
                setActionValue('');
            }
        } catch (e: any) { setGlobalError(e.message); }
    };


    const [deviceId, setDeviceId] = useState('');
    const [pendingViewerRequest, setPendingViewerRequest] = useState<{ viewerId: string; countdown: number; trustDevice?: boolean; viewerName?: string } | null>(null);
    const [pendingControlRequest, setPendingControlRequest] = useState<{ viewerId: string; countdown: number; viewerName?: string } | null>(null);


    const [lockoutSeconds, setLockoutSeconds] = useState(0);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [hostStats, setHostStats] = useState<{ bandwidth: string, activeUsers: number, cpu: string, memory: string }>({
        bandwidth: '0.00',
        activeUsers: 0,
        cpu: '0.0',
        memory: '0.0'
    });
    const [telemetryHistory, setTelemetryHistory] = useState<{ cpu: number, memory: number, time: string }[]>([]);

    useEffect(() => {
        if (!isElectron) return;
        const unsub = (window as any).electronAPI.onHostStats((stats: any) => {
            setHostStats(stats);
            setTelemetryHistory(prev => {
                const now = new Date();
                const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                const newSample = {
                    cpu: parseFloat(stats.cpu),
                    memory: parseFloat(stats.memory),
                    time: timeStr
                };
                const combined = [...prev, newSample];
                return combined.slice(-30); // Keep last 30 samples for the chart
            });
        });
        return () => unsub();
    }, [isElectron]);

    const [currentPlan, setCurrentPlan] = useState<any>(null);

    // Owner/admin changed this device's access password remotely (e.g. from the device
    // list "Set Password"). The server pushes the new secret to the live host so its own
    // screen updates instantly, keeping the displayed password in sync with the server.
    useEffect(() => {
        if (!isElectron) return;
        const api = (window as any).electronAPI;
        if (!api?.onHostPasswordUpdated) return;
        const unsub = api.onHostPasswordUpdated((data: { password?: string; passwordRequired?: boolean }) => {
            // The server also echoes this machine's own password/flag sync back to
            // it; only a value that differs from what we hold is news.
            const nextPassword = typeof data?.password === 'string' && data.password ? data.password : null;
            const passwordChanged = Boolean(nextPassword) && nextPassword !== (localStorage.getItem('device_password') || '');
            const requiredChanged = typeof data?.passwordRequired === 'boolean' && data.passwordRequired !== isRemotePasswordRequired();
            if (!passwordChanged && !requiredChanged) return;
            if (typeof data?.password === 'string' && data.password) {
                setDevicePassword(data.password);
                localStorage.setItem('device_password', data.password);
            }
            if (typeof data?.passwordRequired === 'boolean') {
                // Through the shared helper so every Easy Access switch follows;
                // marked server-sourced so the listener does not send it back.
                applyEasyAccess(!data.passwordRequired, { fromServer: true });
            }
            toast.success('Access Password Updated Remotely');
            addNotification("An account owner changed this device's access password. Share the new one with the people who connect.", 'security', 'Access Password Changed');
        });
        return () => { try { unsub?.(); } catch {} };
    }, [isElectron]);


    // --- Viewer access-request dialog ---
    useEffect(() => {
        if (!isElectron || isViewerWindow) return;
        const eAPI = (window as any).electronAPI;
        const unsubReq = eAPI.onViewerRequest?.((data: { viewerId: string; viewerName?: string }) => {
            // AUTO-APPROVE: If host is not authenticated (Guest Mode), automatically approve.
            // This is essential for unattended access via Access Key/PIN.
            if (!isAuthenticated) {
                console.log(`[Host] Guest Mode: Auto-approving connection request from ${data.viewerId}`);
                eAPI.approveViewer(data.viewerId);
                return;
            }

            // Unattended access (Settings → Device management): approve without
            // prompting — same flag as "Grant Easy Access" (lib/easyAccess).
            const unattendedEnabled = localStorage.getItem('pref_dm_unattended') === 'true';
            if (unattendedEnabled) {
                console.log(`[Host] Unattended access on: auto-approving ${data.viewerId}`);
                eAPI.approveViewer(data.viewerId);
                addNotification(`${data.viewerName || 'A viewer'} connected with Easy Access, so no approval was needed.`, 'session', 'Unattended Session');
                return;
            }

            setPendingViewerRequest({ viewerId: data.viewerId, viewerName: data.viewerName || '', countdown: 30 });
            playUISound('connect');
        });
        const unsubCancel = eAPI.onViewerRequestCancelled?.((data: { viewerId: string }) => {
            setPendingViewerRequest(prev => prev?.viewerId === data.viewerId ? null : prev);
        });
        const unsubControl = eAPI.onControlRequest?.((data: { viewerId: string; viewerName?: string }) => {
            if (!data.viewerId) return;
            // A — Control permission mode (Settings → Remote control).
            const controlMode = localStorage.getItem('pref_control_mode') || 'ask';
            if (controlMode === 'view') {
                eAPI.denyControl?.(data.viewerId);
                addNotification('A viewer asked for control and was kept to view-only.', 'session', 'Control Request Declined');
                return;
            }
            if (controlMode === 'allow') {
                eAPI.approveControl?.(data.viewerId);
                return;
            }
            setPendingControlRequest({ viewerId: data.viewerId, viewerName: data.viewerName || '', countdown: 20 });
            playUISound('connect');
        });
        // The centred consent window is the prompt the host actually sees; when
        // it (or the dock) answers, drop the in-app copy so its countdown can't
        // fire a second, contradictory decision.
        const unsubControlResolved = eAPI.onControlRequestResolved?.(() => setPendingControlRequest(null));
        const unsubRecording = eAPI.onHostRecordingState?.((info: { on: boolean; byName?: string }) => {
            addNotification(
                info.on
                    ? `${info.byName || 'The remote viewer'} started recording this session.`
                    : `${info.byName || 'The remote viewer'} stopped recording.`,
                'security', info.on ? 'Session Is Being Recorded' : 'Recording Stopped');
            fireNotification(info.on ? 'Session Is Being Recorded' : 'Recording Stopped',
                info.on ? `${info.byName || 'The Remote Viewer'} started recording your screen.` : '');
        });
        // B — Panic hotkey fired in the main process: end everything.
        const unsubPanic = eAPI.onPanicTriggered?.(() => {
            manuallyStoppedHost.current = true;
            handleStopHosting();
            if (localStorage.getItem('pref_panic_kill_incoming') === 'true' && deviceId) {
                api.patch(`/api/devices/${deviceId}/settings`, {
                    allowIncoming: false,
                    deviceAuth: {
                        accessKey: String(hostAccessKey || localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, ''),
                        password: localStorage.getItem('device_password') || '',
                    },
                }).catch(() => {});
                localStorage.setItem('pref_dm_allow_incoming', 'false');
            }
            pushSlidingToast('Panic Lockdown', 'All remote sessions were disconnected.', undefined, 'system');
            addNotification('Panic hotkey pressed. Every remote session was ended immediately.', 'system', 'Panic Lockdown');
        });
        // C — Idle disconnect fired in the main process: surface it.
        const unsubIdle = eAPI.onIdleDisconnected?.(() => {
            addNotification('A remote session was ended after sitting idle for the configured time.', 'session', 'Idle Disconnect');
        });
        const unsubSessionJoin = eAPI.onSessionWaitParticipantJoined?.(() => {
            // Options → "Show Connection Alerts" (same flag as Settings →
            // Notify Me When Accessed).
            if (!areConnectionAlertsEnabled()) return;
            pushSlidingToast('Participant Joined', 'A participant just connected to your session.', undefined, 'accepted');
            addNotification('A participant connected to your session.', 'accepted', 'Participant Joined');
            fireNotification('Participant Joined', 'A participant connected to your session.', 'session');
        });
        return () => { unsubReq?.(); unsubCancel?.(); unsubControl?.(); unsubControlResolved?.(); unsubRecording?.(); unsubPanic?.(); unsubIdle?.(); unsubSessionJoin?.(); };
    }, [isElectron, isViewerWindow, isAuthenticated, deviceId, hostAccessKey]);

    // Re-apply the persisted session-security settings to the main process on
    // launch (panic hotkey, idle timeout, received-files folder) so enforcement
    // is live even if the user never opens Settings this session.
    useEffect(() => {
        if (!isElectron || isViewerWindow) return;
        const eAPI = (window as any).electronAPI;
        const hotkey = localStorage.getItem('pref_panic_hotkey') || '';
        if (hotkey) eAPI?.setPanicHotkey?.(hotkey).catch?.(() => {});
        const idleMin = Number(localStorage.getItem('pref_idle_disconnect_min') || 0);
        if (idleMin > 0) eAPI?.setIdleTimeout?.(idleMin).catch?.(() => {});
        const dir = localStorage.getItem('pref_received_dir') || '';
        if (dir) eAPI?.setReceivedDir?.(dir).catch?.(() => {});
        // Network settings: proxy + WebRTC transport policy.
        const proxyMode = localStorage.getItem('pref_network_proxy_mode') || 'Recommended';
        eAPI?.net?.setProxy?.(proxyMode, localStorage.getItem('pref_network_proxy_manual') || '').catch?.(() => {});
        // Advanced → "Allow Direct Peer Connections" off forces relay-only.
        const directPeer = localStorage.getItem('pref_adv_direct_peer') !== 'false';
        eAPI?.net?.setIcePolicy?.(directPeer ? 'all' : 'relay').catch?.(() => {});
        // Advanced → keep-running + detailed-logs applied live in the main process.
        eAPI?.setAdvancedFlags?.({
            keepRunning: localStorage.getItem('pref_keep_agent') !== 'false',
            detailedLogs: localStorage.getItem('pref_adv_detailed_logs') === 'true',
        }).catch?.(() => {});
    }, [isElectron, isViewerWindow]);

    // Announce one-time access codes as they expire — exactly once each.
    useEffect(() => {
        if (isViewerWindow) return;
        const check = () => {
            for (const c of collectExpiredTempCodes()) {
                // Skip codes that expired long ago (e.g. while the app was closed)
                // so reopening the app doesn't replay stale announcements.
                if (Date.now() - new Date(c.expiresAt).getTime() > 60 * 60 * 1000) continue;
                pushSlidingToast('Temporary Code Expired', `Your one-time access code ${c.code} has expired.`, undefined, 'system');
                addNotification(`One-time code ${c.code} expired without being used.`, 'security', 'Temporary Code Expired');
                fireNotification('Temporary Code Expired', `Your one-time access code ${c.code} has expired.`);
            }
        };
        check();
        const t = setInterval(check, 30000);
        return () => clearInterval(t);
    }, [isViewerWindow]);

    useEffect(() => {
        if (!pendingViewerRequest) return;
        if (pendingViewerRequest.countdown <= 0) {
            (window as any).electronAPI?.denyViewer(pendingViewerRequest.viewerId);
            setPendingViewerRequest(null);
            return;
        }
        const t = setTimeout(() => {
            setPendingViewerRequest(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
        }, 1000);
        return () => clearTimeout(t);
    }, [pendingViewerRequest]);

    useEffect(() => {
        if (!pendingControlRequest) return;
        if (pendingControlRequest.countdown <= 0) {
            (window as any).electronAPI?.denyControl?.(pendingControlRequest.viewerId);
            setPendingControlRequest(null);
            return;
        }
        const t = setTimeout(() => {
            setPendingControlRequest(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
        }, 1000);
        return () => clearTimeout(t);
    }, [pendingControlRequest]);

    // Host side: share this machine's speakers while a remote session is live.
    // Main drives start/stop; everything else lives in lib/hostAudioCapture.
    // The viewer window never captures — it is the one doing the listening.
    useEffect(() => {
        if (isViewerWindow) return;
        return subscribeHostAudioCapture();
    }, [isViewerWindow]);

    const fetchBillingInfo = async () => {
        try {
            const { data } = await api.get('/api/billing/current');
            setCurrentPlan(data);
        } catch (err: any) {
            console.error('Failed to fetch billing info', err);
        }
    };

    const loadDeviceInfo = async () => {
        try {
            const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
            if (!creds?.token) return;

            let localKey = isElectron ? localStorage.getItem('remote365_device_access_key') : null;
            if (localKey && localStorage.getItem(HOST_IDENTITY_BOOTSTRAP_MARKER) !== 'true') {
                localKey = null;
            }
            let deviceUuid = '';

            // 1. Fetch what the server thinks are our devices
            const devicesEndpoint = '/api/devices/mine';
            const { data: fetchedDevices } = await api.get(devicesEndpoint);
            syncServerPasswordUpdateFlags(fetchedDevices);
            setDevices(applyDeviceListVisibility(fetchedDevices));

            // 2. Check if our local identity is still valid in the DB
            let existingInDb = null;
            if (localKey && Array.isArray(fetchedDevices)) {
                existingInDb = fetchedDevices.find((d: any) => d.access_key === localKey);
            }

            if (!localKey || !existingInDb) {
                // We have no key, or our key was deleted from the server.
                // Self-registered machines may be usable before they are attached to an account.
                if (localKey) {
                    console.log(`[Identity] Keeping self-registered host identity: ${localKey}`);
                    setIsLocalHostRegistered(true);
                    setHostAccessKey(localKey);
                    setLocalAuthKey(localKey);
                    setHostSessionId(localKey);
                } else if (Array.isArray(fetchedDevices)) {
                    console.log(`[Identity] Current machine is not registered as a node.`);
                    setIsLocalHostRegistered(false);
                    setDeviceId('');
                    setHostAccessKey('');
                } else {
                    console.warn(`[Identity] Skipping registration check due to invalid API response.`);
                }
            } else {
                deviceUuid = existingInDb.id;
                console.log(`[Identity] Verified existing identity: ${localKey}`);
                setIsLocalHostRegistered(true);
            }

            if (localKey && existingInDb) {
                setDeviceId(deviceUuid);
                setHostAccessKey(localKey);
                setLocalAuthKey(localKey);
                setHostSessionId(localKey); // Update the visual registration code
            }
        } catch (e: any) {
            console.error('[Identity] Load failed:', e);
        }
    };

    const handleRegisterLocalDevice = async () => {
        try {
            console.log(`[Identity] User-initiated registration started...`);
            const machineName = isElectron ? await getMachineDisplayName() : 'Remote365 Web User';

            let localKey = isElectron ? localStorage.getItem('remote365_device_access_key') : null;

            const { data: newDevice } = await api.post('/api/devices/register', {
                name: machineName,
                accessKey: localKey || undefined,
                claimExisting: true
            });

            localStorage.setItem('remote365_device_access_key', newDevice.access_key);
            localStorage.setItem(HOST_IDENTITY_BOOTSTRAP_MARKER, 'true');
            setDeviceId(newDevice.id);
            setHostAccessKey(newDevice.access_key);
            setLocalAuthKey(newDevice.access_key);
            setHostSessionId(newDevice.access_key);
            setIsLocalHostRegistered(true);

            addNotification('This computer is registered and ready to accept connections.', 'system', 'Ready To Host');
            pollDevices();
        } catch (e: any) {
            console.error('[Identity] Registration failed:', e);
            showError('Registration Failed', e.message || 'Could not initialize device identity.');
        }
    };

    useEffect(() => {
        if (isAuthenticated) loadDeviceInfo();
    }, [isAuthenticated, serverIP]);

    // Fetch billing data when billing view is opened
    useEffect(() => {
        if (currentView === 'billing' && isAuthenticated && canSeeBilling) {
            fetchBillingInfo();
        }
    }, [currentView, isAuthenticated, canSeeBilling]);

    useEffect(() => {
        if (!isElectron) return;
        let cancelled = false;
        (async () => {
            const cachedAccessKey = localStorage.getItem('remote365_device_access_key') || '';
            const cachedPassword = localStorage.getItem('device_password') || '';
            const hasVerifiedBootstrapIdentity = localStorage.getItem(HOST_IDENTITY_BOOTSTRAP_MARKER) === 'true';
            const shouldDiscardCachedBootstrapIdentity = !hasVerifiedBootstrapIdentity && Boolean(cachedAccessKey || cachedPassword);
            if (shouldDiscardCachedBootstrapIdentity) {
                console.log('[Self-Register] Discarding unverified cached host credentials before bootstrap.');
                localStorage.removeItem('remote365_device_access_key');
                localStorage.removeItem('device_password');
                setDevicePassword('');
            } else if (cachedAccessKey) {
                setLocalAuthKey(cachedAccessKey);
            }

            const storedAccessKey = shouldDiscardCachedBootstrapIdentity ? '' : cachedAccessKey;
            const storedPwd = shouldDiscardCachedBootstrapIdentity ? '' : cachedPassword;

            // A machine that already has an identity must go online WITHOUT
            // waiting for the server. At boot this request loses the race
            // against Wi-Fi/DHCP/DNS, and hosting used to be gated behind it —
            // one network error and the device stayed Offline until someone
            // physically re-toggled Easy Access. Publishing the cached key here
            // lets the auto-start effect hand main its access key immediately;
            // main's reconnect supervisor then keeps trying until the link is up.
            if (storedAccessKey) {
                setHostAccessKey(storedAccessKey);
                setHostSessionId(storedAccessKey);
            }

            // Register this machine in the DB without requiring a login so that
            // viewers can look it up via access key even before the host signs in.
            // Retried with backoff: at boot the first attempts routinely fail
            // because the network isn't ready yet, and giving up used to mean a
            // fresh install never became reachable at all.
            for (let attempt = 0; !cancelled; attempt += 1) {
                try {
                    const machineName = await getMachineDisplayName();
                    // Only a decided setting travels; an undecided default would
                    // overwrite the flag the server already has.
                    const passwordRequired = isRemotePasswordConfigured() ? isRemotePasswordRequired() : undefined;
                    // The fingerprint lets the server find this machine's existing
                    // device row even when the cached key was discarded/lost, so the
                    // ID stays stable across reinstalls and storage resets.
                    // Deliberately NO password in this call: the server-side password
                    // is permanent until the user explicitly changes it, so a routine
                    // boot must never push (possibly stale) local credentials at it.
                    const fingerprint = await getMachineFingerprint();
                    const { data } = await api.post('/api/devices/self-register', {
                        accessKey: storedAccessKey || undefined,
                        name: machineName,
                        passwordRequired,
                        fingerprint: fingerprint || undefined,
                    });
                    if (cancelled) return;

                    localStorage.setItem('remote365_device_access_key', data.access_key);
                    setLocalAuthKey(data.access_key);
                    setHostAccessKey(data.access_key);
                    setHostSessionId(data.access_key);
                    setDeviceId(data.id);
                    setIsLocalHostRegistered(true);
                    localStorage.setItem(HOST_IDENTITY_BOOTSTRAP_MARKER, 'true');

                    // The server may have issued a NEW identity (device was removed or
                    // the backend was reset). Fresh identity ⇒ fresh credentials: adopt
                    // the returned password, or drop the stale cached one.
                    const identityChanged = Boolean(storedAccessKey) && String(data.access_key) !== String(storedAccessKey);
                    if (data.auto_password) {
                        setDevicePassword(data.auto_password);
                        localStorage.setItem('device_password', data.auto_password);
                    } else if (identityChanged && storedPwd) {
                        setDevicePassword('');
                        localStorage.removeItem('device_password');
                    }
                    setServerHasDevicePassword(Boolean(data.has_password));

                    // Go online right away. The reactive auto-start effect can miss
                    // this transition (its guards race the identity/password loads —
                    // seen as the app sitting on "Offline" after a backend reset), so
                    // kick hosting explicitly under the same conditions it uses.
                    // A device whose password lives server-side hosts fine without a
                    // local plaintext copy — viewers verify against the stored hash.
                    let hostingPwd = data.auto_password || (identityChanged ? '' : storedPwd);

                    // First run on this install, but the server already knows this
                    // machine (the ID is derived from the hardware fingerprint, so a
                    // reinstall lands on the old device row, whose password the
                    // server keeps but nobody here knows). The screen would show
                    // "Not Set" while viewers are asked for a password that can't be
                    // read anywhere. Mint one here and push it through the same
                    // explicit set-password path the modal uses. Gated on a TRULY
                    // fresh install (nothing cached locally) so a working install
                    // never has its password rotated behind the user's back.
                    const trulyFreshInstall = !cachedAccessKey && !cachedPassword && !hasVerifiedBootstrapIdentity;
                    const serverHasUnknownPassword = Boolean(data.has_password) && !data.auto_password;
                    const passwordWanted = data.password_required !== false && passwordRequired !== false;
                    if (trulyFreshInstall && serverHasUnknownPassword && passwordWanted && !hostingPwd) {
                        hostingPwd = generateFirstRunPassword();
                        console.log('[Self-Register] First run on a known machine: issuing a fresh access password.');
                        setDevicePassword(hostingPwd);
                        localStorage.setItem('device_password', hostingPwd);
                    }
                    if (!manuallyStoppedHost.current) {
                        hasAutoStartedHost.current = true;
                        setTimeout(() => handleStartHosting(hostingPwd || undefined, { silent: true }), 600);
                    }
                    return;
                } catch (e: any) {
                    if (cancelled) return;
                    // 5s, 10s, 20s … capped at 60s. Unbounded on purpose: a machine
                    // that boots without internet must still come online by itself
                    // whenever the connection finally arrives, however long that takes.
                    const delayMs = Math.min(60000, 5000 * Math.pow(2, Math.min(attempt, 4)));
                    console.warn(`[Self-Register] Could not register device (attempt ${attempt + 1}): ${e.message}. Retrying in ${delayMs / 1000}s.`);
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        checkAuth().then(() => {
            // If the user is already authenticated (restored from stored token),
            // redirect them to the dashboard instead of showing the guest home screen.
            const state = useAuthStore.getState();
            if (state.accessToken && state.user && currentViewRef.current === 'home') {
                setCurrentView(getDefaultHomeView(state.user.role));
            }
        }).finally(() => setLoading(false));

        if (!isElectron) return;

        // Listen for Google OAuth deep link success
        const removeAuthSuccess = (window as any).electronAPI.onAuthDeepLinkSuccess?.(async (tokens: any) => {
            console.log('[Auth] Deep link success received in renderer');
            // Store tokens first so the API interceptor can use them
            await setAuth({ id: 'loading', email: '', name: '', plan: 'FREE', role: 'VIEWER', organizationId: null, avatar: null }, tokens.accessToken, tokens.refreshToken);
            // Then fetch real user data from /me
            checkAuth();
        });

        // A Business sign-up with Google / Microsoft that used a personal address is
        // refused by the server; the message arrives through the deep link.
        const removeAuthError = (window as any).electronAPI.onAuthDeepLinkError?.((data: { message: string }) => {
            setAuthMode('signup');
            setSignupAccountType('business');
            setBusinessStep(3);
            setAuthError(data.message);
            setAuthResult({ kind: 'error', title: 'Company Email Required', message: data.message });
        });

        // Listen for Onboarding deep link
        const removeOnboarding = (window as any).electronAPI.onOnboardingToken?.((token: string) => {
            console.log('[Auth] Onboarding token received in renderer:', token);
            setOnboardingToken(token);
        });

        const removeSessionJoin = (window as any).electronAPI.onSessionJoinLink?.((payload: { code: string; password?: string }) => {
            handleJoinSessionInvite(payload.code, payload.password);
        });

        const removeMeetingJoin = (window as any).electronAPI.onMeetingJoinLink?.((payload: { code: string }) => {
            openMeeting(payload.code);
        });

        // Listen for 2FA token
        const removeTemp2fa = (window as any).electronAPI.onTemp2faToken?.((token: string) => {
            setTemp2faToken(token);
        });

        if (isElectron) {
            (window as any).electronAPI.getLocalIP().then(setLocalIP);
        }

        if (isElectron) {
            // Synchronize initial hosting status from main process
            (window as any).electronAPI.getHostStatus?.().then((res: any) => {
                if (res && res.status === 'status') {
                    console.log(`[Renderer] Syncing active host session: ${res.sessionId}`);
                    setHostSessionId(res.sessionId);
                    setHostStatus('status');
                }
            });
        }
        const removeHostListener = isElectron ? (window as any).electronAPI.onHostStatus((status: string) => {
            setHostMessage(status);
        }) : () => { };

        const removeSignalingListener = isElectron ? (window as any).electronAPI.onSignalingMessage(async (data: any) => {
            if (isElectron) {
                (window as any).electronAPI.log(`[Renderer] Received signaling FROM MAIN: ${data.type}`);
            }
            if (data.type === 'joined') {
                reconnectingViewerRef.current = false;
                if (data.success) {
                    console.log('[Viewer] Successfully joined session. Ready for stream.');
                    // Keep the session-scoped ICE list (TURN included) for the offer
                    // handler; see fetchIceServers.
                    if (Array.isArray(data.iceServers) && data.iceServers.length) {
                        signalingIceServersRef.current = data.iceServers;
                    }
                    setViewerStatus('connected');
                } else {
                    // Host denied the connection or timed out
                    setViewerStatus('error');
                    const message = data.error || 'No response from the other machine.';
                    setViewerError(message);
                    if (isViewerWindow) {
                        showError('Connection Not Approved', message);
                        setTimeout(() => window.close(), 4500);
                    }
                }
                return;
            }
                if (data.type === 'offer') {
                    viewerPipelineTimelineRef.current.offerAt = Date.now();
                    if (isElectron) (window as any).electronAPI.log('[Renderer] Handling OFFER from host...');
                const viewerSessionId = sessionCode.replace(/\s/g, '');
                const hostSignalTargetId = data.senderId || sessionCode.replace(/\s/g, '');
                // Cached/prefetched at connect start — resolves instantly on the happy
                // path instead of stalling the handshake on an HTTPS round-trip.
                let iceServers = await fetchIceServers();
                // The prefetch may have finished before `joined` delivered the
                // session credentials; never start the handshake STUN-only when a
                // relay is available.
                if (!iceListHasTurn(iceServers) && iceListHasTurn(signalingIceServersRef.current)) {
                    logIce('[Viewer] ICE servers: session credentials from signaling (TURN relay available)');
                    iceServers = signalingIceServersRef.current;
                }
                // One-shot relay-only routing (localStorage 'r365_force_relay' = '1').
                //
                // ICE ranks candidates by FIXED priority — host > srflx > relay — and never by
                // measured latency. On a long-haul link that is actively harmful: a real
                // session here sat on a direct srflx<->srflx pair at 450ms RTT while this
                // machine reaches the London TURN in 162ms, so relaying both legs (~324ms)
                // would have been materially faster. ICE will never make that swap on its own.
                //
                // Consume the preference once. Only the sustained-v2 heuristic
                // below may create it; older one-sample preferences are discarded.
                const forceRelay = (() => {
                    try {
                        if (window.localStorage?.getItem('r365_force_relay') !== '1') return false;
                        const pinnedAt = Number(window.localStorage?.getItem('r365_force_relay_at') || 0);
                        const confidence = window.localStorage?.getItem('r365_force_relay_confidence');
                        window.localStorage?.removeItem('r365_force_relay');
                        window.localStorage?.removeItem('r365_force_relay_at');
                        window.localStorage?.removeItem('r365_force_relay_confidence');
                        // Ignore preferences created by the older one-sample
                        // heuristic. Even a sustained measurement expires after
                        // two minutes because network routes change quickly.
                        return confidence === 'sustained-v2' && !!pinnedAt && Date.now() - pinnedAt <= 2 * 60_000;
                    } catch { return false; }
                })();
                const pc = new RTCPeerConnection({
                    iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
                    ...(forceRelay ? { iceTransportPolicy: 'relay' as RTCIceTransportPolicy } : {}),
                });
                if (forceRelay && isElectron) {
                    (window as any).electronAPI?.log?.('[Viewer] iceTransportPolicy=relay (one-shot route repair)');
                }

                pcRef.current = pc;

                pc.onicegatheringstatechange = () => {
                    if (isElectron) (window as any).electronAPI.log(`[Renderer] ICE Gathering State: ${pc.iceGatheringState}`);
                };

                // 'disconnected' is frequently TRANSIENT (a WiFi blip, a route change) and
                // ICE recovers by itself within a few seconds. Tearing the session down on
                // it forces a full reconnect (new ICE gather + DTLS + first keyframe) for
                // an outage that would have self-healed. Only 'failed' is terminal.
                let disconnectGraceTimer: number | null = null;
                const declareConnectionLost = () => {
                    if (isElectron) (window as any).electronAPI.log('[Renderer] WebRTC connection dropped or failed.');
                    setViewerStatus('connection_lost');
                    clearTimeout(connectionTimeout);
                    if (adaptiveStatsIntervalRef.current) {
                        window.clearInterval(adaptiveStatsIntervalRef.current);
                        adaptiveStatsIntervalRef.current = null;
                    }
                    if (localStorage.getItem('pref_notify_disconnect') !== 'false') {
                        fireNotification('Connection Lost', 'Your remote session dropped unexpectedly.', 'session');
                    }
                    playUISound('disconnect');
                };
                pc.onconnectionstatechange = () => {
                    if (isElectron) (window as any).electronAPI.log(`[Renderer] Connection State: ${pc.connectionState}`);
                    if (pc.connectionState === 'connected') {
                        if (!viewerPipelineTimelineRef.current.connectedAt) {
                            viewerPipelineTimelineRef.current.connectedAt = Date.now();
                        }
                        if (disconnectGraceTimer != null) {
                            window.clearTimeout(disconnectGraceTimer);
                            disconnectGraceTimer = null;
                            if (isElectron) (window as any).electronAPI.log('[Renderer] Transient disconnect self-healed.');
                        }
                        setViewerStatus('connected');
                        clearTimeout(connectionTimeout);
                        startAdaptiveStreamStats(pc, viewerSessionId, hostSignalTargetId);
                    } else if (pc.connectionState === 'failed') {
                        if (disconnectGraceTimer != null) { window.clearTimeout(disconnectGraceTimer); disconnectGraceTimer = null; }
                        declareConnectionLost();
                    } else if (pc.connectionState === 'disconnected') {
                        if (disconnectGraceTimer == null) {
                            if (isElectron) (window as any).electronAPI.log('[Renderer] WebRTC transiently disconnected — 4s grace before declaring loss.');
                            disconnectGraceTimer = window.setTimeout(() => {
                                disconnectGraceTimer = null;
                                if (pc.connectionState === 'disconnected') declareConnectionLost();
                            }, 4000);
                        }
                    } else if (pc.connectionState === 'closed') {
                        if (disconnectGraceTimer != null) { window.clearTimeout(disconnectGraceTimer); disconnectGraceTimer = null; }
                        clearTimeout(connectionTimeout);
                        if (adaptiveStatsIntervalRef.current) {
                            window.clearInterval(adaptiveStatsIntervalRef.current);
                            adaptiveStatsIntervalRef.current = null;
                        }
                    }
                };

                const connectionTimeout = setTimeout(() => {
                    if (pc.connectionState !== 'connected' && pc.connectionState !== 'closed') {
                        if (isElectron) (window as any).electronAPI.log(`[Renderer] WebRTC Connection timeout (Viewer). Status: ${pc.connectionState}`, 'warn');
                        setViewerStatus('connection_lost');
                        pc.close();
                    }
                }, 30000); // 30s timeout for ICE/handshake to be safer

                pc.ontrack = (event) => {
                    event.track.enabled = viewerMediaActiveRef.current;
                    const stream = event.streams[0];
                    viewerPipelineTimelineRef.current.trackAt = Date.now();
                    // VideoPlayer owns the <video> element, so carry the signaling
                    // timestamps on this in-memory stream until Chromium confirms
                    // the first frame was actually presented.
                    // Keep the shared timeline object by reference: ontrack can
                    // precede connectionState=connected, so a snapshot here left
                    // connectedAt permanently zero and made presentation telemetry
                    // report -1ms even for healthy sessions.
                    (stream as any).__r365PipelineTimeline = viewerPipelineTimelineRef.current;
                    if (isElectron) {
                        (window as any).electronAPI.log(
                            `[Renderer] Remote media track received: ${event.track?.kind || 'unknown'}; audio=${stream?.getAudioTracks?.().length || 0}, video=${stream?.getVideoTracks?.().length || 0}`
                        );
                    }
                    // Bound Chromium's receive jitter buffer. By default it grows to
                    // 500ms-1s+ on lossy long-haul links (PK<->KSA), which is the single
                    // biggest reason remote actions "appear several seconds late". A small
                    // fixed target keeps the control loop near real-time while still
                    // absorbing normal network jitter. Applied to the video receiver only.
                    try {
                        const receiver: any = event.receiver;
                        if (receiver && (event.track?.kind === 'video' || !event.track)) {
                            // Hold a reference so the adaptive-stats loop can retune the
                            // playout buffer to live network conditions (see below).
                            videoReceiverRef.current = receiver;
                            // Start at 60ms (~2 frame intervals): the old 30ms start was
                            // BELOW one frame interval, so the first seconds of every
                            // session played nearly unbuffered — the "shaky at first,
                            // settles later" symptom. The stats loop (1.5s cadence)
                            // then tunes it down to the 45ms floor on clean links.
                            // jitterBufferTarget is in milliseconds (modern Chromium).
                            if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = 60;
                            // playoutDelayHint is in seconds (legacy fallback name).
                            if ('playoutDelayHint' in receiver) receiver.playoutDelayHint = 0.06;
                        }
                    } catch (e) {
                        console.warn('[Viewer] Could not set low-latency jitter buffer target:', e);
                    }
                    // The host adds video and audio as two separate node-datachannel
                    // tracks with no shared msid, so each ontrack carries its own
                    // MediaStream (or none at all). Taking event.streams[0] verbatim
                    // meant the audio track either replaced the video stream or was
                    // dropped — which is exactly why "Listen To Remote Audio" kept
                    // reporting no audio track. Fold late tracks into the stream the
                    // <video> element is already playing instead: adding a track to a
                    // live MediaStream starts it without reassigning srcObject, so the
                    // video never restarts.
                    if (event.track?.kind === 'audio') {
                        const existing = remoteStreamRef.current;
                        if (existing) {
                            if (!existing.getTracks().some((t) => t.id === event.track.id)) {
                                existing.addTrack(event.track);
                            }
                            setRemoteTrackRevision((n) => n + 1);
                            if (viewerStatus !== 'streaming') setViewerStatus('streaming');
                            return;
                        }
                    }
                    setRemoteStream(stream);
                    if (viewerStatus !== 'streaming') setViewerStatus('streaming');
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        if (isElectron) {
                            (window as any).electronAPI.sendSignalingMessage({
                                type: 'ice-candidate',
                                candidate: event.candidate.candidate,
                                sdpMid: event.candidate.sdpMid,
                                sdpMLineIndex: event.candidate.sdpMLineIndex,
                                sessionId: viewerSessionId,
                                targetId: hostSignalTargetId
                            });
                        }
                    }
                };


                pc.ondatachannel = (event) => {
                    const channel = event.channel;
                    console.log(`[Renderer] DataChannel received: ${channel.label}`);
                    if (channel.label === 'video') {
                        channel.binaryType = 'arraybuffer';
                        channel.onmessage = (msg: MessageEvent) => {
                            const data = new Uint8Array(msg.data);
                            if (Math.random() < 0.01) console.log(`[Renderer] DataChannel MSG: ${data.length} bytes`);
                            if (videoPlayerRef.current) {
                                videoPlayerRef.current.feed(data);
                            } else {
                                if (viewerStatus !== 'streaming') setViewerStatus('streaming');
                            }
                        };
                    } else if (channel.label === 'input') {
                        inputChannelRef.current = channel;
                        channel.onopen = () => console.log('[Renderer] Low-latency input DataChannel ready.');
                        channel.onclose = () => {
                            if (inputChannelRef.current === channel) inputChannelRef.current = null;
                        };
                    } else if (channel.label === 'input-critical') {
                        criticalInputChannelRef.current = channel;
                        channel.onopen = () => console.log('[Renderer] Critical input DataChannel ready.');
                        channel.onclose = () => {
                            if (criticalInputChannelRef.current === channel) criticalInputChannelRef.current = null;
                        };
                    } else if (channel.label === 'file') {
                        // Dedicated file-transfer lane (hosts >= 1.2.98). Same
                        // wire format as the control channel; everything is
                        // handed to the bus, where the transfer engine and the
                        // file manager subscribe.
                        channel.binaryType = 'arraybuffer';
                        setSessionFileChannel(channel);
                        channel.onopen = () => console.log('[Renderer] File transfer DataChannel ready.');
                        channel.onclose = () => setSessionFileChannel(null);
                        channel.onmessage = (e: MessageEvent) => {
                            try {
                                if (e.data instanceof ArrayBuffer || e.data instanceof Blob) {
                                    const blob = e.data instanceof Blob ? e.data : new Blob([e.data]);
                                    blob.arrayBuffer().then((buf) => {
                                        const view = new DataView(buf, 0, 4);
                                        const headerLen = view.getUint32(0, true);
                                        const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headerLen)));
                                        dispatchControlChunk(header, new Uint8Array(buf, 4 + headerLen));
                                    }).catch(() => { /* malformed frame — drop it */ });
                                    return;
                                }
                                dispatchControlJson(JSON.parse(e.data));
                            } catch {
                                // A malformed message must not kill the channel handler.
                            }
                        };
                    } else if (channel.label === 'control') {
                        controlChannelRef.current = channel;

                        const sendKeyframeRequest = () => {
                            if (channel.readyState === 'open') {
                                console.log('[Renderer] Control DataChannel ACTIVE. Requesting keyframe...');
                                syncViewerMedia();
                                channel.send(JSON.stringify({ type: 'audio-status-request' }));
                            }
                        };

                        if (channel.readyState === 'open') {
                            sendKeyframeRequest();
                        } else {
                            channel.onopen = sendKeyframeRequest;
                        }

                        // Viewer → host clipboard sync, gated by the session toolbar's
                        // "Sync Clipboard Automatically" toggle (lib/clipboardSyncPreference).
                        // The first read after the toggle is (re)enabled only captures a
                        // baseline, so whatever was already on the clipboard before the
                        // session — a password, say — is never pushed to the host.
                        let clipboardArmed = false;
                        const clipboardInterval = setInterval(async () => {
                            if (channel.readyState !== 'open' || !viewerMediaActiveRef.current) return;
                            if (!isClipboardSyncEnabled()) {
                                clipboardArmed = false;
                                return;
                            }
                            try {
                                const text = await readClipboardText();
                                if (!clipboardArmed) {
                                    lastClipboardRef.current = text;
                                    clipboardArmed = true;
                                    return;
                                }
                                if (text !== lastClipboardRef.current) {
                                    lastClipboardRef.current = text;
                                    sendClipboardSync(channel, text, 'desktop');
                                }
                            } catch {
                                // Clipboard can be temporarily locked by another app.
                            }
                        }, 650);

                        // Legacy (v1) host → viewer file receive. It has to hold the file
                        // in memory until the last chunk lands, so keep that as tight as
                        // possible: abandoned transfers are swept, progress only re-renders
                        // on a whole-percent change, and the chunk list is released before
                        // the joined buffer crosses IPC.
                        let viewerFileTransfers = new Map<string, { chunks: (Uint8Array | null)[], received: number, total: number, name: string, lastAt: number, lastProgress: number }>();
                        const VIEWER_FILE_STALE_MS = 120_000;

                        channel.onmessage = (e) => {
                            try {
                                // 1. Handle Binary File Chunks
                                if (e.data instanceof ArrayBuffer || e.data instanceof Blob) {
                                    const blob = e.data instanceof Blob ? e.data : new Blob([e.data]);
                                    blob.arrayBuffer().then(buf => {
                                        const view = new DataView(buf, 0, 4);
                                        const headerLen = view.getUint32(0, true);
                                        const headerStr = new TextDecoder().decode(new Uint8Array(buf, 4, headerLen));
                                        const header = JSON.parse(headerStr);
                                        const chunk = new Uint8Array(buf, 4 + headerLen);

                                        // Feature modules (file manager, camera) claim their own
                                        // frames off the bus so this handler stays one branch long.
                                        if (dispatchControlChunk(header, chunk)) return;

                                        if (header.type === 'file-chunk') {
                                            // No per-chunk logging: this handler shares the renderer
                                            // main thread with input dispatch.
                                            const transferId = header.transferId || `${header.name}-${header.totalSize || header.totalChunks}`;
                                            let transfer = viewerFileTransfers.get(transferId);
                                            if (!transfer) {
                                                // A transfer whose sender vanished used to keep every
                                                // chunk it had received for the rest of the session.
                                                const now = Date.now();
                                                for (const [staleId, stale] of viewerFileTransfers) {
                                                    if (now - stale.lastAt > VIEWER_FILE_STALE_MS) viewerFileTransfers.delete(staleId);
                                                }
                                                transfer = { chunks: new Array(header.totalChunks).fill(null), received: 0, total: header.totalChunks, name: header.name, lastAt: now, lastProgress: -1 };
                                                viewerFileTransfers.set(transferId, transfer);
                                            }

                                            if (!transfer.chunks[header.chunkIndex]) {
                                                transfer.chunks[header.chunkIndex] = chunk;
                                                transfer.received++;
                                                transfer.lastAt = Date.now();
                                                const progress = Math.round((transfer.received / transfer.total) * 100);
                                                // One root re-render per percent, not per 64 KB chunk
                                                // (a 1 GB file was ~16,000 full App renders).
                                                if (progress !== transfer.lastProgress) {
                                                    transfer.lastProgress = progress;
                                                    setFileTransferStatus({
                                                        direction: 'receive',
                                                        name: header.name,
                                                        progress,
                                                        state: 'transferring',
                                                        message: `Receiving ${header.name} from the remote computer...`,
                                                    });
                                                }
                                            }

                                            if (transfer.received === transfer.total) {
                                                const totalSize = (transfer.chunks as Uint8Array[]).reduce((acc, c) => acc + c.length, 0);
                                                const finalBuffer = new Uint8Array(totalSize);
                                                let offset = 0;
                                                for (const c of (transfer.chunks as Uint8Array[])) {
                                                    finalBuffer.set(c, offset);
                                                    offset += c.length;
                                                }
                                                // Let go of the chunk copies now: the save below clones
                                                // the joined buffer across IPC, and holding the chunks
                                                // through that made the peak three times the file size.
                                                transfer.chunks.length = 0;
                                                viewerFileTransfers.delete(transferId);

                                                // Save locally on viewer machine
                                                if (isElectron) {
                                                    (window as any).electronAPI.saveFileLocally(header.name, finalBuffer).then((path: string) => {
                                                        setFileTransferStatus({
                                                            direction: 'receive',
                                                            name: header.name,
                                                            progress: 100,
                                                            state: 'complete',
                                                            message: `Received ${header.name}.`,
                                                            path,
                                                        });
                                                        addNotification(`${header.name} arrived from the remote computer.`, 'system', 'File Received');
                                                        setTimeout(() => setFileTransferStatus(null), 5000);
                                                    }).catch((err: any) => {
                                                        setFileTransferStatus({
                                                            direction: 'receive',
                                                            name: header.name,
                                                            progress: 0,
                                                            state: 'error',
                                                            message: err?.message || `Could not save ${header.name}.`,
                                                        });
                                                    });
                                                }
                                                viewerFileTransfers.delete(transferId);
                                            }
                                        }
                                    });
                                    return;
                                }

                                // 2. Handle JSON Commands
                                const data = JSON.parse(e.data);
                                // Feature modules claim their own message families first.
                                if (dispatchControlJson(data)) return;
                                if (data.type === 'input-capabilities') {
                                    compactInputSupportedRef.current = data.compactV1 === true;
                                    if (isElectron) {
                                        (window as any).electronAPI?.log?.(`[Viewer] Compact input protocol ${compactInputSupportedRef.current ? 'enabled' : 'disabled'}.`);
                                    }
                                    return;
                                }
                                if (data.type === 'clipboard-sync' || data.type === 'clipboard') {
                                    console.debug(`[Diagnostic] DataChannel clipboard ${data.type} length=${String(data.text ?? '').length} origin=${data.origin || 'unknown'}`);
                                } else if (data.type === 'clipboard-chunk') {
                                    console.debug(`[Diagnostic] DataChannel clipboard chunk ${Number(data.chunkIndex) + 1}/${data.totalChunks} origin=${data.origin || 'unknown'}`);
                                } else if (data.type !== 'ping' && data.type !== 'cursor') {
                                    console.debug(`[Diagnostic] DataChannel JSON type=${data.type || 'unknown'}`);
                                }
                                if (data.type === 'cursor') {
                                    pendingCursorRef.current = { x: data.x, y: data.y, visible: data.visible, cursorType: data.cursorType };
                                    if (cursorRafRef.current == null) {
                                        cursorRafRef.current = requestAnimationFrame(() => {
                                            cursorRafRef.current = null;
                                            const next = pendingCursorRef.current;
                                            if (!next) return;
                                            // Only visible/cursorType are read by consumers (the
                                            // overlay dot follows the LOCAL pointer imperatively) —
                                            // bail out unless those changed, else this re-renders
                                            // the whole App at the host's 30Hz cursor cadence and
                                            // the render tasks delay outgoing input events.
                                            setRemoteCursor(prev =>
                                                (prev && prev.visible === next.visible && prev.cursorType === next.cursorType)
                                                    ? prev
                                                    : next
                                            );
                                        });
                                    }
                                } else if ((data.type === 'clipboard-sync' || data.type === 'clipboard') && data.origin !== 'desktop' && typeof data.text === 'string') {
                                    // Same toggle gates the host → viewer direction.
                                    if (isClipboardSyncEnabled()) applyRemoteClipboardSync(data.text).catch(() => {});
                                } else if (data.type === 'clipboard-chunk') {
                                    // Long text from a desktop host arrives chunked (origin 'host').
                                    if (isClipboardSyncEnabled()) handleClipboardChunk(data).catch(() => {});
                                } else if (data.type === 'file-sent') {
                                    // This is a confirmation of a file WE sent to the remote host
                                    setFileTransferStatus({ direction: 'send', name: data.name, progress: 100, state: 'complete', message: `${data.name} was saved on the remote computer.`, path: data.path });
                                } else if (data.type === 'file-transfer-start') {
                                    setFileTransferStatus({
                                        direction: 'receive',
                                        name: data.name,
                                        progress: 0,
                                        state: 'transferring',
                                        message: `Receiving ${data.name} from the remote computer...`,
                                    });
                                } else if (data.type === 'file-transfer-progress') {
                                    setFileTransferStatus({
                                        direction: data.direction === 'send' ? 'send' : 'receive',
                                        name: data.name,
                                        progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
                                        state: 'transferring',
                                        message: data.direction === 'send'
                                            ? `Sending ${data.name} to the remote computer...`
                                            : `Receiving ${data.name} from the remote computer...`,
                                    });
                                } else if (data.type === 'file-transfer-error') {
                                    setFileTransferStatus({
                                        direction: data.direction === 'send' ? 'send' : 'receive',
                                        name: data.name,
                                        progress: 0,
                                        state: 'error',
                                        message: data.message || 'File transfer failed.',
                                    });
                                } else if (data.type === 'file-transfer-cancelled') {
                                    setFileTransferStatus({
                                        direction: 'receive',
                                        progress: 0,
                                        state: 'error',
                                        message: 'The remote computer cancelled file selection.',
                                    });
                                    setTimeout(() => setFileTransferStatus(null), 3500);
                                } else if (data.type === 'whiteboard-event') {
                                    setRemoteWhiteboardEvent({ ...data, receivedAt: Date.now() });
                                } else if (data.type === 'chat') {
                                    setRemoteChatEvent({ ...data, receivedAt: Date.now() });
                                } else if (data.type === 'file-browser-list' || data.type === 'file-browser-error') {
                                    setRemoteFileBrowserEvent({ ...data, receivedAt: Date.now() });
                                } else if (data.type === 'ping') {
                                    // Intentionally no state update: the host pings every second,
                                    // and a setState here re-rendered the whole session tree at 1Hz.
                                } else if (data.type === 'input-ack') {
                                    // Host acked an injected click — feed the real input RTT
                                    // to the player's latency readout (ref call, no re-render).
                                    (videoPlayerRef.current as any)?.onInputAck?.(data.seq);
                                } else if (data.type === 'control-granted') {
                                    setHostAnnouncedControl(true);
                                    setControlStatus('granted');
                                    addNotification('You now have control of the remote computer.', 'system', 'Control Granted');
                                } else if (data.type === 'control-pending') {
                                    setHostAnnouncedControl(true);
                                    setControlStatus('pending');
                                } else if (data.type === 'control-denied') {
                                    setHostAnnouncedControl(true);
                                    setControlStatus('denied');
                                    addNotification('The remote user declined your control request. You can still view the screen.', 'system', 'Control Declined');
                                } else if (data.type === 'recording-state') {
                                    addNotification(
                                        data.on
                                            ? `${data.byName || 'Someone'} started recording this remote session.`
                                            : `${data.byName || 'Someone'} stopped recording this remote session.`,
                                        'security', data.on ? 'Recording Started' : 'Recording Stopped');
                                } else if (data.type === 'session-ended') {
                                    // The host hung up deliberately. Say so straight away
                                    // instead of leaving the last frame frozen on screen
                                    // until ICE times out.
                                    setViewerError(
                                        data.reason === 'host-ended'
                                            ? 'The person at the remote computer ended the session.'
                                            : 'The remote session was ended.'
                                    );
                                    setViewerStatus('connection_lost');
                                    setControlStatus('denied');
                                }
                            } catch (err) { }
                        };

                        channel.onopen = sendKeyframeRequest;
                        channel.onclose = () => {
                            console.log('[Renderer] Control Channel closed.');
                            clearInterval(clipboardInterval);
                        };
                    }
                };

                try {
                    console.log('[Renderer] Setting remote description (Offer)...');
                    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
                    console.log('[Renderer] Remote description set. Creating Answer...');
                    // Talk-back: if the host offered an audio m-line (Android host does), answer it
                    // sendrecv and keep the sender. No mic track is attached yet — the m-line sends
                    // silence until the operator presses Talk, which replaceTrack()s a live mic in
                    // without renegotiation. Set BEFORE createAnswer so the SDP is sendrecv.
                    try {
                        const audioTx = pc.getTransceivers().find(
                            (t) => t.receiver?.track?.kind === 'audio'
                                || (t as any).mid?.toString().includes('audio'),
                        );
                        if (audioTx) {
                            audioTx.direction = 'sendrecv';
                            talkSenderRef.current = audioTx.sender;
                        }
                    } catch (e) {
                        console.warn('[Viewer] talk-back sender setup failed:', e);
                    }
                    const answer = await pc.createAnswer();
                    console.log('[Renderer] Answer created. Setting local description...');
                    await pc.setLocalDescription(answer);
                    console.log('[Renderer] Local description set. Sending ANSWER to host...');

                    if (isElectron) {
                        (window as any).electronAPI.sendSignalingMessage({
                            type: 'answer',
                            sdp: answer.sdp,
                            sessionId: viewerSessionId,
                            targetId: hostSignalTargetId
                        });
                    }

                    console.log(`[Renderer] Draining ${candidatesBuffer.current.length} buffered candidates`);
                    candidatesBuffer.current.forEach(c => pc.addIceCandidate(c).catch(err => console.error('[Renderer] Add candidate error:', err)));
                    candidatesBuffer.current = [];
                } catch (e) {
                    console.error('[Renderer] Error in WebRTC handshake:', e);
                }

            } else if (data.type === 'ice-candidate') {
                console.log('[Renderer] Received ICE candidate from host');
                const cand: RTCIceCandidateInit = {
                    candidate: data.candidate,
                    sdpMid: data.sdpMid || data.mid,
                    sdpMLineIndex: data.sdpMLineIndex ?? 0
                };
                if (pcRef.current && pcRef.current.remoteDescription) {
                    pcRef.current.addIceCandidate(cand).catch(err => console.error('[Renderer] Add remote candidate error:', err));
                } else {
                    console.log('[Renderer] Buffering remote candidate (No remote description yet)');
                    candidatesBuffer.current.push(cand);
                }
            }
        }) : () => { };

        const removeSignalingDisconnected = isElectron ? (window as any).electronAPI.onSignalingDisconnected?.(() => {
            if (reconnectingViewerRef.current) {
                console.log('[Renderer] Ignoring signaling close during reconnect.');
                return;
            }
            console.log('[Renderer] Signaling disconnected unexpectedly.');
            setViewerStatus('connection_lost');
        }) : null;

        return () => {
            if (isElectron) {
                removeAuthSuccess?.();
                removeAuthError?.();
                removeOnboarding?.();
                removeSessionJoin?.();
                removeMeetingJoin?.();
                removeTemp2fa?.();
                removeHostListener();
                removeSignalingListener();
                if (removeSignalingDisconnected) removeSignalingDisconnected();
                if (adaptiveStatsIntervalRef.current) {
                    window.clearInterval(adaptiveStatsIntervalRef.current);
                    adaptiveStatsIntervalRef.current = null;
                }
                pcRef.current?.close();
            }
        };
    }, [sessionCode, isElectron]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setLoading(true);
        try {
            const result = await storeLogin(email, password);
            // Honour "Remember Me": persist (or clear) the email + preference so the
            // next launch prefills it. Done before the 2FA branch so it sticks either way.
            try {
                if (rememberMe) {
                    localStorage.setItem('remote365_remembered_email', email);
                    localStorage.setItem('remote365_remember_me', 'true');
                } else {
                    localStorage.removeItem('remote365_remembered_email');
                    localStorage.setItem('remote365_remember_me', 'false');
                }
            } catch { /* storage unavailable — non-fatal */ }
            if (result?.twoFactorRequired) {
                // Store handles setting temp2faToken
                return;
            }
            setAuthResult({ kind: 'success', title: 'Signed In', message: 'Welcome back. Loading your devices.' });
            setShowSplash(true);
            setCurrentView('dashboard');
            setTimeout(() => setShowSplash(false), 2000);
            localStorage.setItem('remote_link_server_ip', serverIP);
        } catch (err: any) {
            const failure = err.response?.data?.error || 'Could not sign in. Check your credentials and server status.';
            setAuthResult({ kind: 'error', title: err.response?.status === 401 ? 'Sign In Failed' : 'Could Not Sign In', message: failure });
            if (err.response?.data?.pendingVerification) {
                // The sign-up never entered its code: back to the code screen.
                // The emailed code is still valid, so nothing new is sent.
                setAuthMode('signup');
                setIsAwaitingVerification(true);
                setVerificationEmailSent(true);
                setVerificationCode('');
            }
            setAuthError(err.response?.data?.error || `Could not sign in. Check your credentials and server status.`);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setResetMsg('');
        const targetEmail = (resetEmail || email).trim().toLowerCase();
        if (!targetEmail) {
            setAuthError('Enter your account email first.');
            return;
        }
        setLoading(true);
        try {
            await api.post('/api/auth/password/forgot', { email: targetEmail });
            setResetEmail(targetEmail);
            setResetMsg('A reset code has been sent to your email. Not in your inbox? Check your spam or junk folder.');
            setAuthMode('reset');
        } catch (err: any) {
            setAuthError(err.response?.data?.error || 'Could not send reset code.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setResetMsg('');
        if (!resetEmail.trim() || !resetCode.trim() || !resetNewPassword) {
            setAuthError('Email, reset code, and new password are required.');
            return;
        }
        if (resetNewPassword.length < 8) {
            setAuthError('Password must be at least 8 characters.');
            return;
        }
        setLoading(true);
        try {
            await api.post('/api/auth/password/reset', {
                email: resetEmail.trim().toLowerCase(),
                code: resetCode.trim().toUpperCase(),
                newPassword: resetNewPassword,
            });
            setEmail(resetEmail.trim().toLowerCase());
            setPassword('');
            setResetCode('');
            setResetNewPassword('');
            setResetMsg('Password updated. Sign in with your new password.');
            setAuthMode('login');
        } catch (err: any) {
            setAuthError(err.response?.data?.error || 'Could not reset password.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2faLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (totpCode.length !== 6) return;
        setTwoFaError(null);
        setIsVerifying2fa(true);
        try {
            await storeVerify2fa(totpCode);
            setAuthResult({ kind: 'success', title: 'Signed In', message: 'Two-factor code accepted.' });
            setShowSplash(true);
            setCurrentView('dashboard');
            setTimeout(() => setShowSplash(false), 2000);
        } catch (err: any) {
            const failure = err.response?.data?.error || 'Invalid 2FA Code';
            setAuthResult({ kind: 'error', title: 'Code Not Accepted', message: failure });
            setTwoFaError(failure);
        } finally {
            setIsVerifying2fa(false);
        }
    };

    // Verification screen: resend with a cooldown so repeated clicks do not
    // spam the mailbox; the server resends the SAME code inside its window.
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleResendVerification = async () => {
        if (resendCooldown > 0 || loading) return;
        setAuthError(null);
        setLoading(true);
        try {
            const sent = await storeRequestVerification(email, businessExtras());
            setVerificationEmailSent(sent?.emailSent !== false);
            setResendCooldown(60);
        } catch (err: any) {
            setAuthError(err.response?.data?.error || 'Could not resend the verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setLoading(true);

        if (!isAwaitingVerification) {
            if (!email.trim()) {
                setAuthError('Email is required.');
                setLoading(false);
                return;
            }
            if (!password || password.length < 8) {
                setAuthError('Password must be at least 8 characters.');
                setLoading(false);
                return;
            }
            if (businessMissing()) {
                setAuthError('Please complete the company and address steps.');
                setBusinessStep(hasErrors(validateCompanyStep(business)) ? 1 : 2);
                setLoading(false);
                return;
            }
            if (signupAccountType === 'business') {
                const emailProblem = validateBusinessEmail(email);
                if (emailProblem) { setAuthError(emailProblem); setLoading(false); return; }
            }
            try {
                const sent = await storeRequestVerification(email, businessExtras());
                setVerificationEmailSent(sent?.emailSent !== false);
                setResendCooldown(60);
                setIsAwaitingVerification(true);
            } catch (err: any) {
                setAuthError(err.response?.data?.error || 'Could not send verification code.');
            } finally {
                setLoading(false);
            }
        } else {
            if (!verificationCode || verificationCode.length !== 6) {
                setAuthError('Please enter a valid 6-digit verification code.');
                setLoading(false);
                return;
            }
            try {
                const fallbackName = signupName.trim() || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Remote365 User';
                await storeRegister(fallbackName, email, password, verificationCode, businessExtras());
                setAuthResult({ kind: 'success', title: 'Account Created', message: 'Welcome to Remote365.' });
                setShowSplash(true);
                setCurrentView('dashboard');
                setTimeout(() => setShowSplash(false), 2000);
                localStorage.setItem('remote_link_server_ip', serverIP);
                setIsAwaitingVerification(false);
                setVerificationCode('');
            } catch (err: any) {
                const failure = err.response?.data?.error || 'Could not create account. Please try again.';
                setAuthResult({ kind: 'error', title: 'Sign Up Failed', message: failure });
                setAuthError(failure);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleGoogleLogin = () => {
            const oauthUrl = `${buildHttpOrigin(serverIP)}/api/auth/oauth/google?platform=desktop${authMode === 'signup' && signupAccountType === 'business' ? '&accountType=business' : ''}`;
        if (isElectron && (window as any).electronAPI?.openExternal) {
            (window as any).electronAPI.openExternal(oauthUrl);
        } else {
            window.location.href = oauthUrl;
        }
    };

    // Same hand-off as Google: the browser signs in, the server sends the
    // tokens back over the remote365://auth/callback deep link.
    const handleMicrosoftLogin = () => {
        const oauthUrl = `${buildHttpOrigin(serverIP)}/api/auth/oauth/microsoft?platform=desktop${authMode === 'signup' && signupAccountType === 'business' ? '&accountType=business' : ''}`;
        if (isElectron && (window as any).electronAPI?.openExternal) {
            (window as any).electronAPI.openExternal(oauthUrl);
        } else {
            window.location.href = oauthUrl;
        }
    };

    const copyAccessKey = () => {
        const key = String(hostAccessKey || localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, '');
        if (!key) return;
        writeClipboardText(formatCode(key));
    };

    const syncLocalHostIdentity = (accessKey: string, id?: string) => {
        const cleanKey = String(accessKey || '').replace(/\D/g, '');
        if (!cleanKey) return '';
        localStorage.setItem('remote365_device_access_key', cleanKey);
        localStorage.setItem(HOST_IDENTITY_BOOTSTRAP_MARKER, 'true');
        setHostAccessKey(cleanKey);
        setLocalAuthKey(cleanKey);
        setHostSessionId(cleanKey);
        if (id) setDeviceId(id);
        setIsLocalHostRegistered(true);
        return cleanKey;
    };

    // `silent` marks an automatic start (boot, reconnect, Easy Access) rather than
    // a click: it must never surface a modal or a scary error, and it retries on
    // its own instead of leaving the machine unreachable.
    const handleStartHosting = async (passwordOverride?: string, options?: { silent?: boolean }) => {
        if (isViewerWindow) {
            console.log('[Host-Guard] Blocked handleStartHosting in Viewer Window.');
            return;
        }
        const silent = Boolean(options?.silent);
        manuallyStoppedHost.current = false;
        setHostStatus('connecting');
        setHostError('');
        try {
            let hostingAccessKey = String(hostAccessKey || localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, '');
            if (!hostingAccessKey) {
                throw new Error('Device not yet initialized. Please wait a moment.');
            }

            // undefined = never decided here: the server keeps its own value.
            const passwordRequired = isRemotePasswordConfigured() ? isRemotePasswordRequired() : undefined;
            // When the caller just set a new password, persist that explicit value.
            // Reading `devicePassword` here would use the value captured at the time
            // this function's closure was created — stale right after setDevicePassword.
            // Guard with typeof: this function is also passed straight to onClick/props,
            // where it may be invoked with an event object instead of a password string.
            const effectivePassword = typeof passwordOverride === 'string' ? passwordOverride : devicePassword;

            // A password stored server-side is enough to host — the local copy is
            // display-only. Only ask to SET one when the server has none either.
            // Never on an automatic start: at boot the window is hidden in the
            // tray, so this modal was invisible and silently kept the machine
            // offline. Registering only makes it reachable — viewers still
            // authenticate against the server's copy — so going online without a
            // known password is safe, and the prompt can wait for the user.
            if (passwordRequired !== false && !effectivePassword && !serverHasDevicePassword && !silent) {
                setShowSetPasswordModal(true);
                setHostStatus('idle');
                return;
            }

            const machineName = await getMachineDisplayName();
            let useGuestRegistration = false;

            // Only an explicit user action (set/change password modal) may push a
            // password to the server. Routine hosting (re)starts must not resend
            // the cached copy — if it went stale (shared storage, old install),
            // resending would silently rotate the permanent backend password.
            const explicitPassword = typeof passwordOverride === 'string' ? passwordOverride : '';

            const registerGuestHost = async () => {
                const fingerprint = await getMachineFingerprint();
                const { data } = await api.post('/api/devices/self-register', {
                    accessKey: hostingAccessKey,
                    name: machineName,
                    password: explicitPassword || undefined,
                    passwordRequired,
                    deviceType: 'windows',
                    fingerprint: fingerprint || undefined,
                });
                useGuestRegistration = true;
                hostingAccessKey = syncLocalHostIdentity(data.access_key, data.id) || hostingAccessKey;
                if (data.auto_password) {
                    setDevicePassword(data.auto_password);
                    localStorage.setItem('device_password', data.auto_password);
                }
                setServerHasDevicePassword(Boolean(data.has_password));
                return data;
            };

            // Hosting should only make the machine reachable by access key. It must
            // not claim/add the machine to the signed-in account; ownership requires
            // the explicit "Add This Device" or "Register Device" actions.
            //
            // This HTTP call is a REFRESH of the device row, not a precondition for
            // presence: registration happens over the signaling socket below, using
            // the access key we already hold. Letting a failure here abort the start
            // is what kept rebooted machines offline — the request lost the race
            // against the network coming up, and nothing retried. With a known key
            // we press on and let main's reconnect supervisor do its job.
            let registration: any = null;
            try {
                registration = await registerGuestHost();
            } catch (regError: any) {
                if (!hostingAccessKey) throw regError; // no identity at all — nothing to host as
                console.warn(`[Host] Device refresh failed (${regError?.message || regError}); hosting with the known access key anyway.`);
            }
            // Don't clobber a server-issued password with the (possibly stale or
            // empty) closure value — the server's credential is the live one.
            if (!registration?.auto_password && effectivePassword) {
                localStorage.setItem('device_password', effectivePassword);
            }
            // Keep React state in sync when hosting was (re)started with a new password.
            if (!registration?.auto_password && typeof passwordOverride === 'string' && passwordOverride !== devicePassword) {
                setDevicePassword(passwordOverride);
            }
            if (deviceId && isAuthenticated && (explicitPassword || typeof passwordRequired === 'boolean')) {
                await api.post('/api/devices/set-password', {
                    deviceId,
                    // Same rule as above: never resend the cached copy — only a
                    // password the user just typed may change the stored one.
                    password: explicitPassword || undefined,
                    passwordRequired
                }).catch((error: any) => {
                    console.warn('[Host] Failed to sync password settings for owned device:', error?.message || error);
                });
            }

            if (!isElectron) {
                showError('Browser Limitation', 'Hosting features require the native desktop application.');
                setHostStatus('error');
                return;
            }
            const sessionId = await (window as any).electronAPI.startHosting(hostingAccessKey, {
                deviceName: machineName,
                quality: localStorage.getItem('remote365_video_quality') || 'ultra',
                fps: localStorage.getItem('remote365_stream_fps') || '30',
                useGuestRegistration,
            });
            console.log(`[Host] Identity Registered with signaling: ${sessionId}`);

            if (!sessionId) throw new Error('Signaling server did not return a Session ID');

            const registeredKey = syncLocalHostIdentity(String(sessionId));
            setHostStatus('status');
            autoHostRetryCount.current = 0; // back online — start the next backoff from scratch

            // Instant UI Update: Mark our local device as online in the list
            setDevices(prev => prev.map(d =>
                d.access_key === registeredKey ? { ...d, is_online: true } : d
            ));

            addNotification('This computer is online and reachable by its ID.', 'host', 'Hosting Started');

            // Update sidebar status immediately so it doesn't show "Offline"
            // Added a 1.5s retry to account for propagation delay across services/Redis
            await pollDevices();
            setTimeout(async () => {
                await pollDevices();
            }, 1500);
        } catch (e: any) {
            console.error('[Host] Start failed:', e);
            setHostError(e.message);
            if (!silent) {
                setHostStatus('error');
                addNotification(`Couldn't bring this computer online: ${e.message}`, 'system', 'Hosting Failed');
                return;
            }
            // Automatic start: retry on our own instead of leaving the device
            // unreachable. Uncapped attempts, 5s → 60s, so a machine that booted
            // without internet still comes online whenever the network returns.
            if (manuallyStoppedHost.current) {
                setHostStatus('error');
                return;
            }
            // A retry is pending, so the honest state is "connecting", not
            // "error" — and it keeps the machine out of a red, dead-looking
            // state during a slow boot.
            setHostStatus('connecting');
            const attempt = autoHostRetryCount.current;
            autoHostRetryCount.current = attempt + 1;
            const delayMs = Math.min(60000, 5000 * Math.pow(2, Math.min(attempt, 4)));
            console.warn(`[Auto-Host] Start failed (attempt ${attempt + 1}); retrying in ${delayMs / 1000}s.`);
            if (autoHostRetryTimer.current) clearTimeout(autoHostRetryTimer.current);
            autoHostRetryTimer.current = setTimeout(() => {
                autoHostRetryTimer.current = null;
                if (manuallyStoppedHost.current) return;
                handleStartHosting(undefined, { silent: true });
            }, delayMs);
        }
    };

    // Easy Access / Unattended access: one flag, many switches (Remote Support
    // toggle, landing checkbox, legacy SnowSettings, Device management). The
    // lib/easyAccess helper aligns the localStorage keys and every UI's state;
    // this single listener owns the side effects: sync passwordRequired to the
    // server and make sure the host is actually reachable when enabled.
    useEffect(() => {
        return subscribeEasyAccess((enabled, change) => {
            if (enabled) setIsAutoHostEnabled(true);
            // Easy Access toggles only the passwordRequired flag — it must not
            // resend the cached password (stale copies would rotate the stored one).
            // A change that CAME from the server is already stored there.
            const syncAsGuest = () => Promise.all([getMachineDisplayName(), getMachineFingerprint()]).then(([name, fingerprint]) => api.post('/api/devices/self-register', {
                accessKey: hostAccessKey,
                name,
                passwordRequired: !enabled,
                fingerprint: fingerprint || undefined,
            })).catch((err) => console.warn('[Easy Access] Failed to sync guest password setting:', err?.message || err));
            if (change.fromServer) {
                // nothing to send
            } else if (deviceId && isAuthenticated) {
                api.post('/api/devices/set-password', {
                    deviceId,
                    passwordRequired: !enabled,
                }).catch((err) => {
                    // set-password is owner-only. This machine is often a guest
                    // host the signed-in account does not own, so the call failed
                    // silently and the server kept asking for the password.
                    // self-register is the path that may update a guest host.
                    console.warn('[Easy Access] set-password refused, syncing as guest host:', err?.message || err);
                    if (hostAccessKey) return syncAsGuest();
                    return undefined;
                });
            } else if (hostAccessKey) {
                syncAsGuest();
            }
            if (enabled) {
                manuallyStoppedHost.current = false;
                const reachableKey = hostAccessKey || localStorage.getItem('remote365_device_access_key');
                if (reachableKey && hostStatus !== 'status') handleStartHosting(undefined, { silent: true });
            }
        });
    }, [deviceId, isAuthenticated, devicePassword, hostAccessKey, hostStatus, handleStartHosting]);

    const handleStopHosting = async () => {
        try {
            if (isElectron) {
                await (window as any).electronAPI.stopHosting();
            }
            setHostStatus('idle');

            // Instant UI Update: Mark our local device as offline in the list
            setDevices(prev => prev.map(d =>
                d.access_key === hostAccessKey ? { ...d, is_online: false } : d
            ));

            addNotification('This computer is no longer reachable by its ID.', 'host', 'Hosting Stopped');
            manuallyStoppedHost.current = true;
        } catch (e: any) {
            console.error('[Host] Stop failed:', e);
        }
    };

    useEffect(() => {
        if (!isElectron || manuallyStoppedHost.current || hasAutoStartedHost.current) return;
        if (!hostAccessKey) return;
        // Deliberately NOT gated on knowing a password any more. Registering only
        // makes the machine reachable; every viewer still authenticates against
        // the password stored server-side. The old guard meant a boot that hadn't
        // yet learned the password state (its /self-register hadn't come back, or
        // failed) never went online at all — the reboot-stays-offline bug.
        if (hostStatus !== 'idle' && hostStatus !== '') return;

        hasAutoStartedHost.current = true;
        console.log('[Auto-Host] Identity ready, initiating automatic start...');
        const timer = setTimeout(() => handleStartHosting(undefined, { silent: true }), 500);
        return () => clearTimeout(timer);
    }, [isElectron, hostAccessKey, devicePassword, hostStatus]);

    const handleFindDevice = async (overrideKey?: string) => {
        // Guard against being wired straight to onClick (React passes the event object).
        const sourceKey = typeof overrideKey === 'string' ? overrideKey : sessionCode;
        if (!sourceKey) return;
        setViewerStatus('connecting');
        setViewerError('');
        setAccessPassword('');
        setLockoutSeconds(0);
        setTargetDeviceName(null);
        setTargetPasswordRequired(true);
        setCurrentView('connect');
        try {
            const cleanKey = sourceKey.replace(/\s/g, '');
            setSessionCode(formatCode(cleanKey));
            let lookupData: any = null;
            const attempts = [
                { method: 'post', url: '/api/devices/connect/lookup', body: { accessKey: cleanKey } },
                { method: 'get', url: `/api/devices/status?key=${cleanKey}` },
                // Extra compatibility for deployments where API prefixing differs
                { method: 'post', url: '/devices/connect/lookup', body: { accessKey: cleanKey } },
                { method: 'get', url: `/devices/status?key=${cleanKey}` }
            ] as const;

            let lastErr: any = null;
            for (const attempt of attempts) {
                try {
                    const response = attempt.method === 'post'
                        ? await api.post(attempt.url, attempt.body)
                        : await api.get(attempt.url);
                    lookupData = response.data;
                    break;
                } catch (err: any) {
                    lastErr = err;
                    const status = err?.response?.status;
                    // Only fail fast on definitive server errors (not 404, not CORS/network with no response).
                    if (status && status !== 404) {
                        throw err;
                    }
                }
            }

            if (!lookupData && lastErr) {
                throw lastErr;
            }

            if (!lookupData?.exists) throw new Error('No machine found with that access key. Check and try again.');
            if (!lookupData?.online) throw new Error('That machine is offline. Ask the owner to open Remote365 and check their connection.');

            setTargetDeviceName(lookupData?.name || null);
            const requiresPassword = lookupData?.password_required !== false;
            setTargetPasswordRequired(requiresPassword);
            if (requiresPassword) {
                setViewerStep(2);
                setViewerStatus('idle');
            } else {
                await handleConnectToHost('', cleanKey);
            }
        } catch (e: any) {
            setViewerStatus('error');
            setViewerError(e.response?.data?.error || e.message || 'Failed to find device.');
        }
    };

    const handleDashboardConnect = async (accessKey: string) => {
        const cleanKey = String(accessKey || '').replace(/\D/g, '');
        if (!cleanKey) return;
        setViewerStatus('connecting');
        setViewerError('');
        setSessionCode(formatCode(cleanKey));
        setAccessPassword('');
        setTargetPasswordRequired(true);

        try {
            const linkedDevice = devices.find((device: any) => String(device.access_key || '').replace(/\D/g, '') === cleanKey);
            const { data: lookupData } = await api.post('/api/devices/connect/lookup', { accessKey: cleanKey });
            if (!lookupData?.exists) throw new Error('No machine found with that access key. Check and try again.');
            if (!lookupData?.online) throw new Error('That machine is offline. Ask the owner to open Remote365 and check their connection.');

            const deviceName = linkedDevice?.device_name || lookupData?.name || formatCode(cleanKey);
            setTargetDeviceName(deviceName);
            const linkedNeedsPasswordUpdate = Boolean(linkedDevice?.needs_password_update) || passwordUpdateKeys.includes(cleanKey);
            if (linkedNeedsPasswordUpdate) {
                setViewerStatus('idle');
                setPasswordUpdateKeys(markDeviceNeedsPasswordUpdate(cleanKey));
                setShowPasswordPrompt({
                    id: linkedDevice?.id,
                    access_key: cleanKey,
                    device_name: deviceName,
                    device_type: linkedDevice?.device_type || lookupData?.device_type || 'desktop',
                    avatar: linkedDevice?.avatar || null,
                    source: 'quick-connect', // by-ID session: lands in Quick Connect's recent list
                });
                setPromptPassword('');
                setPromptRemember(true);
                setPromptError('This device password changed. Enter the new password to reconnect.');
                return;
            }

            if (lookupData.password_required === false || lookupData.trusted === true) {
                await handleConnectToHost('', cleanKey, deviceName);
                return;
            }

            setViewerStatus('idle');
            setShowPasswordPrompt({
                id: linkedDevice?.id,
                access_key: cleanKey,
                device_name: deviceName,
                device_type: linkedDevice?.device_type || lookupData?.device_type || 'desktop',
                avatar: linkedDevice?.avatar || null,
                source: 'quick-connect', // by-ID session: lands in Quick Connect's recent list
            });
            setPromptPassword('');
            setPromptRemember(Boolean(linkedDevice?.id));
        } catch (e: any) {
            setViewerStatus('error');
            showError('Connection Failed', e.response?.data?.error || e.message || 'Failed to find device.');
        }
    };

    const handleConnectToHost = async (passwordOverride?: string, accessKeyOverride?: string, targetNameOverride?: string) => {
        const cleanAccessKey = (accessKeyOverride || sessionCode).replace(/\s/g, '');
        const passwordForRequest = passwordOverride ?? accessPassword;
        const requiresPasswordForRequest = passwordOverride === undefined ? targetPasswordRequired : false;
        if (!cleanAccessKey || (requiresPasswordForRequest && !passwordForRequest)) return;
        setViewerStatus('connecting');
        setViewerError('');
        try {
            // 1. Verify Access and Get Token
            const { data: authData } = await api.post('/api/devices/verify-access', {
                accessKey: cleanAccessKey,
                password: passwordForRequest
            });
            const resolvedDeviceName = targetNameOverride || targetDeviceName || authData?.device?.name || `Remote device ${formatCode(cleanAccessKey)}`;
            const resolvedDeviceType = showPasswordPrompt?.device_type || selectedDevice?.device_type || windowDeviceType || 'desktop';

            // Quick Connect is ephemeral — it must NOT silently add the connected
            // device to the Devices table. (Saving a device is an explicit "Add
            // Device" action.) Devices already in the table still light up as
            // "In Session" via the signaling session-status broadcast handled
            // elsewhere, so an owned device connected from here reflects correctly.
            // The connection is still recorded in Quick Connect's own recent list
            // via recordAccountRecentConnection below.

            // 2. Open a dedicated viewer window — this registers the session in
            //    viewerWindows so the main process can forward WebRTC signaling.
            if (isElectron) {
                await (window as any).electronAPI.openViewerWindow(
                    cleanAccessKey,
                    serverIP,
                    authData.token,
                    resolvedDeviceName,
                    resolvedDeviceType
                );
                recordAccountRecentConnection(cleanAccessKey, resolvedDeviceName || undefined);
                // Reset state — the session lives in the viewer window now.
                setViewerStatus('idle');
                setViewerStep(1);
                setSessionCode('');
                setAccessPassword('');
                setTargetDeviceName(null);
                setTargetPasswordRequired(true);
                setShowAuthModal(false);
            } else {
                showError('Browser Limitation', 'Remote viewer connections require the native desktop application.');
                setViewerStatus('error');
            }
        } catch (e: any) {
            setViewerStatus('error');
            if (e.response?.status === 429) {
                const retryAfter = Number(e.response?.data?.retryAfter || 0);
                setLockoutSeconds(retryAfter > 0 ? retryAfter : 300);
            }
            setViewerError(e.response?.data?.error || e.message || 'Connection failed.');
        }
    };

    const handleReestablishSession = async () => {
        if (!isViewerWindow) {
            await handleFindDevice();
            return;
        }
        if (!isElectron) return;

        const params = new URLSearchParams(window.location.search);
        const sid = params.get('sessionId') || sessionCode.replace(/\s/g, '');
        const sip = normalizeServerHost(params.get('serverIP') || serverIP || DEFAULT_SERVER_HOST);
        const tok = params.get('token') || localStorage.getItem('viewer_token') || '';
        if (!sid || !tok) {
            setViewerStatus('connection_lost');
            setViewerError('This viewer window does not have enough session information to reconnect.');
            return;
        }

        reconnectingViewerRef.current = true;
        cleanupViewerConnection();
        setViewerStatus('connecting');
        viewerPipelineTimelineRef.current = {
            startedAt: Date.now(),
            offerAt: 0,
            connectedAt: 0,
            trackAt: 0,
        };
        firstFramePresentedRef.current = false;
        lastAdaptiveModeRef.current = 'balanced';
        lastIceRouteRef.current = '';
        lastIceRouteTopologyRef.current = '';
        setViewerError('');
        setSessionCode(formatCode(sid));
        setServerIP(sip);
        void fetchIceServers(); // warm the cache so the offer handler doesn't block on it
        try {
            await (window as any).electronAPI.connectToHost(sid, sip, tok, viewerClientId, String(localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, ''));
        } catch (error: any) {
            reconnectingViewerRef.current = false;
            setViewerStatus('connection_lost');
            setViewerError(error?.message || 'Could not re-establish the remote session.');
        }
    };

    useEffect(() => {
        if (lockoutSeconds <= 0) return;
        const timer = window.setInterval(() => {
            setLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [lockoutSeconds]);

    const formatCode = (code: string) => {
        if (!code) return '';
        const clean = code.replace(/[^0-9]/g, '');
        if (clean.length === 9) {
            return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
        }
        return clean.match(/.{1,3}/g)?.join(' ') || clean;
    };

    if (isMeetingWindow) {
        return activeMeetingId ? (
            <React.Suspense fallback={<LazyScreenFallback />}>
                <SnowMeeting
                    meetingId={activeMeetingId}
                    claimHost={meetingClaimHost}
                    onLeave={() => window.close()}
                    hostAccessKey={hostAccessKey}
                    devicePassword={devicePassword}
                    serverIP={serverIP}
                />
            </React.Suspense>
        ) : (
            <div className="h-screen bg-[#0A0A0A] text-white flex items-center justify-center text-sm">
                Opening Meeting...
            </div>
        );
    }

    if (isHostWaitWindow) {
        const code = windowParams.get('sessionCode') || '';
        const name = windowParams.get('sessionName') || '';
        return (
            <HostWaitingView
                sessionName={name || undefined}
                sessionCode={formatCode(code)}
                onCancel={() => window.close()}
            />
        );
    }

    // --- V8 ABSOLUTE PRIORITY ROUTING: Bypass EVERYTHING for Viewer Windows ---
    if (isViewerWindow || viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connection_lost') {
        return (
            <div className="h-screen bg-white flex flex-col relative overflow-hidden cursor-default">
                {viewerStatus === 'connection_lost' && (
                    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-white font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in duration-500">
                        {/* Orange glow */}
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1/2 top-[-400px] h-[517px] w-[1748px] max-w-none -translate-x-1/2 rounded-[50%]"
                            style={{
                                background: 'linear-gradient(360deg, rgba(255,255,255,0.375) -16.83%, rgba(255,179,71,0.6) 29.84%, rgba(255,138,0,0.75) 76.5%)',
                                filter: 'blur(39.5px)',
                            }}
                        />

                        <div className="relative flex w-[377px] max-w-[90vw] flex-col items-center gap-[60px]">
                            <div className="flex flex-col items-center gap-[45px]">
                                <img src={faultIllustration} alt="" draggable={false} className="w-[251px] max-w-full select-none" />
                                <div className="flex flex-col items-center gap-3.5 text-center">
                                    <h2 className="text-[24px] font-medium leading-[34px] text-black">Connection Fault</h2>
                                    <p className="text-[14px] leading-5 text-black">The remote node has severed the secure link.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <button
                                    onClick={isViewerWindow ? endViewerSession : handleDisconnect}
                                    className="flex h-10 w-[180px] items-center justify-center rounded border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                                >
                                    Terminate
                                </button>
                                <button
                                    onClick={handleReestablishSession}
                                    className="flex h-10 w-[180px] items-center justify-center rounded text-[14px] font-medium text-[#111315] transition hover:brightness-105"
                                    style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                                >
                                    Re-Establish
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-grow flex flex-col min-h-0">
                    <VideoPlayer
                        mediaActive={viewerMediaActive}
                        ref={videoPlayerRef}
                        viewerStatus={viewerStatus}
                        setViewerStatus={setViewerStatus}
                        sessionCode={sessionCode}
                        onDisconnect={isViewerWindow ? endViewerSession : handleDisconnect}
                        remoteStream={remoteStream}
                        deviceType={isViewerWindow ? (windowDeviceType || 'desktop') : selectedDevice?.device_type}
                        deviceName={isViewerWindow ? windowDeviceName : (selectedDevice?.device_name || 'Remote Node')}
                        remoteCursor={remoteCursor}
                        controlStatus={hostAnnouncedControl ? controlStatus : 'granted'}
                        remoteWhiteboardEvent={remoteWhiteboardEvent}
                        remoteChatEvent={remoteChatEvent}
                        remoteFileBrowserEvent={remoteFileBrowserEvent}
                        fileTransferStatus={fileTransferStatus}
                        setFileTransferStatus={setFileTransferStatus}
                        connectionHealth={connectionHealth}
                        onBoostConnection={boostConnection}
                        onFirstFramePresented={handleFirstFramePresented}
                        onControlEvent={onControlEvent}
                        controlChannelRef={controlChannelRef}
                        talkActive={talkActive}
                        onToggleTalk={toggleTalk}
                    />
                </div>
            </div>
        );
    }


    if (onboardingToken) {
        return (
            <>
                <UpdateBanner />
                <SnowOnboard token={onboardingToken} onComplete={() => setOnboardingToken(null)} />
            </>
        );
    }

    // Super Admins get a completely separate console (own sidebar, nav and pages),
    // gated by role. Falls through to the normal app for everyone else.
    if (isAuthenticated && !isViewerWindow && String(user?.role || '').toUpperCase() === 'SUPER_ADMIN') {
        return (
            <React.Suspense fallback={<LazyScreenFallback />}>
                <SuperAdminConsole user={user} onLogout={handleLogout} />
            </React.Suspense>
        );
    }

    if (!isAuthenticated && showAuthModal) {
        if (temp2faToken) {
            return (
                <div className="h-screen w-full flex items-center justify-center bg-white font-inter select-none">
                    <UpdateBanner />
                    <AuthResultModal state={authResult} onClose={() => setAuthResult(null)} />
                    <div className="w-full max-w-sm p-8 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center gap-3 mb-10 group cursor-default">
                            <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] flex items-center justify-center shadow-xl shadow-black/10 transition-transform duration-300 overflow-hidden border border-white/5">
                                <img src={logo} alt="Remote365" className="w-10 h-10 object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-[#1C1C1C] tracking-tighter leading-none">Remote365</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1C1C1C] mt-1">Verification Required</span>
                            </div>
                        </div>

                        <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">Two-Factor Auth</h1>
                        <p className="text-sm font-medium text-[#1C1C1C] mb-8 leading-relaxed">
                            Open your authenticator app and enter the 6-digit verification code.
                        </p>

                        <form onSubmit={handleVerify2faLogin} className="space-y-6">
                            <div className="space-y-1.5">
                                <input
                                    autoFocus
                                    type="text"
                                    maxLength={6}
                                    placeholder="000 000"
                                    className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.15)] text-[#1C1C1C] rounded-[24px] px-4 py-5  
 text-3xl font-mono font-bold tracking-[0.2em] focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[#000000]"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                            </div>

                            {twoFaError && (
                                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in duration-200">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                    <p className="text-xs font-semibold text-red-600 leading-relaxed">{twoFaError}</p>
                                </div>
                            )}

                            <button type="submit" disabled={isVerifying2fa || totpCode.length !== 6} className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl font-bold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {isVerifying2fa ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                VERIFY & CONTINUE
                            </button>

                            <button
                                type="button"
                                onClick={() => setTemp2faToken(null)}
                                className="w-full text-xs font-bold text-[#1C1C1C] hover:text-[#1C1C1C] uppercase tracking-widest transition-colors"
                            >
                                Back To Sign In
                            </button>
                        </form>
                    </div>
                </div>
            );
        }
         return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#FFFFFF] select-none overflow-y-auto overflow-x-hidden relative py-16">
                {/* Ellipse 1 gradient background */}
                <div className="absolute pointer-events-none" style={{
                    width: 'calc(100% + 80px)', height: '517px', left: '-40px', top: '-400px',
                    background: 'linear-gradient(360deg, rgba(255, 255, 255, 0.375) -16.83%, rgba(255, 179, 71, 0.6) 29.84%, rgba(255, 138, 0, 0.75) 76.5%)',
                    filter: 'blur(39.5px)'
                }} />

                <UpdateBanner />
                {/* Sign-in / sign-up outcome (animated tick or cross) */}
                <AuthResultModal state={authResult} onClose={() => setAuthResult(null)} />
                <SnowSplashScreen isReady={!loading} />
                
                {/* Back button at top left */}
                <button
                    type="button"
                    onClick={() => {
                        setShowAuthModal(false);
                        setAuthMode('login');
                        setAuthError(null);
                    }}
                    className="absolute left-[80px] top-[60px] flex items-center gap-2 group z-20 hover:opacity-80 transition-opacity"
                >
                    <ArrowLeft size={16} color="#000000" />
                    <span style={{ fontFamily: "'Mona Sans', sans-serif", fontSize: '14px', fontWeight: 400, color: '#000000' }}>Back</span>
                </button>
                <button
                    type="button"
                    onClick={() => setShowLandingHelp(true)}
                    className="absolute right-[80px] top-[60px] z-20 flex h-8 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.15)] bg-white/70 px-3 text-[13px] font-medium text-[#1A1D21] hover:border-[#FF8A00] hover:text-[#FF8A00]"
                    title="Help And Support"
                >
                    <CircleHelp size={15} /> Help
                </button>
                <LandingHelpModal open={showLandingHelp} onClose={() => setShowLandingHelp(false)} />

                {/* Sign in modal */}
                <div className="flex flex-col items-center bg-transparent relative z-10" style={{
                    width: '468px', 
                    minHeight: '468px',
                    padding: '12px 24px',
                    fontFamily: "'Mona Sans', sans-serif"
                }}>
                    {/* Frame 1160445133 (Logo & Headers) */}
                    <div className="flex flex-col items-center gap-[12px] w-[420px] mb-4">
                        {/* Logo Frame 87 */}
                        <div className="w-[40px] h-[40px] flex items-center justify-center">
                            <img src={logo} alt="Remote365" className="w-full h-full object-contain" />
                        </div>

                        {/* Account toggle / mode caption */}
                        <div className="w-[420px] h-[24px] flex items-center justify-center gap-1" style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', color: 'rgba(26, 29, 33, 0.5)' }}>
                            {(authMode === 'login' || authMode === 'signup') ? (
                                <>
                                    <span>{authMode === 'login' ? "Don't have an account?" : 'Already Have An Account?'}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                            setIsAwaitingVerification(false);
                                            setVerificationCode('');
                                            setAuthError(null);
                                        }}
                                        className="hover:underline"
                                        style={{ color: '#FF8A00', fontWeight: 600 }}
                                    >
                                        {authMode === 'login' ? 'Create Account' : 'Sign In'}
                                    </button>
                                </>
                            ) : authMode === 'connect' ? (
                                <span>Guest Access</span>
                            ) : (
                                <>
                                    <span>{authMode === 'forgot' ? 'Recover Account' : 'Update Password'}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthMode('login');
                                            setAuthError(null);
                                            setResetMsg('');
                                        }}
                                        className="hover:underline"
                                        style={{ color: '#FF8A00', fontWeight: 600 }}
                                    >
                                        Back To Sign In
                                    </button>
                                </>
                            )}
                        </div>

                        {(authMode === 'forgot' || authMode === 'reset') && (
                            <div style={{ width: '209px', height: '20px', fontSize: '14px', textAlign: 'center', color: '#000000' }}>
                                {authMode === 'forgot' ? 'Reset your password.' : 'Enter your new password.'}
                            </div>
                        )}
                    </div>

                    <div className="w-[420px]" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
                    {authMode === 'connect' ? (
                        /* --- GUEST CONNECT FLOW (Two-Step Implementation) --- */
                        <div className="animate-in fade-in duration-300">
                            {viewerStep === 1 ? (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <div style={{ fontSize: '14px', color: '#111315', height: '24px' }}>Device Access Key</div>
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Placeholder"
                                            className="w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-4 py-2 text-sm focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                            style={{ height: '40px' }}
                                            value={sessionCode}
                                            onChange={e => setSessionCode(formatCode(e.target.value))}
                                            onKeyDown={e => { if (e.key === 'Enter') handleFindDevice(); }}
                                            maxLength={11}
                                        />
                                    </div>
                                    {viewerError && <p className="text-[11px] text-red-500 font-medium">{viewerError}</p>}
                                    <button
                                        type="button"
                                        onClick={() => handleFindDevice()}
                                        disabled={viewerStatus === 'connecting' || !sessionCode}
                                        style={{ 
                                            fontFamily: "'Mona Sans', sans-serif",
                                            background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)',
                                            height: '40px',
                                            borderRadius: '4px',
                                            color: '#111315',
                                            fontWeight: 500,
                                            fontSize: '14px'
                                        }}
                                        className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {viewerStatus === 'connecting' ? 'Loading...' : 'Continue'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-1.5">
                                        <div style={{ fontSize: '14px', color: '#111315', height: '24px' }}>Device Password</div>
                                        <input
                                            autoFocus
                                            type="password"
                                            placeholder="Placeholder"
                                            className="w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-4 py-2 text-sm focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                            style={{ height: '40px' }}
                                            value={accessPassword}
                                            onChange={e => setAccessPassword(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleConnectToHost(); }}
                                        />
                                    </div>
                                    {viewerError && <p className="text-[11px] text-red-500 font-medium">{viewerError}</p>}
                                    <button
                                        type="button"
                                        onClick={() => handleConnectToHost()}
                                        disabled={viewerStatus === 'connecting' || !accessPassword}
                                        style={{ 
                                            fontFamily: "'Mona Sans', sans-serif",
                                            background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)',
                                            height: '40px',
                                            borderRadius: '4px',
                                            color: '#111315',
                                            fontWeight: 500,
                                            fontSize: '14px'
                                        }}
                                        className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {viewerStatus === 'connecting' ? 'Loading...' : 'Connect'}
                                    </button>
                                    <button onClick={() => setViewerStep(1)} style={{ fontFamily: "'Mona Sans', sans-serif" }} className="w-full text-[12px] font-bold text-[#FF8A00] hover:underline transition-colors mt-2">
                                        ← Change Access Key
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : authMode === 'forgot' ? (
                        <div className="animate-in fade-in duration-300">
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                                <div className="space-y-1.5">
                                    <div style={{ fontSize: '14px', color: '#111315', height: '24px' }}>Account Email</div>
                                    <input
                                        autoFocus
                                        type="email"
                                        required
                                        value={resetEmail || email}
                                        onChange={e => {
                                            setResetEmail(e.target.value);
                                            setEmail(e.target.value);
                                        }}
                                        placeholder="name@gmail.com"
                                        className="w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-4 py-2 text-sm focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                        style={{ height: '40px' }}
                                    />
                                </div>
                                {authError && <p className="text-[11px] text-red-500 font-medium">{authError}</p>}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ 
                                        fontFamily: "'Mona Sans', sans-serif",
                                        background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)',
                                        height: '40px',
                                        borderRadius: '4px',
                                        color: '#111315',
                                        fontWeight: 500,
                                        fontSize: '14px'
                                    }}
                                    className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Loading...' : 'Send Reset Code'}
                                </button>
                            </form>
                        </div>
                    ) : authMode === 'reset' ? (
                        <div className="animate-in fade-in duration-300">
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <div style={{ fontSize: '14px', color: '#111315', height: '24px' }}>Reset Code</div>
                                        <input
                                            autoFocus
                                            type="text"
                                            maxLength={6}
                                            required
                                            value={resetCode}
                                            onChange={e => setResetCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
                                            placeholder="ABC123"
                                            className="w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-4 py-4 text-center text-xl font-mono font-bold tracking-[0.18em] focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                            style={{ height: '40px' }}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div style={{ fontSize: '14px', color: '#111315', height: '24px' }}>New Password</div>
                                        <div className="relative w-full h-[40px]">
                                            <input
                                                type={showResetPassword ? "text" : "password"}
                                                required
                                                value={resetNewPassword}
                                                onChange={e => setResetNewPassword(e.target.value)}
                                                placeholder="At Least 8 Characters"
                                                className="w-full h-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] pl-4 pr-[44px] py-2 text-sm focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowResetPassword(!showResetPassword)}
                                                className="absolute right-[16px] top-1/2 -translate-y-1/2 flex items-center justify-center"
                                                title={showResetPassword ? "Hide Password" : "Show Password"}
                                                aria-label={showResetPassword ? "Hide Password" : "Show Password"}
                                            >
                                                {showResetPassword ? <EyeOff size={16} color="#111315" /> : <Eye size={16} color="#111315" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {resetMsg && <p className="text-[11px] text-emerald-600 font-medium" style={{ fontFamily: "'Mona Sans', sans-serif" }}>{resetMsg}</p>}
                                {authError && <p className="text-[11px] text-red-500 font-medium">{authError}</p>}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        fontFamily: "'Mona Sans', sans-serif",
                                        background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)',
                                        height: '40px',
                                        borderRadius: '4px',
                                        color: '#111315',
                                        fontWeight: 500,
                                        fontSize: '14px'
                                    }}
                                    className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Loading...' : 'Update Password'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        /* --- LOGIN / SIGNUP FLOW (Card Style) --- */
                        <div className="animate-in fade-in duration-300">
                            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-[16px]">
                                {authMode === 'signup' && !isAwaitingVerification && (
                                    <div className="flex rounded-[4px] border border-[rgba(26,29,33,0.3)] p-[3px]">
                                        {(['personal', 'business'] as const).map((kind) => (
                                            <button
                                                key={kind}
                                                type="button"
                                                onClick={() => { setSignupAccountType(kind); setBusinessStep(1); setAuthError(null); }}
                                                className={`flex h-8 flex-1 items-center justify-center rounded-[3px] text-[13px] font-medium transition-colors ${signupAccountType === kind ? 'bg-[#111315] text-white' : 'text-[#111315] hover:bg-[#F3F4F6]'}`}
                                            >
                                                {kind === 'personal' ? 'Sign Up Personal Account' : 'Sign Up Business Account'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {authMode === 'signup' && signupAccountType === 'business' && !isAwaitingVerification && (
                                    <BusinessStepper step={businessStep} steps={['Company', 'Address', 'Account']} onStep={setBusinessStep} />
                                )}
                                {authMode === 'signup' && signupAccountType === 'business' && !isAwaitingVerification && businessStep < 3 && (
                                    <BusinessSignupSteps
                                        form={business}
                                        onChange={(key, value) => updateBusiness(key, value)}
                                        step={businessStep}
                                        setStep={setBusinessStep}
                                        labels={{ steps: ['Company', 'Address', 'Account'], companyName: 'Company Name', businessNumber: 'Business No.', website: 'Company Website', country: 'Country', state: 'State', province: 'Province', city: 'City', address: 'Address', zip: 'Zip Code', next: 'Next', back: 'Back' }}
                                        inputClass="w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-[16px] py-[8px] text-[14px] focus:border-orange-500 outline-none"
                                    />
                                )}
                                <div className={authMode === 'signup' && signupAccountType === 'business' && !isAwaitingVerification && businessStep < 3 ? 'hidden' : 'contents'}>
                                {authMode === 'signup' && isAwaitingVerification ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="space-y-1.5">
                                            <div style={{ fontSize: '14px', color: '#111315', height: '24px' }}>Verification Code</div>
                                            <input
                                                autoFocus
                                                inputMode="numeric"
                                                type="text"
                                                maxLength={6}
                                                required
                                                value={verificationCode}
                                                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="000000"
                                                className="w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-4 py-4 text-center text-xl font-mono font-bold tracking-[0.2em] focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                                style={{ height: '40px' }}
                                            />
                                        </div>
                                        <p style={{ fontFamily: "'Mona Sans', sans-serif", fontSize: '12px', lineHeight: '17px', color: 'rgba(26, 29, 33, 0.6)', margin: 0 }}>
                                            {verificationEmailSent
                                                ? <>We emailed a 6-digit code to <strong style={{ color: '#111315' }}>{email}</strong>. It stays valid for 10 minutes. Not in your inbox? Check your spam or junk folder.</>
                                                : <span style={{ color: '#B45309' }}>We could not send the email right now. Please try again in a few minutes or contact support.</span>}
                                        </p>
                                        <div className="flex items-center justify-between" style={{ fontFamily: "'Mona Sans', sans-serif", fontSize: '13px' }}>
                                            <button type="button" onClick={() => { setIsAwaitingVerification(false); setVerificationCode(''); setAuthError(null); }} className="hover:underline" style={{ color: 'rgba(26, 29, 33, 0.7)', fontWeight: 500 }}>
                                                Back
                                            </button>
                                            <button type="button" onClick={handleResendVerification} disabled={resendCooldown > 0 || loading} className="hover:underline disabled:opacity-50 disabled:no-underline" style={{ color: '#FF8A00', fontWeight: 600 }}>
                                                {resendCooldown > 0 ? `Resend Code In ${resendCooldown}s` : 'Resend Code'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Email Input */}
                                        <div className="flex flex-col gap-[8px]">
                                            <div style={{ fontSize: '14px', fontWeight: 400, color: '#111315', height: '24px' }}>{authMode === 'signup' && signupAccountType === 'business' ? 'Company Email' : 'Email'}</div>
                                            <input
                                                type="email" required
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder={authMode === 'signup' && signupAccountType === 'business' ? 'name@company.com' : 'name@gmail.com'}
                                                className="w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-[16px] py-[8px] text-[14px] focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                                style={{ height: '40px' }}
                                            />
                                        </div>

                                        {/* Password Input */}
                                        <div className="flex flex-col gap-[8px]">
                                            <div style={{ fontSize: '14px', fontWeight: 400, color: '#111315', height: '24px' }}>Password</div>
                                            <div className="relative w-full h-[40px]">
                                                <input
                                                    type={showLoginPassword ? "text" : "password"} 
                                                    required
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    placeholder="Enter Your Password"
                                                    className="w-full h-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-[16px] py-[8px] text-[14px] focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                                                    className="absolute right-[16px] top-1/2 -translate-y-1/2 flex items-center justify-center"
                                                >
                                                    {showLoginPassword ? <EyeOff size={16} color="#111315" /> : <Eye size={16} color="#111315" />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Remember Me & Forgot Password */}
                                {authMode === 'login' && !isAwaitingVerification && (
                                    <div className="flex justify-between items-center w-full h-[24px]">
                                        <label className="flex items-center cursor-pointer h-[24px] gap-[4px]">
                                            <div className="relative w-[20px] h-[20px] flex items-center justify-center">
                                                <div className={`absolute w-[15px] h-[15px] rounded-[2px] transition-colors ${rememberMe ? 'bg-[#FF8A00]' : 'bg-[rgba(26,29,33,0.3)]'}`} />
                                                {rememberMe && (
                                                    <svg className="absolute z-[5] pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                )}
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={e => setRememberMe(e.target.checked)}
                                                    className="absolute w-[20px] h-[20px] opacity-0 cursor-pointer m-0 z-10"
                                                />
                                            </div>
                                            <span style={{ fontFamily: "'Mona Sans', sans-serif", fontSize: '13px', color: '#1A1D21' }}>Remember Me</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setResetEmail(email);
                                                setResetMsg('');
                                                setAuthError(null);
                                                setAuthMode('forgot');
                                            }}
                                            className="hover:underline"
                                            style={{ fontFamily: "'Mona Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#FF8A00' }}
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                )}

                                {authError && <p className="text-[11px] text-red-500 font-medium" style={{ fontFamily: "'Mona Sans', sans-serif" }}>{authError}</p>}
                                {resetMsg && authMode === 'login' && <p className="text-[11px] text-emerald-600 font-medium" style={{ fontFamily: "'Mona Sans', sans-serif" }}>{resetMsg}</p>}

                                {/* Sign In Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ 
                                        fontFamily: "'Mona Sans', sans-serif",
                                        background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)',
                                        height: '40px',
                                        borderRadius: '4px',
                                        color: '#111315',
                                        fontWeight: 500,
                                        fontSize: '14px'
                                    }}
                                    className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
                                >
                                    {loading ? 'Loading...' : authMode === 'signup' && isAwaitingVerification ? 'Verify And Sign In' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
                                </button>
                                
                                </div>
                                {/* OR Separator */}
                                <div className="flex items-center gap-4 w-full h-[20px]">
                                    <div className="flex-grow h-[1px] bg-[rgba(26,29,33,0.3)]"></div>
                                    <span style={{ fontFamily: "'Mona Sans', sans-serif", fontSize: '14px', color: 'rgba(26, 29, 33, 0.3)' }}>Or</span>
                                    <div className="flex-grow h-[1px] bg-[rgba(26,29,33,0.3)]"></div>
                                </div>

                                {/* Continue with Google */}
                                <button
                                    type="button"
                                    onClick={() => handleGoogleLogin()}
                                    style={{ 
                                        height: '40px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(26, 29, 33, 0.3)',
                                        fontFamily: "'Mona Sans', sans-serif",
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: '#111315'
                                    }}
                                    className="w-full flex items-center justify-center gap-[12px] hover:bg-slate-50 transition-colors"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    {authMode === 'signup' ? 'Sign Up With Google' : 'Sign In With Google'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleMicrosoftLogin()}
                                    style={{
                                        height: '40px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(26, 29, 33, 0.3)',
                                        fontFamily: "'Mona Sans', sans-serif",
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: '#111315'
                                    }}
                                    className="w-full flex items-center justify-center gap-[12px] hover:bg-slate-50 transition-colors"
                                >
                                    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                                        <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                                        <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                                        <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                                        <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                                    </svg>
                                    {authMode === 'signup' ? 'Sign Up With Microsoft' : 'Sign In With Microsoft'}
                                </button>
                            </form>
                        </div>
                    )}
                    </div>

                    {/* Footer Text */}
                    {authMode !== 'connect' && authMode !== 'forgot' && authMode !== 'reset' && (
                        <div style={{ 
                            width: '253px', 
                            marginTop: 'auto',
                            paddingTop: '24px',
                            fontFamily: "'Mona Sans', sans-serif", 
                            fontSize: '12px', 
                            lineHeight: '17px',
                            textAlign: 'center',
                            color: '#000000'
                        }}>
                            By signing in, you acknowledge that your data may be processed in accordance with our terms.
                        </div>
                    )}
                </div>

                {/* Footer links for non-auth modes */}
                {(authMode !== 'login' && authMode !== 'signup') && (
                    <div className="absolute bottom-8 w-full flex justify-center gap-6 text-[11px] text-slate-400 font-bold" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
                        <button className="hover:text-slate-600">Imprint</button>
                        <button className="hover:text-slate-600">Privacy Policy</button>
                        <button className="hover:text-slate-600">Copyright</button>
                    </div>
                )}
            </div>
        );

    }

    const deviceStatusLabel =
        hostStatus === 'status' ? t('online_and_ready', user?.language) :
        hostStatus === 'connecting' ? t('connecting_status', user?.language) :
        hostStatus === 'error' ? t('connection_issue', user?.language) :
        t('offline_status', user?.language);
    const deviceStatusDot =
        hostStatus === 'status' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]' :
        hostStatus === 'connecting' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)] animate-pulse' :
        hostStatus === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]' :
        'bg-gray-300';
    const hasAcceptedContacts = chatConversations.some((conversation) => {
        if (conversation.isGroup) return false;
        if ((conversation.status || 'ACCEPTED') !== 'ACCEPTED') return false;
        return conversation.participants?.some((participant) => participant.userId !== user?.id);
    });
    const hasRemoteAccessSetup = Boolean(localAuthKey || hostAccessKey || localStorage.getItem('remote365_device_access_key')) &&
        (isAutoHostEnabled || isLocalHostRegistered || hostStatus === 'status');
    const supportIdentifierValue = formatCode(hostAccessKey || localAuthKey || localStorage.getItem('remote365_device_access_key') || '--- --- ---');

    const openCreateSessionFromDashboard = () => {
        setCurrentView('meetings');
    };

    const openJoinSessionFromDashboard = () => {
        setCurrentView('meetings');
    };

    const searchableActions = [
        ...(canUseRemoteSupportView ? [{ id: 'connect', label: 'Remote Support', detail: 'Connect With Remote365 ID', icon: Network, run: () => setCurrentView('connect') }] : []),
        ...(canSeeDevicesView ? [{ id: 'devices', label: 'Devices', detail: 'View And Manage Devices', icon: Monitor, run: () => setCurrentView('devices') }] : []),
        { id: 'chat', label: 'Chat', detail: 'Open Direct Messages And Groups', icon: MessageSquare, run: () => setCurrentView('chat' as any) },
        { id: 'meetings', label: 'Meetings', detail: 'Join Or Create Meetings', icon: Video, run: () => setCurrentView('meetings') },
        { id: 'create-session', label: 'Create A Session', detail: 'Invite Someone To Remote Support', icon: Plus, run: openCreateSessionFromDashboard },
        { id: 'join-session', label: 'Join A Session', detail: 'Enter A Support Session Code', icon: Radio, run: openJoinSessionFromDashboard },
        { id: 'settings', label: 'Settings', detail: 'Open App Preferences', icon: Settings, run: () => setCurrentView('settings') },
        { id: 'help', label: 'Help', detail: 'Open Support Options', icon: HelpCircle, run: () => setCurrentView('support') },
        { id: 'feedback', label: 'Feedback', detail: 'Open Support And Feedback', icon: MessageCircle, run: () => setCurrentView('support') },
        // EVERY device, not the first 8. The old slice meant that on a fleet of
        // any size most devices could not be found by any query at all — which
        // reads as "the search needs the exact full name" when really the row
        // was never a candidate.
        ...(canSeeDevicesView ? devices.map((device) => {
            const deviceName = device.device_name || device.name || formatCode(device.access_key || '');
            return {
                id: `device-${device.id || device.access_key}`,
                label: deviceName,
                detail: `Device ${formatCode(device.access_key || '')}`,
                // Raw (unspaced) ID so typing "123456789" matches the grouped
                // "123 456 789" we display.
                keywords: `${device.access_key || ''} ${device.device_type || ''} ${device.status || ''}`,
                weight: 60,
                icon: Monitor,
                run: () => {
                    setSearchQuery(deviceName || device.access_key || '');
                    setCurrentView('devices');
                },
            };
        }) : []),
        // The placeholder promises contacts and groups; before this they were
        // not searchable at all.
        ...chatConversations.filter((conversation: any) => !conversation.isGroup).map((conversation: any) => {
            const other = conversation.participants?.find((participant: any) => participant.userId !== user?.id);
            const name = other?.nickname || other?.user?.name || other?.user?.email || 'Contact';
            return {
                id: `contact-${conversation.id}`,
                label: name,
                detail: other?.user?.email ? `Contact ${other.user.email}` : 'Contact',
                keywords: other?.user?.email || '',
                weight: 40,
                icon: User,
                run: () => setCurrentView('chat' as any),
            };
        }),
        ...chatConversations.filter((conversation: any) => conversation.isGroup).map((conversation: any) => ({
            id: `chatgroup-${conversation.id}`,
            label: conversation.title || 'Group Chat',
            detail: 'Group Chat',
            weight: 30,
            icon: MessageSquare,
            run: () => setCurrentView('chat' as any),
        })),
        ...(canSeeDevicesView ? accountDeviceGroups.map((group: any) => ({
            id: `devicegroup-${group.id || group.name}`,
            label: group.name || 'Device Group',
            detail: 'Device Group',
            weight: 35,
            icon: Monitor,
            run: () => {
                setSearchQuery(group.name || '');
                setCurrentView('devices');
            },
        })) : []),
    ];
    // Ranked, typo-tolerant, order-independent matching — see globalSearch.ts.
    const topSearchResults = searchCandidates(searchableActions as any, topSearchQuery, 12) as typeof searchableActions;
    const runTopSearchAction = (action?: typeof searchableActions[number], directConnect = user?.searchBehavior === 'Direct connect') => {
        const clean = topSearchQuery.replace(/\D/g, '');
        if (!action && directConnect && clean.length >= 6) {
            if (!canUseRemoteSupportView) {
                showError('Access Denied', 'You do not have permission to start remote sessions. Ask your organization owner for access.');
                setTopSearchQuery('');
                return;
            }
            handleFindDevice(clean);
            setTopSearchQuery('');
            return;
        }
        if (!action) action = topSearchResults[0];
        if (!action) return;
        action.run();
        setTopSearchQuery('');
    };
    const presenceOptions = [
        { id: 'online', label: 'Online', icon: Wifi, dot: 'bg-[#71DD8C]' },
        { id: 'away', label: 'Away', icon: Clock3, dot: 'bg-amber-400' },
        { id: 'busy', label: 'Do Not Disturb', icon: MinusCircle, dot: 'bg-red-500' },
        { id: 'invisible', label: 'Invisible', icon: MonitorOff, dot: 'bg-gray-400' },
    ] as const;
    const activePresence = presenceOptions.find((option) => option.id === userPresence) || presenceOptions[0];
    const setPresence = (presence: typeof userPresence) => {
        setUserPresence(presence);
        localStorage.setItem('remote365_presence', presence);
    };
    const archivedDeviceKeys = getArchivedDeviceKeys();
    void archivedDevicesRefreshTick;
    const filteredArchivedDeviceKeys = archivedDeviceKeys.filter((key) => {
        const query = archivedDevicesSearch.trim().toLowerCase();
        return !query || formatCode(key).toLowerCase().includes(query) || key.includes(query.replace(/\D/g, ''));
    });
    // Steps target the sidebar as it renders NOW (no Home item): Remote
    // Support, Devices, Chat and Meetings are the four main items. Each item is
    // 44px tall so shifting by that keeps the highlight aligned when the wizard
    // is opened manually from Help.
    const onboardingSteps = [
        {
            icon: Network,
            title: 'Remote Support',
            body: 'Start secure remote sessions from here. Enter a Remote365 ID, connect to a saved device, or host this computer.',
            card: { left: 280, top: 48 },
            arrow: { side: 'left', top: 28 },
            target: { left: 16, top: 64, width: 213, height: 40 },
        },
        {
            icon: Monitor,
            title: 'Devices Page',
            body: 'Open Devices to manage saved computers, check online status, organize groups, and reconnect faster. This is where the app opens by default now.',
            card: { left: 280, top: 92 },
            arrow: { side: 'left', top: 28 },
            target: { left: 16, top: 108, width: 213, height: 40 },
        },
        {
            icon: MessageCircle,
            title: 'Chat',
            body: 'Use Chat for contacts, support conversations, file handoff notes, and session invitations.',
            card: { left: 280, top: 136 },
            arrow: { side: 'left', top: 28 },
            target: { left: 16, top: 152, width: 213, height: 40 },
        },
        {
            icon: Video,
            title: 'Meetings',
            body: 'Open Meetings for live collaboration when a remote-control session is not enough. Start one now or schedule it for later.',
            card: { left: 280, top: 180 },
            arrow: { side: 'left', top: 28 },
            target: { left: 16, top: 196, width: 213, height: 40 },
        },
    ] as const;
    const activeOnboardingStep = onboardingSteps[onboardingStep] || onboardingSteps[0];
    const ActiveOnboardingIcon = activeOnboardingStep.icon;
    const activeArrowStyle =
        activeOnboardingStep.arrow.side === 'left'
            ? {
                left: -13,
                top: activeOnboardingStep.arrow.top,
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderRight: '14px solid #FFFFFF',
            }
            : activeOnboardingStep.arrow.side === 'right'
                ? {
                    right: -13,
                    top: activeOnboardingStep.arrow.top,
                    borderTop: '12px solid transparent',
                    borderBottom: '12px solid transparent',
                    borderLeft: '14px solid #FFFFFF',
                }
                : activeOnboardingStep.arrow.side === 'top'
                    ? {
                        top: -13,
                        left: activeOnboardingStep.arrow.left,
                        borderLeft: '12px solid transparent',
                        borderRight: '12px solid transparent',
                        borderBottom: '14px solid #FFFFFF',
                    }
                    : {
                        bottom: -13,
                        left: activeOnboardingStep.arrow.left,
                        borderLeft: '12px solid transparent',
                        borderRight: '12px solid transparent',
                        borderTop: '14px solid #FFFFFF',
                    };

    return (
        <div className="h-screen w-full bg-[#00193F] text-[#1C1C1C] flex flex-col overflow-hidden font-inter selection:bg-amber-500/20 select-none">
            <div className="flex-1 flex flex-row min-h-0 w-full relative">
            <UpdateBanner />
            <SnowSplashScreen isReady={!loading} onFinished={() => setIsSplashComplete(true)} />

            {/* THEATER MODE VIEWER (Standard or Dedicated Window) */}
            {isViewerWindow && (
                <div className="fixed inset-0 z-[500] bg-black">
                    <VideoPlayer
                        mediaActive={viewerMediaActive}
                        ref={videoPlayerRef}
                        viewerStatus={viewerStatus}
                        setViewerStatus={setViewerStatus}
                        sessionCode={sessionCode}
                        onDisconnect={endViewerSession}
                        onControlEvent={onControlEvent}
                        remoteStream={remoteStream}
                        deviceType={windowDeviceType || (windowDeviceName.includes('iPhone') || windowDeviceName.includes('Android') ? 'mobile' : 'desktop')}
                        deviceName={windowDeviceName}
                        controlChannelRef={controlChannelRef}
                        remoteCursor={remoteCursor}
                        controlStatus={hostAnnouncedControl ? controlStatus : 'granted'}
                        remoteWhiteboardEvent={remoteWhiteboardEvent}
                        remoteChatEvent={remoteChatEvent}
                        remoteFileBrowserEvent={remoteFileBrowserEvent}
                        fileTransferStatus={fileTransferStatus}
                        setFileTransferStatus={setFileTransferStatus}
                        connectionHealth={connectionHealth}
                        onBoostConnection={boostConnection}
                        onFirstFramePresented={handleFirstFramePresented}
                        talkActive={talkActive}
                        onToggleTalk={toggleTalk}
                    />
                </div>
            )}

            {/* ── Viewer Access Request Dialog ── */}
            <ViewerRequestModal state={pendingViewerRequest} setState={setPendingViewerRequest} language={user?.language} />

            <ControlRequestModal state={pendingControlRequest} onClose={() => setPendingControlRequest(null)} />

            {globalError && (
                <div className="fixed top-0 left-0 right-0 bg-red-500 text-white  
 py-3 text-xs font-bold z-[50] flex justify-between px-6 items-center shadow-lg">
                    <span>{globalError}</span>
                    <button onClick={() => setGlobalError('')} className="bg-white/20 p-1 rounded-md hover:bg-white/30 transition-colors"><X className="w-4 h-4" /></button>
                </div>
            )}

            <Modal open={showOnboardingWizard && isAuthenticated} className="z-[220] bg-black/25 p-0 items-stretch justify-stretch">
                <div
                    className="pointer-events-none absolute rounded-[8px] border-2 border-[#FF8A00] bg-[rgba(255,138,0,0.08)] shadow-[0_0_0_4px_rgba(255,138,0,0.16)] transition-all duration-300"
                    style={{
                        left: activeOnboardingStep.target.left,
                        top: activeOnboardingStep.target.top,
                        width: activeOnboardingStep.target.width,
                        height: activeOnboardingStep.target.height,
                    }}
                />
                <div
                    className="absolute flex h-[268px] w-[468px] flex-col items-start gap-[22px] rounded-[12px] bg-white p-6 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl transition-all duration-300"
                    style={activeOnboardingStep.card}
                >
                    <span className="absolute h-0 w-0" style={activeArrowStyle} />
                    <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[rgba(255,179,71,0.3)]">
                        <ActiveOnboardingIcon size={28} strokeWidth={1.7} className="text-[#FF8A00]" />
                    </div>
                    <div className="flex h-24 w-[420px] flex-col items-start gap-[22px]">
                        <h2 className="m-0 h-[34px] w-[420px] text-[24px] font-bold leading-[34px] text-[#111315]">
                            {activeOnboardingStep.title}
                        </h2>
                        <p className="m-0 h-10 w-[420px] text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">
                            {activeOnboardingStep.body}
                        </p>
                    </div>
                    <div className="flex h-10 w-[420px] items-center justify-between gap-[27px]">
                        <div className="mx-auto flex h-[20.5px] w-[98px] items-start gap-[6.25px] p-[6.25px]">
                            {onboardingSteps.map((_, dot) => (
                                <span
                                    key={dot}
                                    className={`${dot === onboardingStep ? 'w-5 bg-[#FF8A00]' : 'w-2.5 bg-[rgba(26,29,33,0.15)]'} h-2 rounded-[3.75px] transition-all`}
                                />
                            ))}
                        </div>
                        <div className="mx-auto flex h-10 w-64 items-center gap-2">
                            <button
                                type="button"
                                onClick={completeOnboardingWizard}
                                className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-4 py-2.5 text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.7)] transition-colors hover:bg-gray-50"
                            >
                                Skip
                            </button>
                            <button
                                type="button"
                                onClick={() => onboardingStep >= onboardingSteps.length - 1 ? completeOnboardingWizard() : setOnboardingStep((step) => step + 1)}
                                className="flex h-10 w-[124px] items-center justify-center rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 py-2.5 text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90"
                            >
                                {onboardingStep >= onboardingSteps.length - 1 ? 'Finish' : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            <ArchivedDevicesModal
                open={showArchivedDevicesModal}
                archivedDeviceKeys={archivedDeviceKeys}
                filteredArchivedDeviceKeys={filteredArchivedDeviceKeys}
                search={archivedDevicesSearch}
                onSearchChange={setArchivedDevicesSearch}
                onClose={() => setShowArchivedDevicesModal(false)}
                onRestore={restoreArchivedDevices}
                onDelete={deleteArchivedDevices}
                formatCode={formatCode}
            />

            <UpdateCheckModal
                open={showUpdateCheckModal}
                message={updateCheckMessage}
                busy={updateCheckBusy}
                onClose={() => setShowUpdateCheckModal(false)}
            />

            <SupportIdentifierModal
                open={showSupportIdentifierModal}
                identifier={supportIdentifierValue}
                version={supportIdentifierVersion}
                onClose={() => setShowSupportIdentifierModal(false)}
            />

            <PrivacyPolicyModal
                open={showPrivacyPolicyModal}
                onClose={() => setShowPrivacyPolicyModal(false)}
            />

            <CopyrightModal
                open={showCopyrightModal}
                onClose={() => setShowCopyrightModal(false)}
            />

            <AboutRemote365Modal
                open={showAboutRemoteModal}
                version={supportIdentifierVersion}
                releaseDate={aboutReleaseDate}
                onClose={() => setShowAboutRemoteModal(false)}
            />

            {/* --- PREMIUM UI SIDEBAR NAV --- */}
            {isAuthenticated && (
                <SnowPremiumSidebar
                    currentView={resolvedCurrentView}
                    setCurrentView={(v: any) => { setCurrentView(v); setIsSidebarOpen(false); }}
                    handleLogout={handleLogout}
                    user={user}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    showNotifications={showNotifications}
                    setShowNotifications={setShowNotifications}
                    onOpenFeedback={() => setShowFeedback(true)}
                    onCustomizeOpenChange={setIsSidebarCustomizationOpen}
                    onOpenArchivedDevices={() => {
                        setShowArchivedDevicesModal(true);
                        setArchivedDevicesRefreshTick((tick) => tick + 1);
                    }}
                    onCheckForUpdate={openUpdateCheckModal}
                    onOpenSupportIdentifier={openSupportIdentifierModal}
                    onOpenPrivacyPolicy={() => setShowPrivacyPolicyModal(true)}
                    onOpenCopyright={() => setShowCopyrightModal(true)}
                    onOpenFileLogs={openFileLogs}
                    onOpenAbout={openAboutRemoteModal}
                />
            )}

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 relative bg-[#F3F4F6] dark:bg-[#0a0a0a] ${isAuthenticated ? `${isSidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-[245px]'} p-3` : ''}`}>
                <main className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-[#0d0f12] rounded-t-xl">
                    {/* Workspace Header */}
                    {isAuthenticated && (
                        <>
                            <header className="h-[60px] flex items-center justify-between px-5 flex-shrink-0 z-10 w-full bg-white dark:bg-[#0d0f12] font-['Mona_Sans',system-ui,sans-serif]">
                                <div className="flex items-center gap-[181px]">
                                    <div className="flex items-center gap-6">
                                    <h1 className="text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] tracking-normal min-w-[41px]">
                                        {selectedDevice
                                            ? t('terminal_title', user?.language)
                                            : getViewTitle(resolvedCurrentView as string, user?.language)}
                                    </h1>
                                    
                                    <div className="flex items-center gap-4 text-[#1A1D21] dark:text-[#A0A0A0]">
                                        <button 
                                            onClick={handleBack}
                                            disabled={historyIndex === 0}
                                            className={`transition-colors ${historyIndex > 0 ? 'hover:text-[#FF8A00]' : 'opacity-30 cursor-not-allowed'}`}
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <button 
                                            onClick={handleForward}
                                            disabled={historyIndex === history.length - 1}
                                            className={`transition-colors ${historyIndex < history.length - 1 ? 'hover:text-[#FF8A00]' : 'opacity-30 cursor-not-allowed'}`}
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Header search bar removed (Sep 7): every page has its own search field. */}
                            <div className="hidden w-[474px] max-w-[36vw] relative" style={{ display: 'none' }}>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(26,29,33,0.3)] dark:text-white/30">
                                        <Search size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search device, contact, group or feature. Type an ID to connect."
                                        value={topSearchQuery}
                                        onChange={(event) => setTopSearchQuery(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                runTopSearchAction(undefined, event.altKey ? user?.searchBehavior !== 'Direct connect' : user?.searchBehavior === 'Direct connect');
                                            }
                                            if (event.key === 'Escape') setTopSearchQuery('');
                                        }}
                                        className="w-full h-10 pl-11 pr-4 bg-white dark:bg-white/5 border border-[rgba(26,29,33,0.3)] dark:border-white/10 rounded text-[14px] font-medium leading-5 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)] dark:placeholder:text-white/30 text-[#111315] dark:text-white focus:border-[#FF8A00]"
                                    />
                                    <div className="hidden absolute inset-y-0 right-3 items-center">
                                        <span className="text-[10px] font-medium text-[#757575] dark:text-[#A0A0A0] bg-[#F4F7F9] dark:bg-white/5 px-1.5 py-0.5 rounded border border-[#D1D1D1] dark:border-white/10">Ctrl + K</span>
                                    </div>

                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1C1C1C] border border-gray-100 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                                        <div className="flex items-center gap-2 p-2 border-b border-gray-50 dark:border-white/5">
                                            <button className="px-3 py-1.5 bg-[#FFF6ED] dark:bg-[#FF8A00]/15 rounded-lg text-[12px] font-medium text-[#FF8A00]">All</button>
                                            <button type="button" onMouseDown={(event) => { event.preventDefault(); setCurrentView('devices'); }} className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-[12px] font-medium text-gray-500 flex items-center gap-2"><Monitor size={14} /> Devices</button>
                                            <button type="button" onMouseDown={(event) => { event.preventDefault(); setCurrentView('chat' as any); }} className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-[12px] font-medium text-gray-500 flex items-center gap-2"><User size={14} /> Contacts</button>
                                            <button type="button" onMouseDown={(event) => { event.preventDefault(); setCurrentView('connect'); }} className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-[12px] font-medium text-gray-500 flex items-center gap-2"><Zap size={14} /> Features</button>
                                        </div>
                                        <div className="p-2 max-h-[320px] overflow-y-auto">
                                            {topSearchResults.length > 0 ? topSearchResults.map((result) => (
                                                <button
                                                    key={result.id}
                                                    type="button"
                                                    onMouseDown={(event) => {
                                                        event.preventDefault();
                                                        runTopSearchAction(result);
                                                    }}
                                                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#FFF6ED] dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <span className="w-8 h-8 rounded-lg bg-[rgba(255,179,71,0.3)] dark:bg-[#FF8A00]/20 flex items-center justify-center text-[#FF8A00]">
                                                        <result.icon size={15} />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-bold text-gray-900 dark:text-white truncate">{result.label}</span>
                                                        <span className="block text-[12px] text-gray-500 dark:text-gray-400 truncate">{result.detail}</span>
                                                    </span>
                                                </button>
                                            )) : (
                                                <div className="p-5">
                                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">No Search Results</h3>
                                                    <p className="text-[13px] text-gray-500 leading-relaxed">
                                                        Type a Remote365 ID and press Enter to connect, or search for devices, chat, meetings, settings, help, and feedback.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-white/5 flex justify-end">
                                            <button type="button" onMouseDown={(event) => { event.preventDefault(); setCurrentView('settings'); }} className="text-gray-400 hover:text-gray-600 transition-colors"><Settings size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-7 text-[#1A1D21] dark:text-[#A0A0A0]">
                                <button className="hover:text-[#FF8A00] transition-colors" title={t('settings_tooltip', user?.language)} onClick={() => setCurrentView('settings')}><Settings size={24} strokeWidth={1.5} /></button>
                                <button 
                                    className={`hover:text-[#FF8A00] transition-colors relative ${showNotifications ? 'text-[#FF8A00]' : ''}`} 
                                    title={t('notifications_tooltip', user?.language)}
                                    onClick={() => setShowNotifications(!showNotifications)}
                                >
                                    <Bell size={24} strokeWidth={1.7} />
                                    {notifications.some((notification) => !notification.read) && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                                    )}
                                </button>

                                
                                <div className="relative" ref={userDropdownRef}>
                                    <button 
                                        onClick={() => { setShowUserDropdown(!showUserDropdown); setShowUserDropdownHelp(false); }}
                                        className="relative group flex h-10 items-center gap-3 cursor-pointer"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#F9F5FF] flex items-center justify-center text-[#7F56D9] text-base font-medium shadow-sm overflow-hidden">
                                            {user?.avatar ? (
                                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                            ) : (() => {
                                                const name = user?.name || user?.email || '';
                                                const parts = name.trim().split(/\s+/);
                                                if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                                return name.slice(0, 2).toUpperCase();
                                            })()}
                                        </div>
                                        <span className="hidden max-w-[107px] truncate text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5] xl:block">{user?.name || 'User'}</span>
                                        <ChevronDown size={14} strokeWidth={1.5} className="text-[#1A1D21] dark:text-[#A0A0A0]" />
                                        <div className={`absolute bottom-0 left-7 w-3 h-3 ${activePresence.dot} rounded-full border-2 border-white`} />
                                    </button>

                                    {showUserDropdown && (
                                        <div className="absolute top-full right-0 mt-3 w-64 bg-white dark:bg-[#1A1A1A] rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100] font-sans">
                                            {/* Profile Header */}
                                            <div className="p-4 flex items-start gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-[#E91E63] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                        {(() => {
                                                            const name = user?.name || user?.email || '';
                                                            const parts = name.trim().split(/\s+/);
                                                            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                                            return name.slice(0, 2).toUpperCase();
                                                        })()}
                                                    </div>
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${activePresence.dot} rounded-full border-2 border-white dark:border-[#1A1A1A] flex items-center justify-center`}>
                                                        <Check size={7} className="text-white" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-[#1C1C1C] dark:text-[#F5F5F5] leading-tight">{user?.name || 'User'}</span>
                                                    <span className="text-[11px] font-bold text-[#D4A017] dark:text-blue-400 mt-0.5 uppercase tracking-wide">{user?.plan || 'TRIAL'}</span>
                                                    <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 -ml-1.5 rounded">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${activePresence.dot}`} />
                                                        <span className="text-xs text-[#757575] dark:text-[#A0A0A0]">{activePresence.label}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-[rgba(0,0,0,0.06)] dark:bg-white/10" />

                                            <div className="py-1">
                                                {presenceOptions.map((option) => (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => setPresence(option.id)}
                                                        className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] dark:text-[#F5F5F5] hover:bg-[rgba(28,28,28,0.04)] dark:hover:bg-white/5 transition-colors"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${option.dot}`} />
                                                            {option.label}
                                                        </span>
                                                        {userPresence === option.id && <Check size={12} className="text-[#1D6DF5]" />}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="h-px bg-[rgba(0,0,0,0.06)] dark:bg-white/10" />
                                            
                                            {/* Navigation Section 1 */}
                                            <div className="py-1">
                                                <button 
                                                    onClick={() => { setCurrentView('settings'); setShowUserDropdown(false); }}
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] dark:text-[#F5F5F5] hover:bg-[rgba(28,28,28,0.04)] dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <span>{t('edit_profile', user?.language)}</span>
                                                </button>
                                            </div>

                                            <div className="h-px bg-[rgba(0,0,0,0.06)] dark:bg-white/10" />

                                            {/* Navigation Section 2 */}
                                            <div className="py-1">
                                                <button
                                                    onClick={() => { setCurrentView('billing'); setShowUserDropdown(false); }}
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] dark:text-[#F5F5F5] hover:bg-[rgba(28,28,28,0.04)] dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <span>{t('upgrade_plan', user?.language)}</span>
                                                </button>
                                                <button
                                                    onClick={() => { window.open(`${buildHttpOrigin(DEFAULT_SERVER_HOST)}/dashboard`, '_blank', 'noopener,noreferrer'); setShowUserDropdown(false); }}
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] dark:text-[#F5F5F5] hover:bg-[rgba(28,28,28,0.04)] dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <span>{t('customer_portal', user?.language)}</span>
                                                    <ExternalLink size={12} className="text-[#757575] dark:text-[#A0A0A0]" />
                                                </button>
                                                <button
                                                    onClick={() => setShowUserDropdownHelp((value) => !value)}
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] dark:text-[#F5F5F5] hover:bg-[rgba(28,28,28,0.04)] dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <span>{t('help_label', user?.language)}</span>
                                                    <ChevronRight size={12} className={`text-[#757575] dark:text-[#A0A0A0] transition-transform ${showUserDropdownHelp ? 'rotate-90' : ''}`} />
                                                </button>
                                                {showUserDropdownHelp && [
                                                    { label: 'Archived Devices', action: () => { setShowArchivedDevicesModal(true); setArchivedDevicesRefreshTick((tick) => tick + 1); } },
                                                    { label: 'Check For New Version', action: openUpdateCheckModal },
                                                    { label: 'Customer Support Identifier', action: openSupportIdentifierModal },
                                                    { label: 'Privacy Policy', action: () => setShowPrivacyPolicyModal(true) },
                                                    { label: 'Copy Right', action: () => setShowCopyrightModal(true) },
                                                    { label: 'Open File Logs', action: openFileLogs },
                                                    { label: 'About Remote365', action: openAboutRemoteModal },
                                                ].map((entry) => (
                                                    <button
                                                        key={entry.label}
                                                        onClick={() => { entry.action(); setShowUserDropdown(false); }}
                                                        className="w-full flex items-center px-4 py-2 pl-8 text-[13px] text-[#4A4A4A] dark:text-[#A0A0A0] hover:bg-[rgba(28,28,28,0.04)] dark:hover:bg-white/5 transition-colors"
                                                    >
                                                        {entry.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="h-px bg-[rgba(0,0,0,0.06)] dark:bg-white/10" />
                                            
                                            {/* Sign Out Section */}
                                            <div className="py-1">
                                                <button 
                                                    onClick={() => { handleLogout(); setShowUserDropdown(false); }}
                                                    className="w-full flex items-center px-4 py-2 text-[13px] text-[#1C1C1C] dark:text-[#F5F5F5] hover:bg-[rgba(28,28,28,0.04)] dark:hover:bg-white/5 transition-colors"
                                                >
                                                    {t('sign_out', user?.language)}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </header>
                        </>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {!isAuthenticated ? (
                            <>
                            <SnowLanding
                                hostAccessKey={hostAccessKey}
                                hostStatus={hostStatus}
                                devicePassword={devicePassword}
                                isAutoHostEnabled={isAutoHostEnabled}
                                isAuthenticated={isAuthenticated}
                                connectStep={viewerStep}
                                sessionCode={sessionCode}
                                accessPassword={accessPassword}
                                connectError={viewerError}
                                connectStatus={viewerStatus}
                                targetDeviceName={targetDeviceName}
                                targetPasswordRequired={targetPasswordRequired}
                                lockoutSeconds={lockoutSeconds}
                                onCopyAccessKey={copyAccessKey}
                                onToggleAutoHost={() => {
                                    applyEasyAccess(!isEasyAccessEnabled());
                                }}
                                onOpenSetPassword={() => setShowSetPasswordModal(true)}
                                onStartHosting={handleStartHosting}
                                onStopHosting={handleStopHosting}
                                onSignIn={() => { setShowAuthModal(true); setAuthMode('login'); }}
                                onSignUp={() => { setShowAuthModal(true); setAuthMode('signup'); }}
                                onSessionCodeChange={setSessionCode}
                                onAccessPasswordChange={setAccessPassword}
                                onFindDevice={handleFindDevice}
                                onConnectToHost={() => handleConnectToHost()}
                                onBackToStep1={() => setViewerStep(1)}
                                onJoinMeeting={openMeeting}
                                onCreateMeeting={(meetingId) => openMeeting(meetingId, { asHost: true })}
                                isElectron={isElectron}
                                onHelp={() => setShowLandingHelp(true)}
                            />
                            <LandingHelpModal open={showLandingHelp} onClose={() => setShowLandingHelp(false)} />
                            </>
                        ) : (resolvedCurrentView === 'support_workstation' && !selectedDevice) ? (
                            <div className="w-full h-full min-h-0 animate-in fade-in duration-700">
                                <SupportWorkstation serverIP={serverIP} />
                            </div>
                        ) : (resolvedCurrentView === 'end_user_home' && !selectedDevice) ? (
                            <div className="w-full h-full min-h-0 animate-in fade-in duration-700">
                                <EndUserHome />
                            </div>
                        ) : (resolvedCurrentView === 'dashboard' && !selectedDevice) ? (
                            <div className="w-full flex flex-col animate-in fade-in duration-700">
                                <SnowPremiumDashboard
                                    user={user}
                                    localAuthKey={localAuthKey}
                                    devicePassword={devicePassword}
                                    onNavigate={setCurrentView}
                                    onConnect={(partnerId?: string) => {
                                        if (partnerId) handleDashboardConnect(partnerId);
                                        else setCurrentView('connect');
                                    }}
                                    onOpenSetPassword={() => setActionModal({ type: 'password', device: null })}
                                    onCopyAccessKey={copyAccessKey}
                                    onCopyPassword={() => addNotification('Access password copied. Share it only with people you trust.', 'system', 'Copied')}
                                    recentConnections={recentConnections}
                                    onRecentConnect={handleDashboardConnect}
                                    onCreateSession={openCreateSessionFromDashboard}
                                    onJoinSession={openJoinSessionFromDashboard}
                                    onEnableRemoteAccess={() => {
                                        // Shared Easy Access flag; the central listener
                                        // starts hosting and syncs the server + all switches.
                                        applyEasyAccess(true);
                                        setCurrentView('connect');
                                    }}
                                    hasContacts={hasAcceptedContacts}
                                    hasRemoteAccess={hasRemoteAccessSetup}
                                    formatCode={formatCode}
                                />
                            </div>
                        /* All content branches below must test resolvedCurrentView, not raw
                           currentView: a fresh install boots with currentView='home' (and
                           permission-revoked users keep their old stored view), which only
                           resolvedCurrentView remaps to the real landing view. Testing the
                           raw value rendered a BLANK main pane on first login. */
                        ) : (resolvedCurrentView === 'settings' && !selectedDevice) ? (
                            <div className="w-full flex flex-col flex-1 animate-in fade-in duration-700 h-full overflow-hidden">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                <SnowPremiumSettings
                                    user={user}
                                    currentDeviceId={deviceId}
                                    currentDeviceAccessKey={hostAccessKey || localAuthKey || localStorage.getItem('remote365_device_access_key')}
                                    logout={() => {
                                        handleLogout();
                                    }}
                                />
                                </React.Suspense>
                            </div>
                        ) : (selectedDevice && currentView !== 'devices') ? (
                            /* --- INDIVIDUAL DEVICE PREVIEW VIEW --- */
                            <div className="max-w-4xl mx-auto min-h-full py-12 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-500 font-inter">
                                <div className="relative mb-6">
                                    <div className="w-32 h-32 rounded-[32px] flex items-center justify-center shadow-lg bg-[#1C1C1C]">
                                        {selectedDevice.device_type?.toLowerCase() === 'ios' || selectedDevice.device_type?.toLowerCase() === 'android' ?
                                            <Smartphone className="text-white w-14 h-14" /> :
                                            <Monitor className="text-white w-14 h-14" />
                                        }
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#71DD8C] rounded-full border-4 border-[#F8F9FA]" />
                                </div>

                                <h2 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2 uppercase">{selectedDevice.device_name}</h2>
                                <div className="flex items-center gap-3 text-[#1C1C1C] text-[11px] font-bold mb-10 tracking-widest uppercase">
                                    <span className="bg-[rgba(28,28,28,0.05)] px-2 py-1 rounded-lg font-mono text-[#1C1C1C]">#{selectedDevice.access_key}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[rgba(28,28,28,0.1)]" />
                                    <span>Secure Link Ready</span>
                                </div>

                                <div className="flex gap-4 w-full max-w-sm">
                                    <button
                                        onClick={() => setSelectedDevice(null)}
                                        className="flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-[#1C1C1C] hover:text-[#1C1C1C] bg-white border border-[rgba(28,28,28,0.15)] hover:border-[rgba(28,28,28,0.2)] transition shadow-sm"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleDeviceClick(selectedDevice);
                                        }}
                                        disabled={viewerStatus === 'connecting'}
                                        className="flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-white shadow-lg shadow-black/10 flex items-center justify-center gap-2 transition active:scale-[0.98] bg-[#00193F] hover:bg-[#002255]"
                                    >
                                        {viewerStatus === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Establish Link <Zap size={14} /></>}
                                    </button>
                                </div>
                            </div>
                        ) : resolvedCurrentView === 'connect' ? (
                            <>
                            <React.Suspense fallback={<LazyScreenFallback />}>
                            <SnowRemoteSupport
                                localAuthKey={localAuthKey}
                                devicePassword={devicePassword}
                                onCopyAccessKey={copyAccessKey}
                                onOpenSetPassword={() => setActionModal({ type: 'password', device: null })}
                                remoteLookupError={viewerStep === 1 ? viewerError : null}
                                isRemoteLookupConnecting={viewerStatus === 'connecting' && viewerStep === 1}
                                onConnect={(partnerId: string) => {
                                    const cleaned = String(partnerId || '').replace(/\D/g, '');
                                    if (!cleaned) return;
                                    const mine = String(localAuthKey || '').replace(/\D/g, '');
                                    if (mine && cleaned === mine) {
                                        showError(
                                            'Cannot Use This ID Here',
                                            'That Is This Computer\'s Remote365 ID. Enter the other device\'s ID to start a remote session.'
                                        );
                                        return;
                                    }
                                    setSessionCode(formatCode(cleaned));
                                    setAccessPassword('');
                                    setViewerError('');
                                    setViewerStep(1);
                                    setTargetDeviceName(null);
                                    setTargetPasswordRequired(true);
                                    // Join via the same flow as the Devices page: remembered/trusted
                                    // sessions connect automatically, otherwise the shared password
                                    // modal is shown.
                                    handleDashboardConnect(cleaned);
                                }}
                                onStartHosting={handleStartHosting}
                                onStopHosting={handleStopHosting}
                                hostStatus={hostStatus}
                                onJoinSessionInvite={handleJoinSessionInvite}
                                onJoinMeeting={openMeeting}
                                onHostOwnSession={(session: any) => {
                                    const code = String(session?.sessionCode || localAuthKey || '').replace(/\D/g, '');
                                    if (!code) return;
                                    (window as any).electronAPI?.openSessionWaitWindow?.({
                                        code,
                                        name: session?.name,
                                        link: session?.joinLink || session?.sessionLink,
                                    });
                                }}
                                initialTab={connectInitialTab}
                                openCreateSessionSignal={openCreateSessionSignal}
                                openJoinSessionSignal={openJoinSessionSignal}
                                isAutoHostEnabled={isAutoHostEnabled}
                                onToggleAutoHost={(next: boolean) => {
                                    // Server sync + hosting kick happen in the central
                                    // subscribeEasyAccess listener.
                                    applyEasyAccess(next);
                                }}
                            />
                            </React.Suspense>
                            {viewerStep === 2 && (
                                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans">
                                    <div className="bg-white dark:bg-[#1C1C1C] rounded-[24px] w-full max-w-md shadow-2xl p-6 border border-gray-100 dark:border-white/10">
                                        <h3 className="text-[20px] font-bold text-gray-900 dark:text-[#F5F5F5]">Enter Access Password</h3>
                                        <p className="text-[13px] text-gray-500 dark:text-[#A0A0A0] mt-1">
                                            {targetDeviceName
                                                ? <>Connecting To <span className="font-semibold text-gray-800 dark:text-white">{targetDeviceName}</span></>
                                                : <>Device ID <span className="font-mono font-semibold">{formatCode(sessionCode)}</span></>}
                                        </p>
                                        {lockoutSeconds > 0 && (
                                            <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-3">
                                                Too many attempts. Try again in {lockoutSeconds}s.
                                            </p>
                                        )}
                                        <input
                                            type="password"
                                            autoFocus
                                            value={accessPassword}
                                            onChange={(e) => setAccessPassword(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && accessPassword && viewerStatus !== 'connecting' && lockoutSeconds <= 0) handleConnectToHost(); }}
                                            disabled={lockoutSeconds > 0}
                                            placeholder="Remote Access Password"
                                            className="mt-4 w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-[14px] text-gray-900 dark:text-white outline-none focus:border-[#1D6DF5]"
                                        />
                                        {viewerError ? (
                                            <p className="text-[12px] font-medium text-red-500 mt-2">{viewerError}</p>
                                        ) : null}
                                        <div className="mt-6 flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewerStep(1);
                                                    setViewerError('');
                                                    setAccessPassword('');
                                                    setViewerStatus('idle');
                                                }}
                                                className="px-4 py-2.5 text-[13px] font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleConnectToHost()}
                                                disabled={viewerStatus === 'connecting' || !accessPassword || lockoutSeconds > 0}
                                                className="px-6 py-2.5 rounded-xl bg-[#1D6DF5] text-white text-[13px] font-bold disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {viewerStatus === 'connecting' ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                                                Connect
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            </>
                        ) : (currentView as any) === 'sessions' ? (
                            /* --- ACTIVE SESSIONS VIEW --- */
                            <div className="w-full pt-8 animate-in fade-in duration-700">
                                <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.15)] p-8 shadow-sm">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                                            <Activity className="text-[#D4A017]" size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-[#1C1C1C]">Active Remote Sessions</h2>
                                            <p className="text-sm text-[#1C1C1C]">Real-time connections to your fleet</p>
                                        </div>
                                    </div>

                                    {activeSessionCount === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center  
">
                                            <div className="w-20 h-20 bg-[#F8F9FA] rounded-[32px] flex items-center justify-center mb-6">
                                                <Radio className="text-[#000000] w-10 h-10" />
                                            </div>
                                            <h3 className="text-lg font-bold text-[#1C1C1C] mb-2">No Active Streams</h3>
                                            <p className="text-sm text-[#1C1C1C] max-w-xs">You don't have any active remote control sessions at the moment.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* We mock the session list here as we don't have a granular list in state yet */}
                                            <div className="p-6 rounded-2xl bg-[#F8F9FA] border border-[rgba(28,28,28,0.02)] flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                                        <Monitor className="text-[#D4A017]" size={20} />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-[#1C1C1C]">Encrypted P2P Link</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            <span className="text-[10px] font-bold text-[#1C1C1C] uppercase">Active Now</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={() => setCurrentView('dashboard')} className="snow-btn-secondary !py-2 !px-6 !text-[10px]">Back To Overview</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : resolvedCurrentView === 'host' ? (
                            /* --- HOST THIS DEVICE VIEW --- */
                            <div className="w-full pt-4 animate-in fade-in duration-700">
                                <SnowHost
                                    status={hostStatus}
                                    accessKey={hostAccessKey}
                                    isAutoHost={isAutoHostEnabled}
                                    setIsAutoHost={(val: boolean) => {
                                        setIsAutoHostEnabled(val);
                                        if (val && hostStatus !== 'status') {
                                            handleStartHosting();
                                        } else if (!val) {
                                            manuallyStoppedHost.current = true;
                                            handleStopHosting();
                                        }
                                    }}
                                    handleStartHosting={handleStartHosting}
                                    handleStopHosting={handleStopHosting}
                                    copyAccessKey={copyAccessKey}
                                    openPasswordModal={() => setActionModal({ type: 'password', device: null })}
                                    bandwidth={hostStats.bandwidth}
                                    activeUsers={hostStats.activeUsers}
                                    devicePassword={devicePassword}
                                    isRegistered={isLocalHostRegistered}
                                    onRegister={handleRegisterLocalDevice}
                                />
                            </div>
                        ) : resolvedCurrentView === 'billing' && canSeeBilling ? (
                            /* --- BILLING VIEW --- */
                            <div className="w-full pt-4 animate-in fade-in duration-700">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                    <SnowBilling user={user} />
                                </React.Suspense>
                            </div>
                        ) : resolvedCurrentView === 'admin_settings' && canSeeAdminSettings ? (
                            <div className="w-full h-full animate-in fade-in duration-700 bg-white dark:bg-[#0F0F0F]">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                    <SnowAdminSettings setCurrentView={setCurrentView} user={user} />
                                </React.Suspense>
                            </div>
                        ) : resolvedCurrentView === 'meetings' ? (
                            <div className="w-full h-full animate-in fade-in duration-700">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                    <SnowMeetingsHome onJoinMeeting={openMeeting} user={user} />
                                </React.Suspense>
                            </div>
                        ) : resolvedCurrentView === 'profile' ? (
                            /* --- PROFILE ALIASED TO SETTINGS --- */
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700 px-8">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                <SnowSettings
                                    serverIP={serverIP}
                                    isAutoHostEnabled={isAutoHostEnabled}
                                    setIsAutoHostEnabled={(val) => {
                                        setIsAutoHostEnabled(val);
                                        if (val && hostStatus !== 'status') {
                                            handleStartHosting();
                                        } else if (!val) {
                                            manuallyStoppedHost.current = true;
                                            handleStopHosting();
                                        }
                                    }}
                                    onRenameDevice={() => setActionModal({ type: 'rename', device: null })}
                                    logout={handleLogout}
                                    onClose={() => setCurrentView('dashboard')}
                                />
                                </React.Suspense>
                            </div>
                        ) : resolvedCurrentView === 'support' ? (
                            /* --- SNOW UI SUPPORT VIEW --- */
                            <div className="w-full h-full animate-in fade-in duration-700 px-8">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                    <SnowSupport />
                                </React.Suspense>
                            </div>
                        ) : (currentView as any) === 'chat' ? (
                            <React.Suspense fallback={<LazyScreenFallback />}>
                                <SnowChat
                                    setCurrentView={setCurrentView}
                                    localAuthKey={localAuthKey}
                                    devicePassword={devicePassword}
                                    serverIP={serverIP}
                                    onJoinSessionInvite={handleJoinSessionInvite}
                                    onJoinMeeting={requestJoinMeeting}
                                    devices={devices}
                                    onOpenDeviceMention={handleOpenDeviceMention}
                                />
                            </React.Suspense>
                        ) : resolvedCurrentView === 'devices' ? (
                            /* --- SNOW UI DEVICES VIEW --- */
                            <div className="w-full h-full animate-in fade-in duration-700">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                {/* @ts-ignore */}
                                <SnowDevices
                                    devices={showArchivedView
                                        ? rawDeviceListRef.current.filter((d: any) => getHiddenDeviceKeys().has(getDeviceAccessKey(d)))
                                        : devices}
                                    user={user}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    selectedDevice={selectedDevice}
                                    setSelectedDevice={setSelectedDevice}
                                    handleDeviceClick={handleDeviceClick}
                                    setActionModal={setActionModal}
                                    actionModal={actionModal}
                                    setShowAddModal={setShowAddModal}
                                    handleBulkDelete={handleBulkDelete}
                                    onArchiveDevice={handleArchiveDevice}
                                    onOpenArchivedDevices={() => { setShowArchivedView((v) => !v); setArchivedDevicesRefreshTick((tick) => tick + 1); }}
                                    archivedDeviceCount={getArchivedDeviceKeys().length}
                                    isArchiveView={showArchivedView}
                                    onRestoreDevice={(device: any) => restoreSingleArchivedDevice(device)}
                                    onRefresh={pollDevices}
                                    isLoading={isRefreshing}
                                    passwordUpdateKeys={passwordUpdateKeys}
                                    activeSessionKeys={activeViewerKeys}
                                />
                                </React.Suspense>
                            </div>
                        ) : (resolvedCurrentView as string) === 'members' ? (
                            <div className="w-full h-full animate-in fade-in duration-700">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                    <SnowMembers />
                                </React.Suspense>
                            </div>
                        ) : (resolvedCurrentView as string) === 'organizations' ? (
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                <SnowOrgs
                                    setCurrentView={setCurrentView}
                                    setSelectedDevice={setSelectedDevice}
                                    setSearchQuery={setSearchQuery}
                                />
                                </React.Suspense>
                            </div>
                        ) : (resolvedCurrentView as string) === 'analytics' ? (
                            <div className="w-full h-full animate-in fade-in duration-700">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                    <SnowAnalytics
                                        onSelectOrg={(orgId) => {
                                            setOrgDetailId(orgId);
                                            setCurrentView('org-detail');
                                        }}
                                        onPayoutClick={() => setCurrentView('billing')}
                                    />
                                </React.Suspense>
                            </div>
                        ) : (resolvedCurrentView as string) === 'org-detail' ? (
                            <div className="w-full h-full animate-in fade-in duration-700 px-8 overflow-y-auto custom-scrollbar">
                                <React.Suspense fallback={<LazyScreenFallback />}>
                                <SnowOrgDetail

                                    orgId={orgDetailId!}
                                    onBack={() => setCurrentView('analytics')}
                                />
                                </React.Suspense>
                            </div>
                        ) : null}
                    </div>
                </main>

                {/* --- Global Status Footer --- */}
                {!showSplash && isSplashComplete && !isSidebarCustomizationOpen && (
                    <StatusFooter
                        status={hostStatus}
                        statusLabel={hostStatus === 'error' ? t('error_status', user?.language) : deviceStatusLabel}
                        message={hostMessage}
                        idLabel={formatCode(hostAccessKey || localAuthKey || '--- --- ---')}
                        onCopyId={() => {
                            const key = String(hostAccessKey || localAuthKey || localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, '');
                            if (!key) return;
                            writeClipboardText(formatCode(key));
                            addNotification('Your ID was copied. Send it to the person who will connect.', 'system', 'Copied');
                        }}
                    />
                )}

                <SnowNotificationPanel 
                    isOpen={showNotifications} 
                    onClose={() => setShowNotifications(false)} 
                    notifications={notifications}
                    onMarkAllRead={() => setNotifications(prev => prev.map(notification => ({ ...notification, read: true })))}
                    onClearAll={() => setNotifications([])}
                    onNotificationClick={handleNotificationClick}
                    onDismiss={(n) => setNotifications(prev => prev.filter(x => x !== n))}
                    onClearOlder={(hours) => setNotifications(prev => prev.filter(n => {
                        const ts = Number(String(n.id).split('-')[0]);
                        return !ts || (Date.now() - ts) < hours * 3600 * 1000;
                    }))}
                />
                {globalAppToast && (
                    <div
                        role="status"
                        style={{ boxShadow: '-6px 6px 18px rgba(0,0,0,0.28)' }}
                        className="fixed right-6 top-[73px] z-[250] flex w-[460px] max-w-[calc(100vw-32px)] cursor-pointer items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in slide-in-from-right-4 duration-200"
                        onClick={() => {
                            const target = globalAppToast.target;
                            if (target?.view === 'chat') {
                                setCurrentView('chat' as any);
                                if (target.chatId) useChatStore.getState().setActiveChat(target.chatId);
                            } else if (target?.view === 'connect') {
                                if (target.sessionCode) handleJoinSessionInvite(target.sessionCode, target.sessionPassword);
                                else setCurrentView('connect' as any);
                            } else if (target?.view === 'meeting') {
                                setCurrentView('meetings' as any);
                                requestJoinMeeting(target.meetingId);
                            }
                            setGlobalAppToast(null);
                        }}
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                                style={{
                                    background: globalAppToast.iconType === 'accepted'
                                        ? 'rgba(52,199,89,0.18)'
                                        : globalAppToast.iconType === 'session' || globalAppToast.iconType === 'message'
                                            ? 'rgba(0,136,255,0.12)'
                                            : 'rgba(255,179,71,0.3)',
                                    color: globalAppToast.iconType === 'accepted'
                                        ? '#34C759'
                                        : globalAppToast.iconType === 'session' || globalAppToast.iconType === 'message'
                                            ? '#0088FF'
                                            : '#FF8A00',
                                }}
                            >
                                {globalAppToast.iconType === 'accepted' ? <UserCheck size={18} /> : globalAppToast.iconType === 'session' ? <Monitor size={18} /> : <MessageCircle size={18} />}
                            </span>
                            <div className="min-w-0">
                                <p className="m-0 truncate text-[14px] font-medium leading-[20px] text-[#1A1D21]">{globalAppToast.title}</p>
                                <p className="m-0 truncate text-[12px] leading-[17px] text-[#1A1D21]/60">{globalAppToast.body}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setGlobalAppToast(null); }}
                            aria-label="Dismiss"
                            className="flex h-7 w-7 shrink-0 items-center justify-center text-[#1A1D21] transition-opacity hover:opacity-70"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* MODALS LAYER - Removed old settings modal in favor of full-page SnowPremiumSettings */}

            {/* Trial expiry lock — covers the whole workspace once the free trial runs out */}
            {isAuthenticated && <TrialExpiredLock user={user} onLogout={handleLogout} />}


            {/* Set/Change access password (branded modal, extracted component) */}
            <AccessPasswordModal
                open={showSetPasswordModal}
                mode={devicePassword || serverHasDevicePassword || localStorage.getItem('device_password') ? 'change' : 'set'}
                onClose={() => setShowSetPasswordModal(false)}
                onSubmit={(newPassword) => {
                    setDevicePassword(newPassword);
                    localStorage.setItem('device_password', newPassword);
                    setShowSetPasswordModal(false);
                    // Pass the new password explicitly so the re-register
                    // pushes it to the server even though setDevicePassword
                    // hasn't been applied to this closure yet.
                    setTimeout(() => handleStartHosting(newPassword), 100);
                }}
            />

            {/* Password Prompt Modal */}
            {showPasswordPrompt && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowPasswordPrompt(null); setPromptError(null); } }}
                >
                    <div className="flex w-full max-w-[468px] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center gap-2 pt-1">
                            <img src={logo} alt="Remote365" className="h-6 w-6 flex-shrink-0 rounded object-contain" />
                            <span className="text-[14px] font-medium leading-5 text-[#111315]">Remote365 Authentication</span>
                        </div>

                        {/* Body */}
                        <div className="flex flex-col gap-4">
                            <p className="text-[14px] leading-5 text-[#111315]">
                                {passwordUpdateKeys.includes(String(showPasswordPrompt.access_key || '').replace(/\s/g, ''))
                                    ? 'This device’s password changed and your saved one no longer works. Enter the new password shown on the host to reconnect.'
                                    : 'Please enter the password that is displayed on your partner’s computer.'}
                            </p>

                            <div className="flex flex-col gap-[18px]">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[14px] leading-5 text-[#111315]">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPromptPassword ? 'text' : 'password'}
                                            placeholder="Network Hardware Key"
                                            value={promptPassword}
                                            onChange={(e) => setPromptPassword(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && promptPassword && viewerStatus !== 'connecting') submitPasswordPrompt(); }}
                                            className="h-10 w-full rounded border border-[#1A1D21]/30 bg-white px-4 pr-10 text-[14px] text-[#111315] outline-none transition-colors placeholder:text-[#111315]/40 focus:border-[#FF8A00]"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => setShowPromptPassword(!showPromptPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#111315]/60 transition-colors hover:text-[#111315]"
                                        >
                                            {showPromptPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {promptError && (
                                        <p className="text-[13px] leading-5 text-[#E5484D]">{promptError}</p>
                                    )}
                                </div>

                                <label className="flex cursor-pointer items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={promptRemember}
                                        onChange={(e) => setPromptRemember(e.target.checked)}
                                        className="h-4 w-4 rounded border-[#1A1D21]/30 text-[#FF8A00] accent-[#FF8A00]"
                                    />
                                    <span className="text-[13px] text-[#111315]/70">Remember This Machine</span>
                                </label>

                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => { setShowPasswordPrompt(null); setPromptError(null); }}
                                        className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitPasswordPrompt}
                                        disabled={!promptPassword || viewerStatus === 'connecting'}
                                        className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5 disabled:opacity-50"
                                    >
                                        {viewerStatus === 'connecting' ? 'Connecting…' : 'Connect'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Device Modal */}
            <ToastViewport />

            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300 font-['Mona_Sans',system-ui,sans-serif]">
                    <div className="w-full max-w-xl bg-white p-0 rounded-[28px] shadow-2xl border border-[rgba(26,29,33,0.12)] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                            <h3 className="text-[20px] font-semibold text-[#1C1C1C]">Add Remote Device</h3>
                            <button 
                                onClick={() => setShowAddModal(false)} 
                                className="p-2 text-gray-400 hover:text-black transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="px-8 pb-8">
                            <div className="mb-6 rounded-2xl border border-[#FFB347]/35 bg-[#FFF4E5] p-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[13px] font-bold text-[#111315]">This Computer</p>
                                    <p className="text-[12px] font-medium text-[rgba(26,29,33,0.62)] mt-1">Add the PC or laptop where this desktop app is installed and logged in.</p>
                                </div>
                                <button
                                    onClick={handleAddCurrentDevice}
                                    className="shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-bold text-black bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] hover:brightness-105 transition-all"
                                >
                                    Add This Device
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-[#757575] ml-1">Device Name</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Office PC" 
                                            value={addName}
                                            onChange={e => setAddName(e.target.value)}
                                            className="w-full h-12 px-4 bg-[#F9FAFB] border border-gray-200 rounded-xl text-[14px] font-medium focus:border-[#FF8A00] focus:bg-white outline-none transition-all placeholder:text-gray-400"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-[#757575] ml-1">Group</label>
                                    <div className="relative">
                                        <select
                                            value={addGroup}
                                            onChange={e => setAddGroup(e.target.value)}
                                            onFocus={loadAccountDeviceGroups}
                                            className="w-full h-12 appearance-none px-4 pr-10 bg-[#F9FAFB] border border-gray-200 rounded-xl text-[14px] font-medium focus:border-[#FF8A00] focus:bg-white outline-none transition-all"
                                        >
                                            {getAddGroupOptions().map(groupName => (
                                                <option key={groupName} value={groupName}>{groupName}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-[#757575] ml-1">Remote365 ID</label>
                                    <input 
                                        type="text" 
                                        placeholder="000 000 000" 
                                        value={addKey}
                                        onChange={e => { setAddKey(formatCode(e.target.value)); setAddDeviceError(''); }}
                                        className="w-full h-12 px-4 bg-[#F9FAFB] border border-gray-200 rounded-xl text-[14px] font-medium focus:border-[#FF8A00] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-[#757575] ml-1">Password <span className="font-normal text-gray-400">(Optional)</span></label>
                                    <div className="relative">
                                        <input
                                            type={showAddPassword ? "text" : "password"}
                                            placeholder="Only If Required"
                                            value={addPassword}
                                            onChange={e => { setAddPassword(e.target.value); setAddDeviceError(''); }}
                                            className="w-full h-12 px-4 pr-11 bg-[#F9FAFB] border border-gray-200 rounded-xl text-[14px] font-medium focus:border-[#FF8A00] focus:bg-white outline-none transition-all placeholder:text-gray-400"
                                        />
                                        <button 
                                            onClick={() => setShowAddPassword(!showAddPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                                        >
                                            {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {addDeviceError && (
                                <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#FEF3F2] px-3 py-2.5 text-[12px] font-medium text-[#D92D20]">
                                    <AlertCircle size={15} className="shrink-0" />
                                    <span>{addDeviceError}</span>
                                </div>
                            )}

                            <div className="mt-8 flex items-center justify-between gap-4">
                                <label className="flex cursor-pointer select-none items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={addRemember}
                                        onChange={e => setAddRemember(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-[#FF8A00] accent-[#FF8A00]"
                                    />
                                    <span className="text-[13px] text-[#111315]/70">Remember This Device</span>
                                </label>
                                <button
                                    onClick={handleAddDevice}
                                    disabled={!addKey || isAddingDevice}
                                    className={`flex items-center gap-2 px-10 py-2.5 rounded-xl text-[14px] font-semibold transition-all ${!addKey || isAddingDevice ? 'bg-[#F0F2F5] text-gray-400 cursor-not-allowed' : 'bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] text-black hover:brightness-105'}`}
                                >
                                    {isAddingDevice && <Loader2 size={16} className="animate-spin" />}
                                    {isAddingDevice ? 'Adding…' : 'Add Remote Device'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {actionModal && actionModal.type !== 'assign-group' && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300">
                    <div
                        className="w-full max-w-sm bg-white p-8 rounded-[28px] shadow-2xl animate-in zoom-in-95 duration-300"
                        style={{ fontFamily: "'Mona Sans', sans-serif" }}
                    >
                        <div className="mb-7 text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${actionModal.type === 'remove' ? 'bg-[#FF2D55]/15' : 'bg-[#FFB347]/25'}`}>
                                {actionModal.type === 'rename' ? <Edit2 size={24} className="text-[#FF8A00]" /> :
                                 actionModal.type === 'password' ? <KeyRound size={24} className="text-[#FF8A00]" /> :
                                 <Trash2 size={24} className="text-[#FF2D55]" />}
                            </div>
                            <h3 className="text-[20px] font-medium leading-[28px] text-[#111315] mb-2">
                                {actionModal.type === 'rename' ? 'Change Device Name' :
                                    actionModal.type === 'password' ? 'Set Device Password' :
                                        actionModal.type === 'remove' ? 'Delete Device' : ''}
                            </h3>
                            <p className="text-[14px] font-normal leading-5 text-[#1A1D21]/60 max-w-[260px] mx-auto">
                                {actionModal.type === 'rename' ? 'Set a nickname for this device.' :
                                    actionModal.type === 'password' ? 'Update the access password for this device.' :
                                        actionModal.type === 'remove' ? `Remove ${actionModal.device.device_name} from your account? This can't be undone.` : ''}
                            </p>
                        </div>

                        {(actionModal.type === 'rename' || actionModal.type === 'password') && (
                            <div className="mb-7">
                                <div className="relative">
                                    <input
                                        autoFocus
                                        type={actionModal.type === 'password' ? (showActionPassword ? 'text' : 'password') : 'text'}
                                        placeholder={actionModal.type === 'password' ? 'Enter A Password' : 'e.g. Office Laptop'}
                                        className={`w-full h-11 bg-white border text-[#111315] rounded-lg px-4 pr-11 text-[14px] font-normal outline-none transition-all placeholder:text-[#111315]/30 ${actionError ? 'border-[#FF2D55] focus:border-[#FF2D55]' : 'border-[rgba(26,29,33,0.3)] focus:border-[#FF8A00]'}`}
                                        value={actionValue}
                                        onChange={e => { setActionValue(e.target.value); setActionError(''); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (actionModal.type === 'rename') handleRename(actionModal.device);
                                                if (actionModal.type === 'password') handleSetPassword(actionModal.device);
                                            }
                                        }}
                                    />
                                    {actionModal.type === 'password' && (
                                        <button
                                            onClick={() => setShowActionPassword(!showActionPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#111315]/30 hover:text-[#FF8A00] transition-colors"
                                        >
                                            {showActionPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    )}
                                </div>
                                {actionError && (
                                    <p className="mt-2 text-[13px] leading-5 text-[#FF2D55]">{actionError}</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setActionModal(null); setShowActionPassword(false); setActionError(''); }}
                                className="flex-1 h-11 rounded-lg border border-[rgba(26,29,33,0.3)] text-[14px] font-medium text-[#1A1D21] hover:bg-[#F3F4F6] transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (actionModal.type === 'rename') handleRename(actionModal.device);
                                    if (actionModal.type === 'remove') handleRemove(actionModal.device);
                                    if (actionModal.type === 'password') handleSetPassword(actionModal.device);
                                    setShowActionPassword(false);
                                }}
                                className="flex-1 h-11 rounded-lg text-[14px] font-medium text-white transition-all hover:brightness-105"
                                style={actionModal.type === 'remove'
                                    ? { background: '#FF2D55' }
                                    : { background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
                            >
                                {actionModal.type === 'remove' ? 'Delete' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Error Modal */}
            <ErrorModal state={errorModal} onClose={() => setErrorModal(null)} />
            <AuthResultModal state={authResult} onClose={() => setAuthResult(null)} />
            {activeMeetingId && (
                <React.Suspense fallback={<LazyScreenFallback />}>
                    <SnowMeeting
                        meetingId={activeMeetingId}
                        claimHost={meetingClaimHost}
                        onLeave={() => { setActiveMeetingId(null); setMeetingClaimHost(false); }}
                        hostAccessKey={hostAccessKey}
                        devicePassword={devicePassword}
                        serverIP={serverIP}
                    />
                </React.Suspense>
            )}

            <MeetingPreviewModal
                open={!!pendingMeetingId}
                mode="join"
                onCancel={() => setPendingMeetingId(null)}
                onConfirm={() => {
                    const id = pendingMeetingId;
                    setPendingMeetingId(null);
                    if (id) openMeeting(id);
                }}
            />

            <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />

            {String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN' &&
                resolvedCurrentView !== 'end_user_home' &&
                resolvedCurrentView !== 'support_workstation' && (
                <MeetingsWhatsNew user={user} onOpenMeetings={() => setCurrentView('meetings' as any)} />
            )}
            </div>
        </div>
    );
}
