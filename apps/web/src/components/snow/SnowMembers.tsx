import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Monitor,
  Pencil,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { hasUserPermission } from '../../lib/permissions';

type AccessType = 'none' | 'full' | 'groups' | 'specific';

const PLAN_MEMBER_LIMITS: Record<string, number> = {
  TRIAL: 1,
  SOLO: 2,
  PRO: 5,
  BUSINESS: 25,
  ENTERPRISE: Infinity
};

const PLAN_ROLE_OPTIONS: Record<string, string[]> = {
  TRIAL: ['VIEWER'],
  SOLO: ['ADMIN', 'VIEWER'],
  PRO: ['ADMIN', 'VIEWER'],
  BUSINESS: ['OWNER', 'ADMIN', 'VIEWER'],
  ENTERPRISE: ['OWNER', 'ADMIN', 'VIEWER']
};

const ASSIGNABLE_ROLES_BY_ACTOR: Record<string, string[]> = {
  SUPER_ADMIN: ['ADMIN', 'VIEWER'],
  OWNER: ['ADMIN', 'VIEWER'],
  ADMIN: ['VIEWER'],
  VIEWER: ['VIEWER'],
};

interface DeviceGroup {
  id: string;
  name: string;
  color?: string | null;
}

interface Member {
  id: string;
  email: string;
  name?: string;
  role: string;
  allowedDeviceIds?: string[];
  allowedGroups?: DeviceGroup[];
  allowedTags?: string[];
  department?: { name: string };
  createdAt: string;
}

interface OrgDevice {
  id: string;
  device_name: string;
  access_key: string;
  device_type: string;
  is_online: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
}

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'VIEWER', label: 'Viewer' }
];

const accessOptions: Array<{ value: AccessType; label: string; help: string }> = [
  { value: 'none', label: 'None', help: 'This user will not see devices.' },
  { value: 'full', label: 'All devices', help: 'This user can see every device in the organization.' },
  { value: 'groups', label: 'Specific groups', help: 'This user can see devices inside selected groups.' },
  { value: 'specific', label: 'Specific devices', help: 'This user can see only selected devices.' }
];

const getPlanLimit = (plan?: string) => PLAN_MEMBER_LIMITS[String(plan || 'TRIAL').toUpperCase()] ?? PLAN_MEMBER_LIMITS.TRIAL;
const getPlanRoleOptions = (plan?: string, actorRole?: string) => {
  const allowed = PLAN_ROLE_OPTIONS[String(plan || 'TRIAL').toUpperCase()] || PLAN_ROLE_OPTIONS.TRIAL;
  const assignable = ASSIGNABLE_ROLES_BY_ACTOR[String(actorRole || '').toUpperCase()] || [];
  return roleOptions.filter((role) => allowed.includes(role.value) && assignable.includes(role.value));
};

export const SnowMembers: React.FC = () => {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [orgDevices, setOrgDevices] = useState<OrgDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [inviteAccessType, setInviteAccessType] = useState<AccessType>('none');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');

  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState('VIEWER');
  const [editAccessType, setEditAccessType] = useState<AccessType>('none');
  const [editDeviceIds, setEditDeviceIds] = useState<string[]>([]);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editDeviceSearch, setEditDeviceSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'member' | 'invitation'; email: string } | null>(null);

  const memberLimit = getPlanLimit(user?.plan);
  // Effective per-user permissions (owner grants/revokes included) — what the
  // page offers always matches what the backend will accept. Same rules as
  // the desktop Members page.
  const canInviteMembers = hasUserPermission(user, 'members:invite');
  const canEditMembers = hasUserPermission(user, 'members:edit');
  const canRemoveMembers = hasUserPermission(user, 'members:remove');
  const actorCeiling = ASSIGNABLE_ROLES_BY_ACTOR[String(user?.role || '').toUpperCase()] || ['VIEWER'];
  const availableRoleOptions = useMemo(() => getPlanRoleOptions(user?.plan, user?.role), [user?.plan, user?.role]);
  const memberUsage = members.length + invitations.length;
  const inviteDisabled = memberUsage >= memberLimit;
  const inviteDisabledText = Number.isFinite(memberLimit)
    ? `Your ${user?.plan || 'TRIAL'} plan allows ${memberLimit} team member${memberLimit === 1 ? '' : 's'}.`
    : '';

  useEffect(() => {
    if (!user) return;
    fetchTeamData();
    fetchOrgDevices();
    fetchGroups();
  }, [user]);

  useEffect(() => {
    if (availableRoleOptions.length === 0) return;
    if (!availableRoleOptions.some((role) => role.value === inviteRole)) {
      setInviteRole(availableRoleOptions[0].value);
    }
    if (!availableRoleOptions.some((role) => role.value === editRole)) {
      setEditRole(availableRoleOptions[0].value);
    }
  }, [availableRoleOptions, editRole, inviteRole]);

  useEffect(() => {
    const handleRefresh = () => fetchTeamData();
    window.addEventListener('team-refresh', handleRefresh);
    return () => window.removeEventListener('team-refresh', handleRefresh);
  }, []);

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/members');
      setMembers(data.members || []);
      setInvitations(data.pendingInvites || []);
    } catch (err) {
      console.error('Failed to fetch team data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgDevices = async () => {
    try {
      const { data } = await api.get('/api/devices/mine');
      setOrgDevices(data || []);
    } catch (err) {
      console.error('Failed to fetch org devices:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/api/groups');
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Failed to fetch device groups:', err);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteRole(availableRoleOptions[0]?.value || 'TECHNICIAN');
    setInviteAccessType('none');
    setSelectedDeviceIds([]);
    setSelectedGroupIds([]);
    setDeviceSearch('');
    setInviteError(null);
  };

  const accessPayload = (accessType: AccessType, deviceIds: string[], groupIds: string[]) => ({
    accessType,
    deviceIds: accessType === 'specific' ? deviceIds : [],
    groupIds: accessType === 'groups' ? groupIds : []
  });

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    try {
      await api.post('/api/members/invite', {
        email: inviteEmail,
        role: inviteRole,
        ...accessPayload(inviteAccessType, selectedDeviceIds, selectedGroupIds)
      });
      setShowInviteModal(false);
      resetInviteForm();
      fetchTeamData();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to send invitation');
    }
  };

  const selectInviteRole = (role: string) => {
    setInviteRole(role);
    if (role === 'ADMIN') setInviteAccessType('full');
  };

  const selectEditRole = (role: string) => {
    setEditRole(role);
    if (role === 'ADMIN') setEditAccessType('full');
  };

  const openEditAccess = (member: Member) => {
    const ids = member.allowedDeviceIds || [];
    const groupIds = (member.allowedGroups || []).map((group) => group.id);
    setEditTarget(member);
    setEditRole(availableRoleOptions.some((role) => role.value === member.role) ? member.role : (availableRoleOptions[0]?.value || 'VIEWER'));
    setEditDeviceIds(ids.filter((id) => id !== '__all__'));
    setEditGroupIds(groupIds);
    setEditDeviceSearch('');

    if (ids.includes('__all__')) setEditAccessType('full');
    else if (groupIds.length > 0) setEditAccessType('groups');
    else if (ids.length > 0) setEditAccessType('specific');
    else setEditAccessType('none');
  };

  const handleSaveAccess = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await api.patch(`/api/members/${editTarget.id}/access`, {
        role: editRole,
        ...accessPayload(editAccessType, editDeviceIds, editGroupIds)
      });
      setEditTarget(null);
      fetchTeamData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update access');
    } finally {
      setEditSaving(false);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/api/members/${userId}`);
      fetchTeamData();
      setDeleteTarget(null);
    } catch {
      alert('Failed to remove member');
    }
  };

  const removeInvitation = async (invitationId: string) => {
    try {
      await api.delete(`/api/members/invitation/${invitationId}`);
      fetchTeamData();
      setDeleteTarget(null);
    } catch {
      alert('Failed to cancel invitation');
    }
  };

  const toggleDevice = (deviceId: string, editing = false) => {
    const setter = editing ? setEditDeviceIds : setSelectedDeviceIds;
    setter((prev) => (prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]));
  };

  const toggleGroup = (groupId: string, editing = false) => {
    const setter = editing ? setEditGroupIds : setSelectedGroupIds;
    setter((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  const filteredDevices = useMemo(
    () => orgDevices.filter((device) => !deviceSearch || device.device_name?.toLowerCase().includes(deviceSearch.toLowerCase()) || device.access_key?.includes(deviceSearch)),
    [deviceSearch, orgDevices]
  );
  const filteredEditDevices = useMemo(
    () => orgDevices.filter((device) => !editDeviceSearch || device.device_name?.toLowerCase().includes(editDeviceSearch.toLowerCase()) || device.access_key?.includes(editDeviceSearch)),
    [editDeviceSearch, orgDevices]
  );

  const accessLabel = (member: Member) => {
    if (member.allowedDeviceIds?.includes('__all__')) return <span className="text-xs text-emerald-600 font-semibold">All devices</span>;
    if (member.allowedGroups?.length) {
      return <span className="text-xs text-blue-600 font-semibold">{member.allowedGroups.length} group{member.allowedGroups.length !== 1 ? 's' : ''}</span>;
    }
    if (member.allowedDeviceIds?.length) {
      return <span className="flex items-center gap-1.5 text-xs font-semibold text-[#D4A017]"><Monitor size={13} />{member.allowedDeviceIds.length} device{member.allowedDeviceIds.length !== 1 ? 's' : ''}</span>;
    }
    return <span className="text-xs text-red-500 font-semibold">No access</span>;
  };

  const AccessPicker = ({
    accessType,
    setAccessType,
    groupIds,
    onGroupToggle,
    deviceIds,
    onDeviceToggle,
    search,
    setSearch,
    devices
  }: {
    accessType: AccessType;
    setAccessType: (value: AccessType) => void;
    groupIds: string[];
    onGroupToggle: (id: string) => void;
    deviceIds: string[];
    onDeviceToggle: (id: string) => void;
    search: string;
    setSearch: (value: string) => void;
    devices: OrgDevice[];
  }) => (
    <div>
      <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Access type</label>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {accessOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setAccessType(option.value)}
            className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold transition-all ${accessType === option.value ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-white text-[rgba(28,28,28,0.5)] border-[rgba(28,28,28,0.1)] hover:border-[rgba(28,28,28,0.3)]'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className={`text-[10px] font-medium px-1 mb-3 ${accessType === 'none' ? 'text-red-500' : accessType === 'full' ? 'text-emerald-600' : 'text-blue-600'}`}>
        {accessOptions.find((option) => option.value === accessType)?.help}
      </p>

      {accessType === 'groups' && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-[rgba(28,28,28,0.06)] bg-[#F9F9FA] p-3">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onGroupToggle(group.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${groupIds.includes(group.id) ? 'bg-white border-[#1C1C1C] text-[#1C1C1C]' : 'bg-transparent border-transparent text-[rgba(28,28,28,0.55)] hover:bg-white'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color || '#94a3b8' }} />
              {group.name}
            </button>
          ))}
          {groups.length === 0 && <span className="text-[10px] text-[rgba(28,28,28,0.35)]">No groups yet. Create one in Device groups.</span>}
        </div>
      )}

      {accessType === 'specific' && (
        <>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search devices..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl text-xs focus:border-[#1C1C1C] outline-none transition-all font-lato"
            />
          </div>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-[rgba(28,28,28,0.06)] bg-[#F9F9FA] divide-y divide-[rgba(28,28,28,0.04)]">
            {devices.map((device) => (
              <label key={device.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white transition-colors">
                <input type="checkbox" checked={deviceIds.includes(device.id)} onChange={() => onDeviceToggle(device.id)} className="w-4 h-4 accent-[#1C1C1C] rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#1C1C1C] truncate">{device.device_name || 'Unnamed Device'}</div>
                  <div className="text-[10px] text-[rgba(28,28,28,0.4)]">{device.access_key}</div>
                </div>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </label>
            ))}
            {devices.length === 0 && <div className="py-6 text-center text-[10px] text-[rgba(28,28,28,0.3)]">No devices found</div>}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-lato">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Members</h1>
          <p className="text-sm text-[rgba(28,28,28,0.4)] mt-1">Manage organization members, roles, and device access.</p>
        </div>
        {canInviteMembers && (
        <div className="relative group">
          <button
            disabled={inviteDisabled}
            onClick={() => { resetInviteForm(); setShowInviteModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00193F] text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/10 hover:bg-[#002255] transition-all active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <UserPlus size={18} />
            Invite
          </button>
          {inviteDisabled && (
            <div className="absolute right-0 top-[calc(100%+8px)] hidden group-hover:block w-64 p-3 rounded-xl bg-[#1C1C1C] text-white text-[11px] font-semibold shadow-xl z-20">
              {inviteDisabledText}
            </div>
          )}
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] shadow-sm">
          <div className="flex items-center gap-3 mb-3"><Users size={18} className="text-[#D4A017]" /><span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Members</span></div>
          <p className="text-3xl font-bold text-[#1C1C1C]">{members.length}</p>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] shadow-sm">
          <div className="flex items-center gap-3 mb-3"><Clock size={18} className="text-amber-600" /><span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Pending</span></div>
          <p className="text-3xl font-bold text-[#1C1C1C]">{invitations.length}</p>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-[rgba(28,28,28,0.06)] shadow-sm">
          <div className="flex items-center gap-3 mb-3"><Shield size={18} className="text-emerald-600" /><span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Plan limit</span></div>
          <p className="text-3xl font-bold text-[#1C1C1C]">{memberUsage} / {Number.isFinite(memberLimit) ? memberLimit : '∞'}</p>
        </div>
      </div>

      <div className="bg-white rounded-[20px] border border-[rgba(28,28,28,0.06)] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#F9F9FA] border-b border-[rgba(28,28,28,0.04)]">
              <th className="px-6 py-4 text-[12px] font-semibold text-[rgba(28,28,28,0.45)]">User</th>
              <th className="px-6 py-4 text-[12px] font-semibold text-[rgba(28,28,28,0.45)]">Role</th>
              <th className="px-6 py-4 text-[12px] font-semibold text-[rgba(28,28,28,0.45)]">Access</th>
              <th className="px-6 py-4 text-[12px] font-semibold text-[rgba(28,28,28,0.45)]">Joined</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(28,28,28,0.04)]">
            {members.map((member) => {
              // Same ceiling as the backend: owners manage Admins & Viewers,
              // everyone else only Viewers; owner rows and yourself are off-limits.
              const isOwnerRow = String(member.role).toUpperCase() === 'OWNER';
              const isSelf = member.id === user?.id;
              const withinCeiling = actorCeiling.includes(String(member.role).toUpperCase());
              const canEditRow = canEditMembers && withinCeiling && !isOwnerRow && !isSelf;
              const canRemoveRow = canRemoveMembers && withinCeiling && !isOwnerRow && !isSelf;
              return (
              <tr key={member.id} className="hover:bg-[rgba(28,28,28,0.01)] transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-[#D4A017] font-bold text-sm">{member.name?.[0] || member.email[0].toUpperCase()}</div>
                    <div><div className="text-sm font-bold text-[#1C1C1C]">{member.name || 'Anonymous User'}</div><div className="text-xs text-[rgba(28,28,28,0.4)]">{member.email}</div></div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600">{member.role.replace('_', ' ')}</span></td>
                <td className="px-6 py-4">{accessLabel(member)}</td>
                <td className="px-6 py-4 text-xs text-[rgba(28,28,28,0.4)]">{new Date(member.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                    {canEditRow && <button onClick={() => openEditAccess(member)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#D4A017] transition-colors" title="Edit access"><Pencil size={15} /></button>}
                    {canRemoveRow && <button onClick={() => setDeleteTarget({ id: member.id, type: 'member', email: member.email })} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-red-600 transition-colors"><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
              );
            })}
            {invitations.map((invite) => (
              <tr key={invite.id} className="bg-amber-50/50 group">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Mail size={16} /></div><div><div className="text-sm font-bold text-[#1C1C1C] italic">Invitation Pending</div><div className="text-xs text-[rgba(28,28,28,0.4)]">{invite.email}</div></div></div></td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">{invite.role}</span></td>
                <td className="px-6 py-4 text-xs text-amber-600/60 italic font-medium">Waiting for join...</td>
                <td className="px-6 py-4 text-xs text-[rgba(28,28,28,0.4)]">---</td>
                <td className="px-6 py-4 text-right">{canInviteMembers && <button onClick={() => setDeleteTarget({ id: invite.id, type: 'invitation', email: invite.email })} className="p-2 text-amber-600/40 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && invitations.length === 0 && !loading && (
          <div className="py-20 flex flex-col items-center justify-center text-[rgba(28,28,28,0.4)] gap-2">
            <Users size={48} strokeWidth={1} />
            <span className="text-xs">No team members yet. Invite your first colleague.</span>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
            <h3 className="text-xl font-bold text-[#1C1C1C] mb-2">{deleteTarget.type === 'member' ? 'Remove Member?' : 'Cancel Invitation?'}</h3>
            <p className="text-sm text-[rgba(28,28,28,0.5)] mb-8 px-4 leading-relaxed">Are you sure you want to remove <strong>{deleteTarget.email}</strong>? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 bg-[#F9F9FA] text-[rgba(28,28,28,0.6)] rounded-xl font-bold text-sm hover:bg-[#F0F0F2] transition-colors">Cancel</button>
              <button onClick={() => deleteTarget.type === 'member' ? removeMember(deleteTarget.id) : removeInvitation(deleteTarget.id)} className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200">Delete</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><div><h2 className="text-xl font-bold text-[#1C1C1C]">Edit Access</h2><p className="text-xs text-[rgba(28,28,28,0.4)] mt-1">{editTarget.name || editTarget.email}</p></div><button onClick={() => setEditTarget(null)} className="text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C]"><X size={24} /></button></div>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Role</label>
                <div className="grid grid-cols-2 gap-2">{availableRoleOptions.map((role) => <button key={role.value} type="button" onClick={() => selectEditRole(role.value)} className={`px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${editRole === role.value ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-white text-[rgba(28,28,28,0.6)] border-[rgba(28,28,28,0.1)] hover:border-[rgba(28,28,28,0.3)]'}`}>{role.label}</button>)}</div>
              </div>
              <AccessPicker accessType={editAccessType} setAccessType={setEditAccessType} groupIds={editGroupIds} onGroupToggle={(id) => toggleGroup(id, true)} deviceIds={editDeviceIds} onDeviceToggle={(id) => toggleDevice(id, true)} search={editDeviceSearch} setSearch={setEditDeviceSearch} devices={filteredEditDevices} />
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setEditTarget(null)} className="flex-1 py-3.5 bg-[#F9F9FA] text-[rgba(28,28,28,0.6)] rounded-xl font-bold text-sm hover:bg-[#F0F0F2] transition-colors">Cancel</button><button onClick={handleSaveAccess} disabled={editSaving} className="flex-1 py-3.5 bg-[#1C1C1C] text-white rounded-xl font-bold text-sm hover:bg-[#2C2C2C] transition-all shadow-lg shadow-black/10 disabled:opacity-50">{editSaving ? 'Saving...' : 'Save Changes'}</button></div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-[#1C1C1C]">Invite Team Member</h2><button onClick={() => setShowInviteModal(false)} className="text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C]"><X size={24} /></button></div>
            <form onSubmit={handleSendInvite} className="space-y-5">
              <div><label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Email Address</label><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" className="w-full px-4 py-3 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl text-sm focus:border-[#1C1C1C] outline-none transition-all font-lato" required /></div>
              <div><label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Role</label><div className="grid grid-cols-2 gap-2">{availableRoleOptions.map((role) => <button key={role.value} type="button" onClick={() => selectInviteRole(role.value)} className={`px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${inviteRole === role.value ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-white text-[rgba(28,28,28,0.6)] border-[rgba(28,28,28,0.1)] hover:border-[rgba(28,28,28,0.3)]'}`}>{role.label}</button>)}</div></div>
              <AccessPicker accessType={inviteAccessType} setAccessType={setInviteAccessType} groupIds={selectedGroupIds} onGroupToggle={(id) => toggleGroup(id)} deviceIds={selectedDeviceIds} onDeviceToggle={(id) => toggleDevice(id)} search={deviceSearch} setSearch={setDeviceSearch} devices={filteredDevices} />
              {inviteError && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100"><AlertCircle size={14} /> {inviteError}</div>}
              <button type="submit" className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl text-sm font-bold shadow-xl shadow-black/10 hover:bg-[#2C2C2C] transition-all active:scale-[0.98] mt-4">Send Invitation Link</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
