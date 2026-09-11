"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ListChecks,
  Briefcase,
  Building2,
  Target,
  Wallet,
  Users,
  Trophy,
  FileText,
  Plug,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof Home; badge?: number };

export default function Sidebar({
  isFounder,
  queueCount,
  userName,
  userEmail,
}: {
  isFounder: boolean;
  queueCount: number;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  const primary: NavItem[] = [
    { href: "/", label: "Home", icon: Home },
    { href: "/", label: "Command Queue", icon: ListChecks, badge: queueCount },
    { href: "/my", label: "My Workspace", icon: Briefcase },
  ];

  const founderGroups: { label: string; items: NavItem[] }[] = isFounder
    ? [
        {
          label: "Revenue",
          items: [
            { href: "/prospects", label: "RR CRM", icon: Sparkles },
            { href: "/clients", label: "Clients", icon: Building2 },
            { href: "/opportunities", label: "Opportunities", icon: Target },
            { href: "/finance", label: "Finance", icon: Wallet },
          ],
        },
        {
          label: "People",
          items: [
            { href: "/reps", label: "Talent", icon: Users },
            { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
          ],
        },
        {
          label: "Operations",
          items: [
            { href: "/documents", label: "Documents", icon: FileText },
            { href: "/connections", label: "Connections", icon: Plug },
            { href: "/settings", label: "Settings", icon: SlidersHorizontal },
          ],
        },
      ]
    : [];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-fg">
          R
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">Rehab Revenue OS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <NavGroup items={primary} isActive={isActive} />

        {founderGroups.map((group) => (
          <div key={group.label} className="mt-5">
            <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-faint">{group.label}</p>
            <NavGroup items={group.items} isActive={isActive} />
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-subtle">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs text-faint">{userEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavGroup({ items, isActive }: { items: NavItem[]; isActive: (href: string) => boolean }) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm transition-colors ${
              active ? "bg-accent/12 font-medium text-accent" : "text-muted hover:bg-surface-subtle hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Icon size={16} strokeWidth={2} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
              {item.label}
            </span>
            {!!item.badge && (
              <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
