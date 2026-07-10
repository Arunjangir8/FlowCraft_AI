import { useEffect, useRef, type ReactNode } from "react";

type Spark = { x: number; y: number; angle: number; start: number };

/**
 * Ink sparks on click — adapted from React Bits ClickSpark.
 * Fixed viewport canvas; the rAF loop only runs while sparks are alive.
 */
export default function ClickSpark({
  children,
  size = 9,
  radius = 18,
  count = 8,
  duration = 450,
}: {
  children: ReactNode;
  size?: number;
  radius?: number;
  count?: number;
  duration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const drawFrame = (now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color =
      getComputedStyle(canvas).getPropertyValue("--color-accent").trim() || "#3b36ee";

    sparksRef.current = sparksRef.current.filter((s) => {
      const t = (now - s.start) / duration;
      if (t >= 1) return false;
      const eased = t * (2 - t);
      const dist = eased * radius;
      const len = size * (1 - eased);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x + dist * Math.cos(s.angle), s.y + dist * Math.sin(s.angle));
      ctx.lineTo(s.x + (dist + len) * Math.cos(s.angle), s.y + (dist + len) * Math.sin(s.angle));
      ctx.stroke();
      return true;
    });

    if (sparksRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(drawFrame);
    } else {
      rafRef.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      sparksRef.current.push({
        x: e.clientX,
        y: e.clientY,
        angle: (2 * Math.PI * i) / count + Math.random() * 0.4,
        start: now,
      });
    }
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(drawFrame);
  };

  return (
    <div className="relative" onClick={onClick}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-60 select-none"
        aria-hidden
      />
      {children}
    </div>
  );
}
