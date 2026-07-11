import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { EASE } from "../motion";

export type StaggeredMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  // Route this item links to — lets the menu mark it as the current page.
  path?: string;
};

/**
 * Hamburger button that opens a full-screen overlay with a staggered
 * reveal of menu links — adapted from React Bits StaggeredMenu for the
 * paper theme.
 */
export default function StaggeredMenu({
  items,
  label,
  extra,
}: {
  items: StaggeredMenuItem[];
  label?: string;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="relative z-50 inline-flex h-10 items-center gap-4 rounded-full border border-line bg-white/60 px-3 backdrop-blur transition-colors duration-300 hover:border-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {label && <span className="hidden text-sm font-medium text-ink-soft sm:inline">{label}</span>}
        <span className="flex h-4 w-5 flex-col items-center justify-center gap-1">
          <motion.span
            animate={open ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="h-[1.5px] w-5 bg-ink"
          />
          <motion.span
            animate={open ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="h-[1.5px] w-5 bg-ink"
          />
          <motion.span
            animate={open ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="h-[1.5px] w-5 bg-ink"
          />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-0 z-40 flex flex-col items-end justify-start bg-paper/95 px-6 pt-24 backdrop-blur-md sm:px-10 sm:pt-28"
            onClick={() => setOpen(false)}
          >
            <nav className="flex flex-col items-end gap-2">
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-ink-faint"
              >
                Menu
              </motion.p>
              {items.map((item, i) => {
                const isActive = !!item.path && location.pathname === item.path;
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.35, ease: EASE, delay: (i + 1) * 0.06 }}
                    aria-disabled={isActive}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      if (!isActive) item.onClick();
                    }}
                    className={`text-2xl uppercase tracking-tight transition-colors duration-300 sm:text-3xl ${
                      isActive
                        ? "font-normal text-ink-faint/60 line-through"
                        : item.danger
                        ? "font-medium text-coral hover:text-coral/80"
                        : "font-medium text-ink hover:text-accent"
                    }`}
                  >
                    {item.label}
                  </motion.button>
                );
              })}
              {extra && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.35, ease: EASE, delay: (items.length + 1) * 0.06 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {extra}
                </motion.div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
