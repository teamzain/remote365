import React from 'react'
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

const HomeAwaySection: React.FC = () => (
  <section className="home-away-section">
    <div className="home-away-copy">
      <div className="home-away-text">
        <h2 className="home-away-title">Your home, always within reach</h2>
        <p className="home-away-sub">
          Reach your home PC, media server, or family’s computers from anywhere and help them out in a click. Start with a 15-day free trial.
        </p>
      </div>

      <div className="home-away-actions">
        <SiteLink href="/register" className="home-away-btn-primary">
          Get started for free
        </SiteLink>
        <SiteLink href="/product" className="home-away-btn-ghost">
          Learn more
          <ArrowRightIcon />
        </SiteLink>
      </div>
    </div>

    {/* Visual */}
    <img
      src="/105f060441fe41618729fcd5695c6afc5a3d4f4f.png"
      alt="Remote365 running on a phone"
      loading="lazy"
      decoding="async"
      className="home-away-media"
    />

    <style>{`
      .home-away-section {
        background: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 92px clamp(20px, 4vw, 40px);
        gap: 72px;
      }
      .home-away-copy {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 72px;
        max-width: 720px;
      }
      .home-away-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        text-align: center;
      }
      .home-away-title {
        margin: 0;
        font-weight: 600;
        font-size: clamp(2rem, 4.5vw, 55px);
        line-height: 1.42;
        color: #1A1D21;
      }
      .home-away-sub {
        margin: 0;
        font-weight: 400;
        font-size: 18px;
        line-height: 25px;
        color: rgba(26, 29, 33, 0.8);
      }
      .home-away-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 12px 16px;
      }
      .home-away-btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 16px;
        border-radius: 4px;
        background: linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%);
        font-weight: 600;
        font-size: 16px;
        line-height: 23px;
        color: #FFFFFF;
        text-decoration: none;
        white-space: nowrap;
        transition: opacity 0.15s;
      }
      .home-away-btn-primary:hover { opacity: 0.9; }
      .home-away-btn-ghost {
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
        white-space: nowrap;
        transition: background 0.15s;
      }
      .home-away-btn-ghost:hover { background: rgba(255, 138, 0, 0.08); }

      .home-away-media {
        width: 100%;
        max-width: 1440px;
        aspect-ratio: 1214 / 680;
        background: #F3F4F6;
        border-radius: 12px;
        object-fit: cover;
        display: block;
      }

      @media (max-width: 640px) {
        .home-away-section { padding: 64px 20px; gap: 44px; }
        .home-away-copy { gap: 44px; }
      }
    `}</style>
  </section>
)

export default HomeAwaySection
