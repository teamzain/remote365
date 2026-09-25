import { FileText, Mic, MonitorPlay } from 'lucide-react'

// Illustration of Remote365 team chat: messages, a shared file, a voice note
// and jumping straight into a session. A drawn sample conversation, not a
// screenshot.
export default function ChatMock() {
  return (
    <figure className="cm2">
      <div className="cm2-window" aria-hidden="true">
        <div className="cm2-head">
          <span className="cm2-avatar">FD</span>
          <span>
            <strong>Front desk</strong>
            <em>Online</em>
          </span>
        </div>
        <div className="cm2-thread">
          <p className="cm2-msg">The reception PC won’t print again.</p>
          <p className="cm2-msg cm2-msg--me">Connecting now, looks like the print queue.</p>
          <p className="cm2-chip cm2-chip--me"><MonitorPlay size={14} /> Session started with Reception PC</p>
          <p className="cm2-chip"><FileText size={14} /> error-log.txt</p>
          <p className="cm2-chip cm2-chip--me"><Mic size={14} /> Voice note · 0:12</p>
          <p className="cm2-msg">Printing works. Thanks!</p>
        </div>
      </div>
      <figcaption className="cm2-caption">Illustration: team chat with files, voice notes and sessions.</figcaption>
      <style>{`
        .cm2 { margin: 0; width: 100%; }
        .cm2-window {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(14, 14, 17, 0.92);
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
        }
        .cm2-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 14px;
        }
        .cm2-head span:last-child { display: flex; flex-direction: column; }
        .cm2-head em { font-style: normal; font-size: 12px; color: #7ee29a; }
        .cm2-avatar {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff8a00, #ffb347);
          color: #111315;
          font-size: 12px;
          font-weight: 700;
        }
        .cm2-thread { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
        .cm2-msg, .cm2-chip {
          margin: 0;
          max-width: 80%;
          padding: 9px 13px;
          border-radius: 16px 16px 16px 4px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 14px;
          line-height: 1.4;
          color: #fff;
          align-self: flex-start;
        }
        .cm2-msg--me {
          align-self: flex-end;
          border-radius: 16px 16px 4px 16px;
          background: linear-gradient(135deg, #ff8a00 0%, #f97316 100%);
          color: #111315;
          font-weight: 500;
        }
        .cm2-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); }
        .cm2-chip--me { align-self: flex-end; border-radius: 16px 16px 4px 16px; border-color: rgba(255, 138, 0, 0.45); color: #ffcf96; }
        .cm2-caption { margin: 10px 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.55); }
      `}</style>
    </figure>
  )
}
