import assert from 'node:assert/strict';
import { effectivePlanId } from './plan-entitlement';

// The expiry rule decides whether somebody keeps a paid plan, so it is pinned against the
// two failure modes that actually cost money or trust: never expiring a lapsed Play
// subscription, and mass-downgrading everybody else.

const past = new Date(Date.now() - 86_400_000);
const future = new Date(Date.now() + 86_400_000);

// A lapsed Play subscription loses its plan.
assert.equal(effectivePlanId({ plan: 'PRO', platform: 'GOOGLE_PLAY', currentPeriodEnd: past }), 'TRIAL');

// A live one keeps it.
assert.equal(effectivePlanId({ plan: 'PRO', platform: 'GOOGLE_PLAY', currentPeriodEnd: future }), 'PRO');

// Expiry may arrive as an ISO string rather than a Date.
assert.equal(
  effectivePlanId({ plan: 'PRO', platform: 'GOOGLE_PLAY', currentPeriodEnd: past.toISOString() }),
  'TRIAL',
);

// applyPlanChange never sets currentPeriodEnd, so MANUAL rows carry stale trial dates.
// Expiring on those would mass-downgrade every account that ever changed plan.
assert.equal(effectivePlanId({ plan: 'BUSINESS', platform: 'MANUAL', currentPeriodEnd: past }), 'BUSINESS');

// A query that did not select `platform` must keep its previous behaviour.
assert.equal(effectivePlanId({ plan: 'BUSINESS', currentPeriodEnd: past }), 'BUSINESS');

// A super-admin grant is open-ended by design.
assert.equal(effectivePlanId({ plan: 'PRO', platform: 'GOOGLE_PLAY', currentPeriodEnd: null }), 'PRO');

// A corrupt date must not silently expire a paying user.
assert.equal(effectivePlanId({ plan: 'PRO', platform: 'GOOGLE_PLAY', currentPeriodEnd: 'not-a-date' }), 'PRO');

// Custom plans still win over the enum.
assert.equal(effectivePlanId({ plan: 'TRIAL', customPlanKey: 'agency', platform: 'MANUAL' }), 'agency');

// No subscription at all.
assert.equal(effectivePlanId(null), 'TRIAL');
assert.equal(effectivePlanId(undefined), 'TRIAL');

console.log('Plan entitlement tests passed');
