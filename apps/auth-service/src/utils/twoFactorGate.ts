import { prisma, generateToken } from '@remotelink/shared';

/**
 * The second step a sign-in has to clear before it gets tokens, applied on
 * every fresh sign-in (password, Google ID token, OAuth) and never on refresh:
 *
 *   verify — the account has 2FA: enter the authenticator code (5 minutes).
 *   setup  — the organization requires 2FA and the account has none yet:
 *            scan the QR code and confirm it, which also signs the user in
 *            (10 minutes, scanning takes longer than typing a code).
 *
 * The temp token's `type` tells the finishing routes apart so a setup token
 * can't be used to skip a verify step or the other way round.
 */
export type TwoFactorGate = { kind: 'verify' | 'setup'; tempToken: string };

export const TWO_FACTOR_SETUP_MESSAGE = 'Your organization requires two-factor authentication. Set it up to finish signing in.';
export const TWO_FACTOR_SETUP_MOBILE_MESSAGE = 'Your organization requires two-factor authentication. Set it up by signing in on the Remote365 desktop or web app, then sign in here again.';

export async function twoFactorGate(user: { id: string; organizationId?: string | null; is2FAEnabled?: boolean | null } | null | undefined): Promise<TwoFactorGate | null> {
  if (!user) return null;
  if (user.is2FAEnabled) {
    return { kind: 'verify', tempToken: generateToken({ userId: user.id, type: '2fa-temp' }, '5m') };
  }
  if (!user.organizationId) return null;
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { require2FA: true } });
  if (!org?.require2FA) return null;
  return { kind: 'setup', tempToken: generateToken({ userId: user.id, type: '2fa-setup' }, '10m') };
}
