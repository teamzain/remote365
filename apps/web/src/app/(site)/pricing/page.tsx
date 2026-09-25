import type { Metadata } from 'next'
import { connection } from 'next/server'
import SiteContent from '@/components/site/SiteContent'
import PricingPlans from '@/components/landing/PricingPlans'
import PricingFAQ from '@/components/landing/PricingFAQ'
import { getPublicPlans, type ApiPlan } from '@/lib/plans'
import { pageMetadata } from '@/lib/seo'

// "a 15-day free trial, then Solo at $15, Pro at $40 and Business at $100 per
// month" — from the live catalogue, so it never disagrees with the cards.
function priceSummary(plans: ApiPlan[]): string {
  const trial = plans.find(p => p.price === 0)
  const paid = plans.filter(p => typeof p.price === 'number' && p.price > 0)
  const list = paid.map(p => `${p.name} at $${p.price}`)
  const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? ''
  const days = trial?.priceLabel.match(/(\d+)\s*days?/i)?.[1]
  const trialText = trial ? `${days ? `a ${days}-day` : 'a'} free trial, then ` : ''
  return `${trialText}${joined} per month`
}

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  const plans = await getPublicPlans()
  return pageMetadata({
    title: 'Pricing',
    description: `Remote365 pricing in US dollars: ${priceSummary(plans)}, each with set limits on members, devices and concurrent remote sessions.`,
    path: '/pricing',
  })
}

export default async function PricingPage() {
  // Rendered per request (not at build time, when the billing API is out of
  // reach); the plan fetch itself is cached for a few minutes.
  await connection()
  const plans = await getPublicPlans()

  return (
    <SiteContent>
      {/* Pricing hero — same two-tone gradient headline as the home hero */}
      <section className="pr-hero">
        <h1 className="pr-title">
          <span className="pr-title-top">Plans that work</span>
          <span className="pr-title-accent">for everyone</span>
        </h1>
      </section>

      <main>
        <PricingPlans plans={plans} />
        <PricingFAQ />
      </main>

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
    </SiteContent>
  )
}
