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
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import CheckoutModal from '../billing/CheckoutModal';
import { t } from '../../lib/translations';

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

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-lato pb-10">

      {/* Test Mode Banner */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border border-blue-200 rounded-2xl">
        <FlaskConical size={16} className="text-blue-600 flex-shrink-0" />
        <div>
          <span className="text-xs font-bold text-blue-700">{t('billing_active', lang)} — </span>
          <span className="text-xs text-blue-600 font-medium">
            {t('test_env_notice', lang)}
          </span>
        </div>
      </div>

      {/* Current Plan Card */}
      <div className="bg-[#1C1C1C] rounded-[24px] p-8 text-white relative overflow-hidden shadow-xl shadow-black/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] -mr-32 -mt-32 rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">{t('active_subscription', lang)}</p>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-bold tracking-tight">
                {loading ? '—' : (activePlan)}
              </h2>
              <span className="px-2 py-0.5 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white/60">
                {loading ? '…' : (currentPlanData?.priceLabel || t('free_label', lang))}
              </span>
            </div>
            <p className="text-sm text-white/40 font-medium">{isLifetime ? 'Lifetime access' : `${t('renews_on', lang)} ${renewalDate}`}</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col items-center gap-1">
              <Monitor size={18} className="text-white/30" />
              <span className="text-lg font-bold text-white">{currentPlanData?.maxDevices ?? '∞'}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{t('devices_label', lang)}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Users size={18} className="text-white/30" />
              <span className="text-lg font-bold text-white">{currentPlanData?.maxUsers ?? '∞'}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{t('users_label', lang)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Method */}
        <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#1C1C1C] mb-4">{t('payment_method', lang)}</h3>
          <div className="p-4 bg-[rgba(28,28,28,0.02)] rounded-[18px] border border-[rgba(28,28,28,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-6 bg-[#1C1C1C] rounded flex items-center justify-center text-white text-[8px] italic font-black">{billingInfo?.card_brand?.toUpperCase() || 'VISA'}</div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1C1C1C]">{billingInfo?.card_brand ? `${billingInfo.card_brand.charAt(0).toUpperCase() + billingInfo.card_brand.slice(1)} ending in ${billingInfo.card_last4}` : t('no_card_file', lang)}</span>
                <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">{billingInfo?.card_exp_month ? `${t('expires', lang)} ${billingInfo.card_exp_month}/${billingInfo.card_exp_year}` : t('add_payment_method', lang)}</span>
              </div>
            </div>
            {billingInfo?.card_brand && <CheckCircle2 size={16} className="text-emerald-500" />}
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm overflow-hidden">
          <h3 className="text-sm font-bold text-[#1C1C1C] mb-4">{t('recent_invoices', lang)}</h3>
          <div className="space-y-3">
            {billingInfo?.invoices?.map((inv: any, idx: number) => (
              <div key={inv.id || idx} className="flex items-center justify-between py-2 border-b border-[rgba(0,0,0,0.02)] last:border-0">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-[#1C1C1C]">{inv.number}</span>
                  <span className="text-[9px] text-[rgba(28,28,28,0.4)] font-medium">{new Date(inv.created * 1000).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[#1C1C1C]">${(inv.total / 100).toFixed(2)}</span>
                  <button
                    onClick={() => handleDownloadInvoice(inv.invoice_pdf)}
                    className="p-1.5 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors"
                    title="Download Invoice"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
            {(!billingInfo?.invoices || billingInfo.invoices.length === 0) && (
              <p className="text-[11px] text-[rgba(28,28,28,0.3)] italic text-center py-2">{t('no_invoices', lang)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Plan Cards */}
      <div>
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-4 px-1">
          {loading ? t('loading_plans', lang) : t('available_plans', lang)}
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-52 bg-[rgba(28,28,28,0.04)] rounded-[20px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan, idx) => {
              const accent = PLAN_ACCENT[plan.id] || PLAN_ACCENT.TRIAL;
              const isActive = plan.id === activePlan;

              return (
                <div
                  key={plan.id || idx}
                  className={`relative rounded-[20px] border p-6 transition-all duration-200 ${isActive
                    ? `${accent.bg} ${accent.border} shadow-sm`
                    : 'bg-white border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] hover:shadow-md hover:shadow-black/5'
                    }`}
                >
                  {/* Active badge */}
                  {isActive && (
                    <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${accent.bg} ${accent.color} border ${accent.border}`}>
                      {t('current_label', lang)}
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-white shadow-sm' : 'bg-[rgba(28,28,28,0.04)]'} ${accent.color}`}>
                      {PLAN_ICONS[plan.id]}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1C1C1C]">{plan.name}</h4>
                      <p className="text-[11px] text-[rgba(28,28,28,0.4)] font-medium">{plan.priceLabel}</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5 mb-5">
                    {plan.features.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check size={11} className={`flex-shrink-0 ${isActive ? accent.color : 'text-[rgba(28,28,28,0.25)]'}`} />
                        <span className="text-[11px] text-[rgba(28,28,28,0.6)] font-medium">{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action button */}
                  {isActive ? (
                    <div className={`w-full py-2.5 rounded-xl text-xs font-bold text-center ${accent.color} ${accent.bg} border ${accent.border}`}>
                      {t('active_plan_btn', lang)}
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePlanAction(plan)}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#1C1C1C] text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                      {t('switch_to', lang)} {plan.name} <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
