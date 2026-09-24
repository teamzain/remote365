/**
 * File manager for a live remote session — three layers.
 *
 *  1. Quick actions (the default). Two buttons — Send Files To <device> and
 *     Get Files From <device> — a drop zone, and the transfers tray. No panes,
 *     no paths: sends land in the remote user's received-files folder, gets
 *     land in ours. This is the layman's whole feature.
 *  2. Browse. An Explorer-shaped view of ONE computer at a time (a switch
 *     picks which): breadcrumb you can click or type into, Back / Forward /
 *     Up, sortable Name / Size / Type / Modified columns, a search box that
 *     also searches the whole folder on disk when it is bigger than one page,
 *     quick links, a right-click menu, and one action button that names what
 *     will happen. "Get" and "Send To" open this view pinned to the remote
 *     computer.
 *  3. Advanced. The original two-pane manager (drag between panes, arrows in
 *     the middle) behind a remembered toggle, for technicians who want it.
 *
 * The panel floats without a backdrop, drags by its header, and collapses to
 * a progress pill so the session stays usable underneath. Transfers are owned
 * by the session-scoped engine, not this panel — closing it never abandons a
 * running job.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronRight, ChevronUp, Columns2, Copy, DownloadCloud,
  Eye, EyeOff, File as FileIcon, Folder, FolderOpen, FolderPlus, HardDrive, Link2, Lock, Minus,
  Pencil, RefreshCw, Search, UploadCloud, X, XCircle,
} from 'lucide-react';
import {
  TransferJob, formatBytes, formatDuration,
  getFileTransferEngine, setTransferPlan, subscribeTransferJobs,
} from '../../lib/fileTransferEngine';
import { describeLimit, maxFileBytesForPlan } from '../../lib/transferLimits';
import { useLicenseStore } from '../../store/licenseStore';
import { subscribeControlJson } from '../../lib/sessionControlBus';

type BrowserItem = {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size: number;
  modifiedAt: string;
  /** Symlink / junction / OneDrive reparse point — listed, tagged, followed. */
  link?: boolean;
  /** A link whose target is gone. */
  broken?: boolean;
  /** We could see the entry but not read it. */
  locked?: boolean;
  hidden?: boolean;
};
type BrowserState = {
  path: string;
  parentPath: string;
  roots: Array<{ name: string; path: string }>;
  items: BrowserItem[];
  loading: boolean;
  loadingMore?: boolean;
  error: string;
  /** Remote side only: the session is view-only, so the host will not answer. */
  needsControl?: boolean;
  totalCount?: number;
  /** More entries exist beyond what has been fetched ("Show More"). */
  truncated?: boolean;
  /** The listing is a whole-folder search for this text. */
  query?: string;
};
type ListOpts = { query?: string; offset?: number; append?: boolean };
type Side = 'local' | 'remote';
type SortKey = 'name' | 'size' | 'type' | 'modified';
type SortState = { key: SortKey; dir: 1 | -1 };
type PaneHistory = { back: string[]; forward: string[] };
type ContextMenu = { side: Side; item: BrowserItem | null; x: number; y: number };

const EMPTY_BROWSER: BrowserState = { path: '', parentPath: '', roots: [], items: [], loading: true, error: '' };
const DEFAULT_SORT: SortState = { key: 'name', dir: 1 };
/** Entries fetched per request; "Show More" fetches the next page. */
const LIST_PAGE = 2000;

/** Marks a drag that started in one of our own panes, not from the OS. */
const INTERNAL_DRAG_TYPE = 'application/x-remote365-files';
/** A host that has not answered a listing in this long is treated as gone. */
const REMOTE_LIST_TIMEOUT_MS = 8000;

const PREF_ADVANCED = 'remote365.files.advanced';
const PREF_SHOW_HIDDEN = 'remote365.files.showHidden';

const readPref = (key: string): boolean => {
  try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
};
const writePref = (key: string, value: boolean) => {
  try { window.localStorage.setItem(key, value ? '1' : '0'); } catch { /* preference still applies this session */ }
};

type View = 'quick' | 'browse' | 'advanced';
/** What the single-pane Browse view is for; it changes the action button. */
type BrowseMode = 'explore' | 'get' | 'sendTo';

type Props = {
  deviceName?: string;
  userName?: string;
  /** Puts a JSON object or a binary frame on the session control channel. */
  sendControl: (payload: any) => void;
  getChannel: () => RTCDataChannel | null;
  onClose: () => void;
  /** View-only sessions cannot browse the host; the panel says so instead of spinning. */
  controlStatus?: 'granted' | 'pending' | 'denied';
  onRequestControl?: () => void;
  /** Start as the small progress pill (a host-initiated transfer arrived). */
  openCollapsed?: boolean;
};

/**
 * Electron exposes the real filesystem path of a dropped file. `File.path`
 * went away in Electron 32; the preload's webUtils bridge is the replacement.
 */
function pathOfDroppedFile(file: File): string {
  const direct = (file as any).path;
  if (typeof direct === 'string' && direct) return direct;
  try {
    return (window as any).electronAPI?.webUtils?.getPathForFile?.(file) || '';
  } catch {
    return '';
  }
}

const planLabel = (plan: string | undefined | null): string => {
  const key = String(plan || 'TRIAL').toUpperCase();
  return key.charAt(0) + key.slice(1).toLowerCase();
};

/** "C:\Users\x\Documents" → [C:, Users, x, Documents]; UNC keeps \\server\share whole. */
function splitPath(path: string): Array<{ label: string; path: string }> {
  if (!path) return [];
  if (path.startsWith('\\\\')) {
    const parts = path.replace(/^\\\\/, '').split(/[\\/]/).filter(Boolean);
    let acc = `\\\\${parts.slice(0, 2).join('\\')}`;
    const crumbs = [{ label: acc, path: acc }];
    for (const part of parts.slice(2)) { acc = `${acc}\\${part}`; crumbs.push({ label: part, path: acc }); }
    return crumbs;
  }
  const isWindows = /^[a-zA-Z]:/.test(path);
  const sep = path.includes('\\') ? '\\' : '/';
  const parts = path.split(/[\\/]/).filter(Boolean);
  const crumbs: Array<{ label: string; path: string }> = [];
  let acc = '';
  parts.forEach((part, index) => {
    if (index === 0) acc = isWindows ? `${part}${sep}` : `${sep}${part}`;
    else acc = acc.endsWith(sep) ? `${acc}${part}` : `${acc}${sep}${part}`;
    crumbs.push({ label: part, path: acc });
  });
  if (!isWindows && !crumbs.length) crumbs.push({ label: '/', path: '/' });
  return crumbs;
}

const typeLabel = (item: BrowserItem): string => {
  if (item.type === 'directory') return item.link ? 'Folder shortcut' : 'Folder';
  if (item.link) return 'Shortcut';
  const dot = item.name.lastIndexOf('.');
  return dot > 0 && dot < item.name.length - 1 ? `${item.name.slice(dot + 1).toUpperCase()} file` : 'File';
};

const formatModified = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

function sortItems(items: BrowserItem[], sort: SortState): BrowserItem[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...items].sort((a, b) => {
    // Folders stay above files whichever column is sorted.
    if ((a.type === 'directory') !== (b.type === 'directory')) return a.type === 'directory' ? -1 : 1;
    let result = 0;
    if (sort.key === 'size') result = a.size - b.size;
    else if (sort.key === 'modified') result = (a.modifiedAt || '').localeCompare(b.modifiedAt || '');
    else if (sort.key === 'type') result = collator.compare(typeLabel(a), typeLabel(b));
    if (result === 0) result = collator.compare(a.name, b.name);
    return result * sort.dir;
  });
}

const FileManagerPanel: React.FC<Props> = ({
  deviceName, userName, sendControl, getChannel, onClose, controlStatus, onRequestControl, openCollapsed,
}) => {
  const device = deviceName || 'The Remote Computer';
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  const [local, setLocal] = useState<BrowserState>(EMPTY_BROWSER);
  const [remote, setRemote] = useState<BrowserState>(EMPTY_BROWSER);
  const [localSelection, setLocalSelection] = useState<string[]>([]);
  const [remoteSelection, setRemoteSelection] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(Boolean(openCollapsed));
  const [dropActive, setDropActive] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [advanced, setAdvanced] = useState(() => readPref(PREF_ADVANCED));
  const [showHidden, setShowHidden] = useState(() => readPref(PREF_SHOW_HIDDEN));
  const [view, setView] = useState<View>(() => (readPref(PREF_ADVANCED) ? 'advanced' : 'quick'));
  const [browseMode, setBrowseMode] = useState<BrowseMode>('explore');
  const [browseSide, setBrowseSide] = useState<Side>('remote');
  const [localSort, setLocalSort] = useState<SortState>(DEFAULT_SORT);
  const [remoteSort, setRemoteSort] = useState<SortState>(DEFAULT_SORT);
  const [pathEditing, setPathEditing] = useState<Side | null>(null);
  const [pathDraft, setPathDraft] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const localHistRef = useRef<PaneHistory>({ back: [], forward: [] });
  const remoteHistRef = useRef<PaneHistory>({ back: [], forward: [] });
  const panelRef = useRef<HTMLDivElement | null>(null);

  const remoteReqRef = useRef(0);
  const remotePendingRef = useRef<{ reqId: number; append: boolean; query: string } | null>(null);
  const remoteTimeoutRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);
  const [newFolderFor, setNewFolderFor] = useState<Side | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  // Per-pane name filter — typing beats scrolling through thousands of rows.
  const [localFilter, setLocalFilter] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('');

  const canBrowseRemote = controlStatus === undefined || controlStatus === 'granted';

  // Owned by the session, not by this panel: closing the panel must not
  // abandon a running transfer.
  const engine = getFileTransferEngine(sendControl, getChannel);

  /* ---------------- wiring ---------------- */

  useEffect(() => subscribeTransferJobs(setJobs), []);

  // Per-file limits scale with the workspace's billing plan.
  const licensePlan = useLicenseStore((s) => s.plan);
  useEffect(() => { setTransferPlan(licensePlan); }, [licensePlan]);
  const perFileLimit = useMemo(() => maxFileBytesForPlan(licensePlan), [licensePlan]);
  const limitSentence = perFileLimit === null
    ? `No per-file size limit on your ${planLabel(licensePlan)} plan.`
    : `Up to ${describeLimit(perFileLimit)} per file on your ${planLabel(licensePlan)} plan.`;

  useEffect(() => {
    // Directory listings are only interesting while the panel is open, so
    // unlike the transfer messages this subscription is panel-scoped.
    const offJson = subscribeControlJson((data) => {
      const type = String(data?.type || '');
      if (type === 'ft:list-result' || type === 'ft:list-error') {
        // A late answer to an earlier request must not replace what the user
        // is looking at now (it used to, and took the selection with it).
        if (data.reqId !== undefined && Number(data.reqId) !== remoteReqRef.current) return true;
        if (remoteTimeoutRef.current) { window.clearTimeout(remoteTimeoutRef.current); remoteTimeoutRef.current = null; }
      }
      if (type === 'ft:list-result') {
        const pending = remotePendingRef.current;
        const append = Boolean(pending?.append);
        const items: BrowserItem[] = Array.isArray(data.items) ? data.items : [];
        setRemote((prev) => ({
          path: String(data.path || ''),
          parentPath: String(data.parentPath || ''),
          roots: Array.isArray(data.roots) ? data.roots : [],
          items: append ? [...prev.items, ...items] : items,
          loading: false,
          loadingMore: false,
          error: '',
          totalCount: Number(data.totalCount) || undefined,
          truncated: Boolean(data.truncated),
          query: String(data.query || pending?.query || ''),
        }));
        if (!append) {
          setRemoteSelection([]);
          if (!pending?.query) setRemoteFilter('');
        }
        return true;
      }
      if (type === 'ft:list-error') {
        setRemote((prev) => ({ ...prev, loading: false, loadingMore: false, error: String(data.message || 'Could not open that folder.') }));
        return true;
      }
      return false;
    });
    return () => {
      offJson();
      if (remoteTimeoutRef.current) window.clearTimeout(remoteTimeoutRef.current);
    };
  }, []);

  const loadLocal = useCallback(async (path?: string, opts: ListOpts = {}) => {
    setLocal((prev) => ({ ...prev, loading: !opts.append, loadingMore: Boolean(opts.append), error: '' }));
    try {
      const listing = await (window as any).electronAPI?.files?.list(path, {
        showHidden, offset: opts.offset || 0, limit: LIST_PAGE, query: opts.query || '',
      });
      const items: BrowserItem[] = Array.isArray(listing?.items) ? listing.items : [];
      setLocal((prev) => ({
        path: String(listing?.path || ''),
        parentPath: String(listing?.parentPath || ''),
        roots: Array.isArray(listing?.roots) ? listing.roots : [],
        items: opts.append ? [...prev.items, ...items] : items,
        loading: false,
        loadingMore: false,
        error: '',
        totalCount: Number(listing?.totalCount) || undefined,
        truncated: Boolean(listing?.truncated),
        query: String(listing?.query || opts.query || ''),
      }));
      if (!opts.append) {
        setLocalSelection([]);
        if (!opts.query) setLocalFilter('');
      }
    } catch (err: any) {
      setLocal((prev) => ({ ...prev, loading: false, loadingMore: false, error: err?.message || 'Could not open that folder.' }));
    }
  }, [showHidden]);

  const loadRemote = useCallback((path?: string, opts: ListOpts = {}) => {
    if (!canBrowseRemote) {
      setRemote((prev) => ({ ...prev, loading: false, error: '', needsControl: true }));
      return;
    }
    setRemote((prev) => ({ ...prev, loading: !opts.append, loadingMore: Boolean(opts.append), error: '', needsControl: false }));
    remoteReqRef.current += 1;
    const reqId = remoteReqRef.current;
    remotePendingRef.current = { reqId, append: Boolean(opts.append), query: opts.query || '' };
    sendControl({ type: 'ft:list', reqId, path, showHidden, offset: opts.offset || 0, limit: LIST_PAGE, query: opts.query || '' });
    if (remoteTimeoutRef.current) window.clearTimeout(remoteTimeoutRef.current);
    remoteTimeoutRef.current = window.setTimeout(() => {
      if (remoteReqRef.current !== reqId) return;
      setRemote((prev) => ((prev.loading || prev.loadingMore)
        ? { ...prev, loading: false, loadingMore: false, error: `${device} did not answer. Check the connection, then try Refresh.` }
        : prev));
    }, REMOTE_LIST_TIMEOUT_MS);
  }, [sendControl, showHidden, canBrowseRemote, device]);

  const stateOf = (side: Side) => (side === 'local' ? local : remote);
  const load = (side: Side, path?: string, opts?: ListOpts) => (side === 'local' ? void loadLocal(path, opts) : loadRemote(path, opts));

  // Navigation with Back / Forward history per pane.
  const go = useCallback((side: Side, path?: string, viaHistory = false) => {
    const state = side === 'local' ? local : remote;
    const hist = side === 'local' ? localHistRef.current : remoteHistRef.current;
    const target = path || '';
    if (!viaHistory && state.path && target !== state.path) {
      hist.back.push(state.path);
      if (hist.back.length > 50) hist.back.shift();
      hist.forward = [];
    }
    setPathEditing(null);
    load(side, path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, remote, loadLocal, loadRemote]);
  const goBack = (side: Side) => {
    const hist = side === 'local' ? localHistRef.current : remoteHistRef.current;
    const previous = hist.back.pop();
    if (previous === undefined) return;
    if (stateOf(side).path) hist.forward.push(stateOf(side).path);
    go(side, previous, true);
  };
  const goForward = (side: Side) => {
    const hist = side === 'local' ? localHistRef.current : remoteHistRef.current;
    const next = hist.forward.pop();
    if (next === undefined) return;
    if (stateOf(side).path) hist.back.push(stateOf(side).path);
    go(side, next, true);
  };

  // Only fetch listings for the panes that are actually on screen.
  const showsLocalPane = view === 'advanced' || (view === 'browse' && browseSide === 'local');
  const showsRemotePane = view === 'advanced' || (view === 'browse' && browseSide === 'remote');
  const listedLocalRef = useRef(false);
  const listedRemoteRef = useRef(false);
  useEffect(() => {
    if (showsLocalPane && !listedLocalRef.current) { listedLocalRef.current = true; void loadLocal(); }
  }, [showsLocalPane, loadLocal]);
  useEffect(() => {
    if (showsRemotePane && !listedRemoteRef.current) { listedRemoteRef.current = true; loadRemote(); }
  }, [showsRemotePane, loadRemote]);

  // Control arriving mid-session: a pane that was refused can now be listed.
  useEffect(() => {
    if (canBrowseRemote && remote.needsControl) loadRemote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canBrowseRemote]);

  const toggleHidden = () => {
    const next = !showHidden;
    setShowHidden(next);
    writePref(PREF_SHOW_HIDDEN, next);
  };
  // Re-list what is on screen when the hidden toggle flips.
  const hiddenInitRef = useRef(showHidden);
  useEffect(() => {
    if (hiddenInitRef.current === showHidden) return;
    hiddenInitRef.current = showHidden;
    if (listedLocalRef.current) void loadLocal(local.path || undefined, { query: local.query });
    if (listedRemoteRef.current) loadRemote(remote.path || undefined, { query: remote.query });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  // Whole-folder search: when a folder is bigger than one page (or we are
  // already inside a search), the typed filter is sent to the disk side.
  useEffect(() => {
    if (!listedLocalRef.current || !(local.truncated || local.query)) return;
    const wanted = localFilter.trim();
    if (wanted === (local.query || '')) return;
    const timer = window.setTimeout(() => void loadLocal(local.path || undefined, { query: wanted }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFilter]);
  useEffect(() => {
    if (!listedRemoteRef.current || !(remote.truncated || remote.query)) return;
    const wanted = remoteFilter.trim();
    if (wanted === (remote.query || '')) return;
    const timer = window.setTimeout(() => loadRemote(remote.path || undefined, { query: wanted }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteFilter]);

  const switchAdvanced = (next: boolean) => {
    setAdvanced(next);
    writePref(PREF_ADVANCED, next);
    setView(next ? 'advanced' : 'quick');
  };

  const openBrowse = (mode: BrowseMode, side: Side) => {
    setBrowseMode(mode);
    setBrowseSide(side);
    setView('browse');
  };

  // Close the context menu on any click elsewhere or Escape.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onKey); };
  }, [contextMenu]);

  /* ---------------- selection ---------------- */

  const toggleSelection = (side: Side, item: BrowserItem, event: React.MouseEvent, items: BrowserItem[]) => {
    const current = side === 'local' ? localSelection : remoteSelection;
    const setSelection = side === 'local' ? setLocalSelection : setRemoteSelection;
    if (event.shiftKey && current.length) {
      const lastPath = current[current.length - 1];
      const from = items.findIndex((entry) => entry.path === lastPath);
      const to = items.findIndex((entry) => entry.path === item.path);
      if (from >= 0 && to >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const range = items.slice(start, end + 1).map((entry) => entry.path);
        setSelection(Array.from(new Set([...current, ...range])));
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      setSelection(current.includes(item.path) ? current.filter((path) => path !== item.path) : [...current, item.path]);
      return;
    }
    setSelection([item.path]);
  };

  /* ---------------- transfers ---------------- */

  // destDir '' = the host's received-files folder (its setting, else
  // Downloads\Remote365). The quick actions never ask for a destination.
  const sendFiles = useCallback((paths: string[], destDir: string) => {
    if (!paths.length) return;
    void engine.sendPaths(paths, destDir).then(() => {
      if (destDir && listedRemoteRef.current && destDir === remote.path) loadRemote(destDir);
    });
  }, [engine, loadRemote, remote.path]);

  const pickAndSend = useCallback(async (kind: 'files' | 'folder', destDir: string) => {
    const files = (window as any).electronAPI?.files;
    if (!files) return;
    if (kind === 'files') {
      const paths: string[] = await files.pickFiles().catch(() => []);
      if (Array.isArray(paths) && paths.length) sendFiles(paths, destDir);
    } else {
      const path: string = await files.pickFolder().catch(() => '');
      if (path) sendFiles([path], destDir);
    }
  }, [sendFiles]);

  const receivePaths = useCallback((paths: string[]) => {
    if (!paths.length) return;
    // '' = our received-files folder; the tray's Open Folder shows where.
    engine.pullPaths(paths, view === 'advanced' ? local.path : '');
    if (view === 'browse' && browseMode === 'get') setView('quick');
  }, [engine, local.path, view, browseMode]);

  // A completed receive should show up in the local pane without a manual
  // refresh — that gap is what makes a transfer feel like it did not happen.
  const doneReceiveCountRef = useRef(0);
  useEffect(() => {
    const finished = jobs.filter((job) => job.state === 'done' && job.direction === 'receive').length;
    if (finished > doneReceiveCountRef.current) {
      doneReceiveCountRef.current = finished;
      if (listedLocalRef.current) void loadLocal(local.path || undefined, { query: local.query });
    }
  }, [jobs, loadLocal, local.path, local.query]);

  // Inline, because window.prompt() is a no-op in Electron — a prompt-based
  // "New Folder" button silently does nothing.
  const commitNewFolder = () => {
    const side = newFolderFor;
    const name = newFolderName.trim();
    setNewFolderFor(null);
    setNewFolderName('');
    if (!side || !name) return;
    if (side === 'local') {
      void (window as any).electronAPI?.files?.mkdir(local.path, name)
        .then(() => loadLocal(local.path))
        .catch((err: any) => setLocal((prev) => ({ ...prev, error: err?.message || 'Could not create that folder.' })));
    } else {
      remoteReqRef.current += 1;
      remotePendingRef.current = { reqId: remoteReqRef.current, append: false, query: '' };
      sendControl({ type: 'ft:mkdir', reqId: remoteReqRef.current, path: remote.path, name, showHidden });
    }
  };

  const copyText = (text: string) => {
    const api = (window as any).electronAPI;
    if (api?.clipboard?.writeText) void api.clipboard.writeText(text);
    else void navigator.clipboard?.writeText?.(text);
  };

  /* ---------------- OS drag & drop ---------------- */

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDropActive(false);
    const paths = Array.from(event.dataTransfer.files || [])
      .map(pathOfDroppedFile)
      .filter(Boolean);
    // Quick actions send to the default folder; a remote pane on screen sends
    // to the folder it is showing.
    if (paths.length) sendFiles(paths, showsRemotePane ? remote.path : '');
  };

  const activeJob = jobs.find((job) => job.state === 'active' || job.state === 'preparing' || job.state === 'paused');

  /* ---------------- rendering ---------------- */

  const renderPane = (side: Side) => {
    const state = side === 'local' ? local : remote;
    const selection = side === 'local' ? localSelection : remoteSelection;
    const title = side === 'local' ? (userName || 'This Computer') : device;
    const filter = side === 'local' ? localFilter : remoteFilter;
    const setFilter = side === 'local' ? setLocalFilter : setRemoteFilter;
    const sort = side === 'local' ? localSort : remoteSort;
    const setSort = side === 'local' ? setLocalSort : setRemoteSort;
    const hist = side === 'local' ? localHistRef.current : remoteHistRef.current;
    const filtered = filter && !state.query
      ? state.items.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))
      : state.items;
    const visibleItems = sortItems(filtered, sort);
    const crumbs = splitPath(state.path);

    const sortButton = (key: SortKey, label: string, extraClass = '') => (
      <button
        type="button"
        onClick={() => setSort((prev) => ({ key, dir: prev.key === key ? (prev.dir === 1 ? -1 : 1) : 1 }))}
        className={`flex items-center gap-0.5 text-left text-[10px] font-semibold uppercase tracking-wide hover:text-[#111315] ${
          sort.key === key ? 'text-[#111315]' : 'text-[#111315]/45'
        } ${extraClass}`}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </button>
    );

    return (
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-[#D8DCE3] bg-white"
        onDragOver={(event) => {
          // Accept a drag only from the OPPOSITE pane — dropping a pane's own
          // files back onto itself is a no-op, not a copy.
          if (event.dataTransfer.types.includes(INTERNAL_DRAG_TYPE)) event.preventDefault();
        }}
        onDrop={(event) => {
          const raw = event.dataTransfer.getData(INTERNAL_DRAG_TYPE);
          if (!raw) return;
          event.preventDefault();
          event.stopPropagation();
          try {
            const payload = JSON.parse(raw) as { side: Side; paths: string[] };
            if (!payload.paths?.length || payload.side === side) return;
            // Dropped on the remote pane => send; on the local pane => fetch.
            if (side === 'remote') sendFiles(payload.paths, remote.path);
            else engine.pullPaths(payload.paths, local.path);
          } catch {
            // Malformed payload — ignore rather than throw inside a drop.
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-[#EEF0F4] px-3 py-2">
          <HardDrive size={15} className="shrink-0 text-[#FF8A00]" />
          <span className="truncate text-[13px] font-semibold text-[#111315]">{title}</span>
          <span className="ml-auto shrink-0 text-[11px] text-[#111315]/45">
            {selection.length
              ? `${selection.length} selected`
              : state.query
                ? `${state.items.length}${state.truncated ? '+' : ''} match${state.items.length === 1 ? '' : 'es'}`
                : filter
                  ? `${visibleItems.length} of ${state.items.length}`
                  : state.truncated && state.totalCount
                    ? `showing ${state.items.length} of ${state.totalCount}`
                    : `${state.items.length} items`}
          </span>
        </div>

        {/* Type-to-find. On big folders scrolling is how files get "lost". */}
        <div className="border-b border-[#EEF0F4] px-2 py-1.5">
          <div className="flex items-center gap-1.5 rounded-md bg-[#F3F4F6] px-2">
            <Search size={12} className="shrink-0 text-[#111315]/40" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={state.truncated || state.query ? 'Search This Folder…' : 'Filter This Folder…'}
              className="h-6 w-full min-w-0 bg-transparent text-[11px] text-[#111315] outline-none placeholder:text-[#111315]/35"
            />
            {filter && (
              <button type="button" onClick={() => setFilter('')} className="shrink-0 text-[#111315]/40 hover:text-[#111315]">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Back / Forward / Up / Refresh / New Folder, then the breadcrumb */}
        <div className="flex items-center gap-1 border-b border-[#EEF0F4] px-2 py-1.5">
          <button type="button" title="Back" onClick={() => goBack(side)} disabled={!hist.back.length}
            className="flex h-7 w-7 items-center justify-center rounded text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-30">
            <ArrowLeft size={14} />
          </button>
          <button type="button" title="Forward" onClick={() => goForward(side)} disabled={!hist.forward.length}
            className="flex h-7 w-7 items-center justify-center rounded text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-30">
            <ArrowRight size={14} />
          </button>
          <button type="button" title="Up One Folder" onClick={() => go(side, state.parentPath || undefined)} disabled={!state.parentPath}
            className="flex h-7 w-7 items-center justify-center rounded text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-30">
            <ArrowUp size={14} />
          </button>
          <button type="button" title="Refresh" onClick={() => load(side, state.path || undefined, { query: state.query })}
            className="flex h-7 w-7 items-center justify-center rounded text-[#111315] hover:bg-[#F3F4F6]">
            <RefreshCw size={13} />
          </button>
          <button type="button" title="New Folder" onClick={() => { setNewFolderFor(side); setNewFolderName(''); }}
            className="flex h-7 w-7 items-center justify-center rounded text-[#111315] hover:bg-[#F3F4F6]">
            <FolderPlus size={14} />
          </button>
          {newFolderFor === side ? (
            <input
              autoFocus
              value={newFolderName}
              placeholder="Folder Name"
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitNewFolder();
                if (event.key === 'Escape') { setNewFolderFor(null); setNewFolderName(''); }
              }}
              onBlur={commitNewFolder}
              className="min-w-0 flex-1 rounded border border-[#FF8A00] px-1.5 py-0.5 text-[11px] text-[#111315] outline-none"
            />
          ) : pathEditing === side ? (
            <input
              autoFocus
              value={pathDraft}
              placeholder="Type a folder path, then press Enter"
              onChange={(event) => setPathDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { const typed = pathDraft.trim(); if (typed) go(side, typed); else setPathEditing(null); }
                if (event.key === 'Escape') setPathEditing(null);
              }}
              onBlur={() => setPathEditing(null)}
              className="min-w-0 flex-1 rounded border border-[#FF8A00] px-1.5 py-0.5 font-mono text-[11px] text-[#111315] outline-none"
            />
          ) : (
            <div
              className="flex min-w-0 flex-1 cursor-text items-center gap-0.5 overflow-hidden rounded px-1 hover:bg-[#F7F8FA]"
              title={`${state.path || ''}\nClick to type a path`}
              onClick={() => { setPathDraft(state.path); setPathEditing(side); }}
            >
              {crumbs.length === 0 ? (
                <span className="truncate text-[11px] text-[#111315]/55">{state.loading ? 'Loading…' : ''}</span>
              ) : crumbs.map((crumb, index) => (
                <React.Fragment key={crumb.path}>
                  {index > 0 && <ChevronRight size={11} className="shrink-0 text-[#111315]/30" />}
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); go(side, crumb.path); }}
                    className={`truncate rounded px-1 text-[11px] hover:bg-[#E8EAEE] ${
                      index === crumbs.length - 1 ? 'font-semibold text-[#111315]' : 'text-[#111315]/65'
                    } ${index < crumbs.length - 3 ? 'hidden lg:block' : ''}`}
                  >
                    {crumb.label}
                  </button>
                </React.Fragment>
              ))}
              <Pencil size={10} className="ml-auto shrink-0 text-[#111315]/30" />
            </div>
          )}
        </div>

        {state.roots.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b border-[#EEF0F4] px-2 py-1.5">
            {state.roots.map((root) => (
              <button
                key={root.path}
                type="button"
                onClick={() => go(side, root.path)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium hover:bg-[#E8EAEE] ${
                  root.path === state.path ? 'bg-[#FFE7CC] text-[#111315]' : 'bg-[#F3F4F6] text-[#111315]'
                }`}
              >
                {root.name}
              </button>
            ))}
          </div>
        )}

        {/* Column headers — click to sort */}
        <div className="grid grid-cols-[minmax(0,1fr)_72px_88px_112px] items-center gap-2 border-b border-[#EEF0F4] bg-[#FAFAFB] px-3 py-1">
          {sortButton('name', 'Name')}
          {sortButton('size', 'Size', 'justify-end')}
          {sortButton('type', 'Type')}
          {sortButton('modified', 'Modified')}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          onContextMenu={(event) => {
            // Right-click on empty space: folder-level actions.
            if (event.defaultPrevented) return;
            event.preventDefault();
            const rect = panelRef.current?.getBoundingClientRect();
            setContextMenu({ side, item: null, x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) });
          }}
        >
          {state.needsControl ? (
            <div className="flex flex-col items-start gap-2 p-3">
              <p className="m-0 text-[12px] text-[#111315]/70">
                This session is view-only, so {device} will not share its files yet. Ask for control to browse and transfer.
              </p>
              {onRequestControl && (
                <button
                  type="button"
                  onClick={onRequestControl}
                  disabled={controlStatus === 'pending'}
                  className="rounded-lg bg-[#FF8A00] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#f07f00] disabled:opacity-50"
                >
                  {controlStatus === 'pending' ? 'Waiting For Permission…' : 'Request Control'}
                </button>
              )}
            </div>
          ) : state.error ? (
            <div className="flex flex-col items-start gap-2 p-3">
              <p className="m-0 text-[12px] text-[#FF383C]">{state.error}</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => load(side, state.path || undefined)} className="text-[11px] font-semibold text-[#FF8A00] hover:underline">
                  Try Again
                </button>
                {hist.back.length > 0 && (
                  <button type="button" onClick={() => goBack(side)} className="text-[11px] font-semibold text-[#111315]/60 hover:underline">
                    Go Back
                  </button>
                )}
              </div>
            </div>
          ) : state.loading ? (
            <p className="p-3 text-[12px] text-[#111315]/50">Loading…</p>
          ) : visibleItems.length === 0 && (filter || state.query) ? (
            <p className="p-3 text-[12px] text-[#111315]/50">Nothing here matches “{filter || state.query}”.</p>
          ) : state.items.length === 0 ? (
            <p className="p-3 text-[12px] text-[#111315]/50">This folder is empty.</p>
          ) : (
            <>
              {visibleItems.map((item) => {
                const selected = selection.includes(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      // Internal drag: the payload is which side it came from,
                      // so the opposite pane knows which direction to move.
                      const paths = selected ? selection : [item.path];
                      event.dataTransfer.setData(INTERNAL_DRAG_TYPE, JSON.stringify({ side, paths }));
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={(event) => toggleSelection(side, item, event, visibleItems)}
                    onDoubleClick={() => { if (item.type === 'directory' && !item.broken) go(side, item.path); }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (!selected) (side === 'local' ? setLocalSelection : setRemoteSelection)([item.path]);
                      const rect = panelRef.current?.getBoundingClientRect();
                      setContextMenu({ side, item, x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) });
                    }}
                    title={item.broken ? 'This shortcut points to something that no longer exists.' : item.locked ? 'You do not have permission to open this.' : item.path}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_72px_88px_112px] items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                      selected ? 'bg-[#FF8A00]/12' : 'hover:bg-[#F7F8FA]'
                    } ${item.hidden ? 'opacity-60' : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {item.locked
                        ? <Lock size={14} className="shrink-0 text-[#111315]/40" />
                        : item.type === 'directory'
                          ? <Folder size={15} className="shrink-0 text-[#FF8A00]" />
                          : <FileIcon size={15} className="shrink-0 text-[#111315]/40" />}
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[#111315]">{item.name}</span>
                      {item.link && (
                        <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-[#111315]/40" title={item.broken ? 'Broken shortcut' : 'Shortcut'}>
                          <Link2 size={11} />{item.broken ? 'broken' : ''}
                        </span>
                      )}
                    </span>
                    <span className="text-right text-[11px] tabular-nums text-[#111315]/45">
                      {item.type === 'file' && !item.broken ? formatBytes(item.size) : ''}
                    </span>
                    <span className="truncate text-[11px] text-[#111315]/45">{typeLabel(item)}</span>
                    <span className="truncate text-[11px] tabular-nums text-[#111315]/45">{formatModified(item.modifiedAt)}</span>
                  </button>
                );
              })}
              {state.truncated && (
                <div className="flex items-center justify-between gap-2 border-t border-[#F1F2F5] px-3 py-2">
                  <span className="text-[11px] text-[#111315]/50">
                    Showing {state.items.length}{state.totalCount ? ` of ${state.totalCount}` : ''}. Type above to search the whole folder.
                  </span>
                  <button
                    type="button"
                    disabled={state.loadingMore}
                    onClick={() => load(side, state.path || undefined, { append: true, offset: state.items.length, query: state.query })}
                    className="shrink-0 text-[11px] font-semibold text-[#FF8A00] hover:underline disabled:opacity-50"
                  >
                    {state.loadingMore ? 'Loading…' : 'Show More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const { side, item } = contextMenu;
    const state = stateOf(side);
    const selection = side === 'local' ? localSelection : remoteSelection;
    const paths = item ? (selection.includes(item.path) ? selection : [item.path]) : [];
    const entries: Array<{ label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }> = [];
    if (item && item.type === 'directory' && !item.broken) {
      entries.push({ label: 'Open', icon: <FolderOpen size={14} />, onClick: () => go(side, item.path) });
    }
    if (item) {
      if (side === 'local') {
        entries.push({
          label: `Send To ${device}`, icon: <UploadCloud size={14} />, disabled: !canBrowseRemote,
          onClick: () => sendFiles(paths, showsRemotePane && view === 'advanced' ? remote.path : ''),
        });
        entries.push({
          label: 'Show In Folder', icon: <FolderOpen size={14} />,
          onClick: () => void (window as any).electronAPI?.files?.reveal(item.path),
        });
      } else {
        entries.push({ label: 'Get To This Computer', icon: <DownloadCloud size={14} />, onClick: () => receivePaths(paths) });
      }
      entries.push({ label: 'Copy Path', icon: <Copy size={14} />, onClick: () => copyText(paths.length === 1 ? paths[0] : paths.join('\n')) });
    } else {
      if (side === 'remote' && !state.needsControl) {
        entries.push({ label: 'Send Files Here…', icon: <UploadCloud size={14} />, onClick: () => void pickAndSend('files', state.path) });
      }
      entries.push({ label: 'Copy Folder Path', icon: <Copy size={14} />, onClick: () => copyText(state.path), disabled: !state.path });
    }
    entries.push({ label: 'New Folder', icon: <FolderPlus size={14} />, onClick: () => { setNewFolderFor(side); setNewFolderName(''); }, disabled: !state.path });
    entries.push({ label: 'Refresh', icon: <RefreshCw size={14} />, onClick: () => load(side, state.path || undefined, { query: state.query }) });
    const menuWidth = 220;
    const panelWidth = panelRef.current?.clientWidth || 860;
    const panelHeight = panelRef.current?.clientHeight || 560;
    const left = Math.min(contextMenu.x, Math.max(0, panelWidth - menuWidth - 8));
    const top = Math.min(contextMenu.y, Math.max(0, panelHeight - entries.length * 32 - 16));
    return (
      <div
        className="absolute z-30 w-[220px] rounded-lg border border-[#D8DCE3] bg-white py-1 shadow-2xl"
        style={{ left, top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {item && <div className="truncate px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#111315]/40" title={item.name}>{item.name}</div>}
        {entries.map((entry) => (
          <button
            key={entry.label}
            type="button"
            disabled={entry.disabled}
            onClick={() => { setContextMenu(null); entry.onClick(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-[#111315]/55">{entry.icon}</span>
            {entry.label}
          </button>
        ))}
      </div>
    );
  };

  const renderTray = (compact: boolean) => (
    <div className={`${compact ? 'max-h-[184px]' : 'min-h-0 flex-1'} shrink-0 overflow-y-auto border-t border-[#E4E7EC] bg-white px-3 py-2`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#111315]/45">Transfers</span>
        {jobs.some((job) => job.state === 'done' || job.state === 'error' || job.state === 'cancelled') && (
          <button
            type="button"
            onClick={() => engine.clearFinished()}
            className="ml-auto text-[11px] font-semibold text-[#111315]/45 hover:text-[#111315]"
          >
            Clear Finished
          </button>
        )}
      </div>
      {jobs.length === 0 ? (
        <p className="py-2 text-[12px] text-[#111315]/45">Nothing transferring yet.</p>
      ) : jobs.map((job) => {
        const percent = job.totalBytes ? Math.min(100, (job.transferredBytes / job.totalBytes) * 100) : 0;
        const paused = job.state === 'paused';
        const running = job.state === 'active' || job.state === 'preparing' || paused;
        return (
          <div key={job.id} className="border-t border-[#F1F2F5] py-2 first:border-t-0">
            <div className="flex items-center gap-2">
              {job.direction === 'send'
                ? <UploadCloud size={13} className="shrink-0 text-[#FF8A00]" />
                : <DownloadCloud size={13} className="shrink-0 text-[#7C4DFF]" />}
              <span className="min-w-0 flex-1 truncate text-[12px] text-[#111315]">
                {job.currentName || job.label}
                {job.fileCount > 1 && (
                  <span className="text-[#111315]/45"> · {job.filesDone}/{job.fileCount} files</span>
                )}
              </span>
              <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                job.state === 'error' ? 'text-[#FF383C]' : job.state === 'done' ? 'text-[#12B76A]' : paused ? 'text-[#B45309]' : 'text-[#111315]/60'
              }`}>
                {job.state === 'error' ? 'Failed'
                  : job.state === 'done' ? 'Done'
                    : job.state === 'cancelled' ? 'Cancelled'
                      : paused ? `Paused · ${Math.round(percent)}%`
                        : job.state === 'preparing' ? 'Preparing…'
                          : percent === 0 ? 'Starting…'
                            : `${Math.round(percent)}%`}
              </span>
              {running && !job.legacy && (
                <button
                  type="button"
                  title="Cancel"
                  onClick={() => engine.cancel(job.id)}
                  className="shrink-0 text-[#111315]/35 hover:text-[#FF383C]"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
            {running && (
              <>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                  <div className={`h-full rounded-full transition-all ${paused ? 'bg-[#B45309]/60' : 'bg-[#FF8A00]'}`} style={{ width: `${percent}%` }} />
                </div>
                {!job.legacy && !paused && (
                  <div className="mt-1 flex gap-3 text-[11px] tabular-nums text-[#111315]/50">
                    <span>{formatBytes(job.transferredBytes)} / {formatBytes(job.totalBytes)}</span>
                    <span>{formatBytes(job.bytesPerSecond)}/s</span>
                    <span>{formatDuration(job.etaSeconds)} left</span>
                  </div>
                )}
              </>
            )}
            {/* "Where did it go?" — answered in words, and with a click where the folder is ours. */}
            {job.state === 'done' ? (
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#111315]/55">
                <span className="min-w-0 truncate" title={job.destDir}>
                  {job.direction === 'send'
                    ? `Saved on ${device}${job.destDir ? ` in ${job.destDir}` : ''}`
                    : `Saved to ${job.destDir || 'your received-files folder'}`}
                </span>
                {job.direction === 'receive' && job.destDir && (
                  <button
                    type="button"
                    onClick={() => void (window as any).electronAPI?.files?.reveal(job.destDir)}
                    className="shrink-0 font-semibold text-[#FF8A00] hover:underline"
                  >
                    Open Folder
                  </button>
                )}
              </div>
            ) : !running && job.message ? (
              <p className={`mt-1 truncate text-[11px] ${job.state === 'error' ? 'text-[#FF383C]' : 'text-[#111315]/50'}`}>
                {job.message}
              </p>
            ) : running && job.message ? (
              <p className="mt-1 truncate text-[11px] text-[#111315]/50">{job.message}</p>
            ) : null}
            {job.state === 'done' && job.message && (
              <p className="mt-1 truncate text-[11px] text-[#111315]/50" title={job.message}>{job.message}</p>
            )}
            {/* Files the job left out, by name and reason — never a silent "Done". */}
            {job.skipped && job.skipped.length > 0 && (
              <details className="mt-1 text-[11px] text-[#111315]/60">
                <summary className="cursor-pointer font-semibold text-[#B45309]">
                  {job.skipped.length} file{job.skipped.length === 1 ? '' : 's'} skipped
                </summary>
                <ul className="m-0 mt-1 max-h-24 list-none overflow-y-auto p-0">
                  {job.skipped.slice(0, 30).map((entry) => (
                    <li key={entry.name} className="truncate" title={`${entry.name} — ${entry.reason}`}>
                      {entry.name} <span className="text-[#111315]/45">— {entry.reason}</span>
                    </li>
                  ))}
                  {job.skipped.length > 30 && <li className="text-[#111315]/45">…and {job.skipped.length - 30} more</li>}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );

  if (collapsed) {
    return (
      <div
        className="absolute bottom-24 right-6 z-[120] flex w-[300px] flex-col gap-2 rounded-xl border border-[#D8DCE3] bg-white p-3 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Folder size={15} className="text-[#FF8A00]" />
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#111315]">
            {activeJob ? activeJob.currentName || activeJob.label : 'File Transfer'}
          </span>
          <button type="button" onClick={() => setCollapsed(false)} className="text-[11px] font-semibold text-[#FF8A00]">
            Open
          </button>
          <button type="button" onClick={onClose} className="text-[#111315]/45 hover:text-[#111315]">
            <X size={14} />
          </button>
        </div>
        {activeJob && (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
              <div
                className="h-full rounded-full bg-[#FF8A00] transition-all"
                style={{ width: `${activeJob.totalBytes ? Math.min(100, (activeJob.transferredBytes / activeJob.totalBytes) * 100) : 0}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-[#111315]/55">
              {activeJob.legacy
                ? `${activeJob.direction === 'send' ? 'Sending to' : 'Receiving from'} ${device}…`
                : `${formatBytes(activeJob.bytesPerSecond)}/s · ${formatDuration(activeJob.etaSeconds)} left`}
            </span>
          </>
        )}
      </div>
    );
  }

  const browseSelection = browseSide === 'local' ? localSelection : remoteSelection;
  const browseState = stateOf(browseSide);
  const headerTitle = view === 'browse'
    ? browseMode === 'get' ? `Get Files From ${device}` : browseMode === 'sendTo' ? `Send Files To ${device}` : `Browse — ${browseSide === 'local' ? (userName || 'This Computer') : device}`
    : `Files — ${device}`;
  const subtitle = view === 'quick'
    ? `Send files to ${device} or bring files here. Drop files anywhere on this window to send them.`
    : view === 'browse'
      ? browseMode === 'get'
        ? 'Choose what to bring to this computer, then press Get.'
        : browseMode === 'sendTo'
          ? `Open the folder on ${device} where the files should go, then choose what to send.`
          : 'Double-click folders to open them, click the path to type one, right-click for more.'
      : 'Drag between the panes, or select on one side and use the arrows.';

  const paneHeightClass = view === 'quick' ? 'h-[min(520px,82%)]' : 'h-[min(620px,88%)]';

  return (
    <div
      ref={panelRef}
      className={`absolute z-[120] flex ${paneHeightClass} w-[min(900px,94%)] flex-col overflow-hidden rounded-[16px] border border-[#D8DCE3] bg-[#FAFAFB] shadow-2xl`}
      style={{ left: `calc(50% + ${offset.x}px)`, top: `calc(50% + ${offset.y}px)`, transform: 'translate(-50%, -50%)' }}
      onMouseDown={(event) => event.stopPropagation()}
      onDragEnter={(event) => {
        // Only OS drags light up the drop zone; an internal pane drag carries
        // our own MIME type and is handled by the panes themselves.
        if (event.dataTransfer.types.includes('Files')) {
          dragDepthRef.current += 1;
          setDropActive(true);
        }
      }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
      onDragLeave={() => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (!dragDepthRef.current) setDropActive(false);
      }}
      onDrop={onDrop}
    >
      {/* Header — doubles as the drag handle */}
      <div
        className="flex cursor-move items-center gap-3 border-b border-[#E4E7EC] bg-white px-4 py-3"
        onMouseDown={(event) => {
          const startX = event.clientX;
          const startY = event.clientY;
          const origin = { ...offset };
          // Keep the panel reachable: it used to be draggable fully off-screen.
          const limitX = Math.max(0, window.innerWidth / 2 - 120);
          const limitY = Math.max(0, window.innerHeight / 2 - 60);
          const onMove = (move: MouseEvent) => {
            setOffset({
              x: Math.max(-limitX, Math.min(limitX, origin.x + move.clientX - startX)),
              y: Math.max(-limitY, Math.min(limitY, origin.y + move.clientY - startY)),
            });
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        {view === 'browse' ? (
          <button
            type="button"
            title="Back To Quick Actions"
            onClick={() => setView('quick')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#111315]/70 hover:bg-[#F3F4F6]"
          >
            <ArrowLeft size={16} />
          </button>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF8A00] text-white">
            <Folder size={16} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[15px] font-semibold text-[#111315]">{headerTitle}</h3>
          <p className="m-0 truncate text-[11px] text-[#111315]/55">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {view === 'browse' && browseMode === 'explore' && (
            <div className="mr-2 inline-flex overflow-hidden rounded-lg border border-[#D8DCE3] text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setBrowseSide('local')}
                className={`px-3 py-1 ${browseSide === 'local' ? 'bg-[#111315] text-white' : 'bg-white text-[#111315] hover:bg-[#F3F4F6]'}`}
              >
                This Computer
              </button>
              <button
                type="button"
                onClick={() => setBrowseSide('remote')}
                className={`px-3 py-1 ${browseSide === 'remote' ? 'bg-[#111315] text-white' : 'bg-white text-[#111315] hover:bg-[#F3F4F6]'}`}
              >
                {device}
              </button>
            </div>
          )}
          {view !== 'quick' && (
            <button
              type="button"
              title={showHidden ? 'Hide Hidden Items' : 'Show Hidden Items'}
              onClick={toggleHidden}
              className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F3F4F6] ${showHidden ? 'text-[#FF8A00]' : 'text-[#111315]/60'}`}
            >
              {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          <button
            type="button"
            title={advanced ? 'Simple View' : 'Advanced: Side By Side'}
            onClick={() => switchAdvanced(!advanced)}
            className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F3F4F6] ${advanced ? 'text-[#FF8A00]' : 'text-[#111315]/60'}`}
          >
            <Columns2 size={16} />
          </button>
          <button
            type="button"
            title="Collapse"
            onClick={() => setCollapsed(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#111315]/60 hover:bg-[#F3F4F6]"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#111315]/60 hover:bg-[#F3F4F6]"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {view === 'quick' && (
        <>
          <div className="grid shrink-0 grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-[#FF8A00] bg-[#FFF4E6] p-4">
              <div className="flex items-center gap-2">
                <UploadCloud size={18} className="text-[#FF8A00]" />
                <span className="text-[14px] font-semibold text-[#111315]">Send Files To {device}</span>
              </div>
              <p className="m-0 text-[12px] text-[#111315]/65">
                Pick files or a folder on this computer. They arrive in the received-files folder on {device}.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void pickAndSend('files', '')}
                  className="rounded-lg bg-[#FF8A00] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#f07f00]"
                >
                  Choose Files…
                </button>
                <button
                  type="button"
                  onClick={() => void pickAndSend('folder', '')}
                  className="rounded-lg border border-[#D8DCE3] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#111315] hover:bg-[#F3F4F6]"
                >
                  Choose Folder…
                </button>
                <button
                  type="button"
                  onClick={() => openBrowse('sendTo', 'remote')}
                  disabled={!canBrowseRemote}
                  title={canBrowseRemote ? undefined : 'Ask for control to pick a folder on the remote computer'}
                  className="px-1 py-1.5 text-[12px] font-semibold text-[#FF8A00] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Choose Where They Go…
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-[#D8DCE3] bg-white p-4">
              <div className="flex items-center gap-2">
                <DownloadCloud size={18} className="text-[#7C4DFF]" />
                <span className="text-[14px] font-semibold text-[#111315]">Get Files From {device}</span>
              </div>
              <p className="m-0 text-[12px] text-[#111315]/65">
                Browse {device} and pick what to bring here. They are saved to your received-files folder.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openBrowse('get', 'remote')}
                  className="rounded-lg border border-[#D8DCE3] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#111315] hover:bg-[#F3F4F6]"
                >
                  Browse {device}…
                </button>
                {!canBrowseRemote && (
                  <span className="text-[11px] text-[#111315]/55">
                    {controlStatus === 'pending' ? 'Waiting for control…' : 'Needs control of the session.'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-2">
            <span className="text-[11px] text-[#111315]/50">
              Or drop files anywhere on this window to send them.{' '}
              <button type="button" onClick={() => openBrowse('explore', 'local')} className="font-semibold text-[#FF8A00] hover:underline">
                Browse Both Computers…
              </button>
            </span>
            <span className="shrink-0 text-[11px] text-[#111315]/50" title="Per-file size limit for your plan">{limitSentence}</span>
          </div>
          {renderTray(false)}
        </>
      )}

      {view === 'browse' && (
        <>
          <div className="flex min-h-0 flex-1 p-3">
            {renderPane(browseSide)}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#E4E7EC] bg-white px-4 py-3">
            <span className="min-w-0 truncate text-[11px] text-[#111315]/55">
              {browseMode === 'sendTo'
                ? (browseState.path ? `Files will go to ${browseState.path}` : 'Open a folder first.')
                : browseSelection.length
                  ? `${browseSelection.length} selected · ${limitSentence}`
                  : `Click to select, Ctrl+click for more, double-click a folder to open it. ${limitSentence}`}
            </span>
            {browseMode === 'sendTo' ? (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void pickAndSend('files', browseState.path)}
                  disabled={!browseState.path}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[#FF8A00] px-4 text-[12px] font-semibold text-white hover:bg-[#f07f00] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UploadCloud size={15} />
                  Send Files Here…
                </button>
                <button
                  type="button"
                  onClick={() => void pickAndSend('folder', browseState.path)}
                  disabled={!browseState.path}
                  className="h-9 rounded-lg border border-[#D8DCE3] bg-white px-3 text-[12px] font-semibold text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send Folder Here…
                </button>
              </div>
            ) : browseSide === 'remote' ? (
              <button
                type="button"
                onClick={() => receivePaths(remoteSelection)}
                disabled={!remoteSelection.length}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#FF8A00] px-4 text-[12px] font-semibold text-white hover:bg-[#f07f00] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DownloadCloud size={15} />
                {remoteSelection.length > 1 ? `Get ${remoteSelection.length} Items To This Computer` : 'Get To This Computer'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => sendFiles(localSelection, '')}
                disabled={!localSelection.length || !canBrowseRemote}
                title={canBrowseRemote ? undefined : 'Ask for control to send files'}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#FF8A00] px-4 text-[12px] font-semibold text-white hover:bg-[#f07f00] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <UploadCloud size={15} />
                {localSelection.length > 1 ? `Send ${localSelection.length} Items To ${device}` : `Send To ${device}`}
              </button>
            )}
          </div>
          {renderTray(true)}
        </>
      )}

      {view === 'advanced' && (
        <>
          <div className="flex min-h-0 flex-1 gap-3 p-3">
            {renderPane('local')}
            <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-3">
              <button
                type="button"
                title="Send To The Remote Computer"
                onClick={() => sendFiles(localSelection, remote.path)}
                disabled={!localSelection.length || !canBrowseRemote}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#FF8A00] text-[12px] font-semibold text-white hover:bg-[#f07f00] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <UploadCloud size={16} />
                Send
              </button>
              <button
                type="button"
                title="Bring To This Computer"
                onClick={() => receivePaths(remoteSelection)}
                disabled={!remoteSelection.length}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[#D8DCE3] bg-white text-[12px] font-semibold text-[#111315] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DownloadCloud size={16} />
                Get
              </button>
              <span className="px-1 text-center text-[10px] leading-tight text-[#111315]/45" title="Per-file size limit for your plan">
                {perFileLimit === null ? 'No size limit' : `Up to ${describeLimit(perFileLimit)} per file`}
              </span>
            </div>
            {renderPane('remote')}
          </div>
          {renderTray(true)}
        </>
      )}

      {renderContextMenu()}

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[16px] border-2 border-dashed border-[#FF8A00] bg-[#FF8A00]/10">
          <span className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#111315] shadow">
            Drop to send to {device}
          </span>
        </div>
      )}
    </div>
  );
};

export default FileManagerPanel;
