import { useEffect, useRef } from 'react';

type Shape = 'rect' | 'circle' | 'star';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotV: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
  shape: Shape;
}

// Gold-dominant premium palette
const COLORS = [
  '#FFB800', '#FFD54D', '#FFB800',  // gold (weighted 3×)
  '#FFB800', '#F5A623', '#FFD54D',  // gold / amber
  '#6FCF4A',                         // runs green
  '#3BC9DB',                         // four cyan
  '#E84C6A',                         // six coral
  '#A78BFA',                         // violet
  '#ffffff',                         // white sparkle
];

const SHAPES: Shape[] = ['rect', 'rect', 'circle', 'star'];

function createBurst(canvasWidth: number, canvasHeight: number, fromRight: boolean): Particle[] {
  const count = 55;
  const originX = fromRight ? canvasWidth - 30 : 30;
  const originY = canvasHeight - 60;
  return Array.from({ length: count }, () => {
    // Fan from bottom corner upward — spread from 30° to 150° above horizontal
    const spread = (Math.random() * 120 + 30) * (Math.PI / 180);
    const angle = fromRight ? Math.PI - spread : spread;
    const speed = Math.random() * 14 + 8;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: -Math.abs(Math.sin(angle)) * speed,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.35,
      w: Math.random() * 10 + 5,
      h: Math.random() * 5 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      opacity: 1,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    };
  });
}

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  const spikes = 5;
  const outer = r;
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = (i * Math.PI) / spikes - Math.PI / 2;
    const dist = i % 2 === 0 ? outer : inner;
    i === 0 ? ctx.moveTo(Math.cos(rad) * dist, Math.sin(rad) * dist)
            : ctx.lineTo(Math.cos(rad) * dist, Math.sin(rad) * dist);
  }
  ctx.closePath();
  ctx.fill();
}

interface ConfettiProps {
  active: boolean;
  duration?: number;
}

export function Confetti({ active, duration = 5000 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    particles: Particle[];
    raf: number;
    running: boolean;
  }>({ particles: [], raf: 0, running: false });

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const state = stateRef.current;
    state.running = true;

    // Immediate double-cannon burst from both bottom corners
    state.particles = [
      ...createBurst(canvas.width, canvas.height, false),
      ...createBurst(canvas.width, canvas.height, true),
    ];

    // Second volley at 600ms for a two-burst feel
    const volley2 = setTimeout(() => {
      if (!state.running) return;
      state.particles.push(
        ...createBurst(canvas.width, canvas.height, false),
        ...createBurst(canvas.width, canvas.height, true),
      );
    }, 600);

    const startTime = performance.now();

    const tick = (now: number) => {
      if (!state.running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const elapsed = now - startTime;
      // Fade out starts at 60% of duration
      const fadeFraction = Math.max(0, (elapsed - duration * 0.6) / (duration * 0.4));

      state.particles = state.particles.filter((p) => p.y < canvas.height + 40 && p.opacity > 0.02);

      for (const p of state.particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.38;   // gravity
        p.vx *= 0.985;  // air drag
        p.rot += p.rotV;
        p.opacity = Math.max(0, 1 - fadeFraction);

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          const r = p.w / 2;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          drawStar(ctx, p.w / 2);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      }

      if (elapsed < duration || state.particles.length > 0) {
        state.raf = requestAnimationFrame(tick);
      } else {
        state.running = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    state.raf = requestAnimationFrame(tick);

    return () => {
      state.running = false;
      clearTimeout(volley2);
      cancelAnimationFrame(state.raf);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, duration]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    />
  );
}
