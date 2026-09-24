import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, redisPublisher, verifyToken, closeStaleSessionsById, effectivePlanId, getMergedPlanCatalog } from '@remotelink/shared';

/**
 * Super Admin -> Home / Platform Overview.
 * One aggregation endpoint that feeds every stat card and chart on the
 * dashboard with real platform data. Gated by `audit:viewPlatform`.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PLAN_ORDER = ['TRIAL', 'SOLO', 'PRO', 'BUSINESS', 'ENTERPRISE'];
const PLAN_LABELS: Record<string, string> = { TRIAL: 'Trial', SOLO: 'Solo', PRO: 'Pro', BUSINESS: 'Business', ENTERPRISE: 'Enterprise' };

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

// Ordered list of the last `n` calendar months (oldest -> newest).
function lastNMonths(n: number) {
  const now = new Date();
  const out: { key: string; label: string; end: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).getTime();
    out.push({ key: monthKey(d), label: MONTH_NAMES[d.getUTCMonth()], end });
  }
  return out;
}

export default async function adminOverviewRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) return reply.code(401).send({ error: 'Invalid token' });
    if (!hasPermission(decoded.role, 'audit:viewPlatform')) {
      return reply.code(403).send({ error: 'Platform management access required' });
    }

    // Pull the raw rows we need to bucket by month in JS (dataset is small at
    // this scale, and Prisma can't date_trunc through groupBy portably).
    const [orgs, users, devices, sessions, logins, openTickets, activeSessionRows] = await Promise.all([
      prisma.organization.findMany({
        where: { status: { not: 'DELETED' } },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          // Owner = the member that carries the subscription (mirrors the orgs list).
          users: { where: { subscription: { isNot: null } }, take: 1, select: { subscription: { select: { plan: true, customPlanKey: true } } } },
        },
      }),
      prisma.user.findMany({
        where: { role: { not: 'SUPER_ADMIN' }, status: { not: 'DELETED' } },
        select: { createdAt: true, organizationId: true },
      }),
      prisma.device.findMany({ select: { createdAt: true } }),
      (prisma as any).remoteSession.findMany({ select: { createdAt: true } }),
      (prisma as any).loginEvent.findMany({ where: { result: 'SUCCESS' }, select: { createdAt: true } }),
      (prisma as any).supportTicket.count({ where: { status: 'Open' } }),
      // Candidate live sessions — verified against Redis below. A bare
      // status:'ACTIVE' count also swept up expired grants and rows orphaned
      // by unclean disconnects, which made the KPI read "8" on an idle fleet.
      (prisma as any).remoteSession.findMany({
        where: { type: 'REMOTE_CONTROL', status: 'ACTIVE', startedAt: { not: null }, endedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, sessionCode: true },
      }),
    ]);

    // The signaling service holds `session:active:<accessKey>` (viewer-heartbeat
    // TTL) while a session is genuinely live — same live-truth guard as the
    // admin device tables. Stale DB rows get closed in passing.
    let activeSessions = (activeSessionRows as any[]).length;
    if ((activeSessionRows as any[]).length) {
      try {
        const busy = await redisPublisher.mget(
          ...(activeSessionRows as any[]).map((r) => `session:active:${r.sessionCode}`),
        );
        const staleIds = (activeSessionRows as any[]).filter((_, i) => busy[i] == null).map((r) => r.id);
        activeSessions = (activeSessionRows as any[]).length - staleIds.length;
        // Closing waits for a second sighting (see closeStaleSessionsById) so
        // a Redis flush can't end every live session from one dashboard load.
        const liveIds = (activeSessionRows as any[]).filter((_, i) => busy[i] != null).map((r) => r.id);
        closeStaleSessionsById(staleIds, liveIds).catch(() => { /* best-effort cleanup */ });
      } catch { /* redis down — fall back to the DB count */ }
    }

    const now = new Date();
    const thisMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const newSince = (rows: { createdAt: Date }[]) => rows.filter((r) => new Date(r.createdAt).getTime() >= thisMonthStart).length;

    // ---- Plan distribution + paid/trial split (by org's subscribed member) ----
    // Same resolver as the org list/detail (custom plan key wins over the
    // enum), so a custom-plan org is neither mislabelled nor counted as a trial.
    const planCounts = new Map<string, number>();
    for (const o of orgs as any[]) {
      const plan = String(effectivePlanId(o.users?.[0]?.subscription)).toUpperCase();
      planCounts.set(plan, (planCounts.get(plan) || 0) + 1);
    }
    const trialOrganizations = planCounts.get('TRIAL') || 0;
    const paidOrganizations = (orgs as any[]).length - trialOrganizations;
    // Built-ins in tier order, then admin-created plans by name, all labelled
    // from the merged catalog so renamed built-ins and custom plans read right.
    const catalog = await getMergedPlanCatalog().catch(() => []);
    const nameOf = (id: string) => catalog.find((p) => p.id.toUpperCase() === id)?.name || PLAN_LABELS[id] || id;
    const customIds = Array.from(planCounts.keys())
      .filter((id) => !PLAN_ORDER.includes(id))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const planDistribution = [...PLAN_ORDER, ...customIds]
      .filter((p) => (planCounts.get(p) || 0) > 0)
      .map((p) => ({ label: nameOf(p), value: planCounts.get(p) || 0 }));

    // ---- 12-month growth series (organizations cumulative + new, users new) ----
    const months12 = lastNMonths(12);
    const orgTimes = (orgs as any[]).map((o) => new Date(o.createdAt).getTime()).sort((a, b) => a - b);
    const userTimesByMonth = new Map<string, number>();
    for (const u of users as any[]) {
      const k = monthKey(new Date(u.createdAt));
      userTimesByMonth.set(k, (userTimesByMonth.get(k) || 0) + 1);
    }
    const orgNewByMonth = new Map<string, number>();
    for (const o of orgs as any[]) {
      const k = monthKey(new Date(o.createdAt));
      orgNewByMonth.set(k, (orgNewByMonth.get(k) || 0) + 1);
    }
    const orgGrowth = months12.map((m) => ({
      month: m.label,
      total: orgTimes.filter((t) => t < m.end).length, // cumulative through month end
      new: orgNewByMonth.get(m.key) || 0,
    }));
    const userGrowth = months12.map((m) => ({ month: m.label, value: userTimesByMonth.get(m.key) || 0 }));

    // ---- 12-month successful-login activity ----
    const loginByMonth = new Map<string, number>();
    for (const l of logins as any[]) {
      const k = monthKey(new Date(l.createdAt));
      loginByMonth.set(k, (loginByMonth.get(k) || 0) + 1);
    }
    const loginTrend = months12.map((m) => ({ month: m.label, value: loginByMonth.get(m.key) || 0 }));

    // ---- Top organizations by member count ----
    const memberByOrg = new Map<string, number>();
    for (const u of users as any[]) {
      if (u.organizationId) memberByOrg.set(u.organizationId, (memberByOrg.get(u.organizationId) || 0) + 1);
    }
    const ranked = (orgs as any[])
      .map((o) => ({ name: o.name as string, members: memberByOrg.get(o.id) || 0 }))
      .sort((a, b) => b.members - a.members)
      .slice(0, 5);
    const maxMembers = Math.max(1, ...ranked.map((r) => r.members));
    const topOrganizations = ranked.map((r) => ({ ...r, pct: Math.round((r.members / maxMembers) * 100) }));

    // ---- 6-month trends (remote sessions + new devices) ----
    const months6 = lastNMonths(6);
    const sessionByMonth = new Map<string, number>();
    for (const s of sessions as any[]) {
      const k = monthKey(new Date(s.createdAt));
      sessionByMonth.set(k, (sessionByMonth.get(k) || 0) + 1);
    }
    const deviceByMonth = new Map<string, number>();
    for (const d of devices as any[]) {
      const k = monthKey(new Date(d.createdAt));
      deviceByMonth.set(k, (deviceByMonth.get(k) || 0) + 1);
    }
    const sessionsTrend = months6.map((m) => ({ month: m.label, value: sessionByMonth.get(m.key) || 0 }));
    const deviceTrend = months6.map((m) => ({ month: m.label, value: deviceByMonth.get(m.key) || 0 }));

    return reply.send({
      stats: {
        totalOrganizations: (orgs as any[]).length,
        activeOrganizations: (orgs as any[]).filter((o) => o.status === 'ACTIVE').length,
        paidOrganizations,
        trialOrganizations,
        totalUsers: (users as any[]).length,
        totalDevices: (devices as any[]).length,
        activeSessions,
        openTickets,
      },
      deltas: {
        totalOrganizations: newSince(orgs as any[]),
        totalUsers: newSince(users as any[]),
        totalDevices: newSince(devices as any[]),
      },
      orgGrowth,
      userGrowth,
      loginTrend,
      topOrganizations,
      planDistribution,
      sessionsTrend,
      deviceTrend,
    });
  });
}
