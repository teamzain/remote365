/** Thin client for the auth-service billing routes (test-mode, no Stripe). */
export type Plan = {
  id: string;
  name: string;
  price: number | 'Custom';
  priceLabel: string;
  description: string;
  maxDevices: number | null;
  maxUsers: number | null;
  maxConcurrentSessions: number | null;
  features: string[];
  popular?: boolean;
};

export type Subscription = {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  catalog?: Plan;
};

export async function fetchPlans(apiBaseUrl: string): Promise<Plan[]> {
  const res = await fetch(`${apiBaseUrl}/api/billing/plans`);
  if (!res.ok) throw new Error('Could not load plans');
  const data = await res.json();
  // The API may return a bare array or a { plans: [...] } wrapper.
  if (Array.isArray(data)) return data as Plan[];
  if (Array.isArray(data?.plans)) return data.plans as Plan[];
  return [];
}

/** Current subscription — returns null when the account has none (e.g. non-owner 404).
 * Uses /billing/current (the same endpoint web + desktop read), which resolves
 * the ORG OWNER's subscription for members — so a plan upgraded on desktop/web
 * shows up here as soon as the screen reloads. The old /billing/subscription
 * path never existed on the service (404), leaving this screen stuck on the
 * default plan forever. */
export async function fetchSubscription(apiBaseUrl: string, token: string | null): Promise<Subscription | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${apiBaseUrl}/api/billing/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as Subscription;
  } catch {
    return null;
  }
}

/** Change the signed-in owner's plan (test mode). Returns an error string on failure. */
export async function changePlan(
  apiBaseUrl: string,
  token: string | null,
  plan: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/billing/my-plan`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ plan }),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) return { success: false, error: data?.error || 'Could not change plan.' };
    return { success: true };
  } catch {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Hand a Google Play purchase to the backend for verification.
 *
 * The client is not trusted here: `purchaseToken` is checked against the Play Developer
 * API server-side before any entitlement is written, and the same token cannot be bound
 * to a second account. The caller must not call finishTransaction until this succeeds —
 * an unfinished purchase is auto-refunded by Google, which is the correct outcome when we
 * cannot confirm it.
 */
export async function verifyPlayPurchase(
  apiBaseUrl: string,
  token: string | null,
  purchase: { productId?: string; id?: string; purchaseToken?: string | null },
): Promise<{ success: true; plan: 'SOLO' | 'PRO' | 'BUSINESS' } | { success: false; error?: string }> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/billing/google-play/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        productId: purchase.productId ?? purchase.id,
        purchaseToken: purchase.purchaseToken,
      }),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) return { success: false, error: data?.error || 'Could not verify the purchase.' };
    return { success: true, plan: data.plan };
  } catch {
    return { success: false, error: 'Network error while confirming your purchase.' };
  }
}
