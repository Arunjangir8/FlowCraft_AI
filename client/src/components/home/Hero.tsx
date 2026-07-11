import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import CanvasMock from "./CanvasMock";
import DotGrid from "./bits/DotGrid";
import { EASE, Magnetic, SplitLines } from "./motion";

/**
 * Pinned hero scene: the copy holds still while the canvas-window mock
 * rises from the bottom edge and drifts up over it as you scroll — the
 * product literally covering the pitch. The scene spans 200dvh; the
 * inner viewport is sticky, so the takeover stays inside the hero.
 *
 * The copy is masked (not just globally faded) so it visually
 * disappears exactly where the mock's top edge currently sits: fully
 * visible above it, a soft fade across the top ~40% of the mock's own
 * height, fully hidden beneath that — nothing ever peeks out from
 * under the card, and by the time the mock finishes rising the copy
 * has faded away completely.
 */
export default function Hero() {
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Mock: peeking at the bottom → covering the copy.
  const mockY = useTransform(scrollYProgress, [0, 1], ["76dvh", "6dvh"]);
  const mockRotate = useTransform(scrollYProgress, [0, 0.6], [4, 0]);
  const mockScale = useTransform(scrollYProgress, [0, 1], [0.97, 1]);

  // Copy: settles back as the canvas takes over.
  const copyY = useTransform(scrollYProgress, [0, 1], ["0dvh", "-6dvh"]);
  const copyScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  // Measure the mock's rendered height so the fade band below can be a
  // real fraction of it (40%) instead of a guessed constant.
  const mockRef = useRef<HTMLDivElement>(null);
  const [mockHeight, setMockHeight] = useState(600);
  useEffect(() => {
    const el = mockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setMockHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const bandVh = Math.min(60, (mockHeight * 0.4 / viewportHeight) * 100);

  // Mask painted across the full sticky viewport (same coordinate frame
  // as mockY), so it fades the copy exactly where the mock's edge is —
  // opaque above the band, fading through it, transparent at and below
  // the mock's current top edge.
  const copyMask = useTransform(
    mockY,
    (v) => `linear-gradient(to bottom, black 0, black calc(${v} - ${bandVh}dvh), transparent ${v})`
  );

  return (
    <section ref={ref} className="relative h-[200dvh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* interactive dot paper + soft washes */}
        <DotGrid className="[mask-image:linear-gradient(to_bottom,black_30%,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
          <div className="absolute top-40 -right-40 h-[420px] w-[420px] rounded-full bg-coral/10 blur-[100px]" />
        </div>

        {/* hero copy, masked to fade under the rising mock */}
        <motion.div
          className="absolute inset-0"
          style={{ WebkitMaskImage: copyMask, maskImage: copyMask }}
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

        {/* the canvas window, riding up over the copy */}
        <motion.div
          style={{ y: mockY, rotateX: mockRotate, scale: mockScale, transformPerspective: 1200 }}
          className="absolute inset-x-0 top-0 z-10 mx-auto w-[min(72rem,calc(100%-2.5rem))] will-change-transform"
        >
          <motion.div
            ref={mockRef}
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
