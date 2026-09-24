import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Mail,
  Monitor,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserRoundPlus,
  Users,
  X
} from 'lucide-react';
import api from '../lib/api';
import { hasUserPermission } from '../lib/permissions';
import { useAuthStore } from '../store/authStore';
import { AccessPicker } from './members/AccessPicker';
import { MemberPermissions } from './members/MemberPermissions';

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

// Role ceiling mirror of the backend (utils/rbac.ts): owners hand out Admin or
// Viewer; everyone else — including a Viewer the owner granted member
// management to — can only hand out Viewer.
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
  // ACTIVE | INACTIVE (org admin toggle) | SUSPENDED/DELETED (platform level)
  status?: string;
  allowedDeviceIds?: string[];
  allowedGroups?: DeviceGroup[];
  allowedTags?: string[];
  department?: { name: string };
  permissionOverrides?: any;
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

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'member' | 'invitation'; email: string } | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const memberLimit = getPlanLimit(user?.plan);
  // Effective per-user permissions (owner grants/revokes included), so what
  // this page offers always matches what the backend will accept.
  const canInviteMembers = hasUserPermission(user, 'members:invite');
  const canEditMembers = hasUserPermission(user, 'members:edit');
  const canRemoveMembers = hasUserPermission(user, 'members:remove');
  const canAssignRoles = hasUserPermission(user, 'members:assignRole');
  const availableRoleOptions = useMemo(
    () => (canAssignRoles ? getPlanRoleOptions(user?.plan, user?.role) : []),
    [user?.plan, user?.role, canAssignRoles]
  );
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
  }, [availableRoleOptions, inviteRole]);

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
    setInviteRole(availableRoleOptions[0]?.value || 'VIEWER');
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
      setInviteError(err.response?.data?.error || 'Failed To Send Invitation');
    }
  };

  const selectInviteRole = (role: string) => {
    setInviteRole(role);
    if (role === 'ADMIN') setInviteAccessType('full');
  };

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/api/members/${userId}`);
      fetchTeamData();
      setDeleteTarget(null);
    } catch {
      alert('Failed To Remove Member');
    }
  };

  // Active ⇄ Inactive. Deactivating signs the member out everywhere instantly
  // and blocks sign-in with a "temporarily restricted" message; flipping back
  // to active restores access — the account and its data are untouched.
  const toggleMemberActive = async (member: Member) => {
    const makeActive = String(member.status || 'ACTIVE').toUpperCase() === 'INACTIVE';
    setTogglingId(member.id);
    try {
      await api.patch(`/api/members/${member.id}/status`, { active: makeActive });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: makeActive ? 'ACTIVE' : 'INACTIVE' } : m)));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed To Update Member Status');
    } finally {
      setTogglingId(null);
    }
  };

  const removeInvitation = async (invitationId: string) => {
    try {
      await api.delete(`/api/members/invitation/${invitationId}`);
      fetchTeamData();
      setDeleteTarget(null);
    } catch {
      alert('Failed To Cancel Invitation');
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDeviceIds((prev) => (prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]));
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  const filteredDevices = useMemo(
    () => orgDevices.filter((device) => !deviceSearch || device.device_name?.toLowerCase().includes(deviceSearch.toLowerCase()) || device.access_key?.includes(deviceSearch)),
    [deviceSearch, orgDevices]
  );

  const accessLabel = (member: Member) => {
    if (member.allowedDeviceIds?.includes('__all__')) return <span className="text-[12px] font-medium text-[#34C759]">All Devices</span>;
    if (member.allowedGroups?.length) {
      return <span className="text-[12px] font-medium text-[#2563EB]">{member.allowedGroups.length} group{member.allowedGroups.length !== 1 ? 's' : ''}</span>;
    }
    if (member.allowedDeviceIds?.length) {
      return <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#FF8A00]"><Monitor size={13} />{member.allowedDeviceIds.length} device{member.allowedDeviceIds.length !== 1 ? 's' : ''}</span>;
    }
    return <span className="text-[12px] font-medium text-[#D92D20]">No Access</span>;
  };

  // Role pill styling — owner amber, everyone else the design's green base.
  const roleBadgeClass = (role: string) => {
    const r = String(role).toUpperCase();
    if (r === 'OWNER') return 'bg-[#FFF4E5] text-[#B45309]';
    if (r === 'ADMIN') return 'bg-[#ECFDF3] text-[#067647]';
    return 'bg-[#F3F4F6] text-[#4B5563]';
  };

  // Per-user permissions detail view (opened by clicking a non-owner member).
  if (selectedMember) {
    return (
      <MemberPermissions
        member={selectedMember}
        actor={user}
        groups={groups}
        orgDevices={orgDevices}
        roleOptions={availableRoleOptions}
        onBack={() => setSelectedMember(null)}
        // Saving stays on the permissions page (the editor shows its own
        // loader + saved state); just refresh the list data in the background.
        onSaved={() => { fetchTeamData(); }}
      />
    );
  }

  const initialFor = (member: Member) => (member.name?.[0] || member.email[0] || '?').toUpperCase();

  return (
    <div className="flex w-full flex-col gap-8 px-8 py-8 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Title + CTA */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black">Members</h1>
          <p className="m-0 mt-1 text-[14px] leading-5 text-[#757575]">Manage organization members, roles, and device access.</p>
        </div>
        {canInviteMembers && (
        <div className="relative group">
          <button
            disabled={inviteDisabled}
            onClick={() => { resetInviteForm(); setShowInviteModal(true); }}
            style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
            className="flex h-10 items-center gap-2 rounded px-4 text-[14px] font-medium text-white transition-all hover:brightness-[1.03] active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <UserRoundPlus size={16} />
            Add Member
          </button>
          {inviteDisabled && (
            <div className="absolute right-0 top-[calc(100%+8px)] hidden group-hover:block w-64 rounded-lg bg-[#1A1D21] p-3 text-[11px] font-medium text-white shadow-xl z-20">
              {inviteDisabledText}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { label: 'Members', value: members.length, icon: Users },
          { label: 'Pending', value: invitations.length, icon: Clock },
          { label: 'Plan Limit', value: `${memberUsage}/${Number.isFinite(memberLimit) ? memberLimit : '∞'}`, icon: CheckCircle2 }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="flex flex-col gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <span className="text-[14px] font-medium text-black">{card.label}</span>
              </div>
              <div className="text-[18px] font-medium leading-[25px] text-black">{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-xl border border-[rgba(26,29,33,0.3)] bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#F3F4F6]">
              <th className="px-6 py-3 text-[12px] font-medium text-[#111315]">User</th>
              <th className="px-6 py-3 text-center text-[12px] font-medium text-[#111315]">Role</th>
              <th className="px-6 py-3 text-center text-[12px] font-medium text-[#111315]">Access</th>
              <th className="px-6 py-3 text-center text-[12px] font-medium text-[#111315]">Joined</th>
              <th className="px-4 py-3 text-center text-[12px] font-medium text-[#111315]">Active</th>
              <th className="px-4 py-3 text-center text-[12px] font-medium text-[#111315]">Manage</th>
              <th className="px-4 py-3 text-center text-[12px] font-medium text-[#111315]">Delete</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isOwnerRow = String(member.role).toUpperCase() === 'OWNER';
              const isSelf = member.id === user?.id;
              // Same ceiling as the backend: owners manage Admins & Viewers,
              // everyone else can only touch Viewers.
              const withinCeiling = (ASSIGNABLE_ROLES_BY_ACTOR[String(user?.role || '').toUpperCase()] || ['VIEWER'])
                .includes(String(member.role).toUpperCase());
              const canManageRow = canEditMembers && withinCeiling && !isOwnerRow && !isSelf;
              const canRemoveRow = canRemoveMembers && withinCeiling && !isOwnerRow && !isSelf;
              const memberStatus = String(member.status || 'ACTIVE').toUpperCase();
              const isInactive = memberStatus === 'INACTIVE';
              // Suspended/deleted by the platform Super Admin — the org toggle can't lift that.
              const isPlatformLocked = memberStatus === 'SUSPENDED' || memberStatus === 'DELETED';
              return (
              <tr
                key={member.id}
                onClick={() => { if (canManageRow) setSelectedMember(member); }}
                className={`group border-t border-[rgba(26,29,33,0.12)] transition-colors ${canManageRow ? 'cursor-pointer hover:bg-[#FBFBFC]' : ''} ${isInactive ? 'opacity-60' : ''}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[16px] font-medium text-[#7F56D9]">{initialFor(member)}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-[#111315]">{member.name || 'Anonymous User'}</span>
                        {isInactive && <span className="inline-flex shrink-0 rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#D92D20]">Inactive</span>}
                        {isPlatformLocked && <span className="inline-flex shrink-0 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#4B5563]">Suspended</span>}
                      </div>
                      <div className="truncate text-[14px] text-[rgba(17,19,21,0.6)]">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${roleBadgeClass(member.role)}`}>{member.role.replace('_', ' ')}</span></td>
                <td className="px-6 py-4 text-center">{accessLabel(member)}</td>
                <td className="px-6 py-4 text-center text-[14px] text-[rgba(17,19,21,0.6)]">{new Date(member.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-4 text-center">
                  {canManageRow ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (togglingId !== member.id && !isPlatformLocked) toggleMemberActive(member); }}
                      disabled={togglingId === member.id || isPlatformLocked}
                      aria-pressed={!isInactive}
                      title={isPlatformLocked ? 'Suspended by the platform — contact support.' : isInactive ? 'Activate Member (Restores Sign-In)' : 'Deactivate member (signs them out and temporarily blocks sign-in)'}
                      style={!isInactive && !isPlatformLocked ? { background: 'linear-gradient(180deg, #FF8A00 0%, #FFB347 100%)' } : undefined}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isInactive || isPlatformLocked ? 'bg-[#D5D6D8]' : ''} ${isPlatformLocked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${togglingId === member.id ? 'opacity-60' : ''}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${!isInactive && !isPlatformLocked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                    </button>
                  ) : (
                    <span className="text-[12px] text-[rgba(17,19,21,0.35)]" title={isOwnerRow ? 'The owner is always active.' : undefined}>—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  {isOwnerRow ? (
                    <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-[rgba(17,19,21,0.4)]" title="The owner has full access and can't be edited or removed."><Lock size={13} /> Owner</span>
                  ) : isSelf ? (
                    <span className="inline-flex items-center justify-center text-[11px] font-medium text-[rgba(17,19,21,0.4)]" title="You can't change your own permissions.">You</span>
                  ) : canManageRow ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedMember(member); }}
                      className="inline-flex items-center gap-1.5 rounded border border-[rgba(26,29,33,0.25)] px-2.5 py-1.5 text-[12px] font-medium text-[#FF8A00] transition-colors hover:border-[#FF8A00] hover:bg-[#FFF6ED]"
                      title="Manage Permissions"
                    >
                      <SlidersHorizontal size={13} /> Manage
                    </button>
                  ) : (
                    <span className="text-[12px] text-[rgba(17,19,21,0.35)]">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  {canRemoveRow ? (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: member.id, type: 'member', email: member.email }); }} className="p-2 text-[rgba(17,19,21,0.35)] transition-colors hover:text-[#D92D20]" title="Delete Member Permanently"><Trash2 size={15} /></button>
                  ) : (
                    <span className="text-[12px] text-[rgba(17,19,21,0.35)]">—</span>
                  )}
                </td>
              </tr>
              );
            })}
            {invitations.map((invite) => (
              <tr key={invite.id} className="group border-t border-[rgba(26,29,33,0.12)] bg-[#FFFBF5]">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(255,179,71,0.2)] text-[#FF8A00]"><Mail size={16} /></div><div className="min-w-0"><div className="truncate text-[14px] font-medium italic text-[#111315]">Invitation Pending</div><div className="truncate text-[14px] text-[rgba(17,19,21,0.6)]">{invite.email}</div></div></div></td>
                <td className="px-6 py-4 text-center"><span className="inline-flex rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#B45309]">{invite.role}</span></td>
                <td className="px-6 py-4 text-center text-[12px] font-medium italic text-[#FF8A00]">Waiting For Join…</td>
                <td className="px-6 py-4 text-center text-[14px] text-[rgba(17,19,21,0.4)]">—</td>
                <td className="px-4 py-4 text-center text-[12px] text-[rgba(17,19,21,0.35)]">—</td>
                <td className="px-4 py-4 text-center text-[12px] text-[rgba(17,19,21,0.35)]">—</td>
                <td className="px-4 py-4 text-center">{canInviteMembers && <button onClick={() => setDeleteTarget({ id: invite.id, type: 'invitation', email: invite.email })} className="p-2 text-[rgba(17,19,21,0.25)] opacity-0 transition-colors hover:text-[#D92D20] group-hover:opacity-100" title="Cancel Invitation"><Trash2 size={15} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && members.length === 0 && invitations.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#FF8A00]" />
          </div>
        )}
        {members.length === 0 && invitations.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[rgba(17,19,21,0.4)]">
            <Users size={48} strokeWidth={1} />
            <span className="text-[13px]">No team members yet. Invite your first colleague.</span>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
            <h3 className="text-xl font-bold text-[#1C1C1C] mb-2">{deleteTarget.type === 'member' ? 'Delete Member Permanently?' : 'Cancel Invitation?'}</h3>
            <p className="text-sm text-[rgba(28,28,28,0.5)] mb-8 px-4 leading-relaxed">
              {deleteTarget.type === 'member'
                ? <>This permanently deletes <strong>{deleteTarget.email}</strong> and all of their data, and signs them out immediately. They can only return by signing up as a brand-new account. This cannot be undone. To block access temporarily, use the Active toggle instead.</>
                : <>Are you sure you want to cancel the invitation for <strong>{deleteTarget.email}</strong>? This action cannot be undone.</>}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 bg-[#F9F9FA] text-[rgba(28,28,28,0.6)] rounded-xl font-bold text-sm hover:bg-[#F0F0F2] transition-colors">Cancel</button>
              <button onClick={() => deleteTarget.type === 'member' ? removeMember(deleteTarget.id) : removeInvitation(deleteTarget.id)} className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200">Delete</button>
            </div>
          </div>
        </div>
      )}


      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[468px] rounded-xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[24px] font-bold leading-[34px] text-[#111315]">Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-[rgba(17,19,21,0.4)] transition-colors hover:text-[#111315]"><X size={24} /></button>
            </div>
            <form onSubmit={handleSendInvite} className="space-y-5">
              <div>
                <label className="mb-2 block px-1 text-[14px] text-[#111315]">Email Address</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] text-[#111315] placeholder:text-[rgba(17,19,21,0.3)] outline-none transition-all focus:border-[#FF8A00]" required />
              </div>
              <div>
                <label className="mb-2 block px-1 text-[14px] text-[#111315]">Role</label>
                {availableRoleOptions.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {availableRoleOptions.map((role) => (
                      <button key={role.value} type="button" onClick={() => selectInviteRole(role.value)} style={inviteRole === role.value ? { background: '#FFB347' } : undefined} className={`h-10 rounded border text-[14px] font-medium transition-all ${inviteRole === role.value ? 'border-transparent text-white' : 'bg-white text-[rgba(17,19,21,0.6)] border-[rgba(26,29,33,0.3)] hover:border-[#FF8A00]'}`}>{role.label}</button>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex rounded px-3 py-2 text-[11px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600">Viewer</span>
                )}
              </div>
              <AccessPicker accessType={inviteAccessType} setAccessType={setInviteAccessType} groups={groups} groupIds={selectedGroupIds} onGroupToggle={(id) => toggleGroup(id)} deviceIds={selectedDeviceIds} onDeviceToggle={(id) => toggleDevice(id)} search={deviceSearch} setSearch={setDeviceSearch} devices={filteredDevices} />
              {inviteError && <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600"><AlertCircle size={14} /> {inviteError}</div>}
              <button type="submit" style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }} className="mt-2 h-10 w-full rounded-full text-[14px] font-medium text-white transition-all hover:brightness-[1.03] active:scale-[0.98]">Send Invitation Link</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
