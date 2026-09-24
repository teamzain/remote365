import { randomUUID } from 'crypto';
import { generateToken, prisma } from '@remotelink/shared';

export const ACCESS_TOKEN_EXPIRY = '24h';
export const REFRESH_TOKEN_EXPIRY = '7d';
export const EXPIRY_SECONDS = 86400;

export async function issueTokens(user: any, options: { sessionId?: string } = {}) {
  let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

  if (!sub && user.role === 'OWNER') {
    const trialDays = 15;
    sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: 'TRIAL',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
      }
    });
  }

  if (!sub && user.organizationId) {
    const owner = await prisma.user.findFirst({
      where: { organizationId: user.organizationId, role: 'OWNER' },
      include: { subscription: true },
      orderBy: { createdAt: 'asc' }
    });
    sub = owner?.subscription || null;
  }

  // A super-admin-created custom plan (customPlanKey) wins over the enum.
  const plan = (sub as any)?.customPlanKey || sub?.plan || 'TRIAL';
  const sessionId = options.sessionId || randomUUID();

  const accessToken = generateToken({
    userId: user.id,
    role: user.role,
    orgId: user.organizationId,
    sid: sessionId
  }, ACCESS_TOKEN_EXPIRY);
  const refreshToken = generateToken({
    userId: user.id,
    role: user.role,
    orgId: user.organizationId,
    type: 'refresh',
    sid: sessionId
  } as any, REFRESH_TOKEN_EXPIRY);

  return {
    accessToken,
    refreshToken,
    sessionId,
    expiresIn: EXPIRY_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan,
      status: sub?.status || 'ACTIVE',
      currentPeriodEnd: sub?.currentPeriodEnd || null,
      role: user.role,
      organizationId: user.organizationId,
      avatar: user.avatar || null,
      language: user.language || 'en',
      darkMode: (user as any).darkMode ?? false,
      searchBehavior: (user as any).searchBehavior || 'Search for result',
      useNewInterface: (user as any).useNewInterface ?? true,
      marketingMessages: (user as any).marketingMessages ?? false,
      fontSize: (user as any).fontSize ?? 16,
      startWithWindows: (user as any).startWithWindows ?? false,
      useDeviceDock: (user as any).useDeviceDock ?? false,
      keepAgentRunning: (user as any).keepAgentRunning ?? true,
      updatesAutomatically: (user as any).updatesAutomatically ?? true,
      windowsNotification: (user as any).windowsNotification ?? true,
      incomingSessionNotification: (user as any).incomingSessionNotification ?? true,
      security_settings: (user as any).securitySettings || null
    }
  };
}
