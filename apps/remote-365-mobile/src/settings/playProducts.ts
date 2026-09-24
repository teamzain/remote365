// Mapping between Remote365 plan ids and Google Play subscription products.
//
// Play is the source of truth for PRICE on Android. The numbers in
// packages/shared/src/plans.ts are the catalogue used by web and desktop; showing those
// on Android instead of the price Play returns is a Play policy rejection, because Play
// prices are per-country and Google may adjust them. So this module maps ids only — never
// amounts.
//
// Product ids are permanent once created in Play Console. Renaming one means creating a
// new product and migrating subscribers, so they are deliberately boring and versionless.

/** Plan ids that can be bought self-serve on Android. */
export type PurchasablePlanId = 'SOLO' | 'PRO' | 'BUSINESS';

/** Billing period, matching the base plan suffix configured in Play Console. */
export type BillingPeriod = 'monthly' | 'yearly';

export const PLAY_PRODUCT_IDS: Record<PurchasablePlanId, string> = {
  SOLO: 'remote365_solo',
  PRO: 'remote365_pro',
  BUSINESS: 'remote365_business',
};

/** Every product id the app asks Play about at startup. */
export const ALL_PLAY_PRODUCT_IDS = Object.values(PLAY_PRODUCT_IDS);

/** Reverse lookup for turning a Play purchase back into a Remote365 plan. */
export const PLAN_ID_BY_PLAY_PRODUCT: Record<string, PurchasablePlanId> = Object.fromEntries(
  Object.entries(PLAY_PRODUCT_IDS).map(([plan, product]) => [product, plan as PurchasablePlanId]),
) as Record<string, PurchasablePlanId>;

/**
 * Base plan id within a subscription product, e.g. `pro-monthly`.
 *
 * Play models a subscription as one product with several base plans rather than one
 * product per period, so the period lives here and not in the product id.
 */
export function basePlanId(plan: PurchasablePlanId, period: BillingPeriod): string {
  return `${plan.toLowerCase()}-${period}`;
}

/** TRIAL is free and ENTERPRISE is sales-led; neither is a Play product. */
export function isPurchasable(planId: string): planId is PurchasablePlanId {
  return planId in PLAY_PRODUCT_IDS;
}
