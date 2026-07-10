import { useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import { LineaMark } from "./Nav";
import VariableProximity from "./bits/VariableProximity";
import { Magnetic, Reveal } from "./motion";

export default function Closing() {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <>
      <section
        ref={sectionRef}
        className="relative overflow-hidden px-5 py-32 text-center sm:px-8 sm:py-44"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[110px]"
        />
        <Reveal>
          <h2 className="relative mx-auto max-w-3xl text-[clamp(2.2rem,6vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
            <VariableProximity label="The next idea deserves" containerRef={sectionRef} />{" "}
            <span className="font-serif italic tracking-normal text-accent">a bigger page.</span>
          </h2>
        </Reveal>
        <Reveal delay={2}>
          <div className="relative mt-12">
            <Magnetic>
              <Link
                to={user ? "/dashboard" : "/login"}
                className="group inline-flex h-14 items-center gap-2 rounded-full bg-ink px-9 text-base font-medium text-paper transition-colors duration-300 hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Open your canvas
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Magnetic>
            <p className="mt-5 text-sm text-ink-faint">
              Free plan · No card required · Sign in with Google
            </p>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-ink">
              <LineaMark className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-tight">Linea</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              The thinking canvas — sketch, diagram and collaborate live, with
              AI that draws what you describe.
            </p>
          </div>
          <nav aria-label="Product">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Product
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                ["The canvas", "#canvas"],
                ["AI drawing", "#ai"],
                ["Collaboration", "#together"],
                ["FAQ", "#faq"],
              ].map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="rounded text-ink-soft outline-none transition-colors duration-300 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Account">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Account
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  to={user ? "/dashboard" : "/login"}
                  className="rounded text-ink-soft outline-none transition-colors duration-300 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {user ? "Dashboard" : "Sign in"}
                </Link>
              </li>
              <li>
                <Link
                  to={user ? "/draw" : "/login"}
                  className="rounded text-ink-soft outline-none transition-colors duration-300 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                >
                  New board
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-5 py-6 text-xs text-ink-faint sm:px-8">
            © {year} Linea. Sketch first, explain later.
          </p>
        </div>
      </footer>
    </>
  );
}
