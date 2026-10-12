import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createQualityMemory, createQualityTuner, hostSupportsLowTiers, initialTier, QUALITY_ORDER,
} from './streamQualityTuner.ts';

const SAMPLE_MS = 500;
function run(tuner, from, samples, input) {
  let now = from;
  let last;
  const changes = [];
  for (let i = 0; i < samples; i++) {
    now += SAMPLE_MS;
    last = tuner.sample({ now, ...input });
    if (last.changed) changes.push(last.next);
  }
  return { now, last, changes };
}
const make = (start = 'balanced', lowTiers = true, memory = createQualityMemory()) =>
  ({ memory, tuner: createQualityTuner({ sampleMs: SAMPLE_MS, memory, start, lowTiers: () => lowTiers }) });

test('delay with 0% loss is congestion: steps down instead of calling it healthy', () => {
  const { tuner } = make('balanced');
  let t = run(tuner, 0, 4, { rttMs: 15, lossPct: 0 }).now;
  // The field case: round trip climbs to seconds while loss stays at zero.
  const r = run(tuner, t, 4, { rttMs: 900, lossPct: 0 });
  assert.equal(r.last.reason, 'delay-high');
  assert.equal(tuner.current, 'smooth');
});

test('seconds of queue drop straight down, then keep going to the lowest tier', () => {
  const { tuner } = make('sharp');
  let t = run(tuner, 0, 2, { rttMs: 15, lossPct: 0 }).now;
  const first = tuner.sample({ now: t + 500, rttMs: 6000, lossPct: 0 });
  assert.equal(first.next, 'smooth');
  const r = run(tuner, t + 500, 40, { rttMs: 6000, lossPct: 0 });
  assert.equal(tuner.current, 'minimal');
  assert.ok(r.changes.length >= 2);
});

test('a steady long-haul round trip is not congestion', () => {
  const { tuner } = make('balanced');
  const r = run(tuner, 0, 200, { rttMs: 320, lossPct: 0 });
  // Climbs to the long-haul ceiling and never drops.
  assert.equal(tuner.current, 'sharp');
  assert.deepEqual(r.changes, ['sharp']);
});

test('never asks an old host for a tier it does not know', () => {
  const { tuner } = make('balanced', false);
  run(tuner, 0, 2, { rttMs: 15, lossPct: 0 });
  run(tuner, 1000, 60, { rttMs: 5000, lossPct: 40 });
  assert.equal(tuner.current, 'smooth');
});

test('does not climb while the round trip is still elevated', () => {
  const { tuner } = make('lite');
  let t = run(tuner, 0, 2, { rttMs: 15, lossPct: 0 }).now;
  const r = run(tuner, t, 200, { rttMs: 400, lossPct: 0 });   // +385ms: moderate
  assert.equal(tuner.current, 'lite');
  assert.deepEqual(r.changes, []);
});

test('the tier that failed stays off limits for minutes, then is retried', () => {
  const { tuner, memory } = make('balanced');
  let t = run(tuner, 0, 2, { rttMs: 15, lossPct: 0 }).now;
  t = run(tuner, t, 4, { rttMs: 900, lossPct: 0 }).now;      // balanced -> smooth
  assert.equal(tuner.current, 'smooth');
  assert.ok(memory.ceilingUntil > t);
  // Two clean minutes: must still be at 'smooth'.
  t = run(tuner, t, 240, { rttMs: 15, lossPct: 0 }).now;
  assert.equal(tuner.current, 'smooth');
  // Past the hold it climbs again, one tier at a time.
  t = run(tuner, t, 200, { rttMs: 15, lossPct: 0 }).now;
  assert.ok(QUALITY_ORDER.indexOf(tuner.current) > QUALITY_ORDER.indexOf('smooth'));
});

test('failing again soon after doubles the hold; one episode counts once', () => {
  const { tuner, memory } = make('balanced');
  let t = run(tuner, 0, 2, { rttMs: 15, lossPct: 0 }).now;
  t = run(tuner, t, 40, { rttMs: 6000, lossPct: 0 }).now;    // all the way down, one episode
  assert.equal(memory.strikes, 1);
  const firstHold = memory.ceilingUntil - memory.lastStrikeAt;
  t = run(tuner, t, 2 * 60 * 5, { rttMs: 15, lossPct: 0 }).now; // 5 clean minutes
  t = run(tuner, t, 10, { rttMs: 6000, lossPct: 0 }).now;
  assert.equal(memory.strikes, 2);
  assert.equal(memory.ceilingUntil - memory.lastStrikeAt, firstHold * 2);
});

test('a reconnect right after congestion starts at the remembered tier', () => {
  const { tuner, memory } = make('balanced');
  let t = run(tuner, 0, 2, { rttMs: 15, lossPct: 0 }).now;
  t = run(tuner, t, 40, { rttMs: 6000, lossPct: 0 }).now;
  // A two-tier drop leaves the tier in between open to retry.
  assert.equal(tuner.current, 'minimal');
  assert.equal(initialTier(memory, t, true), QUALITY_ORDER[memory.ceilingRank]);
  assert.ok(memory.ceilingRank <= 1);
  assert.equal(initialTier(memory, t, false), 'smooth');
  assert.equal(initialTier(createQualityMemory(), t, true), 'balanced');
  assert.equal(initialTier(memory, t + 60 * 60 * 1000, true), 'balanced');
});

test('loss behaviour is unchanged: moderate loss rests at balanced, a stalled sample never climbs', () => {
  const a = make('ultra');
  run(a.tuner, 0, 2, { rttMs: 15, lossPct: 0 });
  run(a.tuner, 1000, 20, { rttMs: 15, lossPct: 2 });
  assert.equal(a.tuner.current, 'balanced');
  const b = make('smooth');
  run(b.tuner, 0, 200, { rttMs: 15, lossPct: 0, stalled: true });
  assert.equal(b.tuner.current, 'smooth');
});

test('low tiers are used only when the host lists all of them', () => {
  assert.equal(hostSupportsLowTiers([...QUALITY_ORDER]), true);
  assert.equal(hostSupportsLowTiers(['smooth', 'balanced', 'sharp', 'ultra']), false);
  assert.equal(hostSupportsLowTiers(undefined), false);
});

test('a path sitting right at the long-haul line stays capped at sharp', () => {
  const { tuner } = make('balanced');
  let now = 0;
  // 177-191ms, as measured: the minimum dips under 180 but the path is long-haul.
  const rtts = [182, 181, 191, 186, 180, 185, 177, 183, 192, 186];
  for (let i = 0; i < 400; i++) { now += SAMPLE_MS; tuner.sample({ now, rttMs: rtts[i % rtts.length], lossPct: 0 }); }
  assert.equal(tuner.current, 'sharp');
});

// ---- Lossy links ----------------------------------------------------------
const { createLossyLinkGuard } = await import('./streamQualityTuner.ts');

test('lossy link: resend requests count as loss even when packetsLost is flat', () => {
  const guard = createLossyLinkGuard('sharp');
  const advice = guard.sample({ now: 1000, rttMs: 160, netLossPct: 0, rawLossPct: 9, pliDelta: 0, current: 'ultra' });
  assert.equal(advice.lossPct, 9);
  assert.equal(advice.lossy, true);
  // Above the floor the tuner sees the real loss and steps down.
  assert.equal(advice.tunerLossPct, 9);
  assert.equal(advice.floor, 'sharp');
  // Buffer covers a resend round trip.
  assert.equal(advice.jitterTargetMs, 300);
});

test('lossy link: at the floor the loss is held back from the tuner, and a clean link is left alone', () => {
  const guard = createLossyLinkGuard('sharp');
  const atFloor = guard.sample({ now: 1000, rttMs: 160, netLossPct: 0, rawLossPct: 9, pliDelta: 0, current: 'sharp' });
  assert.equal(atFloor.tunerLossPct, 1.4);
  const clean = createLossyLinkGuard('sharp').sample({ now: 1000, rttMs: 40, netLossPct: 0, rawLossPct: 0.3, pliDelta: 0, current: 'ultra' });
  assert.equal(clean.lossy, false);
  assert.equal(clean.floor, null);
  assert.equal(clean.jitterTargetMs, null);
});

test('lossy link: a full link (growing round trip or unrecovered loss) is not guarded', () => {
  const guard = createLossyLinkGuard('sharp');
  guard.sample({ now: 0, rttMs: 160, netLossPct: 0, rawLossPct: 9, pliDelta: 0, current: 'sharp' });
  const queued = guard.sample({ now: 1500, rttMs: 420, netLossPct: 0, rawLossPct: 9, pliDelta: 0, current: 'sharp' });
  assert.equal(queued.floor, null);
  assert.equal(queued.tunerLossPct, 9);
  const dropping = guard.sample({ now: 3000, rttMs: 165, netLossPct: 6, rawLossPct: 9, pliDelta: 0, current: 'sharp' });
  assert.equal(dropping.floor, null);
});

test('lossy link: the floor gives way one level when the decoder keeps asking for keyframes', () => {
  const guard = createLossyLinkGuard('sharp');
  let advice = guard.sample({ now: 0, rttMs: 160, netLossPct: 0, rawLossPct: 9, pliDelta: 1, current: 'sharp' });
  assert.equal(advice.forceTier, null);
  advice = guard.sample({ now: 1500, rttMs: 160, netLossPct: 0, rawLossPct: 9, pliDelta: 1, current: 'sharp' });
  assert.equal(advice.forceTier, 'balanced');
  assert.equal(guard.floor, 'balanced');
});
