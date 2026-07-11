import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import { EASE, Magnetic } from "./motion";

export function LineaMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M6 24C10 10 14 7 16 7c3 0 1 17 4 17 2.5 0 4-8 6-8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const links = [
  { label: "Canvas", href: "#canvas" },
  { label: "AI", href: "#ai" },
  { label: "Together", href: "#together" },
  { label: "FAQ", href: "#faq" },
];

const NAV_H = 64; // h-16

/** Absolute document top via the offsetParent chain. WARNING: a
 *  `position: sticky` element's own offsetTop reports its *stuck* offset in
 *  Chrome (scroll-dependent), so never pass a sticky node here — pass a
 *  statically-positioned ancestor instead. */
function absoluteTop(el: HTMLElement) {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

/**
 * Scroll target for a nav hash. Sections inside SheetStack are vertically
 * centered in a full-height, `sticky` "sheet"; a plain anchor jump targets
 * the inner section's mid-sheet position, fights the pin, and lands on the
 * wrong sheet. We want the sheet's *flow* top — but a sticky element's
 * offsetTop/rect both report its current stuck position, which drifts with
 * scroll and makes the scroll "walk" toward the target over several clicks.
 * So build it from scroll-stable numbers: the non-sticky SheetStack
 * container's absolute top + the summed heights of the preceding sheets.
 */
function targetTop(el: HTMLElement) {
  const sheet = el.closest("[data-sheet]") as HTMLElement | null;
  const container = sheet?.parentElement;
  if (!sheet || !container) return absoluteTop(el); // non-stacked (e.g. #faq)
  let flow = 0;
  for (const child of container.children) {
    if (child === sheet) break;
    if (child.matches("[data-sheet]")) flow += (child as HTMLElement).offsetHeight;
  }
  return absoluteTop(container) + flow;
}

function scrollToHash(e: MouseEvent<HTMLAnchorElement>, href: string) {
  const el = document.getElementById(href.slice(1));
  if (!el) return; // no target → let the browser do its default thing
  e.preventDefault();
  window.scrollTo({ top: targetTop(el) - NAV_H, behavior: "smooth" });
}

export default function Nav() {
  const { user } = useAuth();
  const location = useLocation();
  const onDashboard = location.pathname.startsWith("/dashboard");
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > 24));

  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
        solid
          ? "bg-paper/80 shadow-[0_1px_0_0_var(--color-line)] backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <LineaMark />
          <span className="text-[17px] font-semibold tracking-tight">Linea</span>
        </Link>

        {location.pathname === "/" && (
          <div className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => scrollToHash(e, l.href)}
                className="text-sm text-ink-soft transition-colors duration-300 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent outline-none rounded"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        <Magnetic strength={0.2}>
          <Link
            to={!user ? "/login" : onDashboard ? "/" : "/dashboard"}
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors duration-300 hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {!user ? "Sign in" : onDashboard ? "Home" : "Open studio"}
          </Link>
        </Magnetic>
      </nav>
    </motion.header>
  );
}
