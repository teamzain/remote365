import React from 'react'
import { Link as RouterLink } from 'react-router-dom'

// tabler:arrow-up rotated 90° → arrow pointing right, primary orange
const ArrowRightIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path
      d="M2.5 8H13M13 8L8.5 3.5M13 8L8.5 12.5"
      stroke="#FF8A00"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export interface EasyAccessSectionProps {
  title?: string
  subtitle?: string
  linkLabel?: string
  linkTo?: string
}

const EasyAccessSection: React.FC<EasyAccessSectionProps> = ({
  title = 'Remote365 makes remote access easy',
  subtitle = 'Every device gets its own ID and password. Share them and anyone can connect in seconds — no VPN, no port forwarding, no configuration.',
  linkLabel = 'Learn more',
  linkTo = '/product',
}) => (
  <section className="easy-section">
    <div className="easy-inner">
      <div className="easy-copy">
        <h2 className="easy-title">{title}</h2>
        <p className="easy-sub">{subtitle}</p>
      </div>

      <RouterLink to={linkTo} className="easy-link">
        {linkLabel}
        <ArrowRightIcon />
      </RouterLink>
    </div>

    <style>{`
      .easy-section {
        background: #FFFFFF;
        padding: 92px clamp(20px, 4vw, 40px);
      }
      .easy-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 72px;
        max-width: 720px;
        margin: 0 auto;
      }
      .easy-copy {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        text-align: center;
      }
      .easy-title {
        margin: 0;
        font-weight: 600;
        font-size: clamp(2rem, 4.5vw, 55px);
        line-height: 1.42;
        color: #1A1D21;
      }
      .easy-sub {
        margin: 0;
        font-weight: 400;
        font-size: 18px;
        line-height: 25px;
        color: rgba(26, 29, 33, 0.8);
      }
      .easy-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 16px;
        line-height: 23px;
        color: #FF8A00;
        text-decoration: none;
        transition: background 0.15s;
      }
      .easy-link:hover { background: rgba(255, 138, 0, 0.08); }

      @media (max-width: 640px) {
        .easy-section { padding: 64px 20px; }
        .easy-inner { gap: 44px; }
      }
    `}</style>
  </section>
)

export default EasyAccessSection
