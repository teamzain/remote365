import type { ReactNode } from 'react'

// Port of Cult UI's "Mock Browser Window" (cult-ui.com, `shadcn add
// https://cult-ui.com/r/mock-browser-window.json`): window controls and an
// address bar around any content. Changed for this site: dark glass chrome in
// the site's colours, plain CSS instead of Tailwind/shadcn tokens, and only
// the generic variant (no sidebars).
export default function BrowserWindow({ url, children, className = '' }: { url: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bw ${className}`}>
      <div className="bw-bar" aria-hidden="true">
        <span className="bw-dots"><i /><i /><i /></span>
        <span className="bw-address">
          <svg viewBox="0 0 12 12" width="11" height="11" fill="currentColor">
            <path d="M6 1a2.5 2.5 0 0 1 2.5 2.5V5h.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h.5V3.5A2.5 2.5 0 0 1 6 1zm1.5 4V3.5a1.5 1.5 0 1 0-3 0V5h3z" />
          </svg>
          <span>{url}</span>
        </span>
      </div>
      <div className="bw-body">{children}</div>
      <style>{`
        .bw {
          width: 100%;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: #0e0e11;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        .bw-bar {
          display: flex;
          align-items: center;
          gap: 14px;
          height: 40px;
          padding: 0 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.03);
        }
        .bw-dots { display: flex; gap: 7px; flex-shrink: 0; }
        .bw-dots i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.16);
        }
        .bw-dots i:first-child { background: #ff5f57; }
        .bw-dots i:nth-child(2) { background: #febc2e; }
        .bw-dots i:nth-child(3) { background: #28c840; }
        .bw-address {
          flex: 1;
          min-width: 0;
          max-width: 420px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 26px;
          padding: 0 14px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.06);
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }
        .bw-address span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bw-address svg { flex-shrink: 0; color: rgba(255, 255, 255, 0.5); }
        .bw-body { position: relative; }
      `}</style>
    </div>
  )
}
