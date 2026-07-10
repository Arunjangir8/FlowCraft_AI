import SpotlightCard from "./bits/SpotlightCard";
import { Reveal } from "./motion";

const points = [
  {
    title: "Presence, streamed",
    body: "Boards update live for everyone viewing them — strokes arrive as they’re drawn, not on refresh.",
  },
  {
    title: "Share on your terms",
    body: "Public link, per-person invite, or email — each with view or edit rights you can change any time.",
  },
  {
    title: "Yours stays yours",
    body: "Every board is versioned and soft-deleted, so an accidental delete is never the end of the story.",
  },
];

export default function CollabSection() {
  return (
    <section id="together" className="mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-faint">
              Better together
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h2 className="mt-4 text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
              One board,{" "}
              <span className="font-serif italic tracking-normal text-accent">every cursor.</span>
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Thinking rarely happens alone. Linea keeps the whole room on the
              same canvas — literally.
            </p>
          </Reveal>
        </div>

        <div className="space-y-4">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i + 1}>
              <SpotlightCard className="group flex gap-5 rounded-2xl border border-line bg-white/70 p-6 backdrop-blur transition-colors duration-500 hover:border-ink/30 sm:p-7">
                <span className="mt-1 font-serif text-2xl italic text-ink-faint transition-colors duration-500 group-hover:text-accent">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-semibold tracking-tight text-ink">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{p.body}</p>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
