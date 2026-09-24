// Entitlement resolution. Deliberately free of any database import: this is the single
// decision that says which plan a subscription actually grants, it is called on nearly
// every authenticated request, and it must be testable without standing up Prisma.

/**
 * The plan a subscription actually entitles the holder to, right now.
 *
 * Expiry is enforced for Google Play subscriptions ONLY, and deliberately so. Play is the
 * one platform where something external stops paying us — a cancel, a refund, a card that
 * fails — and where `currentPeriodEnd` is written from an authoritative source on every
 * verification and notification.
 *
 * It is NOT enforced for MANUAL or STRIPE rows because their `currentPeriodEnd` is not
 * trustworthy: `applyPlanChange` never used to touch it (it clears it now), so a user
 * moved onto a paid plan by the old test-mode route may still carry whatever date their
 * trial had — usually one in the past. Expiring on that would mass-downgrade existing
 * accounts the moment this shipped.
 *
 * A row with no `currentPeriodEnd` never expires; a super-admin grant is open-ended by
 * design. A row whose `platform` was not selected in the query is treated as
 * non-expiring, so partial `select:`s keep their previous behaviour.
 */
export const effectivePlanId = (
  sub:
    | {
        plan?: string | null;
        customPlanKey?: string | null;
        platform?: string | null;
        currentPeriodEnd?: Date | string | null;
      }
    | null
    | undefined,
): string => {
  if (sub?.platform === 'GOOGLE_PLAY' && sub.currentPeriodEnd) {
    const end = sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd);
    // The safety net for a dropped Pub/Sub notification: without it, a missed
    // SUBSCRIPTION_EXPIRED would mean access forever rather than access to period end.
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) return 'TRIAL';
  }
  return (sub?.customPlanKey || sub?.plan || 'TRIAL') as string;
};
