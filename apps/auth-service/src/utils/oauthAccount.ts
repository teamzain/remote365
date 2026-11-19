import { prisma, getTrialDays, trialDurationMs } from '@remotelink/shared';
import { sendWelcomeEmail } from './welcomeEmail';

/**
 * Finds the account for a social sign-in (Google, Microsoft, Apple), or creates
 * it: a first sign-in gets its own workspace with the user as owner, a trial
 * subscription and the welcome email. An existing user without a workspace is
 * given one; an existing user without a name gets the provider's name.
 *
 * Accounts are matched by email, the same way for every provider, so signing in
 * with Apple using the same address as an earlier Google sign-in reaches the
 * same account.
 */
export async function findOrCreateOauthUser(profile: { email: string; name?: string | null }, isBusiness: boolean) {
  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!user) {
    const created = await prisma.$transaction(async (tx: any) => {
      const orgSlug = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
      const org = await tx.organization.create({
        data: {
          name: profile.name ? `${profile.name}'s Workspace` : `${profile.email.split('@')[0]}'s Workspace`,
          slug: orgSlug,
          ...(isBusiness ? { accountType: 'BUSINESS', companyEmail: profile.email } : {}),
        },
      });

      return await tx.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          role: 'OWNER',
          organizationId: org.id,
          allowedDeviceIds: ['__all__'],
        },
      });
    });

    user = created;

    // Initial subscription (trial length from the merged catalog)
    try {
      await prisma.subscription.create({
        data: {
          userId: user!.id,
          plan: 'TRIAL',
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + trialDurationMs(await getTrialDays())),
        },
      });
    } catch { }
    sendWelcomeEmail(user!).catch(() => {});
    return user!;
  }

  if (!user.organizationId) {
    return await prisma.$transaction(async (tx: any) => {
      const orgSlug = user!.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
      const org = await tx.organization.create({
        data: {
          name: user!.name ? `${user!.name}'s Workspace` : `${user!.email.split('@')[0]}'s Workspace`,
          slug: orgSlug,
        },
      });

      return await tx.user.update({
        where: { id: user!.id },
        data: {
          role: 'OWNER',
          organizationId: org.id,
          allowedDeviceIds: ['__all__'],
        },
      });
    });
  }

  if (!user.name && profile.name) {
    return await prisma.user.update({
      where: { id: user.id },
      data: { name: profile.name },
    });
  }

  return user;
}
