import { motion, useReducedMotion, useSpring } from "framer-motion";
import { useRef, type ReactNode, type PointerEvent } from "react";
import type { Variants } from "framer-motion";

/** Shared easing — one curve so every section moves with the same voice. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE, delay: i * 0.1 },
  }),
};

/** Scroll-triggered reveal wrapper. `delay` is a stagger index, not seconds. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}

/** Headline that reveals line by line with a soft rise + blur clear. */
export function SplitLines({
  lines,
  className,
}: {
  lines: ReactNode[];
  className?: string;
}) {
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.12 }}
    >
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden py-[0.06em]">
          <motion.span
            className="block will-change-transform"
            variants={{
              hidden: { y: "110%", opacity: 0, filter: "blur(6px)" },
              visible: {
                y: 0,
                opacity: 1,
                filter: "blur(0px)",
                transition: { duration: 1, ease: EASE, delay: 0.15 + i * 0.12 },
              },
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/** Element that leans gently toward the pointer. Inert under reduced motion. */
export function Magnetic({
  children,
  strength = 0.25,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 250, damping: 18 });
  const y = useSpring(0, { stiffness: 250, damping: 18 });

  const onMove = (e: PointerEvent) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y, display: "inline-block" }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
