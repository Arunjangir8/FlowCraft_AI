import { motion } from "framer-motion";
import SpotlightCard from "./bits/SpotlightCard";
import { Reveal } from "./motion";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const features = [
  {
    title: "An honest canvas",
    body: "Rectangles, ellipses, arrows, freehand ink and text — the whole vocabulary of thinking out loud, with zoom and pan that never get in the way.",
    icon: (
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <rect x="7" y="10" width="16" height="12" rx="2" {...stroke} />
        <circle cx="28" cy="27" r="6" {...stroke} />
        <path d="M15 22v5c0 2 1 3 3 3h4" {...stroke} />
      </svg>
    ),
  },
  {
    title: "Described, then drawn",
    body: "Tell the canvas what you mean — “a login flow with three steps” — and shapes appear where your cursor left off. Mermaid diagrams included.",
    icon: (
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <path d="M20 7l2.4 6.6L29 16l-6.6 2.4L20 25l-2.4-6.6L11 16l6.6-2.4L20 7z" {...stroke} />
        <path d="M30 26l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2 1.2-3z" {...stroke} />
      </svg>
    ),
  },
  {
    title: "Live by default",
    body: "Every board streams changes to everyone viewing it, the moment they happen. Share a link with view or edit rights — no exports, no stale copies.",
    icon: (
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <path d="M8 30c0-5 4-8 8-8" {...stroke} />
        <circle cx="16" cy="14" r="5" {...stroke} />
        <path d="M25 8l3.5 9.5 4-4L25 8z" {...stroke} />
        <path d="M24 26c4 0 8 3 8 8" {...stroke} />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="canvas" className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-faint">
          Why Linea
        </p>
      </Reveal>
      <Reveal delay={1}>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
          Everything a whiteboard should be.{" "}
          <span className="font-serif italic tracking-normal text-ink-soft">Nothing it shouldn’t.</span>
        </h2>
      </Reveal>

      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i + 2}>
            <motion.article
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="h-full"
            >
              <SpotlightCard className="group h-full rounded-2xl border border-line bg-white/70 p-8 backdrop-blur transition-shadow duration-500 hover:shadow-[0_24px_48px_-24px_rgba(26,25,23,0.25)]">
                <div className="mb-6 inline-flex rounded-xl bg-paper-deep p-3 text-ink transition-colors duration-500 group-hover:bg-accent/10 group-hover:text-accent">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-ink">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
              </SpotlightCard>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
