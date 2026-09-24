import { create } from 'zustand';
import { useEffect, useState } from 'react';
import api from '../lib/api';

/**
 * Workspace license state, backed by GET /api/billing/status (readable by every
 * signed-in role — members inherit their org owner's subscription). Drives the
 * trial countdown on the Licenses page and the full-app lock once the trial
 * runs out. Time math uses the server clock via serverOffsetMs so a wrong
 * local clock can neither dodge nor trigger the lock.
 */
interface LicenseState {
  plan: string;
  status: string;
  expiresAt: string | null;
  trialDaysTotal: number;
  serverOffsetMs: number;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  plan: 'TRIAL',
  status: 'ACTIVE',
  expiresAt: null,
  trialDaysTotal: 15,
  serverOffsetMs: 0,
  loaded: false,

  refresh: async () => {
    try {
      const { data } = await api.get('/api/billing/status');
      set({
        plan: String(data?.plan || 'TRIAL').toUpperCase(),
        status: data?.status || 'ACTIVE',
        expiresAt: data?.currentPeriodEnd || null,
        trialDaysTotal: data?.trialDaysTotal || 15,
        serverOffsetMs: data?.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0,
        loaded: true,
      });
    } catch (err) {
      // Keep the previous state — an unreachable billing service must not lock anyone out.
      console.error('[License] Failed to load billing status', err);
    }
  },
}));

/** Milliseconds left in the trial (negative when expired, null when unknown). */
export const trialRemainingMs = (s: Pick<LicenseState, 'expiresAt' | 'serverOffsetMs'>): number | null =>
  s.expiresAt ? new Date(s.expiresAt).getTime() - (Date.now() + s.serverOffsetMs) : null;

/** True only when we positively know the free trial has run out. */
export const isTrialLocked = (s: LicenseState): boolean => {
  if (!s.loaded || s.plan !== 'TRIAL') return false;
  const left = trialRemainingMs(s);
  return left !== null && left <= 0;
};

export interface TrialCountdown {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

/** Live per-second countdown to the trial deadline; null while unknown. */
export const useTrialCountdown = (expiresAt: string | null, serverOffsetMs = 0): TrialCountdown | null => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const totalMs = new Date(expiresAt).getTime() - (Date.now() + serverOffsetMs);
  const left = Math.max(0, totalMs);
  return {
    expired: totalMs <= 0,
    days: Math.floor(left / 86_400_000),
    hours: Math.floor((left % 86_400_000) / 3_600_000),
    minutes: Math.floor((left % 3_600_000) / 60_000),
    seconds: Math.floor((left % 60_000) / 1_000),
    totalMs,
  };
};
