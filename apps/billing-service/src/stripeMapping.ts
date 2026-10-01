/**
 * Pure Stripe -> database mapping, kept apart from index.ts so it can be
 * exercised without a Stripe key or a database.
 */

/** Built-in plans that can be bought; each has a STRIPE_PRICE_ID_<PLAN> env var. */
export const PURCHASABLE_PLANS = ['SOLO', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export type PurchasablePlan = typeof PURCHASABLE_PLANS[number];

const clean = (value?: string) => String(value || '').replace(/["']/g, '').trim();

/**
 * The plan a Stripe price belongs to, or null when the price is not one of
 * ours. Null must never be read as "TRIAL": the old table listed only PRO,
 * BUSINESS and ENTERPRISE and fell back to TRIAL, so every Stripe update on a
 * SOLO subscription downgraded a paying customer.
 */
export function planForPrice(priceId: string | null | undefined, env: Record<string, string | undefined> = process.env): PurchasablePlan | null {
  const wanted = clean(priceId || '');
  if (!wanted) return null;
  for (const plan of PURCHASABLE_PLANS) {
    if (clean(env[`STRIPE_PRICE_ID_${plan}`]) === wanted) return plan;
  }
  return null;
}

/** The SubscriptionStatus values the database accepts. */
export type DbSubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';

/**
 * What a Stripe subscription status means for our row. Stripe has statuses the
 * database enum does not (canceled with one L, incomplete, incomplete_expired,
 * unpaid, paused); writing them through upper-cased made the webhook throw.
 *
 *   paid      - the customer is entitled to the plan
 *   past-due  - payment is overdue; keep the plan, flag the row
 *   ended     - the subscription is over; back to TRIAL
 *   abandoned - a checkout that was never paid; forget the subscription id
 *   pending   - a checkout still waiting on the customer; change nothing
 */
export type SubscriptionEffect =
  | { kind: 'paid'; status: DbSubscriptionStatus }
  | { kind: 'past-due' }
  | { kind: 'ended' }
  | { kind: 'abandoned' }
  | { kind: 'pending' };

export function subscriptionEffect(stripeStatus: string | null | undefined): SubscriptionEffect {
  switch (String(stripeStatus || '').toLowerCase()) {
    case 'active': return { kind: 'paid', status: 'ACTIVE' };
    case 'trialing': return { kind: 'paid', status: 'TRIALING' };
    case 'past_due':
    case 'unpaid':
    case 'paused': return { kind: 'past-due' };
    case 'canceled': return { kind: 'ended' };
    case 'incomplete_expired': return { kind: 'abandoned' };
    default: return { kind: 'pending' }; // incomplete, or a status added later
  }
}
