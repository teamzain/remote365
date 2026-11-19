import { createPublicKey, KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Verifies the identity token the iOS app gets from Sign in with Apple
 * (ASAuthorizationAppleIDCredential.identityToken).
 *
 * The token is an RS256 JWT signed with one of Apple's rotating keys, published
 * at https://appleid.apple.com/auth/keys. Its audience is the app's bundle ID,
 * so a token minted for some other app is rejected. APPLE_BUNDLE_IDS can list
 * more than one bundle ID (comma separated) if a second iOS build ever exists.
 */

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const KEY_CACHE_MS = 6 * 60 * 60 * 1000;

export type AppleIdentityClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean | 'true' | 'false';
  is_private_email?: boolean | 'true' | 'false';
};

let keyCache: { keys: Map<string, KeyObject>; fetchedAt: number } | null = null;

async function fetchAppleKeys(): Promise<Map<string, KeyObject>> {
  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) throw new Error(`Apple keys request failed with HTTP ${response.status}`);
  const body = await response.json() as { keys?: Array<Record<string, any>> };
  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys || []) {
    if (jwk.kid) keys.set(jwk.kid, createPublicKey({ key: jwk as any, format: 'jwk' }));
  }
  keyCache = { keys, fetchedAt: Date.now() };
  return keys;
}

async function appleKey(kid: string): Promise<KeyObject> {
  const fresh = keyCache && Date.now() - keyCache.fetchedAt < KEY_CACHE_MS;
  const cached = fresh ? keyCache!.keys.get(kid) : undefined;
  if (cached) return cached;
  // Unknown kid: Apple may have rotated, so refetch once before giving up.
  const key = (await fetchAppleKeys()).get(kid);
  if (!key) throw new Error('Apple identity token is signed with an unknown key');
  return key;
}

export function appleAudiences(): string[] {
  return (process.env.APPLE_BUNDLE_IDS || 'ai.remote365.mobile')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentityClaims> {
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
    throw new Error('Malformed Apple identity token');
  }
  const key = await appleKey(decoded.header.kid);
  const audiences = appleAudiences();
  const claims = jwt.verify(identityToken, key, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: audiences.length === 1 ? audiences[0] : (audiences as [string, ...string[]]),
  }) as AppleIdentityClaims;
  if (!claims?.sub) throw new Error('Apple identity token has no subject');
  return claims;
}

export const isTrueClaim = (value: unknown) => value === true || value === 'true';
