import SiteLink from '@/components/site/SiteLink'
import PricingPlans from '@/components/landing/PricingPlans'
import { priceSummary, type ApiPlan } from '@/lib/plans'

// The plan cards on the home page, under a section heading, with a link to
// the full comparison on /pricing. The home page passes the live catalogue.
export default function HomePricing({ plans }: { plans: ApiPlan[] }) {
  return (
    <section className="hp-section" aria-labelledby="hp-heading">
      <div className="hp-head">
        <p className="hp-eyebrow">Pricing</p>
        <h2 className="hp-title" id="hp-heading">Plans that work for everyone</h2>
        <p className="hp-intro">
          Start with {priceSummary(plans)}, billed per workspace in US dollars.
        </p>
        <SiteLink href="/pricing" className="hp-more">Compare every plan</SiteLink>
      </div>

      <PricingPlans plans={plans} nameTag="h3" />

      <style>{`
        .hp-section {
          padding: clamp(64px, 9vw, 120px) 0 0;
        }
        .hp-head {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 clamp(20px, 4vw, 40px);
          text-align: center;
        }
        .hp-eyebrow {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #ff8a00;
        }
        .hp-title {
          margin: 12px 0 0;
          font-size: clamp(2rem, 4.5vw, 56px);
          font-weight: 700;
          line-height: 1.06;
          letter-spacing: -0.035em;
          background-image: linear-gradient(180deg, #ffffff 0%, #b8bec8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          padding-bottom: 0.06em;
        }
        .hp-intro {
          margin: 16px auto 0;
          max-width: 620px;
          font-size: 17px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.68);
        }
        .hp-more {
          margin-top: 14px;
          font-size: 15px;
          font-weight: 600;
          color: #ff8a00;
          text-decoration: none;
        }
        .hp-more::after { content: ' →'; }
        .hp-more:hover { text-decoration: underline; text-underline-offset: 4px; }
        .hp-more:focus-visible { outline: 2px solid #ff8a00; outline-offset: 3px; border-radius: 4px; }
      `}</style>
    </section>
  )
}
