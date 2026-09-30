import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Check,
  Folder,
  FolderClosed,
  Grid2X2,
  History,
  ListFilter,
  Monitor,
  MoreVertical,
  Pencil,
  Plus,
  Copy,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import api from '../../lib/api';
import { notify } from '../NotificationProvider';
import { hasUserPermission } from '../../lib/permissions';
import { LottieScene } from '../lottie/LottieScene';
import devicesEmptyAnimation from '../../assets/animations/devicesEmpty.json';

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  access_key: string;
  is_online: boolean;
  /** True while another viewer currently has an exclusive remote session to this device. */
  in_session?: boolean;
  last_seen?: string;
  last_seen_at?: string;
  local_ip?: string;
  tags?: string[];
  has_password?: boolean;
  password_required?: boolean;
  device_groups?: AccountDeviceGroup[];
  org_name?: string | null;
  org_slug?: string | null;
  org_id?: string | null;
}

interface AccountDeviceGroup {
  id: string;
  name: string;
  color?: string | null;
  deviceIds?: string[];
  deviceCount?: number;
}

export interface SnowDevicesProps {
  devices: Device[];
  user: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device | null) => void;
  handleDeviceClick: (device: Device) => void;
  setActionModal: (modal: any) => void;
  actionModal: any;
  setShowAddModal: (show: boolean) => void;
  handleBulkDelete: (ids: string[]) => void;
  handleBulkArchive?: (ids: string[]) => void;
  /** Archive a device: hides it from the list (kept on the account) and moves it to Archived Devices. */
  onArchiveDevice?: (device: Device) => void;
  onRefresh: (showLoader?: boolean) => void | Promise<void>;
  isLoading?: boolean;
  passwordUpdateKeys?: string[];
  /** Access keys of devices the user currently has an open viewer session to. */
  activeSessionKeys?: string[];
  archivedDeviceCount?: number;
  onOpenArchivedDevices?: () => void;
  onMutationStateChange?: (busy: boolean, label?: string) => void;
}

const tagPalette = [
  { dot: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
  { dot: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  { dot: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  { dot: '#34C759', bg: 'rgba(52,199,89,0.1)' },
];

// A chip tone ({ dot, bg }) from a group's chosen hex color, so the color
// picked in Admin settings → Device groups shows on the Devices page.
const toneFromColor = (hex?: string | null): { dot: string; bg: string } | null => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return { dot: `#${m[1]}`, bg: `rgba(${r},${g},${b},0.12)` };
};

const formatLastSeen = (device: Device) => {
  if (device.is_online) return 'Active now';
  const lastSeen = device.last_seen || device.last_seen_at;
  if (!lastSeen) return 'Never';
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (Number.isNaN(diff) || diff < 0) return 'Just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(lastSeen).toLocaleDateString();
};

export const SnowDevices: React.FC<SnowDevicesProps> = ({
  devices,
  user,
  searchQuery,
  setSearchQuery,
  selectedDevice,
  setSelectedDevice,
  handleDeviceClick,
  setActionModal,
  actionModal,
  setShowAddModal,
  handleBulkDelete,
  handleBulkArchive,
  onArchiveDevice,
  onRefresh,
  isLoading = false,
  passwordUpdateKeys = [],
  activeSessionKeys = [],
  archivedDeviceCount = 0,
  onOpenArchivedDevices,
  onMutationStateChange,
}) => {
  const normalizeKey = (value?: string) => String(value || '').replace(/\s/g, '');
  const passwordUpdateSet = useMemo(() => new Set(passwordUpdateKeys.map(normalizeKey)), [passwordUpdateKeys]);
  const needsPasswordUpdate = (device: Device) => passwordUpdateSet.has(normalizeKey(device.access_key));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline' | 'active'>('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'status' | 'activity' | 'last_seen' | 'group'>('name');
  // Column headers sort the table; the same column again flips the direction.
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showGroupsMenu, setShowGroupsMenu] = useState(false);
  const toggleSort = (key: 'name' | 'status' | 'activity' | 'last_seen' | 'group') => {
    if (sortOrder === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else { setSortOrder(key); setSortDir('asc'); }
  };
  const sortHeader = (key: 'name' | 'status' | 'activity' | 'last_seen' | 'group', label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-[#FF8A00]" title={`Sort by ${label}`}>
      {label}
      {sortOrder === key ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  );
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'));
  const [activeScope, setActiveScope] = useState<'all' | 'mine' | 'recent'>('all');
  // Group chips are multi-select: a device shows when it is in ANY selected group.
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const toggleTag = (label: string) => setActiveTags((current) => (current.includes(label) ? current.filter((tag) => tag !== label) : [...current, label]));
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#FF8A00');
  const [groupCreateBusy, setGroupCreateBusy] = useState(false);
  const [groupCreateError, setGroupCreateError] = useState('');
  const [pendingGroupDeviceId, setPendingGroupDeviceId] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<AccountDeviceGroup[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date());
  const [openDeviceMenu, setOpenDeviceMenu] = useState<{ id: string; top: number; left: number; anchorTop: number } | null>(null);

  const can = (permission: string) => hasUserPermission(user, permission);
  const canConnect = can('sessions:start');
  const canReport = can('devices:reportIssue');
  const canAddDevice = can('devices:register');
  // Same permissions the server checks, so nobody is offered a button that 403s.
  const canCreateGroup = can('devices:groups:create');
  const canDeleteGroup = can('devices:groups:delete');
  const canAssignGroup = can('devices:assign');
  const [reportDevice, setReportDevice] = useState<Device | null>(null);
  const [reportMessage, setReportMessage] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportDone, setReportDone] = useState(false);

  const openReport = (device: Device) => {
    setReportDevice(device);
    setReportMessage('');
    setReportError('');
    setReportDone(false);
  };

  const submitReport = async () => {
    if (!reportDevice) return;
    const note = reportMessage.trim();
    if (!note) { setReportError('Please describe the problem.'); return; }
    setReportBusy(true);
    setReportError('');
    try {
      await api.post(`/api/devices/${reportDevice.id}/report`, { message: note });
      setReportDone(true);
      setTimeout(() => setReportDevice(null), 1400);
    } catch (err: any) {
      setReportError(err?.response?.data?.error || 'Could not send the report. Please try again.');
    } finally {
      setReportBusy(false);
    }
  };

  const handleToggleDeviceMenu = (event: React.MouseEvent<HTMLButtonElement>, deviceId: string) => {
    event.stopPropagation();
    if (openDeviceMenu?.id === deviceId) {
      setOpenDeviceMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 212;
    setOpenDeviceMenu({
      id: deviceId,
      top: rect.bottom + 6,
      // The menu measures itself on mount and flips above this anchor when it
      // would clip at the bottom of the viewport (bottom rows of the list).
      anchorTop: rect.top,
      left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)),
    });
  };

  const copyDeviceId = async (value: string) => {
    const electronApi = (window as any).electronAPI;
    try {
      if (electronApi?.clipboard?.writeText) await electronApi.clipboard.writeText(value);
      else await navigator.clipboard?.writeText?.(value);
    } catch (err) {
      console.error('[Devices] Copy device ID failed', err);
    }
  };
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    tone?: 'danger' | 'neutral';
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  // The single bulk-actions pill (bottom bar) opens this menu.
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  useEffect(() => {
    loadUserGroups();
    // Reflect group changes made in Admin settings → Device groups instantly.
    const handler = () => loadUserGroups();
    window.addEventListener('remote365:device-groups-changed', handler);
    return () => window.removeEventListener('remote365:device-groups-changed', handler);
  }, []);

  const loadUserGroups = async () => {
    try {
      const { data } = await api.get('/api/devices/user-groups');
      setUserGroups(data.groups || []);
    } catch (err) {
      console.error('Failed to load account device groups:', err);
    }
  };

  const notifyGroupsChanged = () => window.dispatchEvent(new CustomEvent('remote365:device-groups-changed'));

  const accountGroups = useMemo(() => {
    const merged = new Map<string, AccountDeviceGroup>();
    // Seed from device rows first, then let userGroups win: it is the
    // authoritative list (reloaded on group changes), so an updated name/color
    // isn't clobbered by the stale copy embedded in the device list.
    devices.forEach((device) => (device.device_groups || []).forEach((group) => merged.set(group.id, group)));
    userGroups.forEach((group) => merged.set(group.id, group));
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, userGroups]);

  // Every group the account has — the sidebar list scrolls on its own, so a
  // long list stays fully reachable instead of being silently truncated.
  const groupFilters = accountGroups;

  // Access keys of devices THIS client has an open viewer session with.
  const activeSessionKeySet = useMemo(
    () => new Set((activeSessionKeys || []).map(normalizeKey).filter(Boolean)),
    [activeSessionKeys]
  );

  // A device counts as "in an active session" when ANYONE is connected to it,
  // not just this browser: `in_session` comes from the server (Redis
  // session:active:<key>), so a colleague's session counts too — that is the
  // same flag the row's Activity badge shows, and the header must agree with
  // the rows. The local set is the union's second half only to cover the gap
  // between opening a session here and the next device poll picking it up.
  const isDeviceInSession = useMemo(
    () => (device: Device) => Boolean(device.in_session) || activeSessionKeySet.has(normalizeKey(device.access_key)),
    [activeSessionKeySet]
  );

  const filteredDevices = useMemo(() => {
    const now = Date.now();
    return devices
      .filter((device) => {
        if (activeScope === 'mine' && device.device_groups?.length) return false;
        if (activeScope === 'recent') {
          const lastSeen = new Date(device.last_seen || device.last_seen_at || 0).getTime();
          if (!device.is_online && (!lastSeen || now - lastSeen > 7 * 86400000)) return false;
        }
        if (activeTags.length > 0) {
          const hasGroup = (device.device_groups || []).some((group) => activeTags.includes(group.name.replace(/^#/, '')));
          if (!hasGroup) return false;
        }
        if (filterStatus === 'online' && !device.is_online) return false;
        if (filterStatus === 'offline' && device.is_online) return false;
        if (filterStatus === 'active' && !isDeviceInSession(device)) return false;
        const query = searchQuery.trim().toLowerCase();
        if (!query || query === ':online') return true;
        // Match the name, the ID (typed with or without spaces) and group names.
        const keyQuery = query.replace(/\s/g, '');
        return Boolean(
          device.device_name?.toLowerCase().includes(query)
          || (keyQuery && normalizeKey(device.access_key).toLowerCase().includes(keyQuery))
          || (device.device_groups || []).some((group) => group.name.replace(/^#/, '').toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        const groupOf = (device: Device) => device.device_groups?.[0]?.name || '';
        const lastSeen = (device: Device) => new Date(device.last_seen || device.last_seen_at || 0).getTime();
        // Natural order per column (online / in session / newest first, names
        // and groups A→Z); the header arrow flips it.
        let result = 0;
        if (sortOrder === 'status') result = Number(b.is_online) - Number(a.is_online);
        else if (sortOrder === 'activity') result = (Number(isDeviceInSession(b)) - Number(isDeviceInSession(a))) || (Number(b.is_online) - Number(a.is_online));
        else if (sortOrder === 'last_seen') result = lastSeen(b) - lastSeen(a);
        else if (sortOrder === 'group') result = groupOf(a).localeCompare(groupOf(b));
        else result = (a.device_name || '').localeCompare(b.device_name || '');
        return sortDir === 'asc' ? result : -result;
      });
  }, [activeScope, activeTags, devices, filterStatus, searchQuery, sortOrder, sortDir, user, isDeviceInSession]);

  const fleetStats = useMemo(() => {
    const online = devices.filter((device) => device.is_online).length;
    // "In Active Session" = devices someone is connected to right now, not just
    // any online device. Same predicate as the Activity column, so the header
    // count always matches the "In session" badges visible in the list.
    const active = devices.filter(isDeviceInSession).length;
    return { total: devices.length, online, offline: devices.length - online, active };
  }, [devices, isDeviceInSession]);

  // The list is "synced" whenever a fresh device list arrives (the background
  // poll, a push update, or the refresh button) — the label counts up from there.
  useEffect(() => {
    setLastSyncedAt(new Date());
  }, [devices]);
  const [syncNow, setSyncNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setSyncNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);
  const syncLabel = useMemo(() => {
    const seconds = Math.max(0, Math.round((Math.max(syncNow, lastSyncedAt.getTime()) - lastSyncedAt.getTime()) / 1000));
    if (seconds < 10) return 'Synced Just Now';
    if (seconds < 60) return `Synced ${Math.floor(seconds / 10) * 10}s Ago`;
    const minutes = Math.floor(seconds / 60);
    return `Synced ${minutes} Min Ago`;
  }, [lastSyncedAt, syncNow]);

  // Refresh refetches the device list and groups in place — it does not reload the app.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const refreshAll = async () => {
    if (isManualRefreshing) return;
    setIsManualRefreshing(true);
    try {
      await Promise.all([Promise.resolve(onRefresh?.()), loadUserGroups()]);
      setLastSyncedAt(new Date());
      setSyncNow(Date.now());
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // Group names must stay unique (case-insensitively) — two "Sales" groups are
  // indistinguishable in the sidebar and in the group pickers.
  const findDuplicateGroup = (name: string, exceptId?: string) => {
    const normalized = name.trim().replace(/^#/, '').toLowerCase();
    if (!normalized) return undefined;
    return accountGroups.find((group) =>
      group.id !== exceptId && group.name.replace(/^#/, '').toLowerCase() === normalized
    );
  };

  const duplicateNewGroup = findDuplicateGroup(newGroupName);

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const duplicate = findDuplicateGroup(name);
    if (duplicate) {
      setGroupCreateError(`A group named "${duplicate.name}" already exists.`);
      return;
    }
    setGroupCreateBusy(true);
    setGroupCreateError('');
    onMutationStateChange?.(true, pendingGroupDeviceId ? 'Creating and assigning group…' : 'Creating group…');
    try {
      const { data } = await api.post('/api/devices/user-groups', { name, color: newGroupColor });
      setUserGroups((prev) => [...prev, data.group].sort((a, b) => a.name.localeCompare(b.name)));
      if (pendingGroupDeviceId && data.group?.id) {
        await api.patch(`/api/devices/${pendingGroupDeviceId}/user-groups`, { groupIds: [data.group.id] });
        await Promise.resolve(onRefresh?.());
      }
      setShowAddGroupModal(false);
      setNewGroupName('');
      setNewGroupColor('#FF8A00');
      setPendingGroupDeviceId(null);
      notifyGroupsChanged();
    } catch (err: any) {
      console.error('Failed to create account device group:', err);
      setGroupCreateError(err?.response?.data?.error || 'Could not create this group. Please try again.');
    } finally {
      setGroupCreateBusy(false);
      onMutationStateChange?.(false);
    }
  };

  const closeAddGroupModal = () => {
    if (groupCreateBusy) return;
    setShowAddGroupModal(false);
    setNewGroupName('');
    setNewGroupColor('#FF8A00');
    setGroupCreateError('');
    setPendingGroupDeviceId(null);
  };

  const handleUpdateDeviceGroups = async (deviceId: string, groupIds: string[]) => {
    onMutationStateChange?.(true, 'Updating device group…');
    try {
      await api.patch(`/api/devices/${deviceId}/user-groups`, { groupIds });
      await loadUserGroups();
      onRefresh?.();
      notifyGroupsChanged();
    } catch (err: any) {
      console.error('Failed to update account device groups:', err);
      notify(err?.response?.data?.error || 'Could not change the group. Please try again.', 'error');
    } finally {
      onMutationStateChange?.(false);
    }
  };

  const handleDeleteGroup = async (group: AccountDeviceGroup) => {
    onMutationStateChange?.(true, 'Deleting group…');
    try {
      await api.delete(`/api/devices/user-groups/${group.id}`);
      setUserGroups((prev) => prev.filter((item) => item.id !== group.id));
      setActiveTags((current) => current.filter((tag) => tag !== group.name.replace(/^#/, '')));
      await Promise.resolve(onRefresh?.());
      await loadUserGroups();
      notifyGroupsChanged();
    } catch (err: any) {
      console.error('Failed to delete account device group:', err);
      notify(err?.response?.data?.error || 'Could not delete the group. Please try again.', 'error');
      loadUserGroups();
    } finally {
      onMutationStateChange?.(false);
    }
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => prev.length === filteredDevices.length ? [] : filteredDevices.map((device) => device.id));
  };

  const toggleSelect = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const scopeItems = [
    { id: 'all', label: 'All Devices', icon: Grid2X2 },
    { id: 'recent', label: 'Recently Active', icon: History },
  ] as const;

  const getDeviceGroupName = (device: Device) => {
    const groupName = device.device_groups?.[0]?.name || 'My Computers';
    return groupName.replace(/^#/, '');
  };

  const getTagTone = (label: string, index: number) => {
    const normalized = label.toLowerCase();
    if (normalized.includes('internal')) return tagPalette[2];
    if (normalized.includes('onboard')) return tagPalette[1];
    return tagPalette[index % tagPalette.length];
  };

  const statusOptions = [
    { id: 'all', label: 'All' },
    { id: 'online', label: 'Online' },
    { id: 'offline', label: 'Offline' },
    { id: 'active', label: 'In Session' },
  ] as const;
  const sortOptions = [
    { id: 'name', label: 'Name' },
    { id: 'status', label: 'Online first' },
    { id: 'last_seen', label: 'Last seen' },
  ] as const;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white font-['Mona_Sans',system-ui,sans-serif] text-[#111315] md:flex-row">
      <aside className="w-full shrink-0 border-b border-[rgba(26,29,33,0.3)] bg-white px-3 py-4 md:flex md:w-[220px] md:flex-col md:overflow-hidden md:border-b-0 md:border-r md:py-6">
        <div className="flex flex-col gap-[30px] md:min-h-0 md:flex-1">
          <section className="flex flex-col gap-3 md:shrink-0">
            <h2 className="m-0 text-[18px] font-medium leading-[25px] text-black">Scope</h2>
            <div className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
              {scopeItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScope(item.id)}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded px-4 text-left text-[14px] font-medium leading-5 transition-colors ${activeScope === item.id ? 'bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] text-white' : 'text-[#111315] hover:bg-[#F3F4F6]'}`}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3 md:min-h-0 md:flex-1">
            <div className="flex shrink-0 items-center justify-between">
              <h2 className="m-0 text-[18px] font-medium leading-[25px] text-black">
                Groups{groupFilters.length > 0 ? <span className="ml-1 text-[13px] text-[rgba(26,29,33,0.45)]">({groupFilters.length})</span> : null}
              </h2>
              {canCreateGroup && (
                <button type="button" onClick={() => { setPendingGroupDeviceId(null); setGroupCreateError(''); setShowAddGroupModal(true); }} title="Add group" className="flex h-[18px] w-[18px] items-center justify-center text-[#111315]">
                  <Plus size={18} />
                </button>
              )}
            </div>
            <div className="flex items-start gap-1 overflow-x-auto pb-1 md:min-h-0 md:flex-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:pb-0 md:pr-1">
              {groupFilters.length === 0 ? (
                <span className="text-[12px] text-[rgba(26,29,33,0.45)]">No groups yet</span>
              ) : groupFilters.map((group, index) => {
                const label = group.name.replace(/^#/, '');
                // Honor the group's chosen color; fall back to the auto palette.
                const tone = toneFromColor(group.color) || getTagTone(label, index);
                return (
                  <div
                    key={group.id}
                    className={`group flex h-7 shrink-0 items-center rounded-[32px] pr-1 text-[14px] leading-5 text-black ${activeTags.includes(label) ? 'ring-1 ring-[#111315]/20' : ''}`}
                    style={{ background: tone.bg }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTag(label)}
                      className="flex h-full min-w-0 items-center gap-2 rounded-[32px] pl-2 pr-1"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.dot }} />
                      <span className="max-w-[128px] truncate">{label}</span>
                    </button>
                    {canDeleteGroup && <button
                      type="button"
                      onClick={() => {
                        setConfirmDialog({
                          title: `Delete ${group.name}?`,
                          body: 'This removes the group from your account and unassigns it from devices. The devices remain in your list.',
                          confirmLabel: 'Delete group',
                          tone: 'danger',
                          onConfirm: () => handleDeleteGroup(group)
                        });
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-black/45 transition hover:bg-black/10 hover:text-black"
                      title="Delete group"
                    >
                      <X size={12} />
                    </button>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        <div className="flex w-full flex-col px-4 sm:px-6 lg:px-10 2xl:px-16">
        <header className="flex flex-col items-start justify-between gap-4 pt-6 sm:pt-8 lg:flex-row lg:gap-6 lg:pt-[54px]">
          <div className="min-w-0">
            <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black">Device Fleet</h1>
            {/* Each stat is a filter toggle: click filters the list below to
                that status; clicking it again (or "N Devices") shows all. */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] leading-5 text-black">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                title="Show all devices"
                className={`transition hover:opacity-70 ${filterStatus === 'all' ? 'font-semibold' : ''}`}
              >
                {fleetStats.total} Devices
              </button>
              <span className="h-[3px] w-[3px] rounded-full bg-[rgba(26,29,33,0.3)]" />
              <button
                type="button"
                onClick={() => setFilterStatus((value) => (value === 'online' ? 'all' : 'online'))}
                title="Show only online devices"
                className={`transition hover:opacity-70 ${filterStatus === 'online' ? 'font-semibold underline underline-offset-4 decoration-[#12B76A]' : ''}`}
              >
                {fleetStats.online} Online
              </button>
              <span className="h-[3px] w-[3px] rounded-full bg-[rgba(26,29,33,0.3)]" />
              <button
                type="button"
                onClick={() => setFilterStatus((value) => (value === 'offline' ? 'all' : 'offline'))}
                title="Show only offline devices"
                className={`text-[#D92D20] transition hover:opacity-70 ${filterStatus === 'offline' ? 'font-semibold underline underline-offset-4 decoration-[#D92D20]' : ''}`}
              >
                {fleetStats.offline} Offline
              </button>
              <span className="h-[3px] w-[3px] rounded-full bg-[rgba(26,29,33,0.3)]" />
              <button
                type="button"
                onClick={() => setFilterStatus((value) => (value === 'active' ? 'all' : 'active'))}
                title="Show only devices in an active session"
                className={`inline-flex h-5 items-center rounded-[32px] px-[6px] py-[3px] text-[10px] leading-[14px] text-[#0088FF] transition hover:bg-[rgba(0,136,255,0.2)] ${filterStatus === 'active' ? 'bg-[rgba(0,136,255,0.2)] font-semibold ring-1 ring-[#0088FF]' : 'bg-[rgba(0,136,255,0.1)]'}`}
              >
                {fleetStats.active} In Active Session
              </button>
            </div>
          </div>
          <button type="button" onClick={refreshAll} disabled={isLoading || isManualRefreshing} title="Refresh devices" className="flex shrink-0 items-center gap-2 text-[14px] leading-5 text-black disabled:opacity-60 lg:mt-5">
            {isManualRefreshing ? 'Syncing…' : syncLabel}
            <RefreshCw size={18} className={isLoading || isManualRefreshing ? 'animate-spin' : ''} />
          </button>
        </header>

        <div className="flex flex-col items-stretch justify-between gap-4 pt-6 sm:pt-8 lg:flex-row lg:items-center lg:pt-[41px]">
          <div className="relative h-10 w-full lg:w-[320px] lg:flex-none">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(17,19,21,0.3)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search devices"
              className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white pl-10 pr-4 text-[14px] font-medium leading-5 text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
            {activeTags.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowGroupsMenu((current) => !current)}
                  title={activeTags.join(', ')}
                  className={`flex h-10 max-w-[220px] items-center gap-2 rounded-[32px] px-4 text-[14px] leading-5 ${showGroupsMenu ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'bg-[#F3F4F6] text-black'}`}
                >
                  <span className="h-2 w-2 flex-none rounded-full bg-[#0EA5E9]" />
                  <span className="truncate">{activeTags.length === 1 ? activeTags[0] : `${activeTags.length} Groups`}</span>
                  <ChevronDown size={14} className="flex-none" />
                </button>
                {showGroupsMenu && (
                  <>
                    <button type="button" aria-label="Close" onClick={() => setShowGroupsMenu(false)} className="fixed inset-0 z-[59] cursor-default" />
                    <div className="absolute right-0 top-12 z-[60] w-56 overflow-hidden rounded-lg border border-[rgba(26,29,33,0.12)] bg-white py-1 shadow-xl">
                      {activeTags.map((tag) => (
                        <div key={tag} className="flex h-9 items-center gap-2 px-3 text-[13px] text-[#111315]">
                          <span className="h-2 w-2 flex-none rounded-full bg-[#0EA5E9]" />
                          <span className="min-w-0 flex-1 truncate">{tag}</span>
                          <button type="button" onClick={() => toggleTag(tag)} title="Remove" aria-label={`Remove ${tag}`} className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[rgba(26,29,33,0.5)] hover:bg-[#F3F4F6] hover:text-[#111315]">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => { setActiveTags([]); setShowGroupsMenu(false); }} className="flex h-9 w-full items-center border-t border-[rgba(26,29,33,0.08)] px-3 text-left text-[13px] font-medium text-[#FF8A00] hover:bg-[#FFF4E5]">
                        Clear All Groups
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatusMenu((current) => !current)}
                className={`flex h-10 items-center gap-2 rounded-[32px] px-4 text-[14px] leading-5 text-black ${showStatusMenu || filterStatus !== 'all' ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'bg-[#F3F4F6]'}`}
              >
                {filterStatus === 'all' ? 'Status' : statusOptions.find((option) => option.id === filterStatus)?.label}
                <ChevronDown size={14} />
              </button>
              {showStatusMenu && (
                <div className="absolute right-0 top-12 z-[60] w-40 overflow-hidden rounded-lg border border-[rgba(26,29,33,0.12)] bg-white py-1 shadow-xl">
                  {statusOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => { setFilterStatus(option.id); setShowStatusMenu(false); }}
                      className={`flex h-9 w-full items-center justify-between px-3 text-left text-[13px] ${filterStatus === option.id ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'text-[#111315] hover:bg-[#F3F4F6]'}`}
                    >
                      {option.label}
                      {filterStatus === option.id ? <Check size={14} /> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSortMenu((current) => !current)}
                className={`flex h-10 items-center gap-3 rounded-[32px] px-4 text-[14px] font-medium leading-5 text-black ${showSortMenu ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'bg-[#F3F4F6]'}`}
              >
                <ListFilter size={16} />
                Sort
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-12 z-[60] w-40 overflow-hidden rounded-lg border border-[rgba(26,29,33,0.12)] bg-white py-1 shadow-xl">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSortOrder(option.id);
                        setShowSortMenu(false);
                      }}
                      className={`flex h-9 w-full items-center justify-between px-3 text-left text-[13px] ${sortOrder === option.id ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'text-[#111315] hover:bg-[#F3F4F6]'}`}
                    >
                      {option.label}
                      {sortOrder === option.id ? <Check size={14} /> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setViewMode((current) => current === 'table' ? 'grid' : 'table')}
              className={`flex h-10 w-10 items-center justify-center rounded text-black ${viewMode === 'grid' ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'bg-[#F3F4F6]'}`}
              title={viewMode === 'grid' ? 'Show table view' : 'Show grid view'}
            >
              <Grid2X2 size={20} />
            </button>
            {onOpenArchivedDevices && (
              <button
                type="button"
                onClick={onOpenArchivedDevices}
                className="flex h-10 items-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-3 text-[13px] font-medium text-[#111315] hover:bg-[#F3F4F6]"
              >
                <Archive size={16} />
                Archived{archivedDeviceCount > 0 ? ` (${archivedDeviceCount})` : ''}
              </button>
            )}
            {canAddDevice && <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex h-10 items-center gap-3 rounded bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-4 text-[14px] font-medium leading-5 text-black"
            >
              <Plus size={16} />
              Add Device
            </button>}
          </div>
        </div>

        <section className="pb-8 pt-7">
          {isLoading ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 text-black">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#FFF4E5] text-[#FF8A00]">
                <RefreshCw size={26} className="animate-spin" />
              </div>
              <div className="text-center">
                <p className="m-0 text-[16px] font-medium">Syncing devices</p>
                <p className="m-0 mt-1 text-[12px] text-[rgba(26,29,33,0.55)]">Refreshing your device list.</p>
              </div>
            </div>
          ) : devices.length === 0 ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-6 text-black">
              <LottieScene
                animationData={devicesEmptyAnimation}
                size={400}
                loop
                canvasAspect={16 / 9}
                label="No devices yet"
              />
              <div className="max-w-[360px] text-center">
                <p className="m-0 text-[20px] font-medium leading-7">{canAddDevice ? 'Start by adding a device' : 'No devices assigned yet'}</p>
                <p className="m-0 mt-2 text-[13px] leading-5 text-[rgba(26,29,33,0.55)]">{canAddDevice ? 'Use the “Add Device” button at the top right to connect your devices and manage them remotely from one place.' : 'Devices your organization grants you access to will appear here.'}</p>
              </div>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 text-black">
              <LottieScene
                animationData={devicesEmptyAnimation}
                size={320}
                loop
                canvasAspect={16 / 9}
                label="No Devices Found"
              />
              <div className="text-center">
                <p className="m-0 text-[16px] font-medium">No Devices Found</p>
                <p className="m-0 mt-1 text-[12px] text-[rgba(26,29,33,0.55)]">Try adjusting your filters or add a device.</p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredDevices.map((device) => {
                const selected = selectedIds.includes(device.id);
                const groupName = getDeviceGroupName(device);
                const sessionLabel = device.is_online ? 'Online' : 'Offline';
                const sessionClass = device.is_online
                  ? 'bg-[#ECFDF3] text-[#34C759]'
                  : 'bg-[#FEF3F2] text-[#D92D20]';
                const activity = !device.is_online
                  ? { label: 'Offline', cls: 'bg-[#FEF3F2] text-[#D92D20]' }
                  : isDeviceInSession(device)
                    ? { label: 'In session', cls: 'bg-[#FEF3E6] text-[#B54708]' }
                    : { label: 'Idle', cls: 'bg-[#EFF8FF] text-[#175CD3]' };
                const pwUpdate = needsPasswordUpdate(device);

                return (
                  <article
                    key={device.id}
                    onClick={() => handleDeviceClick(device)}
                    className={`cursor-pointer rounded-lg border border-[rgba(26,29,33,0.2)] bg-white p-5 transition hover:border-[#FFB347] hover:bg-[#FFFBF7] ${selectedDevice?.id === device.id ? 'border-[#FF8A00] bg-[#FFFBF7]' : ''}`}
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <button type="button" onClick={(event) => toggleSelect(device.id, event)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-[#FF8A00] bg-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)] bg-white'}`}>
                          {selected ? <Check size={13} className="text-white" /> : null}
                        </button>
                        <div className="min-w-0">
                          <h3 className="m-0 truncate text-[15px] font-medium text-[#111315]">{device.device_name || 'Device Name'}</h3>
                          <p className="m-0 mt-1 truncate text-[12px] text-[rgba(17,19,21,0.6)]">{device.access_key || 'Remote365 ID'}</p>
                          {pwUpdate && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FEF3E6] px-2 py-0.5 text-[10px] font-medium leading-[14px] text-[#B54708]">
                              <Shield size={10} /> Password changed — update
                            </span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={(event) => handleToggleDeviceMenu(event, device.id)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#1A1D21] hover:bg-[#F3F4F6] hover:text-[#FF8A00]" title="Device actions">
                        <MoreVertical size={20} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-[12px]">
                      <div>
                        <p className="m-0 mb-1 text-[rgba(26,29,33,0.45)]">Status</p>
                        <span className={`inline-flex h-[22px] items-center rounded-2xl px-2.5 text-[11px] font-medium leading-[14px] ${sessionClass}`}>
                          {sessionLabel}
                        </span>
                      </div>
                      <div>
                        <p className="m-0 mb-1 text-[rgba(26,29,33,0.45)]">Activity</p>
                        <span className={`inline-flex h-[22px] items-center rounded-2xl px-2.5 text-[11px] font-medium leading-[14px] ${activity.cls}`}>
                          {activity.label}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 mb-1 text-[rgba(26,29,33,0.45)]">Last Seen</p>
                        <p className="m-0 truncate">{formatLastSeen(device)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 mb-1 text-[rgba(26,29,33,0.45)]">Group</p>
                        <p className="m-0 truncate">{groupName}</p>
                      </div>
                    </div>
                    {canConnect ? (
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleDeviceClick(device); }} disabled={!device.is_online} className={`mt-5 inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded px-3 text-[12px] font-medium leading-none transition-colors disabled:bg-[#F3F4F6] disabled:text-[rgba(26,29,33,0.3)] ${pwUpdate ? 'bg-[#B54708] text-white hover:bg-[#94380A]' : 'bg-[#FFB347] text-[#111315] hover:bg-[#FFA01F]'}`}>
                        {pwUpdate ? 'Update password' : 'Connect'}
                      </button>
                    ) : canReport ? (
                      <button type="button" onClick={(event) => { event.stopPropagation(); openReport(device); }} className="mt-5 inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded border border-[#FFB347] px-3 text-[12px] font-medium leading-none text-[#B54708] transition-colors hover:bg-[#FFF4E5]">
                        Report a problem
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-[rgba(26,29,33,0.3)] bg-white">
              <table className="w-full min-w-[760px] border-collapse table-fixed">
                <thead>
                  <tr className="h-[44px] border-b border-[rgba(26,29,33,0.3)] bg-[#F3F4F6] text-left text-[12px] font-medium leading-[17px] text-[#111315]">
                    <th className="w-[28%] px-6">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={toggleSelectAll} className={`flex h-5 w-5 items-center justify-center rounded border ${selectedIds.length === filteredDevices.length && filteredDevices.length > 0 ? 'border-[#FF8A00] bg-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)] bg-white'}`}>
                          {selectedIds.length === filteredDevices.length && filteredDevices.length > 0 ? <Check size={13} className="text-white" /> : null}
                        </button>
                        {sortHeader('name', 'Device')}
                      </div>
                    </th>
                    <th className="w-[11%] px-6">{sortHeader('status', 'Status')}</th>
                    <th className="w-[12%] px-6">{sortHeader('activity', 'Activity')}</th>
                    <th className="w-[14%] px-6">{sortHeader('last_seen', 'Last Seen')}</th>
                    <th className="w-[15%] px-6">{sortHeader('group', 'Group')}</th>
                    <th className="w-[14%] px-4 text-center">{canConnect ? 'Connect' : canReport ? 'Report' : ''}</th>
                    <th className="w-[6%] px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((device) => {
                    const selected = selectedIds.includes(device.id);
                    const groupName = getDeviceGroupName(device);
                    const sessionLabel = device.is_online ? 'Online' : 'Offline';
                    const sessionClass = device.is_online
                      ? 'bg-[#ECFDF3] text-[#34C759]'
                      : 'bg-[#FEF3F2] text-[#D92D20]';
                    const activity = !device.is_online
                      ? { label: 'Offline', cls: 'bg-[#FEF3F2] text-[#D92D20]' }
                      : isDeviceInSession(device)
                        ? { label: 'In session', cls: 'bg-[#FEF3E6] text-[#B54708]' }
                        : { label: 'Idle', cls: 'bg-[#EFF8FF] text-[#175CD3]' };
                    const pwUpdate = needsPasswordUpdate(device);

                    return (
                      <tr
                        key={device.id}
                        onClick={() => (canConnect ? handleDeviceClick(device) : canReport ? openReport(device) : undefined)}
                        className={`h-[72px] cursor-pointer border-t border-[rgba(26,29,33,0.3)] text-[14px] leading-5 text-[#111315] transition-colors hover:bg-[#FAFAFA] ${selectedDevice?.id === device.id ? 'bg-[rgba(255,138,0,0.06)]' : 'bg-white'}`}
                      >
                        <td className="px-6">
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={(event) => toggleSelect(device.id, event)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-[#FF8A00] bg-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)] bg-white'}`}>
                              {selected ? <Check size={13} className="text-white" /> : null}
                            </button>
                            <div className="min-w-0">
                              <span className="block truncate font-medium text-[#111315]">{device.device_name || 'Device Name'}</span>
                              <span className="block truncate font-normal text-[rgba(17,19,21,0.6)]">{device.access_key || 'Remote365 ID'}</span>
                              {pwUpdate && (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FEF3E6] px-2 py-0.5 text-[10px] font-medium leading-[14px] text-[#B54708]">
                                  <Shield size={10} /> Password changed — update
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6">
                          <span className={`inline-flex h-[22px] items-center rounded-2xl px-2.5 text-[11px] font-medium leading-[14px] ${sessionClass}`}>
                            {sessionLabel}
                          </span>
                        </td>
                        <td className="px-6">
                          <span className={`inline-flex h-[22px] items-center rounded-2xl px-2.5 text-[11px] font-medium leading-[14px] ${activity.cls}`}>
                            {activity.label}
                          </span>
                        </td>
                        <td className="px-6">{formatLastSeen(device)}</td>
                        <td className="px-6">
                          <span className="block truncate">{groupName}</span>
                        </td>
                        <td className="px-4 text-center" onClick={(event) => event.stopPropagation()}>
                          {canConnect ? (
                            <button type="button" onClick={() => handleDeviceClick(device)} disabled={!device.is_online} className={`inline-flex h-[28px] min-w-[82px] items-center justify-center whitespace-nowrap rounded px-3 text-[11px] font-medium leading-none transition-colors disabled:bg-[#F3F4F6] disabled:text-[rgba(26,29,33,0.3)] ${pwUpdate ? 'bg-[#B54708] text-white hover:bg-[#94380A]' : 'bg-[#FFB347] text-[#111315] hover:bg-[#FFA01F]'}`}>
                              {pwUpdate ? 'Update password' : 'Connect'}
                            </button>
                          ) : canReport ? (
                            <button type="button" onClick={() => openReport(device)} className="inline-flex h-[28px] min-w-[82px] items-center justify-center whitespace-nowrap rounded border border-[#FFB347] px-3 text-[11px] font-medium leading-none text-[#B54708] transition-colors hover:bg-[#FFF4E5]">
                              Report
                            </button>
                          ) : null}
                        </td>
                        <td className="px-3 text-center" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={(event) => handleToggleDeviceMenu(event, device.id)} className="inline-flex h-8 w-8 items-center justify-center rounded text-[#1A1D21] hover:bg-[#F3F4F6] hover:text-[#FF8A00]" title="Device actions">
                            <MoreVertical size={20} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </div>
      </main>

      {/* One bulk-actions pill for the checkbox selection; every action lives
          in its pop-up menu so the bar never grows more buttons. */}
      {selectedIds.length > 0 && (can('devices:remove') || !!handleBulkArchive) && (
        <div className="fixed bottom-20 left-4 right-4 z-[80] flex justify-center sm:left-auto sm:right-10 sm:block">
          {showBulkMenu && (
            <>
              <div className="fixed inset-0 z-[81]" onClick={() => setShowBulkMenu(false)} />
              <div className="absolute bottom-12 right-0 z-[82] w-60 overflow-hidden rounded-xl border border-black/5 bg-white py-1 shadow-2xl">
                {handleBulkArchive && (
                  // Reversible (Archived tab → Restore), but a whole selection
                  // vanishing on one click reads as data loss, so ask first.
                  <button
                    type="button"
                    onClick={() => {
                      const ids = [...selectedIds];
                      setShowBulkMenu(false);
                      setConfirmDialog({
                        title: `Archive ${ids.length} ${ids.length === 1 ? 'device' : 'devices'}?`,
                        body: 'They stay on your account but are hidden from this list. You can restore them any time from Archived.',
                        confirmLabel: 'Archive selected',
                        tone: 'neutral',
                        onConfirm: () => {
                          handleBulkArchive(ids);
                          setSelectedIds([]);
                        },
                      });
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium text-[#111315] hover:bg-[#F3F4F6]"
                  >
                    <Archive size={15} />
                    Archive selected…
                  </button>
                )}
                {can('devices:remove') && (
                  <button
                    type="button"
                    onClick={() => {
                      const ids = [...selectedIds];
                      setShowBulkMenu(false);
                      setConfirmDialog({
                        title: `Remove ${ids.length} ${ids.length === 1 ? 'device' : 'devices'}?`,
                        body: 'Owned devices will be removed from your account. Saved devices will be unlinked from this account only.',
                        confirmLabel: 'Remove selected',
                        tone: 'danger',
                        onConfirm: () => {
                          handleBulkDelete(ids);
                          setSelectedIds([]);
                        }
                      });
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                    Remove selected…
                  </button>
                )}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowBulkMenu((value) => !value)}
            className="flex h-10 items-center gap-2 rounded-[20px] bg-[#111315] px-4 text-[13px] font-medium text-white shadow-xl transition hover:brightness-125"
          >
            Selected ({selectedIds.length})
            <ChevronUp size={15} className={showBulkMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>
      )}

      {showAddGroupModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-3 font-['Mona_Sans',system-ui,sans-serif] sm:p-4" onClick={closeAddGroupModal}>
          <div className="w-[440px] max-w-[calc(100vw-24px)] rounded-[24px] bg-white p-5 shadow-2xl sm:max-w-[calc(100vw-32px)] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF4E5] text-[#FF8A00]">
                  <FolderClosed size={21} />
                </div>
                <div>
                  <h3 className="m-0 text-[20px] font-semibold leading-7 text-[#111315]">Add group</h3>
                  <p className="m-0 mt-1 text-[13px] leading-5 text-[rgba(26,29,33,0.55)]">
                    {pendingGroupDeviceId ? 'Create and assign a group to this device.' : 'Create a device group for this account.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeAddGroupModal} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-[#F3F4F6] hover:text-black" title="Close">
                <X size={20} />
              </button>
            </div>

            <div className="mt-7">
              <label className="mb-2 block text-[12px] font-medium text-[#757575]">Group name</label>
              <input
                autoFocus
                type="text"
                value={newGroupName}
                maxLength={50}
                onChange={(event) => { setNewGroupName(event.target.value); setGroupCreateError(''); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && newGroupName.trim() && !duplicateNewGroup && !groupCreateBusy) handleCreateGroup();
                }}
                placeholder="e.g. Office computers"
                className={`h-12 w-full rounded-xl border bg-[#F9FAFB] px-4 text-[14px] font-medium outline-none transition-all placeholder:text-gray-400 focus:bg-white ${duplicateNewGroup ? 'border-[#D92D20] focus:border-[#D92D20]' : 'border-gray-200 focus:border-[#FF8A00]'}`}
              />
              {duplicateNewGroup && (
                <p className="mt-2 text-[12px] font-medium text-[#D92D20]">A group named "{duplicateNewGroup.name}" already exists.</p>
              )}

              <label className="mb-2 mt-5 block text-[12px] font-medium text-[#757575]">Group color</label>
              <div className="flex items-center gap-3">
                {['#FF8A00', '#0EA5E9', '#8B5CF6', '#34C759', '#E5484D'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewGroupColor(color)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-105 ${newGroupColor === color ? 'ring-2 ring-[#111315] ring-offset-2' : ''}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {newGroupColor === color ? <Check size={15} className="text-white" /> : null}
                  </button>
                ))}
              </div>

              {groupCreateError && (
                <div className="mt-5 rounded-xl bg-[#FEF3F2] px-3 py-2.5 text-[12px] font-medium text-[#D92D20]">{groupCreateError}</div>
              )}

              <div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row">
                <button type="button" onClick={closeAddGroupModal} disabled={groupCreateBusy} className="h-10 rounded-lg border border-[rgba(26,29,33,0.2)] px-5 text-[14px] font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-50">Cancel</button>
                <button type="button" onClick={handleCreateGroup} disabled={!newGroupName.trim() || Boolean(duplicateNewGroup) || groupCreateBusy} className="inline-flex h-10 min-w-[92px] items-center justify-center gap-2 rounded-lg bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-6 text-[14px] font-semibold text-black disabled:bg-none disabled:bg-[#F3F4F6] disabled:text-gray-400">
                  {groupCreateBusy ? <RefreshCw size={15} className="animate-spin" /> : null}
                  {groupCreateBusy ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openDeviceMenu && (() => {
        const device = devices.find((item) => item.id === openDeviceMenu.id);
        if (!device) return null;
        const close = () => setOpenDeviceMenu(null);
        const itemClass = 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-[#111315] transition-colors hover:bg-[#F3F4F6]';
        return (
          <>
            <button
              type="button"
              aria-label="Close device actions"
              className="fixed inset-0 z-[105] cursor-default bg-transparent"
              onClick={close}
            />
            <div
              ref={(el) => {
                if (!el) return;
                // Flip above the kebab button when opening downward would run
                // past the viewport; falls back to pinning at the top edge.
                if (openDeviceMenu.top + el.offsetHeight > window.innerHeight - 8) {
                  el.style.top = `${Math.max(8, openDeviceMenu.anchorTop - el.offsetHeight - 6)}px`;
                }
              }}
              className="fixed z-[106] w-[212px] overflow-hidden rounded-xl border border-[rgba(26,29,33,0.12)] bg-white py-1.5 shadow-xl"
              style={{ top: openDeviceMenu.top, left: openDeviceMenu.left }}
            >
              {can('devices:configure') && <button type="button" className={itemClass} onClick={() => { setActionModal({ type: 'rename', device }); close(); }}>
                <Pencil size={15} className="shrink-0 text-[#1A1D21]" />
                Change device name
              </button>}
              {can('devices:assign') && <button type="button" className={itemClass} onClick={() => { setActionModal({ type: 'assign-group', device }); close(); }}>
                <Folder size={15} className="shrink-0 text-[#1A1D21]" />
                Change group
              </button>}
              <button type="button" className={itemClass} onClick={() => { copyDeviceId(device.access_key || ''); close(); }}>
                <Copy size={15} className="shrink-0 text-[#1A1D21]" />
                Copy device ID
              </button>
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  close();
                  setConfirmDialog({
                    title: `Archive ${device.device_name || 'device'}?`,
                    body: 'The device stays on your account but is hidden from this list. You can find it later under Archived Devices and restore it any time.',
                    confirmLabel: 'Archive device',
                    tone: 'neutral',
                    onConfirm: () => onArchiveDevice?.(device),
                  });
                }}
              >
                <Archive size={15} className="shrink-0 text-[#1A1D21]" />
                Archive device
              </button>
              {can('devices:remove') && <><div className="my-1 h-px bg-[rgba(26,29,33,0.1)]" />
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-[#E5484D] transition-colors hover:bg-[#FEF2F2]"
                onClick={() => { setActionModal({ type: 'remove', device }); close(); }}
              >
                <Trash2 size={15} className="shrink-0" />
                Delete device
              </button></>}
            </div>
          </>
        );
      })()}

      {actionModal?.type === 'assign-group' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-3 sm:p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] bg-white shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between p-5 pb-4 sm:p-8 sm:pb-4">
              <h3 className="m-0 text-[20px] font-medium text-[#111315]">Assign to group</h3>
              <button type="button" onClick={() => setActionModal(null)} className="p-2 text-gray-400 hover:text-black">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 pb-5 sm:px-8 sm:pb-8">
              <p className="mb-6 text-[13px] text-[rgba(26,29,33,0.55)]">
                Select a group for <span className="font-medium text-black">{actionModal.device.device_name}</span>.
              </p>
              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateDeviceGroups(actionModal.device.id, []);
                    setActionModal(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-[#F3F4F6] px-4 py-3 text-left"
                >
                  <Monitor size={16} />
                  <span className="flex-1 text-[13px] font-medium">My Computers</span>
                  {(!actionModal.device.device_groups || actionModal.device.device_groups.length === 0) ? <Check size={16} /> : null}
                </button>
                {accountGroups.map((group) => {
                  const active = actionModal.device.device_groups?.some((deviceGroup: AccountDeviceGroup) => deviceGroup.id === group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        handleUpdateDeviceGroups(actionModal.device.id, [group.id]);
                        setActionModal(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${active ? 'bg-orange-50 text-[#FF8A00]' : 'bg-[#F3F4F6] text-[#111315]'}`}
                    >
                      <Folder size={16} />
                      <span className="flex-1 text-[13px] font-medium">{group.name}</span>
                      {active ? <Check size={16} /> : null}
                    </button>
                  );
                })}
              </div>
              {canCreateGroup && (
                <button type="button" onClick={() => { setPendingGroupDeviceId(actionModal.device.id); setGroupCreateError(''); setActionModal(null); setShowAddGroupModal(true); }} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F3F4F6] text-[13px] font-medium">
                  <Plus size={16} />
                  Create New Group
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-3 sm:p-4">
          <div className="w-[440px] max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${confirmDialog.tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-[#FF8A00]'}`}>
                {confirmDialog.tone === 'danger' ? <Trash2 size={20} /> : <Shield size={20} />}
              </div>
              <h3 className="m-0 text-[18px] font-medium text-black">{confirmDialog.title}</h3>
              <p className="mt-2 text-[13px] leading-5 text-[rgba(26,29,33,0.6)]">{confirmDialog.body}</p>
            </div>
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-100 bg-[#F9FAFB] px-4 py-4 sm:flex-row sm:px-6">
              <button type="button" onClick={() => setConfirmDialog(null)} className="h-10 rounded border border-gray-200 bg-white px-4 text-[13px] font-medium">Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await action();
                }}
                className={`h-10 rounded px-4 text-[13px] font-medium text-white ${confirmDialog.tone === 'danger' ? 'bg-red-600' : 'bg-[#111315]'}`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportDevice && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-3 sm:p-4" onClick={() => !reportBusy && setReportDevice(null)}>
          <div className="w-[440px] max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="m-0 text-[18px] font-medium text-black">Report a problem</h3>
                <button type="button" onClick={() => !reportBusy && setReportDevice(null)} className="p-1 text-gray-400 hover:text-black"><X size={20} /></button>
              </div>
              {reportDone ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF3] text-[#34C759]"><Check size={24} /></div>
                  <p className="m-0 text-[14px] font-medium text-[#111315]">Report sent to your admins.</p>
                </div>
              ) : (
                <>
                  <p className="m-0 mb-4 text-[13px] leading-5 text-[rgba(26,29,33,0.6)]">
                    Tell your owner/admins what's wrong with <span className="font-medium text-black">{reportDevice.device_name || 'this device'}</span>. They'll get a notification.
                  </p>
                  <textarea
                    autoFocus
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    placeholder="e.g. Screen freezes right after login…"
                    rows={4}
                    maxLength={1000}
                    className="w-full resize-none rounded-lg border border-[rgba(26,29,33,0.2)] px-3 py-2.5 text-[13px] text-[#111315] outline-none focus:border-[#FF8A00]"
                  />
                  {reportError && <p className="mt-2 text-[12px] font-medium text-[#D92D20]">{reportError}</p>}
                </>
              )}
            </div>
            {!reportDone && (
              <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-100 bg-[#F9FAFB] px-4 py-4 sm:flex-row sm:px-6">
                <button type="button" onClick={() => setReportDevice(null)} disabled={reportBusy} className="h-10 rounded border border-gray-200 bg-white px-4 text-[13px] font-medium disabled:opacity-60">Cancel</button>
                <button type="button" onClick={submitReport} disabled={reportBusy || !reportMessage.trim()} className="inline-flex h-10 items-center gap-2 rounded bg-[#111315] px-4 text-[13px] font-medium text-white disabled:opacity-60">
                  {reportBusy ? <RefreshCw size={15} className="animate-spin" /> : null}
                  Send report
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
