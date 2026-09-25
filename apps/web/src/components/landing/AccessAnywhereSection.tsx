import React, { type ReactNode } from 'react'
import SiteLink from '@/components/site/SiteLink'

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

export interface AccessAnywhereSectionProps {
  title?: string
  subtitle?: string
  /** Pass an empty string (or omit with linkTo unset) to hide the CTA link */
  linkLabel?: string
  linkTo?: string
  /** Optional image src; a grey placeholder is shown until provided */
  image?: string
  /** Put the image on the left instead of the right */
  reverse?: boolean
  /** For transparent illustrations: show fully (contain) with no grey backdrop */
  illustration?: boolean
  /** Live visual (globe, diagram) shown instead of the image */
  visual?: ReactNode
}

const AccessAnywhereSection: React.FC<AccessAnywhereSectionProps> = ({
  title = 'Access your devices from anywhere in the world',
  subtitle = 'Connect to any of your devices with its 9-digit ID — from your browser, desktop app, or phone. Full remote control, file transfer, clipboard sync, and multi-monitor support all included.',
  linkLabel = 'Try it now',
  linkTo = '/register',
  image='/4dd57ec67c49dd891ff516acaa8dfe8e803d0fd2.png',
  reverse = false,
  illustration = false,
  visual,
}) => (
  <section className="aa-section">
    <div className="aa-inner" style={reverse ? { flexDirection: 'row-reverse' } : undefined}>

      {/* Copy */}
      <div className="aa-copy">
        <div className="aa-text">
          <h2 className="aa-title">{title}</h2>
          <p className="aa-sub">{subtitle}</p>
        </div>
        {linkLabel && (
          <SiteLink href={linkTo} className="aa-link">
            {linkLabel}
            <ArrowRightIcon />
          </SiteLink>
        )}
      </div>

      {/* Visual */}
      {visual
        ? <div className="aa-visual">{visual}</div>
        : image
        ? <img src={image} alt="" loading="lazy" decoding="async" className={`aa-media${illustration ? ' aa-media--contain' : ''}`} />
        : <div className="aa-media" aria-hidden="true" />}

    </div>

    <style>{`
      .aa-section {
        background: #FFFFFF;
        padding: 51px clamp(20px, 4vw, 40px);
      }
      .aa-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: clamp(32px, 4vw, 60px);
        max-width: 1440px;
        margin: 0 auto;
      }
      .aa-copy {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 72px;
        max-width: 531px;
        flex-shrink: 0;
      }
      .aa-text {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .aa-title {
        margin: 0;
        font-weight: 600;
        font-size: clamp(2rem, 4.5vw, 55px);
        line-height: 1.42;
        color: #1A1D21;
      }
      .aa-sub {
        margin: 0;
        font-weight: 400;
        font-size: 18px;
        line-height: 25px;
        color: rgba(26, 29, 33, 0.8);
      }
      .aa-link {
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
      .aa-link:hover { background: rgba(255, 138, 0, 0.08); }

      .aa-media {
        width: min(650px, 48vw);
        aspect-ratio: 650 / 434;
        background: #F3F4F6;
        border-radius: 12px;
        flex-shrink: 1;
        object-fit: cover;
      }
      .aa-visual {
        display: flex;
        justify-content: center;
        width: min(620px, 48vw);
        flex-shrink: 1;
      }
      /* Transparent illustrations: no backdrop, shown in full */
      .aa-media--contain {
        background: transparent;
        object-fit: contain;
      }

      @media (max-width: 1000px) {
        .aa-inner {
          flex-direction: column !important;
          align-items: flex-start;
        }
        .aa-copy { gap: 44px; max-width: 100%; }
        .aa-media, .aa-visual { width: 100%; }
      }
      @media (max-width: 640px) {
        .aa-section { padding: 40px 20px; }
      }
    `}</style>
  </section>
)

export default AccessAnywhereSection
