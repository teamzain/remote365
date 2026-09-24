import React from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Full-screen lockout shown when the signed-in user's organization has been
 * suspended by a Super Admin. The backend blocks login / refresh / me with a
 * `{ suspended: true }` 403; the app surfaces this screen and clears the session.
 */
const SUPPORT_EMAIL = 'support@remote365.com';

const SuspendedNotice: React.FC<{ message?: string | null; onClose: () => void }> = ({ message, onClose }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F3F4F6] p-6">
    <div className="w-full max-w-md rounded-2xl border border-[rgba(26,29,33,0.12)] bg-white p-8 text-center shadow-xl">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF3F2]">
        <ShieldAlert size={28} className="text-[#D92D20]" />
      </div>
      <h1 className="text-lg font-semibold text-[#111315]">Account Suspended</h1>
      <p className="mt-2 text-sm leading-relaxed text-[rgba(17,19,21,0.7)]">
        {message || 'Your account has been suspended. Please contact support.'}
      </p>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[4px] px-4 text-sm font-medium text-white"
        style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
      >
        Contact Support
      </a>
      <button
        onClick={onClose}
        className="mt-3 block w-full text-sm font-medium text-[rgba(17,19,21,0.6)] hover:text-[#111315]"
      >
        Back To Sign In
      </button>
    </div>
  </div>
);

export default SuspendedNotice;
