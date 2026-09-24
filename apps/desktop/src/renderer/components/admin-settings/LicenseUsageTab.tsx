import React, { useEffect, useState } from 'react';
import { Loader2, Monitor, Users, Clock, TimerOff, CheckCircle2, Video } from 'lucide-react';
import api from '../../lib/api';
import { useLicenseStore, useTrialCountdown } from '../../store/licenseStore';

/**
 * Admin settings → License usage. Shows how much of the org's plan is consumed
 * (member seats + device slots) against the plan limits from the billing
 * catalog, plus the trial countdown / renewal date. Read-only; plan changes
 * live on the Subscriptions tab.
 */

interface UsageBarProps {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  used: number;
  limit: number | null; // null = unlimited
  /** Makes the card clickable (e.g. Concurrent Sessions → who's signed in). */
  onClick?: () => void;
  hint?: string;
}

const UsageBar: React.FC<UsageBarProps> = ({ icon: Icon, label, used, limit, onClick, hint }) => {
  const unlimited = limit === null || limit < 0;
  const pct = unlimited ? 6 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const over = !unlimited && used > (limit as number);
  return (
    <div
      onClick={onClick}
      className={`flex flex-col justify-center gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6 ${onClick ? 'cursor-pointer transition-colors hover:border-[#FF8A00] hover:bg-[#FFFBF5]' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <span className="text-[14px] font-medium text-black">{label}</span>
      </div>
      <div className="flex flex-col gap-4">
        <span className={`text-[18px] font-medium leading-[25px] ${over ? 'text-[#D92D20]' : 'text-black'}`}>{used} / {unlimited ? '∞' : limit}</span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#D5D6D8]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? '#D92D20' : 'linear-gradient(180deg, #FF8A00 0%, #FFB347 100%)' }} />
        </div>
        {hint && <span className="text-[11px] font-medium text-[#FF8A00]">{hint}</span>}
      </div>
    </div>
  );
};

export const LicenseUsageTab: React.FC<{ user?: any }> = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billing, setBilling] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  // Concurrent Sessions is PER ACCOUNT: how many places THIS account is
  // signed in at, against the plan's per-account allowance (Solo: 1 → "1/1").
  // Defaults to 1 — being on this page means you're signed in somewhere.
  const [mySessionCount, setMySessionCount] = useState(1);
  // Members with their live signedIn flag, for the "who's signed in" popup.
  const [membersList, setMembersList] = useState<any[]>([]);
  const [showWhoModal, setShowWhoModal] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const license = useLicenseStore();

  // Reload live when the plan changes anywhere (pushed via account-sync).
  useEffect(() => {
    const onBillingChanged = () => setReloadTick((tick) => tick + 1);
    window.addEventListener('remote365:billing-changed', onBillingChanged);
    return () => window.removeEventListener('remote365:billing-changed', onBillingChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [subRes, plansRes, devRes, memRes, sessRes] = await Promise.all([
          api.get('/api/billing/current').catch((e: any) => { throw e; }),
          api.get('/api/billing/plans').catch(() => ({ data: [] })),
          api.get('/api/devices/mine').catch(() => ({ data: [] })),
          api.get('/api/members').catch(() => ({ data: { members: [] } })),
          api.get('/api/auth/sessions').catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setBilling(subRes.data);
        setPlans(Array.isArray(plansRes.data) ? plansRes.data : (plansRes.data?.plans || []));
        const devs = devRes.data;
        setDeviceCount(Array.isArray(devs) ? devs.length : (devs?.devices?.length || 0));
        const mems = memRes.data?.members || memRes.data || [];
        setMemberCount(Array.isArray(mems) ? mems.length : 0);
        setMembersList(Array.isArray(mems) ? mems : []);
        setMySessionCount(Array.isArray(sessRes.data) && sessRes.data.length > 0 ? sessRes.data.length : 1);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.status === 403
          ? 'Only the organization owner can view license usage.'
          : 'Could not load license usage.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    useLicenseStore.getState().refresh();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const planId = String(billing?.plan || 'TRIAL').toUpperCase();
  const planMeta = plans.find((p: any) => p.id === planId) || billing?.catalog || null;
  const planName = planMeta?.name || (planId.charAt(0) + planId.slice(1).toLowerCase());
  const priceLabel = planMeta?.priceLabel || (typeof planMeta?.price === 'number' ? `$${planMeta.price} / month` : 'Free');
  const isTrial = planId === 'TRIAL';
  const countdown = useTrialCountdown(isTrial ? (license.expiresAt || billing?.currentPeriodEnd || null) : null, license.serverOffsetMs);
  const renewal = billing?.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString() : null;
  const pad2 = (n: number) => String(n).padStart(2, '0');

  if (loading) {
    return <div className="flex h-full items-center justify-center py-20 text-[#FF8A00]"><Loader2 className="animate-spin" size={28} /></div>;
  }
  if (error) {
    return <div className="flex h-full items-center justify-center px-10 text-center text-[14px] text-[#757575]">{error}</div>;
  }

  return (
    <div className="w-full px-8 py-8 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="mb-12">
        <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black">License Usage</h1>
        <p className="m-0 mt-1 text-[14px] leading-5 text-[#757575]">How much of your plan your organization is using.</p>
      </div>

      {/* Plan summary banner */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#F3F4F6] p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
            <CheckCircle2 size={22} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[16px] font-semibold text-black">Remote365, {planName}</span>
            <span className="inline-flex w-fit items-center rounded-full px-2 py-1 text-[10px] font-medium" style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
              {isTrial ? 'Trial' : 'Active'}
            </span>
          </div>
        </div>
        {isTrial && countdown ? (
          countdown.expired ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
              <TimerOff size={15} /> Trial Ended
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#FF8A00]" />
              <span className="font-mono text-[16px] font-semibold tabular-nums text-black">
                {countdown.days > 0 && `${countdown.days}d `}{pad2(countdown.hours)}:{pad2(countdown.minutes)}:{pad2(countdown.seconds)}
              </span>
              <span className="text-[14px] text-[#757575]">Left In Trial</span>
            </div>
          )
        ) : renewal ? (
          <span className="text-[14px] text-black">{billing?.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on {renewal}</span>
        ) : !isTrial && billing ? (
          <span className="text-[14px] text-black">Lifetime Access</span>
        ) : null}
      </div>

      {/* Usage cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <UsageBar icon={Users} label="Member Seats" used={memberCount} limit={planMeta?.maxUsers ?? null} />
        <UsageBar icon={Monitor} label="Device Slots" used={deviceCount} limit={planMeta?.maxDevices ?? null} />
        <UsageBar
          icon={Video}
          label="Concurrent Sessions"
          used={mySessionCount}
          limit={planMeta?.maxConcurrentSessions ?? null}
          onClick={() => setShowWhoModal(true)}
          hint="Click To See Who's Signed In"
        />
      </div>

      <p className="mt-8 text-[14px] leading-5 text-black/70">Need more seats or devices? Change your plan on the Subscription tab.</p>

      {/* Who's signed in — every member's live login state. Each account can
          be signed in at up to the plan's Concurrent Sessions cap in parallel;
          this popup only shows whether they're signed in anywhere. */}
      {showWhoModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setShowWhoModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="m-0 text-[16px] font-semibold text-black">Signed-In Members</h3>
              <button type="button" onClick={() => setShowWhoModal(false)} className="rounded p-1 text-[rgba(17,19,21,0.4)] transition-colors hover:text-[#111315]">✕</button>
            </div>
            <p className="m-0 mb-4 text-[12px] leading-4 text-[#757575]">Each account can be signed in at up to your plan's concurrent-sessions cap in parallel.</p>
            <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {membersList.map((member: any) => {
                const signedIn = Boolean(member.signedIn);
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-[#FBFBFC]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F9F5FF] text-[14px] font-medium text-[#7F56D9]">
                      {(member.name?.[0] || member.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[#111315]">{member.name || member.email}</div>
                      <div className="truncate text-[12px] text-[rgba(17,19,21,0.55)]">{String(member.role || '').replace('_', ' ')}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${signedIn ? 'bg-[#ECFDF3] text-[#067647]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${signedIn ? 'bg-[#34C759]' : 'bg-[#9CA3AF]'}`} />
                      {signedIn ? 'Signed In' : 'Signed Out'}
                    </span>
                  </div>
                );
              })}
              {membersList.length === 0 && (
                <div className="py-8 text-center text-[13px] text-[#757575]">No members to show.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicenseUsageTab;
