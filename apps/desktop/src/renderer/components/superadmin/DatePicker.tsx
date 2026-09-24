import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Compact calendar date-picker for the Super Admin filters (Mona Sans, orange
 * #FF8A00 selected day). Single-date selection with Cancel / Apply.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Build a 6×7 grid of dates covering the view month (with leading/trailing days).
const buildGrid = (view: Date): Date[] => {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // back up to Sunday
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const DatePicker: React.FC<{
  value: Date | null;
  onApply: (d: Date | null) => void;
  onCancel: () => void;
}> = ({ value, onApply, onCancel }) => {
  const [view, setView] = useState<Date>(() => {
    const base = value ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [sel, setSel] = useState<Date | null>(value);

  const days = buildGrid(view);
  const step = (delta: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));

  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-white p-2">
      {/* Month navigation */}
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111315] shadow-[-1px_1px_12px_rgba(0,0,0,0.12)] hover:bg-[#F9FAFB]"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-base font-semibold text-[#111315]">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111315] shadow-[-1px_1px_12px_rgba(0,0,0,0.12)] hover:bg-[#F9FAFB]"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid w-full grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-medium text-[rgba(17,19,21,0.4)]">{w}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid w-full grid-cols-7 gap-y-0.5">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === view.getMonth();
          const isSel = sel != null && sameDay(d, sel);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSel(d)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                isSel
                  ? 'bg-[#FF8A00] text-[#1F1E1E]'
                  : inMonth
                    ? 'text-[#1B1B1B] hover:bg-[#F3F4F6]'
                    : 'text-[#939393] hover:bg-[#F9FAFB]'
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex w-full items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => { setSel(null); onCancel(); }}
          className="flex-1 rounded-full border border-[#F3F4F6] py-2.5 text-sm font-medium text-[rgba(26,29,33,0.5)] hover:bg-[#F9FAFB]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onApply(sel)}
          className="flex-1 rounded-full py-2.5 text-sm font-medium text-[#111315]"
          style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
        >
          Select
        </button>
      </div>
    </div>
  );
};

export default DatePicker;
