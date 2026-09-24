import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasPermission, prisma, verifyToken,
  getMergedPlanCatalog, findMergedPlan, BUILTIN_PLAN_IDS,
} from '@remotelink/shared';

/**
 * Super Admin -> Subscription Plans.
 * CRUD over the plan catalog: built-ins live in code (packages/shared
 * plans.ts) and can be overridden or disabled; brand-new custom plans are
 * PlanDef rows. Whatever is Active here is what the desktop and mobile apps
 * list via GET /api/billing/plans. Gated by `plan:manage`.
 */

type PlanBody = {
  name?: string;
  description?: string;
  price?: string | number;
  priceLabel?: string;
  currency?: string;
  billingPeriod?: string;
  maxDevices?: number | string | null;
  maxUsers?: number | string | null;
  maxConcurrentSessions?: number | string | null;
  trialDays?: number | string | null;
  autoConvert?: boolean;
  trialReminder?: string | null;
  auditRetentionDays?: string | null;
  features?: string[];
  popular?: boolean;
  status?: string;
};

async function requirePlanAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader) { reply.code(401).send({ error: 'Unauthorized' }); return null; }
  const decoded = verifyToken(authHeader.split(' ')[1]);
  if (!decoded) { reply.code(401).send({ error: 'Invalid token' }); return null; }
  if (!hasPermission(decoded.role, 'plan:manage')) {
    reply.code(403).send({ error: 'Plan management access required' });
    return null;
  }
  return decoded;
}

const toIntOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
};

// A trial length of 0 means "no trial" and is stored as null. It used to be
// stored as 0, which getTrialDays() (`|| 15`) silently turned back into 15.
const normalizeTrialDays = (value: unknown): number | null => {
  const n = toIntOrNull(value);
  return n && n > 0 ? n : null;
};

const normalizePrice = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.toLowerCase() === 'custom') return 'Custom';
  const n = Number(raw.replace(/^\$/, ''));
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
};

const defaultPriceLabel = (price: string): string => {
  if (price === 'Custom') return 'Custom';
  const n = Number(price);
  return n === 0 ? 'Free' : `$${n} / month`;
};

const slugId = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const normalizeCurrency = (value: unknown): string => {
  const raw = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : 'USD';
};

const BILLING_PERIODS = ['Monthly', 'Yearly', 'One-time', 'Custom'];
const normalizeBillingPeriod = (value: unknown): string =>
  BILLING_PERIODS.includes(String(value)) ? String(value) : 'Monthly';

const PLAN_STATUSES = ['Active', 'Draft', 'Archived', 'Disabled'];
const normalizeStatus = (value: unknown): string =>
  PLAN_STATUSES.includes(String(value)) ? String(value) : 'Active';

// "None" (and empty) mean no reminder; anything else is kept verbatim.
const normalizeTrialReminder = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  return !raw || raw === 'None' ? null : raw;
};

const normalizeFeatures = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];

// Fallback plan-card bullets derived from the limits (used when the admin
// leaves the features list empty), mirroring the built-in catalog's style.
const limitFeature = (n: number | null, singular: string, plural: string) =>
  n == null ? `Unlimited ${plural}` : `${n} ${n === 1 ? singular : plural}`;
const autoFeatures = (maxUsers: number | null, maxDevices: number | null, maxSessions: number | null) => [
  limitFeature(maxUsers, 'member', 'members'),
  limitFeature(maxDevices, 'device', 'devices'),
  limitFeature(maxSessions, 'concurrent session', 'concurrent sessions'),
];

// Live subscribers per plan id. Mirrors the Billing & Revenue page: rows
// belonging to deleted users/organizations and cancelled subscriptions are
// excluded, and a custom plan key wins over the enum.
async function subscriberCounts(): Promise<{ counts: Map<string, number>; paying: Map<string, number> }> {
  const subs = await (prisma as any).subscription.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      plan: true,
      customPlanKey: true,
      status: true,
      user: { select: { status: true, organization: { select: { status: true } } } },
    },
  });
  const counts = new Map<string, number>();
  // Paying = ACTIVE rows on a non-trial plan. Trials and past-due rows sit on
  // a plan but bring no revenue, so the plans page must not multiply them.
  const paying = new Map<string, number>();
  for (const s of subs) {
    if (!s.user || s.user.status === 'DELETED') continue;
    if (s.user.organization && s.user.organization.status === 'DELETED') continue;
    const key = String(s.customPlanKey || s.plan).toUpperCase();
    counts.set(key, (counts.get(key) || 0) + 1);
    if (s.status === 'ACTIVE' && key !== 'TRIAL') paying.set(key, (paying.get(key) || 0) + 1);
  }
  return { counts, paying };
}

export default async function adminPlanRoutes(fastify: FastifyInstance) {
  // GET / — full merged catalog (Active + Disabled) with subscriber counts.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlanAdmin(request, reply);
    if (!decoded) return;
    const [plans, { counts, paying }] = await Promise.all([getMergedPlanCatalog(), subscriberCounts()]);
    return reply.send({
      plans: plans.map((p) => ({
        ...p,
        subscribers: counts.get(p.id.toUpperCase()) || 0,
        paying: paying.get(p.id.toUpperCase()) || 0,
      })),
    });
  });

  // POST / — create a custom plan.
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlanAdmin(request, reply);
    if (!decoded) return;
    const body = (request.body || {}) as PlanBody;

    const name = String(body.name || '').trim();
    if (!name) return reply.code(400).send({ error: 'Plan name is required' });
    const price = normalizePrice(body.price);
    if (price === null) return reply.code(400).send({ error: 'Price must be a number or "Custom"' });

    const id = slugId(name);
    if (!id) return reply.code(400).send({ error: 'Plan name must contain letters or numbers' });
    if (BUILTIN_PLAN_IDS.has(id) || (await findMergedPlan(id))) {
      return reply.code(400).send({ error: `A plan with the id "${id}" already exists` });
    }

    const maxDevices = toIntOrNull(body.maxDevices);
    const maxUsers = toIntOrNull(body.maxUsers);
    const maxConcurrentSessions = toIntOrNull(body.maxConcurrentSessions);
    const features = normalizeFeatures(body.features);

    await (prisma as any).planDef.create({
      data: {
        id,
        name,
        price,
        priceLabel: String(body.priceLabel || '').trim() || defaultPriceLabel(price),
        currency: normalizeCurrency(body.currency),
        billingPeriod: normalizeBillingPeriod(body.billingPeriod),
        description: String(body.description || '').trim(),
        maxDevices,
        maxUsers,
        maxConcurrentSessions,
        trialDays: normalizeTrialDays(body.trialDays),
        autoConvert: body.autoConvert !== undefined ? !!body.autoConvert : true,
        trialReminder: normalizeTrialReminder(body.trialReminder),
        auditRetentionDays: body.auditRetentionDays ? String(body.auditRetentionDays) : null,
        features: features.length ? features : autoFeatures(maxUsers, maxDevices, maxConcurrentSessions),
        popular: !!body.popular,
        status: normalizeStatus(body.status),
        isCustom: true,
      },
    });

    return reply.send({ plan: await findMergedPlan(id) });
  });

  // PUT /:id — edit a custom plan, or override a built-in.
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlanAdmin(request, reply);
    if (!decoded) return;
    const { id } = request.params as { id: string };
    const current = await findMergedPlan(id);
    if (!current) return reply.code(404).send({ error: 'Unknown plan' });
    const body = (request.body || {}) as PlanBody;

    const name = body.name !== undefined ? String(body.name).trim() : current.name;
    if (!name) return reply.code(400).send({ error: 'Plan name is required' });
    const price = body.price !== undefined ? normalizePrice(body.price) : String(current.price);
    if (price === null) return reply.code(400).send({ error: 'Price must be a number or "Custom"' });

    const maxDevices = body.maxDevices !== undefined ? toIntOrNull(body.maxDevices) : current.maxDevices;
    const maxUsers = body.maxUsers !== undefined ? toIntOrNull(body.maxUsers) : current.maxUsers;
    const maxConcurrentSessions = body.maxConcurrentSessions !== undefined ? toIntOrNull(body.maxConcurrentSessions) : current.maxConcurrentSessions;
    const sentFeatures = body.features !== undefined ? normalizeFeatures(body.features) : null;

    const isTrialPlan = current.id.toUpperCase() === 'TRIAL';
    const trialDays = body.trialDays !== undefined
      ? normalizeTrialDays(body.trialDays)
      : (current.trialDays ?? (isTrialPlan ? 15 : null));
    if (isTrialPlan && !trialDays) {
      return reply.code(400).send({ error: 'The Trial plan needs a trial length of at least 1 day' });
    }

    // Taking a plan out of service while accounts sit on it would hide it from
    // every app and (for TRIAL) break sign-up itself — only DELETE used to
    // check for subscribers, so a status flip could do what a delete could not.
    const nextStatus = body.status !== undefined ? normalizeStatus(body.status) : current.status;
    if (nextStatus !== 'Active' && current.status === 'Active') {
      if (isTrialPlan) {
        return reply.code(400).send({ error: 'The Trial plan must stay Active — every new sign-up starts on it' });
      }
      const inUse = (await subscriberCounts()).counts.get(current.id.toUpperCase()) || 0;
      if (inUse > 0) {
        return reply.code(400).send({ error: `${inUse} subscription${inUse === 1 ? ' is' : 's are'} on this plan — move them before taking it out of service` });
      }
    }

    const data = {
      name,
      price,
      priceLabel: body.priceLabel !== undefined
        ? (String(body.priceLabel).trim() || defaultPriceLabel(price))
        : current.priceLabel,
      currency: body.currency !== undefined ? normalizeCurrency(body.currency) : current.currency,
      billingPeriod: body.billingPeriod !== undefined ? normalizeBillingPeriod(body.billingPeriod) : current.billingPeriod,
      description: body.description !== undefined ? String(body.description).trim() : current.description,
      maxDevices,
      maxUsers,
      maxConcurrentSessions,
      trialDays,
      autoConvert: body.autoConvert !== undefined ? !!body.autoConvert : current.autoConvert,
      trialReminder: body.trialReminder !== undefined ? normalizeTrialReminder(body.trialReminder) : current.trialReminder,
      auditRetentionDays: body.auditRetentionDays !== undefined
        ? (body.auditRetentionDays ? String(body.auditRetentionDays) : null)
        : (current.auditRetentionDays != null ? String(current.auditRetentionDays) : null),
      features: sentFeatures !== null
        ? (sentFeatures.length ? sentFeatures : autoFeatures(maxUsers, maxDevices, maxConcurrentSessions))
        : current.features,
      popular: body.popular !== undefined ? !!body.popular : !!current.popular,
      status: nextStatus,
    };

    await (prisma as any).planDef.upsert({
      where: { id: current.id },
      update: data,
      create: { id: current.id, ...data, isCustom: current.isCustom },
    });

    return reply.send({ plan: await findMergedPlan(current.id) });
  });

  // POST /:id/reset — drop a built-in's override, back to the code default.
  fastify.post('/:id/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlanAdmin(request, reply);
    if (!decoded) return;
    const { id } = request.params as { id: string };
    if (!BUILTIN_PLAN_IDS.has(String(id).toUpperCase())) {
      return reply.code(400).send({ error: 'Only built-in plans can be reset' });
    }
    await (prisma as any).planDef.deleteMany({ where: { id: String(id).toUpperCase() } });
    return reply.send({ plan: await findMergedPlan(id) });
  });

  // DELETE /:id — remove a custom plan nobody is subscribed to.
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requirePlanAdmin(request, reply);
    if (!decoded) return;
    const { id } = request.params as { id: string };
    const current = await findMergedPlan(id);
    if (!current) return reply.code(404).send({ error: 'Unknown plan' });
    if (!current.isCustom) {
      return reply.code(400).send({ error: 'Built-in plans cannot be deleted — disable them instead' });
    }
    const inUse = await (prisma as any).subscription.count({ where: { customPlanKey: current.id } });
    if (inUse > 0) {
      return reply.code(400).send({ error: `${inUse} subscription${inUse === 1 ? ' is' : 's are'} on this plan — move them first` });
    }
    await (prisma as any).planDef.delete({ where: { id: current.id } });
    return reply.send({ success: true });
  });
}
