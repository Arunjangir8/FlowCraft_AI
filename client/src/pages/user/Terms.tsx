import { Link } from "react-router-dom";
import Nav from "../../components/home/Nav";
import { Reveal } from "../../components/home/motion";
import { useMenuItems } from "../../hooks/useMenuItems";

const SECTIONS = [
  {
    title: "Acceptable use",
    body: "Placeholder — describe what users may and may not do with Linea (e.g. no abuse, no illegal content, rate limits on AI usage).",
  },
  {
    title: "Your data",
    body: "Placeholder — describe what data is stored (drawings, AI messages, account info), how long it's kept, and how users can request deletion.",
  },
  {
    title: "AI features",
    body: "Placeholder — note that AI-generated content may be inaccurate, usage limits apply, and messages may be processed by third-party AI providers.",
  },
  {
    title: "Liability",
    body: "Placeholder — standard limitation-of-liability language; the service is provided as-is.",
  },
  {
    title: "Privacy",
    body: "Placeholder — how personal data (email, name, avatar) is collected, used, and protected.",
  },
  {
    title: "Contact",
    body: "Placeholder — support/contact email for questions about these terms.",
  },
];

export default function Terms() {
  const menuItems = useMenuItems();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Nav menuItems={menuItems} />

      <main className="mx-auto w-full max-w-2xl px-5 pt-28 pb-20 sm:px-8 sm:pt-32">
        <Reveal>
          <header className="border-b border-line pb-8">
            <Link to="/dashboard" className="text-sm text-ink-faint hover:text-ink">
              ← Dashboard
            </Link>
            <h1 className="mt-3 text-[clamp(1.6rem,4vw,2.4rem)] font-semibold tracking-[-0.02em] text-ink">
              Terms &amp; Policy
            </h1>
            <p className="mt-2 text-sm text-ink-faint">
              Placeholder content — replace with your actual terms of service and privacy policy.
            </p>
          </header>
        </Reveal>

        <div className="mt-8 flex flex-col gap-6">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.title} delay={Math.min(i + 1, 4)}>
              <section className="rounded-2xl border border-line bg-white/60 p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-ink">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
              </section>
            </Reveal>
          ))}
        </div>
      </main>
    </div>
  );
}
