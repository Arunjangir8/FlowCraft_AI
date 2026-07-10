import { useEffect, useRef } from "react";

type Dot = { cx: number; cy: number; ox: number; oy: number; vx: number; vy: number };

function parseColor(el: HTMLElement, cssVar: string, fallback: string): [number, number, number] {
  const v = getComputedStyle(el).getPropertyValue(cssVar).trim() || fallback;
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (!m) return [222, 220, 210];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Interactive dot-paper background — inspired by React Bits DotGrid,
 * reimplemented without gsap. Dots tint toward the accent near the
 * pointer; clicking sends a small shockwave through the grid.
 * Renders once and stays static under reduced motion; the rAF loop
 * pauses while the grid is offscreen or at rest.
 */
export default function DotGrid({
  dotRadius = 1.5,
  gap = 26,
  proximity = 130,
  className = "",
}: {
  dotRadius?: number;
  gap?: number;
  proximity?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const base = parseColor(wrap, "--color-line", "#dedcd2");
    const accent = parseColor(wrap, "--color-accent", "#3b36ee");

    let dots: Dot[] = [];
    let raf: number | null = null;
    let visible = true;
    const pointer = { x: -1e4, y: -1e4 };

    const build = () => {
      const { width, height } = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = gap / 2; y < height; y += gap) {
        for (let x = gap / 2; x < width; x += gap) {
          dots.push({ cx: x, cy: y, ox: 0, oy: 0, vx: 0, vy: 0 });
        }
      }
      draw();
    };

    const draw = () => {
      const { width, height } = wrap.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      let settled = true;
      for (const d of dots) {
        // damped spring back to rest
        d.vx += -0.08 * d.ox - 0.16 * d.vx;
        d.vy += -0.08 * d.oy - 0.16 * d.vy;
        d.ox += d.vx;
        d.oy += d.vy;
        if (Math.abs(d.ox) > 0.05 || Math.abs(d.oy) > 0.05) settled = false;

        const dx = d.cx - pointer.x;
        const dy = d.cy - pointer.y;
        const dist = Math.hypot(dx, dy);
        let t = 0;
        if (dist < proximity) {
          t = 1 - dist / proximity;
          settled = false;
        }
        const r = base[0] + (accent[0] - base[0]) * t;
        const g = base[1] + (accent[1] - base[1]) * t;
        const b = base[2] + (accent[2] - base[2]) * t;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.beginPath();
        ctx.arc(d.cx + d.ox, d.cy + d.oy, dotRadius + t * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      return settled;
    };

    const loop = () => {
      raf = null;
      if (!visible) return;
      const settled = draw();
      if (!settled) raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (raf === null && visible && !reduced) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      wake();
    };
    const onLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
      wake();
    };
    const onClick = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      for (const d of dots) {
        const dx = d.cx - cx;
        const dy = d.cy - cy;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 240) {
          const force = ((240 - dist) / 240) * 6;
          d.vx += (dx / dist) * force;
          d.vy += (dy / dist) * force;
        }
      }
      wake();
    };

    const ro = new ResizeObserver(build);
    ro.observe(wrap);
    build();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    io.observe(wrap);

    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("click", onClick);
      wrap.addEventListener("pointerleave", onLeave);
    }

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("click", onClick);
      wrap.removeEventListener("pointerleave", onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [dotRadius, gap, proximity]);

  return (
    <div ref={wrapRef} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
