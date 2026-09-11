"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Shared spring — fast, physical, interruptible. One config, reused everywhere
// per §22 "create a system, not random CSS per page."
export const springSnappy = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 };
export const springSoft = { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.9 };

export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay }}
    >
      {children}
    </motion.div>
  );
}

// Counts up/down to the target on change — used on every RR Pulse-style metric
// so a real number change is felt, never silently swapped. Takes a format
// *kind* rather than a function, since Server Components can't pass functions
// to Client Components.
export type NumberFormat = "money" | "percent" | "count";

function formatValue(n: number, kind: NumberFormat, fallbackDash: boolean): string {
  if (fallbackDash) return "—";
  if (kind === "money") return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  if (kind === "percent") return `${Math.round(n * 100)}%`;
  return String(Math.round(n));
}

export function AnimatedNumber({ value, kind, dash = false }: { value: number; kind: NumberFormat; dash?: boolean }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const prev = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const from = prev.current;
    const to = value;
    if (from === to) return;

    const duration = 600;
    const start = performance.now();
    let raf: number;
    let cancelled = false;
    function tick(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = to; // only commit once the animation actually finished a frame
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [value, reduced]);

  return <span className="tabular-nums">{formatValue(display, kind, dash)}</span>;
}

// Wraps a list of items with layout animation so removal (e.g. completing a
// Command Queue item) makes the remaining items smoothly reposition instead
// of teleporting — §8/§7 "remaining priorities reposition."
export function MotionList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.ul layout className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </motion.ul>
  );
}

export function MotionListItem({ children, className, layoutId }: { children: ReactNode; className?: string; layoutId?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.li
      layout
      layoutId={layoutId}
      initial={reduced ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.98 }}
      transition={springSnappy}
      className={className}
    >
      {children}
    </motion.li>
  );
}

export { motion, AnimatePresence };
