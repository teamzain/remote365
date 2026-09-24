import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Loader2, LogOut, TimerOff } from 'lucide-react';
import api from '../../lib/api';
import { useLicenseStore, isTrialLocked, useTrialCountdown } from '../../store/licenseStore';
import CheckoutModal from './CheckoutModal';

interface TrialExpiredLockProps {
  user: any;
  onLogout: () => void;
}

/**
 * Full-app lock once the free trial runs out. Mounted once in the authenticated
 * shell; renders nothing while the workspace has time left or a paid plan.
 * Owners can upgrade right here (plans grid + Stripe checkout); members are
 * told to contact their organization owner. Signing out is always possible.
 */
const TrialExpiredLock: React.FC<TrialExpiredLockProps> = ({ user, onLogout }) => {
  const license = useLicenseStore();
  // The per-second tick also re-renders this component, so the lock appears the
  // exact moment the countdown crosses zero — not on the next poll.
  useTrialCountdown(license.plan === 'TRIAL' ? license.expiresAt : null, license.serverOffsetMs);

  const [plans, setPlans] = useState<any[]>([]);
  const [publishableKey, setPublishableKey] = useState<string | undefined>(undefined);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    license.refresh();
    const t = setInterval(() => useLicenseStore.getState().refresh(), 60_000);
    return () => clearInterval(t);
  }, []);

  const locked = isTrialLocked(license);
  const role = String(user?.role || '').toUpperCase();
  const canUpgrade = role === 'OWNER' || role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!locked || !canUpgrade || plans.length) return;
    setPlansLoading(true);
    api.get('/api/billing/plans')
      .then(({ data }: { data: any }) => {
        const list = Array.isArray(data) ? data : (data?.plans || []);
        setPlans(list.filter((p: any) => p.id !== 'TRIAL'));
        setPublishableKey(data?.publishableKey);
      })
      .catch((err: any) => console.error('[License] Failed to load plans for lock screen', err))
      .finally(() => setPlansLoading(false));
  }, [locked, canUpgrade, plans.length]);

  if (!locked) return null;

  const endedOn = license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : '';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="absolute inset-0 bg-[#0B0D0F]/70 backdrop-blur-md" />

      <div className="relative flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-y-auto rounded-[28px] bg-white p-8 shadow-2xl dark:bg-[#171717] animate-in zoom-in-95 fade-in duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1E0]">
            <TimerOff size={30} className="text-[#FF8A00]" />
          </div>
          <h2 className="m-0 text-[24px] font-bold text-[#111315] dark:text-white">Your Free Trial Has Ended</h2>
          <p className="m-0 mt-2 max-w-[520px] text-[14px] leading-6 text-[#667085] dark:text-[#A0A0A0]">
            Your {license.trialDaysTotal}-day free trial{endedOn ? ` ended on ${endedOn}` : ' has ended'}.
            {canUpgrade
              ? ' Choose a plan below to unlock Remote365 again — your devices, contacts and settings are all still here.'
              : ' Ask your organization owner to upgrade the workspace to restore access.'}
          </p>
        </div>

        {canUpgrade && (
          <div className="mt-8">
            {plansLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[14px] text-[#667085]">
                <Loader2 size={16} className="animate-spin" /> Loading Plans…
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map((plan: any) => {
                  const price = typeof plan.price === 'number' ? `$${plan.price}` : plan.priceLabel;
                  return (
                    <div key={plan.id} className="flex flex-col rounded-2xl border border-black/10 p-5 dark:border-white/10">
                      <div className="mb-4">
                        <h3 className="m-0 text-[16px] font-bold text-[#111315] dark:text-white">{plan.name}</h3>
                        <div className="mt-2 text-[22px] font-bold text-[#111315] dark:text-white">
                          {price}
                          <span className="text-[12px] font-medium text-[#667085]">{typeof plan.price === 'number' ? ' / month' : ''}</span>
                        </div>
                      </div>
                      <div className="mb-5 flex-1 space-y-2">
                        {(plan.features || []).slice(0, 4).map((feature: string) => (
                          <div key={feature} className="flex gap-2 text-[12px] leading-5 text-[#111315] dark:text-[#D0D0D0]">
                            <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />{feature}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedPlan(plan); setCheckoutOpen(true); }}
                        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#FF8A00] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        Upgrade to {plan.name}<ArrowRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-5 dark:border-white/10">
          <span className="text-[12px] text-[#667085] dark:text-[#A0A0A0]">Signed in as {user?.email || '—'}</span>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-9 items-center gap-2 rounded-lg border border-black/10 px-3 text-[13px] font-medium text-[#111315] transition-colors hover:bg-black/5 dark:border-white/10 dark:text-[#F5F5F5] dark:hover:bg-white/10"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={selectedPlan?.id || ''}
        price={selectedPlan?.priceLabel || String(selectedPlan?.price || '')}
        publishableKey={publishableKey}
        onSuccess={() => useLicenseStore.getState().refresh()}
      />
    </div>
  );
};

export default TrialExpiredLock;
