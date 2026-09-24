import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Shape of GET /api/billing/plans — the merged catalog (built-ins plus any
// custom plans the super admin created; his edits show up here live).
interface ApiPlan {
  id: string
  name: string
  price: number | 'Custom'
  priceLabel: string
  description: string
  maxDevices: number | null
  maxUsers: number | null
  maxConcurrentSessions: number | null
  features: string[]
  popular?: boolean
}

// Snapshot of the built-in catalog so the page still renders if the API is
// unreachable (marketing page must never be empty).
const FALLBACK_PLANS: ApiPlan[] = [
  {
    id: 'TRIAL', name: 'Trial', price: 0, priceLabel: '15 days free',
    description: 'One organization owner gets full access for 15 days, with three devices and core remote support features.',
    maxDevices: 3, maxUsers: 1, maxConcurrentSessions: 1,
    features: ['Support sessions', 'Unattended access', 'File transfer', 'Clipboard sync', 'Meetings'],
  },
  {
    id: 'SOLO', name: 'Solo', price: 15, priceLabel: '$15 / month',
    description: 'For an individual managing their own machines, with no team administration screens.',
    maxDevices: 10, maxUsers: 2, maxConcurrentSessions: 1,
    features: ['Unattended access', 'File transfer', 'Clipboard sync', 'Meetings'],
  },
  {
    id: 'PRO', name: 'Pro', price: 40, priceLabel: '$40 / month',
    description: 'For small support teams that need assigned access and support workflows.',
    maxDevices: 50, maxUsers: 5, maxConcurrentSessions: 3, popular: true,
    features: ['Technician and Viewer roles', 'Device groups', 'Per-member device access', 'Support queue', 'Scripts library', 'Basic analytics', '30-day audit log'],
  },
  {
    id: 'BUSINESS', name: 'Business', price: 100, priceLabel: '$100 / month',
    description: 'For delegated team management with full RBAC, policies, analytics, and branding.',
    maxDevices: 200, maxUsers: 25, maxConcurrentSessions: 10,
    features: ['Admin role and full RBAC', 'Connection policies', 'Forced two-factor authentication', 'Session recording', 'Full analytics', 'Custom branding', '1-year audit log', 'Priority support'],
  },
]

// charm:tick — primary orange
const TickIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
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
    {items.map(item => (
      <div key={item} className="pp-tick-row">
        <TickIcon />
        <span>{item}</span>
      </div>
    ))}
  </div>
)

const PlanCard: React.FC<{ plan: ApiPlan }> = ({ plan }) => {
  const navigate = useNavigate()
  const isCustom = plan.price === 'Custom'

  return (
    <div className={`pp-card${plan.popular ? ' pp-card-popular' : ''}`}>
      <div className="pp-head">
        <h3 className="pp-name">{plan.name}</h3>
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

      <button
        className={plan.popular ? 'pp-cta pp-cta-primary' : 'pp-cta pp-cta-outline'}
        onClick={() => navigate(isCustom ? '/contact' : '/register')}
      >
        {isCustom ? 'Contact Sales' : 'Get Started'}
      </button>

      <div className="pp-divider" />

      <TickList label="Users & Devices" items={usersDevicesItems(plan)} />
      <TickList label="Features" items={featureItems(plan)} />
    </div>
  )
}

const SkeletonCard: React.FC = () => (
  <div className="pp-card pp-skeleton">
    {[31, 66, 40, 40, 111, 176].map((h, i) => (
      <div key={i} className="pp-skeleton-block" style={{ height: `${h}px` }} />
    ))}
  </div>
)

const PricingPlans: React.FC = () => {
  const [plans, setPlans] = useState<ApiPlan[] | null>(null)

  useEffect(() => {
    let cancelled = false
    // Plain fetch (not the shared axios client) so a failed/unreachable request
    // falls back silently to the built-in catalog without firing the global
    // "Cannot connect to server" toast on this public marketing page.
    const base = import.meta.env.VITE_API_URL || ''
    fetch(`${base}/api/billing/plans`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { plans?: ApiPlan[] }) => {
        if (cancelled) return
        // Custom-priced plans (Enterprise) are not shown on the public grid
        const list = ((data?.plans ?? []) as ApiPlan[]).filter(p => p.price !== 'Custom')
        setPlans(list.length ? list : FALLBACK_PLANS)
      })
      .catch(() => {
        if (!cancelled) setPlans(FALLBACK_PLANS)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <section style={{ background: '#FFFFFF', padding: '32px clamp(16px, 4vw, 40px) 80px' }}>
      <div className="pp-grid">
        {plans === null
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          : plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>

      <style>{`
        .pp-grid {
          display: flex;
          align-items: stretch;
          flex-wrap: nowrap;
          overflow-x: auto;
          gap: clamp(16px, 2.5vw, 36px);
          max-width: 1438px;
          margin: 0 auto;
          padding: 16px 4px 32px;
        }
        .pp-card {
          display: flex;
          flex-direction: column;
          gap: 24px;
          flex: 1 1 0;
          min-width: 250px;
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
        .pp-skeleton { border-color: rgba(26, 29, 33, 0.12); }
        .pp-skeleton-block {
          border-radius: 6px;
          background: rgba(26, 29, 33, 0.07);
          animation: ppPulse 1.4s ease-in-out infinite;
        }
        @keyframes ppPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
        /* Cards stay on one line — narrow viewports scroll horizontally */
        @media (max-width: 768px) {
          .pp-card { min-width: 270px; }
        }
      `}</style>
    </section>
  )
}

export default PricingPlans
