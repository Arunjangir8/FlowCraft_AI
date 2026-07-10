import { motion, useScroll, useTransform } from "framer-motion";
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
    offset: ["start start", "end start"],
  });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const mockRotate = useTransform(scrollYProgress, [0, 0.5], [4, 0]);
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  return (
    <section ref={ref} className="relative overflow-hidden pt-36 sm:pt-44">
      {/* interactive dot paper + soft drifting washes */}
      <DotGrid className="[mask-image:linear-gradient(to_bottom,black_20%,transparent_85%)]" />
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ y: bgY }}>
        <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute top-40 -right-40 h-[420px] w-[420px] rounded-full bg-coral/10 blur-[100px]" />
      </motion.div>

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
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

        {/* product, demonstrated */}
        <motion.div
          style={{ y: mockY, rotateX: mockRotate, transformPerspective: 1200 }}
          className="mt-20 will-change-transform sm:mt-24"
        >
          <motion.div
            initial={{ opacity: 0, y: 80 }}
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
