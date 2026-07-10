import { useRef, type ReactNode, type MouseEvent } from "react";

/**
 * Card with a soft accent spotlight that follows the pointer —
 * adapted from React Bits SpotlightCard for the paper theme.
 */
export default function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={`spotlight-card relative overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
