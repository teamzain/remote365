import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import CompanyMarquee from './CompanyMarquee'

interface ProductHeroProps {
  heading?: string
  description?: string
  ctaText?: string
  ctaHref?: string
  image?: string
  imageAlt?: string
}

const ProductHero: React.FC<ProductHeroProps> = ({
  heading = 'Remote access for everyone, everywhere',
  description = 'Connect to any device, from anywhere. Unique 9-digit device IDs, end-to-end encrypted sessions, and one-click remote support — no VPN, no port forwarding, no setup.',
  ctaText = 'Get started free',
  ctaHref = '/register',
  image = '/product.png',
  imageAlt = 'Remote365 Dashboard',
}) => {
  return (
    <section className="ph-section">

      {/* Heading + subtitle */}
      <div className="ph-copy">
        <h1 className="ph-title">{heading}</h1>
        <p className="ph-sub">{description}</p>
      </div>

      {/* CTA */}
      <RouterLink to={ctaHref} className="ph-cta">{ctaText}</RouterLink>

      {/* Dashboard image */}
      <div className="ph-image-wrap">
        <img src={image} alt={imageAlt} className="ph-image" />
      </div>

      {/* Trusted-companies marquee (same as homepage) */}
      <CompanyMarquee />

      <style>{`
        .ph-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 72px;
          padding: 72px 0 0;
          background: #FFFFFF;
        }
        .ph-copy {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          max-width: 840px;
          padding: 0 clamp(20px, 4vw, 40px);
          text-align: center;
        }
        .ph-title {
          margin: 0;
          font-weight: 600;
          font-size: clamp(2.2rem, 4.5vw, 55px);
          line-height: 1.42;
          color: #1A1D21;
        }
        .ph-sub {
          margin: 0;
          max-width: 720px;
          font-weight: 400;
          font-size: 18px;
          line-height: 25px;
          color: rgba(26, 29, 33, 0.8);
        }
        .ph-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          margin-top: -18px;
          border-radius: 4px;
          background: linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%);
          font-weight: 600;
          font-size: 16px;
          line-height: 23px;
          color: #FFFFFF;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .ph-cta:hover { opacity: 0.9; }

        .ph-image-wrap {
          width: 100%;
          max-width: 1214px;
          padding: 0 clamp(20px, 4vw, 40px);
          box-sizing: border-box;
        }
        .ph-image {
          display: block;
          width: 100%;
          aspect-ratio: 1214 / 680;
          object-fit: cover;
          border-radius: 12px;
        }

        @media (max-width: 640px) {
          .ph-section { gap: 44px; padding: 44px 0 0; }
        }
      `}</style>
    </section>
  )
}

export default ProductHero
