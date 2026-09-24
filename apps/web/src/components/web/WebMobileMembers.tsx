import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Lock, Mail, MoreVertical, Plus, SlidersHorizontal, Trash2, UserRoundPlus, X } from 'lucide-react';
import api from '../../lib/api';
import { hasUserPermission } from '../../lib/permissions';
import { useAuthStore } from '../../store/authStore';
import { AccessPicker } from '../members/AccessPicker';
import { MemberPermissions } from '../members/MemberPermissions';

type AccessType = 'none' | 'full' | 'groups' | 'specific';

const PLAN_MEMBER_LIMITS: Record<string, number> = { TRIAL: 1, SOLO: 2, PRO: 5, BUSINESS: 25, ENTERPRISE: Infinity };
const PLAN_ROLE_OPTIONS: Record<string, string[]> = {
  TRIAL: ['VIEWER'],
  SOLO: ['ADMIN', 'VIEWER'],
  PRO: ['ADMIN', 'VIEWER'],
  BUSINESS: ['OWNER', 'ADMIN', 'VIEWER'],
  ENTERPRISE: ['OWNER', 'ADMIN', 'VIEWER'],
};
// Mirrors the backend ceiling (utils/rbac.ts) and the desktop page.
const ASSIGNABLE_ROLES_BY_ACTOR: Record<string, string[]> = {
  SUPER_ADMIN: ['ADMIN', 'VIEWER'],
  OWNER: ['ADMIN', 'VIEWER'],
  ADMIN: ['VIEWER'],
  VIEWER: ['VIEWER'],
};
const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'VIEWER', label: 'Viewer' },
];

const gradient = { background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' };

const initials = (name?: string | null) =>
  String(name || '?').split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const rolePill = (role: string) => {
  const r = String(role).toUpperCase();
  if (r === 'OWNER') return 'bg-[#FFF4E5] text-[#B45309]';
  if (r === 'ADMIN') return 'bg-[#ECFDF3] text-[#067647]';
  return 'bg-[#F3F4F6] text-[#4B5563]';
};
const roleLabel = (role: string) => {
  const r = String(role || 'VIEWER').toUpperCase();
  return r.charAt(0) + r.slice(1).toLowerCase().replace('_', ' ');
};

const accessText = (member: any) => {
  if (member.allowedDeviceIds?.includes('__all__')) return { text: 'All devices', color: 'text-[#34C759]' };
  if (member.allowedGroups?.length) return { text: `${member.allowedGroups.length} group${member.allowedGroups.length === 1 ? '' : 's'}`, color: 'text-[#2563EB]' };
  if (member.allowedDeviceIds?.length) return { text: `${member.allowedDeviceIds.length} device${member.allowedDeviceIds.length === 1 ? '' : 's'}`, color: 'text-[#FF8A00]' };
  return { text: 'No access', color: 'text-[#D92D20]' };
};

/**
 * Phone version of the Members page: one list with role pills and access
 * summaries, pending invites in a second segment, a bottom-sheet invite form
 * and per-member actions. The per-user permission editor is the same
 * component the desktop uses, framed full-screen.
 */
export const WebMobileMembers: React.FC = () => {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [orgDevices, setOrgDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<'members' | 'pending'>('members');

  const [sheetMember, setSheetMember] = useState<any>(null);
  const [sheetInvite, setSheetInvite] = useState<any>(null);
  const [confirm, setConfirm] = useState<{ type: 'member' | 'invitation'; id: string; email: string } | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [accessType, setAccessType] = useState<AccessType>('none');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const canInvite = hasUserPermission(user, 'members:invite');
  const canEdit = hasUserPermission(user, 'members:edit');
  const canRemove = hasUserPermission(user, 'members:remove');
  const canAssignRoles = hasUserPermission(user, 'members:assignRole');
  const plan = String(user?.plan || 'TRIAL').toUpperCase();
  const limit = PLAN_MEMBER_LIMITS[plan] ?? PLAN_MEMBER_LIMITS.TRIAL;
  const availableRoles = useMemo(() => {
    if (!canAssignRoles) return [];
    const allowed = PLAN_ROLE_OPTIONS[plan] || PLAN_ROLE_OPTIONS.TRIAL;
    const assignable = ASSIGNABLE_ROLES_BY_ACTOR[String(user?.role || '').toUpperCase()] || [];
    return roleOptions.filter((role) => allowed.includes(role.value) && assignable.includes(role.value));
  }, [plan, user?.role, canAssignRoles]);
  const usage = members.length + invitations.length;
  const atLimit = usage >= limit;

  const fetchTeam = async () => {
    try {
      const { data } = await api.get('/api/members');
      setMembers(data.members || []);
      setInvitations(data.pendingInvites || []);
    } catch {
      /* list stays as it was */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchTeam();
    api.get('/api/devices/mine').then(({ data }: any) => setOrgDevices(data || [])).catch(() => {});
    api.get('/api/groups').then(({ data }: any) => setGroups(data.groups || [])).catch(() => {});
    const onRefresh = () => fetchTeam();
    window.addEventListener('team-refresh', onRefresh);
    return () => window.removeEventListener('team-refresh', onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (availableRoles.length && !availableRoles.some((role) => role.value === inviteRole)) setInviteRole(availableRoles[0].value);
  }, [availableRoles, inviteRole]);

  const resetInvite = () => {
    setInviteEmail('');
    setInviteRole(availableRoles[0]?.value || 'VIEWER');
    setAccessType('none');
    setDeviceIds([]);
    setGroupIds([]);
    setDeviceSearch('');
    setInviteError(null);
  };

  const sendInvite = async () => {
    setSending(true);
    setInviteError(null);
    try {
      await api.post('/api/members/invite', {
        email: inviteEmail.trim(),
        role: inviteRole,
        accessType,
        deviceIds: accessType === 'specific' ? deviceIds : [],
        groupIds: accessType === 'groups' ? groupIds : [],
      });
      setInviteOpen(false);
      resetInvite();
      setSegment('pending');
      fetchTeam();
    } catch (error: any) {
      setInviteError(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const toggleActive = async (member: any) => {
    const makeActive = String(member.status || 'ACTIVE').toUpperCase() === 'INACTIVE';
    setBusyId(member.id);
    try {
      await api.patch(`/api/members/${member.id}/status`, { active: makeActive });
      setMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, status: makeActive ? 'ACTIVE' : 'INACTIVE' } : item)));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update member status');
    } finally {
      setBusyId(null);
    }
  };

  const runRemove = async () => {
    if (!confirm) return;
    setBusyId(confirm.id);
    try {
      if (confirm.type === 'member') await api.delete(`/api/members/${confirm.id}`);
      else await api.delete(`/api/members/invitation/${confirm.id}`);
      setConfirm(null);
      fetchTeam();
    } catch {
      alert(confirm.type === 'member' ? 'Failed to remove member' : 'Failed to cancel invitation');
    } finally {
      setBusyId(null);
    }
  };

  if (editing) {
    return (
      <div className="h-full overflow-y-auto overflow-x-hidden bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
        <MemberPermissions
          member={editing}
          actor={user}
          groups={groups}
          orgDevices={orgDevices}
          roleOptions={availableRoles}
          onBack={() => setEditing(null)}
          onSaved={() => fetchTeam()}
        />
      </div>
    );
  }

  const isOwnerRow = (member: any) => String(member.role).toUpperCase() === 'OWNER';
  const isSelf = (member: any) => member.id === user?.id;
  const input = 'h-12 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-[15px] text-[#111315] outline-none focus:border-[#FF8A00]';

  return (
    <div className="relative flex h-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="flex-none px-4 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[20px] font-semibold text-[#111315]">Members</h2>
          <span className="text-[12px] font-medium text-[#111315]/45">
            {usage}{Number.isFinite(limit) ? ` of ${limit}` : ''}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          {([['members', `Members (${members.length})`], ['pending', `Pending (${invitations.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSegment(key)}
              className={`h-8 rounded-full px-4 text-[12px] font-semibold ${segment === key ? 'bg-[#111315] text-white' : 'border border-[rgba(26,29,33,0.15)] text-[#111315]/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[rgba(26,29,33,0.06)]">
        {loading ? (
          <div className="flex justify-center py-10 text-[#FF8A00]"><Loader2 size={22} className="animate-spin" /></div>
        ) : segment === 'members' ? (
          members.map((member) => {
            const inactive = String(member.status || 'ACTIVE').toUpperCase() !== 'ACTIVE';
            const access = accessText(member);
            const canOpen = canEdit && !isOwnerRow(member) && !isSelf(member);
            return (
              <div key={member.id} className={`flex items-center gap-3 border-b border-[rgba(26,29,33,0.06)] px-4 py-3 ${inactive ? 'opacity-60' : ''}`}>
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#FFF1E0] text-[12px] font-semibold text-[#9A5400]">
                  {initials(member.name || member.email)}
                </span>
                <button type="button" disabled={!canOpen} onClick={() => setEditing(member)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-[#111315]">{member.name || member.email}</span>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${rolePill(member.role)}`}>{roleLabel(member.role)}</span>
                  </span>
                  <span className="block truncate text-[12px] text-[#111315]/45">{member.name ? member.email : ''}</span>
                  <span className={`block text-[12px] font-medium ${access.color}`}>
                    {isOwnerRow(member) ? 'Owner · all devices' : access.text}{inactive ? ' · inactive' : ''}
                  </span>
                </button>
                {!isOwnerRow(member) && !isSelf(member) && (canEdit || canRemove) && (
                  <button type="button" aria-label={`Actions for ${member.name || member.email}`} onClick={() => setSheetMember(member)} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#111315]/45 active:bg-[#F3F4F6]">
                    {busyId === member.id ? <Loader2 size={16} className="animate-spin text-[#FF8A00]" /> : <MoreVertical size={17} />}
                  </button>
                )}
              </div>
            );
          })
        ) : invitations.length === 0 ? (
          <p className="m-0 px-6 pt-10 text-center text-[13px] text-[#111315]/45">No pending invitations.</p>
        ) : (
          invitations.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 border-b border-[rgba(26,29,33,0.06)] px-4 py-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#F3F4F6] text-[#111315]/55">
                <Mail size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-[#111315]">{invite.email}</span>
                  <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${rolePill(invite.role)}`}>{roleLabel(invite.role)}</span>
                </span>
                <span className="flex items-center gap-1 text-[12px] text-[#111315]/45">
                  <Clock size={11} /> Expires {new Date(invite.expiresAt).toLocaleDateString()}
                </span>
              </div>
              {canInvite && (
                <button type="button" aria-label={`Actions for invitation to ${invite.email}`} onClick={() => setSheetInvite(invite)} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#111315]/45 active:bg-[#F3F4F6]">
                  <MoreVertical size={17} />
                </button>
              )}
            </div>
          ))
        )}
        <div className="h-24" />
      </div>

      {canInvite && (
        <button
          type="button"
          onClick={() => { if (atLimit) { alert(`Your ${plan} plan allows ${limit} team member${limit === 1 ? '' : 's'}.`); return; } resetInvite(); setInviteOpen(true); }}
          aria-label="Invite member"
          className={`absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl active:scale-95 ${atLimit ? 'opacity-50' : ''}`}
          style={gradient}
        >
          {atLimit ? <Lock size={22} /> : <Plus size={26} />}
        </button>
      )}

      {/* Member actions */}
      {sheetMember && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Member actions">
          <button type="button" aria-label="Close" onClick={() => setSheetMember(null)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white shadow-2xl animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <div className="px-5 py-3">
              <p className="m-0 text-[14px] font-semibold text-[#111315]">{sheetMember.name || sheetMember.email}</p>
              <p className="m-0 text-[12px] text-[#111315]/45">{sheetMember.email}</p>
            </div>
            <div className="border-t border-[rgba(26,29,33,0.08)]">
              {canEdit && (
                <button type="button" onClick={() => { const member = sheetMember; setSheetMember(null); setEditing(member); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]">
                  <SlidersHorizontal size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Role, access and permissions</span>
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={() => { const member = sheetMember; setSheetMember(null); toggleActive(member); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]">
                  <Lock size={17} className="text-[#111315]/55" />
                  <span className="text-[14px] font-medium text-[#111315]">
                    {String(sheetMember.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'Reactivate' : 'Deactivate'}
                  </span>
                </button>
              )}
              {canRemove && (
                <button type="button" onClick={() => { const member = sheetMember; setSheetMember(null); setConfirm({ type: 'member', id: member.id, email: member.email }); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#FFF5F5]">
                  <Trash2 size={17} className="text-[#D64545]" /><span className="text-[14px] font-medium text-[#D64545]">Remove from team</span>
                </button>
              )}
              <button type="button" onClick={() => setSheetMember(null)} className="flex w-full items-center gap-3 border-t border-[rgba(26,29,33,0.08)] px-5 py-3 text-left active:bg-[#F9FAFB]">
                <X size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invitation actions */}
      {sheetInvite && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Invitation actions">
          <button type="button" aria-label="Close" onClick={() => setSheetInvite(null)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white shadow-2xl animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <div className="px-5 py-3">
              <p className="m-0 text-[14px] font-semibold text-[#111315]">{sheetInvite.email}</p>
              <p className="m-0 text-[12px] text-[#111315]/45">Invitation pending</p>
            </div>
            <div className="border-t border-[rgba(26,29,33,0.08)]">
              <button type="button" onClick={() => { const invite = sheetInvite; setSheetInvite(null); setConfirm({ type: 'invitation', id: invite.id, email: invite.email }); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#FFF5F5]">
                <Trash2 size={17} className="text-[#D64545]" /><span className="text-[14px] font-medium text-[#D64545]">Cancel invitation</span>
              </button>
              <button type="button" onClick={() => setSheetInvite(null)} className="flex w-full items-center gap-3 border-t border-[rgba(26,29,33,0.08)] px-5 py-3 text-left active:bg-[#F9FAFB]">
                <X size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm removal */}
      {confirm && (
        <div className="fixed inset-0 z-[210] flex items-end" role="dialog" aria-label="Confirm">
          <button type="button" aria-label="Close" onClick={() => setConfirm(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full rounded-t-[20px] bg-white px-5 pt-3 shadow-2xl animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <p className="m-0 mt-4 text-[16px] font-semibold text-[#111315]">{confirm.type === 'member' ? 'Remove this member?' : 'Cancel this invitation?'}</p>
            <p className="m-0 mt-1 text-[13px] leading-5 text-[#111315]/55">
              {confirm.type === 'member'
                ? `${confirm.email} loses access to every device and is signed out everywhere.`
                : `${confirm.email} will no longer be able to join with this link.`}
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[rgba(26,29,33,0.2)] text-[14px] font-semibold text-[#111315]">Keep</button>
              <button type="button" disabled={busyId === confirm.id} onClick={runRemove} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D64545] text-[14px] font-semibold text-white disabled:opacity-50">
                {busyId === confirm.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {confirm.type === 'member' ? 'Remove' : 'Cancel invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite sheet */}
      {inviteOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white" role="dialog" aria-label="Invite member" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
          <div className="flex h-14 flex-none items-center justify-between border-b border-[rgba(26,29,33,0.1)] px-4">
            <span className="text-[15px] font-semibold text-[#111315]">Invite member</span>
            <button type="button" aria-label="Close" onClick={() => setInviteOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-[#111315]/55 active:bg-[#F3F4F6]"><X size={18} /></button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); if (inviteEmail.trim()) sendInvite(); }} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <label className="block text-[12px] font-medium text-[#111315]/60">Email</label>
              <input type="email" inputMode="email" autoFocus autoComplete="off" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" className={`${input} mt-1`} />

              {availableRoles.length > 0 && (
                <>
                  <label className="mt-4 block text-[12px] font-medium text-[#111315]/60">Role</label>
                  <div className="mt-1 flex gap-2">
                    {availableRoles.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => { setInviteRole(role.value); if (role.value === 'ADMIN') setAccessType('full'); }}
                        className={`h-9 rounded-full px-4 text-[12px] font-semibold ${inviteRole === role.value ? 'bg-[#111315] text-white' : 'border border-[rgba(26,29,33,0.15)] text-[#111315]/70'}`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                  <p className="m-0 mt-1 text-[11px] text-[#111315]/45">
                    {inviteRole === 'ADMIN' ? 'Admins see every device and can manage the team.' : 'Viewers connect only to the devices you allow.'}
                  </p>
                </>
              )}

              <label className="mt-4 block text-[12px] font-medium text-[#111315]/60">Device access</label>
              <div className="mt-1">
                <AccessPicker
                  accessType={accessType}
                  setAccessType={setAccessType}
                  groups={groups}
                  groupIds={groupIds}
                  onGroupToggle={(id) => setGroupIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))}
                  deviceIds={deviceIds}
                  onDeviceToggle={(id) => setDeviceIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))}
                  search={deviceSearch}
                  setSearch={setDeviceSearch}
                  devices={orgDevices.filter((device) => !deviceSearch || device.device_name?.toLowerCase().includes(deviceSearch.toLowerCase()) || device.access_key?.includes(deviceSearch))}
                />
              </div>
              {inviteError && <p className="m-0 mt-3 text-[12px] font-medium text-[#D64545]">{inviteError}</p>}
            </div>
            <div className="flex-none border-t border-[rgba(26,29,33,0.08)] px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button type="submit" disabled={sending || !inviteEmail.trim()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50" style={gradient}>
                {sending ? <Loader2 size={16} className="animate-spin" /> : <UserRoundPlus size={16} />} Send invitation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default WebMobileMembers;
