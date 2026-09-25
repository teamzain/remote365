import React from 'react'
import {
  Clipboard,
  FolderUp,
  Hash,
  KeyRound,
  MessageSquare,
  MonitorSmartphone,
  Monitor,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react'

// What Remote365 does, as a scrolling strip. Replaces the old "Trusted by
// 4,000+ companies" logo row, whose customers and numbers weren't real; every
// item here is a shipped feature described in the docs.
const CAPABILITIES: { name: string; Icon: typeof Video }[] = [
  { name: 'Remote control', Icon: MonitorSmartphone },
  { name: 'Unattended access', Icon: KeyRound },
  { name: 'Session codes', Icon: Hash },
  { name: 'Video meetings', Icon: Video },
  { name: 'Team chat', Icon: MessageSquare },
  { name: 'File transfer', Icon: FolderUp },
  { name: 'Clipboard sync', Icon: Clipboard },
  { name: 'Multi-monitor', Icon: Monitor },
  { name: 'Two-factor sign-in', Icon: ShieldCheck },
  { name: 'Role-based access', Icon: Users },
]

interface CapabilityMarqueeProps {
  title?: string
}

const CapabilityMarquee: React.FC<CapabilityMarqueeProps> = ({
  title = 'One app for remote access, support and teamwork',
}) => (
  <div className="cm-wrap">
    {title && <p className="cm-title">{title}</p>}
    <div className="cm-strip">
      <div className="cm-fade" />
      {/* Two identical halves so translateX(-50%) loops without a gap; the
          second half is decorative. */}
      <div className="cm-marquee">
        {[0, 1].map(half => (
          <div key={half} className="cm-half" aria-hidden={half === 1 || undefined}>
            {CAPABILITIES.map(({ name, Icon }) => (
              <span key={name} className="cm-item">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                {name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>

    <style>{`
      .cm-wrap { width: 100%; }
      .cm-title {
        margin: 0 0 42px 0;
        padding: 0 20px;
        font-weight: 700;
        font-size: 24px;
        line-height: 34px;
        text-align: center;
        color: #000000;
      }
      .cm-strip {
        position: relative;
        overflow: hidden;
        padding: 24px 0;
        background: #F3F4F6;
      }
      .cm-fade {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, #F3F4F6 0%, transparent 10%, transparent 90%, #F3F4F6 100%);
        z-index: 10;
        pointer-events: none;
      }
      .cm-marquee {
        display: flex;
        width: max-content;
        animation: cmMarquee 40s linear infinite;
      }
      .cm-half {
        display: flex;
        align-items: center;
      }
      .cm-strip:hover .cm-marquee {
        animation-play-state: paused;
      }
      .cm-item {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 0 40px;
        font-weight: 500;
        font-size: 18px;
        line-height: 25px;
        color: rgba(0, 0, 0, 0.7);
        white-space: nowrap;
        user-select: none;
      }
      @keyframes cmMarquee {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      @media (max-width: 768px) {
        .cm-title { margin-bottom: 28px; font-size: 20px; line-height: 28px; }
        .cm-item { padding: 0 24px; font-size: 16px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .cm-marquee { animation: none; }
      }
    `}</style>
  </div>
)

export default CapabilityMarquee
