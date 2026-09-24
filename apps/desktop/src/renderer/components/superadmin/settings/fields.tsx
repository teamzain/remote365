import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/** Shared form primitives for the Settings tabs (Figma 400px field column,
 * 4px-radius inputs, custom select, and the 31×19.5 gradient pill toggle). */

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex w-full min-w-0 flex-col gap-0">
    <span className="text-sm leading-5 text-[#111315]">{label}</span>
    {children}
  </label>
);

export const TextInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
  />
);

export const SelectInput: React.FC<{
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}> = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 w-full items-center justify-between rounded-[4px] border bg-white px-4 text-left text-sm outline-none ${
          value ? 'text-[#111315]' : 'text-[rgba(17,19,21,0.3)]'
        } ${open ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)] hover:border-[rgba(26,29,33,0.5)]'}`}
      >
        <span className="truncate">{value || placeholder || 'Select…'}</span>
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
                <span className="truncate">{o}</span>
                {selected && <Check size={16} className="ml-2 shrink-0 text-[#FF8A00]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Toggle: React.FC<{ checked: boolean; label: string; onChange: () => void }> = ({ checked, label, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`relative h-[20px] w-[31px] shrink-0 rounded-full transition-colors ${
      checked ? '' : 'border border-[rgba(26,29,33,0.3)] bg-white'
    }`}
    style={checked ? { background: 'linear-gradient(180deg, #FF8A00 0%, #FFB347 100%)' } : undefined}
  >
    <span
      className={`absolute top-1/2 h-[13px] w-[13px] -translate-y-1/2 rounded-full transition-all ${
        checked ? 'left-[15px] bg-white' : 'left-[3px] bg-[rgba(26,29,33,0.3)]'
      }`}
    />
  </button>
);
