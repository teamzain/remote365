import React, { useState } from 'react';
import { X, Star } from 'lucide-react';
import api from '../lib/api';

/**
 * "Share Your Feedback" modal (Figma: 468px) — a star rating + comment box.
 * Opened from the sidebar Feedback item.
 */

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ open, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const close = () => {
    setRating(0);
    setHover(0);
    setComment('');
    onClose();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/support/feedback', { rating, comment: comment.trim(), page: window.location.hash || window.location.pathname, appVersion: (window as any).electronAPI?.appVersion });
    } catch (err: any) {
      console.warn('[Feedback] Could not send feedback:', err?.response?.data?.error || err?.message || err);
    } finally {
      setSubmitting(false);
      close();
    }
  };

  const active = hover || rating;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="flex w-full max-w-[468px] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start gap-6">
          <div className="flex flex-1 flex-col">
            <h2 className="text-[24px] font-bold leading-[34px] text-[#111315]">Share Your Feedback</h2>
            <p className="text-[14px] leading-5 text-[#111315]">How satisfied are you with the Remote365 app?</p>
          </div>
          <button
            onClick={close}
            className="mt-1 flex-shrink-0 text-[#111315] transition-opacity hover:opacity-60"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Rate Us */}
        <div className="flex w-full flex-col gap-3">
          <h3 className="text-[18px] font-medium leading-[25px] text-[#111315]">Rate Us</h3>
          <div className="flex items-center justify-center gap-[15px]">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110"
                aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={24}
                  strokeWidth={1.5}
                  className={active >= n ? 'text-[#FF8A00]' : 'text-[#1A1D21]'}
                  fill={active >= n ? '#FF8A00' : 'none'}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Add a comment */}
        <div className="flex w-full flex-col gap-3">
          <h3 className="text-[18px] font-medium leading-[25px] text-[#111315]">Add A Comment</h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell Us What You Think…"
            className="h-20 w-full resize-none rounded border border-[#1A1D21]/30 px-4 py-2.5 text-[14px] leading-5 text-[#111315] outline-none transition-colors placeholder:text-[#111315]/30 focus:border-[#FF8A00]"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={close}
            className="h-10 w-[124px] rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || rating === 0}
            className="h-10 w-[124px] rounded-[32px] text-[14px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
          >
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};
