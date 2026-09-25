import React from 'react'
import SiteLink from '@/components/site/SiteLink'

interface GetStartedCtaProps {
  heading?: string
  ctaText?: string
  ctaHref?: string
}

const GetStartedCta: React.FC<GetStartedCtaProps> = ({
  heading = 'Ready to Experience the Future?',
  ctaText = 'Get Started for Free',
  ctaHref = '/register',
}) => (
  <section className="cta-section">
    <div className="cta-card">
      {/* Ambient orange glow blobs */}
      <span className="cta-blob cta-blob-1" />
      <span className="cta-blob cta-blob-2" />
      <span className="cta-blob cta-blob-3" />

      <div className="cta-content">
        <h2 className="cta-heading">{heading}</h2>
        <SiteLink href={ctaHref} className="cta-btn">{ctaText}</SiteLink>
      </div>
    </div>

    <style>{`
      .cta-section {
        background: #FFFFFF;
        padding: 40px clamp(20px, 4vw, 40px) 80px;
        display: flex;
        justify-content: center;
      }
      .cta-card {
        position: relative;
        width: 100%;
        max-width: 1214px;
        min-height: 350px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        box-sizing: border-box;
        background: #FFFFFF;
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.12);
        border-radius: 32px;
        overflow: hidden;
      }
      .cta-blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(50px);
        pointer-events: none;
      }
      .cta-blob-1 {
        width: 292px;
        height: 292px;
        left: -69px;
        top: -116px;
        background: radial-gradient(50% 50% at 50% 50%, rgba(255, 138, 0, 0.3) 0%, rgba(255, 179, 71, 0.3) 100%);
      }
      .cta-blob-2 {
        width: 284px;
        height: 284px;
        right: -30px;
        top: -12px;
        background: linear-gradient(180deg, rgba(255, 138, 0, 0.2) 0%, rgba(255, 179, 71, 0.2) 100%);
      }
      .cta-blob-3 {
        width: 321px;
        height: 321px;
        left: 18%;
        bottom: -221px;
        background: radial-gradient(50% 50% at 50% 50%, rgba(255, 138, 0, 0.3) 0%, rgba(255, 179, 71, 0.3) 100%);
      }
      .cta-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 48px;
        text-align: center;
      }
      .cta-heading {
        margin: 0;
        max-width: 547px;
        font-weight: 600;
        font-size: clamp(1.75rem, 3.5vw, 35px);
        line-height: 1.4;
        color: #000000;
      }
      .cta-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 16px;
        border-radius: 4px;
        background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
        font-weight: 600;
        font-size: 16px;
        line-height: 23px;
        color: #FFFFFF;
        text-decoration: none;
        transition: opacity 0.15s;
      }
      .cta-btn:hover { opacity: 0.9; }

      @media (max-width: 640px) {
        .cta-section { padding: 24px 20px 56px; }
        .cta-content { gap: 32px; }
      }
    `}</style>
  </section>
)

export default GetStartedCta
