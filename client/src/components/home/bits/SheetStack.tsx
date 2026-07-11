import { motion, useScroll, useTransform } from "framer-motion";
import {
  createRef,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export default function SheetStack({
  children,
  bareSheets = [],
}: {
  children: ReactNode[];
  bareSheets?: number[];
}) {
  const sheets = children.filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refs = useMemo(() => sheets.map(() => createRef<HTMLDivElement>()), [sheets.length]);

  return (
    <div className="relative">
      {sheets.map((child, i) => (
        <Sheet
          key={i}
          ref={refs[i]}
          nextRef={i < sheets.length - 1 ? refs[i + 1] : null}
          index={i}
          count={sheets.length}
          tilt={i % 2 === 0 ? -0.7 : 0.7}
          bare={bareSheets.includes(i)}
        >
          {child}
        </Sheet>
      ))}
    </div>
  );
}

function Sheet({
  ref,
  nextRef,
  index,
  count,
  tilt,
  bare,
  children,
}: {
  ref: RefObject<HTMLDivElement | null>;
  nextRef: RefObject<HTMLDivElement | null> | null;
  index: number;
  count: number;
  tilt: number;
  bare: boolean;
  children: ReactNode;
}) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const { scrollYProgress: covered } = useScroll({
    target: nextRef ?? ref,
    offset: ["start end", "start start"],
  });
  const scale = useTransform(covered, [0, 1], [1, 0.955]);
  const rotate = useTransform(covered, [0, 1], [0, tilt]);
  const filter = useTransform(covered, [0, 1], ["brightness(1)", "brightness(0.92)"]);

  return (
    <div
      ref={ref}
      data-sheet
      className="sticky"
      style={{
        top: `min(0px, calc(100dvh - ${height}px))`,
        zIndex: index + 1,
      }}
    >
      <motion.div
        style={nextRef ? { scale, rotate, filter } : undefined}
        className={`relative flex min-h-dvh flex-col justify-center will-change-transform ${
          bare
            ? ""
            : `overflow-clip bg-paper ${
                index > 0
                  ? "rounded-t-[2.5rem] border-t border-line shadow-[0_-28px_56px_-28px_rgba(26,25,23,0.35)]"
                  : ""
              }`
        }`}
      >
        {children}
        {!bare && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-6 right-8 font-serif text-sm italic text-ink-faint"
          >
            {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
        )}
      </motion.div>
    </div>
  );
}
