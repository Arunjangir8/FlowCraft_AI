import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "./motion";

const draw = (delay: number) => ({
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.4, ease: EASE, delay },
      opacity: { duration: 0.01, delay },
    },
  },
});

function Cursor({
  name,
  color,
  path,
  delay,
}: {
  name: string;
  color: string;
  path: { x: number[]; y: number[] };
  delay: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="absolute left-0 top-0 hidden will-change-transform sm:block"
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        x: reduced ? path.x[0] : path.x,
        y: reduced ? path.y[0] : path.y,
      }}
      transition={{
        opacity: { duration: 0.4, delay },
        x: { duration: 14, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay },
        y: { duration: 14, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay },
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill={color} aria-hidden>
        <path d="M1 1l4.5 12 1.8-5.2L12.5 6 1 1z" />
      </svg>
      <span
        className="ml-3 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </motion.div>
  );
}

/**
 * Faux app window whose shapes draw themselves in — the product,
 * demonstrated instead of screenshotted.
 */
export default function CanvasMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-[0_32px_80px_-32px_rgba(26,25,23,0.35)]">
      {/* window chrome */}
      <div className="flex h-11 items-center justify-between border-b border-line px-4">
        <div className="flex gap-1.5">
          {["#e8e6dd", "#e8e6dd", "#e8e6dd"].map((c, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-xs text-ink-faint">product-flow.linea</span>
        <span className="flex -space-x-1.5">
          <span className="h-5 w-5 rounded-full border-2 border-white bg-accent" />
          <span className="h-5 w-5 rounded-full border-2 border-white bg-coral" />
        </span>
      </div>

      {/* canvas */}
      <div
        className="relative aspect-[16/9] w-full"
        style={{
          backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <motion.svg
          viewBox="0 0 800 450"
          className="absolute inset-0 h-full w-full"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          aria-hidden
        >
          {/* flow boxes */}
          <motion.rect
            x="90" y="120" width="170" height="72" rx="14"
            fill="none" stroke="var(--color-ink)" strokeWidth="2.5"
            variants={draw(0.2)}
          />
          <motion.rect
            x="330" y="120" width="170" height="72" rx="36"
            fill="none" stroke="var(--color-accent)" strokeWidth="2.5"
            variants={draw(0.6)}
          />
          <motion.rect
            x="570" y="120" width="150" height="72" rx="14"
            fill="none" stroke="var(--color-ink)" strokeWidth="2.5"
            variants={draw(1.0)}
          />
          {/* connectors */}
          <motion.path
            d="M262 156h64m0 0l-12-9m12 9l-12 9"
            fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(0.5)}
          />
          <motion.path
            d="M502 156h64m0 0l-12-9m12 9l-12 9"
            fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(0.9)}
          />
          {/* freehand annotation */}
          <motion.path
            d="M140 300c60-40 140 44 220 6s150-58 240-12c30 15 70 12 96-8"
            fill="none" stroke="var(--color-coral)" strokeWidth="3" strokeLinecap="round"
            variants={draw(1.3)}
          />
          <motion.circle
            cx="415" cy="156" r="0" fill="var(--color-accent)" opacity="0.08"
            variants={{
              hidden: { r: 0 },
              visible: { r: 110, transition: { duration: 1.2, ease: EASE, delay: 1.6 } },
            }}
          />
        </motion.svg>

        <Cursor
          name="Mira"
          color="var(--color-accent)"
          path={{ x: [520, 180, 620, 340], y: [90, 250, 320, 140] }}
          delay={0.8}
        />
        <Cursor
          name="Theo"
          color="var(--color-coral)"
          path={{ x: [140, 600, 300, 680], y: [330, 110, 220, 300] }}
          delay={1.4}
        />

        {/* AI pill */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE, delay: 2 }}
          className="absolute bottom-4 left-1/2 flex w-[min(420px,88%)] -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur"
        >
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
          <span className="truncate text-xs text-ink-soft sm:text-sm">
            “Turn this into an onboarding flowchart” — drawing 3 shapes…
          </span>
        </motion.div>
      </div>
    </div>
  );
}
