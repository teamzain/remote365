import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock, FlaskConical, Loader2, Mail, TimerOff, X } from 'lucide-react';
import api from '../../lib/api';
import CheckoutModal from '../billing/CheckoutModal';

interface LicensesPanelProps {
  user: any;
}

/**
 * Settings → Licenses (web port of the desktop panel). Shows the live
 * subscription (plan, slot usage, card, billing email) from the
 * billing-service, changes plans in-page via the Stripe checkout modal, and
 * opens the Stripe customer portal for card/email changes.
 */
export const LicensesPanel: React.FC<LicensesPanelProps> = ({ user }) => {
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [plansOpen, setPlansOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  // Ticks every second while a trial is running so the countdown stays live.
  const [nowTs, setNowTs] = useState(() => Date.now());

  const fetchBilling = async () => {
    setBillingLoading(true);
    try {
      const [plansRes, subRes, devRes] = await Promise.all([
        api.get('/api/billing/plans').catch(() => ({ data: [] })),
        api.get('/api/billing/current').catch(() => ({ data: null })),
        api.get('/api/devices/mine').catch(() => ({ data: [] })),
      ]);
      const plansData = Array.isArray(plansRes.data) ? plansRes.data : (plansRes.data?.plans || []);
      setBillingPlans(plansData);
      setBillingInfo({
        ...subRes.data,
        publishableKey: plansRes.data?.publishableKey || subRes.data?.publishableKey,
      });
      const devs = devRes.data;
      setDeviceCount(Array.isArray(devs) ? devs.length : (devs?.devices?.length || 0));
    } catch (err) {
      console.error('[Licenses] Failed to load billing', err);
    } finally {
      setBillingLoading(false);
    }
  };

  const openBillingPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    setPortalError('');
    try {
      const { data } = await api.post('/api/billing/portal');
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        setPortalError('Billing portal is unavailable right now.');
      }
    } catch (err: any) {
      console.error('[Licenses] Failed to open billing portal', err);
      setPortalError(
        err?.response?.status === 404
          ? 'Billing portal is not available on this server yet.'
          : 'Could not open the billing portal. Please try again.'
      );
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  // Refetch live when the plan changes anywhere (pushed via account-sync).
  useEffect(() => {
    const onBillingChanged = () => fetchBilling();
    window.addEventListener('remote365:billing-changed', onBillingChanged);
    return () => window.removeEventListener('remote365:billing-changed', onBillingChanged);
  }, []);

  const choosePlan = (plan: any) => {
    if (plan.id === activePlanId || plan.id === 'TRIAL') return;
    setSelectedPlan(plan);
    setPlansOpen(false);
    setCheckoutOpen(true);
  };

  const activePlanId = billingInfo?.plan || 'TRIAL';
  const planMeta = (Array.isArray(billingPlans) ? billingPlans.find((p: any) => p.id === activePlanId) : null) || billingInfo?.catalog || null;
  const planDisplayName = `Remote365 · ${planMeta?.name || (activePlanId.charAt(0) + activePlanId.slice(1).toLowerCase())} Plan`;
  const planPriceLabel = planMeta?.priceLabel || (typeof planMeta?.price === 'number' ? `$${planMeta.price} / month` : '');
  const planCapacity: number | null = planMeta?.maxDevices ?? null;
  const slotPercent = planCapacity ? Math.min(100, Math.round((deviceCount / planCapacity) * 100)) : 0;
  const cardLabel = billingInfo?.card_last4
    ? `${(billingInfo.card_brand || 'Card').replace(/^\w/, (c: string) => c.toUpperCase())} •••• ${billingInfo.card_last4}`
    : 'No card on file';
  const billingRenewal = billingInfo?.currentPeriodEnd ? new Date(billingInfo.currentPeriodEnd).toLocaleDateString() : null;

  const isTrialPlan = activePlanId === 'TRIAL';
  const trialEndsAt = isTrialPlan && billingInfo?.currentPeriodEnd ? new Date(billingInfo.currentPeriodEnd).getTime() : null;
  useEffect(() => {
    if (!trialEndsAt) return;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [trialEndsAt]);
  const countdown = trialEndsAt
    ? (() => {
        const totalMs = trialEndsAt - nowTs;
        if (totalMs <= 0) return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
        const totalSeconds = Math.floor(totalMs / 1000);
        return {
          expired: false,
          totalMs,
          days: Math.floor(totalSeconds / 86400),
          hours: Math.floor((totalSeconds % 86400) / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60,
        };
      })()
    : null;
  const trialUrgent = !!countdown && !countdown.expired && countdown.totalMs < 24 * 60 * 60 * 1000;
  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315]">
      {/* Header */}
      <div className="mb-12">
        <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black">Licenses</h1>
        <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315]">Your subscription, capacity, and billing.</p>
      </div>

      {/* Plan card */}
      <div className="mb-12 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] p-4">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black">{billingLoading && !billingInfo ? 'Loading plan…' : planDisplayName}</h3>
            <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315]">
              {planPriceLabel && <span className="text-[18px] font-medium leading-[25px] text-black">{planPriceLabel}</span>}
              {billingRenewal && (
                <span className="ml-2">
                  {billingInfo?.cancelAtPeriodEnd ? 'Cancels' : isTrialPlan ? (countdown?.expired ? 'Trial ended' : 'Trial ends') : 'Renews'} {billingRenewal}
                </span>
              )}
              {!billingRenewal && !isTrialPlan && billingInfo && (
                <span className="ml-2">Lifetime access</span>
              )}
            </p>
          </div>
          {isTrialPlan && countdown && (
            countdown.expired ? (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
                <TimerOff size={15} className="shrink-0" />
                Your free trial has ended — upgrade to keep using Remote365.
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Clock size={16} className={trialUrgent ? 'text-red-500' : 'text-[#FF8A00]'} />
                <span className={`font-mono text-[18px] font-semibold leading-[25px] tabular-nums ${trialUrgent ? 'text-red-500' : 'text-black'}`}>
                  {countdown.days > 0 && `${countdown.days}d `}{pad2(countdown.hours)}:{pad2(countdown.minutes)}:{pad2(countdown.seconds)}
                </span>
                <span className="text-[13px] leading-5 text-[#667085]">left in your free trial</span>
              </div>
            )
          )}
          <div className="flex items-center gap-3">
            {planCapacity ? (
              <>
                <div className="relative h-2 w-[137px] overflow-hidden rounded bg-[#F3F4F6]">
                  <div className="absolute left-0 top-0 h-2 rounded bg-[#FFB347]" style={{ width: `${slotPercent}%` }} />
                </div>
                <span className="text-[14px] leading-5 text-[#1A1D21]">{deviceCount} out of {planCapacity} slots are used</span>
              </>
            ) : (
              <span className="text-[14px] leading-5 text-[#1A1D21]">{deviceCount} device{deviceCount === 1 ? '' : 's'} · unlimited slots</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPlansOpen(true)}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#FF8A00] transition-colors hover:bg-[#FFF4E5] disabled:opacity-60"
        >
          Manage Subscription
        </button>
      </div>

      {/* Payment method */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-6">
        <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black">Payment method</h3>
        <div className="flex items-center gap-[17px]">
          <div className="flex h-10 w-full max-w-[356px] items-center justify-between gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4">
            <span className="text-[14px] leading-5 text-[#111315]">{cardLabel}</span>
            <CheckCircle2 size={18} className={`shrink-0 ${billingInfo?.card_last4 ? 'text-[#34C759]' : 'text-[#111315]/20'}`} />
          </div>
          <button type="button" onClick={openBillingPortal} disabled={portalLoading} className="flex h-10 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] disabled:opacity-60">
            {portalLoading && <Loader2 size={14} className="animate-spin" />}
            Update
          </button>
        </div>
      </div>

      {/* Billing email */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black">Billing email</h3>
          <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315]">Invoices and receipts are sent here.</p>
        </div>
        <div className="flex items-center gap-[17px]">
          <div className="flex h-10 w-full max-w-[356px] items-center justify-between gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4">
            <span className="truncate text-[14px] leading-5 text-[#111315]">{user?.email || '—'}</span>
            <Mail size={18} className="shrink-0 text-[#111315]" />
          </div>
          <button type="button" onClick={openBillingPortal} disabled={portalLoading} className="flex h-10 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] disabled:opacity-60">
            {portalLoading && <Loader2 size={14} className="animate-spin" />}
            Update
          </button>
        </div>
      </div>

      {portalError && <p className="mt-4 text-[13px] font-medium text-red-500">{portalError}</p>}

      {plansOpen && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPlansOpen(false)} />
          <div className="relative max-h-[90vh] w-full max-w-[920px] overflow-y-auto rounded-[28px] bg-white p-7 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-blue-600">
                  <FlaskConical size={15} /> Stripe test mode
                </div>
                <h2 className="m-0 text-[24px] font-bold text-[#111315]">Choose your plan</h2>
                <p className="mt-1 text-[14px] text-[#667085]">Change plans without leaving Remote365.</p>
              </div>
              <button type="button" onClick={() => setPlansOpen(false)} className="rounded-full p-2 hover:bg-black/5">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {billingPlans.filter((plan: any) => plan.id !== 'TRIAL').map((plan: any) => {
                const active = plan.id === activePlanId;
                const price = typeof plan.price === 'number' ? `$${plan.price}` : plan.priceLabel;
                return (
                  <div key={plan.id} className={`flex min-h-[360px] flex-col rounded-2xl border p-5 ${active ? 'border-[#FF9D2E] bg-[#FFF8EF]' : 'border-black/10'}`}>
                    <div className="mb-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="m-0 text-[18px] font-bold">{plan.name}</h3>
                        {active && <span className="rounded-full bg-[#FF9D2E] px-2 py-1 text-[10px] font-bold text-white">CURRENT</span>}
                      </div>
                      <div className="mt-3 text-[26px] font-bold">{price}<span className="text-[12px] font-medium text-[#667085]">{typeof plan.price === 'number' ? ' / month' : ''}</span></div>
                      <p className="mt-2 min-h-[60px] text-[12px] leading-5 text-[#667085]">{plan.description}</p>
                    </div>
                    <div className="mb-5 flex-1 space-y-2">
                      {(plan.features || []).slice(0, 6).map((feature: string) => (
                        <div key={feature} className="flex gap-2 text-[12px] leading-5"><Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />{feature}</div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => choosePlan(plan)}
                      disabled={active}
                      className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#111315] px-4 text-[13px] font-semibold text-white disabled:bg-[#E5E7EB] disabled:text-[#667085]"
                    >
                      {active ? 'Current plan' : <>Select {plan.name}<ArrowRight size={14} /></>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={selectedPlan?.id || ''}
        price={selectedPlan?.priceLabel || String(selectedPlan?.price || '')}
        publishableKey={billingInfo?.publishableKey}
        onSuccess={fetchBilling}
      />
    </div>
  );
};

export default LicensesPanel;
