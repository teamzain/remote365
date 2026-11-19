// Mapping between Remote365 plan ids and App Store subscription products (iOS).
//
// The App Store models each plan + period as its own auto-renewable subscription, all in
// one subscription group ("Remote365 Plans") so Apple handles upgrades, downgrades and
// crossgrades between them. Product ids are permanent once created in App Store Connect.
// Price, like on Android, always comes from the store, never from the catalogue.

import type { BillingPeriod, PurchasablePlanId } from './playProducts';

export const APP_STORE_PRODUCT_IDS: Record<PurchasablePlanId, Record<BillingPeriod, string>> = {
  SOLO: { monthly: 'remote365_solo_monthly', yearly: 'remote365_solo_yearly' },
  PRO: { monthly: 'remote365_pro_monthly', yearly: 'remote365_pro_yearly' },
  BUSINESS: { monthly: 'remote365_business_monthly', yearly: 'remote365_business_yearly' },
};

export const ALL_APP_STORE_PRODUCT_IDS = Object.values(APP_STORE_PRODUCT_IDS).flatMap((p) => Object.values(p));

/** Reverse lookup: App Store product id -> plan and period. */
export const APP_STORE_PRODUCT_INFO: Record<string, { plan: PurchasablePlanId; period: BillingPeriod }> = Object.fromEntries(
  (Object.keys(APP_STORE_PRODUCT_IDS) as PurchasablePlanId[]).flatMap((plan) =>
    (['monthly', 'yearly'] as BillingPeriod[]).map((period) => [APP_STORE_PRODUCT_IDS[plan][period], { plan, period }]),
  ),
);

/** Apple's standard licence agreement, linked from the paywall as Terms of Use (EULA). */
export const APPLE_STANDARD_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
