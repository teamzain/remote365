// Short synthesised UI cues (no audio assets to ship). Same tones and the same
// opt-out key as the desktop app's playUISound so both feel alike.

const TONES: Record<'connect' | 'toggle', { freq: number[]; dur: number }> = {
  connect: { freq: [523, 659], dur: 0.12 },
  toggle: { freq: [880], dur: 0.08 },
};

export function playUISound(type: keyof typeof TONES = 'connect') {
  try {
    if (localStorage.getItem('pref_sound_enabled') === 'false') return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Browsers keep a context suspended until the page has seen a user
    // gesture; a silent no-op then is the right outcome, not an error.
    if (ctx.state === 'suspended') { ctx.close?.(); return; }
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    const c = TONES[type];
    o.type = 'sine';
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + c.dur * c.freq.length);
    c.freq.forEach((f, i) => o.frequency.setValueAtTime(f, ctx.currentTime + i * c.dur));
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + c.dur * c.freq.length + 0.05);
    o.onended = () => { ctx.close?.(); };
  } catch { /* audio is best-effort */ }
}
