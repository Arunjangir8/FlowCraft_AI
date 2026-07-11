import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import CanvasMock from "./CanvasMock";
import DotGrid from "./bits/DotGrid";
import { EASE, Magnetic, SplitLines } from "./motion";

export default function Hero() {
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  });

  const mockYMobile = useTransform(progress, [0, 1], ["100svh", "66svh"]);
  const mockYDesktop = useTransform(progress, [0, 1], ["86svh", "6svh"]);

  const mockRotate = useTransform(progress, [0, 0.6], [4, 0]);
  const mockScale = useTransform(progress, [0, 1], [0.97, 1]);

  const copyY = useTransform(progress, [0, 1], ["0svh", "-6svh"]);
  const copyScale = useTransform(progress, [0, 1], [1, 0.96]);

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
        <DotGrid className="[mask-image:linear-gradient(to_bottom,black_30%,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
          <div className="absolute top-40 -right-40 h-[420px] w-[420px] rounded-full bg-coral/10 blur-[100px]" />
        </div>

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

        <motion.div
          style={{
            y: mockYMobile,
            rotateX: mockRotate,
            scale: mockScale,
            transformPerspective: 1200,
          }}
          className="absolute inset-x-0 top-0 z-10 mx-auto w-[min(72rem,calc(100%-2.5rem))] will-change-transform sm:hidden"
        >
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
