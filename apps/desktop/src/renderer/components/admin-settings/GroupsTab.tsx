import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import api from '../../lib/api';

type GroupRecord = {
  id: string;
  name: string;
  color?: string | null;
  createdAt: string;
  devices?: Array<{ id: string; name?: string | null; accessKey?: string }>;
  members?: Array<{ id: string; name?: string | null; email: string }>;
  _count?: { devices: number; members: number };
};

export const GroupsTab = () => {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GroupRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupRecord | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [groupsRes, devicesRes, membersRes] = await Promise.all([
        api.get('/api/groups'),
        api.get('/api/devices/mine'),
        api.get('/api/members')
      ]);
      setGroups(groupsRes.data.groups || []);
      setDevices(devicesRes.data || []);
      setMembers(membersRes.data.members || []);
    } catch (err) {
      console.error('Failed to load groups tab:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing({ id: '', name: '', color: '#2563eb', createdAt: new Date().toISOString() });
    setName('');
    setColor('#2563eb');
    setDeviceIds([]);
    setMemberIds([]);
    setError(null);
  };

  const openEdit = (group: GroupRecord) => {
    setEditing(group);
    setName(group.name);
    setColor(group.color || '#2563eb');
    setDeviceIds((group.devices || []).map(device => device.id));
    setMemberIds((group.members || []).map(member => member.id));
    setError(null);
  };

  const toggle = (id: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  };

  const saveGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    const payload = { name: name.trim(), color: color || null, deviceIds, memberIds };
    try {
      if (editing.id) await api.patch(`/api/groups/${editing.id}`, payload);
      else await api.post('/api/groups', payload);
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could Not Save Group');
    }
  };

  const deleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/groups/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } catch {
      alert('Could Not Delete Group');
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 text-[#111315] dark:text-[#F5F5F5]">
      <div className="mb-12 flex items-start justify-between gap-6">
        <div>
          <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">Device Groups</h1>
          <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Group devices and assign access to members.</p>
        </div>
        <button onClick={openCreate} className="flex h-10 items-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:border-white/10 dark:bg-transparent dark:text-[#F5F5F5] dark:hover:bg-white/5">
          <Plus size={16} /> New Group
        </button>
      </div>

      <div className="overflow-hidden rounded border border-[rgba(26,29,33,0.3)] bg-white dark:border-white/10 dark:bg-[#111]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[rgba(26,29,33,0.12)] bg-[#F3F4F6] dark:border-white/10 dark:bg-white/5">
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">Name</th>
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">Color</th>
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">Devices</th>
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">Members</th>
              <th className="px-5 py-4 text-[12px] font-bold text-[#757575] dark:text-[#A0A0A0]">Created</th>
              <th className="px-5 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(26,29,33,0.08)] dark:divide-white/10">
            {groups.map(group => (
              <tr key={group.id} className="group hover:bg-[#F9FAFB] dark:hover:bg-white/5">
                <td className="px-5 py-4 text-[13px] font-bold text-[#1C1C1C] dark:text-white">{group.name}</td>
                <td className="px-5 py-4"><span className="block h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: group.color || '#94a3b8' }} /></td>
                <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{group._count?.devices ?? group.devices?.length ?? 0}</td>
                <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{group._count?.members ?? group.members?.length ?? 0}</td>
                <td className="px-5 py-4 text-[13px] text-[#757575] dark:text-[#A0A0A0]">{new Date(group.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => openEdit(group)} className="p-2 text-[#757575] hover:text-[#1C1C1C] dark:hover:text-white"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteTarget(group)} className="p-2 text-[#757575] hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && groups.length === 0 && (
          <div className="py-16 text-center text-[13px] text-[#757575] dark:text-[#A0A0A0]">No device groups yet.</div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={saveGroup} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-white p-8 shadow-2xl dark:bg-[#111]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#1C1C1C] dark:text-white">{editing.id ? 'Edit Group' : 'New Group'}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-[#999] hover:text-[#1C1C1C] dark:hover:text-white"><X size={22} /></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#999]">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={50} required className="w-full rounded-xl border border-black/10 bg-[#F9F9FA] px-4 py-3 text-sm outline-none focus:border-[#1C1C1C] dark:border-white/10 dark:bg-[#080808] dark:text-white" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#999]">Color</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-16 rounded-lg border border-black/10 bg-white p-1" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#999]">Devices</label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-black/10 divide-y divide-black/5 dark:border-white/10 dark:divide-white/10">
                  {devices.map(device => (
                    <label key={device.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#FAFAFB] dark:hover:bg-white/5">
                      <input type="checkbox" checked={deviceIds.includes(device.id)} onChange={() => toggle(device.id, deviceIds, setDeviceIds)} className="accent-[#1C1C1C]" />
                      <span className="text-xs font-semibold text-[#1C1C1C] dark:text-white">{device.device_name || device.name || 'Unnamed Device'}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#999]">Members</label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-black/10 divide-y divide-black/5 dark:border-white/10 dark:divide-white/10">
                  {members.map(member => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#FAFAFB] dark:hover:bg-white/5">
                      <input type="checkbox" checked={memberIds.includes(member.id)} onChange={() => toggle(member.id, memberIds, setMemberIds)} className="accent-[#1C1C1C]" />
                      <span className="text-xs font-semibold text-[#1C1C1C] dark:text-white">{member.name || member.email}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600">{error}</div>}
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-[#F5F5F5] py-3 text-sm font-bold dark:bg-white/10 dark:text-white">Cancel</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#1C1C1C] py-3 text-sm font-bold text-white dark:bg-white dark:text-[#1C1C1C]">Save Group</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-[#111]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Trash2 size={28} /></div>
            <h3 className="mb-2 text-lg font-bold text-[#1C1C1C] dark:text-white">Delete Group?</h3>
            <p className="mb-7 text-sm text-[#757575] dark:text-[#A0A0A0]">This will remove the group but not the devices or members it contains. Continue?</p>
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
