import React from 'react'
import SiteLink from '@/components/site/SiteLink'
import type { ApiPlan } from '@/lib/plans'

// charm:tick — primary orange
const TickIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M2.75 8.75L6 12L13.25 4.5" stroke="#FF8A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Limits become the "Users & Devices" list
const usersDevicesItems = (plan: ApiPlan): string[] => {
  const items: string[] = []
  items.push(plan.maxUsers == null ? 'Unlimited members' : plural(plan.maxUsers, 'member'))
  items.push(plan.maxDevices == null ? 'Unlimited devices' : plural(plan.maxDevices, 'device'))
  if (plan.maxConcurrentSessions != null) items.push(plural(plan.maxConcurrentSessions, 'concurrent session'))
  return items
}

// Feature strings that just restate the limits are dropped — the limits
// already render in "Users & Devices".
const featureItems = (plan: ApiPlan): string[] =>
  plan.features.filter(f => !/^(\d+|unlimited)\s+(member|device|concurrent)/i.test(f))

const TickList: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <div className="pp-ticks">
    <p className="pp-ticks-label">{label}</p>
    <ul className="pp-tick-list">
      {items.map(item => (
        <li key={item} className="pp-tick-row">
          <TickIcon />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
)

const PlanCard: React.FC<{ plan: ApiPlan }> = ({ plan }) => {
  const isCustom = plan.price === 'Custom'

  return (
    <article className={`pp-card${plan.popular ? ' pp-card-popular' : ''}`}>
      <div className="pp-head">
        <h2 className="pp-name">{plan.name}</h2>
        <div>
          <p className="pp-starts">Starts at</p>
          <div className="pp-price-row">
            {isCustom ? (
              <span className="pp-price">Custom</span>
            ) : (
              <>
                <span className="pp-price">${plan.price}</span>
                <span className="pp-price-suffix">
                  {plan.price === 0 ? plan.priceLabel : 'Per month'}
                </span>
              </>
            )}
          </div>
        </div>
        <p className="pp-desc">{plan.description}</p>
      </div>

      <SiteLink
        href={isCustom ? '/contact' : '/register'}
        className={plan.popular ? 'pp-cta pp-cta-primary beam' : 'pp-cta pp-cta-outline'}
        style={plan.popular ? { ['--beam-radius' as string]: '4px' } : undefined}
      >
        {isCustom ? 'Contact Sales' : 'Get Started'}
      </SiteLink>

      <div className="pp-divider" />

      <TickList label="Users & Devices" items={usersDevicesItems(plan)} />
      <TickList label="Features" items={featureItems(plan)} />
    </article>
  )
}

// Plan cards for /pricing. The page loads the catalogue on the server
// (lib/plans.ts), so prices are part of the HTML.
const PricingPlans: React.FC<{ plans: ApiPlan[] }> = ({ plans }) => {
  return (
    <section style={{ padding: '32px clamp(16px, 4vw, 40px) 80px' }}>
      <div className="pp-grid">
        {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>

      <style>{`
        .pp-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: stretch;
          gap: clamp(16px, 2.5vw, 36px);
          max-width: 1438px;
          margin: 0 auto;
          padding: 16px 4px 32px;
        }
        .pp-card {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-width: 0;
          padding: 24px clamp(18px, 2vw, 34px);
          box-sizing: border-box;
          background: #FFFFFF;
          border: 1px solid rgba(26, 29, 33, 0.3);
          border-radius: 12px;
        }
        .pp-card-popular {
          border: none;
          box-shadow: 0 12px 40px rgba(17, 19, 21, 0.12);
        }
        .pp-head {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .pp-name {
          margin: 0;
          font-weight: 500;
          font-size: 22px;
          line-height: 31px;
          color: #111315;
        }
        .pp-starts {
          margin: 0 0 2px;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          color: #111315;
        }
        .pp-price-row {
          display: flex;
          align-items: flex-end;
          gap: 11px;
        }
        .pp-price {
          font-family: var(--font-heading);
          font-weight: 500;
          font-size: 36px;
          line-height: 44px;
          color: #111315;
        }
        .pp-price-suffix {
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          color: #111315;
          padding-bottom: 7px;
        }
        .pp-desc {
          margin: 0;
          min-height: 40px;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          color: rgba(17, 19, 21, 0.7);
        }
        .pp-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          text-decoration: none;
          width: 100%;
          height: 40px;
          padding: 10px 16px;
          border-radius: 4px;
          font-family: inherit;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          cursor: pointer;
          transition: opacity 0.15s, background 0.15s;
        }
        .pp-cta-outline {
          background: #FFFFFF;
          border: 1px solid rgba(26, 29, 33, 0.3);
          color: #111315;
        }
        .pp-cta-outline:hover { background: #F3F4F6; }
        .pp-cta-primary {
          background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
          border: none;
          color: #FFFFFF;
        }
        .pp-cta-primary:hover { opacity: 0.9; }
        .pp-divider {
          border-top: 1px solid rgba(26, 29, 33, 0.3);
          margin: 0 -8px;
        }
        .pp-ticks {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pp-tick-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pp-ticks-label {
          margin: 0;
          font-weight: 600;
          font-size: 16px;
          line-height: 23px;
          color: rgba(0, 0, 0, 0.5);
        }
        .pp-tick-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: #111315;
        }
        /* Four across on wide screens, two on tablets and small laptops,
           one on phones: the page never scrolls sideways. */
        @media (max-width: 1100px) {
          .pp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .pp-grid { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </section>
  )
}

export default PricingPlans
