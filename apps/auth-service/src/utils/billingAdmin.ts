/**
 * Stop a user's paid subscription from auth-service.
 *
 * Stripe lives in billing-service, so this forwards the calling super admin's
 * own bearer token to billing-service's admin cancel route, which is gated
 * there by the same platform-only permission. Best-effort with a short
 * timeout: a billing hiccup must never block the suspend/delete that
 * triggered it — the failure is logged so it can be finished by hand.
 */
export async function cancelBillingForUser(userId: string, authHeader: string | undefined, why: string): Promise<boolean> {
  if (!authHeader) return false;
  const billingUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:3004';
  try {
    const res = await fetch(`${billingUrl}/billing/admin/subscriptions/${encodeURIComponent(userId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return false; // no subscription row — nothing to stop
    if (!res.ok) {
      console.warn(`[Billing] Cancel for user ${userId} (${why}) returned ${res.status}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`[Billing] Cancel for user ${userId} (${why}) failed: ${err?.message || err}`);
    return false;
  }
}
