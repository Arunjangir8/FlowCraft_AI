import { Reveal } from "./motion";

const facts = [
  {
    title: "Sign in with Google",
    body: "No new password to invent, remember, or leak. Your Google account is the key.",
  },
  {
    title: "Nothing vanishes",
    body: "Boards are versioned and soft-deleted. An accidental delete is a detour, not a disaster.",
  },
  {
    title: "Permissions per person",
    body: "View or edit, granted per collaborator or per link — and revocable the moment you change your mind.",
  },
  {
    title: "Free to start",
    body: "A real free plan with clear monthly limits on boards and AI use. No card up front.",
  },
];

export default function Trust() {
  return (
    <section className="border-y border-line bg-paper-deep/50">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <Reveal>
          <h2 className="max-w-2xl text-[clamp(1.6rem,3.5vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            Boring in the ways{" "}
            <span className="font-serif italic tracking-normal text-ink-soft">that matter.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f, i) => (
            <Reveal key={f.title} delay={i + 1}>
              <div className="border-l-2 border-accent/30 pl-5">
                <h3 className="text-[15px] font-semibold tracking-tight text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
