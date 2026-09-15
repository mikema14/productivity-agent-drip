/**
 * A soft two-note chime for the escalation moment.
 *
 * Synthesised rather than shipped as an asset: no file to bundle, and the
 * envelope can be kept deliberately gentle. Silent on arrival — this only ever
 * plays once a finished session has been ignored, so responding promptly means
 * never hearing it.
 */
export function playEscalationChime(): void {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();

    // A perfect fifth, quiet, with a long soft tail.
    const notes: Array<{ freq: number; at: number }> = [
      { freq: 587.33, at: 0 }, // D5
      { freq: 880.0, at: 0.13 } // A5
    ];

    for (const { freq, at } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = ctx.currentTime + at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1);
    }

    window.setTimeout(() => void ctx.close().catch(() => {}), 1400);
  } catch (error) {
    console.error('[Overlay] Chime failed:', error);
  }
}
