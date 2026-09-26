import { contextBridge, ipcRenderer } from 'electron';
import * as electronModule from 'electron';

// webUtils.getPathForFile arrived in Electron 29 and replaces File.path,
// which is gone in 32. Resolved at runtime so this preload builds on both.
const electronWebUtils = (electronModule as any).webUtils;

// Expose secure IPC methods to the React Renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('system:ping'),
  getToken: () => ipcRenderer.invoke('auth:getToken'),
  setToken: (token: string, refresh: string) => ipcRenderer.invoke('auth:setToken', token, refresh),
  deleteToken: () => ipcRenderer.invoke('auth:deleteToken'),
  startHosting: (accessKey?: string, settings?: any) => ipcRenderer.invoke('host:start', accessKey, settings),
  getHostStatus: () => ipcRenderer.invoke('host:getStatus'),
  stopHosting: () => ipcRenderer.invoke('host:stop'),
  connectToHost: (sessionId: string, serverIP?: string, token?: string, viewerClientId?: string, viewerDeviceId?: string) => ipcRenderer.invoke('viewer:connect', sessionId, serverIP, token, viewerClientId, viewerDeviceId),
  // TURN/STUN list fetched with this PC's machine credential, for viewing
  // while signed out (the account route needs a user token).
  getMachineIceServers: () => ipcRenderer.invoke('viewer:machine-ice-servers'),
  // LAN Direct — works with no internet and no cloud account.
  lanGetStatus: () => ipcRenderer.invoke('lan:get-status'),
  lanConfigure: (options: { enabled?: boolean; password?: string }) => ipcRenderer.invoke('lan:configure', options),
  lanDiscover: () => ipcRenderer.invoke('lan:discover'),
  lanConnect: (options: { sessionId: string; address: string; password: string; port?: number }) => ipcRenderer.invoke('viewer:connect-lan', options),
  getLocalIP: () => ipcRenderer.invoke('system:getLocalIP'),
  getSystemInfo: () => ipcRenderer.invoke('system:getSystemInfo'),
  getDeterministicKey: () => ipcRenderer.invoke('system:getDeterministicKey'),
  getMachineFingerprint: () => ipcRenderer.invoke('system:getMachineFingerprint'),
  getMachineName: () => ipcRenderer.invoke('system:getMachineName'),
  getStartWithWindows: () => ipcRenderer.invoke('system:getStartWithWindows'),
  setStartWithWindows: (enabled: boolean) => ipcRenderer.invoke('system:setStartWithWindows', enabled),
  setLaunchAtStartup: (enabled: boolean) => ipcRenderer.invoke('system:setLaunchAtStartup', enabled),
  getLaunchAtStartup: () => ipcRenderer.invoke('system:getLaunchAtStartup'),
  getAppVersion: () => ipcRenderer.invoke('system:getAppVersion'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:set-title', title),
  forceReload: () => ipcRenderer.invoke('window:force-reload'),
  openViewerWindow: (sessionId: string, serverIP: string, token: string, deviceName?: string, deviceType?: string) => ipcRenderer.invoke('viewer:open-window', sessionId, serverIP, token, deviceName, deviceType),
  getViewerMediaActive: () => ipcRenderer.invoke('viewer:get-media-active'),
  onViewerMediaActive: (callback: (active: boolean) => void) => {
    const listener = (_: any, active: boolean) => callback(active);
    ipcRenderer.on('viewer:media-active', listener);
    return () => ipcRenderer.removeListener('viewer:media-active', listener);
  },
  closeViewerTab: (sessionId?: string) => ipcRenderer.send('viewer:close-current-tab', sessionId),
  openMeetingWindow: (meetingId: string, options?: { asHost?: boolean }) => ipcRenderer.invoke('meeting:open-window', meetingId, options),
  openSessionWaitWindow: (session: { code: string; name?: string; link?: string }) => ipcRenderer.invoke('session:open-wait-window', session),
  onHostStatus: (callback: (status: string) => void) => {
    const listener = (_: any, status: string) => callback(status);
    ipcRenderer.on('host:status', listener);
    return () => ipcRenderer.removeListener('host:status', listener);
  },
  onViewerVideoChunk: (callback: (buffer: Uint8Array) => void) => {
    const listener = (_: any, buffer: Uint8Array) => callback(buffer);
    ipcRenderer.on('viewer:video-chunk', listener);
    return () => ipcRenderer.removeListener('viewer:video-chunk', listener);
  },
  openPath: (savePath: string) => ipcRenderer.invoke('system:openPath', savePath),
  // Real filesystem path of a File dropped onto the window (file manager drop zone).
  webUtils: {
    getPathForFile: (file: File): string => {
      try { return electronWebUtils?.getPathForFile ? String(electronWebUtils.getPathForFile(file) || '') : ''; } catch { return ''; }
    },
  },
  openLogsFolder: () => ipcRenderer.invoke('system:openLogsFolder'),
  sendSignalingMessage: (msg: any) => ipcRenderer.send('viewer:send-signaling', msg),
  onSignalingMessage: (callback: (msg: any) => void) => {
    const listener = (_: any, msg: any) => callback(msg);
    ipcRenderer.on('viewer:signaling-message', listener);
    return () => ipcRenderer.removeListener('viewer:signaling-message', listener);
  },
  onSignalingDisconnected: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('viewer:signaling-disconnected', listener);
    return () => ipcRenderer.removeListener('viewer:signaling-disconnected', listener);
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
    readText: () => ipcRenderer.invoke('clipboard:readText')
  },
  // Viewer: system keys (Win, Alt+Tab, Alt+F4, Ctrl+Esc, PrintScreen...) that
  // the native low-level hook swallowed locally, handed to the active session
  // tab so it can forward them to the remote machine. setEnabled opts this
  // tab in/out; main arms the hook only for the active, opted-in tab.
  systemKeys: {
    setEnabled: (enabled: boolean) => ipcRenderer.send('viewer:system-keys', Boolean(enabled)),
    onKey: (callback: (event: { vk: number; scan: number; down: boolean; extended: boolean; alt: boolean; ctrl: boolean; shift: boolean }) => void) => {
      const listener = (_: any, event: any) => callback(event);
      ipcRenderer.on('viewer:system-key', listener);
      return () => ipcRenderer.removeListener('viewer:system-key', listener);
    },
  },
  isPackaged: () => ipcRenderer.invoke('system:isPackaged'),
  log: (msg: string, level: 'info' | 'warn' | 'error' = 'info') => ipcRenderer.invoke('system:log', msg, level),
  onAuthDeepLinkSuccess: (callback: (tokens: { accessToken: string, refreshToken: string }) => void) => {
    const listener = (_: any, tokens: { accessToken: string, refreshToken: string }) => callback(tokens);
    ipcRenderer.on('auth:deep-link-success', listener);
    return () => ipcRenderer.removeListener('auth:deep-link-success', listener);
  },
  onAuthDeepLinkError: (callback: (data: { message: string }) => void) => {
    const listener = (_event: any, data: { message: string }) => callback(data);
    ipcRenderer.on('auth:deep-link-error', listener);
    return () => ipcRenderer.removeListener('auth:deep-link-error', listener);
  },
  // Main asks this window to show a view (e.g. the viewer tab strip's "+" → Devices).
  onNavigateRequest: (callback: (view: string) => void) => {
    const listener = (_: any, view: any) => callback(String(view || ''));
    ipcRenderer.on('app:navigate', listener);
    return () => ipcRenderer.removeListener('app:navigate', listener);
  },
  onHostStats: (callback: (stats: { bandwidth: string, activeUsers: number, cpu: string, memory: string }) => void) => {
    const listener = (_: any, stats: any) => callback(stats);
    ipcRenderer.on('host:stats', listener);
    return () => ipcRenderer.removeListener('host:stats', listener);
  },
  onHostPasswordUpdated: (callback: (data: { password?: string; passwordRequired?: boolean }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('host:password-updated', listener);
    return () => ipcRenderer.removeListener('host:password-updated', listener);
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  // Native Save As for a chat attachment; a cross-origin <a download> would
  // navigate the app window to the file instead.
  downloadFile: (url: string) => ipcRenderer.invoke('chat:download-file', url),
  approveViewer: (viewerId: string, trustDevice?: boolean) => ipcRenderer.send('host:approve-viewer', viewerId, trustDevice),
  denyViewer: (viewerId: string) => ipcRenderer.send('host:deny-viewer', viewerId),
  approveControl: (viewerId: string) => ipcRenderer.send('host:approve-control', viewerId),
  denyControl: (viewerId: string) => ipcRenderer.send('host:deny-control', viewerId),
  onViewerRequest: (callback: (data: { viewerId: string; viewerClientId?: string; viewerName?: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('host:viewer-request', listener);
    return () => ipcRenderer.removeListener('host:viewer-request', listener);
  },
  onViewerRequestCancelled: (callback: (data: { viewerId: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('host:viewer-request-cancelled', listener);
    return () => ipcRenderer.removeListener('host:viewer-request-cancelled', listener);
  },
  onParticipantJoined: (callback: (data: { viewerId?: string; viewerClientId?: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('host:participant-joined', listener);
    return () => ipcRenderer.removeListener('host:participant-joined', listener);
  },
  onSessionWaitParticipantJoined: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('session:participant-joined', listener);
    return () => ipcRenderer.removeListener('session:participant-joined', listener);
  },
  // Fired when the centred consent window (or the dock) answered a control
  // request, so the in-app modal can drop its own countdown instead of
  // auto-denying 20s after the host already allowed it.
  onControlRequestResolved: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('host:control-request-resolved', listener);
    return () => ipcRenderer.removeListener('host:control-request-resolved', listener);
  },
  onControlRequest: (callback: (data: { viewerId: string; viewerName?: string; requestedAt?: number }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('host:control-request', listener);
    return () => ipcRenderer.removeListener('host:control-request', listener);
  },
  saveFileLocally: (name: string, data: Uint8Array) => ipcRenderer.invoke('host:save-file-locally', name, data),
  // Session-security enforcement (Settings → Remote control)
  setPanicHotkey: (accelerator: string) => ipcRenderer.invoke('host:set-panic-hotkey', accelerator),
  // Settings → "Block File Transfer": refuse every ft: request on this host.
  setFileTransferBlocked: (blocked: boolean) => ipcRenderer.invoke('host:set-file-transfer-blocked', blocked),
  getFileTransferBlocked: () => ipcRenderer.invoke('host:get-file-transfer-blocked'),
  // Options → "Minimize App When A Session Starts" (main does the minimising).
  setHostAutoMinimize: (enabled: boolean) => ipcRenderer.invoke('host:set-auto-minimize', enabled),
  setIdleTimeout: (minutes: number) => ipcRenderer.invoke('host:set-idle-timeout', minutes),
  pickFolder: () => ipcRenderer.invoke('system:pickFolder'),
  setReceivedDir: (dir: string) => ipcRenderer.invoke('host:set-received-dir', dir),
  getReceivedDir: () => ipcRenderer.invoke('host:get-received-dir'),
  onPanicTriggered: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('host:panic-triggered', listener);
    return () => ipcRenderer.removeListener('host:panic-triggered', listener);
  },
  onIdleDisconnected: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('host:idle-disconnected', listener);
    return () => ipcRenderer.removeListener('host:idle-disconnected', listener);
  },
  // Fired when this machine starts/stops being controlled remotely. Payload is
  // { active, viewerName } (legacy boolean still accepted). Drives the
  // host-window lock overlay (only the title bar stays clickable).
  onRemoteControlChange: (callback: (active: boolean, viewerName?: string) => void) => {
    const listener = (_e: any, payload: any) => {
      if (payload && typeof payload === 'object') callback(Boolean(payload.active), String(payload.viewerName || ''));
      else callback(Boolean(payload), '');
    };
    ipcRenderer.on('host:remote-control', listener);
    return () => ipcRenderer.removeListener('host:remote-control', listener);
  },
  // True if remote-session input was injected within the last ~1.5s — used by
  // the lock overlay to tell the remote technician apart from the local user.
  wasRemoteInputRecent: () => ipcRenderer.invoke('host:was-remote-input-recent'),
  // Host-side kill switch for the active remote session (same as the dock button).
  endRemoteSession: () => ipcRenderer.send('host-dock:end-session'),
  // Softer than ending the session: input goes dead, the viewer keeps seeing
  // the screen and has to request control again (same as the dock's Stop button).
  revokeRemoteControl: () => ipcRenderer.send('host-dock:revoke-control'),
  // --- Remote audio (this machine's speakers, streamed to the viewer) ---
  // Main asks the renderer to start/stop loopback capture as sessions come and
  // go; encoded Opus frames go back the other way.
  onHostAudioCapture: (callback: (active: boolean) => void) => {
    const listener = (_e: any, payload: any) => callback(Boolean(payload?.active));
    ipcRenderer.on('host:audio-capture', listener);
    return () => ipcRenderer.removeListener('host:audio-capture', listener);
  },
  // A viewer started/stopped recording this machine's session.
  onHostRecordingState: (callback: (info: { on: boolean; byName?: string }) => void) => {
    const listener = (_e: any, info: any) => callback({ on: Boolean(info?.on), byName: String(info?.byName || '') });
    ipcRenderer.on('host:recording-state', listener);
    return () => ipcRenderer.removeListener('host:recording-state', listener);
  },
  sendHostAudioChunk: (data: Uint8Array, samples: number) =>
    ipcRenderer.send('host:audio-chunk', { data, samples }),
  // Advanced settings (Settings → Advanced)
  setAdvancedFlags: (patch: { disableGpu?: boolean; launchMinimized?: boolean; keepRunning?: boolean; detailedLogs?: boolean }) => ipcRenderer.invoke('system:set-advanced', patch),
  getAdvancedFlags: () => ipcRenderer.invoke('system:get-advanced'),
  // Network settings (Settings → Network)
  net: {
    setProxy: (mode: string, manual?: string) => ipcRenderer.invoke('net:set-proxy', mode, manual),
    setIcePolicy: (policy: 'all' | 'relay') => ipcRenderer.invoke('net:set-ice-policy', policy),
    getMac: () => ipcRenderer.invoke('net:get-mac'),
    wake: (mac: string) => ipcRenderer.invoke('net:wake', mac),
  },
  files: {
    list: (path?: string, options?: { showHidden?: boolean }) => ipcRenderer.invoke('files:list-local', path, options),
    read: (path: string) => ipcRenderer.invoke('files:read-local-file', path),
    // --- File manager (transfer protocol v2) ---
    // Enumerate a selection recursively, so a folder can be queued as a job.
    walk: (paths: string[]) => ipcRenderer.invoke('files:walk-local', paths),
    // Block reads instead of read(): a whole file in a renderer string/array
    // is exactly the memory spike the old transfer had.
    readChunk: (path: string, offset: number, length: number) =>
      ipcRenderer.invoke('files:read-chunk', path, offset, length),
    // Streamed writes — received bytes go to disk as they arrive.
    openWrite: (destDir: string, relPath: string, options?: { append?: boolean }) => ipcRenderer.invoke('files:open-write', destDir, relPath, options),
    writeChunk: (handle: number, data: Uint8Array) => ipcRenderer.invoke('files:write-chunk', handle, data),
    closeWrite: (handle: number) => ipcRenderer.invoke('files:close-write', handle),
    abortWrite: (handle: number) => ipcRenderer.invoke('files:abort-write', handle),
    mkdir: (parent: string, name: string) => ipcRenderer.invoke('files:mkdir-local', parent, name),
    defaultReceiveDir: () => ipcRenderer.invoke('files:default-receive-dir'),
    reveal: (path: string) => ipcRenderer.invoke('files:reveal', path),
    pickFiles: () => ipcRenderer.invoke('files:pick-files'),
    pickFolder: () => ipcRenderer.invoke('files:pick-folder'),
  },
  sendFileToViewer: () => ipcRenderer.send('host:send-file'),
  getScreens: () => ipcRenderer.invoke('host:get-screens'),
  setCaptureScreen: (displayId: number) => ipcRenderer.invoke('host:set-capture-screen', displayId),
  getScreenSources: () => ipcRenderer.invoke('meeting:get-screen-sources'),
  onOnboardingToken: (callback: (token: string) => void) => {
    const listener = (_: any, token: string) => callback(token);
    ipcRenderer.on('auth:onboarding-token', listener);
    return () => ipcRenderer.removeListener('auth:onboarding-token', listener);
  },
  onSessionJoinLink: (callback: (payload: { code: string; password?: string }) => void) => {
    const listener = (_: any, payload: { code: string; password?: string }) => callback(payload);
    ipcRenderer.on('session:join-link', listener);
    return () => ipcRenderer.removeListener('session:join-link', listener);
  },
  onMeetingJoinLink: (callback: (payload: { code: string }) => void) => {
    const listener = (_: any, payload: { code: string }) => callback(payload);
    ipcRenderer.on('meeting:join-link', listener);
    return () => ipcRenderer.removeListener('meeting:join-link', listener);
  },
  onTemp2faToken: (callback: (token: string) => void) => {
    const listener = (_: any, token: string) => callback(token);
    ipcRenderer.on('auth:temp-2fa-token', listener);
    return () => ipcRenderer.removeListener('auth:temp-2fa-token', listener);
  },
  updates: {
    check: (manual?: boolean) => ipcRenderer.invoke('update:check', Boolean(manual)),
    getLatestInfo: () => ipcRenderer.invoke('update:getLatestInfo'),
    download: () => ipcRenderer.invoke('update:download'),
    quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
    getAutoInstall: () => ipcRenderer.invoke('update:getAutoInstall'),
    setAutoInstall: (enabled: boolean) => ipcRenderer.invoke('update:setAutoInstall', enabled),
    onAvailable: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info);
      ipcRenderer.on('update:available', listener);
      return () => ipcRenderer.removeListener('update:available', listener);
    },
    onNotAvailable: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('update:not-available', listener);
      return () => ipcRenderer.removeListener('update:not-available', listener);
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, progress: any) => callback(progress);
      ipcRenderer.on('update:download-progress', listener);
      return () => ipcRenderer.removeListener('update:download-progress', listener);
    },
    onDownloaded: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info);
      ipcRenderer.on('update:downloaded', listener);
      return () => ipcRenderer.removeListener('update:downloaded', listener);
    },
    // Fired when the app is about to restart itself to apply an update
    // ({seconds} of notice; 0 = restarting right now).
    onRestarting: (callback: (info: { seconds: number; version?: string }) => void) => {
      const listener = (_: any, info: any) => callback(info || { seconds: 0 });
      ipcRenderer.on('update:restarting', listener);
      return () => ipcRenderer.removeListener('update:restarting', listener);
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_: any, error: string) => callback(error);
      ipcRenderer.on('update:error', listener);
      return () => ipcRenderer.removeListener('update:error', listener);
    }
  },
  viewers: {
    getActive: () => ipcRenderer.invoke('viewer:get-active'),
    onActiveChanged: (callback: (keys: string[]) => void) => {
      const listener = (_: any, keys: string[]) => callback(keys);
      ipcRenderer.on('viewer:active-changed', listener);
      return () => ipcRenderer.removeListener('viewer:active-changed', listener);
    }
  },
  // Custom Windows-style title-bar controls (main window is frameless).
  windowControls: {
    minimize: () => ipcRenderer.send('window-controls:minimize'),
    maximize: () => ipcRenderer.send('window-controls:maximize'),
    close: () => ipcRenderer.send('window-controls:close'),
    isMaximized: () => ipcRenderer.invoke('window-controls:is-maximized'),
    onMaximizedChange: (callback: (maximized: boolean) => void) => {
      const listener = (_: any, maximized: boolean) => callback(maximized);
      ipcRenderer.on('window-controls:maximized', listener);
      return () => ipcRenderer.removeListener('window-controls:maximized', listener);
    }
  }
});
