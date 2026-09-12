"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "@/components/toast";
import { Tooltip } from "@/components/tooltip";

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
  const bare = pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.endsWith("/sign");

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Header starts flush with the page and only picks up the glass material
  // once content has actually scrolled under it — a plain border looks like
  // clutter on a page short enough to never scroll.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    setScrolled(false);
  }, [pathname]);

  if (bare) return <ToastProvider>{children}</ToastProvider>;

  return (
    <ToastProvider>
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar isFounder={isFounder} queueCount={queueCount} userName={userName} userEmail={userEmail} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`relative z-10 flex items-center justify-between px-6 py-3 transition-colors duration-200 ${
            scrolled ? "rr-glass border-b border-border" : "border-b border-transparent"
          }`}
        >
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
            <Tooltip label="Notifications">
              <button aria-label="Notifications" className="rounded-xl border border-border p-2 text-muted transition-colors hover:bg-surface-subtle hover:text-foreground">
                <Bell size={16} />
              </button>
            </Tooltip>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
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
