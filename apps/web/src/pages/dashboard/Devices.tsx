import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowDevices } from '../../components/snow/SnowDevices';
import { useDeviceStore } from '../../store/deviceStore';
import { useAuthStore } from '../../store/authStore';
import { notify } from '../../components/NotificationProvider';
import { openSessionTab } from '../../lib/sessionLauncher';
import { subscribeActiveSessions } from '../../lib/activeSessions';

const ARCHIVE_KEY = 'remote365_archived_devices';

const readArchived = (): string[] => {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
};

const Devices: React.FC = () => {
  const navigate = useNavigate();
  const { devices, isLoading, fetchDevices, addDevice, removeDevice, updateDeviceName } = useDeviceStore();
  const user = useAuthStore((s) => s.user);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [actionModal, setActionModal] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ key: '', password: '' });
  const [archived, setArchived] = useState<string[]>(readArchived);
  // Devices with a session running in another tab — drives the "In Active
  // Session" stat and its filter, mirroring the desktop's main-process list.
  const [activeSessionKeys, setActiveSessionKeys] = useState<string[]>([]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => subscribeActiveSessions(setActiveSessionKeys), []);

  // Archive is client-side (mirrors the desktop): the device stays on the
  // account but is hidden from the active list until restored.
  const visibleDevices = useMemo(
    () => devices.filter((d: any) => !archived.includes(d.access_key)),
    [devices, archived],
  );

  const handleDeviceClick = (device: any) => {
    if (!device.is_online) {
      notify('Device is offline', 'warning');
      return;
    }
    openSessionTab(device.access_key);
  };

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) await removeDevice(id);
    notify(`Removed ${ids.length} device${ids.length === 1 ? '' : 's'}`, 'success');
  };

  const handleArchiveDevice = useCallback((device: any) => {
    setArchived((prev) => {
      const next = Array.from(new Set([...prev, device.access_key]));
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
      return next;
    });
    if (selectedDevice?.access_key === device.access_key) setSelectedDevice(null);
    notify(`${device.device_name || 'Device'} archived`, 'success');
  }, [selectedDevice]);

  const handleAddDevice = async () => {
    try {
      await addDevice(addForm.key.replace(/\s/g, ''), addForm.password);
      setShowAddModal(false);
      setAddForm({ key: '', password: '' });
      notify('Device added successfully', 'success');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to add device', 'error');
    }
  };

  return (
    <DashboardLayout title="My Devices">
      <SnowDevices
        devices={visibleDevices}
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
        onRefresh={fetchDevices}
        isLoading={isLoading}
        passwordUpdateKeys={[]}
        activeSessionKeys={activeSessionKeys}
      />

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] w-full max-w-md p-8 shadow-2xl border border-[rgba(26,29,33,0.08)]">
            <h2 className="text-xl font-semibold text-[#111315] mb-2">Add a device</h2>
            <p className="text-sm text-[rgba(26,29,33,0.5)] mb-8">Enter the 9-digit Remote365 ID from the device you want to connect.</p>

            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold text-[rgba(26,29,33,0.4)] uppercase tracking-wide">Remote365 ID</label>
                <input
                  autoFocus
                  placeholder="123 456 789"
                  value={addForm.key}
                  onChange={e => setAddForm({ ...addForm, key: e.target.value })}
                  className="w-full bg-[#F3F4F6] border border-[rgba(26,29,33,0.08)] rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:border-[#FF8A00] outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold text-[rgba(26,29,33,0.4)] uppercase tracking-wide">Password (optional)</label>
                <input
                  type="password"
                  placeholder="Enter if set on the device"
                  value={addForm.password}
                  onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full bg-[#F3F4F6] border border-[rgba(26,29,33,0.08)] rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:border-[#FF8A00] outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-lg text-sm font-medium text-[rgba(26,29,33,0.6)] bg-white border border-[rgba(26,29,33,0.15)] hover:bg-[#F3F4F6] transition-all">
                  Cancel
                </button>
                <button onClick={handleAddDevice} className="flex-1 py-3 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}>
                  Add device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename / Remove modal (assign-group is rendered inside SnowDevices) */}
      {actionModal && actionModal.type !== 'assign-group' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] w-full max-w-sm p-8 shadow-2xl border border-[rgba(26,29,33,0.08)]">
            <h2 className="text-xl font-semibold text-[#111315] mb-2">
              {actionModal.type === 'rename' ? 'Rename device' : 'Delete device'}
            </h2>
            <p className="text-sm text-[rgba(26,29,33,0.5)] mb-6">
              {actionModal.type === 'rename'
                ? 'Set a nickname for this device.'
                : `Remove ${actionModal.device.device_name} from your account? This can't be undone.`}
            </p>

            {actionModal.type === 'rename' ? (
              <div className="space-y-6">
                <input
                  defaultValue={actionModal.device.device_name}
                  id="rename-input"
                  placeholder="e.g. Office Laptop"
                  className="w-full bg-[#F3F4F6] border border-[rgba(26,29,33,0.08)] rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:border-[#FF8A00] outline-none transition-all"
                />
                <div className="flex gap-3">
                  <button onClick={() => setActionModal(null)} className="flex-1 py-3 border border-[rgba(26,29,33,0.15)] rounded-lg text-sm font-medium text-[rgba(26,29,33,0.6)]">Cancel</button>
                  <button
                    onClick={async () => {
                      const newName = (document.getElementById('rename-input') as HTMLInputElement).value;
                      await updateDeviceName(actionModal.device.id, newName);
                      setActionModal(null);
                      notify('Device renamed', 'success');
                    }}
                    className="flex-1 py-3 text-white rounded-lg text-sm font-medium"
                    style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setActionModal(null)} className="flex-1 py-3 border border-[rgba(26,29,33,0.15)] rounded-lg text-sm font-medium text-[rgba(26,29,33,0.6)]">Cancel</button>
                <button
                  onClick={async () => {
                    await removeDevice(actionModal.device.id);
                    setActionModal(null);
                    notify('Device removed', 'success');
                  }}
                  className="flex-1 py-3 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626]"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Devices;
