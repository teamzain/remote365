// App Store (StoreKit 2) billing for subscription upgrades on iOS.
//
// The iOS counterpart of usePlayBilling, with the same shape so UpgradePlanScreen can use
// either. Prices are Apple's `displayPrice` strings, never the catalogue numbers: Apple
// sets the local price per storefront, and App Review rejects a paywall whose price
// differs from what the purchase sheet then charges.
//
// The entitlement is granted by the server only. After StoreKit reports a purchase, the
// transaction's JWS goes to /api/billing/app-store/verify, which checks Apple's signature
// and certificate chain. The transaction is finished only after that answers. An
// unfinished transaction is redelivered by StoreKit on the next launch, so a server
// outage delays the upgrade rather than losing the purchase.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  deepLinkToSubscriptions,
  fetchProducts as fetchStoreProducts,
  getAvailablePurchases,
  restorePurchases,
  useIAP,
} from 'expo-iap';
import type { Purchase, ProductSubscription } from 'expo-iap';
import type { BillingPeriod, PurchasablePlanId } from './playProducts';
import { ALL_APP_STORE_PRODUCT_IDS, APP_STORE_PRODUCT_IDS, APP_STORE_PRODUCT_INFO } from './appStoreProducts';
import { verifyAppStorePurchase } from './billingApi';

export type StorePrice = { displayPrice: string };

/** What UpgradePlanScreen needs from a store, on either platform. */
export type StoreBillingState = {
  available: boolean;
  loading: boolean;
  /** Keyed `${planId}:${period}` — absent means the store has no product for it. */
  prices: Record<string, StorePrice>;
  purchasing: PurchasablePlanId | null;
  error: string | null;
  buy: (plan: PurchasablePlanId, period: BillingPeriod) => Promise<void>;
  /** iOS only: re-sync with the App Store and re-apply an active subscription. */
  restore?: () => Promise<boolean>;
  restoring?: boolean;
  /** iOS only: open the App Store's subscription management sheet. */
  manage?: () => Promise<void>;
};

const priceKey = (plan: PurchasablePlanId, period: BillingPeriod) => `${plan}:${period}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pricesFrom(rows: ProductSubscription[]): Record<string, StorePrice> {
  const out: Record<string, StorePrice> = {};
  for (const row of rows) {
    const info = APP_STORE_PRODUCT_INFO[row.id];
    if (info && row.displayPrice) out[priceKey(info.plan, info.period)] = { displayPrice: row.displayPrice };
  }
  return out;
}

async function queryAppStoreSubscriptions(): Promise<ProductSubscription[]> {
  const rows = await fetchStoreProducts({ skus: ALL_APP_STORE_PRODUCT_IDS, type: 'subs' });
  return (Array.isArray(rows) ? rows : []).filter(
    (row): row is ProductSubscription => Boolean((row as ProductSubscription)?.id && (row as ProductSubscription)?.displayPrice),
  );
}

export function useAppStoreBilling(
  apiBaseUrl: string,
  authToken: string | null,
  onEntitled: (planId: PurchasablePlanId) => void,
  userId?: string | null,
): StoreBillingState {
  const isIOS = Platform.OS === 'ios';
  const [purchasing, setPurchasing] = useState<PurchasablePlanId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isIOS);
  const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);

  const settle = useCallback(
    async (purchase: Purchase, finish: (p: Purchase) => Promise<unknown>) => {
      const jws = purchase.purchaseToken;
      if (!jws || !APP_STORE_PRODUCT_INFO[purchase.productId]) return;
      const result = await verifyAppStorePurchase(apiBaseUrl, authToken, jws);
      if (result.success) {
        await finish(purchase);
        onEntitled(result.plan);
        return;
      }
      // A final "no" (expired, belongs to another account) would otherwise be redelivered
      // on every launch. Finishing it does not cancel anything at Apple: an active
      // subscription can still be restored later.
      if (result.permanent) await finish(purchase).catch(() => {});
      setError(result.error || 'We could not confirm that purchase. Tap Restore Purchases to try again.');
    },
    [apiBaseUrl, authToken, onEntitled],
  );

  const { connected, requestPurchase, finishTransaction, reconnect } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      try {
        await settle(purchase, (p) => finishTransaction({ purchase: p, isConsumable: false }));
      } catch {
        setError('We could not confirm that purchase. Tap Restore Purchases to try again.');
      } finally {
        setPurchasing(null);
      }
    },
    onPurchaseError: (err) => {
      setPurchasing(null);
      const cancelled = String(err?.code || '').toUpperCase().includes('CANCEL');
      setError(cancelled ? null : err?.message || 'The purchase could not be completed.');
    },
  });

  useEffect(() => {
    if (!isIOS || !connected) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await queryAppStoreSubscriptions();
        if (!cancelled) setSubscriptions(rows);
      } catch {
        if (!cancelled) setError('Could not reach the App Store.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isIOS, connected]);

  const prices = useMemo(() => pricesFrom(subscriptions), [subscriptions]);

  const buy = useCallback(
    async (plan: PurchasablePlanId, period: BillingPeriod) => {
      setError(null);
      setPurchasing(plan);
      const fail = (message: string) => {
        setPurchasing(null);
        setError(message);
      };
      if (!connected && !(await reconnect().catch(() => false))) {
        fail('The App Store is not reachable right now. Check your connection and try again.');
        return;
      }
      let available = prices[priceKey(plan, period)];
      if (!available) {
        try {
          const rows = await queryAppStoreSubscriptions();
          setSubscriptions(rows);
          available = pricesFrom(rows)[priceKey(plan, period)];
        } catch {
          fail('Could not reach the App Store. Please try again.');
          return;
        }
      }
      if (!available) {
        fail(`The ${period} option for this plan is not available in the App Store yet. Please try again later.`);
        return;
      }
      try {
        await requestPurchase({
          type: 'subs',
          request: {
            apple: {
              sku: APP_STORE_PRODUCT_IDS[plan][period],
              // Ties the transaction to this account; the server refuses it for anyone else.
              appAccountToken: userId && UUID_RE.test(userId) ? userId : undefined,
            },
          },
        });
        // The outcome arrives through onPurchaseSuccess / onPurchaseError.
      } catch (e: any) {
        setPurchasing(null);
        setError(e?.message || 'The App Store could not start the purchase.');
      }
    },
    [connected, prices, reconnect, requestPurchase, userId],
  );

  const restore = useCallback(async () => {
    setError(null);
    setRestoring(true);
    try {
      await restorePurchases();
      const purchases = await getAvailablePurchases();
      const ours = (Array.isArray(purchases) ? purchases : [])
        .filter((p) => APP_STORE_PRODUCT_INFO[p.productId] && p.purchaseToken)
        .sort((a, b) => ((b as any).expirationDateIOS ?? 0) - ((a as any).expirationDateIOS ?? 0));
      if (!ours.length) {
        setError('No active Remote365 subscription was found for this Apple Account.');
        return false;
      }
      const result = await verifyAppStorePurchase(apiBaseUrl, authToken, ours[0].purchaseToken!);
      if (!result.success) {
        setError(result.error || 'We could not restore that subscription.');
        return false;
      }
      onEntitled(result.plan);
      return true;
    } catch (e: any) {
      setError(e?.message || 'Could not restore purchases. Please try again.');
      return false;
    } finally {
      setRestoring(false);
    }
  }, [apiBaseUrl, authToken, onEntitled]);

  const manage = useCallback(async () => {
    try {
      await deepLinkToSubscriptions({});
    } catch {
      setError('Open Settings > Apple Account > Subscriptions to manage your plan.');
    }
  }, []);

  return {
    available: isIOS && connected,
    loading: isIOS ? loading : false,
    prices,
    purchasing,
    error,
    buy,
    restore,
    restoring,
    manage,
  };
}
