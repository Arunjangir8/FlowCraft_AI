import SpotlightCard from "./bits/SpotlightCard";
import { Reveal } from "./motion";

const cases = [
  {
    tag: "Engineering",
    title: "System design",
    body: "Map services, queues and failure paths before writing a line of code. Change your mind by dragging a box, not rewriting a doc.",
  },
  {
    tag: "Product",
    title: "Flows & journeys",
    body: "User journeys, edge cases, empty states — argued out in shapes instead of paragraphs, with the whole team pointing at the same thing.",
  },
  {
    tag: "Teams",
    title: "Workshops",
    body: "Everyone on one live board, cursors and all. Ideas land as they're said, and the board is the record — no minutes to write up.",
  },
  {
    tag: "Education",
    title: "Teaching & interviews",
    body: "Sketch a concept while you talk. Share view-only so the room follows your pen without touching your work.",
  },
];

export default function UseCases() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-faint">
          Where it earns its keep
        </p>
      </Reveal>
      <Reveal delay={1}>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
          Wherever thinking{" "}
          <span className="font-serif italic tracking-normal text-accent">gets visual.</span>
        </h2>
      </Reveal>

      <div className="mt-16 grid gap-5 sm:grid-cols-2">
        {cases.map((c, i) => (
          <Reveal key={c.title} delay={i + 1}>
            <SpotlightCard className="group h-full rounded-2xl border border-line bg-white/70 p-8 backdrop-blur transition-colors duration-500 hover:border-ink/30">
              <span className="inline-flex rounded-full bg-paper-deep px-3 py-1 text-xs font-medium text-ink-soft transition-colors duration-500 group-hover:bg-accent/10 group-hover:text-accent">
                {c.tag}
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-ink">{c.title}</h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">{c.body}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
