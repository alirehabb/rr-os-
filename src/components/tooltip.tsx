"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
