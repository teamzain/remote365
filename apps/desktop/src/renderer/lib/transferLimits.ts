/**
 * Per-file transfer size limits by billing plan.
 *
 * Product decision (Aug 2026): the cap is per FILE, not per session — a
 * 3 GB ISO on a Trial plan is refused up front with a clear message, while
 * any number of smaller files stays fine. Limits scale with the plan tier.
 *
 * This map lives in the renderer (the renderer cannot import
 * packages/shared), so keep it in sync with the tiers in
 * packages/shared/src/plans.ts. Enforcement here is first-line UX — it stops
 * a doomed transfer before any bytes move in either direction (the pull path
 * ships the limit to the host, which filters oversized files during its
 * walk). Server-side enforcement on the billing service is the follow-up
 * hardening; a client this old or tampered simply falls back to TRIAL's cap.
 */

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

/** null = unlimited. Keys are licenseStore's uppercased plan ids. */
const PER_FILE_LIMIT_BY_PLAN: Record<string, number | null> = {
  TRIAL: 500 * MB,
  SOLO: 2 * GB,
  PRO: 5 * GB,
  BUSINESS: 20 * GB,
  ENTERPRISE: null,
};

/** Fallback for unknown plan strings: treat like TRIAL, the tightest cap. */
export function maxFileBytesForPlan(plan: string | undefined | null): number | null {
  const key = String(plan || 'TRIAL').toUpperCase();
  return key in PER_FILE_LIMIT_BY_PLAN ? PER_FILE_LIMIT_BY_PLAN[key] : PER_FILE_LIMIT_BY_PLAN.TRIAL;
}

export function describeLimit(bytes: number | null): string {
  if (bytes === null) return 'unlimited';
  if (bytes >= GB) return `${Math.round(bytes / GB)} GB`;
  return `${Math.round(bytes / MB)} MB`;
}
