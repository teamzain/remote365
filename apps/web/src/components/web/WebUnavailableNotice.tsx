import React from 'react';
import { MonitorDown } from 'lucide-react';

interface WebUnavailableNoticeProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const WebUnavailableNotice: React.FC<WebUnavailableNoticeProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="flex min-h-[360px] w-full items-center justify-center rounded-xl border border-[rgba(26,29,33,0.18)] bg-white p-8 font-['Mona_Sans',system-ui,sans-serif]">
    <div className="flex max-w-[440px] flex-col items-center text-center">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded bg-[rgba(255,179,71,0.3)] text-[#FF8A00]">
        <MonitorDown size={28} strokeWidth={1.8} />
      </span>
      <h2 className="m-0 text-[22px] font-semibold leading-8 text-[#111315]">{title}</h2>
      <p className="mt-2 text-[14px] leading-5 text-[rgba(26,29,33,0.65)]">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 h-10 rounded bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-5 text-[14px] font-medium text-white"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  </div>
);
