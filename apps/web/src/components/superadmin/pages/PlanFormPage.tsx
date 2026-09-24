import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ChevronDown, Check, Bold, Italic, Underline, Strikethrough, Link2, List, ListOrdered, Loader2,
  AlertCircle, X, Plus, Trash2,
} from 'lucide-react';

/**
 * Super Admin → Subscription Plans → Create plan.
 * A faithful build of the multi-section "Create Plan" form (Basic Information,
 * Description with a formatting toolbar, Pricing, Trial Configuration, Resource
 * Limits). Fields map onto the PlanDef row shape; submit hands the assembled
 * draft to the parent, which persists it via the admin plans API.
 */

export type PlanDraft = {
  name: string;
  status: string;
  highlight: string;
  description: string;
  price: string;
  billingPeriod: string;
  priceLabel: string;
  currency: string;
  offerTrial: string;
  trialDays: string;
  autoConvert: string;
  trialReminder: string;
  maxDevices: string;
  maxMembers: string;
  maxSessions: string;
  auditRetention: string;
  /** Bullet points shown on the plan card in the desktop and mobile apps. */
  features: string[];
};

const EMPTY: PlanDraft = {
  name: '', status: 'Active', highlight: 'Standard',
  description: '',
  price: '', billingPeriod: 'Monthly', priceLabel: '', currency: 'USD',
  offerTrial: 'No', trialDays: '14', autoConvert: 'Yes', trialReminder: '1 day before',
  maxDevices: '', maxMembers: '', maxSessions: '', auditRetention: '30 days',
  features: [],
};

const PlanFormPage: React.FC<{
  onBack: () => void; onCreated: (draft: PlanDraft) => void | Promise<void>; mode?: 'create' | 'edit'; initial?: PlanDraft; toast?: string;
}> = ({ onBack, onCreated, mode = 'create', initial, toast }) => {
  const [form, setForm] = useState<PlanDraft>(initial ?? EMPTY);
  const [toastOpen, setToastOpen] = useState(!!toast);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Surface the edit-context toast on mount, then auto-dismiss it.
  useEffect(() => {
    if (!toast) { setToastOpen(false); return; }
    setToastOpen(true);
    const t = setTimeout(() => setToastOpen(false), 8000);
    return () => clearTimeout(t);
  }, [toast]);
  const [errors, setErrors] = useState<Partial<Record<keyof PlanDraft, string>>>({});
  const [saving, setSaving] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const set = (k: keyof PlanDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k: keyof PlanDraft) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const setFeature = (index: number, value: string) =>
    setForm((f) => ({ ...f, features: f.features.map((x, i) => (i === index ? value : x)) }));
  const addFeature = () => setForm((f) => ({ ...f, features: [...f.features, ''] }));
  const removeFeature = (index: number) =>
    setForm((f) => ({ ...f, features: f.features.filter((_, i) => i !== index) }));

  // Wrap/prefix the current textarea selection — powers the description toolbar.
  const applyFormat = (kind: 'bold' | 'italic' | 'underline' | 'strike' | 'link' | 'ul' | 'ol') => {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = form.description;
    const sel = value.slice(start, end) || 'text';
    const wrap = (l: string, r = l) => `${l}${sel}${r}`;
    let replacement = sel;
    let caretShift = 0;
    switch (kind) {
      case 'bold': replacement = wrap('**'); caretShift = 2; break;
      case 'italic': replacement = wrap('_'); caretShift = 1; break;
      case 'underline': replacement = wrap('<u>', '</u>'); caretShift = 3; break;
      case 'strike': replacement = wrap('~~'); caretShift = 2; break;
      case 'link': replacement = `[${sel}](https://)`; caretShift = 1; break;
      case 'ul': replacement = sel.split('\n').map((l) => `- ${l}`).join('\n'); break;
      case 'ol': replacement = sel.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'); break;
    }
    const next = value.slice(0, start) + replacement + value.slice(end);
    setForm((f) => ({ ...f, description: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + caretShift + sel.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const next: Partial<Record<keyof PlanDraft, string>> = {};
    if (!form.name.trim()) next.name = 'Plan name is required.';
    if (!form.price.trim()) next.price = 'Enter a price, or "Custom".';
    if (form.maxDevices && Number.isNaN(Number(form.maxDevices))) next.maxDevices = 'Use a number.';
    if (form.maxMembers && Number.isNaN(Number(form.maxMembers))) next.maxMembers = 'Use a number.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setSubmitError(null);
    try {
      // The parent persists the draft via the admin plans API and closes the
      // form on success; a thrown error keeps the form open with the message.
      await onCreated(form);
    } catch (err: any) {
      setSubmitError(err?.message || 'Saving the plan failed.');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-7 pb-4">
      {/* Edit-context toast */}
      {toast && toastOpen && (
        <div className="fixed right-6 top-[76px] z-[70] flex w-[419px] max-w-[calc(100vw-2rem)] items-center justify-between gap-6 rounded-[4px] bg-white px-3 py-1.5 shadow-[-4px_4px_12px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
              <AlertCircle size={16} />
            </span>
            <p className="text-xs font-medium leading-[17px] text-[#1A1D21]">{toast}</p>
          </div>
          <button onClick={() => setToastOpen(false)} className="shrink-0 text-[#1A1D21] hover:opacity-70" aria-label="Dismiss">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <button onClick={onBack} className="flex items-center gap-2 text-lg font-semibold text-black hover:opacity-70">
          <ArrowLeft size={20} /> {mode === 'edit' ? 'Edit Plan' : 'Create Plan'}
        </button>
        <p className="text-sm text-black/70">
          {mode === 'edit'
            ? 'Update this plan’s pricing, trial, and the limits organizations get.'
            : 'Define a new subscription plan — pricing, trial, and the limits organizations get.'}
        </p>
      </div>

      {/* Basic Information */}
      <Section title="Basic Information">
        <div className="grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-[2fr_1fr_1fr]">
          <Field label="Plan Name" error={errors.name}>
            <TextInput value={form.name} onChange={set('name')} placeholder="e.g. Pro" invalid={!!errors.name} />
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={setVal('status')} options={['Active', 'Draft', 'Archived']} />
          </Field>
          <Field label="Highlight">
            <SelectInput value={form.highlight} onChange={setVal('highlight')} options={['Standard', 'Popular']} />
          </Field>
        </div>
      </Section>

      <Divider />

      {/* Description */}
      <Section title="Plan Description">
        <div className="overflow-hidden rounded-[4px] border border-[rgba(26,29,33,0.3)]">
          <textarea
            ref={descRef}
            value={form.description}
            onChange={set('description')}
            placeholder="Enter your plan description"
            className="block h-[200px] w-full resize-none px-[18px] py-3 text-sm text-[#1D2026] outline-none placeholder:text-[rgba(26,29,33,0.3)]"
          />
          <div className="flex items-center gap-2 border-t border-[rgba(26,29,33,0.3)] bg-white px-3 py-2">
            <ToolbarButton title="Bold" onClick={() => applyFormat('bold')} active><Bold size={16} /></ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => applyFormat('italic')}><Italic size={16} /></ToolbarButton>
            <ToolbarButton title="Underline" onClick={() => applyFormat('underline')}><Underline size={16} /></ToolbarButton>
            <ToolbarButton title="Strikethrough" onClick={() => applyFormat('strike')}><Strikethrough size={16} /></ToolbarButton>
            <ToolbarButton title="Link" onClick={() => applyFormat('link')}><Link2 size={16} /></ToolbarButton>
            <ToolbarButton title="Bulleted list" onClick={() => applyFormat('ul')}><List size={16} /></ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={() => applyFormat('ol')}><ListOrdered size={16} /></ToolbarButton>
          </div>
        </div>
      </Section>

      <Divider />

      {/* Features */}
      <Section title="Plan Features">
        <p className="-mt-3 text-sm text-black/60">
          Shown as bullet points on the plan card in the desktop and mobile apps. Leave empty to auto-generate from the limits below.
        </p>
        <div className="flex max-w-[560px] flex-col gap-3">
          {form.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={feature}
                onChange={(e) => setFeature(i, e.target.value)}
                placeholder="e.g. 50 devices"
                className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
              />
              <button
                type="button"
                onClick={() => removeFeature(i)}
                title="Remove feature"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-[rgba(26,29,33,0.5)] hover:bg-[#F3F4F6] hover:text-[#D92D20]"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addFeature}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"
          >
            <Plus size={16} /> Add feature
          </button>
        </div>
      </Section>

      <Divider />

      {/* Pricing */}
      <Section title="Pricing">
        <TwoUp>
          <Field label="Price" error={errors.price}>
            <TextInput value={form.price} onChange={set('price')} placeholder="e.g. 40 or Custom" invalid={!!errors.price} />
          </Field>
          <Field label="Billing Period">
            <SelectInput value={form.billingPeriod} onChange={setVal('billingPeriod')} options={['Monthly', 'Yearly', 'One-time', 'Custom']} />
          </Field>
        </TwoUp>
        <TwoUp>
          <Field label="Price Label">
            <TextInput value={form.priceLabel} onChange={set('priceLabel')} placeholder="e.g. $40 / month" />
          </Field>
          <Field label="Currency">
            <SelectInput value={form.currency} onChange={setVal('currency')} options={['USD', 'EUR', 'GBP', 'SAR', 'PKR']} />
          </Field>
        </TwoUp>
      </Section>

      <Divider />

      {/* Trial Configuration */}
      <Section title="Trial Configuration">
        <TwoUp>
          <Field label="Offer Trial">
            <SelectInput value={form.offerTrial} onChange={setVal('offerTrial')} options={['No', 'Yes']} />
          </Field>
          <Field label="Trial Length">
            <SelectInput value={form.trialDays} onChange={setVal('trialDays')} options={['7', '14', '15', '30']} disabled={form.offerTrial === 'No'} suffix="days" />
          </Field>
        </TwoUp>
        <TwoUp>
          <Field label="Auto-convert After Trial">
            <SelectInput value={form.autoConvert} onChange={setVal('autoConvert')} options={['Yes', 'No']} disabled={form.offerTrial === 'No'} />
          </Field>
          <Field label="Trial Reminder">
            <SelectInput value={form.trialReminder} onChange={setVal('trialReminder')} options={['1 day before', '3 days before', '7 days before', 'None']} disabled={form.offerTrial === 'No'} />
          </Field>
        </TwoUp>
      </Section>

      <Divider />

      {/* Resource Limits */}
      <Section title="Resource Limits">
        <TwoUp>
          <Field label="Max Devices" error={errors.maxDevices} hint="Leave empty for unlimited">
            <TextInput value={form.maxDevices} onChange={set('maxDevices')} placeholder="e.g. 50" invalid={!!errors.maxDevices} />
          </Field>
          <Field label="Max Members" error={errors.maxMembers} hint="Leave empty for unlimited">
            <TextInput value={form.maxMembers} onChange={set('maxMembers')} placeholder="e.g. 5" invalid={!!errors.maxMembers} />
          </Field>
        </TwoUp>
        <TwoUp>
          <Field label="Max Concurrent Sessions" hint="Leave empty for unlimited">
            <TextInput value={form.maxSessions} onChange={set('maxSessions')} placeholder="e.g. 3" />
          </Field>
          <Field label="Audit Log Retention">
            <SelectInput value={form.auditRetention} onChange={setVal('auditRetention')} options={['No retention', '30 days', '90 days', '1 year', 'Custom']} />
          </Field>
        </TwoUp>
      </Section>

      {/* Footer actions */}
      <div className="mt-2 flex items-center justify-end gap-3 border-t border-[rgba(26,29,33,0.1)] pt-5">
        {submitError && <span className="mr-auto text-sm text-[#D92D20]">{submitError}</span>}
        <button
          onClick={onBack}
          className="inline-flex h-10 items-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-5 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[4px] px-5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === 'edit' ? 'Save Changes' : 'Create Plan'}
        </button>
      </div>
    </div>
  );
};

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

const Field: React.FC<{ label: string; error?: string; hint?: string; children: React.ReactNode }> = ({ label, error, hint, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm text-[#111315]">{label}</span>
    {children}
    {error ? (
      <span className="text-xs text-[#D92D20]">{error}</span>
    ) : hint ? (
      <span className="text-xs text-[rgba(17,19,21,0.45)]">{hint}</span>
    ) : null}
  </label>
);

const TextInput: React.FC<{
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; invalid?: boolean;
}> = ({ value, onChange, placeholder, invalid }) => (
  <input
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`h-10 w-full rounded-[4px] border bg-white px-4 text-sm text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00] ${
      invalid ? 'border-[#D92D20]' : 'border-[rgba(26,29,33,0.3)]'
    }`}
  />
);

const SelectInput: React.FC<{
  value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean; suffix?: string;
}> = ({ value, onChange, options, disabled, suffix }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = (v: string) => (suffix ? `${v} ${suffix}` : v);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 w-full items-center justify-between rounded-[4px] border bg-white px-4 text-left text-sm text-[#111315] outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)] hover:border-[rgba(26,29,33,0.5)]'
        }`}
      >
        <span className="truncate">{label(value)}</span>
        <ChevronDown size={16} className={`ml-2 shrink-0 text-[#111315] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-auto rounded-xl border border-[rgba(26,29,33,0.15)] bg-white py-1 shadow-xl">
          {options.map((o) => {
            const selected = o === value;
            return (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[#F9FAFB] ${selected ? 'font-medium text-[#FF8A00]' : 'text-[#111315]'}`}
              >
                <span className="truncate">{label(o)}</span>
                {selected && <Check size={16} className="ml-2 shrink-0 text-[#FF8A00]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ToolbarButton: React.FC<{ title: string; active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ title, active, onClick, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`flex h-[30px] w-[30px] items-center justify-center rounded text-[#1A1D21] hover:bg-[#F3F4F6] ${active ? 'bg-[#F3F4F6]' : 'bg-white'}`}
  >
    {children}
  </button>
);

export default PlanFormPage;
