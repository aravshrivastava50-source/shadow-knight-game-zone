export class ChronoAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public dispose(): void {
    this.noiseBuffer = null;
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }

  /**
   * Realistic Katana Swing:
   * - Deep low-pass air displacement whoosh (140Hz - 520Hz sweep)
   * - Crisp layered metallic steel ring (980Hz fast decay)
   */
  public playSwordSwing(comboStep: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = comboStep === 3 ? 0.24 : 0.18;

    // 1. Deep Low-Pass Wind Whoosh (140Hz - 520Hz)
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = 2.4;
    const peakFreq = comboStep === 3 ? 520 : comboStep === 2 ? 460 : 410;
    lowpass.frequency.setValueAtTime(140, now);
    lowpass.frequency.exponentialRampToValueAtTime(peakFreq, now + dur * 0.38);
    lowpass.frequency.exponentialRampToValueAtTime(140, now + dur);

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.001, now);
    whooshGain.gain.linearRampToValueAtTime(comboStep === 3 ? 0.38 : 0.28, now + 0.03);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(lowpass);
    lowpass.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur + 0.02);

    // 2. Sharp Metallic Steel Katana Ring (980Hz fast decay + overtone)
    const steelOsc = ctx.createOscillator();
    const steelGain = ctx.createGain();
    steelOsc.type = 'triangle';
    const steelFreq = comboStep === 3 ? 980 : comboStep === 2 ? 1040 : 960;
    steelOsc.frequency.setValueAtTime(steelFreq, now);
    steelOsc.frequency.exponentialRampToValueAtTime(steelFreq * 0.72, now + 0.11);

    steelGain.gain.setValueAtTime(0.001, now);
    steelGain.gain.linearRampToValueAtTime(0.11, now + 0.008);
    steelGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    steelOsc.connect(steelGain);
    steelGain.connect(ctx.destination);
    steelOsc.start(now);
    steelOsc.stop(now + 0.13);

    // Subtle sub-chest weight on 3rd finisher swing
    if (comboStep === 3) {
      const weight = ctx.createOscillator();
      const weightGain = ctx.createGain();
      weight.type = 'sine';
      weight.frequency.setValueAtTime(115, now);
      weight.frequency.exponentialRampToValueAtTime(42, now + 0.18);
      weightGain.gain.setValueAtTime(0.16, now);
      weightGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      weight.connect(weightGain);
      weightGain.connect(ctx.destination);
      weight.start(now);
      weight.stop(now + 0.2);
    }
  }

  /**
   * Heavy Katana Slash Impact:
   * - Sub-bass impact punch (58Hz -> 24Hz drop)
   * - Metallic armor crunch & steel bite
   */
  public playSwordHit(isHeavy = false): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Heavy Sub-Bass Punch (58Hz -> 24Hz)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isHeavy ? 64 : 58, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + (isHeavy ? 0.24 : 0.16));

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(isHeavy ? 0.42 : 0.32, now + 0.008);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.25 : 0.17));

    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.26);

    // 2. Metallic Armor Crunch (bandpass noise transient)
    const crunch = ctx.createBufferSource();
    crunch.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isHeavy ? 1250 : 1650, now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.1);
    bp.Q.value = 1.6;

    const crunchGain = ctx.createGain();
    crunchGain.gain.setValueAtTime(isHeavy ? 0.3 : 0.22, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    crunch.connect(bp);
    bp.connect(crunchGain);
    crunchGain.connect(ctx.destination);
    crunch.start(now);
    crunch.stop(now + 0.12);

    // 3. Sharp Steel Bite Resonance
    const bite = ctx.createOscillator();
    const biteGain = ctx.createGain();
    bite.type = 'sawtooth';
    bite.frequency.setValueAtTime(isHeavy ? 880 : 980, now);
    bite.frequency.exponentialRampToValueAtTime(210, now + 0.08);
    biteGain.gain.setValueAtTime(0.08, now);
    biteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    bite.connect(biteGain);
    biteGain.connect(ctx.destination);
    bite.start(now);
    bite.stop(now + 0.09);
  }

  public playDash(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.16);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.18);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(52, now + 0.15);
    subGain.gain.setValueAtTime(0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.17);
  }

  public playCosmicNova(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Cinematic sub-bass detonation
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.72);
    subGain.gain.setValueAtTime(0.45, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.74);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.76);

    // Steel shockwave wash
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, now);
    lp.frequency.exponentialRampToValueAtTime(120, now + 0.55);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.58);
  }

  public playLightning(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.12);
    bp.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    noise.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.14);
  }

  public playBossSlam(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(84, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.52);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.56);

    const crunch = ctx.createBufferSource();
    crunch.buffer = this.getNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(580, now);
    lp.frequency.exponentialRampToValueAtTime(90, now + 0.42);
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.28, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    crunch.connect(lp);
    lp.connect(cGain);
    cGain.connect(ctx.destination);
    crunch.start(now);
    crunch.stop(now + 0.45);
  }

  public playPlayerHurt(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playVictoryChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [261.63, 329.63, 392.0, 523.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playWaveIncoming(isBossWave = false): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(isBossWave ? 72 : 92, now);
    bass.frequency.exponentialRampToValueAtTime(28, now + 0.65);
    bassGain.gain.setValueAtTime(0.001, now);
    bassGain.gain.linearRampToValueAtTime(isBossWave ? 0.36 : 0.26, now + 0.04);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.start(now);
    bass.stop(now + 0.7);

    const notes = isBossWave ? [196, 185, 174.61] : [293.66, 392.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.28;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  public playWaveClear(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [293.66, 369.99, 440.0, 587.33].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }
}
