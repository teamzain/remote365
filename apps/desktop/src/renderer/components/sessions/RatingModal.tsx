import React, { useState } from 'react';
import { Star, X } from 'lucide-react';

type Props = {
  sessionId: string | null;
  onClose: () => void;
  onSubmit: (id: string, rating: number, comment?: string) => Promise<void>;
};

export const RatingModal: React.FC<Props> = ({ sessionId, onClose, onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  if (!sessionId) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit(sessionId, rating, comment);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 shadow-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-black text-gray-900 dark:text-white">Rate Support Session</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} onClick={() => setRating(value)} className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center">
              <Star size={20} className={value <= rating ? 'text-amber-400 fill-current' : 'text-gray-300'} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional Comment..."
          className="w-full h-[110px] resize-none rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-3 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-400"
        />
        <button onClick={submit} disabled={saving} className="mt-4 w-full rounded-xl bg-[#1D6DF5] px-4 py-3 text-[13px] font-bold text-white disabled:opacity-60">
          Submit Rating
        </button>
      </div>
    </div>
  );
};
