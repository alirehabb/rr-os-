"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "@/components/toast";
import { Tooltip } from "@/components/tooltip";

export default function AppShellClient({
  isFounder,
  isStaff,
  isRep,
  isClientOnly,
  queueCount,
  userName,
  userEmail,
  demoActive,
  notifications,
  children,
}: {
  isFounder: boolean;
  isStaff: boolean;
  isRep: boolean;
  isClientOnly: boolean;
  queueCount: number;
  userName: string;
  userEmail: string;
  demoActive: boolean;
  notifications: { id: string; title: string; href: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  useEffect(() => {
    setMobileNavOpen(false);
    setNotifOpen(false);
  }, [pathname]);
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
      <Sidebar
        isFounder={isFounder}
        isStaff={isStaff}
        isRep={isRep}
        isClientOnly={isClientOnly}
        queueCount={queueCount}
        userName={userName}
        userEmail={userEmail}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`relative z-10 flex items-center justify-between px-6 py-3 transition-colors duration-200 ${
            scrolled ? "rr-glass border-b border-border" : "border-b border-transparent"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-xl border border-border p-2 text-muted transition-colors hover:bg-surface-subtle hover:text-foreground lg:hidden"
            >
              <Menu size={16} />
            </button>
            <CommandPalette />
          </div>
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
            <div className="relative">
              <Tooltip label="Notifications">
                <button
                  aria-label="Notifications"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative rounded-xl border border-border p-2 text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
                >
                  <Bell size={16} />
                  {notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold leading-none text-white">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </Tooltip>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
                  >
                    <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-faint">Overdue</div>
                    {notifications.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-faint">Nothing overdue.</p>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto">
                        {notifications.map((n) => (
                          <li key={n.id} className="border-b border-border last:border-0">
                            <Link href={n.href} className="block px-3 py-2.5 text-sm text-foreground hover:bg-surface-subtle">
                              {n.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
