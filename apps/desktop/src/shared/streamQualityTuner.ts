// Viewer-side stream quality tuner: decides which host encoder tier to ask for
// from the viewer's own WebRTC stats. Pure logic (no DOM, no timers) so it can
// be unit-tested and shared: apps/web/src/lib/streamQualityTuner.ts is a copy
// of this file and the two must stay identical.
//
// Why delay is a congestion signal here. The tuner used to look at packet loss
// only, and called any sample without loss "healthy". A link that is being sent
// more than it can carry does not start by losing packets: its queue fills
// first, so the round trip climbs from tens of milliseconds to seconds while
// loss stays at 0%. Field log, Oct 3 2026 (host on a thin uplink): rtt 12ms ->
// 6197ms at 0% loss, the tuner asked for a HIGHER tier ("mode=sharp
// reason=healthy rtt=5978ms"), three seconds later loss was 87.8% and the
// connection failed. The round trip over its own baseline is the early warning,
// and it is measured against the baseline, never as an absolute number: a
// steady 300ms long-haul path is not congested and must not be made blurry.

export const QUALITY_ORDER = ['minimal', 'saver', 'lite', 'smooth', 'balanced', 'sharp', 'ultra'] as const;
export type QualityTier = typeof QUALITY_ORDER[number];

export const QUALITY_RANK: Record<QualityTier, number> = {
  minimal: 0, saver: 1, lite: 2, smooth: 3, balanced: 4, sharp: 5, ultra: 6,
};

/** Lowest tier a host without the low tiers understands. Such a host maps a
 *  name it does not know to its TOP tier, so it must never be sent one. */
export const LEGACY_FLOOR: QualityTier = 'smooth';
export const DEFAULT_START: QualityTier = 'balanced';

export const isQualityTier = (value: unknown): value is QualityTier =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(QUALITY_RANK, value);

/** True when a host's advertised tier list includes the sub-'smooth' tiers. */
export const hostSupportsLowTiers = (tiers: unknown): boolean =>
  Array.isArray(tiers) && tiers.includes('minimal') && tiers.includes('saver') && tiers.includes('lite');

// Round trip above the session's baseline, in ms.
const DELAY_MODERATE_MS = 300;   // hold: no climbing, step down as far as 'balanced'
const DELAY_CONGESTED_MS = 600;  // step down a tier
const DELAY_SEVERE_MS = 2000;    // seconds of queue: drop two tiers at once
const LOSS_MODERATE_PCT = 1.5;
const LOSS_CONGESTED_PCT = 5;
const LOSS_SEVERE_PCT = 30;
/** A lower tier needs an encoder restart and the queue needs time to drain.
 *  Judging the new tier before that just steps down again on stale numbers. */
const DOWNSHIFT_SETTLE_MS = 3000;
/** Clean time required before any climb. */
const CLEAN_BEFORE_UPSHIFT_MS = 20_000;
const UPSHIFT_STREAK_MS = 10_000;
/** After congestion the tier that failed stays off limits this long; doubled
 *  each time the same thing happens again soon after, up to the cap. */
const CEILING_HOLD_MS = 180_000;
const CEILING_HOLD_MAX_MS = 900_000;
const STRIKE_MEMORY_MS = 600_000;
const STRIKE_EPISODE_MS = 30_000;

/** Survives reconnects of the same session (a reconnect is very often CAUSED by
 *  the congestion being remembered here). Reset it for a different session. */
export interface QualityMemory {
  ceilingRank: number;   // highest tier allowed while ceilingUntil is in the future
  ceilingUntil: number;
  strikes: number;
  lastStrikeAt: number;
  lastCongestionAt: number;
}

export const createQualityMemory = (): QualityMemory => ({
  ceilingRank: QUALITY_RANK.ultra, ceilingUntil: 0, strikes: 0, lastStrikeAt: 0, lastCongestionAt: 0,
});

export interface TunerSample {
  now: number;
  rttMs: number;        // 0 when the browser reported none this sample
  lossPct: number;
  /** Nothing can be learned from this sample (first picture not shown yet, or
   *  no video packets at all arrived): never climb on it. */
  stalled?: boolean;
}

export interface TunerDecision {
  next: QualityTier;
  changed: boolean;
  reason: 'healthy' | 'loss-moderate' | 'loss-high' | 'delay-moderate' | 'delay-high';
  target: QualityTier;
  baselineRttMs: number;
  delayExcessMs: number;
}

export interface QualityTuner {
  readonly current: QualityTier;
  sample(input: TunerSample): TunerDecision;
  /** The user or the app forced a tier (e.g. "Boost Connection"). */
  force(tier: QualityTier, now: number): void;
}

const clampRank = (rank: number, floor: number, ceiling: number) => Math.max(floor, Math.min(ceiling, rank));

/** Tier a (re)connecting viewer should ask for first: 'balanced' normally, the
 *  remembered ceiling when this session was congested moments ago. */
export function initialTier(memory: QualityMemory, now: number, lowTiers: boolean): QualityTier {
  const floor = lowTiers ? 0 : QUALITY_RANK[LEGACY_FLOOR];
  if (memory.ceilingUntil <= now) return DEFAULT_START;
  return QUALITY_ORDER[clampRank(Math.min(memory.ceilingRank, QUALITY_RANK[DEFAULT_START]), floor, QUALITY_RANK.ultra)];
}

export function createQualityTuner(options: {
  /** How often sample() is called (the desktop viewer: 500, the web viewer: 1500). */
  sampleMs: number;
  memory: QualityMemory;
  start: QualityTier;
  /** Read on every sample: the host announces its tiers after the tuner exists. */
  lowTiers: () => boolean;
}): QualityTuner {
  const { sampleMs, memory } = options;
  const upshiftSamples = Math.max(2, Math.round(UPSHIFT_STREAK_MS / sampleMs));
  // Two samples in a row, but never less than a second of evidence.
  const downshiftSamples = Math.max(2, Math.round(1000 / sampleMs));
  let current: QualityTier = options.start;
  let baselineRttMs = 0;
  let lastRttMs = 0;
  let upshiftStreak = 0;
  let downshiftStreak = 0;
  let lastDownshiftAt = Number.NEGATIVE_INFINITY;
  let lastUncleanAt = 0;

  const sample = (input: TunerSample): TunerDecision => {
    const { now, lossPct } = input;
    // The browser refreshes the candidate-pair round trip only every few
    // seconds; a sample without one keeps the last reading.
    if (input.rttMs > 0) {
      lastRttMs = input.rttMs;
      baselineRttMs = baselineRttMs > 0 ? Math.min(baselineRttMs, input.rttMs) : input.rttMs;
    }
    const rttMs = lastRttMs;
    const delayExcessMs = baselineRttMs > 0 ? Math.max(0, rttMs - baselineRttMs) : 0;
    const floorRank = options.lowTiers() ? 0 : QUALITY_RANK[LEGACY_FLOOR];
    const currentRank = QUALITY_RANK[current];

    const severe = lossPct >= LOSS_SEVERE_PCT || delayExcessMs >= DELAY_SEVERE_MS;
    const congested = severe || lossPct >= LOSS_CONGESTED_PCT || delayExcessMs >= DELAY_CONGESTED_MS;
    const moderate = congested || lossPct >= LOSS_MODERATE_PCT || delayExcessMs >= DELAY_MODERATE_MS;
    const reason: TunerDecision['reason'] = lossPct >= LOSS_CONGESTED_PCT ? 'loss-high'
      : delayExcessMs >= DELAY_CONGESTED_MS ? 'delay-high'
        : lossPct >= LOSS_MODERATE_PCT ? 'loss-moderate'
          : delayExcessMs >= DELAY_MODERATE_MS ? 'delay-moderate'
            : 'healthy';
    if (moderate || lossPct >= 0.5) lastUncleanAt = now;
    if (congested) memory.lastCongestionAt = now;

    // Long-haul ceiling: past ~180ms the top tier only deepens the queue on the
    // bottleneck. The baseline is the session MINIMUM, so on a path that sits
    // right at the line (field log: 177-191ms) it alone would slip under 180
    // and open the top tier; the live reading decides, with the baseline as a
    // margin so one fast sample does not flip it either.
    const longHaul = rttMs >= 180 || baselineRttMs >= 160;
    const ceilingActive = memory.ceilingUntil > now;
    const ceilingRank = Math.max(floorRank, Math.min(
      longHaul ? QUALITY_RANK.sharp : QUALITY_RANK.ultra,
      ceilingActive ? memory.ceilingRank : QUALITY_RANK.ultra,
    ));
    const targetRank = congested ? floorRank
      : moderate ? Math.min(currentRank, Math.max(floorRank, QUALITY_RANK.balanced))
        : ceilingRank;

    let nextRank = currentRank;
    const settling = now - lastDownshiftAt < DOWNSHIFT_SETTLE_MS;
    if (targetRank < currentRank) {
      upshiftStreak = 0;
      downshiftStreak++;
      if (!settling && (severe || downshiftStreak >= downshiftSamples)) {
        if (severe) {
          // From the upper tiers straight to 'smooth' (as before); from there
          // on, two tiers at a time while it stays this bad.
          nextRank = Math.max(floorRank, Math.min(currentRank - 2, QUALITY_RANK.smooth));
        } else {
          nextRank = Math.max(currentRank - 1, targetRank);
        }
        downshiftStreak = 0;
      }
    } else if (targetRank > currentRank) {
      downshiftStreak = 0;
      const clean = !input.stalled && !moderate
        && (lastUncleanAt === 0 || now - lastUncleanAt >= CLEAN_BEFORE_UPSHIFT_MS);
      upshiftStreak = clean ? upshiftStreak + 1 : 0;
      if (upshiftStreak >= upshiftSamples) {
        nextRank = currentRank + 1;
        upshiftStreak = 0;
      }
    } else {
      upshiftStreak = 0;
      downshiftStreak = 0;
    }

    if (nextRank < currentRank) {
      lastDownshiftAt = now;
      if (congested) {
        // The tier that just failed is off limits for a while. Without this the
        // tuner climbs straight back the moment the queue has drained, floods
        // the link again, and the session breathes in and out of freezes.
        // Several steps down within one episode are one strike, not several.
        const sameEpisode = memory.strikes > 0 && now - memory.lastStrikeAt < STRIKE_EPISODE_MS;
        if (!sameEpisode) {
          const repeat = memory.strikes > 0 && now - memory.ceilingUntil < STRIKE_MEMORY_MS;
          memory.strikes = repeat ? memory.strikes + 1 : 1;
        }
        memory.lastStrikeAt = now;
        const hold = Math.min(CEILING_HOLD_MAX_MS, CEILING_HOLD_MS * 2 ** (memory.strikes - 1));
        memory.ceilingRank = Math.max(nextRank, currentRank - 1);
        memory.ceilingUntil = now + hold;
      }
    }

    const next = QUALITY_ORDER[nextRank];
    const changed = next !== current;
    current = next;
    return { next, changed, reason, target: QUALITY_ORDER[targetRank], baselineRttMs, delayExcessMs };
  };

  return {
    get current() { return current; },
    sample,
    force(tier: QualityTier, now: number) {
      current = tier;
      upshiftStreak = 0;
      downshiftStreak = 0;
      lastDownshiftAt = now;
    },
  };
}

// ---------------------------------------------------------------------------
// Lossy links
//
// The tuner above answers congestion: a link that is FULL loses packets and
// its round trip grows, and sending less cures it. A link that is merely LOSSY
// (Wi-Fi, a long mobile hop) drops the same share of packets whatever is sent,
// with a flat round trip. Stepping the quality down on such a link only makes
// the picture blurrier; the loss stays where it was (field log, Oct 5 2026:
// 9% at 1.5 Mbps and 7% at 200 kbps on the same link).
//
// Two more facts from that log shaped this guard:
//   - The browser's packetsLost is NET of resends. On a link dropping one
//     packet in ten every hole is refilled a round trip later, the counter
//     stays flat, and the link reads as "0% loss" while whole frames wait on
//     resends. The resend requests (nackCount) are the loss the link really
//     has.
//   - A lost packet comes back one round trip after it is asked for. A playout
//     buffer shorter than that shows every damaged frame late; one a little
//     longer hides the resends completely.
//
// So on a lossy link the guard (a) reports the real loss, (b) asks for a
// buffer that covers a resend, and (c) stops the tuner's descent at a floor
// that keeps text readable. The floor starts high and gives way one level at a
// time only if the decoder is actually failing there (it sends a PLI when it
// cannot go on without a new keyframe).
// ---------------------------------------------------------------------------

export interface LossyLinkSample {
  now: number;
  rttMs: number;
  /** Loss from packetsLost over the interval, percent. */
  netLossPct: number;
  /** Resend requests over the interval as a share of packets, percent. */
  rawLossPct: number;
  /** Keyframe requests the decoder sent in the interval. */
  pliDelta: number;
  /** Tier the stream is on now. */
  current: QualityTier;
}

export interface LossyLinkAdvice {
  /** Loss to show and log. */
  lossPct: number;
  /** Loss to feed the tuner (held low while the floor is doing its job). */
  tunerLossPct: number;
  /** Lowest tier the tuner may choose right now, or null on a normal link. */
  floor: QualityTier | null;
  /** Playout buffer to ask for, or null to keep the normal low-latency one. */
  jitterTargetMs: number | null;
  /** Set when the floor just gave way: move the stream to this tier now. */
  forceTier: QualityTier | null;
  lossy: boolean;
}

export interface LossyLinkGuard {
  readonly floor: QualityTier;
  sample(input: LossyLinkSample): LossyLinkAdvice;
}

const LOSSY_STEP_DOWN: Partial<Record<QualityTier, QualityTier>> = {
  ultra: 'sharp',
  sharp: 'balanced',
  balanced: 'smooth',
  smooth: 'lite',
};

export function createLossyLinkGuard(startFloor: QualityTier = 'sharp'): LossyLinkGuard {
  let floor: QualityTier = startFloor;
  let lowestRttMs = 0;
  let lossyUntil = 0;
  let pliHits = 0;
  return {
    get floor() { return floor; },
    sample({ now, rttMs, netLossPct, rawLossPct, pliDelta, current }) {
      if (rttMs > 0) lowestRttMs = lowestRttMs ? Math.min(lowestRttMs, rttMs) : rttMs;
      // Loss comes in bursts; one lossy sample keeps the link "lossy" for a
      // minute so the buffer does not grow and shrink with every sample.
      if (rawLossPct >= 2) lossyUntil = now + 60_000;
      const lossy = now < lossyUntil && rttMs > 0;
      const linkNotFull = netLossPct < 1.5 && rttMs - lowestRttMs < 100;
      const lossPct = Math.round(Math.max(netLossPct, Math.min(rawLossPct, 25)) * 10) / 10;

      let forceTier: QualityTier | null = null;
      pliHits = pliDelta > 0 ? pliHits + 1 : Math.max(0, pliHits - 0.25);
      const next = LOSSY_STEP_DOWN[floor];
      if (lossy && pliHits >= 2 && next && QUALITY_RANK[current] <= QUALITY_RANK[floor]) {
        floor = next;
        pliHits = 0;
        if (QUALITY_RANK[current] > QUALITY_RANK[floor]) forceTier = floor;
      }

      const guarding = lossy && linkNotFull;
      const atOrBelowFloor = QUALITY_RANK[current] <= QUALITY_RANK[floor];
      return {
        lossPct,
        tunerLossPct: guarding && atOrBelowFloor ? Math.min(lossPct, 1.4) : lossPct,
        floor: guarding ? floor : null,
        jitterTargetMs: lossy ? Math.round(Math.min(600, rttMs * 1.5 + 60)) : null,
        forceTier,
        lossy,
      };
    },
  };
}
