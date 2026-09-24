import { createHash, timingSafeEqual } from 'crypto';

export const HOST_SECRET_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const HOST_SECRET_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export function normalizeHostSecret(value: unknown): string {
  const secret = String(value || '');
  return HOST_SECRET_PATTERN.test(secret) ? secret : '';
}

export function hashHostSecret(secret: string): string {
  if (!HOST_SECRET_PATTERN.test(secret)) {
    throw new Error('Invalid host credential format');
  }
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function hostSecretMatches(secret: unknown, expectedHash: unknown): boolean {
  const value = normalizeHostSecret(secret);
  const hash = String(expectedHash || '');
  if (!value || !HOST_SECRET_HASH_PATTERN.test(hash)) return false;
  const actual = Buffer.from(hashHostSecret(value), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
