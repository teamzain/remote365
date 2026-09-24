import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { COUNTRIES, fetchCities, statesFor } from '../../lib/geo';

export interface BusinessLocation {
  country: string;
  state: string;
  city: string;
}

interface SearchSelectProps {
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder: string;
  inputClass: string;
  /** Free text allowed (city): typing is kept even without a matching option. */
  allowCustom?: boolean;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
}

/**
 * Styled searchable dropdown (the native select looked out of place): an
 * input that filters the list as you type, a panel in the app's own style,
 * keyboard support (arrows, Enter, Escape).
 */
const SearchSelect: React.FC<SearchSelectProps> = ({ value, options, onSelect, placeholder, inputClass, allowCustom, disabled, loading, emptyText }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q && q !== value.toLowerCase() ? options.filter((option) => option.toLowerCase().includes(q)) : options;
    // exact/prefix matches first
    return list
      .slice()
      .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)))
      .slice(0, 300);
  }, [options, query, value]);

  useEffect(() => { setActive(0); }, [matches.length, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  const commit = (option: string) => {
    onSelect(option);
    setQuery(option);
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
    if (allowCustom) { if (query.trim() !== value) onSelect(query.trim()); }
    else setQuery(value); // lists only accept a listed value
  };

  const scrollActiveIntoView = (index: number) => {
    const node = listRef.current?.children[index] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={loading ? 'Loading…' : placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (allowCustom) onSelect(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => { const next = Math.min(i + 1, matches.length - 1); scrollActiveIntoView(next); return next; }); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => { const next = Math.max(i - 1, 0); scrollActiveIntoView(next); return next; }); }
          else if (e.key === 'Enter') { if (open && matches[active]) { e.preventDefault(); commit(matches[active]); } else if (allowCustom) { setOpen(false); } }
          else if (e.key === 'Escape') { close(); }
        }}
        className={`${inputClass} pr-9`}
        style={{ height: '40px' }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(26,29,33,0.5)]"
        aria-label="Toggle list"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-[240px] overflow-y-auto rounded-lg border border-[rgba(26,29,33,0.12)] bg-white py-1 shadow-[0_12px_32px_rgba(26,29,33,0.16)]"
        >
          {matches.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-[rgba(26,29,33,0.5)]">{loading ? 'Loading…' : emptyText || (allowCustom ? 'No suggestions — keep typing' : 'No matches')}</div>
          )}
          {matches.map((option, index) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => { e.preventDefault(); commit(option); }}
                onMouseEnter={() => setActive(index)}
                className={`flex h-9 w-full items-center justify-between px-3 text-left text-[13px] ${index === active ? 'bg-[#FFF4E5]' : ''} ${selected ? 'font-semibold text-[#FF8A00]' : 'text-[#111315]'}`}
              >
                <span className="truncate">{option}</span>
                {selected ? <Check size={14} className="flex-none" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface BusinessLocationFieldsProps {
  value: BusinessLocation;
  onChange: (key: keyof BusinessLocation, value: string) => void;
  labels: { country: string; state: string; city: string };
  inputClass: string;
  labelStyle?: React.CSSProperties;
}

/**
 * Country → (State / Province for the US and Canada) → City. Countries and
 * states are fixed lists; cities load for the chosen place and are offered as
 * suggestions, so an unlisted town can still be typed.
 */
export const BusinessLocationFields: React.FC<BusinessLocationFieldsProps> = ({ value, onChange, labels, inputClass, labelStyle }) => {
  const states = statesFor(value.country);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value.country || (states && !value.state)) { setCities([]); return; }
    setLoadingCities(true);
    fetchCities(value.country, states ? value.state : null).then((list) => {
      if (cancelled) return;
      setCities(list);
      setLoadingCities(false);
    });
    return () => { cancelled = true; };
  }, [value.country, value.state, states]);

  const label = (text: string) => <div style={{ fontSize: '14px', fontWeight: 400, color: '#111315', height: '24px', ...(labelStyle || {}) }}>{text}</div>;
  const cityField = (
    <div className="flex flex-col gap-[8px]">
      {label(labels.city)}
      <SearchSelect
        value={value.city}
        options={cities}
        allowCustom
        loading={loadingCities}
        disabled={!value.country || (!!states && !value.state)}
        onSelect={(city) => onChange('city', city)}
        placeholder={!value.country ? 'Select a country first' : states && !value.state ? `Select a ${value.country === 'Canada' ? 'province' : 'state'} first` : 'Type or pick a city'}
        inputClass={inputClass}
      />
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-[12px]">
        <div className="flex flex-col gap-[8px]">
          {label(labels.country)}
          <SearchSelect
            value={value.country}
            options={COUNTRIES}
            onSelect={(country) => { onChange('country', country); onChange('state', ''); onChange('city', ''); }}
            placeholder="Select country"
            inputClass={inputClass}
          />
        </div>
        {states ? (
          <div className="flex flex-col gap-[8px]">
            {label(labels.state)}
            <SearchSelect
              value={value.state}
              options={states}
              onSelect={(state) => { onChange('state', state); onChange('city', ''); }}
              placeholder={value.country === 'Canada' ? 'Select province' : 'Select state'}
              inputClass={inputClass}
            />
          </div>
        ) : cityField}
      </div>
      {states && cityField}
    </>
  );
};

export default BusinessLocationFields;
