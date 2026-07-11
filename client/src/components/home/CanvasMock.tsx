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

const fadeUp = (delay: number) => ({
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay },
  },
});

const fadeIn = (delay: number) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: EASE, delay },
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

export default function CanvasMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-[0_32px_80px_-32px_rgba(26,25,23,0.35)]">
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
          <motion.rect
            x="40" y="188" width="170" height="64" rx="32"
            fill="none" stroke="var(--color-ink)" strokeWidth="2.5"
            variants={draw(0.2)}
          />
          <motion.g variants={fadeUp(0.9)}>
            <text x="40" y="178" fontSize="9" fontWeight="600" letterSpacing="1.5" fill="var(--color-ink-faint)">TRIGGER</text>
            <path d="M64 204l-5 10h5l-3 8 9-12h-5l4-6z" fill="var(--color-accent)" />
            <text x="84" y="225" fontSize="13" fontWeight="600" fill="var(--color-ink)">New signup</text>
          </motion.g>

          <motion.path
            d="M210 220h45m0 0l-11-8m11 8l-11 8"
            fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(0.5)}
          />

          <motion.path
            d="M330 168l75 52-75 52-75-52z"
            fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round"
            variants={draw(0.7)}
          />
          <motion.g variants={fadeUp(1.3)}>
            <text x="330" y="152" textAnchor="middle" fontSize="9" fontWeight="600" letterSpacing="1.5" fill="var(--color-ink-faint)">CONDITION</text>
            <g transform="translate(322,196)" stroke="var(--color-ink-soft)" strokeWidth="1.6" strokeLinecap="round" fill="none">
              <path d="M8 2v6M8 8l-6 5M8 8l6 5" />
              <circle cx="8" cy="2" r="1.6" fill="var(--color-ink-soft)" stroke="none" />
              <circle cx="2" cy="15" r="1.6" fill="var(--color-ink-soft)" stroke="none" />
              <circle cx="14" cy="15" r="1.6" fill="var(--color-ink-soft)" stroke="none" />
            </g>
            <text x="330" y="238" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-ink)">Plan = Pro?</text>
          </motion.g>

          <motion.path
            d="M405 220C448 205 450 140 480 130"
            fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(1.0)}
          />
          <motion.text x="432" y="178" fontSize="10" fill="var(--color-ink-faint)" variants={fadeUp(1.6)}>yes</motion.text>

          <motion.path
            d="M405 220C448 235 450 300 480 310"
            fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(1.05)}
          />
          <motion.text x="432" y="262" fontSize="10" fill="var(--color-ink-faint)" variants={fadeUp(1.6)}>no</motion.text>

          <motion.rect
            x="480" y="98" width="210" height="64" rx="14"
            fill="none" stroke="var(--color-ink)" strokeWidth="2.5"
            variants={draw(1.2)}
          />
          <motion.g variants={fadeUp(1.8)}>
            <text x="480" y="88" fontSize="9" fontWeight="600" letterSpacing="1.5" fill="var(--color-ink-faint)">ACTION</text>
            <g transform="translate(498,120)" stroke="var(--color-ink-soft)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" fill="none">
              <rect x="0" y="0" width="16" height="12" rx="2" />
              <path d="M0 2l8 6 8-6" />
            </g>
            <text x="524" y="134" fontSize="13" fontWeight="600" fill="var(--color-ink)">Send welcome email</text>
          </motion.g>

          <motion.rect
            x="480" y="278" width="210" height="64" rx="14"
            fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeDasharray="6 5"
            variants={fadeIn(1.3)}
          />
          <motion.g variants={fadeUp(1.9)}>
            <text x="480" y="268" fontSize="9" fontWeight="600" letterSpacing="1.5" fill="var(--color-accent)">AI SUGGESTED</text>
            <g transform="translate(498,300)" fill="var(--color-accent)">
              <path d="M8 0l1.6 5.4L15 7l-5.4 1.6L8 14l-1.6-5.4L1 7l5.4-1.6z" />
            </g>
            <text x="524" y="314" fontSize="13" fontWeight="600" fill="var(--color-ink)">Start trial nurture</text>
          </motion.g>

          <motion.path
            d="M708 310
               C706 335 654 351 583 350
               C516 349 462 333 461 311
               C460 285 517 264 586 265
               C651 266 710 284 708 310 Z"
            fill="none" stroke="var(--color-coral)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(2.1)}
          />

          <motion.path
            d="M690 130C725 130 720 190 694 205"
            fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(1.6)}
          />
          <motion.path
            d="M690 310C725 310 720 250 694 235"
            fill="none" stroke="var(--color-ink-soft)" strokeWidth="2.5" strokeLinecap="round"
            variants={draw(1.65)}
          />

          <motion.rect
            x="690" y="188" width="100" height="64" rx="32"
            fill="none" stroke="var(--color-ink)" strokeWidth="2.5"
            variants={draw(1.85)}
          />
          <motion.g variants={fadeUp(2.35)}>
            <g transform="translate(706,212)" stroke="var(--color-ink-soft)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" fill="none">
              <path d="M8 0c-3 0-5 2.4-5 5.4v2.6l-1.5 2.4h13L13 8V5.4C13 2.4 11 0 8 0z" />
              <path d="M6.5 12.4a1.6 1.6 0 003 0" />
            </g>
            <text x="726" y="225" fontSize="11" fontWeight="600" fill="var(--color-ink)">Notify</text>
            <text x="726" y="238" fontSize="11" fontWeight="600" fill="var(--color-ink)">team</text>
          </motion.g>

          <motion.ellipse
            cx="585" cy="310" rx="0" ry="0" fill="var(--color-accent)" opacity="0.07"
            variants={{
              hidden: { rx: 0, ry: 0 },
              visible: { rx: 145, ry: 70, transition: { duration: 1.2, ease: EASE, delay: 2.2 } },
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE, delay: 2.3 }}
          className="absolute bottom-4 left-1/2 flex w-[min(420px,88%)] -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur"
        >
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
          <span className="truncate text-xs text-ink-soft sm:text-sm">
            "If it's a free signup, start a trial nurture" — added
          </span>
        </motion.div>
      </div>
    </div>
  );
}
