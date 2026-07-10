import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Marquee strip whose speed and direction react to scroll velocity —
 * adapted from React Bits ScrollVelocity. Static under reduced motion.
 */
export default function ScrollVelocity({
  text,
  baseVelocity = 60,
  className = "",
}: {
  text: string;
  baseVelocity?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 4], { clamp: false });

  const copyRef = useRef<HTMLSpanElement>(null);
  const [copyWidth, setCopyWidth] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setCopyWidth(copyRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const x = useTransform(baseX, (v) => {
    if (copyWidth === 0) return "0px";
    const range = copyWidth;
    return `${(((v % range) + range) % range) - range}px`;
  });

  const direction = useRef(1);
  useAnimationFrame((_, delta) => {
    if (reduced) return;
    const vf = velocityFactor.get();
    if (vf < 0) direction.current = -1;
    else if (vf > 0) direction.current = 1;
    let moveBy = direction.current * baseVelocity * (delta / 1000);
    moveBy += moveBy * Math.abs(vf);
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`} aria-hidden>
      <motion.div className="flex w-max will-change-transform" style={{ x }}>
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} ref={i === 0 ? copyRef : null} className="shrink-0">
            {text}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
