// Google Play Billing for subscription upgrades on Android.
//
// Play, not our catalogue, owns the price the user sees here: Play prices are set per
// country in the console and Google may adjust them, so rendering the hard-coded numbers
// from the plan catalogue would eventually show a price that differs from what is
// charged — a Play policy rejection. Every price in this hook is a `displayPrice` string
// straight from Play.
//
// The entitlement itself is never granted by this file. A purchase is only real once the
// backend has verified the token against the Play Developer API, because anything the
// client reports can be forged. finishTransaction runs only after that verification, and
// not finishing within three days makes Google auto-refund the purchase — so the failure
// mode of a backend outage is a refund, not a free subscription.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { fetchProducts as fetchStoreProducts, useIAP } from 'expo-iap';
import type { Purchase, ProductSubscription, SubscriptionOffer } from 'expo-iap';
import {
  ALL_PLAY_PRODUCT_IDS,
  PLAY_PRODUCT_IDS,
  basePlanId,
  type BillingPeriod,
  type PurchasablePlanId,
} from './playProducts';
import { verifyPlayPurchase } from './billingApi';

export type PlayPrice = {
  /** Price string localised by Play, e.g. "PKR 4,200.00". Render verbatim. */
  displayPrice: string;
  offerToken: string;
};

export type PlayBillingState = {
  /** False on iOS, on a build with no Play Store, or before the connection settles. */
  available: boolean;
  loading: boolean;
  /** Keyed `${planId}:${period}` — absent means Play has no offer for that combination. */
  prices: Record<string, PlayPrice>;
  purchasing: PurchasablePlanId | null;
  error: string | null;
  buy: (plan: PurchasablePlanId, period: BillingPeriod) => Promise<void>;
};

const priceKey = (plan: PurchasablePlanId, period: BillingPeriod) => `${plan}:${period}`;

/** Pick the offer for one base plan. Play returns every offer on the product. */
function findOffer(
  product: ProductSubscription | undefined,
  plan: PurchasablePlanId,
  period: BillingPeriod,
): SubscriptionOffer | undefined {
  const wanted = basePlanId(plan, period);
  return product?.subscriptionOffers?.find((o) => o.basePlanIdAndroid === wanted);
}

/** Every Play offer for our plans, keyed `${planId}:${period}`. */
function pricesFrom(subscriptions: ProductSubscription[]): Record<string, PlayPrice> {
  const out: Record<string, PlayPrice> = {};
  for (const plan of Object.keys(PLAY_PRODUCT_IDS) as PurchasablePlanId[]) {
    const product = subscriptions.find((s) => s.id === PLAY_PRODUCT_IDS[plan]);
    for (const period of ['monthly', 'yearly'] as BillingPeriod[]) {
      const offer = findOffer(product, plan, period);
      // Android carries the purchase token on the *Android suffixed field; the bare
      // `offerToken` in the cross-platform type is iOS discount signing, not this.
      if (offer?.offerTokenAndroid) {
        out[priceKey(plan, period)] = {
          displayPrice: offer.displayPrice,
          offerToken: offer.offerTokenAndroid,
        };
      }
    }
  }
  return out;
}

/**
 * Ask Play for our subscription products, keeping only ones Play can actually sell.
 *
 * Billing Library 8+ also reports ids it could NOT find, and the store module can hand
 * those back as rows with no purchasable offer. Counting them made a console with no
 * subscriptions at all look like "this period is missing" (seen on a Galaxy A05,
 * 2026-11-17), so a row only counts when it has an offer token.
 */
async function queryPlaySubscriptions(): Promise<ProductSubscription[]> {
  const rows = await fetchStoreProducts({ skus: ALL_PLAY_PRODUCT_IDS, type: 'subs' });
  return (Array.isArray(rows) ? rows : []).filter(
    (row): row is ProductSubscription =>
      Array.isArray((row as ProductSubscription)?.subscriptionOffers)
      && (row as ProductSubscription).subscriptionOffers!.some((offer) => Boolean(offer?.offerTokenAndroid)),
  );
}

export function usePlayBilling(
  apiBaseUrl: string,
  authToken: string | null,
  onEntitled: (planId: PurchasablePlanId) => void,
): PlayBillingState {
  const isAndroid = Platform.OS === 'android';
  const [purchasing, setPurchasing] = useState<PurchasablePlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isAndroid);

  // Subscriptions as last returned by Play. Kept here rather than read from the hook so
  // a tap on Upgrade can re-query Play and use the answer in the same call.
  const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);

  const { connected, requestPurchase, finishTransaction, reconnect } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      try {
        const result = await verifyPlayPurchase(apiBaseUrl, authToken, purchase);
        if (!result.success) {
          // Deliberately NOT finished: leaving the transaction open means Google refunds
          // it automatically rather than charging for an entitlement we never granted.
          setError(result.error || 'We could not confirm that purchase. It will be refunded.');
          return;
        }
        await finishTransaction({ purchase, isConsumable: false });
        onEntitled(result.plan);
      } catch {
        setError('We could not confirm that purchase. It will be refunded automatically.');
      } finally {
        setPurchasing(null);
      }
    },
    onPurchaseError: (err) => {
      setPurchasing(null);
      // A cancel is a normal outcome, not something to shout about.
      const cancelled = String(err?.code || '').toUpperCase().includes('CANCEL');
      setError(cancelled ? null : err?.message || 'The purchase could not be completed.');
    },
  });

  useEffect(() => {
    if (!isAndroid || !connected) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await queryPlaySubscriptions();
        if (!cancelled) setSubscriptions(rows);
      } catch {
        if (!cancelled) setError('Could not reach Google Play.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAndroid, connected]);

  const prices = useMemo(() => pricesFrom(subscriptions), [subscriptions]);

  const buy = useCallback(
    async (plan: PurchasablePlanId, period: BillingPeriod) => {
      setError(null);
      // Spinner on the tapped button from the start: the reconnect and re-query below
      // can take a second or two, and a button that does nothing looks broken.
      setPurchasing(plan);
      const fail = (message: string) => {
        setPurchasing(null);
        setError(message);
      };
      // The store connection can drop or never come up at launch (Play Store still
      // updating, account switch). Try once more before saying Play is unavailable.
      if (!connected && !(await reconnect().catch(() => false))) {
        fail('Google Play is not reachable right now. Check that the Play Store is installed and signed in, then try again.');
        return;
      }
      let offer = prices[priceKey(plan, period)];
      let known = subscriptions;
      if (!offer) {
        // The first query can race the connection or predate a product going live, so
        // ask Play again before giving up — the tap used to fail on stale data alone.
        try {
          known = await queryPlaySubscriptions();
          setSubscriptions(known);
          offer = pricesFrom(known)[priceKey(plan, period)];
        } catch {
          fail('Could not reach Google Play. Please try again.');
          return;
        }
      }
      if (!offer) {
        // Play answered but has no active offer for this plan: the subscription or its
        // base plan is not created/activated for this app in Play Console, or this copy
        // of the app was not installed from Google Play.
        fail(
          known.length === 0
            ? 'Plans are not on sale in Google Play for this app yet. Please try again later.'
            : `The ${period} option for this plan is not on sale in Google Play yet. Try the other billing period, or try again later.`,
        );
        return;
      }
      try {
        await requestPurchase({
          type: 'subs',
          request: {
            google: {
              skus: [PLAY_PRODUCT_IDS[plan]],
              subscriptionOffers: [{ sku: PLAY_PRODUCT_IDS[plan], offerToken: offer.offerToken }],
            },
          },
        });
        // Outcome arrives through onPurchaseSuccess / onPurchaseError, never from here.
      } catch (e: any) {
        setPurchasing(null);
        setError(e?.message || 'Google Play could not start the purchase.');
      }
    },
    [connected, prices, reconnect, requestPurchase, subscriptions],
  );

  return {
    available: isAndroid && connected,
    loading: isAndroid ? loading : false,
    prices,
    purchasing,
    error,
    buy,
  };
}
