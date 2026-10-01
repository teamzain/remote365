import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports to ensure Prisma finds DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Fastify from 'fastify';
import Stripe from 'stripe';
import cron from 'node-cron';
import {
  prisma, verifyToken, hasPermission,
  getActivePlanCatalog, findMergedPlan, effectivePlanId, BUILTIN_PLAN_IDS, MergedPlan,
  getTrialDays, trialDurationMs,
  publishBillingSync,
} from '@remotelink/shared';
import rawBody from 'fastify-raw-body';
import cors from '@fastify/cors';
import { planForPrice, subscriptionEffect } from './stripeMapping';

const cleanStripeKey = (key?: string) => {
  if (!key) return '';
  return key.replace(/["']/g, '').trim();
};

const stripeSecretKey = cleanStripeKey(process.env.STRIPE_SECRET_KEY) || 'sk_test_dummy';
const endpointSecret = cleanStripeKey(process.env.STRIPE_WEBHOOK_SECRET) || 'whsec_dummy';

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

const server = Fastify({ logger: true });

// Direct plan switches without payment (PATCH /billing/my-plan for paid plans,
// and the local no-Stripe fallback in /billing/subscribe) are test-only.
// Enable on preprod for QA; leave off in production so every paid plan change
// must go through the payment provider.
const BILLING_TEST_MODE = process.env.BILLING_TEST_MODE === 'true';

// Trial length comes from the (possibly super-admin-overridden) TRIAL plan.
const trialEndDate = async () => new Date(Date.now() + trialDurationMs(await getTrialDays()));

// A trial locks the workspace once its currentPeriodEnd passes.
const isTrialExpired = (sub: any) =>
  effectivePlanId(sub) === 'TRIAL' &&
  !!sub?.currentPeriodEnd &&
  new Date(sub.currentPeriodEnd).getTime() <= Date.now();

// The subscription that governs a user's workspace: their own row, or their
// organization owner's when a member signs in under an org (members don't
// carry a subscription row of their own).
const resolveWorkspaceSubscription = async (userId: string) => {
  const own = await (prisma as any).subscription.findUnique({ where: { userId } });
  if (own) return own;
  const user = await (prisma as any).user.findUnique({ where: { id: userId } });
  if (!user?.organizationId) return null;
  const owner = await (prisma as any).user.findFirst({
    where: { organizationId: user.organizationId, role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
  });
  return owner ? (prisma as any).subscription.findUnique({ where: { userId: owner.id } }) : null;
};

const requireAuth = (request: any, reply: any) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    reply.code(401).send({ error: 'Invalid token' });
    return null;
  }
  return decoded;
};

const requirePermission = (request: any, reply: any, permission: Parameters<typeof hasPermission>[1]) => {
  const decoded = requireAuth(request, reply);
  if (!decoded) return null;
  if (!hasPermission(decoded.role, permission)) {
    reply.code(403).send({ error: permission === 'billing:view' ? 'Billing access required' : 'Billing management access required' });
    return null;
  }
  return decoded;
};

server.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

server.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
});

server.get('/health', async () => {
  return { status: 'ok', service: 'billing-service' };
});

// Move a subscription to any active plan from the merged catalog: built-in
// ids set the enum (clearing any custom key), super-admin-created plans are
// stored in customPlanKey which wins over the enum everywhere.
const applyPlanChange = async (userId: string, target: MergedPlan, extra: Record<string, any> = {}) => {
  const isBuiltin = BUILTIN_PLAN_IDS.has(target.id.toUpperCase());
  const isTrial = target.id.toUpperCase() === 'TRIAL';
  // A manual move onto any non-trial plan is an open-ended (lifetime) grant:
  // drop the trial deadline the row still carries so nothing keeps counting
  // down against it, and clear any pending cancellation. `extra` still wins,
  // so callers that mean to keep a date can pass one.
  const openEnded = isTrial ? {} : { currentPeriodEnd: null, cancelAtPeriodEnd: false };
  // paidSince = the first time the row went paid. Kept across paid→paid
  // moves, cleared on a drop back to TRIAL; it feeds "new revenue this month".
  const existing = await (prisma as any).subscription.findUnique({ where: { userId }, select: { paidSince: true } });
  const paidStamp = isTrial ? { paidSince: null } : { paidSince: existing?.paidSince ?? new Date() };
  const update = isBuiltin
    ? { plan: target.id as any, customPlanKey: null, status: 'ACTIVE' as any, ...openEnded, ...paidStamp, ...extra }
    : { customPlanKey: target.id, status: 'ACTIVE' as any, ...openEnded, ...paidStamp, ...extra };
  const create = isBuiltin
    ? { userId, plan: target.id as any, status: 'ACTIVE' as any, ...paidStamp, ...extra }
    : { userId, plan: 'TRIAL' as any, customPlanKey: target.id, status: 'ACTIVE' as any, ...paidStamp, ...extra };
  return (prisma as any).subscription.upsert({ where: { userId }, update, create });
};

// Record a PAID Stripe subscription on the user's row. The single place a
// Stripe payment turns into a plan: checkout, the post-3DS confirm call and
// the webhook all come through here, and each of them only calls it once
// Stripe reports the subscription as paid.
const grantPaidPlan = async (
  userId: string,
  plan: string,
  subscription: Stripe.Subscription,
  opts: { boughtByUser?: boolean } = {},
) => {
  const effect = subscriptionEffect(subscription.status);
  const existing = await (prisma as any).subscription.findUnique({ where: { userId }, select: { paidSince: true } });
  await (prisma as any).subscription.update({
    where: { userId },
    data: {
      plan: plan as any,
      status: effect.kind === 'paid' ? effect.status : 'ACTIVE',
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      paidSince: existing?.paidSince ?? new Date(),
      // A plan the customer just bought replaces a custom plan they were on
      // (customPlanKey wins over the enum everywhere). The webhook leaves it
      // alone, so a later super-admin grant survives routine Stripe updates.
      ...(opts.boughtByUser ? { customPlanKey: null } : {}),
    }
  });
  await publishBillingSync(userId);
};

// 1. GET /billing/plans — merged catalog: built-ins with the super admin's
// overrides applied, plus admin-created custom plans (disabled plans hidden).
server.get('/billing/plans', async (request, reply) => {
  return {
    plans: await getActivePlanCatalog(),
    publishableKey: cleanStripeKey(process.env.STRIPE_PUBLISHABLE_KEY)
  };
});

// 2. POST /billing/create-customer — Internal call after registration.
// Caddy routes /api/billing* here, so this was reachable from the internet
// with no credentials at all: anyone holding an owner's user id could give
// them a fresh trial and re-point their row at a new, empty Stripe customer.
// It now takes a service token only auth-service can mint (signed with the
// same key as user tokens, carrying a `svc` claim no user token has), and it
// never rewrites a row that is already set up.
server.post('/billing/create-customer', async (request, reply) => {
  const serviceToken = String(request.headers.authorization || '').split(' ')[1];
  const caller = serviceToken ? verifyToken(serviceToken) : null;
  if (caller?.svc !== 'auth-service') return reply.code(401).send({ error: 'Unauthorized' });

  const { userId } = request.body as any;
  if (!userId) return reply.code(400).send({ error: 'userId required' });

  try {
    const user = await (prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'OWNER') {
      return { success: true, skipped: true, reason: 'Only organization owners receive subscriptions' };
    }

    const existing = await (prisma as any).subscription.findUnique({ where: { userId } });
    if (existing?.stripeCustomerId && !String(existing.stripeCustomerId).startsWith('local_')) {
      return { success: true, stripeCustomerId: existing.stripeCustomerId };
    }

    const customer = await stripe.customers.create({ email: user.email });

    await (prisma as any).subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customer.id,
        plan: 'TRIAL',
        status: 'ACTIVE',
        currentPeriodEnd: await trialEndDate()
      },
      // The trial deadline belongs to the row auth-service created at sign-up.
      update: { stripeCustomerId: customer.id }
    });

    return { success: true, stripeCustomerId: customer.id };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to create customer: ' + err.message });
  }
});

// 3. POST /billing/subscribe — Accept plan name and PM ID
server.post('/billing/subscribe', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'billing:manage');
  if (!decoded) return;

  const { plan, paymentMethodId } = request.body as any;
  if (!plan) return reply.code(400).send({ error: 'Plan name is required' });

  try {
    let sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!sub || !sub.stripeCustomerId) {
      if (decoded.role !== 'OWNER') {
        return reply.code(403).send({ error: 'Only organization owners can manage subscriptions' });
      }
      const user = await (prisma as any).user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.code(404).send({ error: 'User not found' });

      try {
        const customer = await stripe.customers.create({ email: user.email });
        sub = await (prisma as any).subscription.upsert({
          where: { userId: decoded.userId },
          create: {
            userId: decoded.userId,
            stripeCustomerId: customer.id,
            plan: 'TRIAL',
            status: 'ACTIVE',
            currentPeriodEnd: await trialEndDate()
          },
          update: {
            stripeCustomerId: customer.id
          }
        });
      } catch (stripeErr: any) {
        server.log.warn(`[Billing] Stripe unavailable during subscribe: ${stripeErr.message}`);
        if (!BILLING_TEST_MODE) {
          return reply.code(502).send({ error: 'The payment provider is unreachable right now — please try again shortly.' });
        }
        sub = await (prisma as any).subscription.upsert({
          where: { userId: decoded.userId },
          create: {
            userId: decoded.userId,
            stripeCustomerId: `local_${decoded.userId}`,
            plan: 'TRIAL',
            status: 'ACTIVE',
            currentPeriodEnd: await trialEndDate()
          },
          update: { stripeCustomerId: `local_${decoded.userId}` }
        });
      }
    }

    if (plan === 'TRIAL') {
      // Keep the existing period end so an expired workspace can't reset its
      // own trial; only brand-new rows (no end date yet) get a fresh window.
      await (prisma as any).subscription.update({
        where: { userId: decoded.userId },
        data: {
          plan: 'TRIAL', status: 'ACTIVE', stripeSubscriptionId: null,
          ...(sub?.currentPeriodEnd ? {} : { currentPeriodEnd: await trialEndDate() })
        }
      });
      await publishBillingSync(decoded.userId);
      return { success: true };
    }

    const priceId = process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}`];
    if (!priceId) return reply.code(400).send({ error: 'Invalid plan for subscription' });

    let isLocalCustomer = !sub.stripeCustomerId || sub.stripeCustomerId.startsWith('local_');

    // Attempt to upgrade local customer to a real Stripe customer since they provided a payment method
    if (isLocalCustomer && paymentMethodId) {
      const user = await (prisma as any).user.findUnique({ where: { id: decoded.userId } });
      if (user) {
        try {
          const customer = await stripe.customers.create({ email: user.email });
          sub = await (prisma as any).subscription.update({
            where: { userId: decoded.userId },
            data: { stripeCustomerId: customer.id }
          });
          isLocalCustomer = false; // Successfully upgraded to Stripe
        } catch (upgradeErr: any) {
          server.log.warn(`[Billing] Failed to upgrade local customer to Stripe: ${upgradeErr.message}`);
        }
      }
    }

    // Without a real Stripe customer no payment can be taken. Granting the
    // plan locally is a test-mode convenience only — in production it would be
    // a silent free upgrade whenever Stripe is unreachable.
    if (isLocalCustomer) {
      if (!BILLING_TEST_MODE) {
        return reply.code(502).send({ error: 'The payment provider is unreachable right now — please try again shortly.' });
      }
      server.log.warn(`[Billing] TEST MODE: local customer — recording plan ${plan} without Stripe.`);
      await (prisma as any).subscription.update({
        where: { userId: decoded.userId },
        data: {
          plan: plan.toUpperCase() as any,
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      await publishBillingSync(decoded.userId);
      return { success: true, local: true };
    }

    // We must attach the payment method to the customer before using it for a subscription
    if (paymentMethodId && !isLocalCustomer) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: sub.stripeCustomerId });

      // Optionally set it as the default for the customer
      await stripe.customers.update(sub.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
    }

    let subscription: Stripe.Subscription;

    // "Terminal" Stripe statuses can never be revived — the API rejects any
    // update on them ("A canceled subscription can only update its
    // cancellation_details and metadata."). The customer wants to resubscribe
    // after cancelling / letting the trial expire, so treat these as "no
    // existing subscription" and mint a fresh one below.
    const TERMINAL_STRIPE_STATUSES = new Set(['canceled', 'incomplete_expired']);

    let existingItemId: string | null = null;
    if (sub.stripeSubscriptionId) {
      try {
        const existingSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        if (existingSubscription.status === 'incomplete') {
          // An earlier checkout that was never paid. Stripe will not re-price
          // it, so drop it and start a clean one below.
          await stripe.subscriptions.cancel(existingSubscription.id).catch(() => { /* already gone */ });
        } else if (!TERMINAL_STRIPE_STATUSES.has(existingSubscription.status)) {
          const existingItem = existingSubscription.items.data[0];
          if (!existingItem) {
            return reply.code(409).send({ error: 'The existing subscription has no plan item to update' });
          }
          existingItemId = existingItem.id;
        }
      } catch (err: any) {
        // Stripe returns 404 when the sub id is stale (test-mode wipe, etc.).
        // Fall back to creating a fresh subscription instead of hard-failing.
        if (err?.code !== 'resource_missing') throw err;
      }
    }

    // 'allow_incomplete' makes Stripe attempt the charge NOW with the card just
    // attached. This used to be 'default_incomplete', which never charges on
    // the server: the payment sits at requires_confirmation waiting for the
    // browser. The code below only handed the browser a requires_action
    // payment and treated every other state as paid, so the plan was granted
    // with no money taken and the Stripe subscription expired unpaid a day
    // later.
    if (existingItemId) {
      subscription = await stripe.subscriptions.update(sub.stripeSubscriptionId as string, {
        items: [{ id: existingItemId, price: priceId }],
        default_payment_method: paymentMethodId,
        payment_behavior: 'allow_incomplete',
        proration_behavior: 'create_prorations',
        expand: ['latest_invoice.payment_intent'],
      });
    } else {
      subscription = await stripe.subscriptions.create({
        customer: sub.stripeCustomerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        payment_behavior: 'allow_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });
    }

    // The plan is granted on Stripe's word that the subscription is paid, and
    // on nothing else.
    if (subscriptionEffect(subscription.status).kind === 'paid') {
      await grantPaidPlan(decoded.userId, plan.toUpperCase(), subscription, { boughtByUser: true });
      return { success: true, subscriptionId: subscription.id };
    }

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = (latestInvoice && typeof latestInvoice !== 'string'
      ? latestInvoice.payment_intent : null) as Stripe.PaymentIntent | null;

    if (paymentIntent && (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation')) {
      // The bank wants the customer to approve the payment (3-D Secure).
      // Remember the subscription so /billing/subscribe/confirm and the
      // webhook can find this row once the payment clears; the plan itself
      // stays as it is until then.
      await (prisma as any).subscription.update({
        where: { userId: decoded.userId },
        data: { stripeSubscriptionId: subscription.id }
      });
      return { clientSecret: paymentIntent.client_secret, requiresAction: true, subscriptionId: subscription.id };
    }

    // Not paid and nothing the customer can approve: the card was declined
    // (or an existing subscription is overdue). A brand-new subscription that
    // failed its first payment is removed so the next attempt starts clean.
    if (!existingItemId) {
      await stripe.subscriptions.cancel(subscription.id).catch(() => { /* already gone */ });
    }
    const declineReason = paymentIntent?.last_payment_error?.message;
    server.log.warn(`[Billing] Subscribe for ${decoded.userId} not paid: subscription ${subscription.status}, payment ${paymentIntent?.status || 'none'}.`);
    return reply.code(402).send({
      error: declineReason
        || (existingItemId
          ? 'Your current subscription has an unpaid invoice. Update your payment method under Manage Billing, then try again.'
          : 'The payment did not go through. Check the card details or try another card.'),
    });
  } catch (err: any) {
    server.log.error(err);
    // Card errors (declined, wrong CVC, expired) are the customer's to fix and
    // carry a message written for them.
    if (err?.type === 'StripeCardError') {
      return reply.code(402).send({ error: err.message });
    }
    return reply.code(500).send({ error: 'Subscription failed: ' + err.message });
  }
});

// 3a. POST /billing/subscribe/confirm — called by the checkout after the
// customer approves a payment in the browser (3-D Secure). Asks Stripe for the
// truth and grants the plan only if the subscription is now paid. The webhook
// does the same on its own; this just means the customer does not have to
// wait for it (or depend on it being configured).
server.post('/billing/subscribe/confirm', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'billing:manage');
  if (!decoded) return;

  try {
    const row = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!row?.stripeSubscriptionId || String(row.stripeSubscriptionId).startsWith('local_')) {
      return reply.code(404).send({ error: 'No subscription is waiting for payment.' });
    }
    const subscription = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
    if (subscriptionEffect(subscription.status).kind !== 'paid') {
      return reply.code(402).send({ error: 'The payment has not completed yet.', status: subscription.status });
    }
    const plan = planForPrice(subscription.items.data[0]?.price?.id);
    if (!plan) return reply.code(409).send({ error: 'This subscription is not for a known plan.' });
    await grantPaidPlan(decoded.userId, plan, subscription, { boughtByUser: true });
    return { success: true, plan };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Could not confirm the subscription: ' + err.message });
  }
});

// 3b. PATCH /billing/my-plan — Direct plan switch without payment. Free plans
// only, unless BILLING_TEST_MODE is on (QA convenience): otherwise any org
// owner could self-grant a paid plan with a single API call.
server.patch('/billing/my-plan', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'billing:manage');
  if (!decoded) return;

  const { plan } = request.body as any;
  const targetPlan = plan ? await findMergedPlan(plan) : null;
  if (!targetPlan || targetPlan.status !== 'Active') {
    return reply.code(400).send({ error: 'Invalid plan' });
  }
  if (!BILLING_TEST_MODE && targetPlan.price !== 0) {
    return reply.code(402).send({ error: 'This plan requires payment — use the checkout flow to subscribe.' });
  }

  try {
    if (decoded.role !== 'OWNER') {
      return reply.code(403).send({ error: 'Only organization owners can manage subscriptions' });
    }
    // Moving to TRIAL keeps any existing period end (no self-service trial
    // resets); only rows without an end date get a fresh trial window.
    const existing = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    const sub = await applyPlanChange(decoded.userId, targetPlan,
      targetPlan.id === 'TRIAL' && !existing?.currentPeriodEnd
        ? { currentPeriodEnd: await trialEndDate() } : {});
    await publishBillingSync(decoded.userId);

    return { success: true, plan: effectivePlanId(sub) };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to update plan: ' + err.message });
  }
});

// 3c. PATCH /billing/set-plan — Assign plan to specific user (Super Admin only)
server.patch('/billing/set-plan', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !hasPermission(decoded.role, 'plan:manage')) {
    return reply.code(403).send({ error: 'Plan management access required' });
  }

  const { userId, plan } = request.body as any;
  if (!userId || !plan) return reply.code(400).send({ error: 'userId and plan are required' });
  const targetPlan = await findMergedPlan(plan);
  if (!targetPlan || targetPlan.status !== 'Active') {
    return reply.code(400).send({ error: 'Invalid plan' });
  }

  try {
    // A paid grant clears the period end, so moving (back) onto TRIAL with no
    // deadline would be a never-ending free trial: give it a fresh window.
    const existing = await (prisma as any).subscription.findUnique({ where: { userId } });
    const sub = await applyPlanChange(userId, targetPlan,
      targetPlan.id === 'TRIAL' && !existing?.currentPeriodEnd
        ? { currentPeriodEnd: await trialEndDate() } : {});
    await publishBillingSync(userId);

    return { success: true, plan: effectivePlanId(sub), userId };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to set plan: ' + err.message });
  }
});

// 3d. POST /billing/admin/subscriptions/:userId/cancel — the super admin stops a
// user's paid subscription (organization delete / owner delete). Cancels in
// Stripe immediately when one is attached; a MANUAL grant has nothing to
// cancel and is left alone so a restored organization keeps its plan. Gated
// by the platform-only `plan:manage`; auth-service forwards the admin's token.
server.post('/billing/admin/subscriptions/:userId/cancel', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'plan:manage');
  if (!decoded) return;

  const { userId } = request.params as any;
  const sub = await (prisma as any).subscription.findUnique({ where: { userId } });
  if (!sub) return reply.code(404).send({ error: 'No subscription for this user' });

  const stripeId = sub.stripeSubscriptionId && !String(sub.stripeSubscriptionId).startsWith('local_')
    ? sub.stripeSubscriptionId
    : null;
  if (!stripeId) return { success: true, cancelled: false };

  try {
    await stripe.subscriptions.cancel(stripeId);
  } catch (err: any) {
    // Already gone in Stripe is fine; anything else is reported, not hidden.
    if (err?.code !== 'resource_missing') {
      server.log.error(err);
      return reply.code(502).send({ error: 'Stripe cancellation failed: ' + err.message });
    }
  }
  await (prisma as any).subscription.update({
    where: { userId },
    data: { status: 'CANCELLED', cancelAtPeriodEnd: true },
  });
  await publishBillingSync(userId);
  return { success: true, cancelled: true };
});

// 4. POST /billing/cancel — Cancel at end of period
server.post('/billing/cancel', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'billing:manage');
  if (!decoded) return;

  try {
    const sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!sub || !sub.stripeSubscriptionId) return reply.code(404).send({ error: 'No active subscription' });

    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });

    await (prisma as any).subscription.update({
      where: { userId: decoded.userId },
      data: { cancelAtPeriodEnd: true }
    });
    await publishBillingSync(decoded.userId);

    return { success: true };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Cancellation failed: ' + err.message });
  }
});

// 5. GET /billing/current — Current plan status
server.get('/billing/current', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'billing:view');
  if (!decoded) return;

  // Plan is org-level: members (ADMIN/VIEWER) view the org owner's
  // subscription — never their own leftover/absent one, which made them
  // show up as TRIAL (or 404) while the owner was on a paid plan.
  let sub: any = null;
  const requesterRole = String(decoded.role || '').toUpperCase();
  if (requesterRole !== 'OWNER' && requesterRole !== 'SUPER_ADMIN') {
    const me = await (prisma as any).user.findUnique({ where: { id: decoded.userId }, select: { organizationId: true } });
    if (me?.organizationId) {
      const orgOwner = await (prisma as any).user.findFirst({
        where: { organizationId: me.organizationId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      if (orgOwner) sub = await (prisma as any).subscription.findUnique({ where: { userId: orgOwner.id } });
    }
  }
  if (!sub) sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
  if (!sub) {
    if (decoded.role !== 'OWNER') {
      return reply.code(404).send({ error: 'No organization subscription found' });
    }
    const user = await (prisma as any).user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      const customer = await stripe.customers.create({ email: user.email });
      sub = await (prisma as any).subscription.upsert({
        where: { userId: decoded.userId },
        create: {
          userId: decoded.userId,
          stripeCustomerId: customer.id,
          plan: 'TRIAL',
          status: 'ACTIVE',
          currentPeriodEnd: await trialEndDate()
        },
        update: { stripeCustomerId: customer.id }
      });
    } catch (err: any) {
      server.log.warn(`[Billing] Stripe unavailable, creating local subscription: ${err.message}`);
      try {
        sub = await (prisma as any).subscription.upsert({
          where: { userId: decoded.userId },
          create: {
            userId: decoded.userId,
            stripeCustomerId: `local_${decoded.userId}`,
            plan: 'TRIAL',
            status: 'ACTIVE',
            currentPeriodEnd: await trialEndDate()
          },
          update: {}
        });
      } catch (dbErr: any) {
        server.log.error(dbErr);
        return reply.code(500).send({ error: 'Failed to create subscription record' });
      }
    }
  }

  // Fetch card details if Stripe customer exists
  let cardInfo = {};
  if (sub.stripeCustomerId && !sub.stripeCustomerId.startsWith('local_')) {
    try {
      const customer = await stripe.customers.retrieve(sub.stripeCustomerId, {
        expand: ['invoice_settings.default_payment_method']
      }) as Stripe.Customer;

      if (customer.invoice_settings?.default_payment_method) {
        const pm = customer.invoice_settings.default_payment_method as Stripe.PaymentMethod;
        cardInfo = {
          card_brand: pm.card?.brand,
          card_last4: pm.card?.last4,
          card_exp_month: pm.card?.exp_month,
          card_exp_year: pm.card?.exp_year,
        };
      }
    } catch (err) {
      server.log.warn(`Failed to fetch card info for customer ${sub.stripeCustomerId}`);
    }
  }

  // Fetch recent invoices
  let invoices: any[] = [];
  if (sub.stripeCustomerId && !sub.stripeCustomerId.startsWith('local_')) {
    try {
      const invList = await stripe.invoices.list({ customer: sub.stripeCustomerId, limit: 5 });
      invoices = invList.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        created: inv.created,
        total: inv.total,
        status: inv.status,
        invoice_pdf: inv.invoice_pdf
      }));
    } catch (err) {
      server.log.warn(`Failed to fetch invoices for customer ${sub.stripeCustomerId}`);
    }
  }

  return {
    plan: effectivePlanId(sub),
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialExpired: isTrialExpired(sub),
    trialDaysTotal: await getTrialDays(),
    serverTime: new Date().toISOString(),
    publishableKey: cleanStripeKey(process.env.STRIPE_PUBLISHABLE_KEY),
    ...cardInfo,
    invoices
  };
});

// 5a. GET /billing/status — lightweight license state for ANY signed-in role
// (no card or invoice data, so it isn't gated on billing:view). The desktop
// polls this to drive the trial countdown and to lock the whole UI once the
// trial runs out. serverTime lets clients ignore local clock skew.
server.get('/billing/status', async (request, reply) => {
  const decoded = requireAuth(request, reply);
  if (!decoded) return;

  const base = { trialDaysTotal: await getTrialDays(), serverTime: new Date().toISOString() };
  if (decoded.role === 'SUPER_ADMIN') {
    return { ...base, plan: 'ENTERPRISE', status: 'ACTIVE', currentPeriodEnd: null, trialExpired: false };
  }

  const sub = await resolveWorkspaceSubscription(decoded.userId);
  if (!sub) {
    // No subscription row anywhere yet (fresh member account) — never lock on missing data.
    return { ...base, plan: 'TRIAL', status: 'ACTIVE', currentPeriodEnd: null, trialExpired: false };
  }

  return {
    ...base,
    plan: effectivePlanId(sub),
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialExpired: isTrialExpired(sub),
  };
});

// 5b. POST /billing/portal — Create Stripe Customer Portal session
server.post('/billing/portal', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'billing:manage');
  if (!decoded) return;

  try {
    const user = await (prisma as any).user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    let sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    let stripeCustomerId = sub?.stripeCustomerId;

    // Trial subscriptions may be created by auth-service before a Stripe
    // customer exists. Create one lazily when billing management is opened.
    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      if (decoded.role !== 'OWNER') {
        return reply.code(403).send({ error: 'Only organization owners can manage billing' });
      }
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: decoded.userId },
      });
      stripeCustomerId = customer.id;

      sub = await (prisma as any).subscription.upsert({
        where: { userId: decoded.userId },
        create: {
          userId: decoded.userId,
          stripeCustomerId,
          plan: 'TRIAL',
          status: 'ACTIVE',
          currentPeriodEnd: await trialEndDate(),
        },
        update: { stripeCustomerId },
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: process.env.WEB_APP_URL || 'http://localhost:5173/billing',
    });

    return { url: portalSession.url };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to create portal session: ' + err.message });
  }
});

// 6. GET /billing/invoices — Fetch invoice history
server.get('/billing/invoices', async (request, reply) => {
  const decoded = requirePermission(request, reply, 'billing:view');
  if (!decoded) return;

  try {
    const sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!sub || !sub.stripeCustomerId) return reply.code(404).send({ error: 'Customer not found' });

    const invoices = await stripe.invoices.list({ customer: sub.stripeCustomerId });

    return invoices.data.map(inv => ({
      amount: inv.total / 100,
      date: new Date(inv.created * 1000).toISOString(),
      status: inv.status,
      pdfUrl: inv.invoice_pdf
    }));
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch invoices: ' + err.message });
  }
});

// 6b. GET /billing/revenue — Platform-wide revenue (Super Admin only)
server.get('/billing/revenue', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !hasPermission(decoded.role, 'billing:viewRevenue')) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  try {
    // Stripe is optional here: with no key configured (or Stripe down) the
    // subscription mix still comes back from the database instead of the 500
    // that used to blank the whole revenue panel.
    let totalRevenue = 0;
    let availableBalance = 0;
    let pendingBalance = 0;
    let currency = 'USD';
    let stripeError: string | null = null;
    if (stripeSecretKey === 'sk_test_dummy') {
      stripeError = 'Stripe is not configured on this server';
    } else {
      try {
        const balance = await stripe.balance.retrieve();
        availableBalance = (balance.available[0]?.amount ?? 0) / 100;
        pendingBalance = (balance.pending[0]?.amount ?? 0) / 100;
        currency = String(balance.available[0]?.currency || 'usd').toUpperCase();
        // Every succeeded, unrefunded charge via auto-pagination (capped) —
        // the old single page of 100 silently understated lifetime revenue.
        let cents = 0;
        let seen = 0;
        for await (const charge of stripe.charges.list({ limit: 100 })) {
          if (charge.status === 'succeeded' && !charge.refunded) cents += charge.amount;
          if (++seen >= 10000) break;
        }
        totalRevenue = cents / 100;
      } catch (err: any) {
        stripeError = err?.message || 'Stripe unavailable';
        server.log.warn(`[Billing] Revenue: Stripe lookup failed: ${stripeError}`);
      }
    }

    // Active subscription counts by EFFECTIVE plan (a custom plan key wins
    // over the enum), keeping the { plan, _count } shape the dashboards read.
    const activeSubs = await (prisma as any).subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { plan: true, customPlanKey: true },
    });
    const countByPlan = new Map<string, number>();
    for (const s of activeSubs) {
      const id = String(effectivePlanId(s)).toUpperCase();
      countByPlan.set(id, (countByPlan.get(id) || 0) + 1);
    }
    const subStats = Array.from(countByPlan, ([plan, _count]) => ({ plan, _count }));

    return {
      totalRevenue,
      availableBalance,
      pendingBalance,
      currency,
      subscriptions: subStats,
      stripeError,
    };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch revenue stats: ' + err.message });
  }
});

// 6c. GET /billing/organization-admin/:userId — Detailed billing for an org admin
server.get('/billing/organization-admin/:userId', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !hasPermission(decoded.role, 'billing:viewInvoices')) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  const { userId } = request.params as any;

  try {
    const sub = await (prisma as any).subscription.findUnique({ where: { userId } });
    if (!sub) return reply.code(404).send({ error: 'No subscription found for this user' });

    let invoices: any[] = [];
    if (sub.stripeCustomerId && !sub.stripeCustomerId.startsWith('local_')) {
      const invList = await stripe.invoices.list({ customer: sub.stripeCustomerId, limit: 10 });
      invoices = invList.data.map(inv => ({
        amount: inv.total / 100,
        date: new Date(inv.created * 1000).toISOString(),
        status: inv.status,
        pdfUrl: inv.invoice_pdf
      }));
    }

    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      invoices
    };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch org billing: ' + err.message });
  }
});

// 7. POST /billing/webhook — Handle Stripe events
server.post('/billing/webhook', { config: { rawBody: true } }, async (request: any, reply) => {
  const sig = request.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(request.rawBody, sig as string, endpointSecret);
  } catch (err: any) {
    server.log.error(`Webhook signature verification failed: ${err.message}`);
    return reply.code(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object as any;

  // Every row lookup is by Stripe subscription id, and an event for a
  // subscription we hold no row for is acknowledged, not failed: it is one we
  // replaced or never recorded (an abandoned checkout), and throwing here made
  // Stripe redeliver it for days. Anything that DOES throw below is a real
  // failure (database down, Stripe unreachable) and is answered with a 500 so
  // Stripe retries it.
  const rowForSubscription = (stripeSubscriptionId: unknown) =>
    typeof stripeSubscriptionId === 'string' && stripeSubscriptionId
      ? (prisma as any).subscription.findUnique({ where: { stripeSubscriptionId } })
      : Promise.resolve(null);
  const endSubscription = async (row: any) => {
    await (prisma as any).subscription.update({
      where: { id: row.id },
      data: { status: 'CANCELLED', plan: 'TRIAL', paidSince: null }
    });
    await publishBillingSync(row.userId);
  };

  try {
    switch (event.type as string) {
      case 'customer.subscription.updated': {
        const row = await rowForSubscription(data.id);
        if (!row) {
          server.log.info(`[Billing] Webhook ${event.type}: no row for subscription ${data.id}; ignored.`);
          break;
        }
        const effect = subscriptionEffect(data.status);
        if (effect.kind === 'paid') {
          const plan = planForPrice(data.items?.data?.[0]?.price?.id);
          if (plan) {
            await grantPaidPlan(row.userId, plan, data as Stripe.Subscription);
          } else {
            // A price that is not one of ours must never be read as "TRIAL":
            // keep the plan the row has and only refresh the dates.
            server.log.warn(`[Billing] Webhook: subscription ${data.id} is on an unrecognised price; plan left as ${row.plan}.`);
            await (prisma as any).subscription.update({
              where: { id: row.id },
              data: {
                status: effect.status,
                currentPeriodEnd: new Date(data.current_period_end * 1000),
                cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
              }
            });
            await publishBillingSync(row.userId);
          }
        } else if (effect.kind === 'past-due') {
          await (prisma as any).subscription.update({ where: { id: row.id }, data: { status: 'PAST_DUE' } });
          await publishBillingSync(row.userId);
        } else if (effect.kind === 'ended') {
          await endSubscription(row);
        } else if (effect.kind === 'abandoned') {
          // A checkout that was never paid expired. Nothing was granted for
          // it, so only the pointer goes; the plan stays as it was.
          await (prisma as any).subscription.update({ where: { id: row.id }, data: { stripeSubscriptionId: null } });
        }
        // 'pending' (incomplete): still waiting on the customer; nothing to record.
        break;
      }

      case 'customer.subscription.deleted': {
        const row = await rowForSubscription(data.id);
        if (row) await endSubscription(row);
        break;
      }

      case 'invoice.payment_succeeded': {
        const row = await rowForSubscription(data.subscription);
        if (!row) break;
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        await (prisma as any).subscription.update({
          where: { id: row.id },
          data: { currentPeriodEnd: new Date(sub.current_period_end * 1000) }
        });
        await publishBillingSync(row.userId);
        break;
      }

      case 'invoice.payment_failed': {
        // The first invoice of a new subscription failing is a declined
        // checkout: no plan was granted, so there is nothing to mark overdue
        // (and marking a trial row PAST_DUE would have the nightly job cancel it).
        if (data.billing_reason === 'subscription_create') break;
        const row = await rowForSubscription(data.subscription);
        if (!row) break;
        await (prisma as any).subscription.update({ where: { id: row.id }, data: { status: 'PAST_DUE' } });
        await publishBillingSync(row.userId);
        console.warn(`Payment failed for customer ${data.customer}. Notifying user...`);
        // TODO: Call email service to notify payment failure
        break;
      }

      case 'customer.subscription.trial_ending':
        console.info(`Trial ending for customer ${data.customer}. Notifying user...`);
        // TODO: Call email service to notify trial ending in 3 days
        break;
    }
  } catch (err: any) {
    server.log.error(`[Billing] Webhook ${event.type} (${event.id}) failed: ${err?.message || err}`);
    return reply.code(500).send({ error: 'Webhook handling failed' });
  }

  return { received: true };
});

// Daily cleanup job: Midnight
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Checking for expired past_due subscriptions...');
  const now = new Date();

  const expired = await (prisma as any).subscription.findMany({
    where: {
      status: 'PAST_DUE',
      currentPeriodEnd: { lt: now }
    }
  });

  for (const sub of expired) {
    await (prisma as any).subscription.update({
      where: { id: sub.id },
      data: { plan: 'TRIAL', status: 'CANCELLED', paidSince: null }
    });
    await publishBillingSync(sub.userId);
    console.info(`[Cron] Downgraded user ${sub.userId} due to expired past_due status`);
    // TODO: Send final email notification
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3004', 10);
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Billing service listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
