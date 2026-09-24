import { prisma } from './db';
import { PLAN_CATALOG, PLAN_ORDER, PlanMetadata } from './plans';

/**
 * Merged subscription-plan catalog.
 * The built-in plans live in code (plans.ts); the super admin can override
 * them or add brand-new custom plans via the PlanDef table (managed from the
 * desktop Super Admin console → Subscription Plans). Everything that shows or
 * validates plans should go through this merge so admin-created plans behave
 * like first-class plans in the desktop and mobile apps.
 */

export type PlanStatus = 'Active' | 'Draft' | 'Archived' | 'Disabled';

export type MergedPlan = PlanMetadata & {
  currency: string;
  billingPeriod: string;
  /** Convert the trial to paid automatically when it ends. */
  autoConvert: boolean;
  /** e.g. "1 day before"; null = no reminder. */
  trialReminder: string | null;
  status: PlanStatus;
  isCustom: boolean;
  /** True when a built-in plan has an override row. */
  customized: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

export const BUILTIN_PLAN_IDS = new Set<string>(PLAN_ORDER as unknown as string[]);

const parsePrice = (value: string): number | 'Custom' => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 'Custom';
};

const parseRetention = (value: string | null): number | 'Custom' | undefined => {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : 'Custom';
};

const PLAN_STATUSES: PlanStatus[] = ['Active', 'Draft', 'Archived', 'Disabled'];
const parseStatus = (value: unknown): PlanStatus =>
  PLAN_STATUSES.includes(value as PlanStatus) ? (value as PlanStatus) : 'Active';

// Billing period implied by a built-in (code-defined) plan's price.
const builtinBillingPeriod = (price: number | 'Custom'): string =>
  price === 'Custom' ? 'Custom' : price === 0 ? 'One-time' : 'Monthly';

const rowToPlan = (row: any, base?: PlanMetadata, sortOrder?: number): MergedPlan => ({
  id: row.id,
  name: row.name,
  price: parsePrice(row.price),
  priceLabel: row.priceLabel,
  currency: row.currency || 'USD',
  billingPeriod: row.billingPeriod || builtinBillingPeriod(parsePrice(row.price)),
  description: row.description,
  maxDevices: row.maxDevices,
  maxUsers: row.maxUsers,
  maxConcurrentSessions: row.maxConcurrentSessions,
  trialDays: row.trialDays ?? undefined,
  autoConvert: row.autoConvert ?? true,
  trialReminder: row.trialReminder ?? null,
  auditRetentionDays: parseRetention(row.auditRetentionDays),
  features: row.features?.length ? row.features : base?.features ?? [],
  popular: row.popular,
  status: parseStatus(row.status),
  isCustom: row.isCustom,
  customized: !row.isCustom,
  sortOrder: sortOrder ?? row.sortOrder ?? 100,
  updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

const builtinToPlan = (p: PlanMetadata, index: number): MergedPlan => ({
  ...p,
  currency: 'USD',
  billingPeriod: builtinBillingPeriod(p.price),
  autoConvert: true,
  trialReminder: null,
  status: 'Active',
  isCustom: false,
  customized: false,
  sortOrder: index * 10,
  updatedAt: null,
});

/** All plans (Active + Disabled): built-ins with overrides applied, then customs. */
export async function getMergedPlanCatalog(): Promise<MergedPlan[]> {
  let rows: any[] = [];
  try {
    rows = await (prisma as any).planDef.findMany();
  } catch (err: any) {
    // Table missing/unreachable — the built-in catalog still works.
    console.error(`[Plans] PlanDef lookup failed, using built-in catalog: ${err.message}`);
    rows = [];
  }

  const byId = new Map(rows.map((r) => [String(r.id).toUpperCase(), r]));
  const merged: MergedPlan[] = PLAN_CATALOG.map((p, i) => {
    const override = byId.get(p.id);
    return override ? rowToPlan(override, p, i * 10) : builtinToPlan(p, i);
  });
  for (const row of rows) {
    if (!BUILTIN_PLAN_IDS.has(String(row.id).toUpperCase())) merged.push(rowToPlan(row));
  }
  merged.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return merged;
}

/** Only plans users may see/subscribe to. */
export async function getActivePlanCatalog(): Promise<MergedPlan[]> {
  return (await getMergedPlanCatalog()).filter((p) => p.status === 'Active');
}

export async function findMergedPlan(id: string | null | undefined): Promise<MergedPlan | null> {
  if (!id) return null;
  const upper = String(id).toUpperCase();
  const all = await getMergedPlanCatalog();
  return all.find((p) => p.id.toUpperCase() === upper) ?? null;
}

/** Effective plan id for a subscription row: a custom plan key wins over the enum. */
export { effectivePlanId } from './plan-entitlement';

/**
 * Trial length in days: the (possibly overridden) TRIAL plan's trialDays.
 * Falls back to 15 when the catalog is unreachable or the field is unset.
 */
export async function getTrialDays(): Promise<number> {
  try {
    const trial = await findMergedPlan('TRIAL');
    return trial?.trialDays || 15;
  } catch {
    return 15;
  }
}

export const trialDurationMs = (days: number): number => days * 24 * 60 * 60 * 1000;

/** PLAN_LIMITS-shaped limits for a custom plan (null limits mean unlimited). */
export const customPlanLimits = (plan: MergedPlan) => ({
  maxConcurrentSessions: plan.maxConcurrentSessions ?? -1,
  maxDevices: plan.maxDevices ?? -1,
  sessionDurationMinutes: -1,
  fileTransfer: true,
  sessionRecording: true,
  teamMembers: plan.maxUsers ?? -1,
});
