import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, ChevronDown, Edit2, Eye, EyeOff, Folder, Loader2, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { SnowBilling } from '../../components/SnowBilling';
import { SnowDevices } from '../../components/snow/SnowDevices';
import { SnowMembers } from '../../components/SnowMembers';
import { SnowPremiumSettings } from '../../components/SnowPremiumSettings';
import { SnowAdminSettings } from '../../components/SnowAdminSettings';
import { SnowSupport } from '../../components/snow/SnowSupport';
import { SnowPremiumDashboard } from '../../components/snow/SnowPremiumDashboard';
import { WebRemoteSupport } from '../../components/dashboard/WebRemoteSupport';
import { WebMeetingsHome } from '../../components/web/WebMeetingsHome';
import { WebChat } from '../../components/web/WebChat';
import { WebPremiumShell } from '../../components/web/WebPremiumShell';
import { WebMobileShell } from '../../components/web/WebMobileShell';
import { MobileDevices, MobileMeeting } from '../../components/web/WebMobileScreens';
import { WebMobileSettings } from '../../components/web/WebMobileSettings';
import { WebMobileAdmin } from '../../components/web/WebMobileAdmin';
import { WebMobileSupport } from '../../components/web/WebMobileSupport';
import { WebMobileMembers } from '../../components/web/WebMobileMembers';
import { WebMobileBilling } from '../../components/web/WebMobileBilling';
import { WebMobileSupportCenter } from '../../components/web/WebMobileSupportCenter';
import { WebUnavailableNotice } from '../../components/web/WebUnavailableNotice';
import { MeetingsWhatsNew } from '../../components/MeetingsWhatsNew';
import { hasUserPermission } from '../../lib/permissions';
import { notify } from '../../components/NotificationProvider';
import { formatAccessKey, getRecentConnections } from '../../lib/recentConnections';
import { openSessionTab } from '../../lib/sessionLauncher';
import { subscribeActiveSessions } from '../../lib/activeSessions';
import { useAuthStore } from '../../store/authStore';
import { useDeviceStore } from '../../store/deviceStore';
import { getDeviceAccessKey, getHiddenDeviceKeys, setHiddenDeviceKeys } from '../../lib/hiddenDevices';
import {
  clearDeviceRemembered,
  deviceNeedsPasswordUpdate,
  isDeviceRemembered,
  markDeviceRemembered,
  markDeviceNeedsPasswordUpdate,
} from '../../lib/devicePasswordStatus';
import api from '../../lib/api';

interface DeviceGroup {
  id: string;
  name: string;
  color?: string | null;
}

interface WebDashboardPageProps {
  view: string;
  title: string;
}

// Desktop uses internal "view" names; map them to the web dashboard routes so
// the ported components' onNavigate(view) calls land on the right page.
const VIEW_TO_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  home: '/dashboard',
  devices: '/dashboard/devices',
  connect: '/dashboard/sessions',
  sessions: '/dashboard/sessions',
  meetings: '/dashboard/meetings',
  billing: '/dashboard/billing',
  settings: '/dashboard/settings',
  profile: '/dashboard/profile',
  support: '/dashboard/support',
  members: '/dashboard/members',
  chat: '/dashboard/members',
  admin_settings: '/dashboard/admin-settings',
};

export const WebDashboardPage: React.FC<WebDashboardPageProps> = ({ view, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { devices, fetchDevices, addDevice, removeDevice, updateDeviceName } = useDeviceStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [actionModal, setActionModal] = useState<any>(null);
  const [actionValue, setActionValue] = useState('');
  const [actionError, setActionError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ key: '', password: '', name: '', groupId: '', remember: true });
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addDeviceError, setAddDeviceError] = useState('');
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deviceMutationLabel, setDeviceMutationLabel] = useState<string | null>(null);
  const [showArchivedDevices, setShowArchivedDevices] = useState(false);
  const [archivedSearch, setArchivedSearch] = useState('');
  const [archiveVersion, setArchiveVersion] = useState(0);
  const [serverIP] = useState(localStorage.getItem('remote_link_server_ip') || window.location.hostname);
  const [autoHost, setAutoHost] = useState(() => localStorage.getItem('is_auto_host_enabled') === 'true');
  // Phones get the dedicated mobile shell + screens (separate components, not
  // responsive CSS). Desktop keeps WebPremiumShell and its pages untouched.
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsPhone(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Live device state (online/offline + in-session) is owned by the shell's
  // useDeviceMonitor, which both WebPremiumShell and WebMobileShell mount.

  useEffect(() => {
    if (view !== 'devices') return;
    const params = new URLSearchParams(location.search);
    if (params.get('archived') !== '1') return;
    setShowArchivedDevices(true);
    navigate('/dashboard/devices', { replace: true });
  }, [location.search, navigate, view]);

  useEffect(() => {
    if (!showAddModal) {
      setAddDeviceError('');
      setShowAddPassword(false);
      setShowGroupMenu(false);
      return;
    }
    api.get('/api/devices/user-groups')
      .then((response: { data: any }) => {
        const groups = Array.isArray(response.data?.groups)
          ? response.data.groups
          : Array.isArray(response.data) ? response.data : [];
        setDeviceGroups(groups);
      })
      .catch(() => setDeviceGroups([]));
  }, [showAddModal]);

  const hiddenKeys = useMemo(
    () => getHiddenDeviceKeys(user?.id),
    [user?.id, archiveVersion],
  );
  const visibleDevices = useMemo(
    () => devices.filter((device) => !hiddenKeys.has(getDeviceAccessKey(device))),
    [devices, hiddenKeys],
  );
  const archivedDevices = useMemo(
    () => devices.filter((device) => hiddenKeys.has(getDeviceAccessKey(device))),
    [devices, hiddenKeys],
  );
  const filteredArchivedDevices = useMemo(() => {
    const query = archivedSearch.trim().toLowerCase();
    if (!query) return archivedDevices;
    return archivedDevices.filter((device) =>
      `${device.device_name || ''} ${device.access_key || ''}`.toLowerCase().includes(query),
    );
  }, [archivedDevices, archivedSearch]);
  const passwordUpdateKeys = useMemo(
    () => devices
      .filter((device) =>
        Boolean(device.needs_password_update)
        && (Boolean(device.is_owned) || isDeviceRemembered(device.access_key) || deviceNeedsPasswordUpdate(device.access_key)),
      )
      .map((device) => device.access_key),
    [devices],
  );
  const selectedGroup = deviceGroups.find((group) => group.id === addForm.groupId);

  // Devices with a session open in another browser tab. The desktop reads this
  // from its main process; the web viewer is a separate tab, so it announces
  // itself instead (see lib/activeSessions). Without it the "In Active Session"
  // stat and its filter would always read 0.
  const [activeSessionKeys, setActiveSessionKeys] = useState<string[]>([]);
  useEffect(() => subscribeActiveSessions(setActiveSessionKeys), []);

  useEffect(() => {
    setActionError('');
    if (actionModal?.type === 'rename') setActionValue(actionModal.device?.device_name || '');
  }, [actionModal]);

  // Device names and IDs must stay unique in the list — two machines called
  // "Reception", or the same ID twice, are impossible to tell apart when
  // picking one to connect to.
  const findDuplicateDeviceName = (name: string, exceptId?: string) => {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return undefined;
    return devices.find((device: any) =>
      device.id !== exceptId && String(device.device_name || device.name || '').trim().toLowerCase() === normalized,
    );
  };

  const renameDuplicate = actionModal?.type === 'rename'
    ? findDuplicateDeviceName(actionValue, actionModal.device?.id)
    : undefined;

  const goToView = (v: string) => navigate(VIEW_TO_PATH[v] || '/dashboard');

  const handleRefresh = async (showLoader = false) => {
    if (showLoader) setIsRefreshing(true);
    try {
      await fetchDevices(true);
    } finally {
      if (showLoader) setIsRefreshing(false);
    }
  };

  const handleDeviceClick = (device: any) => {
    if (!device.is_online) {
      notify(`${device.device_name || 'This device'} is offline. Turn it on and make sure Remote365 is running on it.`, 'warning');
      return;
    }
    if (passwordUpdateKeys.includes(device.access_key)) {
      markDeviceNeedsPasswordUpdate(device.access_key);
    }
    openSessionTab(device.access_key);
  };

  const handleBulkDelete = async (ids: string[]) => {
    setDeviceMutationLabel(ids.length === 1 ? 'Deleting device…' : `Deleting ${ids.length} devices…`);
    try {
      await Promise.all(ids.map((id) => removeDevice(id)));
      notify(ids.length === 1 ? 'Device removed' : `${ids.length} devices removed`, 'success');
    } catch {
      notify('Some devices could not be removed', 'error');
    } finally {
      setDeviceMutationLabel(null);
    }
  };

  const handleAddDevice = async () => {
    setAddDeviceError('');
    const accessKey = addForm.key.replace(/\D/g, '');
    if (!accessKey) {
      setAddDeviceError('Please enter the Remote365 ID.');
      return;
    }
    // One ID can only be in the list once — adding it again would just
    // duplicate a row the user already has.
    const alreadyListed = visibleDevices.find((device: any) => getDeviceAccessKey(device) === accessKey);
    if (alreadyListed) {
      setAddDeviceError(`This device is already in your list as "${alreadyListed.device_name || alreadyListed.name || 'this device'}".`);
      return;
    }
    const cleanAddName = addForm.name.trim();
    if (cleanAddName) {
      const duplicateName = findDuplicateDeviceName(cleanAddName);
      if (duplicateName) {
        setAddDeviceError(`Another device is already named "${duplicateName.device_name}". Pick a different name.`);
        return;
      }
    }
    // Re-adding a device the user archived locally is a restore, not a
    // duplicate — tell the server so it re-links instead of rejecting.
    const restoringArchived = hiddenKeys.has(accessKey);

    setIsAddingDevice(true);
    setDeviceMutationLabel('Adding device…');
    try {
      const addedDevice = await addDevice(accessKey, addForm.password, {
        name: cleanAddName || undefined,
        remember: addForm.remember,
        allowRelink: restoringArchived,
      });
      if (addForm.remember) markDeviceRemembered(accessKey);
      else clearDeviceRemembered(accessKey);
      if (addForm.groupId && addedDevice.id) {
        try {
          await api.patch(`/api/devices/${addedDevice.id}/user-groups`, { groupIds: [addForm.groupId] });
        } catch {
          notify('Device added, but its group could not be assigned', 'warning');
        }
      }
      await fetchDevices(true);
      const nextHidden = getHiddenDeviceKeys(user?.id);
      nextHidden.delete(accessKey);
      setHiddenDeviceKeys(user?.id, nextHidden);
      setArchiveVersion((version) => version + 1);
      setShowAddModal(false);
      setAddForm({ key: '', password: '', name: '', groupId: '', remember: true });
      notify('Device linked successfully', 'success');
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error || '';
      if (status === 401 || /password required|incorrect password/i.test(message)) {
        setAddDeviceError(addForm.password ? 'Incorrect password. Please enter the correct password and try again.' : 'This device requires a password. Enter it and try again.');
      } else if (status === 404) {
        setAddDeviceError("We couldn't find a device with that ID. Double-check the Remote365 ID.");
      } else {
        setAddDeviceError(message || 'Could not add the device. Please try again.');
      }
    } finally {
      setIsAddingDevice(false);
      setDeviceMutationLabel(null);
    }
  };

  /**
   * Archive state lives on the server (`settings.archivedBy`, surfaced as
   * `is_archived`) so the web and desktop apps agree. The localStorage set is
   * kept as the in-memory index every device filter here already reads — a
   * cache of the server's answer, not the source of truth.
   */
  const pushArchiveState = async (deviceId: string, archived: boolean) => {
    if (!deviceId) return;
    try {
      await api.post(`/api/devices/${deviceId}/archive`, { archived });
    } catch (error) {
      console.error('[Devices] Could not sync archive state:', error);
    }
  };

  /**
   * Seed the cache from a freshly fetched list and migrate anything archived
   * locally before this was server-backed. Local-only keys are pushed UP rather
   * than dropped, so no existing archive is lost on first run of this build.
   */
  const reconcileArchivedDevices = (list: any[]) => {
    // An EMPTY account list is a real answer too (it used to return early and
    // keep a stale "Archived (1)" alive on an account with zero devices).
    if (!Array.isArray(list)) return;
    const local = getHiddenDeviceKeys(user?.id);
    const next = new Set<string>();
    for (const device of list) {
      const key = getDeviceAccessKey(device);
      if (!key) continue;
      if (device?.is_archived) next.add(key);
    }
    // The payload is the full device list, so a cached key whose device is
    // no longer on the account (deleted / unlinked) is dropped, not kept
    // "archived" forever.
    if (local.size !== next.size) console.info(`[Devices] Archive cache reconciled (${next.size} archived).`);
    // READ-ONLY mirror — reconcile never writes archive state to the server.
    // The old local→server "migration" push meant any stale install or browser
    // tab (every fleet host app shares this account) could re-archive or fight
    // state from its cache. Aug 12: an archive was silently reverted within 49s
    // by exactly such background pushes. Archive/restore now ONLY happen from
    // explicit user actions.
    setHiddenDeviceKeys(user?.id, next);
    setArchiveVersion((version) => version + 1);
  };

  const handleArchiveDevice = (device: any) => {
    const key = getDeviceAccessKey(device);
    if (!key) return;
    const nextHidden = getHiddenDeviceKeys(user?.id);
    nextHidden.add(key);
    setHiddenDeviceKeys(user?.id, nextHidden);
    setSelectedDevice(null);
    setArchiveVersion((version) => version + 1);
    // Cache first so the row disappears immediately, then persist.
    void pushArchiveState(device?.id, true);
    notify(`${device.device_name || 'Device'} archived`, 'success');
  };

  const restoreArchivedDevice = (device: any) => {
    const nextHidden = getHiddenDeviceKeys(user?.id);
    nextHidden.delete(getDeviceAccessKey(device));
    setHiddenDeviceKeys(user?.id, nextHidden);
    setArchiveVersion((version) => version + 1);
    if (device?.id) void pushArchiveState(device.id, false);
    else console.warn('[Devices] Restore could not resolve a device id; it may re-archive on refresh.');
  };

  // Bulk archive from the device list's checkbox selection. One cache write and
  // one notify for the whole batch; the per-device server sync runs behind it.
  const handleBulkArchive = (ids: string[]) => {
    const nextHidden = getHiddenDeviceKeys(user?.id);
    let archivedCount = 0;
    for (const id of ids) {
      const device = (devices as any[]).find((d: any) => d?.id === id);
      const key = getDeviceAccessKey(device);
      if (!key) continue;
      nextHidden.add(key);
      void pushArchiveState(id, true);
      archivedCount += 1;
    }
    if (!archivedCount) return;
    setHiddenDeviceKeys(user?.id, nextHidden);
    setSelectedDevice(null);
    setArchiveVersion((version) => version + 1);
    notify(`${archivedCount} ${archivedCount === 1 ? 'device' : 'devices'} archived`, 'success');
  };

  // Checkbox selection inside the Archived view, for bulk restore.
  const [archivedSelected, setArchivedSelected] = useState<Set<string>>(new Set());
  const toggleArchivedSelected = (id: string) => setArchivedSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const restoreSelectedArchived = () => {
    const chosen = archivedDevices.filter((device: any) => archivedSelected.has(device.id));
    chosen.forEach((device: any) => restoreArchivedDevice(device));
    setArchivedSelected(new Set());
    if (chosen.length) notify(`${chosen.length} ${chosen.length === 1 ? 'device' : 'devices'} restored`, 'success');
  };

  // Reconcile whenever the store's device list changes, so an archive made on
  // desktop appears here without a reload.
  useEffect(() => { reconcileArchivedDevices(devices as any[]); }, [devices]);

  // RBAC route guard: deep links to pages the owner turned off for this
  // member's role (or revoked per-user) bounce back to Devices — the sidebar
  // already hides them, this stops direct URLs. Mirrors the desktop gating;
  // the backend enforces every action regardless.
  const featureEnabled = (key: string) => (user?.features ? (user.features as any)[key] !== false : true);
  const roleUpper = String(user?.role || '').toUpperCase();
  const viewAllowed = (() => {
    if (!user) return true; // still loading — ProtectedRoute handles auth
    if (view === 'connect') return featureEnabled('remoteSupport') && hasUserPermission(user, 'sessions:start');
    if (view === 'chat') return featureEnabled('chat');
    if (view === 'members') return hasUserPermission(user, 'members:view');
    if (view === 'billing') return featureEnabled('licenses') && hasUserPermission(user, 'billing:view');
    if (view === 'admin_settings') return ['SUPER_ADMIN', 'OWNER'].includes(roleUpper) || (user as any)?.features?.adminSettings === true;
    return true;
  })();
  if (!viewAllowed) return <Navigate to="/dashboard/devices" replace />;

  const content = (() => {
    if (view === 'dashboard') {
      return (
        <div className="w-full flex flex-col animate-fade-in">
          <SnowPremiumDashboard
            user={user}
            localAuthKey={null}
            devicePassword=""
            onNavigate={goToView}
            onConnect={(partnerId?: string) => {
              if (partnerId) openSessionTab(partnerId);
              else navigate('/dashboard/sessions');
            }}
            onOpenSetPassword={() => notify('Set a device password from the desktop app', 'info')}
            onCopyAccessKey={() => notify('Access key copied', 'success')}
            onCopyPassword={() => notify('Password copied', 'success')}
            formatCode={formatAccessKey}
            recentConnections={getRecentConnections()}
            onRecentConnect={(accessKey: string) => openSessionTab(accessKey)}
            hasContacts={false}
            hasRemoteAccess={false}
          />
        </div>
      );
    }
    if (view === 'connect') return <WebRemoteSupport devices={visibleDevices} onDevicesChanged={() => fetchDevices(true)} />;
    if (view === 'meetings') return <WebMeetingsHome />;
    if (view === 'chat') return <WebChat />;
    if (view === 'billing') {
      return (
        <div className="w-full pt-4 animate-fade-in">
          <SnowBilling user={user} />
        </div>
      );
    }
    if (view === 'settings' || view === 'profile') {
      // Same modern settings page as the desktop app (Account / Preferences /
      // This Device sections with Profile, Security, Active sign-ins, Licenses…).
      return (
        <div className="h-full w-full animate-fade-in">
          <SnowPremiumSettings user={user} logout={logout} />
        </div>
      );
    }
    if (view === 'support') {
      return (
        <div className="h-full w-full animate-fade-in px-4 sm:px-8">
          <SnowSupport />
        </div>
      );
    }
    if (view === 'members') {
      return (
        <div className="w-full h-full animate-fade-in">
          <SnowMembers />
        </div>
      );
    }
    if (view === 'admin_settings') {
      // Full admin console, same as the desktop app (organization, team,
      // devices, policies, billing) — every action is backend-enforced.
      return (
        <div className="h-full w-full animate-fade-in">
          <SnowAdminSettings user={user} setCurrentView={goToView} />
        </div>
      );
    }
    // Devices (default)
    return (
      <div className="h-full w-full">
        <SnowDevices
          devices={visibleDevices as any}
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
          handleBulkArchive={handleBulkArchive}
          onArchiveDevice={handleArchiveDevice}
          archivedDeviceCount={archivedDevices.length}
          onOpenArchivedDevices={() => setShowArchivedDevices(true)}
          onRefresh={handleRefresh}
          isLoading={isRefreshing}
          passwordUpdateKeys={passwordUpdateKeys}
          activeSessionKeys={activeSessionKeys}
          onMutationStateChange={(busy, label) => setDeviceMutationLabel(busy ? (label || 'Updating devices…') : null)}
        />
      </div>
    );
  })();

  // Phone screens replace the per-view content; anything without a dedicated
  // mobile screen yet renders the existing page inside a scroll container.
  // Every view has a dedicated phone screen (components/web/WebMobile*).
  const mobileContent =
    view === 'devices' ? (
        <MobileDevices
          devices={visibleDevices}
          refreshing={isRefreshing}
          onAdd={() => setShowAddModal(true)}
          onConnect={handleDeviceClick}
          onRename={(device) => setActionModal({ type: 'rename', device })}
          onRemove={(device) => setActionModal({ type: 'remove', device })}
          onRefresh={() => handleRefresh(true)}
        />
      )
    : view === 'meetings' ? (
        // Figma phone meeting home (start + quick join). The desktop meetings
        // page rendered far oversized on phones; the in-call UI it launches is
        // the same SnowMeeting with the phone layer.
        <MobileMeeting />
      )
    : view === 'chat' ? content
    : view === 'settings' || view === 'profile' ? <WebMobileSettings user={user} logout={logout} />
    : view === 'admin_settings' ? <WebMobileAdmin user={user} setCurrentView={goToView} />
    : view === 'connect' ? <WebMobileSupport user={user} />
    : view === 'members' ? <WebMobileMembers />
    : view === 'billing' ? <WebMobileBilling />
    : view === 'support' ? <WebMobileSupportCenter />
    : <div className="h-full overflow-y-auto overflow-x-hidden">{content}</div>;

  const Shell = (isPhone ? WebMobileShell : WebPremiumShell) as React.FC<{
    view: string;
    title?: string;
    children: React.ReactNode;
  }>;

  return (
    <Shell view={view} title={title}>
      {isPhone ? mobileContent : content}

      <MeetingsWhatsNew user={user} onOpenMeetings={() => navigate('/dashboard/meetings')} />

      {view === 'devices' && deviceMutationLabel && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-white/70 p-4 font-['Mona_Sans',system-ui,sans-serif]">
          <div className="flex min-w-[240px] flex-col items-center gap-4 rounded-[20px] border border-[rgba(26,29,33,0.12)] bg-white px-8 py-7 shadow-2xl">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[3px] border-[#FFE3BF]" />
              <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#FF8A00]" />
              <RefreshCw size={18} className="text-[#FF8A00]" />
            </div>
            <div className="text-center">
              <p className="m-0 text-[15px] font-semibold text-[#111315]">{deviceMutationLabel}</p>
              <p className="m-0 mt-1 text-[12px] text-[rgba(26,29,33,0.55)]">Please wait until the update is complete.</p>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/40 p-3 font-['Mona_Sans',system-ui,sans-serif] sm:p-6">
          <div className="my-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[24px] border border-[rgba(26,29,33,0.12)] bg-white shadow-2xl sm:max-h-none sm:overflow-visible sm:rounded-[28px]">
            <div className="flex items-center justify-between px-5 pb-4 pt-5 sm:px-8 sm:pt-8">
              <h3 className="m-0 text-[20px] font-semibold text-[#1C1C1C]">Add remote device</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 transition-colors hover:text-black" title="Close">
                <X size={24} />
              </button>
            </div>
            <div className="px-5 pb-5 sm:px-8 sm:pb-8">
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="ml-1 text-[12px] font-medium text-[#757575]">Device Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Office PC"
                    value={addForm.name}
                    onChange={(event) => setAddForm({ ...addForm, name: event.target.value })}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-[#F9FAFB] px-4 text-[14px] font-medium outline-none transition-all placeholder:text-gray-400 focus:border-[#FF8A00] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="ml-1 text-[12px] font-medium text-[#757575]">Group</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowGroupMenu((value) => !value)}
                      className={`flex h-12 w-full items-center justify-between rounded-xl border bg-[#F9FAFB] px-4 text-left text-[14px] font-medium outline-none transition-all ${showGroupMenu ? 'border-[#FF8A00] bg-white ring-2 ring-[#FF8A00]/10' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {selectedGroup?.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedGroup.color }} /> : null}
                        <span className="truncate">{selectedGroup?.name || 'My computers'}</span>
                      </span>
                      <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${showGroupMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showGroupMenu && (
                      <div className="absolute left-0 right-0 top-[54px] z-[150] max-h-52 overflow-y-auto rounded-xl border border-[rgba(26,29,33,0.12)] bg-white p-1.5 shadow-[0_14px_36px_rgba(17,19,21,0.16)]">
                        <button
                          type="button"
                          onClick={() => { setAddForm({ ...addForm, groupId: '' }); setShowGroupMenu(false); }}
                          className={`flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] font-medium transition-colors ${!addForm.groupId ? 'bg-[#FFF4E5] text-[#B54708]' : 'text-[#111315] hover:bg-[#F3F4F6]'}`}
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-[#FFB347]" />
                          My computers
                        </button>
                        {deviceGroups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => { setAddForm({ ...addForm, groupId: group.id }); setShowGroupMenu(false); }}
                            className={`flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] font-medium transition-colors ${addForm.groupId === group.id ? 'bg-[#FFF4E5] text-[#B54708]' : 'text-[#111315] hover:bg-[#F3F4F6]'}`}
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color || '#0EA5E9' }} />
                            <span className="truncate">{group.name}</span>
                          </button>
                        ))}
                        {deviceGroups.length === 0 && (
                          <div className="px-3 py-2 text-[12px] text-[#1A1D21]/45">No additional groups yet.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="ml-1 text-[12px] font-medium text-[#757575]">Remote365 ID</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="000 000 000"
                    value={addForm.key}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 9);
                      setAddForm({ ...addForm, key: digits.replace(/(\d{3})(?=\d)/g, '$1 ') });
                      setAddDeviceError('');
                    }}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-[#F9FAFB] px-4 font-mono text-[14px] font-medium outline-none transition-all placeholder:text-gray-400 focus:border-[#FF8A00] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="ml-1 text-[12px] font-medium text-[#757575]">Password <span className="font-normal text-gray-400">(optional)</span></label>
                  <div className="relative">
                    <input
                      type={showAddPassword ? 'text' : 'password'}
                      placeholder="Only if required"
                      value={addForm.password}
                      onChange={(event) => { setAddForm({ ...addForm, password: event.target.value }); setAddDeviceError(''); }}
                      className="h-12 w-full rounded-xl border border-gray-200 bg-[#F9FAFB] px-4 pr-11 text-[14px] font-medium outline-none transition-all placeholder:text-gray-400 focus:border-[#FF8A00] focus:bg-white"
                    />
                    <button type="button" onClick={() => setShowAddPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-black" title={showAddPassword ? 'Hide password' : 'Show password'}>
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

              <div className="mt-7 flex flex-col items-stretch justify-between gap-4 sm:mt-8 sm:flex-row sm:items-center">
                <label className="flex cursor-pointer select-none items-center gap-2.5">
                  <input type="checkbox" checked={addForm.remember} onChange={(event) => setAddForm({ ...addForm, remember: event.target.checked })} className="h-4 w-4 accent-[#FF8A00]" />
                  <span className="text-[13px] text-[#111315]/70">Remember this device</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddDevice}
                  disabled={!addForm.key || isAddingDevice}
                  className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[14px] font-semibold transition-all sm:px-10 ${!addForm.key || isAddingDevice ? 'cursor-not-allowed bg-[#F0F2F5] text-gray-400' : 'bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] text-black hover:brightness-105'}`}
                >
                  {isAddingDevice && <Loader2 size={16} className="animate-spin" />}
                  {isAddingDevice ? 'Adding…' : 'Add Remote Device'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {actionModal && (actionModal.type === 'rename' || actionModal.type === 'remove') && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3 font-['Mona_Sans',system-ui,sans-serif] sm:p-6">
          <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-8">
            <div className="mb-7 text-center">
              <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${actionModal.type === 'remove' ? 'bg-[#FF2D55]/15' : 'bg-[#FFB347]/25'}`}>
                {actionModal.type === 'remove' ? <Trash2 size={24} className="text-[#FF2D55]" /> : <Edit2 size={24} className="text-[#FF8A00]" />}
              </div>
              <h3 className="mb-2 text-[20px] font-medium leading-7 text-[#111315]">{actionModal.type === 'remove' ? 'Delete device' : 'Change device name'}</h3>
              <p className="mx-auto m-0 max-w-[260px] text-[14px] font-normal leading-5 text-[#1A1D21]/60">
                {actionModal.type === 'remove' ? `Remove ${actionModal.device?.device_name || 'this device'} from your account? This can't be undone.` : 'Set a nickname for this device.'}
              </p>
            </div>
            {actionModal.type === 'rename' && (
              <div className="mb-7">
              <input
                autoFocus
                placeholder="e.g. Office Laptop"
                value={actionValue}
                onChange={(event) => { setActionValue(event.target.value); setActionError(''); }}
                className={`h-11 w-full rounded-lg border bg-white px-4 text-[14px] font-normal text-[#111315] outline-none transition-all placeholder:text-[#111315]/30 ${renameDuplicate || actionError ? 'border-[#FF2D55] focus:border-[#FF2D55]' : 'border-[rgba(26,29,33,0.3)] focus:border-[#FF8A00]'}`}
              />
              {(renameDuplicate || actionError) && (
                <p className="mt-2 text-[13px] leading-5 text-[#FF2D55]">
                  {actionError || `Another device is already named "${renameDuplicate?.device_name}".`}
                </p>
              )}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setActionModal(null)} className="h-11 flex-1 rounded-lg border border-[rgba(26,29,33,0.3)] text-[14px] font-medium text-[#1A1D21] transition-all hover:bg-[#F3F4F6]">Cancel</button>
              <button
                type="button"
                disabled={actionModal.type === 'rename' && (!actionValue.trim() || Boolean(renameDuplicate))}
                onClick={async () => {
                  if (actionModal.type === 'rename') {
                    if (!actionValue.trim()) {
                      setActionError('Device name is required.');
                      return;
                    }
                    const duplicate = findDuplicateDeviceName(actionValue, actionModal.device?.id);
                    if (duplicate) {
                      setActionError(`Another device is already named "${duplicate.device_name}".`);
                      return;
                    }
                    try {
                      setActionError('');
                      setDeviceMutationLabel('Renaming device…');
                      await updateDeviceName(actionModal.device.id, actionValue.trim());
                      setActionModal(null);
                      notify('Device renamed successfully', 'success');
                    } catch (err: any) {
                      const message = err?.response?.data?.error || 'Failed to rename device';
                      setActionError(message);
                      notify(message, 'error');
                    } finally {
                      setDeviceMutationLabel(null);
                    }
                    return;
                  }
                  try {
                    setDeviceMutationLabel('Deleting device…');
                    await removeDevice(actionModal.device.id);
                    setActionModal(null);
                    notify('Device deleted', 'success');
                  } catch {
                    notify('Failed to delete device', 'error');
                  } finally {
                    setDeviceMutationLabel(null);
                  }
                }}
                className={`h-11 flex-1 rounded-lg text-[14px] font-medium text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#F0F2F5] disabled:text-gray-400 ${actionModal.type === 'remove' ? 'bg-[#FF2D55]' : 'bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)]'}`}
              >
                {actionModal.type === 'remove' ? 'Delete' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchivedDevices && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-3 font-['Mona_Sans',system-ui,sans-serif] sm:p-4">
          <div className="flex max-h-[calc(100dvh-24px)] min-h-[320px] w-[628px] max-w-full flex-col gap-5 rounded-[12px] bg-white p-4 shadow-2xl sm:h-[380px] sm:gap-[22px] sm:p-6">
            <div className="flex items-start justify-between gap-4 sm:gap-6">
              <div>
                <h2 className="m-0 text-[24px] font-bold leading-[34px] text-[#111315]">Archived devices</h2>
                <p className="m-0 max-w-[371px] text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">Overview of all archived devices that were migrated with their previous state.</p>
              </div>
              <button type="button" onClick={() => setShowArchivedDevices(false)} className="flex h-6 w-6 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
              <button
                type="button"
                disabled={archivedDevices.length === 0}
                onClick={() => {
                  setHiddenDeviceKeys(user?.id, new Set());
                  setArchiveVersion((version) => version + 1);
                }}
                className="flex h-10 items-center justify-center gap-2 rounded px-4 text-[14px] font-medium text-[#111315] hover:bg-[#F3F4F6] disabled:opacity-40"
              >
                <RefreshCw size={16} /> Restore all
              </button>
              {archivedSelected.size > 0 && (
                <button
                  type="button"
                  onClick={restoreSelectedArchived}
                  className="flex h-10 items-center justify-center gap-2 rounded bg-[#111315] px-4 text-[14px] font-medium text-white hover:brightness-110"
                >
                  <RefreshCw size={16} /> Restore Selected ({archivedSelected.size})
                </button>
              )}
              <label className="flex h-10 w-full items-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 sm:w-[299px] sm:max-w-full">
                <Search size={16} className="shrink-0 text-[rgba(26,29,33,0.3)]" />
                <input value={archivedSearch} onChange={(event) => setArchivedSearch(event.target.value)} placeholder="Search archived devices" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[rgba(17,19,21,0.3)]" />
              </label>
            </div>
            <div className="border-t border-[rgba(26,29,33,0.3)]" />
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              {filteredArchivedDevices.length === 0 ? (
                <div className="flex h-10 shrink-0 items-center rounded bg-[#F3F4F6] px-4 text-[14px] font-medium text-[rgba(17,19,21,0.45)]">
                  {archivedDevices.length === 0 ? 'No archived devices.' : 'No archived devices match your search.'}
                </div>
              ) : filteredArchivedDevices.map((device) => (
                <div key={device.id} className="flex h-10 shrink-0 items-center justify-between rounded bg-[#F3F4F6] px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {device.id && (
                      <button
                        type="button"
                        onClick={() => toggleArchivedSelected(device.id)}
                        title={archivedSelected.has(device.id) ? 'Deselect' : 'Select for bulk restore'}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${archivedSelected.has(device.id) ? 'border-[#FF8A00] bg-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)] bg-white'}`}
                      >
                        {archivedSelected.has(device.id) ? <Check size={13} className="text-white" /> : null}
                      </button>
                    )}
                    <Folder size={16} className="shrink-0 text-[#111315]" />
                    <span className="truncate text-[14px] font-medium text-[#111315]">{device.device_name || `Device ID ${device.access_key}`}</span>
                  </div>
                  <button type="button" onClick={() => restoreArchivedDevice(device)} className="rounded px-3 py-1 text-[12px] font-medium text-[#111315] hover:bg-white">Restore</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
};

export default WebDashboardPage;
