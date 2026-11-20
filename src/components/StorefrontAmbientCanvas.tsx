import React, { useEffect, useRef } from 'react';

interface BokehOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  phase: number;
  warm: boolean;
}

/**
 * Featherweight GPU-accelerated ambient luxury light-field & champagne bokeh canvas
 * for the editorial storefront hero banner. Reacts smoothly to cursor movement.
 */
export function StorefrontAmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let width = canvas.clientWidth || 720;
    let height = canvas.clientHeight || 280;
    let pointerX = width * 0.5;
    let pointerY = height * 0.5;
    let pointerActive = false;

    const orbs: BokehOrb[] = Array.from({ length: 42 }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 14,
      vy: -(4 + Math.random() * 11),
      r: idx < 10 ? 22 + Math.random() * 34 : 2 + Math.random() * 6,
      alpha: idx < 10 ? 0.08 + Math.random() * 0.08 : 0.18 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
      warm: idx % 3 !== 0,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || 720;
      height = canvas.clientHeight || 280;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        pointerX = e.clientX - rect.left;
        pointerY = e.clientY - rect.top;
        pointerActive = true;
      } else {
        pointerActive = false;
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });

    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - last) / 1000));
      last = now;
      ctx.clearRect(0, 0, width, height);

      // Soft interactive studio spotlight aura following pointer
      if (pointerActive) {
        const spot = ctx.createRadialGradient(pointerX, pointerY, 8, pointerX, pointerY, 210);
        spot.addColorStop(0, 'rgba(217, 179, 118, 0.12)');
        spot.addColorStop(0.5, 'rgba(245, 236, 220, 0.06)');
        spot.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, width, height);
      }

      // Subtle 3D projected rotating luxury geometric wireframe constellation in background
      const t = now * 0.00045;
      const draw3DPoly = (cx: number, cy: number, radius: number, rx: number, ry: number, alpha: number) => {
        const verts: Array<[number, number, number]> = [
          [0, 1, 0],
          [0, -1, 0],
          [1, 0, 0],
          [-1, 0, 0],
          [0, 0, 1],
          [0, 0, -1],
        ];
        const edges: Array<[number, number]> = [
          [0, 2], [0, 3], [0, 4], [0, 5],
          [1, 2], [1, 3], [1, 4], [1, 5],
          [2, 4], [4, 3], [3, 5], [5, 2],
        ];
        const cosX = Math.cos(rx), sinX = Math.sin(rx);
        const cosY = Math.cos(ry), sinY = Math.sin(ry);
        const proj = verts.map(([vx, vy, vz]) => {
          const x1 = vx * cosY - vz * sinY;
          const z1 = vx * sinY + vz * cosY;
          const y2 = vy * cosX - z1 * sinX;
          const z2 = vy * sinX + z1 * cosX;
          const p = 3.2 / (3.2 - z2 * 0.8);
          return [cx + x1 * radius * p, cy + y2 * radius * p];
        });
        ctx.strokeStyle = `rgba(180, 148, 96, ${alpha})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (const [a, b] of edges) {
          ctx.moveTo(proj[a][0], proj[a][1]);
          ctx.lineTo(proj[b][0], proj[b][1]);
        }
        ctx.stroke();
      };

      draw3DPoly(width * 0.12, height * 0.24, 38, t * 1.1, t * 1.4, 0.14);
      draw3DPoly(width * 0.48, height * 0.82, 28, -t * 0.9, t * 1.2, 0.11);
      draw3DPoly(width * 0.86, height * 0.18, 32, t * 0.8, -t * 1.3, 0.12);

      for (const orb of orbs) {
        orb.phase += dt * 1.1;
        orb.x += (orb.vx + Math.sin(orb.phase) * 6) * dt;
        orb.y += orb.vy * dt;

        if (pointerActive) {
          const dx = orb.x - pointerX;
          const dy = orb.y - pointerY;
          const dist = Math.hypot(dx, dy);
          if (dist < 120 && dist > 1) {
            orb.x += (dx / dist) * 18 * dt;
            orb.y += (dy / dist) * 18 * dt;
          }
        }

        if (orb.y < -orb.r * 2) {
          orb.y = height + orb.r * 2;
          orb.x = Math.random() * width;
        }
        if (orb.x < -orb.r * 2) orb.x = width + orb.r * 2;
        if (orb.x > width + orb.r * 2) orb.x = -orb.r * 2;

        const twinkle = 0.72 + Math.sin(orb.phase * 1.8) * 0.28;
        const a = orb.alpha * twinkle;
        const g = ctx.createRadialGradient(orb.x, orb.y, 0.5, orb.x, orb.y, orb.r);
        if (orb.warm) {
          g.addColorStop(0, `rgba(214, 178, 120, ${a})`);
          g.addColorStop(0.55, `rgba(235, 218, 188, ${a * 0.45})`);
          g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          g.addColorStop(0, `rgba(180, 198, 224, ${a})`);
          g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full z-0 opacity-90 will-change-transform"
    />
  );
}
