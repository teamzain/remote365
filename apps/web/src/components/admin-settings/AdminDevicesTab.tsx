import React, { useEffect, useState } from 'react';
import { Loader2, Monitor, Smartphone, Trash2, Check, X, Pencil, RefreshCw, Search } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getDeviceAccessKey, getHiddenDeviceKeys } from '../../lib/hiddenDevices';

/**
 * Admin settings → Device Management → Devices. Org-wide device list backed by
 * GET /api/devices/all, with rename (PATCH /:id/name) and remove
 * (DELETE /:id). Online/session status is derived live on the server from
 * Redis presence, so this reflects real state.
 */

const statusPill = (online: boolean, inSession: boolean) => {
  if (inSession) return { label: 'In session', style: { background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' } };
  if (online) return { label: 'Online', style: { background: '#ECFDF3', color: '#34C759' } };
  return { label: 'Offline', style: { background: 'rgba(17,19,21,0.06)', color: '#757575' } };
};

export const AdminDevicesTab: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/devices/all');
      setDevices(Array.isArray(data) ? data : (data?.devices || []));
    } catch (err: any) {
      setError(err?.response?.status === 403 ? 'You do not have permission to view organization devices.' : 'Could not load devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Names identify a machine in every picker, so they must stay unique across
  // the org — the server enforces the same rule and 409s on a collision.
  const findDuplicateName = (name: string, exceptId: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return undefined;
    return devices.find((d) => d.id !== exceptId && String(d.device_name || '').trim().toLowerCase() === normalized);
  };

  const saveRename = async (id: string) => {
    const name = editName.trim();
    if (!name) { setEditingId(null); setRenameError(''); return; }
    const duplicate = findDuplicateName(name, id);
    if (duplicate) {
      setRenameError(`Another device is already named "${duplicate.device_name}"`);
      return;
    }
    setBusyId(id);
    setRenameError('');
    try {
      await api.patch(`/api/devices/${id}/name`, { device_name: name });
      setDevices((prev) => prev.map((d) => d.id === id ? { ...d, device_name: name } : d));
      // Push the rename to the live devices list (App.tsx listens for this).
      window.dispatchEvent(new CustomEvent('remote365:device-renamed', { detail: { id, name } }));
      setEditingId(null);
    } catch (err: any) {
      console.error('[AdminDevices] rename failed', err);
      setRenameError(err?.response?.data?.error || 'Could not rename this device');
    } finally {
      setBusyId(null);
    }
  };

  const removeDevice = async (id: string) => {
    setBusyId(id);
    try {
      await api.delete(`/api/devices/${id}`);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      // Drop it from the live devices list too (App.tsx listens for this).
      window.dispatchEvent(new CustomEvent('remote365:device-removed', { detail: { id } }));
      setConfirmRemove(null);
    } catch (err) {
      console.error('[AdminDevices] remove failed', err);
    } finally {
      setBusyId(null);
    }
  };

  // Locally-archived devices stay hidden here too (same source as the main Devices page).
  const hiddenKeys = getHiddenDeviceKeys(user?.id);
  const filtered = devices.filter((d) => {
    if (hiddenKeys.has(getDeviceAccessKey(d))) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [d.device_name, d.access_key, d.org_name].some((v: any) => String(v || '').toLowerCase().includes(q));
  });

  return (
    <div className="w-full px-8 py-8 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-white">Devices</h1>
          <p className="m-0 mt-1 text-[14px] leading-5 text-[#757575] dark:text-[#A0A0A0]">Every device in your organization. Rename or remove them here.</p>
        </div>
        <button type="button" onClick={load} className="flex h-10 items-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium text-[#111315] transition-colors hover:border-[#FF8A00] hover:text-[#FF8A00] dark:border-white/10 dark:text-[#F5F5F5]">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="mb-8 flex h-10 items-center gap-2 rounded border border-[rgba(26,29,33,0.3)] px-4 dark:border-white/10">
        <Search size={16} className="text-[rgba(17,19,21,0.3)]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID, or organization" className="h-full flex-1 bg-transparent text-[14px] text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] dark:text-white" />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-[#FF8A00]"><Loader2 className="animate-spin" size={28} /></div>
      ) : error ? (
        <div className="flex h-40 items-center justify-center text-center text-[14px] text-[#757575]">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-center text-[14px] text-[#757575]">No devices found.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[rgba(26,29,33,0.3)] bg-white dark:border-white/10">
          <table className="mobile-cards w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F3F4F6] dark:bg-white/5">
                <th className="px-6 py-3 text-[12px] font-medium text-[#111315]">Device</th>
                <th className="hidden px-6 py-3 text-[12px] font-medium text-[#111315] md:table-cell">ID</th>
                <th className="px-6 py-3 text-center text-[12px] font-medium text-[#111315]">Status</th>
                <th className="hidden px-6 py-3 text-[12px] font-medium text-[#111315] md:table-cell">Tags</th>
                <th className="w-[118px] px-6 py-3 text-center text-[12px] font-medium text-[#111315]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const isMobile = ['ios', 'android'].includes(String(d.device_type || '').toLowerCase());
                const st = statusPill(!!d.is_online, !!d.in_session);
                return (
                  <tr key={d.id} className="border-t border-[rgba(26,29,33,0.12)] transition-colors hover:bg-[#FBFBFC] dark:border-white/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[#7F56D9]">
                          {isMobile ? <Smartphone size={18} /> : <Monitor size={18} />}
                        </div>
                        {editingId === d.id ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <input autoFocus value={editName} onChange={(e) => { setEditName(e.target.value); setRenameError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') saveRename(d.id); if (e.key === 'Escape') { setEditingId(null); setRenameError(''); } }} className={`h-8 w-40 rounded border px-2 text-[13px] outline-none dark:bg-[#141414] dark:text-white ${renameError ? 'border-[#D92D20]' : 'border-[#FF8A00]'}`} />
                              <button type="button" onClick={() => saveRename(d.id)} className="p-1 text-[#34C759]"><Check size={16} /></button>
                              <button type="button" onClick={() => { setEditingId(null); setRenameError(''); }} className="p-1 text-[#757575]"><X size={16} /></button>
                            </div>
                            {renameError && <p className="mt-1 max-w-[220px] text-[11px] font-medium text-[#D92D20]">{renameError}</p>}
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-medium text-[#111315] dark:text-white">{d.device_name || 'Unnamed device'}{d.is_owned && <span className="ml-2 text-[10px] font-semibold uppercase text-[#FF8A00]">Owned</span>}</div>
                            {d.org_name && <div className="truncate text-[14px] text-[rgba(17,19,21,0.6)]">{d.org_name}</div>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 font-mono text-[12px] text-[rgba(17,19,21,0.6)] md:table-cell">{d.access_key}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium" style={st.style}>{st.label}</span>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(d.tags || []).slice(0, 3).map((tag: string) => (
                          <span key={tag} className="rounded-full bg-[rgba(14,165,233,0.1)] px-2 py-0.5 text-[10px] text-[#0EA5E9]">#{tag}</span>
                        ))}
                        {(!d.tags || d.tags.length === 0) && <span className="text-[12px] text-[rgba(17,19,21,0.3)]">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={() => { setEditingId(d.id); setEditName(d.device_name || ''); setRenameError(''); }} disabled={busyId === d.id} className="text-[rgba(17,19,21,0.7)] transition-colors hover:text-[#111315]" title="Rename"><Pencil size={18} /></button>
                        <button type="button" onClick={() => setConfirmRemove(d)} disabled={busyId === d.id} className="text-[rgba(17,19,21,0.7)] transition-colors hover:text-[#D92D20]" title="Remove">{busyId === d.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#161616]">
            <h3 className="m-0 text-[16px] font-bold text-[#1C1C1C] dark:text-white">Remove device?</h3>
            <p className="m-0 mt-2 text-[13px] text-[#757575] dark:text-[#A0A0A0]">"{confirmRemove.device_name || 'This device'}" will be removed from your organization. It can re-register later.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmRemove(null)} className="h-9 rounded-lg border border-[rgba(28,28,28,0.1)] px-4 text-[13px] font-medium text-[#1C1C1C] hover:bg-[#F9FAFB] dark:border-white/10 dark:text-white">Cancel</button>
              <button type="button" onClick={() => removeDevice(confirmRemove.id)} className="h-9 rounded-lg bg-[#D92D20] px-4 text-[13px] font-semibold text-white hover:bg-[#B42318]">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDevicesTab;
