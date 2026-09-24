import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from './index'; // assuming index exports these
import { normalizePlanId, PLAN_LIMITS } from './plans';
import { findMergedPlan, customPlanLimits } from './plan-catalog';

export enum Plan {
  TRIAL = 'TRIAL',
  SOLO = 'SOLO',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE'
}

export type LimitName = 'maxConcurrentSessions' | 'maxDevices' | 'sessionDurationMinutes' | 'fileTransfer' | 'sessionRecording' | 'teamMembers';

export async function getPlanLimits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, organizationId: true }
  });

  let sub = null as any;

  if (user?.organizationId) {
    const owner = await prisma.user.findFirst({
      where: { organizationId: user.organizationId, role: 'OWNER' },
      include: { subscription: true },
      orderBy: { createdAt: 'asc' }
    });
    sub = owner?.subscription || null;
  }

  if (!sub && user?.role === 'OWNER') {
    sub = await (prisma as any).subscription.findUnique({ where: { userId } });
  }

  // A super-admin-created custom plan (customPlanKey) wins over the enum:
  // its limits come from the PlanDef row, and it never counts as TRIAL.
  if (sub?.customPlanKey) {
    const customPlan = await findMergedPlan(sub.customPlanKey);
    if (customPlan) {
      return { plan: customPlan.id, limits: customPlanLimits(customPlan), sub, user };
    }
  }

  const currentPlan = normalizePlanId(sub?.plan);

  const limits = await (prisma as any).planLimit.findUnique({
    where: { plan: currentPlan as any }
  }) || PLAN_LIMITS[currentPlan];

  // A super-admin override of a BUILT-IN plan is a PlanDef row too (the merged
  // catalog flags it `customized`). Without this the override showed in the
  // catalog and in the org quotas but never gated anything: the enum plan's
  // stock limits were still what got enforced here.
  const override = await findMergedPlan(currentPlan).catch(() => null);
  if (override?.customized) {
    return {
      plan: currentPlan,
      limits: {
        ...limits,
        maxDevices: override.maxDevices ?? -1,
        maxConcurrentSessions: override.maxConcurrentSessions ?? -1,
        teamMembers: override.maxUsers ?? -1,
      },
      sub,
      user,
    };
  }

  return { plan: currentPlan, limits, sub, user };
}

export function checkPlanLimit(limitName: LimitName) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Billing-Middleware] Checking limit: ${limitName} for ${request.url}`);
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      const userId = decoded.userId;
      const { plan: currentPlan, limits, sub, user } = await getPlanLimits(userId);

      if (!limits) {
        return reply.code(500).send({ error: 'Plan limits not configured' });
      }

      // --- 1. Lifetime Trial Check for TRIAL users who haven't paid ---
      const isTrial = currentPlan === 'TRIAL';

      if (isTrial) {
        // Enforce the trial window from Subscription.currentPeriodEnd
        if (sub && sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
          return reply.code(403).send({
            error: 'Trial expired: Your free trial has ended. Please choose a paid plan to continue using Remote 365.',
            trialExpired: true,
            currentPeriodEnd: sub.currentPeriodEnd
          });
        }
      }

      const limitValue = (limits as any)[limitName];

      // --- 2. Dynamic checks based on limitName ---
      if (limitName === 'maxConcurrentSessions') {
        const supportSessionCount = user?.organizationId
          ? await (prisma as any).supportSession.count({
              where: { orgId: user.organizationId, status: { in: ['CREATED', 'QUEUED', 'ASSIGNED', 'RINGING', 'CONNECTED'] } }
            })
          : 0;
        const legacySessionCount = await (prisma as any).session.count({
          where: { viewerId: userId, status: 'ACTIVE' }
        });
        const activeSessions = supportSessionCount + legacySessionCount;
        if (activeSessions >= limitValue && limitValue !== -1) {
          return reply.code(403).send({
            error: `Plan limit reached: Max concurrent sessions for ${currentPlan} is ${limitValue}. Upgrade for more.`,
            limitReached: true,
            limitName
          });
        }
      }

      if (limitName === 'maxDevices') {
        const deviceCount = user?.organizationId
          ? await (prisma as any).device.count({ where: { organizationId: user.organizationId } })
          : await (prisma as any).device.count({ where: { ownerId: userId } });
        if (deviceCount >= limitValue && limitValue !== -1) {
          return reply.code(403).send({
            error: `Plan limit reached: Max devices for ${currentPlan} is ${limitValue}. Upgrade your plan to add more computers.`,
            limitReached: true,
            limitName
          });
        }
      }

      if (limitName === 'sessionRecording' || limitName === 'fileTransfer') {
        if (!limitValue) {
          return reply.code(403).send({
            error: `${limitName === 'sessionRecording' ? 'Session Recording' : 'File Transfer'} is not available on the ${currentPlan} plan. Please upgrade.`,
            limitReached: true,
            limitName
          });
        }
      }

      // If all checks pass, continue
    } catch (err) {
      console.error('[Billing Middleware Error]', err);
      // Fail open or closed? Usually closed for billing.
      return reply.code(500).send({ error: 'Failed to verify plan limits' });
    }
  };
}
