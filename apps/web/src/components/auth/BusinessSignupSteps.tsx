import React, { useState } from 'react';
import { BusinessLocationFields } from './BusinessLocationFields';
import { type BusinessErrors, type BusinessForm, hasErrors, validateAddressStep, validateCompanyStep } from '../../lib/businessValidation';

export interface BusinessStepLabels {
  steps: [string, string, string];
  companyName: string;
  businessNumber: string;
  website: string;
  country: string;
  state: string;
  province: string;
  city: string;
  address: string;
  zip: string;
  next: string;
  back: string;
}

interface BusinessSignupStepsProps {
  form: BusinessForm;
  onChange: (key: keyof BusinessForm, value: string) => void;
  /** 1 = company, 2 = address, 3 = account (rendered by the parent form). */
  step: number;
  setStep: (step: number) => void;
  labels: BusinessStepLabels;
  inputClass: string;
}

/**
 * Steps 1 and 2 of the Business sign-up (company details, then address).
 * Each step validates before moving on; step 3 (company email + password) is
 * the parent form's own fields. The parent renders the stepper header via
 * BusinessStepper so it also shows on step 3.
 */
export const BusinessSignupSteps: React.FC<BusinessSignupStepsProps> = ({ form, onChange, step, setStep, labels, inputClass }) => {
  const [errors, setErrors] = useState<BusinessErrors>({});

  const label = (text: string) => <div style={{ fontSize: '14px', fontWeight: 400, color: '#111315', height: '24px' }}>{text}</div>;
  const error = (key: keyof BusinessErrors) => errors[key] ? <p className="m-0 text-[11px] font-medium text-red-500">{errors[key]}</p> : null;
  const field = (key: keyof BusinessForm, text: string, placeholder: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <div className="flex flex-col gap-[8px]">
      {label(text)}
      <input
        type="text"
        value={form[key]}
        onChange={(e) => { onChange(key, e.target.value); if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined })); }}
        placeholder={placeholder}
        className={`${inputClass}${errors[key] ? ' border-red-400' : ''}`}
        style={{ height: '40px' }}
        {...extra}
      />
      {error(key)}
    </div>
  );

  const next = () => {
    const found = step === 1 ? validateCompanyStep(form) : validateAddressStep(form);
    setErrors(found);
    if (!hasErrors(found)) setStep(step + 1);
  };

  return (
    <div className="flex flex-col gap-[16px]">
      {step === 1 && (
        <>
          {field('companyName', labels.companyName, 'Acme GmbH', { autoFocus: true })}
          {field('businessNumber', labels.businessNumber, 'Registration or tax number')}
          {field('website', labels.website, 'company.com (optional)', { inputMode: 'url' })}
        </>
      )}
      {step === 2 && (
        <>
          <BusinessLocationFields
            value={{ country: form.country, state: form.state, city: form.city }}
            onChange={(key, value) => { onChange(key, value); if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined })); }}
            labels={{ country: labels.country, state: form.country === 'Canada' ? labels.province : labels.state, city: labels.city }}
            inputClass={inputClass}
          />
          {(errors.country || errors.state || errors.city) && (
            <p className="m-0 -mt-2 text-[11px] font-medium text-red-500">{errors.country || errors.state || errors.city}</p>
          )}
          <div className="grid grid-cols-2 gap-[12px]">
            {field('addressLine', labels.address, 'Street and number')}
            {field('postalCode', labels.zip, '10115 (optional)')}
          </div>
        </>
      )}
      <div className="flex items-center justify-between gap-2">
        {step > 1 ? (
          <button type="button" onClick={() => setStep(step - 1)} className="h-10 rounded-[4px] border border-[rgba(26,29,33,0.3)] px-4 text-[14px] font-medium text-[#111315] hover:bg-[#F3F4F6]">
            {labels.back}
          </button>
        ) : <span />}
        <button type="button" onClick={next} className="h-10 rounded-[4px] px-5 text-[14px] font-medium text-[#111315]" style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}>
          {labels.next}
        </button>
      </div>
    </div>
  );
};

/** 1 Company · 2 Address · 3 Account */
export const BusinessStepper: React.FC<{ step: number; steps: [string, string, string]; onStep?: (step: number) => void }> = ({ step, steps, onStep }) => (
  <div className="flex items-center gap-2">
    {steps.map((title, index) => {
      const n = index + 1;
      const done = n < step;
      const active = n === step;
      return (
        <React.Fragment key={title}>
          {index > 0 && <span className={`h-px flex-1 ${done || active ? 'bg-[#FF8A00]' : 'bg-[rgba(26,29,33,0.2)]'}`} />}
          <button
            type="button"
            onClick={() => { if (done && onStep) onStep(n); }}
            className={`flex items-center gap-1.5 text-[12px] font-medium ${active ? 'text-[#FF8A00]' : done ? 'text-[#111315]' : 'text-[rgba(26,29,33,0.45)]'}`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${active || done ? 'bg-[#FF8A00] text-white' : 'bg-[#F3F4F6] text-[rgba(26,29,33,0.6)]'}`}>{done ? '✓' : n}</span>
            {title}
          </button>
        </React.Fragment>
      );
    })}
  </div>
);

export default BusinessSignupSteps;
