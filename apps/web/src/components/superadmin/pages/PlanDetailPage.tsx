import React from 'react';
import {
  ArrowLeft, Pencil, Users, Receipt,
  Bold, Italic, Underline, Strikethrough, Link2, List, ListOrdered,
} from 'lucide-react';
import type { Plan } from './SubscriptionPlansPage';

/**
 * Super Admin → Subscription Plans → Plan detail.
 * Read-only view of a plan: a meta header (created / status / last modified),
 * four activity stat cards (mock until billing analytics land), and the plan's
 * configuration laid out in the same sections as the create form.
 */

const limitLabel = (n: number | null) => (n === null ? 'Unlimited' : String(n));
const money = (n: number | null) => (n === null ? 'Custom' : `$${n.toLocaleString()}`);

const PlanDetailPage: React.FC<{ plan: Plan; onBack: () => void; onEdit: () => void }> = ({ plan, onBack, onEdit }) => {
  const offerTrial = plan.trialDays ? 'Yes' : 'No';
  const trialLength = plan.trialDays ? `${plan.trialDays} days` : '—';
  const billing = plan.billingPeriod || (plan.price === 'Custom' ? 'Custom' : plan.price === 0 ? 'Free' : 'Monthly');
  const audit = plan.auditRetentionDays == null
    ? 'No retention'
    : plan.auditRetentionDays === 'Custom' ? 'Custom' : `${plan.auditRetentionDays} days`;

  return (
    <div className="flex flex-col gap-7 pb-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <button onClick={onBack} className="flex items-center gap-2 text-lg font-semibold text-black hover:opacity-70">
            <ArrowLeft size={20} /> {plan.name}
          </button>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-7 text-xs font-medium text-[rgba(17,19,21,0.6)]">
            {plan.createdOn && <span>Created On: <span className="text-black">{plan.createdOn}</span></span>}
            <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${plan.status === 'Active' ? 'bg-[#ECFDF3] text-[#34C759]' : 'bg-[#F3F4F6] text-[rgba(17,19,21,0.6)]'}`}>{plan.status}</span>
            {plan.lastModified && <span>Last Modified on: <span className="text-black">{plan.lastModified}</span></span>}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
        >
          <Pencil size={16} />
          Edit Plan
        </button>
      </div>

      {/* Stat cards — only metrics we actually track. Growth / active devices /
          renewal rate aren't computed yet, so they're omitted rather than faked. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StatCard title="Subscribers" value={plan.subscribers.toLocaleString()} icon={Users} />
        <StatCard title="Monthly Revenue" value={money(plan.monthlyRevenue)} sub="gross MRR" icon={Receipt} />
      </div>

      {/* Basic Information */}
      <Section title="Basic Information">
        <div className="grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-[2fr_1fr_1fr]">
          <ReadField label="Plan Name" value={plan.name} />
          <ReadField label="Status" value={plan.status} />
          <ReadField label="Highlight" value={plan.popular ? 'Popular' : 'Standard'} />
        </div>
      </Section>

      <Divider />

      {/* Plan Description */}
      <Section title="Plan Description">
        <div className="overflow-hidden rounded-[4px] border border-[rgba(26,29,33,0.3)]">
          <div className="min-h-[110px] whitespace-pre-wrap px-[18px] py-3 text-sm text-[#1D2026]">{plan.description}</div>
          <div className="flex items-center gap-2 border-t border-[rgba(26,29,33,0.3)] bg-white px-3 py-2 opacity-60">
            {[Bold, Italic, Underline, Strikethrough, Link2, List, ListOrdered].map((Icon, i) => (
              <span key={i} className="flex h-[30px] w-[30px] items-center justify-center rounded text-[#1A1D21]"><Icon size={16} /></span>
            ))}
          </div>
        </div>
      </Section>

      <Divider />

      {/* Pricing */}
      <Section title="Pricing">
        <TwoUp>
          <ReadField label="Price" value={plan.priceLabel} />
          <ReadField label="Billing Period" value={billing} />
        </TwoUp>
        <TwoUp>
          <ReadField label="Price Label" value={plan.priceLabel} />
          <ReadField label="Currency" value={plan.currency || 'USD'} />
        </TwoUp>
      </Section>

      <Divider />

      {/* Trial Configuration */}
      <Section title="Trial Configuration">
        <TwoUp>
          <ReadField label="Offer Trial" value={offerTrial} />
          <ReadField label="Trial Length" value={trialLength} />
        </TwoUp>
        <TwoUp>
          <ReadField label="Auto-convert After Trial" value={plan.trialDays ? ((plan.autoConvert ?? true) ? 'Yes' : 'No') : '—'} />
          <ReadField label="Trial Reminder" value={plan.trialDays ? (plan.trialReminder || 'None') : '—'} />
        </TwoUp>
      </Section>

      <Divider />

      {/* Resource Limits */}
      <Section title="Resource Limits">
        <TwoUp>
          <ReadField label="Max Devices" value={limitLabel(plan.maxDevices)} />
          <ReadField label="Max Members" value={limitLabel(plan.maxUsers)} />
        </TwoUp>
        <TwoUp>
          <ReadField label="Max Concurrent Sessions" value={limitLabel(plan.maxConcurrentSessions)} />
          <ReadField label="Audit Log Retention" value={audit} />
        </TwoUp>
      </Section>

      {/* Included features */}
      <Divider />
      <Section title="Included Features">
        <div className="grid grid-cols-1 gap-x-12 gap-y-2.5 sm:grid-cols-2">
          {plan.features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-[#111315]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8A00]" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

const StatCard: React.FC<{
  title: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>;
}> = ({ title, value, sub, icon: Icon }) => (
  <div className="flex items-center justify-between rounded-xl border-[0.5px] border-[rgba(26,29,33,0.3)] bg-white px-6 py-7">
    <div className="flex flex-col gap-3">
      <span className="text-[15px] font-medium text-[#1A1D21]">{title}</span>
      <span className="text-lg font-medium leading-none text-[#111315]">
        {value}
        {sub && <span className="ml-1 text-xs font-normal text-[#34C759]">({sub})</span>}
      </span>
    </div>
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
      <Icon size={18} />
    </div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-[22px]">
    <h2 className="text-lg font-medium text-black">{title}</h2>
    <div className="flex flex-col gap-7">{children}</div>
  </section>
);

const Divider: React.FC = () => <div className="h-px w-full bg-[rgba(26,29,33,0.3)]" />;

const TwoUp: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-2">{children}</div>
);

const ReadField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-[#111315]">{label}</span>
    <div className="flex h-10 items-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-[#FAFAFA] px-4 text-sm text-[#111315]">
      {value}
    </div>
  </div>
);

export default PlanDetailPage;
