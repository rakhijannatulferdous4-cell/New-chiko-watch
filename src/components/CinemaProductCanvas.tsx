import React, { useEffect, useRef } from 'react';
import { ProductActionKind } from '../services/cinemaMotionEngine';

interface CinemaProductCanvasProps {
  actionKind: ProductActionKind;
  active: boolean;
  burstCount: number;
  burstOrigin: { x: number; y: number }; // normalized 0..1
  pointer?: { x: number; y: number; vx: number; vy: number; active: boolean };
}

interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  mist: boolean;
}

interface VaporPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  grow: number;
  life: number;
  maxLife: number;
  swirlPhase: number;
  swirlSpeed: number;
  alpha: number;
  layer: number; // 0 soft cloud, 1 bright backlit wisp
}

interface AcousticWave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  thickness: number;
}

interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  tone: 'warm' | 'cool' | 'emerald' | 'pearl';
}

interface WindRibbon {
  yBase: number;
  progress: number;
  speed: number;
  amp: number;
  freq: number;
  phase: number;
  life: number;
  maxLife: number;
  width: number;
}

interface GlintStar {
  x: number;
  y: number;
  size: number;
  angle: number;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 1200;

export function CinemaProductCanvas({
  actionKind,
  active,
  burstCount,
  burstOrigin,
  pointer,
}: CinemaProductCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dropletsRef = useRef<Droplet[]>([]);
  const vaporsRef = useRef<VaporPuff[]>([]);
  const wavesRef = useRef<AcousticWave[]>([]);
  const motesRef = useRef<DustMote[]>([]);
  const ribbonsRef = useRef<WindRibbon[]>([]);
  const glintsRef = useRef<GlintStar[]>([]);
  const beamIntensityRef = useRef<number>(0);
  const beamOriginRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.42 });
  const lastBurstRef = useRef<number>(0);
  const pointerRef = useRef<{ x: number; y: number; vx: number; vy: number; active: boolean }>({
    x: 0.5,
    y: 0.5,
    vx: 0,
    vy: 0,
    active: false,
  });

  useEffect(() => {
    if (pointer) {
      pointerRef.current = pointer;
    }
  }, [pointer]);

  // Spawn high-density photorealistic bursts on every tap
  useEffect(() => {
    if (!active || burstCount === 0 || burstCount === lastBurstRef.current) return;
    lastBurstRef.current = burstCount;

    const canvas = canvasRef.current;
    const w = canvas ? canvas.clientWidth || 360 : 360;
    const h = canvas ? canvas.clientHeight || 360 : 360;
    const ox = Math.max(0.14, Math.min(0.86, burstOrigin.x)) * w;
    const oy = Math.max(0.14, Math.min(0.86, burstOrigin.y)) * h;
    beamOriginRef.current = { x: burstOrigin.x, y: burstOrigin.y };

    if (actionKind === 'vapor') {
      // Ultra-realistic dense multi-layered backlit silky vape smoke billows (96 puffs + 70 micro-wisp motes)
      for (let i = 0; i < 68; i++) {
        const spread = (Math.random() - 0.5) * 145;
        vaporsRef.current.push({
          x: ox + (Math.random() - 0.5) * 32,
          y: oy + (Math.random() - 0.5) * 18,
          vx: spread * 0.65,
          vy: -(68 + Math.random() * 135),
          r: 18 + Math.random() * 26,
          grow: 46 + Math.random() * 58,
          life: -(Math.random() * 0.24),
          maxLife: 1.7 + Math.random() * 1.45,
          swirlPhase: Math.random() * Math.PI * 2,
          swirlSpeed: 1.6 + Math.random() * 2.2,
          alpha: 0.16 + Math.random() * 0.19,
          layer: i % 3 === 0 ? 1 : 0,
        });
      }
      for (let i = 0; i < 70; i++) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.1;
        const speed = 40 + Math.random() * 140;
        motesRef.current.push({
          x: ox + (Math.random() - 0.5) * 36,
          y: oy + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 35,
          r: 1.4 + Math.random() * 3.1,
          life: 0,
          maxLife: 1.1 + Math.random() * 0.9,
          tone: 'pearl',
        });
      }
    } else if (actionKind === 'liquid') {
      // Crystal water splash cascade: 110 refractive droplets + 48 mist clouds + 3 surface ripples
      for (let i = 0; i < 110; i++) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.55;
        const speed = 135 + Math.random() * 380;
        dropletsRef.current.push({
          x: ox + (Math.random() - 0.5) * 28,
          y: oy + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 80,
          r: 1.8 + Math.random() * 5.6,
          life: 0,
          maxLife: 0.72 + Math.random() * 0.72,
          mist: false,
        });
      }
      for (let i = 0; i < 48; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 155;
        dropletsRef.current.push({
          x: ox + (Math.random() - 0.5) * 38,
          y: oy + (Math.random() - 0.5) * 28,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 65,
          r: 10 + Math.random() * 18,
          life: 0,
          maxLife: 0.7 + Math.random() * 0.55,
          mist: true,
        });
      }
      wavesRef.current.push(
        { x: ox, y: oy, r: 8, maxR: w * 0.48, life: 0, maxLife: 0.72, thickness: 2.8 },
        { x: ox, y: oy, r: 4, maxR: w * 0.36, life: -0.08, maxLife: 0.62, thickness: 1.8 },
        { x: ox, y: oy, r: 2, maxR: w * 0.24, life: -0.15, maxLife: 0.52, thickness: 1.2 }
      );
    } else if (actionKind === 'audio') {
      // 4 staggered sub-bass shockwaves + 90 vibrating sunlit studio motes
      [0, 1, 2, 3].forEach((idx) => {
        wavesRef.current.push({
          x: ox,
          y: oy,
          r: 10 + idx * 14,
          maxR: w * (0.48 + idx * 0.14),
          life: -idx * 0.12,
          maxLife: 0.92,
          thickness: 3.4 - idx * 0.55,
        });
      });
      for (let i = 0; i < 90; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 230;
        motesRef.current.push({
          x: ox,
          y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 1.2 + Math.random() * 3.0,
          life: 0,
          maxLife: 0.85 + Math.random() * 0.65,
          tone: i % 3 === 0 ? 'cool' : 'pearl',
        });
      }
    } else if (actionKind === 'power') {
      // 75 high-speed emerald/ice photon motes streaming toward the fast-charging smartphone card
      const targetX = w * 0.78;
      const targetY = h * 0.84;
      for (let i = 0; i < 75; i++) {
        const t = i / 75;
        motesRef.current.push({
          x: ox + (targetX - ox) * t * 0.22 + (Math.random() - 0.5) * 26,
          y: oy + (targetY - oy) * t * 0.22 + (Math.random() - 0.5) * 26,
          vx: (targetX - ox) * (0.75 + Math.random() * 0.65) + (Math.random() - 0.5) * 55,
          vy: (targetY - oy) * (0.75 + Math.random() * 0.65) + (Math.random() - 0.5) * 55,
          r: 1.4 + Math.random() * 2.8,
          life: -t * 0.45,
          maxLife: 0.72 + Math.random() * 0.42,
          tone: i % 2 === 0 ? 'emerald' : 'cool',
        });
      }
      wavesRef.current.push(
        { x: ox, y: oy, r: 8, maxR: w * 0.36, life: 0, maxLife: 0.65, thickness: 2.2 },
        { x: ox, y: oy, r: 4, maxR: w * 0.26, life: -0.1, maxLife: 0.55, thickness: 1.4 }
      );
    } else if (actionKind === 'watch') {
      // 7 anamorphic diamond sapphire sunburst glints + 70 champagne luxury bokeh motes
      for (let i = 0; i < 7; i++) {
        glintsRef.current.push({
          x: ox + (Math.random() - 0.5) * w * 0.42,
          y: oy + (Math.random() - 0.5) * h * 0.42,
          size: 24 + Math.random() * 40,
          angle: Math.random() * Math.PI * 0.5,
          life: -i * 0.08,
          maxLife: 0.92,
        });
      }
      for (let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 25 + Math.random() * 110;
        motesRef.current.push({
          x: ox + (Math.random() - 0.5) * 44,
          y: oy + (Math.random() - 0.5) * 44,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 22,
          r: 1.4 + Math.random() * 3.2,
          life: 0,
          maxLife: 1.05 + Math.random() * 0.75,
          tone: 'warm',
        });
      }
    } else if (actionKind === 'light') {
      beamIntensityRef.current = 1.0;
      for (let i = 0; i < 85; i++) {
        motesRef.current.push({
          x: ox + (Math.random() - 0.5) * w * 0.7,
          y: oy + (Math.random() - 0.5) * h * 0.7,
          vx: (Math.random() - 0.5) * 32,
          vy: -(14 + Math.random() * 36),
          r: 1.6 + Math.random() * 3.8,
          life: 0,
          maxLife: 1.45 + Math.random() * 0.95,
          tone: 'warm',
        });
      }
    } else if (actionKind === 'fan') {
      for (let i = 0; i < 16; i++) {
        ribbonsRef.current.push({
          yBase: h * (0.14 + (i / 16) * 0.72),
          progress: -0.25 - i * 0.06,
          speed: 1.2 + Math.random() * 0.65,
          amp: 12 + Math.random() * 20,
          freq: 0.015 + Math.random() * 0.012,
          phase: Math.random() * Math.PI * 2,
          life: 0,
          maxLife: 1.55,
          width: 1.4 + Math.random() * 2.4,
        });
      }
      for (let i = 0; i < 65; i++) {
        motesRef.current.push({
          x: Math.random() * w * 0.3,
          y: Math.random() * h,
          vx: 160 + Math.random() * 220,
          vy: (Math.random() - 0.5) * 45,
          r: 1.2 + Math.random() * 2.4,
          life: 0,
          maxLife: 0.9 + Math.random() * 0.6,
          tone: 'cool',
        });
      }
    } else {
      for (let i = 0; i < 4; i++) {
        glintsRef.current.push({
          x: ox + (Math.random() - 0.5) * 64,
          y: oy + (Math.random() - 0.5) * 64,
          size: 28 + Math.random() * 30,
          angle: 0.25 + i * 0.35,
          life: -i * 0.08,
          maxLife: 0.85,
        });
      }
      for (let i = 0; i < 64; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 125;
        motesRef.current.push({
          x: ox,
          y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 18,
          r: 1.4 + Math.random() * 3.1,
          life: 0,
          maxLife: 0.95 + Math.random() * 0.6,
          tone: 'warm',
        });
      }
    }

    // Cap particle arrays cleanly for silky 60fps across all devices
    if (dropletsRef.current.length > MAX_PARTICLES / 2) {
      dropletsRef.current = dropletsRef.current.slice(-MAX_PARTICLES / 2);
    }
    if (vaporsRef.current.length > 260) {
      vaporsRef.current = vaporsRef.current.slice(-260);
    }
    if (motesRef.current.length > 420) {
      motesRef.current = motesRef.current.slice(-420);
    }
  }, [actionKind, active, burstCount, burstOrigin]);

  useEffect(() => {
    if (!active) {
      dropletsRef.current = [];
      vaporsRef.current = [];
      wavesRef.current = [];
      motesRef.current = [];
      ribbonsRef.current = [];
      glintsRef.current = [];
      beamIntensityRef.current = 0;
      lastBurstRef.current = 0;
    }
  }, [active, actionKind]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let ambientTimer = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth || 360;
      const ch = canvas.clientHeight || 360;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;
      ambientTimer += dt;

      const w = canvas.clientWidth || 360;
      const h = canvas.clientHeight || 360;
      ctx.clearRect(0, 0, w, h);

      const ptr = pointerRef.current;
      const ptrX = ptr.x * w;
      const ptrY = ptr.y * h;

      // Living ambient studio atmosphere (especially continuous silky vapor wisp for vapes!)
      if (ambientTimer > 0.16) {
        ambientTimer = 0;
        if (actionKind === 'vapor' && vaporsRef.current.length < 44) {
          vaporsRef.current.push({
            x: w * (0.42 + Math.random() * 0.16),
            y: h * (0.36 + Math.random() * 0.16),
            vx: (Math.random() - 0.5) * 24,
            vy: -(32 + Math.random() * 38),
            r: 18 + Math.random() * 18,
            grow: 34,
            life: 0,
            maxLife: 2.1,
            swirlPhase: Math.random() * Math.PI * 2,
            swirlSpeed: 1.8,
            alpha: 0.15,
            layer: Math.random() > 0.5 ? 1 : 0,
          });
        } else if (actionKind === 'fan' && ribbonsRef.current.length < 7) {
          ribbonsRef.current.push({
            yBase: h * (0.18 + Math.random() * 0.64),
            progress: -0.18,
            speed: 0.88 + Math.random() * 0.38,
            amp: 10 + Math.random() * 10,
            freq: 0.016,
            phase: Math.random() * Math.PI * 2,
            life: 0,
            maxLife: 1.65,
            width: 1.5,
          });
        } else if (motesRef.current.length < 28) {
          motesRef.current.push({
            x: w * (0.12 + Math.random() * 0.76),
            y: h * (0.18 + Math.random() * 0.68),
            vx: (Math.random() - 0.5) * 14,
            vy: -(10 + Math.random() * 16),
            r: 1.1 + Math.random() * 2.2,
            life: 0,
            maxLife: 1.8 + Math.random() * 1.1,
            tone:
              actionKind === 'power'
                ? 'emerald'
                : actionKind === 'watch' || actionKind === 'light' || actionKind === 'universal'
                ? 'warm'
                : 'cool',
          });
        }
      }

      // 0. Sleek Curved USB-C Optical Charge Conduit (Power Banks / Chargers ONLY on Stage 2)
      if (actionKind === 'power' && lastBurstRef.current > 0) {
        const startX = beamOriginRef.current.x * w;
        const startY = Math.min(h * 0.72, Math.max(h * 0.48, beamOriginRef.current.y * h));
        const endX = w * 0.78;
        const endY = h * 0.84;
        const ctrlX = (startX + endX) * 0.5 - 24;
        const ctrlY = Math.max(startY, endY) + 34;

        const lineGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        lineGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
        lineGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.56)');
        lineGrad.addColorStop(1, 'rgba(16, 185, 129, 0.82)');

        ctx.save();
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
        ctx.stroke();

        // Twin photon pulses traveling down the braided charge path
        for (let k = 0; k < 2; k++) {
          const pulseT = (now * 0.0014 + k * 0.5) % 1;
          const inv = 1 - pulseT;
          const px = inv * inv * startX + 2 * inv * pulseT * ctrlX + pulseT * pulseT * endX;
          const py = inv * inv * startY + 2 * inv * pulseT * ctrlY + pulseT * pulseT * endY;

          const pg = ctx.createRadialGradient(px, py, 1, px, py, 13);
          pg.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
          pg.addColorStop(0.42, 'rgba(52, 211, 153, 0.8)');
          pg.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(px, py, 13, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 1. Volumetric Warm Studio Beam (Light products)
      if (actionKind === 'light') {
        beamIntensityRef.current = Math.max(0.32, beamIntensityRef.current - dt * 0.3);
        const bx = (ptr.active ? ptr.x * 0.35 + beamOriginRef.current.x * 0.65 : beamOriginRef.current.x) * w;
        const by = (ptr.active ? ptr.y * 0.35 + beamOriginRef.current.y * 0.65 : beamOriginRef.current.y) * h;
        const grad = ctx.createRadialGradient(bx, by, 4, bx, by, w * 0.72);
        grad.addColorStop(0, `rgba(255, 249, 228, ${0.62 * beamIntensityRef.current})`);
        grad.addColorStop(0.32, `rgba(253, 224, 150, ${0.3 * beamIntensityRef.current})`);
        grad.addColorStop(1, 'rgba(253, 224, 150, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // 2. Interactive Curl-Noise Volumetric Silky Vapor Plumes (Swirls when user drags finger/cursor!)
      for (let i = vaporsRef.current.length - 1; i >= 0; i--) {
        const p = vaporsRef.current[i];
        p.life += dt;
        if (p.life < 0) continue;
        if (p.life >= p.maxLife) {
          vaporsRef.current.splice(i, 1);
          continue;
        }
        const t = p.life / p.maxLife;
        if (ptr.active) {
          const dx = p.x - ptrX;
          const dy = p.y - ptrY;
          const dist = Math.hypot(dx, dy);
          if (dist < 115 && dist > 1) {
            const force = (1 - dist / 115) * 280 * dt;
            p.vx += (ptr.vx * 0.45 + (dx / dist) * 40) * force * 0.06;
            p.vy += (ptr.vy * 0.45 + (dy / dist) * 40) * force * 0.06;
          }
        }
        p.vx *= Math.pow(0.97, dt * 60);
        p.x += (p.vx + Math.sin(p.life * p.swirlSpeed + p.swirlPhase) * 28) * dt;
        p.y += p.vy * (1 - t * 0.42) * dt;
        const radius = p.r + p.grow * t;
        const fade = Math.sin(t * Math.PI);
        const alpha = p.alpha * fade;

        const g = ctx.createRadialGradient(p.x, p.y, radius * 0.06, p.x, p.y, radius);
        if (p.layer === 1) {
          g.addColorStop(0, `rgba(255, 255, 255, ${alpha * 1.45})`);
          g.addColorStop(0.48, `rgba(248, 250, 252, ${alpha * 0.8})`);
          g.addColorStop(1, 'rgba(226, 232, 240, 0)');
        } else {
          g.addColorStop(0, `rgba(244, 244, 250, ${alpha * 1.25})`);
          g.addColorStop(0.55, `rgba(226, 232, 245, ${alpha * 0.62})`);
          g.addColorStop(1, 'rgba(203, 213, 225, 0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Silky Aerodynamic Airflow Ribbons (Fans)
      for (let i = ribbonsRef.current.length - 1; i >= 0; i--) {
        const rb = ribbonsRef.current[i];
        rb.life += dt;
        rb.progress += rb.speed * dt;
        if (rb.life >= rb.maxLife || rb.progress > 1.38) {
          ribbonsRef.current.splice(i, 1);
          continue;
        }
        const t = rb.life / rb.maxLife;
        const fade = Math.sin(Math.min(1, t) * Math.PI);
        const startX = Math.max(0, (rb.progress - 0.44) * w);
        const endX = Math.min(w, rb.progress * w);
        if (endX <= startX + 8) continue;

        const grad = ctx.createLinearGradient(startX, rb.yBase, endX, rb.yBase);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.45, `rgba(186, 230, 253, ${0.55 * fade})`);
        grad.addColorStop(0.82, `rgba(255, 255, 255, ${0.78 * fade})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = rb.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let x = startX; x <= endX; x += 8) {
          const bend = ptr.active ? Math.exp(-Math.abs(x - ptrX) / 100) * (ptrY - rb.yBase) * 0.12 : 0;
          const y = rb.yBase + Math.sin(x * rb.freq + rb.phase + rb.life * 5.2) * rb.amp + bend;
          if (x === startX) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 4. Acoustic / Hydro Refractive Shockwave Ripples
      for (let i = wavesRef.current.length - 1; i >= 0; i--) {
        const wv = wavesRef.current[i];
        wv.life += dt;
        if (wv.life < 0) continue;
        if (wv.life >= wv.maxLife) {
          wavesRef.current.splice(i, 1);
          continue;
        }
        const t = wv.life / wv.maxLife;
        const eased = 1 - Math.pow(1 - t, 3);
        const radius = wv.r + (wv.maxR - wv.r) * eased;
        const alpha = (1 - t) * 0.56;

        ctx.save();
        ctx.strokeStyle =
          actionKind === 'power'
            ? `rgba(16, 185, 129, ${alpha * 0.78})`
            : actionKind === 'liquid'
            ? `rgba(186, 230, 253, ${alpha * 0.92})`
            : `rgba(255, 255, 255, ${alpha * 0.88})`;
        ctx.lineWidth = Math.max(0.8, wv.thickness * (1 - t * 0.58));
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle =
          actionKind === 'audio'
            ? `rgba(37, 99, 235, ${alpha * 0.36})`
            : `rgba(14, 165, 233, ${alpha * 0.34})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, Math.max(1, radius - 3.5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 5. Photorealistic Water Droplets & Fine Spray Mist (Fresnel Specular Shading)
      for (let i = dropletsRef.current.length - 1; i >= 0; i--) {
        const d = dropletsRef.current[i];
        d.life += dt;
        if (d.life >= d.maxLife) {
          dropletsRef.current.splice(i, 1);
          continue;
        }
        const t = d.life / d.maxLife;
        const drag = d.mist ? 0.94 : 0.985;
        d.vx *= Math.pow(drag, dt * 60);
        d.vy = d.vy * Math.pow(drag, dt * 60) + (d.mist ? 55 : 560) * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;

        const alpha = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 0.9);

        if (d.mist) {
          const mg = ctx.createRadialGradient(d.x, d.y, 1, d.x, d.y, d.r * (1 + t * 0.85));
          mg.addColorStop(0, `rgba(240, 249, 255, ${alpha * 0.38})`);
          mg.addColorStop(0.55, `rgba(186, 230, 253, ${alpha * 0.16})`);
          mg.addColorStop(1, 'rgba(186, 230, 253, 0)');
          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r * (1 + t * 0.85), 0, Math.PI * 2);
          ctx.fill();
        } else {
          const speed = Math.hypot(d.vx, d.vy);
          const angle = Math.atan2(d.vy, d.vx);
          const stretch = Math.min(2.25, 1 + speed / 400);

          ctx.save();
          ctx.translate(d.x, d.y);
          ctx.rotate(angle);
          ctx.scale(stretch, 1 / Math.sqrt(stretch));

          const dg = ctx.createRadialGradient(-d.r * 0.25, -d.r * 0.25, d.r * 0.1, 0, 0, d.r);
          dg.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.96})`);
          dg.addColorStop(0.44, `rgba(224, 242, 254, ${alpha * 0.68})`);
          dg.addColorStop(0.82, `rgba(56, 189, 248, ${alpha * 0.46})`);
          dg.addColorStop(1, `rgba(12, 74, 110, ${alpha * 0.32})`);

          ctx.fillStyle = dg;
          ctx.beginPath();
          ctx.arc(0, 0, d.r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.99})`;
          ctx.beginPath();
          ctx.arc(-d.r * 0.3, -d.r * 0.3, Math.max(0.9, d.r * 0.28), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 6. High-Density Optical Bokeh & Studio Micro-Motes (Reacts subtly to pointer sweep!)
      for (let i = motesRef.current.length - 1; i >= 0; i--) {
        const m = motesRef.current[i];
        m.life += dt;
        if (m.life < 0) continue;
        if (m.life >= m.maxLife) {
          motesRef.current.splice(i, 1);
          continue;
        }
        const t = m.life / m.maxLife;
        if (ptr.active) {
          const dx = m.x - ptrX;
          const dy = m.y - ptrY;
          const dist = Math.hypot(dx, dy);
          if (dist < 85 && dist > 1) {
            m.vx += (dx / dist) * 55 * dt;
            m.vy += (dy / dist) * 55 * dt;
          }
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vx *= Math.pow(0.96, dt * 60);
        m.vy *= Math.pow(0.96, dt * 60);
        const fade = Math.sin(t * Math.PI);

        const colorCore =
          m.tone === 'emerald'
            ? `rgba(16, 185, 129, ${fade * 0.9})`
            : m.tone === 'warm'
            ? `rgba(255, 250, 235, ${fade * 0.92})`
            : m.tone === 'cool'
            ? `rgba(224, 242, 254, ${fade * 0.88})`
            : `rgba(255, 255, 255, ${fade * 0.86})`;
        const colorOuter =
          m.tone === 'emerald'
            ? 'rgba(56, 189, 248, 0)'
            : m.tone === 'warm'
            ? 'rgba(251, 191, 36, 0)'
            : 'rgba(147, 197, 253, 0)';

        const mg = ctx.createRadialGradient(m.x, m.y, 0.2, m.x, m.y, m.r * 2.5);
        mg.addColorStop(0, colorCore);
        mg.addColorStop(1, colorOuter);
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Optical 4-Point Sapphire / Studio Diamond Lens Glints
      for (let i = glintsRef.current.length - 1; i >= 0; i--) {
        const g = glintsRef.current[i];
        g.life += dt;
        if (g.life < 0) continue;
        if (g.life >= g.maxLife) {
          glintsRef.current.splice(i, 1);
          continue;
        }
        const t = g.life / g.maxLife;
        const fade = Math.sin(t * Math.PI);
        const s = g.size * (0.65 + fade * 0.6);

        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle + t * 0.4);

        const halo = ctx.createRadialGradient(0, 0, 0.5, 0, 0, s * 0.62);
        halo.addColorStop(0, `rgba(255, 253, 244, ${fade * 0.92})`);
        halo.addColorStop(0.5, `rgba(254, 243, 199, ${fade * 0.32})`);
        halo.addColorStop(1, 'rgba(254, 243, 199, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${fade * 0.95})`;
        for (let arm = 0; arm < 2; arm++) {
          ctx.save();
          ctx.rotate((arm * Math.PI) / 2);
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.quadraticCurveTo(0, -1.9, s, 0);
          ctx.quadraticCurveTo(0, 1.9, -s, 0);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [active, actionKind]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full z-20 will-change-transform"
    />
  );
}
