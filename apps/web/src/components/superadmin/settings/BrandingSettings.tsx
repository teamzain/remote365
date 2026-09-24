import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { Field, TextInput, SelectInput } from './fields';

/**
 * Settings → Branding.
 * Logo upload row (grey circle, PNG/JPEG under 2MB), a 2×2 field grid, and
 * rounded Cancel / Save Changes actions. No persistence endpoint yet — Save
 * keeps a local snapshot that Cancel restores.
 */

type BrandingForm = {
  brandName: string;
  supportEmail: string;
  language: string;
  timeZone: string;
};

const DEFAULTS: BrandingForm = {
  brandName: 'Remote365',
  supportEmail: 'support@remote365.co',
  language: 'English',
  timeZone: '(GMT+00:00) London',
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const BrandingSettings: React.FC = () => {
  const [form, setForm] = useState<BrandingForm>(DEFAULTS);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ form: BrandingForm; logo: string | null }>({ form: DEFAULTS, logo: null });
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof BrandingForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = logo !== saved.logo || (Object.keys(form) as (keyof BrandingForm)[]).some((k) => form[k] !== saved.form[k]);

  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setLogoError('Only PNG or JPEG images are allowed.'); return; }
    if (file.size > MAX_LOGO_BYTES) { setLogoError('Image must be under 2MB.'); return; }
    setLogoError(null);
    setLogo((prev) => {
      if (prev && prev !== saved.logo) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removeLogo = () => {
    setLogoError(null);
    setLogo((prev) => {
      if (prev && prev !== saved.logo) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const cancel = () => { setForm(saved.form); setLogo(saved.logo); setLogoError(null); };

  const save = () => {
    setSaved({ form, logo });
    setSavedFlash(true);
  };

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [savedFlash]);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        {/* Logo upload */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F3F4F6]">
              {logo ? (
                <img src={logo} alt="Main logo" className="h-full w-full object-cover" />
              ) : (
                <Camera size={30} className="text-[rgba(26,29,33,0.7)]" strokeWidth={1.5} />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-black">Main Logo</span>
              <span className="text-xs font-medium text-[rgba(26,29,33,0.7)]">PNG, JPEG under 2MB</span>
              {logoError && <span className="text-xs text-[#D92D20]">{logoError}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={pickLogo} />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-10 items-center justify-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"
            >
              Upload new picture
            </button>
            <button
              onClick={removeLogo}
              disabled={!logo}
              className={`inline-flex h-10 items-center justify-center rounded-[4px] border border-[#F3F4F6] bg-[#F3F4F6] px-4 text-sm font-medium ${
                logo ? 'text-[#111315] hover:border-[rgba(26,29,33,0.3)]' : 'cursor-not-allowed text-[rgba(26,29,33,0.3)]'
              }`}
            >
              Delete
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-2">
          <Field label="Brand Name">
            <TextInput value={form.brandName} onChange={set('brandName')} placeholder="e.g. Remote365" />
          </Field>
          <Field label="Support Email">
            <TextInput value={form.supportEmail} onChange={set('supportEmail')} placeholder="e.g. support@remote365.co" />
          </Field>
          <Field label="Default Language">
            <SelectInput value={form.language} onChange={set('language')} options={['English', 'German', 'French', 'Spanish', 'Arabic']} />
          </Field>
          <Field label="Time Zone">
            <SelectInput
              value={form.timeZone}
              onChange={set('timeZone')}
              options={['(GMT+00:00) London', '(GMT+01:00) Berlin', '(GMT+04:00) Dubai', '(GMT+05:00) Karachi', '(GMT-05:00) New York', '(GMT-08:00) Los Angeles']}
            />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {savedFlash && (
          <span className="mr-2 inline-flex items-center gap-1 text-sm font-medium text-[#34C759]">
            <Check size={16} /> Applied for this session (server storage coming soon)
          </span>
        )}
        <button
          onClick={cancel}
          disabled={!dirty}
          className="inline-flex h-10 w-[150px] items-center justify-center rounded-[32px] border border-[#F3F4F6] bg-white text-sm font-medium text-[rgba(26,29,33,0.7)] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!dirty}
          className="inline-flex h-10 w-[150px] items-center justify-center rounded-[32px] text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default BrandingSettings;
