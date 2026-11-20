export type UiSoundKind = 'card' | 'tab' | 'cta' | 'nav' | 'close' | 'input' | 'tick' | 'open';

export type ProductSoundKind =
  | 'liquid'
  | 'power'
  | 'audio'
  | 'vapor'
  | 'watch'
  | 'light'
  | 'fan'
  | 'universal';

const MUTE_STORAGE_KEY = 'new_chiko_sound_muted_v1';

class UnifiedAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseCache: AudioBuffer | null = null;
  private muted = false;
  private listeners = new Set<(muted: boolean) => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
      } catch {
        this.muted = false;
      }
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(next: boolean): void {
    this.muted = next;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(next ? 0 : 0.92, this.ctx.currentTime, 0.015);
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore storage restrictions
      }
    }
    this.listeners.forEach((fn) => fn(next));
  }

  subscribe(fn: (muted: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private getOrCreateGraph(): { ctx: AudioContext; out: AudioNode } | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtx();
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -14;
        this.compressor.knee.value = 18;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.14;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.92;

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this.noiseCache = null;
      }

      return { ctx: this.ctx, out: this.compressor! };
    } catch {
      return null;
    }
  }

  private getPinkNoise(ctx: AudioContext): AudioBuffer {
    if (this.noiseCache && this.noiseCache.sampleRate === ctx.sampleRate) {
      return this.noiseCache;
    }
    const duration = 2.0;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.22));
    }
    this.noiseCache = buffer;
    return buffer;
  }

  /**
   * Unlocks the shared AudioContext immediately on user interaction.
   */
  unlock(): void {
    const graph = this.getOrCreateGraph();
    if (!graph) return;
    if (graph.ctx.state === 'suspended') {
      void graph.ctx.resume().catch(() => {
        // ignore
      });
    }
  }

  private runWithAudio(fn: (ctx: AudioContext, out: AudioNode, now: number) => void): void {
    if (this.muted) return;
    const graph = this.getOrCreateGraph();
    if (!graph) return;
    const { ctx, out } = graph;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (!this.muted && ctx.state === 'running') {
            fn(ctx, out, ctx.currentTime + 0.005);
          }
        })
        .catch(() => {
          // ignore autoplay block
        });
      return;
    }

    fn(ctx, out, ctx.currentTime + 0.004);
  }

  /**
   * Aesthetic, distinct tactile UI tap sounds for every interaction across the website.
   */
  playUi(kind: UiSoundKind): void {
    this.runWithAudio((ctx, out, now) => {
      switch (kind) {
        case 'card': {
          // Luxury ceramic/glass tactile pop + warm marimba harmonic
          const osc1 = ctx.createOscillator();
          const g1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(290, now);
          osc1.frequency.exponentialRampToValueAtTime(490, now + 0.055);
          g1.gain.setValueAtTime(0.001, now);
          g1.gain.linearRampToValueAtTime(0.24, now + 0.008);
          g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
          osc1.connect(g1);
          g1.connect(out);
          osc1.start(now);
          osc1.stop(now + 0.15);

          const osc2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(880, now + 0.015);
          osc2.frequency.exponentialRampToValueAtTime(1120, now + 0.08);
          g2.gain.setValueAtTime(0.001, now + 0.015);
          g2.gain.linearRampToValueAtTime(0.09, now + 0.025);
          g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
          osc2.connect(g2);
          g2.connect(out);
          osc2.start(now + 0.015);
          osc2.stop(now + 0.14);
          break;
        }

        case 'tab': {
          // Minimalist quartz droplet tick (super satisfying for category & filter tabs)
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(680, now);
          osc.frequency.exponentialRampToValueAtTime(980, now + 0.045);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.18, now + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
          osc.connect(g);
          g.connect(out);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'cta': {
          // Velvety dual-harmonic glass chime for primary actions
          [523.25, 783.99].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const start = now + idx * 0.038;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            g.gain.setValueAtTime(0.001, start);
            g.gain.linearRampToValueAtTime(0.18 - idx * 0.03, start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
            osc.connect(g);
            g.connect(out);
            osc.start(start);
            osc.stop(start + 0.26);
          });
          break;
        }

        case 'nav': {
          // Soft airy wooden/bamboo mechanical detent click
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(480, now);
          osc.frequency.exponentialRampToValueAtTime(340, now + 0.042);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.2, now + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.068);
          osc.connect(g);
          g.connect(out);
          osc.start(now);
          osc.stop(now + 0.075);
          break;
        }

        case 'close': {
          // Gentle descending velvet dismiss tap
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(560, now);
          osc.frequency.exponentialRampToValueAtTime(290, now + 0.075);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.16, now + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
          osc.connect(g);
          g.connect(out);
          osc.start(now);
          osc.stop(now + 0.11);
          break;
        }

        case 'input': {
          // Crisp low-profile mechanical key switch whisper
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1180, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 0.022);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.11, now + 0.003);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
          osc.connect(g);
          g.connect(out);
          osc.start(now);
          osc.stop(now + 0.036);
          break;
        }

        case 'open': {
          // Soft studio air bloom for opening panels/modals
          const noise = ctx.createBufferSource();
          noise.buffer = this.getPinkNoise(ctx);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(600, now);
          bp.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
          bp.Q.value = 1.6;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.14, now + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
          noise.connect(bp);
          bp.connect(g);
          g.connect(out);
          noise.start(now);
          noise.stop(now + 0.2);
          break;
        }

        default: {
          // Swiss horology crown micro-detent tick
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1320, now);
          osc.frequency.exponentialRampToValueAtTime(680, now + 0.024);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.14, now + 0.003);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
          osc.connect(g);
          g.connect(out);
          osc.start(now);
          osc.stop(now + 0.042);
          break;
        }
      }
    });
  }

  /**
   * Tap 1 Product Reveal Sound — lush studio cinema wake-up whoosh + warm bell shimmer.
   */
  playProductReveal(): void {
    this.runWithAudio((ctx, out, now) => {
      const noise = ctx.createBufferSource();
      noise.buffer = this.getPinkNoise(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(380, now);
      filter.frequency.exponentialRampToValueAtTime(1650, now + 0.22);
      filter.frequency.exponentialRampToValueAtTime(620, now + 0.44);
      filter.Q.value = 1.25;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.28, now + 0.1);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(out);
      noise.start(now);
      noise.stop(now + 0.48);

      [587.33, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const start = now + 0.04 + i * 0.055;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.001, start);
        g.gain.linearRampToValueAtTime(0.16, start + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        osc.connect(g);
        g.connect(out);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    });
  }

  /**
   * Tap 2 Product Action Foley — mastered for BOTH phone/laptop speakers and headphones.
   */
  playProductAction(kind: ProductSoundKind): void {
    this.runWithAudio((ctx, out, now) => {
      switch (kind) {
        case 'audio': {
          // Loud, unmistakable Bluetooth Speaker Hi-Fi Soundcheck:
          // Punchy phone-audible 3-beat kick bass (175Hz -> 62Hz + 220Hz warm overtone) + crisp hi-hat + warm synth chord!
          const beats = [0, 0.24, 0.48];
          beats.forEach((offset, idx) => {
            const t = now + offset;
            // Kick body (audible on phones & laptops!)
            const kick = ctx.createOscillator();
            const kGain = ctx.createGain();
            kick.type = 'triangle';
            kick.frequency.setValueAtTime(idx === 2 ? 195 : 168, t);
            kick.frequency.exponentialRampToValueAtTime(64, t + 0.14);
            kGain.gain.setValueAtTime(0.001, t);
            kGain.gain.linearRampToValueAtTime(0.58, t + 0.01);
            kGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
            kick.connect(kGain);
            kGain.connect(out);
            kick.start(t);
            kick.stop(t + 0.26);

            // Warm sub layer for headphones / bass speakers
            const sub = ctx.createOscillator();
            const sGain = ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(98, t);
            sub.frequency.exponentialRampToValueAtTime(48, t + 0.18);
            sGain.gain.setValueAtTime(0.001, t);
            sGain.gain.linearRampToValueAtTime(0.45, t + 0.014);
            sGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.23);
            sub.connect(sGain);
            sGain.connect(out);
            sub.start(t);
            sub.stop(t + 0.25);

            // Crisp hi-hat acoustic snap on beat 2 & 3
            if (idx > 0) {
              const hat = ctx.createBufferSource();
              hat.buffer = this.getPinkNoise(ctx);
              const hp = ctx.createBiquadFilter();
              hp.type = 'highpass';
              hp.frequency.value = 5200;
              const hGain = ctx.createGain();
              hGain.gain.setValueAtTime(0.001, t + 0.11);
              hGain.gain.linearRampToValueAtTime(0.22, t + 0.116);
              hGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
              hat.connect(hp);
              hp.connect(hGain);
              hGain.connect(out);
              hat.start(t + 0.11);
              hat.stop(t + 0.2);
            }
          });

          // Lush Bluetooth Speaker Hi-Fi stereo chord bloom (C4 + G4 + B4 + E5)
          [261.63, 392.0, 493.88, 659.25].forEach((freq, i) => {
            const pad = ctx.createOscillator();
            const lp = ctx.createBiquadFilter();
            const pGain = ctx.createGain();
            pad.type = i % 2 === 0 ? 'triangle' : 'sine';
            pad.frequency.setValueAtTime(freq, now + 0.04);
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(2200, now + 0.04);
            lp.frequency.exponentialRampToValueAtTime(750, now + 0.9);
            pGain.gain.setValueAtTime(0.001, now + 0.04);
            pGain.gain.linearRampToValueAtTime(0.14, now + 0.12);
            pGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.92);
            pad.connect(lp);
            lp.connect(pGain);
            pGain.connect(out);
            pad.start(now + 0.04);
            pad.stop(now + 0.95);
          });
          break;
        }

        case 'vapor': {
          // Authentic vape pod coil warmth crackle + silky airy vapor puff exhale
          const noise = ctx.createBufferSource();
          noise.buffer = this.getPinkNoise(ctx);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(920, now);
          bp.frequency.exponentialRampToValueAtTime(2600, now + 0.34);
          bp.frequency.exponentialRampToValueAtTime(720, now + 1.25);
          bp.Q.value = 0.72;

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.46, now + 0.16);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 1.28);
          noise.connect(bp);
          bp.connect(g);
          g.connect(out);
          noise.start(now);
          noise.stop(now + 1.32);

          // Micro mesh-coil warm crackle pops
          [0.04, 0.09, 0.16, 0.23].forEach((dt) => {
            const pop = ctx.createOscillator();
            const pg = ctx.createGain();
            pop.type = 'triangle';
            pop.frequency.setValueAtTime(2400 + Math.random() * 1400, now + dt);
            pop.frequency.exponentialRampToValueAtTime(600, now + dt + 0.014);
            pg.gain.setValueAtTime(0.14, now + dt);
            pg.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.018);
            pop.connect(pg);
            pg.connect(out);
            pop.start(now + dt);
            pop.stop(now + dt + 0.02);
          });
          break;
        }

        case 'liquid': {
          // Crisp refreshing water splash + resonant sparkling droplets
          const noise = ctx.createBufferSource();
          noise.buffer = this.getPinkNoise(ctx);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1450, now);
          bp.frequency.exponentialRampToValueAtTime(3400, now + 0.15);
          bp.frequency.exponentialRampToValueAtTime(950, now + 0.75);
          bp.Q.value = 0.95;

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.48, now + 0.035);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.76);
          noise.connect(bp);
          bp.connect(gain);
          gain.connect(out);
          noise.start(now);
          noise.stop(now + 0.78);

          [0.03, 0.1, 0.18, 0.27, 0.37, 0.47].forEach((dt, idx) => {
            const osc = ctx.createOscillator();
            const dg = ctx.createGain();
            const f0 = 680 + idx * 140 + Math.random() * 140;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f0, now + dt);
            osc.frequency.exponentialRampToValueAtTime(f0 * 1.65, now + dt + 0.08);
            dg.gain.setValueAtTime(0.001, now + dt);
            dg.gain.linearRampToValueAtTime(0.22, now + dt + 0.012);
            dg.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.11);
            osc.connect(dg);
            dg.connect(out);
            osc.start(now + dt);
            osc.stop(now + dt + 0.12);
          });
          break;
        }

        case 'power': {
          // Flagship Super-Fast Charge ascending crystalline triad chime
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const start = now + i * 0.068;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            g.gain.setValueAtTime(0.001, start);
            g.gain.linearRampToValueAtTime(0.24, start + 0.016);
            g.gain.exponentialRampToValueAtTime(0.0001, start + 0.48);
            osc.connect(g);
            g.connect(out);
            osc.start(start);
            osc.stop(start + 0.5);
          });
          break;
        }

        case 'watch': {
          // Authentic Swiss mechanical escapement rhythm + crystalline sapphire chime
          [0, 0.125, 0.25, 0.375, 0.5].forEach((offset, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(i % 2 === 0 ? 2450 : 1920, now + offset);
            g.gain.setValueAtTime(0.001, now + offset);
            g.gain.linearRampToValueAtTime(0.22, now + offset + 0.003);
            g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.032);
            osc.connect(g);
            g.connect(out);
            osc.start(now + offset);
            osc.stop(now + offset + 0.036);
          });

          [1046.5, 1567.98].forEach((freq, i) => {
            const chime = ctx.createOscillator();
            const cg = ctx.createGain();
            const start = now + 0.06 + i * 0.06;
            chime.type = 'sine';
            chime.frequency.setValueAtTime(freq, start);
            cg.gain.setValueAtTime(0.001, start);
            cg.gain.linearRampToValueAtTime(0.16, start + 0.02);
            cg.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);
            chime.connect(cg);
            cg.connect(out);
            chime.start(start);
            chime.stop(start + 0.75);
          });
          break;
        }

        case 'light': {
          // Crisp anodized switch snap + warm radiant studio chord
          const click = ctx.createOscillator();
          const cg = ctx.createGain();
          click.type = 'square';
          click.frequency.setValueAtTime(1850, now);
          click.frequency.exponentialRampToValueAtTime(320, now + 0.024);
          cg.gain.setValueAtTime(0.24, now);
          cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
          click.connect(cg);
          cg.connect(out);
          click.start(now);
          click.stop(now + 0.035);

          [440, 659.25].forEach((freq) => {
            const glow = ctx.createOscillator();
            const gg = ctx.createGain();
            glow.type = 'sine';
            glow.frequency.setValueAtTime(freq, now + 0.025);
            gg.gain.setValueAtTime(0.001, now + 0.025);
            gg.gain.linearRampToValueAtTime(0.15, now + 0.14);
            gg.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
            glow.connect(gg);
            gg.connect(out);
            glow.start(now + 0.025);
            glow.stop(now + 0.68);
          });
          break;
        }

        case 'fan': {
          // Realistic turbine spin-up + smooth refreshing breeze whoosh
          const noise = ctx.createBufferSource();
          noise.buffer = this.getPinkNoise(ctx);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(420, now);
          bp.frequency.exponentialRampToValueAtTime(1450, now + 0.35);
          bp.frequency.exponentialRampToValueAtTime(520, now + 1.05);
          bp.Q.value = 1.05;

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.42, now + 0.18);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 1.08);
          noise.connect(bp);
          bp.connect(g);
          g.connect(out);
          noise.start(now);
          noise.stop(now + 1.12);
          break;
        }

        default: {
          // Crisp luxury DSLR shutter + glass sparkle
          const noise = ctx.createBufferSource();
          noise.buffer = this.getPinkNoise(ctx);
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 1350;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.32, now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
          noise.connect(hp);
          hp.connect(g);
          g.connect(out);
          noise.start(now);
          noise.stop(now + 0.18);

          const sparkle = ctx.createOscillator();
          const sg = ctx.createGain();
          sparkle.type = 'sine';
          sparkle.frequency.setValueAtTime(987.77, now + 0.03);
          sg.gain.setValueAtTime(0.001, now + 0.03);
          sg.gain.linearRampToValueAtTime(0.14, now + 0.045);
          sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
          sparkle.connect(sg);
          sg.connect(out);
          sparkle.start(now + 0.03);
          sparkle.stop(now + 0.35);
          break;
        }
      }
    });
  }
  /**
   * Distinct luxurious cash-register / double-bell alert chime when a new customer order arrives in Admin Mode.
   */
  playOrderAlert(): void {
    this.runWithAudio((ctx, out, now) => {
      const notes = [
        { freq: 880, offset: 0, dur: 0.24, vol: 0.24 },
        { freq: 1174.66, offset: 0.11, dur: 0.28, vol: 0.26 },
        { freq: 1567.98, offset: 0.22, dur: 0.45, vol: 0.28 },
      ];
      notes.forEach(({ freq, offset, dur, vol }) => {
        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const g = ctx.createGain();
        const og = ctx.createGain();
        const t = now + offset;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        og.gain.setValueAtTime(0.001, t);
        og.gain.linearRampToValueAtTime(vol * 0.28, t + 0.008);
        og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
        osc.connect(g);
        overtone.connect(og);
        g.connect(out);
        og.connect(out);
        osc.start(t);
        overtone.start(t);
        osc.stop(t + dur + 0.02);
        overtone.stop(t + dur + 0.02);
      });
    });
  }
}

export const unifiedAudio = new UnifiedAudioEngine();

export function playUiSound(kind: UiSoundKind): void {
  unifiedAudio.playUi(kind);
}

export function playProductRevealSound(): void {
  unifiedAudio.playProductReveal();
}

export function playProductActionSound(kind: ProductSoundKind): void {
  unifiedAudio.playProductAction(kind);
}

export function playOrderAlertChime(): void {
  unifiedAudio.playOrderAlert();
}

export function isGlobalSoundMuted(): boolean {
  return unifiedAudio.isMuted();
}

export function setGlobalSoundMuted(muted: boolean): void {
  unifiedAudio.setMuted(muted);
}

export function subscribeSoundMute(cb: (muted: boolean) => void): () => void {
  return unifiedAudio.subscribe(cb);
}

function classifyTappedElement(target: HTMLElement): UiSoundKind | 'none' | null {
  // Respect explicit opt-out (e.g. inside InteractiveProductStage which plays its own rich foley)
  const explicit = target.closest<HTMLElement>('[data-sound]');
  if (explicit) {
    const val = explicit.getAttribute('data-sound');
    if (val === 'none') return 'none';
    if (
      val === 'card' ||
      val === 'tab' ||
      val === 'cta' ||
      val === 'nav' ||
      val === 'close' ||
      val === 'input' ||
      val === 'tick' ||
      val === 'open'
    ) {
      return val;
    }
  }

  // Product card tap
  if (target.closest('article')) {
    return 'card';
  }

  // Interactive button or link
  const btn = target.closest<HTMLElement>('button, a, [role="button"], [role="tab"]');
  if (btn) {
    const label = `${btn.getAttribute('aria-label') || ''} ${btn.textContent || ''}`.toLowerCase();
    const cls = typeof btn.className === 'string' ? btn.className : '';

    if (/\b(close|cancel|clear|reset|remove|delete|logout|back|photo)\b/.test(label)) {
      return 'close';
    }
    if (btn.closest('nav') || btn.closest('header')) {
      if (cls.includes('bg-[#09090B]') || cls.includes('bg-zinc-900')) {
        return 'cta';
      }
      return 'nav';
    }
    if (cls.includes('bg-[#09090B]') || cls.includes('bg-zinc-900')) {
      return 'cta';
    }
    if (/\b(all|watches|earbuds|power|speakers|chargers|neckbands|gadgets|filter)\b/.test(label)) {
      return 'tab';
    }
    return 'tick';
  }

  // Search / form inputs & selects
  const field = target.closest('input, select, textarea');
  if (field) {
    return 'input';
  }

  return null;
}

/**
 * Attaches global aesthetic tactile tap sounds across the entire website
 * AND unlocks the shared Web Audio engine on the very first touch/click gesture.
 */
export function attachGlobalAestheticTapSounds(): () => void {
  if (typeof window === 'undefined') return () => {};

  let lastSoundAt = 0;

  const handlePointerDown = (e: PointerEvent) => {
    // Always unlock Web Audio immediately on any pointerdown gesture
    unifiedAudio.unlock();

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const now = performance.now();
    if (now - lastSoundAt < 45) return;

    const soundKind = classifyTappedElement(target);
    if (!soundKind || soundKind === 'none') return;

    lastSoundAt = now;
    unifiedAudio.playUi(soundKind);
  };

  window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
  return () => {
    window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  };
}
