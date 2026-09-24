import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Shield, Users, Check, ChevronDown } from 'lucide-react';
import api from '../../lib/api';

/**
 * Admin settings → Device Management → Policies. Organization-wide connection
 * policies backed by GET/PATCH /api/organizations/mine (require2FA and
 * defaultMemberRole). The default role is enforced as the fallback when a
 * member is invited without an explicit role.
 */

const ROLE_OPTIONS = [
  { value: 'VIEWER', label: 'Viewer', help: 'View-only access to assigned devices' },
  { value: 'ADMIN', label: 'Admin', help: 'Manage members and devices' },
];

export const PoliciesTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [defaultRole, setDefaultRole] = useState('VIEWER');
  const [require2FA, setRequire2FA] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roleOpen) return;
    const close = (e: MouseEvent) => {
      if (!roleDropdownRef.current?.contains(e.target as Node)) setRoleOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [roleOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/api/organizations/mine');
        if (cancelled) return;
        setDefaultRole(String(data?.defaultMemberRole || 'VIEWER').toUpperCase());
        setRequire2FA(Boolean(data?.require2FA));
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.status === 404 ? 'You are not part of an organization yet.' : 'Could not load organization policies.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (patch: { defaultMemberRole?: string; require2FA?: boolean }) => {
    setSaving(true);
    try {
      await api.patch('/api/organizations/mine', patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.response?.status === 403 ? 'Only the organization owner can change policies.' : 'Could not save policy.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center py-20 text-[#FF8A00]"><Loader2 className="animate-spin" size={28} /></div>;
  if (error && !defaultRole) return <div className="flex h-full items-center justify-center px-10 text-center text-[14px] text-[#757575]">{error}</div>;

  return (
    <div className="w-full px-8 py-8 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="mb-8 flex items-center gap-2">
        <div>
          <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-white">Connection policies</h1>
          <p className="m-0 mt-1 text-[14px] leading-5 text-[#757575] dark:text-[#A0A0A0]">Organization-wide rules for members and connections.</p>
        </div>
        {saving ? <Loader2 size={14} className="animate-spin text-[#FF8A00]" /> : saved ? <span className="flex items-center gap-1 text-[12px] font-medium text-[#34C759]"><Check size={14} /> Saved</span> : null}
      </div>

      <div className="flex flex-col gap-4">
        {/* Default member role */}
        <div className="rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6 dark:border-white/10 dark:bg-[#161616]">
          <div className="mb-3 flex items-center gap-2">
            <Users size={18} className="text-[#FF8A00]" />
            <h3 className="m-0 text-[16px] font-semibold text-black dark:text-white">Default role for new members</h3>
          </div>
          <p className="m-0 mb-4 text-[13px] leading-5 text-[#757575] dark:text-[#A0A0A0]">Applied automatically when a member is invited without a specific role.</p>
          <div ref={roleDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setRoleOpen((open) => !open)}
              className={`flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 text-[14px] text-[#1C1C1C] outline-none transition-colors dark:bg-[#141414] dark:text-white ${roleOpen ? 'border-[#FF8A00]' : 'border-[rgba(28,28,28,0.15)] hover:border-[rgba(28,28,28,0.3)] dark:border-white/10'}`}
            >
              <span>
                {(ROLE_OPTIONS.find((r) => r.value === defaultRole) || ROLE_OPTIONS[0]).label}
                <span className="text-[#757575] dark:text-[#A0A0A0]"> — {(ROLE_OPTIONS.find((r) => r.value === defaultRole) || ROLE_OPTIONS[0]).help.toLowerCase()}</span>
              </span>
              <ChevronDown size={16} className={`shrink-0 text-[#757575] transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
            </button>

            {roleOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-[rgba(28,28,28,0.08)] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#1A1A1A]">
                {ROLE_OPTIONS.map((r) => {
                  const active = r.value === defaultRole;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => { setDefaultRole(r.value); setRoleOpen(false); if (!active) save({ defaultMemberRole: r.value }); }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#FFF8F0] dark:hover:bg-white/5"
                    >
                      <span className="flex flex-col">
                        <span className={`text-[14px] ${active ? 'font-semibold text-[#FF8A00]' : 'font-medium text-[#1C1C1C] dark:text-white'}`}>{r.label}</span>
                        <span className="text-[12px] text-[#757575] dark:text-[#A0A0A0]">{r.help}</span>
                      </span>
                      {active && <Check size={16} className="shrink-0 text-[#FF8A00]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Require 2FA */}
        <div className="flex items-start justify-between gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6 dark:border-white/10 dark:bg-[#161616]">
          <div className="max-w-[440px]">
            <div className="mb-1 flex items-center gap-2">
              <Shield size={18} className="text-[#FF8A00]" />
              <h3 className="m-0 text-[16px] font-semibold text-black dark:text-white">Require two-factor authentication</h3>
            </div>
            <p className="m-0 text-[13px] leading-5 text-[#757575] dark:text-[#A0A0A0]">Every member of your organization must have 2FA enabled on their account.</p>
          </div>
          <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
            <input type="checkbox" className="sr-only peer" checked={require2FA} onChange={() => { const next = !require2FA; setRequire2FA(next); save({ require2FA: next }); }} />
            <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10" />
          </label>
        </div>
      </div>

      {error && <p className="mt-4 text-[13px] font-medium text-[#D92D20]">{error}</p>}
    </div>
  );
};

export default PoliciesTab;
