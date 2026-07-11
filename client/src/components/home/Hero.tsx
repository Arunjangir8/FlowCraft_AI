import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import CanvasMock from "./CanvasMock";
import DotGrid from "./bits/DotGrid";
import { EASE, Magnetic, SplitLines } from "./motion";

/**
 * Pinned hero scene: the copy holds still while the canvas-window mock
 * rises from the bottom edge and drifts up over it as you scroll — the
 * product literally covering the pitch. The inner viewport is sticky,
 * so the takeover stays inside the hero.
 *
 * The copy is masked with a hard cutoff synced to the mock's current
 * top edge: fully visible right up to that line, fully hidden past it —
 * no early fade before the mock arrives, no lingering peek after it's
 * passed. It reads as the copy sliding behind an opaque card, not
 * dissolving.
 *
 * Mobile vs desktop use separate scroll-transform ranges (mockYMobile /
 * mockYDesktop) so the mock settles at a different final position on
 * small screens — closing the empty gap under it — without needing any
 * JS viewport-width state. Visibility is switched with pure Tailwind
 * breakpoints (`sm:hidden` / `hidden sm:block`), which the browser
 * resolves before paint, so there's no state-update flash/jump like
 * you'd get from a matchMedia-driven boolean.
 */
export default function Hero() {
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Spring-smooth the raw scroll progress so every scroll-linked
  // transform below eases toward the scroll position instead of tracking
  // it 1:1 — kills the frame-stepped/jittery feel on trackpads and
  // touch. Low mass + high damping = follows closely, settles fast, no
  // rubber-band overshoot at the ends.
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  });

  // Mock: peeking at the bottom → covering the copy. `svh` (stable
  // viewport height), not `dvh` — `dvh` grows mid-gesture as the mobile
  // toolbar collapses, which desyncs this section's measured scroll
  // length from its actual height and leaves a dead gap once the pin
  // releases.
  //
  // Two ranges. The 16:9 mock is short (~30svh tall on a phone), so
  // parking its top near the top of the screen (like desktop) leaves a
  // big empty canvas region below it. Mobile instead rises from just
  // below the fold and settles LOW — card bottom near the viewport
  // bottom — so the card fills the lower screen and the copy stays
  // visible above it, with no dead space under the card. Desktop keeps
  // the original full-takeover near-top rest (6svh) since its landscape
  // mock nearly fills the viewport there.
  const mockYMobile = useTransform(progress, [0, 1], ["100svh", "66svh"]);
  const mockYDesktop = useTransform(progress, [0, 1], ["86svh", "6svh"]);

  const mockRotate = useTransform(progress, [0, 0.6], [4, 0]);
  const mockScale = useTransform(progress, [0, 1], [0.97, 1]);

  // Copy: settles back as the canvas takes over.
  const copyY = useTransform(progress, [0, 1], ["0svh", "-6svh"]);
  const copyScale = useTransform(progress, [0, 1], [1, 0.96]);

  // Mask painted across the full sticky viewport (same coordinate frame
  // as mockY): opaque until the mock's current top edge, transparent
  // right past it — a hard line, not a gradient blend. One mask per
  // breakpoint, driven by that breakpoint's own mockY.
  const copyMaskMobile = useTransform(
    mockYMobile,
    (v) => `linear-gradient(to bottom, black ${v}, transparent calc(${v} + 1px))`
  );
  const copyMaskDesktop = useTransform(
    mockYDesktop,
    (v) => `linear-gradient(to bottom, black ${v}, transparent calc(${v} + 1px))`
  );

  return (
    <section ref={ref} className="relative h-[145svh] sm:h-[200svh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* interactive dot paper + soft washes */}
        <DotGrid className="[mask-image:linear-gradient(to_bottom,black_30%,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
          <div className="absolute top-40 -right-40 h-[420px] w-[420px] rounded-full bg-coral/10 blur-[100px]" />
        </div>

        {/* ===================== MOBILE COPY ===================== */}
        <motion.div
          className="absolute inset-0 sm:hidden"
          style={{ WebkitMaskImage: copyMaskMobile, maskImage: copyMaskMobile }}
        >
          <motion.div
            style={{ y: copyY, scale: copyScale }}
            className="relative mx-auto max-w-6xl px-5 pt-32 will-change-transform sm:px-8 sm:pt-40"
          >
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/60 px-3.5 py-1.5 text-xs font-medium backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="shiny-text">A canvas that draws with you</span>
            </motion.p>

            <h1 className="max-w-4xl text-[clamp(2.8rem,7.5vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ink">
              <SplitLines
                lines={[
                  <>Think in lines,</>,
                  <>
                    not <span className="font-serif italic tracking-normal text-accent">documents</span>.
                  </>,
                ]}
              />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
              className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft"
            >
              Linea is an infinite canvas for ideas — sketch, diagram and map your
              thinking, invite your team in live, and let AI draw the parts you
              describe.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.65 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Magnetic>
                <Link
                  to={user ? "/dashboard" : "/login"}
                  className="group inline-flex h-13 items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-paper transition-colors duration-300 hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Start drawing — it’s free
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </Magnetic>
              <a
                href="#canvas"
                className="inline-flex h-13 items-center rounded-full border border-line bg-white/60 px-7 text-[15px] font-medium text-ink backdrop-blur transition-colors duration-300 hover:border-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                See how it works
              </a>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ===================== DESKTOP COPY ===================== */}
        <motion.div
          className="absolute inset-0 hidden sm:block"
          style={{ WebkitMaskImage: copyMaskDesktop, maskImage: copyMaskDesktop }}
        >
          <motion.div
            style={{ y: copyY, scale: copyScale }}
            className="relative mx-auto max-w-6xl px-5 pt-32 will-change-transform sm:px-8 sm:pt-40"
          >
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/60 px-3.5 py-1.5 text-xs font-medium backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="shiny-text">A canvas that draws with you</span>
            </motion.p>

            <h1 className="max-w-4xl text-[clamp(2.8rem,7.5vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ink">
              <SplitLines
                lines={[
                  <>Think in lines,</>,
                  <>
                    not <span className="font-serif italic tracking-normal text-accent">documents</span>.
                  </>,
                ]}
              />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
              className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft"
            >
              Linea is an infinite canvas for ideas — sketch, diagram and map your
              thinking, invite your team in live, and let AI draw the parts you
              describe.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.65 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Magnetic>
                <Link
                  to={user ? "/dashboard" : "/login"}
                  className="group inline-flex h-13 items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-paper transition-colors duration-300 hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Start drawing — it’s free
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </Magnetic>
              <a
                href="#canvas"
                className="inline-flex h-13 items-center rounded-full border border-line bg-white/60 px-7 text-[15px] font-medium text-ink backdrop-blur transition-colors duration-300 hover:border-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                See how it works
              </a>
            </motion.div>
          </motion.div>
        </motion.div>


        {/* ===================== MOBILE MOCK ===================== */}
        <motion.div
          style={{
            y: mockYMobile,
            rotateX: mockRotate,
            scale: mockScale,
            transformPerspective: 1200,
          }}
          className="absolute inset-x-0 top-0 z-10 mx-auto w-[min(72rem,calc(100%-2.5rem))] will-change-transform sm:hidden"
        >
          {/* takeover surface — paper extension of the card, dotted to
              match CanvasMock's canvas so it reads as one surface sliding
              over the copy instead of a flat block */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 bottom-[-300svh] rounded-t-2xl bg-paper"
            style={{
              backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.8 }}
            className="relative"
          >
            <CanvasMock />
          </motion.div>
        </motion.div>

        {/* ===================== DESKTOP MOCK ===================== */}
        <motion.div
          style={{ y: mockYDesktop, rotateX: mockRotate, scale: mockScale, transformPerspective: 1200 }}
          className="absolute inset-x-0 top-0 z-10 mx-auto w-[min(72rem,calc(100%-2.5rem))] will-change-transform hidden sm:block"
        >
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.8 }}
          >
            <CanvasMock />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}