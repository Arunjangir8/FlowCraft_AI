import { Reveal } from "./motion";

const faqs = [
  {
    q: "What exactly is Linea?",
    a: "An infinite canvas in your browser — shapes, arrows, freehand ink and text — with an AI that can draw alongside you and live collaboration built in. Think whiteboard, minus the part where someone photographs it at the end.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Linea is a web app. Sign in with your Google account and you're drawing — no downloads, no extensions, no onboarding tour standing between you and the canvas.",
  },
  {
    q: "How does the AI actually draw?",
    a: "You describe what you want in plain language. The AI reads your prompt and what's already on the board, then adds regular, editable shapes — including full flowcharts generated from Mermaid. Everything it draws you can move, restyle or delete like anything you drew yourself.",
  },
  {
    q: "Can other people mess with my board?",
    a: "Only with permission you've given. Every collaborator and every shared link carries view or edit rights, set by you and revocable at any time. View-only really is view-only.",
  },
  {
    q: "What happens if I delete something important?",
    a: "Boards are soft-deleted and every save is versioned, so a wrong click doesn't destroy an afternoon of thinking. Deleted boards can be brought back.",
  },
  {
    q: "What does it cost?",
    a: "There's a real free plan with clear monthly limits on boards and AI usage — enough to find out whether Linea fits how you think. Paid plans raise the limits when it does.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-28 sm:px-8 sm:py-36">
      <Reveal>
        <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-ink-faint">
          Questions
        </p>
      </Reveal>
      <Reveal delay={1}>
        <h2 className="mt-4 text-center text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
          Asked, <span className="font-serif italic tracking-normal text-accent">answered.</span>
        </h2>
      </Reveal>

      <div className="mt-14 divide-y divide-line border-y border-line">
        {faqs.map((f, i) => (
          <Reveal key={f.q} delay={Math.min(i, 4)}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-[17px] font-medium tracking-tight text-ink outline-none transition-colors duration-300 hover:text-accent focus-visible:text-accent [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="shrink-0 font-serif text-2xl italic text-ink-faint transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-2xl pb-7 text-[15px] leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
