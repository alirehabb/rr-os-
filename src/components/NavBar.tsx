"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "",
    links: [
      { href: "/", label: "Home" },
      { href: "/brief", label: "Brief" },
      { href: "/my", label: "My Workspace" },
    ],
  },
  {
    label: "Revenue",
    links: [
      { href: "/prospects", label: "RR CRM" },
      { href: "/clients", label: "Clients" },
      { href: "/opportunities", label: "Opportunities" },
      { href: "/finance", label: "Finance" },
    ],
  },
  {
    label: "People",
    links: [
      { href: "/reps", label: "Talent" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    label: "Ops",
    links: [
      { href: "/documents", label: "Documents" },
      { href: "/connections", label: "Connections" },
      { href: "/settings/rr-score", label: "RR Score" },
    ],
  },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Link href="/" className="mr-3 flex shrink-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-sm font-semibold tracking-tight text-foreground">Rehab Revenue OS</span>
          </Link>
          {GROUPS.map((group, i) => (
            <div key={i} className="flex shrink-0 items-center">
              {group.links.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface-subtle hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
              {i < GROUPS.length - 1 && <span className="mx-1 h-4 w-px shrink-0 bg-border" />}
            </div>
          ))}
        </div>
        <SignOutButton />
      </div>
    </nav>
  );
}
