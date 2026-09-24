import React from 'react';
import { Info } from 'lucide-react';

/** "People Ready" glyph used for the online/ready state (moved from App.tsx). */
const OnlineReadyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M11.6673 16.6666H3.33398V14.1666C3.33398 11.9166 7.75065 10.8333 10.0007 10.8333C11.2507 10.8333 13.2507 11.1666 14.7507 11.9166C14.084 12.1666 13.584 12.5 13.084 12.9166C12.1673 12.5833 11.084 12.4166 10.0007 12.4166C7.50065 12.4166 4.91732 13.6666 4.91732 14.1666V15.0833H11.834C11.7507 15.4166 11.6673 15.8333 11.6673 16.25V16.6666ZM19.1673 16.25C19.1673 17.8333 17.834 19.1666 16.2507 19.1666C14.6673 19.1666 13.334 17.8333 13.334 16.25C13.334 14.6666 14.6673 13.3333 16.2507 13.3333C17.834 13.3333 19.1673 14.6666 19.1673 16.25ZM10.0007 4.99998C10.9173 4.99998 11.6673 5.74998 11.6673 6.66665C11.6673 7.58331 10.9173 8.33331 10.0007 8.33331C9.08398 8.33331 8.33398 7.58331 8.33398 6.66665C8.33398 5.74998 9.08398 4.99998 10.0007 4.99998ZM10.0007 3.33331C8.16732 3.33331 6.66732 4.83331 6.66732 6.66665C6.66732 8.49998 8.16732 9.99998 10.0007 9.99998C11.834 9.99998 13.334 8.49998 13.334 6.66665C13.334 4.83331 11.834 3.33331 10.0007 3.33331Z" fill="#34C759" />
  </svg>
);

export interface StatusFooterProps {
  /** Host connection state. 'status' renders the green ready glyph; otherwise an Info icon. */
  status: 'idle' | 'connecting' | 'error' | 'status' | '';
  statusLabel: string;
  message?: string;
  /** Pre-formatted identifier, e.g. "195 989 442" or "--- --- ---". */
  idLabel: string;
  onCopyId?: () => void;
}

/**
 * Shared global status footer used by the owner dashboard and the Super Admin
 * console so both stay visually identical. Markup matches the original inline
 * footer from App.tsx exactly.
 */
export const StatusFooter: React.FC<StatusFooterProps> = ({ status, statusLabel, message, idLabel, onCopyId }) => (
  <footer className="h-[55px] shrink-0 rounded-b-xl bg-white dark:bg-[#0d0f12] border-t border-[rgba(26,29,33,0.06)] dark:border-white/10 flex items-center justify-between px-[55px] z-[100] font-['Mona_Sans',system-ui,sans-serif]">
    <div className="flex min-w-0 items-center gap-3">
      {status === 'status' ? (
        <OnlineReadyIcon />
      ) : (
        <Info size={16} strokeWidth={1.7} className={status === 'error' ? 'text-[#FF383C]' : 'text-amber-500'} />
      )}
      <span className="text-[13px] font-medium leading-[18px] text-black dark:text-[#F5F5F5]">{statusLabel}</span>
      {message && status !== 'status' && (
        <span className="hidden max-w-[360px] truncate text-[12px] font-normal leading-4 text-[rgba(26,29,33,0.55)] dark:text-[#A0A0A0] lg:block">
          {message}
        </span>
      )}
    </div>

    <button
      type="button"
      className="shrink-0 text-[13px] font-medium leading-[18px] text-black dark:text-[#F5F5F5]"
      onClick={onCopyId}
    >
      ID {idLabel}
    </button>
  </footer>
);

export default StatusFooter;
