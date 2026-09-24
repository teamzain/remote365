// Server-side verification of Google Play subscription purchases.
//
// Nothing the app reports about a purchase is trusted: a client can claim any product id
// and any token, so entitlement is only ever written after Google itself confirms the
// purchase against the Play Developer API.
//
// Uses google-auth-library directly rather than the googleapis package — this is two REST
// calls, and googleapis would pull in every Google API surface for them.

import { JWT } from 'google-auth-library';

const ANDROID_PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/** Package name of the Android viewer app. Must match the AAB uploaded to Play. */
export const PLAY_PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.remote365.mobile';

/**
 * Play product id → Remote365 plan id.
 *
 * Kept server-side deliberately: if the client chose the plan, anyone could buy the
 * cheapest product and claim the most expensive plan.
 */
export const PLAN_BY_PLAY_PRODUCT: Record<string, 'SOLO' | 'PRO' | 'BUSINESS'> = {
  remote365_solo: 'SOLO',
  remote365_pro: 'PRO',
  remote365_business: 'BUSINESS',
};

export type PlaySubscriptionState =
  | 'SUBSCRIPTION_STATE_ACTIVE'
  | 'SUBSCRIPTION_STATE_CANCELED'
  | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_STATE_ON_HOLD'
  | 'SUBSCRIPTION_STATE_PAUSED'
  | 'SUBSCRIPTION_STATE_EXPIRED'
  | 'SUBSCRIPTION_STATE_PENDING'
  | 'SUBSCRIPTION_STATE_UNSPECIFIED';

export type PlayPurchase = {
  state: PlaySubscriptionState;
  /** Product id from the purchase's line item — the authoritative one, not the client's. */
  productId: string | null;
  expiryTime: Date | null;
  /** True while Google is still waiting for us to acknowledge; unacknowledged auto-refunds. */
  needsAcknowledgement: boolean;
  /** Set when this purchase supersedes an earlier one (upgrade/downgrade chain). */
  linkedPurchaseToken: string | null;
  /** Play's own account identifier, when the purchase carried one. */
  externalAccountId: string | null;
};

let cachedClient: JWT | null = null;

/**
 * Service-account client for the Play Developer API.
 *
 * Credentials come from GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the whole downloaded key file
 * as one env value). Returns null when unset so the route can answer with a clear
 * "not configured" instead of a stack trace — the key is issued in the Play Console and
 * can take up to 24h to gain permission after being granted.
 */
function playClient(): JWT | null {
  if (cachedClient) return cachedClient;
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let creds: { client_email?: string; private_key?: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    console.error('[play-billing] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON');
    return null;
  }
  if (!creds.client_email || !creds.private_key) {
    console.error('[play-billing] service account JSON is missing client_email or private_key');
    return null;
  }
  cachedClient = new JWT({
    email: creds.client_email,
    // Values pasted through env files arrive with literal \n rather than newlines.
    key: creds.private_key.replace(/\n/g, '\n'),
    scopes: [SCOPE],
  });
  return cachedClient;
}

export function isPlayBillingConfigured(): boolean {
  return playClient() !== null;
}

/**
 * Look up a purchase token with `purchases.subscriptionsv2.get`.
 *
 * Returns null when Google does not recognise the token — which is the answer for a
 * forged one, so callers must treat null as "no entitlement", never as a transient error.
 */
export async function getSubscriptionPurchase(purchaseToken: string): Promise<PlayPurchase | null> {
  const client = playClient();
  if (!client) throw new Error('Google Play billing is not configured on this server.');

  const url = `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(PLAY_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await client.request<any>({ url, method: 'GET' }).catch((e: any) => {
    const status = e?.response?.status;
    // 404 and 410 both mean "Google has no such live purchase".
    if (status === 404 || status === 410) return null;
    throw e;
  });
  if (!res) return null;

  const data = res.data || {};
  const line = Array.isArray(data.lineItems) && data.lineItems.length ? data.lineItems[0] : null;
  const expiry = line?.expiryTime ? new Date(line.expiryTime) : null;

  return {
    state: (data.subscriptionState as PlaySubscriptionState) || 'SUBSCRIPTION_STATE_UNSPECIFIED',
    productId: line?.productId ?? null,
    expiryTime: expiry && !Number.isNaN(expiry.getTime()) ? expiry : null,
    needsAcknowledgement: data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    linkedPurchaseToken: data.linkedPurchaseToken ?? null,
    externalAccountId: data.externalAccountIdentifiers?.externalAccountId ?? null,
  };
}

/**
 * Acknowledge a purchase so Google stops counting down to an automatic refund.
 *
 * Google refunds and revokes anything left unacknowledged for three days. Call this only
 * once the entitlement is actually written, so a crash between the two leaves the user
 * refunded rather than charged for nothing.
 */
export async function acknowledgeSubscription(productId: string, purchaseToken: string): Promise<void> {
  const client = playClient();
  if (!client) throw new Error('Google Play billing is not configured on this server.');

  const url = `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(PLAY_PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  await client.request({ url, method: 'POST', data: {} });
}

/** States that should grant access. Grace period still works; on-hold and paused do not. */
export function grantsAccess(state: PlaySubscriptionState): boolean {
  return (
    state === 'SUBSCRIPTION_STATE_ACTIVE' ||
    state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
    // Cancelled means auto-renew is off, not that it has ended — access runs to expiry.
    state === 'SUBSCRIPTION_STATE_CANCELED'
  );
}

/**
 * Pub/Sub push envelope. Google wraps the actual notification in base64 inside `message`.
 */
export type PubSubEnvelope = {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
};

export type SubscriptionNotification = {
  notificationType: number;
  purchaseToken: string;
  subscriptionId: string;
};

export type DeveloperNotification = {
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: SubscriptionNotification;
  /** Refunds and chargebacks. Carries the token of the purchase that was voided. */
  voidedPurchaseNotification?: { purchaseToken?: string; orderId?: string; productType?: number };
  testNotification?: { version?: string };
};

/**
 * Decode the Pub/Sub envelope into a developer notification.
 *
 * Returns null for anything malformed. A malformed push must still be ACKed with a 200,
 * or Pub/Sub redelivers it forever.
 */
export function decodeDeveloperNotification(body: PubSubEnvelope): DeveloperNotification | null {
  const data = body?.message?.data;
  if (!data || typeof data !== 'string') return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Verify that a push actually came from our Pub/Sub subscription.
 *
 * This endpoint is public — Google has to be able to reach it — so without a check anyone
 * could POST a forged "renewed" notification. Pub/Sub signs pushes with an OIDC token when
 * the subscription is configured with a service-account audience.
 *
 * Returns true when unconfigured ONLY if a shared secret is also unset, so a deployment
 * cannot silently accept unauthenticated pushes once either mechanism is in place.
 */
export async function verifyPushAuthenticity(
  authorizationHeader: string | undefined,
  providedSecret: string | undefined,
): Promise<boolean> {
  const expectedSecret = process.env.GOOGLE_PLAY_RTDN_SECRET;
  const audience = process.env.GOOGLE_PLAY_RTDN_AUDIENCE;

  if (expectedSecret) {
    // Length-independent compare is not needed for a URL secret of fixed length, but a
    // mismatch must never short-circuit into accepting the OIDC path below.
    return providedSecret === expectedSecret;
  }

  if (audience) {
    const bearer = (authorizationHeader || '').replace(/^Bearer\s+/i, '');
    if (!bearer) return false;
    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client();
      await client.verifyIdToken({ idToken: bearer, audience });
      return true;
    } catch {
      return false;
    }
  }

  // Neither mechanism configured: refuse rather than trust the internet.
  return false;
}
