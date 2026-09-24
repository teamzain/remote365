import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Zap,
  Star,
  Crown,
  Package,
  FlaskConical,
  ArrowRight,
  Loader2,
  Check,
  Users,
  Monitor,
  CreditCard as CreditCardIcon,
  Download,
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import CheckoutModal from './billing/CheckoutModal';
import { t } from '../lib/translations';

interface Plan {
  id: string;
  name: string;
  price: number | string | null;
  priceLabel: string;
  description: string;
  maxDevices: number | null;
  maxUsers: number | null;
  features: string[];
}

interface SnowBillingProps {
  user: any;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  TRIAL: <FlaskConical size={20} />,
  SOLO: <Package size={20} />,
  PRO: <Zap size={20} />,
  BUSINESS: <Star size={20} />,
  ENTERPRISE: <Crown size={20} />,
};

const PLAN_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  TRIAL: { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  SOLO: { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  PRO: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  BUSINESS: { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  ENTERPRISE: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

export const SnowBilling: React.FC<SnowBillingProps> = ({ user }) => {
  const { user: authUser } = useAuthStore();
  const lang = authUser?.language;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ name: '', price: '' });

  useEffect(() => {
    fetchData();
  }, []);

  // Refetch live when the plan changes anywhere (pushed via account-sync).
  useEffect(() => {
    const onBillingChanged = () => fetchData();
    window.addEventListener('remote365:billing-changed', onBillingChanged);
    return () => window.removeEventListener('remote365:billing-changed', onBillingChanged);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        api.get('/api/billing/plans'),
        api.get('/api/billing/current'),
      ]);

      // Handle both old array response and new object response
      const plansData = Array.isArray(plansRes.data) ? plansRes.data : (plansRes.data.plans || []);
      const pubKey = plansRes.data.publishableKey || subRes.data.publishableKey;

      setPlans(plansData);
      setBillingInfo({ ...subRes.data, publishableKey: pubKey });
    } catch (err) {
      console.error('Failed to fetch billing info', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanAction = (plan: Plan) => {
    if (plan.id === billingInfo?.plan) return;

    if (plan.id === 'TRIAL') {
      return;
    }

    if (plan.id === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@remote365.com';
      return;
    }

    setSelectedPlan({ name: plan.id, price: String(plan.price) });
    setModalOpen(true);
  };

  const activePlan = billingInfo?.plan || 'TRIAL';
  const currentPlanData = Array.isArray(plans) ? plans.find(p => p.id === activePlan) : null;
  const renewalDate = billingInfo?.currentPeriodEnd
    ? new Date(billingInfo.currentPeriodEnd).toLocaleDateString(lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US')
    : 'N/A';
  // A paid plan with no period end is an open-ended grant — nothing renews.
  const isLifetime = !billingInfo?.currentPeriodEnd && activePlan !== 'TRIAL';

  const handleDownloadInvoice = (url: string) => {
    if ((window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center py-20 text-[#FF8A00]"><Loader2 className="animate-spin" size={28} /></div>;
  }

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const latestInvoice = billingInfo?.invoices?.[0];
  const priceMain = (plan: Plan) => (typeof plan.price === 'number' ? `$${plan.price}` : (plan.price ? String(plan.price) : '$0'));
  const priceSub = (plan: Plan) => (!plan.price || plan.price === 0 ? 'Free Forever' : '/ month');

  return (
    <div className="flex w-full flex-col gap-8 px-8 py-8 font-['Mona_Sans',system-ui,sans-serif] pb-16 animate-in fade-in duration-500">
      {/* Active subscription banner */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-[#F3F4F6] p-6">
        <div className="flex flex-col gap-3">
          <span className="text-[16px] font-semibold text-black">Active Subscription</span>
          <div className="flex items-center gap-4">
            <span className="text-[18px] font-medium leading-[25px] text-black">{currentPlanData?.name || cap(String(activePlan).toLowerCase())}</span>
            <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>{activePlan === 'TRIAL' ? 'Trial' : 'Active'}</span>
          </div>
          <span className="text-[14px] text-black">{isLifetime ? 'Lifetime Access' : `${billingInfo?.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on ${renewalDate}`}</span>
        </div>
        <div className="flex items-center">
          <div className="flex flex-col items-center gap-1 px-6">
            <Monitor size={22} className="text-[#111315]" />
            <span className="text-[18px] font-medium text-black">{currentPlanData?.maxDevices ?? '∞'}</span>
            <span className="text-[12px] font-medium text-black">Devices</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-6">
            <Users size={22} className="text-[#111315]" />
            <span className="text-[18px] font-medium text-black">{currentPlanData?.maxUsers ?? '∞'}</span>
            <span className="text-[12px] font-medium text-black">Users</span>
          </div>
        </div>
      </div>

      {/* Payment method + recent invoice */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-10 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-black">Payment Method</span>
            {billingInfo?.card_brand && <CheckCircle2 size={24} className="text-[#FF8A00]" />}
          </div>
          <div className="flex items-center gap-3 px-3">
            <div className="flex h-8 w-12 items-center justify-center rounded bg-[#1A1F71] text-[10px] font-black italic text-white">{(billingInfo?.card_brand || 'VISA').toUpperCase()}</div>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-medium text-black">{billingInfo?.card_brand ? `${cap(billingInfo.card_brand)} ending in ${billingInfo.card_last4}` : 'No Card On File'}</span>
              <span className="text-[14px] text-black/70">{billingInfo?.card_exp_month ? `Expires ${billingInfo.card_exp_month}/${billingInfo.card_exp_year}` : 'Add A Payment Method'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-10 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-6">
          <span className="text-[14px] font-medium text-black">Recent Invoice</span>
          {latestInvoice ? (
            <div className="flex items-center gap-4 px-3">
              <div className="flex flex-1 flex-col gap-1">
                <span className="truncate text-[14px] font-medium text-black">{latestInvoice.number}</span>
                <span className="text-[14px] text-black/70">{new Date(latestInvoice.created * 1000).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US')}</span>
              </div>
              <span className="text-[14px] font-medium text-black">${(latestInvoice.total / 100).toFixed(2)}</span>
              <button onClick={() => handleDownloadInvoice(latestInvoice.invoice_pdf)} className="text-[#FF8A00] transition-opacity hover:opacity-80" title="Download Invoice">
                <Download size={24} />
              </button>
            </div>
          ) : (
            <p className="px-3 text-[14px] italic text-black/40">No invoices yet.</p>
          )}
        </div>
      </div>

      {/* Available plans */}
      <div className="flex flex-col gap-4">
        <h3 className="text-[16px] font-semibold text-black">Available Plans</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {plans.map((plan, idx) => {
            const isActive = plan.id === activePlan;
            return (
              <div key={plan.id || idx} className="flex flex-col gap-6 rounded-xl border border-[rgba(26,29,33,0.3)] bg-white p-8">
                <div className="flex flex-col gap-7">
                  <h4 className="text-[22px] font-medium leading-[31px] text-black">{plan.name}</h4>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[14px] text-black">Starts At</span>
                      <div className="flex items-end gap-2">
                        <span className="text-[18px] font-medium leading-[25px] text-black">{priceMain(plan)}</span>
                        <span className="text-[14px] text-black">{priceSub(plan)}</span>
                      </div>
                    </div>
                    <p className="text-[14px] leading-5 text-[rgba(17,19,21,0.7)]">{plan.description}</p>
                  </div>
                  {isActive ? (
                    <div className="flex h-10 w-full items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white text-[14px] font-medium text-[#FF8A00]">Current Plan</div>
                  ) : (
                    <button
                      onClick={() => handlePlanAction(plan)}
                      style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded text-[14px] font-medium text-white transition-all hover:brightness-[1.03]"
                    >
                      {plan.id === 'ENTERPRISE' ? 'Contact Sales' : `Switch to ${plan.name}`} <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                <div className="h-px w-full bg-[rgba(26,29,33,0.3)]" />
                <div className="flex flex-col gap-3">
                  <span className="text-[16px] font-semibold text-black/50">Features</span>
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check size={16} className="shrink-0 text-[#FF8A00]" strokeWidth={2.5} />
                      <span className="text-[14px] text-black">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CheckoutModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        plan={selectedPlan.name}
        price={selectedPlan.price}
        publishableKey={billingInfo?.publishableKey}
      />
    </div>
  );
};
