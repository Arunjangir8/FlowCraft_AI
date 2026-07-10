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
              <motion.rect x="30" y="95" width="120" height="60" rx="10" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" variants={pop(0)} />
              <motion.rect x="190" y="95" width="120" height="60" rx="30" fill="none" stroke="var(--color-accent)" strokeWidth="2" variants={pop(1)} />
              <motion.rect x="350" y="95" width="100" height="60" rx="10" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" variants={pop(2)} />
              <motion.path d="M150 125h40" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" variants={pop(1)} />
              <motion.path d="M310 125h40" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" variants={pop(2)} />
              <motion.path
                d="M250 155v50c0 8-6 14-14 14H104c-8 0-14-6-14-14v-50"
                fill="none" stroke="var(--color-coral)" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round"
                variants={pop(3)}
              />
              <motion.text x="240" y="131" textAnchor="middle" fill="var(--color-accent)" fontSize="13" fontFamily="Inter, sans-serif" variants={pop(1)}>
                pay
              </motion.text>
              <motion.text x="170" y="240" textAnchor="middle" fill="var(--color-coral)" fontSize="12" fontFamily="Inter, sans-serif" variants={pop(3)}>
                retry
              </motion.text>
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
