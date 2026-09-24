import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, verifyToken, getMergedPlanCatalog, effectivePlanId } from '@remotelink/shared';

/**
 * Super Admin -> Billing & Revenue.
 * The platform's billing state is the Subscription table: one row per
 * subscribed owner, joined to their organization and priced from the merged
 * plan catalog (so super-admin price overrides and custom plans are
 * reflected). Each subscription becomes one billing record; revenue stats are
 * monthly-recurring sums over the active paid ones. Gated by
 * `billing:viewRevenue`.
 */

type BillingStatus = 'Paid' | 'Trial' | 'Past Due' | 'Cancelled';

// Monthly-recurring value of one subscription on `plan`: yearly prices are
// spread over 12 months, one-time prices don't recur, and plans without a
// numeric price (Enterprise "Custom") contribute nothing until a negotiated
// amount is stored on the subscription. Summing raw `price` counted a yearly
// plan at 12× and a one-time plan every month.
const monthlyAmount = (plan?: { price: number | 'Custom'; billingPeriod?: string }): number | null => {
  if (!plan || typeof plan.price !== 'number') return null;
  const period = String(plan.billingPeriod || 'Monthly');
  if (period === 'Yearly') return Math.round((plan.price / 12) * 100) / 100;
  if (period === 'One-time') return 0;
  return plan.price;
};

const statusOf = (sub: { status: string }, planId: string): BillingStatus => {
  if (sub.status === 'PAST_DUE') return 'Past Due';
  if (sub.status === 'CANCELLED') return 'Cancelled';
  if (planId === 'TRIAL' || sub.status === 'TRIALING') return 'Trial';
  return 'Paid';
};

export default async function adminBillingRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) return reply.code(401).send({ error: 'Invalid token' });
    if (!hasPermission(decoded.role, 'billing:viewRevenue')) {
      return reply.code(403).send({ error: 'Billing access required' });
    }

    const subs = await prisma.subscription.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            status: true,
            organization: {
              select: {
                id: true,
                name: true,
                status: true,
                users: { where: { status: { not: 'DELETED' } }, select: { id: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const catalog = await getMergedPlanCatalog();
    const planById = new Map(catalog.map((p) => [p.id.toUpperCase(), p]));

    const records = subs
      .filter((s) => s.user && s.user.status !== 'DELETED' && s.user.organization?.status !== 'DELETED')
      .map((s) => {
        const planId = String(effectivePlanId(s as any)).toUpperCase();
        const plan = planById.get(planId);
        const org = s.user.organization;
        return {
          id: s.id,
          organization: org?.name || s.user.name || s.user.email,
          owner: s.user.email,
          planId,
          planName: plan?.name ?? planId,
          priceLabel: plan?.priceLabel ?? 'Unknown',
          // Numeric list price; null when the plan has no fixed price (Enterprise).
          amount: typeof plan?.price === 'number' ? plan.price : null,
          billingPeriod: plan?.billingPeriod ?? 'Monthly',
          // What this row is worth per month (yearly ÷ 12, one-time → 0).
          monthlyAmount: monthlyAmount(plan),
          renewsOn: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
          startedOn: s.createdAt.toISOString(),
          paidSince: (s as any).paidSince ? new Date((s as any).paidSince).toISOString() : null,
          users: org ? org.users.length : 1,
          status: statusOf(s, planId),
        };
      });

    const paid = records.filter((r) => r.status === 'Paid');
    const mrr = (rows: typeof paid) => Math.round(rows.reduce((sum, r) => sum + (r.monthlyAmount ?? 0), 0) * 100) / 100;
    const stats = {
      monthlyRevenue: mrr(paid),
      // "New" = went paid this month (paidSince). The row itself is born at
      // sign-up as a trial, so keying on createdAt never counted an upgrade.
      newRevenueThisMonth: mrr(paid.filter((r) => r.paidSince && new Date(r.paidSince).getTime() >= monthStart.getTime())),
      paidSubscriptions: paid.length,
      activeTrials: records.filter((r) => r.status === 'Trial').length,
      pastDue: records.filter((r) => r.status === 'Past Due').length,
    };

    return reply.send({ stats, records });
  });
}
