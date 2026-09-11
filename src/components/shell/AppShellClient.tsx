"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "@/components/toast";

export default function AppShellClient({
  isFounder,
  queueCount,
  userName,
  userEmail,
  demoActive,
  children,
}: {
  isFounder: boolean;
  queueCount: number;
  userName: string;
  userEmail: string;
  demoActive: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare = pathname.startsWith("/login") || pathname.startsWith("/auth");

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (bare) return <ToastProvider>{children}</ToastProvider>;

  return (
    <ToastProvider>
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar isFounder={isFounder} queueCount={queueCount} userName={userName} userEmail={userEmail} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="rr-glass relative z-10 flex items-center justify-between border-b border-border px-6 py-3">
          <CommandPalette />
          <div className="flex items-center gap-3">
            {demoActive && (
              <Link
                href="/settings/rr-score"
                className="flex items-center gap-1.5 rounded-full bg-demo/15 px-3 py-1 text-xs font-medium text-demo"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-demo" />
                Demo Data
              </Link>
            )}
            {now && (
              <div className="text-right leading-tight">
                <p className="text-xs text-faint">{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="text-sm font-medium tabular-nums text-foreground">
                  {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            )}
            <button className="rounded-xl border border-border p-2 text-muted transition-colors hover:bg-surface-subtle hover:text-foreground">
              <Bell size={16} />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
