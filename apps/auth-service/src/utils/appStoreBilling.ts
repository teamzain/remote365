// App Store (StoreKit 2) subscriptions for the iOS app.
//
// Everything here works from data Apple signed. StoreKit hands the app a JWS for each
// transaction, and App Store Server Notifications arrive as a JWS too; Apple's own
// library checks the certificate chain up to Apple Root CA - G3 (embedded below, so no
// file has to ship next to the build) and the signature, and confirms the bundle ID.
// Nothing the client claims alongside the JWS is trusted.
//
// Both environments are accepted on every server: TestFlight and App Review always buy
// in the sandbox, even against production, and rejecting those would fail review.
// Sandbox subscriptions renew every few minutes to hours and stop after a handful of
// renewals, so a free sandbox purchase only entitles for a short while.

import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';

export const APP_STORE_BUNDLE_ID = process.env.APP_STORE_BUNDLE_ID || 'ai.remote365.mobile';
// App Store Connect app id (Apple ID of the app); required to verify production data.
export const APP_STORE_APP_ID = Number(process.env.APP_STORE_APP_ID || 6836702539);

/** Apple Root CA - G3, DER, base64. SHA-256 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79 */
const APPLE_ROOT_CA_G3 = 'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

export type AppStorePlanId = 'SOLO' | 'PRO' | 'BUSINESS';

/** App Store product ids (one per plan and period, all in one subscription group). */
export const PLAN_BY_APP_STORE_PRODUCT: Record<string, AppStorePlanId> = {
  remote365_solo_monthly: 'SOLO',
  remote365_solo_yearly: 'SOLO',
  remote365_pro_monthly: 'PRO',
  remote365_pro_yearly: 'PRO',
  remote365_business_monthly: 'BUSINESS',
  remote365_business_yearly: 'BUSINESS',
};

const roots = [Buffer.from(APPLE_ROOT_CA_G3, 'base64')];
// Online (OCSP) checks stay off: they add a network round trip to Apple per call and a
// hard failure when it is slow, and the chain + signature check is what proves origin.
const verifiers: Record<'Production' | 'Sandbox', SignedDataVerifier> = {
  Production: new SignedDataVerifier(roots, false, Environment.PRODUCTION, APP_STORE_BUNDLE_ID, APP_STORE_APP_ID),
  Sandbox: new SignedDataVerifier(roots, false, Environment.SANDBOX, APP_STORE_BUNDLE_ID),
};

/** Read the environment claim without trusting it; it only picks which verifier runs. */
function claimedEnvironment(jws: string): 'Production' | 'Sandbox' {
  try {
    const payload = JSON.parse(Buffer.from(jws.split('.')[1] || '', 'base64url').toString('utf8'));
    const env = payload?.environment ?? payload?.data?.environment;
    return env === 'Production' ? 'Production' : 'Sandbox';
  } catch {
    return 'Production';
  }
}

export type VerifiedAppStoreTransaction = JWSTransactionDecodedPayload & { environment: 'Production' | 'Sandbox' };

export async function verifyAppStoreTransaction(signedTransaction: string): Promise<VerifiedAppStoreTransaction> {
  const environment = claimedEnvironment(signedTransaction);
  const tx = await verifiers[environment].verifyAndDecodeTransaction(signedTransaction);
  return { ...tx, environment };
}

export async function verifyAppStoreNotification(signedPayload: string): Promise<ResponseBodyV2DecodedPayload> {
  return verifiers[claimedEnvironment(signedPayload)].verifyAndDecodeNotification(signedPayload);
}

/** True while a transaction still entitles: not revoked/refunded and not past its expiry. */
export function appStoreGrantsAccess(tx: JWSTransactionDecodedPayload, now = Date.now()): boolean {
  if (tx.revocationDate) return false;
  return typeof tx.expiresDate === 'number' && tx.expiresDate > now;
}

export async function verifyAppStoreRenewalInfo(signedRenewalInfo: string) {
  return verifiers[claimedEnvironment(signedRenewalInfo)].verifyAndDecodeRenewalInfo(signedRenewalInfo);
}
