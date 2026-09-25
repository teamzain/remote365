import React from 'react'
import { Box } from '@mui/material'
import SiteLayout from '../../components/landing/SiteLayout'
import PricingPlans from '../../components/landing/PricingPlans'
import PricingFAQ from '../../components/landing/PricingFAQ'

const PricingPage: React.FC = () => {
  return (
    <SiteLayout>
      {/* Pricing hero — same two-tone gradient headline as the home hero */}
      <section className="pr-hero">
        <h1 className="pr-title">
          <span className="pr-title-top">Plans that work</span>
          <span className="pr-title-accent">for everyone</span>
        </h1>
      </section>

      <Box component="main">
        <PricingPlans />
        <PricingFAQ />
      </Box>

      <style>{`
        .pr-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 56px 40px 64px;
          text-align: center;
        }
        .pr-title {
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-weight: 700;
          font-size: clamp(2.4rem, 5.5vw, 64px);
          line-height: 1.08;
          letter-spacing: -0.03em;
        }
        .pr-title-top,
        .pr-title-accent {
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          padding-bottom: 0.06em; /* keeps descenders inside the clip */
        }
        .pr-title-top {
          background-image: linear-gradient(180deg, #ffffff 0%, #9ca3af 100%);
        }
        .pr-title-accent {
          background-image: linear-gradient(90deg, #ff8a00 0%, #ea580c 100%);
        }
        @media (max-width: 640px) {
          .pr-hero { padding: 40px 20px 48px; }
        }
      `}</style>
    </SiteLayout>
  )
}

export default PricingPage
