"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

export function Tabs({ tabs }: { tabs: { key: string; label: string; badge?: ReactNode; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              t.key === active ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.badge}
            {t.key === active && (
              <motion.div layoutId="tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={activeTab?.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
          {activeTab?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
