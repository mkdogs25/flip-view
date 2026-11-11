/** Small synthesised sound effects (no audio files): paper swishes, soft thumps, marker squeaks. */

interface SoundSettings {
  soundEnabled: boolean;
  soundVolume: number;
}

type AudioCtor = typeof AudioContext;

export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  constructor(private get: () => SoundSettings) {}

  private ready(): { ctx: AudioContext; vol: number } | null {
    const s = this.get();
    if (!s.soundEnabled || s.soundVolume <= 0) return null;
    if (!this.ctx) {
      const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    return { ctx: this.ctx, vol: Math.min(1, s.soundVolume / 100) };
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.06 * w) / 1.06; // brownish, softer than white
        d[i] = w * 0.6 + last * 6;
      }
      this.noise = buf;
    }
    return this.noise;
  }

  /** Filtered noise with an envelope; `sweep` moves the filter frequency over the duration. */
  private burst(opts: { at?: number; dur: number; type: BiquadFilterType; from: number; to?: number; q?: number; peak: number; attack?: number }): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, vol } = r;
    const t0 = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.Q.value = opts.q ?? 0.8;
    filter.frequency.setValueAtTime(opts.from, t0);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
    const gain = ctx.createGain();
    const a = opts.attack ?? opts.dur * 0.3;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(opts.peak * vol, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + opts.dur + 0.05);
  }

  private thump(at: number, freq: number, peak: number, dur = 0.12): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, vol } = r;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak * vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  pageTurn(ms = 900): void {
    const d = Math.max(0.25, ms / 1000);
    this.burst({ dur: d * 0.8, type: "bandpass", from: 1100, to: 3600, q: 0.7, peak: 0.55, attack: d * 0.25 });
    this.burst({ at: d * 0.55, dur: d * 0.3, type: "highpass", from: 2500, peak: 0.12, attack: 0.02 });
    this.thump(d * 0.82, 130, 0.12, 0.09);
  }

  coverOpen(ms = 1250): void {
    const d = ms / 1000;
    this.thump(0.02, 95, 0.22, 0.14);
    this.burst({ at: 0.05, dur: d * 0.75, type: "lowpass", from: 500, to: 1800, q: 0.6, peak: 0.45, attack: d * 0.3 });
    this.burst({ at: d * 0.55, dur: d * 0.25, type: "bandpass", from: 1500, to: 3000, peak: 0.18, attack: 0.03 });
    this.thump(d * 0.85, 110, 0.14, 0.1);
  }

  coverClose(ms = 1100): void {
    const d = ms / 1000;
    this.burst({ dur: d * 0.75, type: "lowpass", from: 1800, to: 500, q: 0.6, peak: 0.4, attack: d * 0.3 });
    this.thump(d * 0.86, 75, 0.3, 0.16);
    this.burst({ at: d * 0.86, dur: 0.1, type: "lowpass", from: 700, peak: 0.25, attack: 0.01 });
  }

  /** Felt-tip squeak whose length follows the highlighted span. */
  marker(chars = 20): void {
    const d = Math.min(0.7, 0.18 + chars * 0.012);
    this.burst({ dur: d, type: "bandpass", from: 2300, to: 2900, q: 9, peak: 0.16, attack: 0.04 });
    this.burst({ dur: d, type: "bandpass", from: 5200, to: 4400, q: 4, peak: 0.05, attack: 0.04 });
  }

  erase(): void {
    this.burst({ dur: 0.22, type: "bandpass", from: 1400, to: 900, q: 1.2, peak: 0.25, attack: 0.03 });
  }

  /** Cap click when picking a pen up (`up`) or putting it down. */
  pen(up: boolean): void {
    this.burst({ dur: 0.05, type: "highpass", from: up ? 3200 : 2200, peak: 0.3, attack: 0.004 });
    this.thump(0.01, up ? 520 : 380, 0.07, 0.05);
  }

  /** A book sliding out of a shelf, and settling onto the desk. */
  shelf(kind: "pull" | "land"): void {
    if (kind === "pull") {
      this.burst({ dur: 0.55, type: "bandpass", from: 500, to: 1500, q: 0.8, peak: 0.34, attack: 0.18 });
      this.thump(0.04, 150, 0.07, 0.08);
    } else {
      this.thump(0, 90, 0.3, 0.16);
      this.burst({ dur: 0.18, type: "lowpass", from: 900, peak: 0.22, attack: 0.01 });
    }
  }

  /** A soft tick for drag-and-drop reorders. */
  tick(): void {
    this.burst({ dur: 0.04, type: "highpass", from: 2600, peak: 0.18, attack: 0.003 });
  }
}
