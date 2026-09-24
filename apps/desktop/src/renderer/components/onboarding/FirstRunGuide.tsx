import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

export interface GuideStep {
  title: string;
  description: string;
  /** CSS selector of the element to spotlight. Omit for a centered card. */
  target?: string;
}

interface FirstRunGuideProps {
  /** Unique per page — drives the "seen once" persistence key. */
  pageId: string;
  steps: GuideStep[];
}

const storageKey = (pageId: string) => `r365_first_run_guide:${pageId}`;

/**
 * One-time setup wizard shown the first time a user opens a page. Walks
 * through the page's core actions with a spotlight on the real controls
 * (via data-tour selectors); marks itself done in localStorage so it never
 * reappears unless storage is cleared.
 */
export const FirstRunGuide: React.FC<FirstRunGuideProps> = ({ pageId, steps }) => {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey(pageId)) === 'done') return;
    } catch { return; }
    // Give the page a beat to render so spotlight targets exist.
    const timer = setTimeout(() => setVisible(true), 450);
    return () => clearTimeout(timer);
  }, [pageId]);

  const step = steps[stepIndex];

  useEffect(() => {
    if (!visible || !step) return;
    const measure = () => {
      if (!step.target) { setTargetRect(null); return; }
      const el = document.querySelector(step.target);
      setTargetRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [visible, stepIndex, step?.target]);

  const finish = () => {
    try { localStorage.setItem(storageKey(pageId), 'done'); } catch { /* storage unavailable */ }
    setVisible(false);
  };

  const next = () => {
    if (stepIndex >= steps.length - 1) { finish(); return; }
    setStepIndex(stepIndex + 1);
  };

  // Tooltip placement: below the spotlight when there's room, else above; centered otherwise.
  const cardStyle = useMemo((): React.CSSProperties => {
    if (!targetRect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    const cardWidth = 340;
    const margin = 14;
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const top = spaceBelow > 240
      ? targetRect.bottom + margin
      : Math.max(margin, targetRect.top - margin - 230);
    let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - cardWidth - margin);
    return { left, top, width: cardWidth };
  }, [targetRect]);

  if (!visible || !step) return null;

  return (
    <div className="fixed inset-0 z-[400]" role="dialog" aria-label="Page Tour">
      {/* Backdrop: spotlight cutout when a target exists, plain dim otherwise */}
      {targetRect ? (
        <div
          className="absolute rounded-xl border-2 border-[#FF8A00] transition-all duration-300"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 9999px rgba(17, 19, 21, 0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#111315]/55" />
      )}

      <div
        className="absolute bg-white rounded-2xl shadow-2xl border border-[rgba(28,28,28,0.08)] p-5 animate-in fade-in zoom-in-95 duration-300"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#FFF4E5] rounded-lg flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-[#FF8A00]" />
            </div>
            <h4 className="text-[15px] font-semibold text-[#111315] leading-tight">{step.title}</h4>
          </div>
          <button onClick={finish} className="p-1 -mr-1 text-gray-400 hover:text-[#111315] rounded-lg hover:bg-[#F9FAFB] transition-colors" title="Skip Tour">
            <X size={15} />
          </button>
        </div>

        <p className="text-[13px] text-[#111315]/70 leading-relaxed mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-5 bg-[#FF8A00]' : 'w-1.5 bg-gray-300'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button onClick={() => setStepIndex(stepIndex - 1)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#111315]/60 hover:bg-[#F9FAFB] transition-colors">
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 rounded-lg text-[13px] font-semibold text-black bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] hover:brightness-105 transition-all"
            >
              {stepIndex >= steps.length - 1 ? 'Got It' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstRunGuide;
