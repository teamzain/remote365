import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronDown, CreditCard, Download, FileText, Loader2, Monitor, Users } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import CheckoutModal from '../billing/CheckoutModal';

interface Plan {
  id: string;
  name: string;
  price: number | string | null;
  priceLabel?: string;
  description: string;
  maxDevices: number | null;
  maxUsers: number | null;
  features: string[];
}

const gradient = { background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' };
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/**
 * Phone version of Plan and billing: the current plan as a hero card with
 * usage tiles, the card on file and invoices as list rows, and the plans as a
 * horizontal snap carousel with one CTA each. Checkout is the shared modal.
 */
export const WebMobileBilling: React.FC = () => {
  const { user } = useAuthStore();
  const lang = user?.language;
  const locale = lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US';
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [checkout, setCheckout] = useState<{ name: string; price: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([api.get('/api/billing/plans'), api.get('/api/billing/current')]);
      const list = Array.isArray(plansRes.data) ? plansRes.data : plansRes.data.plans || [];
      setPlans(list);
      setBilling({ ...subRes.data, publishableKey: plansRes.data.publishableKey || subRes.data.publishableKey });
    } catch {
      /* the page shows what it has */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const onChanged = () => fetchData();
    window.addEventListener('remote365:billing-changed', onChanged);
    return () => window.removeEventListener('remote365:billing-changed', onChanged);
  }, []);

  const activePlan = billing?.plan || 'TRIAL';
  const current = plans.find((plan) => plan.id === activePlan);
  const isLifetime = !billing?.currentPeriodEnd && activePlan !== 'TRIAL';
  const renewal = billing?.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString(locale) : null;
  const invoices: any[] = billing?.invoices || [];
  const priceMain = (plan: Plan) => (typeof plan.price === 'number' ? `$${plan.price}` : plan.price ? String(plan.price) : '$0');
  const priceSub = (plan: Plan) => (!plan.price || plan.price === 0 ? 'free forever' : '/ month');

  const choose = (plan: Plan) => {
    if (plan.id === activePlan || plan.id === 'TRIAL') return;
    if (plan.id === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@remote365.com';
      return;
    }
    setCheckout({ name: plan.id, price: String(plan.price) });
  };

  return (
    <div className="flex h-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="flex h-14 flex-none items-center border-b border-[rgba(26,29,33,0.1)] px-4">
        <span className="text-[15px] font-semibold text-[#111315]">Plan and billing</span>
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[#FF8A00]"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Current plan */}
          <div className="px-4 pt-4">
            <div className="rounded-2xl p-4 text-white" style={gradient}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-white/80">Current plan</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">{activePlan === 'TRIAL' ? 'Trial' : billing?.cancelAtPeriodEnd ? 'Cancels' : 'Active'}</span>
              </div>
              <p className="m-0 mt-1 text-[24px] font-semibold leading-8">{current?.name || cap(String(activePlan))}</p>
              <p className="m-0 mt-0.5 text-[12px] text-white/85">
                {isLifetime ? 'Lifetime access' : renewal ? `${billing?.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on ${renewal}` : 'No renewal date'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/15 px-3 py-2">
                  <span className="flex items-center gap-1 text-[11px] text-white/80"><Monitor size={12} /> Devices</span>
                  <span className="block text-[18px] font-semibold">{current?.maxDevices ?? '∞'}</span>
                </div>
                <div className="rounded-xl bg-white/15 px-3 py-2">
                  <span className="flex items-center gap-1 text-[11px] text-white/80"><Users size={12} /> Users</span>
                  <span className="block text-[18px] font-semibold">{current?.maxUsers ?? '∞'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment + invoices */}
          <div className="mt-5 px-4">
            <p className="m-0 mb-1 text-[12px] font-medium text-[#111315]/45">Payment</p>
            <div className="flex items-center gap-3 border-b border-[rgba(26,29,33,0.06)] py-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F3F4F6] text-[#111315]/60"><CreditCard size={16} /></span>
              <div className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-[#111315]">{billing?.card_brand ? `${cap(billing.card_brand)} ending in ${billing.card_last4}` : 'No card on file'}</span>
                <span className="block text-[12px] text-[#111315]/45">{billing?.card_exp_month ? `Expires ${billing.card_exp_month}/${billing.card_exp_year}` : 'Added when you pick a paid plan'}</span>
              </div>
            </div>
            {invoices.length === 0 ? (
              <p className="m-0 py-3 text-[13px] text-[#111315]/45">No invoices yet.</p>
            ) : (
              <>
                {(showAllInvoices ? invoices : invoices.slice(0, 3)).map((invoice) => (
                  <div key={invoice.id || invoice.number} className="flex items-center gap-3 border-b border-[rgba(26,29,33,0.06)] py-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F3F4F6] text-[#111315]/60"><FileText size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-[#111315]">{invoice.number || 'Invoice'}</span>
                      <span className="block text-[12px] text-[#111315]/45">{new Date(invoice.created * 1000).toLocaleDateString(locale)}</span>
                    </div>
                    <span className="text-[14px] font-medium text-[#111315]">${(invoice.total / 100).toFixed(2)}</span>
                    {invoice.invoice_pdf && (
                      <button type="button" aria-label="Download invoice" onClick={() => window.open(invoice.invoice_pdf, '_blank')} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#FF8A00] active:bg-[#FFF1E0]">
                        <Download size={17} />
                      </button>
                    )}
                  </div>
                ))}
                {invoices.length > 3 && (
                  <button type="button" onClick={() => setShowAllInvoices((value) => !value)} className="flex w-full items-center justify-center gap-1 py-3 text-[13px] font-medium text-[#FF8A00]">
                    {showAllInvoices ? 'Show fewer' : `All ${invoices.length} invoices`} <ChevronDown size={14} className={showAllInvoices ? 'rotate-180' : ''} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Plans carousel */}
          <div className="mt-5">
            <p className="m-0 mb-2 px-4 text-[12px] font-medium text-[#111315]/45">Plans</p>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4" style={{ scrollbarWidth: 'none' }}>
              {plans.map((plan) => {
                const active = plan.id === activePlan;
                const open = expanded === plan.id;
                const features = open ? plan.features : plan.features.slice(0, 4);
                return (
                  <div key={plan.id} className={`flex w-[82vw] max-w-[340px] flex-none snap-center flex-col rounded-2xl border p-4 ${active ? 'border-[#FF8A00] bg-[#FFF8F0]' : 'border-[rgba(26,29,33,0.12)] bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[17px] font-semibold text-[#111315]">{plan.name}</span>
                      {active && <span className="rounded-full bg-[#FF8A00] px-2 py-0.5 text-[10px] font-semibold text-white">Current</span>}
                    </div>
                    <p className="m-0 mt-1 flex items-end gap-1">
                      <span className="text-[22px] font-semibold leading-7 text-[#111315]">{priceMain(plan)}</span>
                      <span className="text-[12px] text-[#111315]/50">{priceSub(plan)}</span>
                    </p>
                    <p className="m-0 mt-1 text-[12px] leading-4 text-[#111315]/60">{plan.description}</p>
                    <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
                      {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-[12px] leading-4 text-[#111315]">
                          <Check size={14} className="mt-0.5 flex-none text-[#FF8A00]" strokeWidth={2.5} />{feature}
                        </li>
                      ))}
                    </ul>
                    {plan.features.length > 4 && (
                      <button type="button" onClick={() => setExpanded(open ? null : plan.id)} className="mt-1 self-start text-[12px] font-medium text-[#FF8A00]">
                        {open ? 'Show less' : `+${plan.features.length - 4} more`}
                      </button>
                    )}
                    <div className="flex-1" />
                    {active ? (
                      <div className="mt-4 flex h-11 items-center justify-center rounded-xl border border-[rgba(26,29,33,0.15)] text-[13px] font-semibold text-[#FF8A00]">Your plan</div>
                    ) : plan.id === 'TRIAL' ? (
                      <div className="mt-4 flex h-11 items-center justify-center rounded-xl border border-[rgba(26,29,33,0.15)] text-[13px] font-semibold text-[#111315]/45">Trial</div>
                    ) : (
                      <button type="button" onClick={() => choose(plan)} className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white" style={gradient}>
                        {plan.id === 'ENTERPRISE' ? 'Contact sales' : `Switch to ${plan.name}`} <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="h-6" />
        </div>
      )}

      <CheckoutModal
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        plan={checkout?.name || ''}
        price={checkout?.price || ''}
        publishableKey={billing?.publishableKey}
      />
    </div>
  );
};

export default WebMobileBilling;
