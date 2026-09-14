"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { springSnappy } from "@/components/motion";

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; tone: "success" | "danger" | "neutral"; action?: ToastAction };
type ToastFn = (message: string, tone?: Toast["tone"], action?: ToastAction) => void;

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

  // Undoable actions (a completed/dismissed/moved item) get a longer window
  // and a visible button — 3s is enough to notice a plain confirmation, not
  // enough to actually click Undo.
  const push = useCallback<ToastFn>((message, tone = "neutral", action) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 8000 : 3000);
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
              className={`rr-glass pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${TONE_CLASS[t.tone]}`}
            >
              {t.message}
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    setToasts((cur) => cur.filter((x) => x.id !== t.id));
                  }}
                  className="rounded-lg bg-black/10 px-2 py-1 text-xs font-semibold underline underline-offset-2 hover:bg-black/15"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
