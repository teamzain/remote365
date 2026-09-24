import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  PLAN_BY_PLAY_PRODUCT,
  acknowledgeSubscription,
  decodeDeveloperNotification,
  getSubscriptionPurchase,
  grantsAccess,
  isPlayBillingConfigured,
  verifyPushAuthenticity,
  type PubSubEnvelope,
} from '../utils/googlePlayBilling';
import {
  hasPermission, prisma, verifyToken, PLAN_CATALOG,
  getActivePlanCatalog, findMergedPlan, effectivePlanId, BUILTIN_PLAN_IDS, MergedPlan,
  publishBillingSync, userHasPermission, getTrialDays, trialDurationMs,
} from '@remotelink/shared';

// QA convenience ONLY, and off unless explicitly set. When on, /my-plan may move a
// subscription onto a paid plan without payment — never enable it in production.
// Mirrors the flag of the same name in apps/billing-service/src/index.ts.
const BILLING_TEST_MODE = process.env.BILLING_TEST_MODE === 'true';

// Move a subscription to any active plan from the merged catalog: built-in
// ids set the enum (clearing any custom key), admin-created plans are stored
// in customPlanKey which wins over the enum everywhere.
async function applyPlanChange(userId: string, target: MergedPlan) {
  const isBuiltin = BUILTIN_PLAN_IDS.has(target.id.toUpperCase());
  // A manual move onto any non-trial plan is an open-ended (lifetime) grant:
  // drop the trial deadline the row still carries and clear any pending
  // cancellation. Play-managed rows get their real expiry written right after.
  // Moving (back) onto TRIAL with no deadline would be a never-ending free
  // trial instead, so a missing period end gets a fresh trial window.
  // paidSince = the first time the row went paid (feeds "new revenue this
  // month"): kept across paid→paid moves, cleared on a drop back to TRIAL.
  const existing = await (prisma as any).subscription.findUnique({
    where: { userId },
    select: { currentPeriodEnd: true, paidSince: true },
  });
  let periodFields: Record<string, any> = {
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    paidSince: existing?.paidSince ?? new Date(),
  };
  if (target.id.toUpperCase() === 'TRIAL') {
    periodFields = {
      paidSince: null,
      ...(existing?.currentPeriodEnd
        ? {}
        : { currentPeriodEnd: new Date(Date.now() + trialDurationMs(await getTrialDays())) }),
    };
  }
  const update = isBuiltin
    ? { plan: target.id as any, customPlanKey: null, status: 'ACTIVE' as any, ...periodFields }
    : { customPlanKey: target.id, status: 'ACTIVE' as any, ...periodFields };
  const create = isBuiltin
    ? { userId, plan: target.id as any, status: 'ACTIVE' as any, ...periodFields }
    : { userId, plan: 'TRIAL' as any, customPlanKey: target.id, status: 'ACTIVE' as any, ...periodFields };
  return (prisma as any).subscription.upsert({ where: { userId }, update, create });
}

/**
 * Bring one Play subscription back in line with what Google says about it.
 *
 * Every notification type is handled by re-reading the purchase rather than switching on
 * `notificationType`. Pub/Sub delivers at-least-once and out of order, so acting on the
 * event's own claim ("renewed", "cancelled") can apply a stale one on top of a newer
 * state. Re-reading is idempotent and always converges on the truth.
 *
 * Returns false when the token belongs to no subscription we know of — which is normal
 * for a purchase made against a different environment, and must not be an error.
 */
async function reconcilePlayPurchase(purchaseToken: string): Promise<boolean> {
  const sub = await (prisma as any).subscription.findUnique({
    where: { googlePlayPurchaseToken: purchaseToken },
    select: { userId: true },
  });
  if (!sub) return false;

  const purchase = await getSubscriptionPurchase(purchaseToken).catch(() => null);

  // Unknown to Google (refunded, revoked, voided) or no longer entitling: drop to the free
  // tier. `plan` is set explicitly rather than relying on the expiry fallback so the state
  // is visible in the database, not only computed at read time.
  if (!purchase || !grantsAccess(purchase.state)) {
    await (prisma as any).subscription.update({
      where: { userId: sub.userId },
      data: {
        plan: 'TRIAL',
        customPlanKey: null,
        status: 'CANCELLED',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: purchase?.expiryTime ?? new Date(),
        paidSince: null,
      },
    });
    await publishBillingSync(sub.userId);
    return true;
  }

  const planId = purchase.productId ? PLAN_BY_PLAY_PRODUCT[purchase.productId] : undefined;
  const targetPlan = planId ? await findMergedPlan(planId) : null;
  if (targetPlan) await applyPlanChange(sub.userId, targetPlan);

  await (prisma as any).subscription.update({
    where: { userId: sub.userId },
    data: {
      platform: 'GOOGLE_PLAY',
      googlePlayProductId: purchase.productId,
      currentPeriodEnd: purchase.expiryTime,
      // Cancelled-but-not-expired still entitles until the period ends; record the intent
      // so the UI can say "ends on" rather than "renews on".
      cancelAtPeriodEnd: purchase.state === 'SUBSCRIPTION_STATE_CANCELED',
      status: 'ACTIVE',
    },
  });
  await publishBillingSync(sub.userId);
  return true;
}

export default async function billingRoutes(fastify: FastifyInstance) {
  // GET /api/billing/plans — public plan catalog (built-ins merged with the
  // super admin's overrides and custom plans; disabled plans are hidden).
  fastify.get('/plans', async (_request, reply) => {
    return reply.send(await getActivePlanCatalog());
  });

  // GET /api/billing/subscription — current user's subscription
  fastify.get('/subscription', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });
    // Effective check: the owner can revoke billing:view per member.
    const billingActor = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, permissionOverrides: true },
    });
    if (!userHasPermission(billingActor, 'billing:view')) {
      return reply.code(403).send({ error: 'Billing access required' });
    }

    let sub = await prisma.subscription.findUnique({ where: { userId: decoded.userId } });

    if (!sub) {
      if (decoded.role !== 'OWNER') {
        // Members share the org owner's plan (read-only) instead of a trial.
        const orgId = decoded.orgId;
        if (orgId) {
          const orgOwner = await prisma.user.findFirst({
            where: { organizationId: orgId, role: 'OWNER' },
            include: { subscription: true },
            orderBy: { createdAt: 'asc' }
          });
          if ((orgOwner as any)?.subscription) sub = (orgOwner as any).subscription;
        }
        if (!sub) return reply.code(404).send({ error: 'No organization subscription found' });
      } else {
        sub = await prisma.subscription.create({
          data: {
            userId: decoded.userId,
            plan: 'TRIAL',
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
          }
        });
      }
    }

    const planId = effectivePlanId(sub as any);
    const catalog = (await findMergedPlan(planId)) || PLAN_CATALOG.find((p: any) => p.id === sub!.plan) || PLAN_CATALOG[0];

    return reply.send({
      plan: planId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      catalog,
      testMode: true,
    });
  });

  // PATCH /api/billing/set-plan - platform owner assigns a plan to any user (test mode, no Stripe)
  fastify.patch('/set-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
    if (!hasPermission(decoded.role, 'plan:manage')) {
      return reply.code(403).send({ error: 'Plan management access required' });
    }

    const { userId, plan } = request.body as { userId: string; plan: string };
    const targetPlan = plan ? await findMergedPlan(plan) : null;
    if (!userId || !targetPlan || targetPlan.status !== 'Active') {
      return reply.code(400).send({ error: 'userId and a valid active plan are required' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return reply.code(404).send({ error: 'User not found' });

    const sub = await applyPlanChange(userId, targetPlan);
    await publishBillingSync(userId);

    return reply.send({ success: true, plan: effectivePlanId(sub), userId });
  });

  // PATCH /api/billing/my-plan — signed-in owner self-serves a plan change.
  //
  // Free plans only. This endpoint takes no payment, so without the price gate below any
  // org owner could grant themselves Business with a single authenticated call — which is
  // exactly what it did until now. The gate mirrors the one already guarding the twin
  // route in billing-service; the two implementations are otherwise duplicates.
  //
  // Paid plans go through a verified path instead: Google Play on Android
  // (/api/billing/google-play/verify) or the checkout flow on web.
  fastify.patch('/my-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });
    if (!hasPermission(decoded.role, 'billing:manage')) {
      return reply.code(403).send({ error: 'Billing management access required' });
    }
    if (decoded.role !== 'OWNER') {
      return reply.code(403).send({ error: 'Only organization owners can manage subscriptions' });
    }

    const { plan } = request.body as { plan: string };
    const targetPlan = plan ? await findMergedPlan(plan) : null;
    if (!targetPlan || targetPlan.status !== 'Active') {
      return reply.code(400).send({ error: 'Invalid plan' });
    }
    // `price` is 'Custom' for Enterprise, so anything that is not literally free is
    // blocked here rather than only the numerically-priced plans.
    if (!BILLING_TEST_MODE && targetPlan.price !== 0) {
      return reply.code(402).send({ error: 'This plan requires payment — use the checkout flow to subscribe.' });
    }

    // Downgrading off a Play subscription here would strand the Play purchase: the user
    // would keep being charged by Google while holding a free plan. Cancelling has to
    // happen in Play, which then reaches us through the RTDN endpoint.
    const currentSub = await (prisma as any).subscription.findUnique({
      where: { userId: decoded.userId },
      select: { platform: true },
    });
    if (currentSub?.platform === 'GOOGLE_PLAY') {
      return reply.code(409).send({
        error: 'This subscription is managed by Google Play. Change or cancel it in the Play Store.',
      });
    }

    const sub = await applyPlanChange(decoded.userId, targetPlan);
    await publishBillingSync(decoded.userId);

    return reply.send({ success: true, plan: effectivePlanId(sub) });
  });

  // POST /api/billing/google-play/verify — turn a Play purchase token into entitlement.
  //
  // The client sends only a token. Everything that decides what the user gets — which
  // product was bought, whether it is live, when it expires — comes from Google, because
  // a client can claim anything. The client's productId is accepted only as a hint for
  // the error message when the two disagree.
  fastify.post('/google-play/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });
    if (decoded.role !== 'OWNER') {
      return reply.code(403).send({ error: 'Only organization owners can manage subscriptions' });
    }

    if (!isPlayBillingConfigured()) {
      // 503, not 500: the purchase is fine, this server just cannot check it yet. The app
      // leaves the transaction unfinished, so Google refunds rather than charging.
      return reply.code(503).send({ error: 'Google Play billing is not configured on this server.' });
    }

    const { purchaseToken } = (request.body || {}) as { purchaseToken?: string; productId?: string };
    if (!purchaseToken || typeof purchaseToken !== 'string') {
      return reply.code(400).send({ error: 'purchaseToken is required' });
    }

    let purchase;
    try {
      purchase = await getSubscriptionPurchase(purchaseToken);
    } catch (err: any) {
      request.log.error({ err }, '[play-billing] verification call failed');
      return reply.code(503).send({ error: 'Could not reach Google Play. Please try again.' });
    }

    // Google does not know this token: forged, or from a different app.
    if (!purchase) return reply.code(404).send({ error: 'That purchase could not be found.' });

    if (!grantsAccess(purchase.state)) {
      return reply.code(409).send({ error: 'That subscription is not active.' });
    }

    const planId = purchase.productId ? PLAN_BY_PLAY_PRODUCT[purchase.productId] : undefined;
    if (!planId) {
      request.log.error({ productId: purchase.productId }, '[play-billing] unmapped product');
      return reply.code(400).send({ error: 'That product is not sold by this application.' });
    }

    // Replay guard. A token already bound to someone else must never move: without this,
    // one purchase could be forwarded between accounts to entitle all of them.
    const existing = await (prisma as any).subscription.findUnique({
      where: { googlePlayPurchaseToken: purchaseToken },
      select: { userId: true },
    });
    if (existing && existing.userId !== decoded.userId) {
      return reply.code(409).send({ error: 'That purchase is already linked to another account.' });
    }

    const targetPlan = await findMergedPlan(planId);
    if (!targetPlan) {
      request.log.error({ planId }, '[play-billing] plan missing from catalog');
      return reply.code(500).send({ error: 'That plan is not available.' });
    }

    const sub = await applyPlanChange(decoded.userId, targetPlan);
    await (prisma as any).subscription.update({
      where: { userId: decoded.userId },
      data: {
        platform: 'GOOGLE_PLAY',
        googlePlayPurchaseToken: purchaseToken,
        googlePlayProductId: purchase.productId,
        currentPeriodEnd: purchase.expiryTime,
        cancelAtPeriodEnd: purchase.state === 'SUBSCRIPTION_STATE_CANCELED',
      },
    });

    // Acknowledge only now that entitlement is durably written. Acknowledging first and
    // then failing to save would charge the user for nothing; this order refunds instead.
    if (purchase.needsAcknowledgement) {
      try {
        await acknowledgeSubscription(purchase.productId!, purchaseToken);
      } catch (err: any) {
        // The user keeps access; Google retries acknowledgement state on the next fetch.
        request.log.error({ err }, '[play-billing] acknowledge failed');
      }
    }

    await publishBillingSync(decoded.userId);
    return reply.send({ success: true, plan: effectivePlanId(sub) });
  });

  // POST /api/billing/google-play/rtdn — Google Pub/Sub push for subscription lifecycle.
  //
  // This is what stops us billing forever: renewals, cancellations, refunds, holds and
  // expiries all arrive here. Without it a cancelled subscription keeps its plan until
  // the expiry fallback in effectivePlanId catches it, and a refund never does.
  //
  // Always answers 200 once the push is authentic, even when the payload is useless.
  // A non-2xx makes Pub/Sub redeliver with backoff, so returning an error for a
  // permanently-bad message means retrying it for days.
  fastify.post('/google-play/rtdn', async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = (request.query as any)?.secret as string | undefined;
    const authentic = await verifyPushAuthenticity(request.headers.authorization, secret);
    if (!authentic) {
      // 403 and NOT 200: an unauthenticated caller must not learn that the endpoint
      // silently accepts, and Pub/Sub will not be the one hitting this branch.
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const notification = decodeDeveloperNotification((request.body || {}) as PubSubEnvelope);
    if (!notification) return reply.code(200).send({ ok: true, ignored: 'unparseable' });

    // Google sends this when the Pub/Sub topic is first wired up.
    if (notification.testNotification) {
      request.log.info('[play-billing] received RTDN test notification');
      return reply.code(200).send({ ok: true, test: true });
    }

    const token =
      notification.subscriptionNotification?.purchaseToken ||
      notification.voidedPurchaseNotification?.purchaseToken;
    if (!token) return reply.code(200).send({ ok: true, ignored: 'no purchase token' });

    try {
      const matched = await reconcilePlayPurchase(token);
      return reply.code(200).send({ ok: true, matched });
    } catch (err: any) {
      // A genuine transient failure (Google unreachable, database down) SHOULD be retried,
      // so this is the one path that deliberately returns non-2xx.
      request.log.error({ err }, '[play-billing] RTDN reconcile failed');
      return reply.code(500).send({ error: 'Reconcile failed' });
    }
  });
}
