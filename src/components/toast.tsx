"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { springSnappy } from "@/components/motion";

type Toast = { id: number; message: string; tone: "success" | "danger" | "neutral" };
type ToastFn = (message: string, tone?: Toast["tone"]) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const TONE_CLASS: Record<Toast["tone"], string> = {
  success: "border-success/30 bg-success-bg text-success",
  danger: "border-danger/30 bg-danger-bg text-danger",
  neutral: "border-border bg-surface text-foreground",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback<ToastFn>((message, tone = "neutral") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={springSnappy}
              className={`rr-glass pointer-events-auto rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${TONE_CLASS[t.tone]}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
