import { useEffect, useRef, type RefObject } from "react";

/**
 * Letters swell in font weight near the pointer — adapted from React Bits
 * VariableProximity for the Inter variable font. Static under reduced motion.
 */
export default function VariableProximity({
  label,
  containerRef,
  fromWeight = 600,
  toWeight = 750,
  radius = 120,
  className = "",
}: {
  label: string;
  containerRef: RefObject<HTMLElement | null>;
  fromWeight?: number;
  toWeight?: number;
  radius?: number;
  className?: string;
}) {
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const container = containerRef.current;
    if (!container) return;

    let raf: number | null = null;
    const pointer = { x: -1e4, y: -1e4 };

    const update = () => {
      raf = null;
      letterRefs.current.forEach((el) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dist = Math.hypot(
          pointer.x - (rect.left + rect.width / 2),
          pointer.y - (rect.top + rect.height / 2),
        );
        const t = Math.max(0, 1 - dist / radius);
        const w = fromWeight + (toWeight - fromWeight) * t;
        el.style.fontVariationSettings = `'wght' ${w.toFixed(0)}`;
      });
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (raf === null) raf = requestAnimationFrame(update);
    };
    const onLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
      if (raf === null) raf = requestAnimationFrame(update);
    };

    container.addEventListener("pointermove", onMove, { passive: true });
    container.addEventListener("pointerleave", onLeave);
    return () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [containerRef, fromWeight, toWeight, radius]);

  let i = 0;
  return (
    <span className={className}>
      <span aria-hidden>
        {label.split(" ").map((word, wi) => (
          <span key={wi} className="inline-block whitespace-nowrap">
            {word.split("").map((ch) => {
              const idx = i++;
              return (
                <span
                  key={idx}
                  ref={(el) => {
                    letterRefs.current[idx] = el;
                  }}
                  className="inline-block"
                  style={{ fontVariationSettings: `'wght' ${fromWeight}` }}
                >
                  {ch}
                </span>
              );
            })}
            {" "}
          </span>
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
