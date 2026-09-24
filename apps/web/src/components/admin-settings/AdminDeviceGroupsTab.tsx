import React, { useEffect, useState, useCallback } from 'react';
import { Pencil, Plus, Trash2, X, Loader2 } from 'lucide-react';
import api from '../../lib/api';

/**
 * Admin settings → Device groups. Manages the SAME account device groups the
 * main Devices page uses (`/api/devices/user-groups`), so grouping stays in
 * sync between both places. Changes broadcast `remote365:device-groups-changed`
 * (and the tab reloads on it) so the Devices page and this tab mirror instantly.
 */

const GROUPS_CHANGED_EVENT = 'remote365:device-groups-changed';

interface Group { id: string; name: string; color?: string | null; deviceIds?: string[]; deviceCount?: number; }
interface DeviceRow { id: string; device_name?: string; name?: string; device_groups?: Array<{ id: string }>; }

export const AdminDeviceGroupsTab: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [groupsRes, devicesRes] = await Promise.all([
        api.get('/api/devices/user-groups'),
        api.get('/api/devices/mine'),
      ]);
      setGroups(groupsRes.data?.groups || []);
      setDevices(Array.isArray(devicesRes.data) ? devicesRes.data : (devicesRes.data?.devices || []));
    } catch (err) {
      console.error('[AdminGroups] Failed to load device groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Mirror group changes made on the Devices page (or elsewhere) instantly.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener(GROUPS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handler);
  }, [load]);

  const notifyChanged = () => window.dispatchEvent(new CustomEvent(GROUPS_CHANGED_EVENT));

  const openCreate = () => {
    setEditing({ id: '', name: '' });
    setName(''); setColor('#2563eb'); setDeviceIds([]); setError(null);
  };

  const openEdit = (group: Group) => {
    setEditing(group);
    setName(group.name);
    setColor(group.color || '#2563eb');
    // Which devices currently belong to this group.
    const ids = devices.filter((d) => (d.device_groups || []).some((g) => g.id === group.id)).map((d) => d.id);
    setDeviceIds(ids);
    setError(null);
  };

  const toggleDevice = (id: string) => {
    setDeviceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // Apply device membership by patching each device whose membership changed.
  const applyDeviceMembership = async (groupId: string, selected: string[]) => {
    await Promise.all(devices.map((d) => {
      const current = (d.device_groups || []).map((g) => g.id);
      const inGroup = current.includes(groupId);
      const shouldBeIn = selected.includes(d.id);
      if (inGroup === shouldBeIn) return null; // no change for this device
      const next = shouldBeIn ? [...current, groupId] : current.filter((g) => g !== groupId);
      return api.patch(`/api/devices/${d.id}/user-groups`, { groupIds: next });
    }).filter(Boolean) as Promise<any>[]);
  };

  // Group names must stay unique (case-insensitively) across the org — two
  // "Sales" groups are indistinguishable everywhere they are listed.
  const findDuplicateGroup = (candidate: string, exceptId?: string) => {
    const normalized = candidate.trim().replace(/^#/, '').toLowerCase();
    if (!normalized) return undefined;
    return groups.find((group) => group.id !== exceptId && group.name.replace(/^#/, '').toLowerCase() === normalized);
  };

  const duplicateName = editing ? findDuplicateGroup(name, editing.id || undefined) : undefined;

  const saveGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const cleanName = name.trim();
    if (!cleanName) { setError('Group name is required'); return; }
    const duplicate = findDuplicateGroup(cleanName, editing.id || undefined);
    if (duplicate) { setError(`A group named "${duplicate.name.replace(/^#/, '')}" already exists`); return; }
    setSaving(true);
    setError(null);
    try {
      let groupId = editing.id;
      if (groupId) {
        await api.patch(`/api/devices/user-groups/${groupId}`, { name: cleanName, color });
      } else {
        const { data } = await api.post('/api/devices/user-groups', { name: cleanName, color });
        groupId = data?.group?.id;
      }
      if (groupId) await applyDeviceMembership(groupId, deviceIds);
      setEditing(null);
      await load();
      notifyChanged();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save group');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/devices/user-groups/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
      notifyChanged();
    } catch {
      setError('Could not delete group');
    }
  };

  const deviceLabel = (d: DeviceRow) => d.device_name || d.name || 'Unnamed device';
  const countFor = (group: Group) => devices.filter((d) => (d.device_groups || []).some((g) => g.id === group.id)).length;

  return (
    <div className="w-full px-8 py-8 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5] animate-in fade-in duration-300">
      <div className="mb-8 flex items-center justify-between gap-6">
        <div>
          <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">Device groups</h1>
          <p className="m-0 mt-1 text-[14px] leading-5 text-[#757575] dark:text-[#A0A0A0]">Organize your devices into groups. These are the same groups shown on the Devices page.</p>
        </div>
        <button onClick={openCreate} style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }} className="flex h-10 shrink-0 items-center gap-2 rounded px-4 text-[14px] font-medium text-white transition-all hover:brightness-[1.03]">
          <Plus size={16} /> New group
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-[#FF8A00]"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[rgba(26,29,33,0.3)] bg-white dark:border-white/10 dark:bg-[#161616]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F3F4F6] dark:bg-white/5">
                <th className="px-6 py-3 text-[12px] font-medium text-[#111315]">Group Name</th>
                <th className="px-6 py-3 text-center text-[12px] font-medium text-[#111315]">Devices</th>
                <th className="w-[118px] px-6 py-3 text-center text-[12px] font-medium text-[#111315]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="group border-t border-[rgba(26,29,33,0.12)] transition-colors hover:bg-[#FBFBFC] dark:border-white/5">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: group.color || '#94a3b8' }} />
                      <span className="text-[14px] font-medium text-[#111315] dark:text-white">{group.name.replace(/^#/, '')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center rounded-full bg-[#EFF8FF] px-2 py-1 text-[10px] font-medium text-[#175CD3]">{countFor(group)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => openEdit(group)} className="text-[rgba(17,19,21,0.7)] transition-colors hover:text-[#111315] dark:text-white/70 dark:hover:text-white" title="Edit"><Pencil size={18} /></button>
                      <button onClick={() => setDeleteTarget(group)} className="text-[rgba(17,19,21,0.7)] transition-colors hover:text-[#D92D20]" title="Delete"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {groups.length === 0 && <div className="py-16 text-center text-[13px] text-[#757575] dark:text-[#A0A0A0]">No device groups yet.</div>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={saveGroup} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-white p-8 shadow-2xl dark:bg-[#111]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#1C1C1C] dark:text-white">{editing.id ? 'Edit group' : 'New group'}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-[#999] hover:text-[#1C1C1C] dark:hover:text-white"><X size={22} /></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#999]">Name</label>
                <input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={50} required className={`w-full rounded-xl border bg-[#F9F9FA] px-4 py-3 text-sm outline-none dark:bg-[#080808] dark:text-white ${duplicateName ? 'border-red-400 focus:border-red-500' : 'border-black/10 focus:border-[#1C1C1C] dark:border-white/10'}`} />
                {duplicateName && <p className="mt-2 text-xs font-bold text-red-600">A group named “{duplicateName.name.replace(/^#/, '')}” already exists.</p>}
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#999]">Color</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded-lg border border-black/10 bg-white p-1" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#999]">Devices in this group</label>
                <div className="max-h-48 divide-y divide-black/5 overflow-y-auto rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
                  {devices.length === 0 && <div className="px-4 py-6 text-center text-xs text-[#999]">No devices yet.</div>}
                  {devices.map((device) => (
                    <label key={device.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#FAFAFB] dark:hover:bg-white/5">
                      <input type="checkbox" checked={deviceIds.includes(device.id)} onChange={() => toggleDevice(device.id)} className="accent-[#FF8A00]" />
                      <span className="text-xs font-semibold text-[#1C1C1C] dark:text-white">{deviceLabel(device)}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600">{error}</div>}
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-[#F5F5F5] py-3 text-sm font-bold dark:bg-white/10 dark:text-white">Cancel</button>
              <button type="submit" disabled={saving || Boolean(duplicateName)} style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-[1.03] disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />} Save group
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-[#111]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Trash2 size={28} /></div>
            <h3 className="mb-2 text-lg font-bold text-[#1C1C1C] dark:text-white">Delete “{deleteTarget.name.replace(/^#/, '')}”?</h3>
            <p className="mb-7 text-sm text-[#757575] dark:text-[#A0A0A0]">This removes the group. The devices in it stay and just become ungrouped.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl bg-[#F5F5F5] py-3 text-sm font-bold dark:bg-white/10 dark:text-white">Cancel</button>
              <button onClick={deleteGroup} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeviceGroupsTab;
