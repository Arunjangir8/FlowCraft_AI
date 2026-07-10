import { Reveal } from "./motion";

const steps = [
  {
    title: "Open a board",
    body: "Sign in with Google and you're on a blank, infinite canvas in seconds. No installs, no setup wizard, no template to fight.",
  },
  {
    title: "Think out loud",
    body: "Drop boxes, arrows, ink and text as fast as the idea moves — or type what you mean and let the AI lay it down for you.",
  },
  {
    title: "Send the link",
    body: "One URL carries the whole board. Viewers watch it evolve live; editors pick up the pen. No exports, no stale copies.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-8 sm:pt-36">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-faint">
          How it works
        </p>
      </Reveal>
      <Reveal delay={1}>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
          Blank page to shared thinking{" "}
          <span className="font-serif italic tracking-normal text-accent">in three moves.</span>
        </h2>
      </Reveal>

      <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
        {/* connecting line, desktop only */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-5 hidden border-t border-dashed border-line md:block"
        />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i + 1}>
            <div className="relative">
              <span className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper font-serif text-lg italic text-accent">
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{s.title}</h3>
              <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
