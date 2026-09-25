// Public plan catalogue for the pricing page, JSON-LD and llms.txt. Server
// only: it reads the billing API directly, so the prices are in the HTML
// that search engines and AI crawlers fetch.

// Shape of GET /api/billing/plans — the merged catalogue (built-ins plus any
// custom plans the super admin created).
export interface ApiPlan {
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
  trialDays?: number
  auditRetentionDays?: number | 'Custom'
}

// Snapshot of the built-in catalogue, used when the API is unreachable so
// the page is never empty.
export const FALLBACK_PLANS: ApiPlan[] = [
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

// In the container, PLANS_API_URL points straight at billing-service on the
// Docker network. `next dev` uses the API host from .env.development.
function plansUrl(): string | null {
  if (process.env.PLANS_API_URL) return process.env.PLANS_API_URL
  if (process.env.NEXT_PUBLIC_API_URL) return `${process.env.NEXT_PUBLIC_API_URL}/api/billing/plans`
  return null
}

/** Publicly listed plans (custom-priced ones are sold through sales, not shown). */
export async function getPublicPlans(): Promise<ApiPlan[]> {
  const url = plansUrl()
  if (!url) return FALLBACK_PLANS
  try {
    const res = await fetch(url, {
      // Shared by every visitor for five minutes, so a super-admin price
      // change shows up quickly without calling billing on every page view.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) throw new Error(`plans API ${res.status}`)
    const data = (await res.json()) as { plans?: ApiPlan[] }
    const list = (data.plans ?? []).filter(p => p.price !== 'Custom')
    return list.length ? list : FALLBACK_PLANS
  } catch (err) {
    console.warn('[pricing] using the built-in plan catalogue:', (err as Error).message)
    return FALLBACK_PLANS
  }
}
