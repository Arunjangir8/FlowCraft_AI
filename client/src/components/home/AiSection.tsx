import { motion } from "framer-motion";
import SpotlightCard from "./bits/SpotlightCard";
import { EASE, Reveal } from "./motion";

const PROMPT = "sketch a checkout flow with a retry path";

function TypedPrompt() {
  return (
    <motion.p
      className="font-mono text-sm text-white/90 sm:text-base"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-120px" }}
      transition={{ staggerChildren: 0.035, delayChildren: 0.4 }}
      aria-label={PROMPT}
    >
      <span aria-hidden>
        {PROMPT.split("").map((ch, i) => (
          <motion.span
            key={i}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          >
            {ch}
          </motion.span>
        ))}
      </span>
      <motion.span
        aria-hidden
        className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-accent"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </motion.p>
  );
}

const pop = (i: number) => ({
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: EASE, delay: 1.8 + i * 0.25 },
  },
});

// Connector lines/paths shouldn't scale in — a thin line scaling from
// 0.6 shrinks toward its own center, which briefly renders as a gap on
// both ends before it reaches full size. They just fade in at full
// length instead, so they always read as touching their boxes,
// regardless of when the animation is captured.
const lineIn = (i: number) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: EASE, delay: 1.8 + i * 0.25 },
  },
});

const capabilities = [
  {
    name: "Generate",
    body: "“A login flow with three steps” becomes three connected shapes, placed where you left off.",
  },
  {
    name: "Diagram",
    body: "Paste or describe a process; get a full Mermaid flowchart rendered as editable canvas shapes.",
  },
  {
    name: "Transform",
    body: "Ask it to tidy, align, restyle or rearrange what you already drew — your shapes, reworked.",
  },
  {
    name: "Describe",
    body: "It reads the board back to you — useful when a sketch needs to become a paragraph.",
  },
  {
    name: "Suggest",
    body: "Stuck at a blank canvas? Ask for directions worth sketching and pick one.",
  },
];

export default function AiSection() {
  return (
    <section id="ai" className="relative px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl overflow-clip rounded-[2rem] bg-night px-6 py-20 sm:px-14 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/40">
                Drawing, delegated
              </p>
            </Reveal>
            <Reveal delay={1}>
              <h2 className="mt-4 text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-white">
                Say it.{" "}
                <span className="font-serif italic tracking-normal text-coral">Watch it appear.</span>
              </h2>
            </Reveal>
            <Reveal delay={2}>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/60">
                The AI sits inside your board, not beside it. It reads what’s
                already on the canvas before it acts — so what it adds lands in
                the right place, and everything it draws stays ordinary,
                editable shapes. Nothing is flattened into an image you can’t
                touch.
              </p>
            </Reveal>
          </div>

          {/* prompt → shapes board */}
          <div className="rounded-2xl border border-white/10 bg-night-soft p-5 sm:p-7">
            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <TypedPrompt />
            </div>
            <motion.svg
              viewBox="0 0 480 260"
              className="mt-5 w-full"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-120px" }}
              aria-hidden
            >
              {/* the spark: where the prompt turns into shapes */}
              <motion.path
                d="M36 118l1.8 6L44 126l-6.2 1.8L36 134l-1.8-6.2L28 126l6.2-1.8z"
                fill="var(--color-accent)" variants={pop(0)}
              />

              {/* Cart */}
              <motion.g variants={pop(0.3)}>
                <rect x="66" y="28" width="104" height="52" rx="11" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="2" transform="rotate(2.5 118 54)" />
                <rect x="64" y="26" width="104" height="52" rx="10" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" transform="rotate(-2 116 52)" />
                <text x="116" y="57" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="12" fontFamily="Inter, sans-serif">Cart</text>
              </motion.g>

              <motion.path d="M36 118C42 95 55 68 64 52" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" variants={lineIn(0.5)} />
              <motion.path d="M150 78C180 85 200 82 225 90" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" variants={lineIn(0.9)} />

              {/* Pay — the node the AI is still actively holding, marked
                  by a selection marquee + resize handles, same affordance
                  a person would see after drawing it themselves */}
              <motion.g variants={pop(1)}>
                <rect x="187" y="92" width="130" height="76" rx="38" fill="none" stroke="var(--color-accent)" strokeOpacity="0.3" strokeWidth="2" transform="rotate(1 252 130)" />
                <rect x="185" y="90" width="130" height="76" rx="38" fill="none" stroke="var(--color-accent)" strokeWidth="2" transform="rotate(-0.8 250 128)" />
                <text x="250" y="134" textAnchor="middle" fill="var(--color-accent)" fontSize="13" fontFamily="Inter, sans-serif">pay</text>
              </motion.g>

              <motion.g variants={lineIn(2.2)}>
                <rect x="177" y="82" width="146" height="92" rx="4" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2" strokeDasharray="2 5" />
                <rect x="174" y="79" width="6" height="6" fill="#fff" fillOpacity="0.8" />
                <rect x="320" y="79" width="6" height="6" fill="#fff" fillOpacity="0.8" />
                <rect x="174" y="171" width="6" height="6" fill="#fff" fillOpacity="0.8" />
                <rect x="320" y="171" width="6" height="6" fill="#fff" fillOpacity="0.8" />
                <path d="M250 82v-14" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2" />
                <circle cx="250" cy="64" r="4" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" />
              </motion.g>

              {/* retry, as a refresh badge clipped onto pay's corner */}
              <motion.g variants={pop(1.6)}>
                <circle cx="300" cy="158" r="19" fill="var(--color-night)" stroke="var(--color-coral)" strokeWidth="1.8" strokeDasharray="3 4" />
                <g transform="translate(289,147) scale(0.62)" stroke="var(--color-coral)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </g>
              </motion.g>
              <motion.text x="300" y="193" textAnchor="middle" fill="var(--color-coral)" fontSize="10" fontFamily="Inter, sans-serif" variants={pop(1.6)}>
                auto-retries
              </motion.text>

              {/* a sticky-note follow-up branching off pay */}
              <motion.path d="M225 166C175 190 150 150 97 172" fill="none" stroke="var(--color-coral)" strokeOpacity="0.6" strokeWidth="1.8" strokeDasharray="4 5" strokeLinecap="round" variants={lineIn(1.4)} />
              <motion.g variants={pop(1.3)}>
                <rect x="50" y="172" width="95" height="68" rx="6" fill="none" stroke="var(--color-coral)" strokeWidth="1.8" strokeDasharray="4 3" transform="rotate(4 97 206)" />
                <text x="97" y="200" textAnchor="middle" fill="var(--color-coral)" fontSize="9.5" fontFamily="Inter, sans-serif">send</text>
                <text x="97" y="214" textAnchor="middle" fill="var(--color-coral)" fontSize="9.5" fontFamily="Inter, sans-serif">receipt</text>
              </motion.g>

              {/* Confirmed */}
              <motion.path d="M315 128C335 145 340 160 345 192" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" variants={lineIn(1.9)} />
              <motion.g variants={pop(2)}>
                <rect x="347" y="162" width="105" height="60" rx="11" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="2" transform="rotate(-1.6 400 192)" />
                <rect x="345" y="160" width="105" height="60" rx="10" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" transform="rotate(1.4 398 190)" />
                <text x="398" y="195" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="10" fontFamily="Inter, sans-serif">Confirmed</text>
              </motion.g>

              {/* a floating count, as if the AI just finished the pass */}
              <motion.g variants={pop(2.6)}>
                <rect x="380" y="16" width="76" height="26" rx="13" fill="none" stroke="var(--color-accent)" strokeWidth="1.4" />
                <text x="418" y="33" textAnchor="middle" fill="var(--color-accent)" fontSize="9.5" fontFamily="Inter, sans-serif">+5 shapes</text>
              </motion.g>
            </motion.svg>
          </div>
        </div>

        {/* the five things it actually does */}
        <div className="mt-16 grid gap-4 border-t border-white/10 pt-12 sm:grid-cols-2 lg:grid-cols-5">
          {capabilities.map((c, i) => (
            <Reveal key={c.name} delay={i}>
              <motion.div
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="h-full"
              >
                <SpotlightCard className="group relative h-full rounded-xl border border-white/10 bg-linear-to-b from-white/6 to-white/2 p-5 transition-colors duration-500 hover:border-accent/60">
                  <span
                    aria-hidden
                    className="absolute right-4 top-4 font-serif text-sm italic text-white/25 transition-colors duration-500 group-hover:text-accent"
                  >
                    0{i + 1}
                  </span>
                  <span className="block h-px w-8 bg-coral/70 transition-all duration-500 group-hover:w-12 group-hover:bg-accent" />
                  <h3 className="mt-4 font-serif text-lg italic text-coral">{c.name}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/60">{c.body}</p>
                </SpotlightCard>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}