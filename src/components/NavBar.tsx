import Link from "next/link";
import SignOutButton from "./SignOutButton";

const links = [
  { href: "/", label: "Home" },
  { href: "/brief", label: "Brief" },
  { href: "/my", label: "My Workspace" },
  { href: "/prospects", label: "RR CRM" },
  { href: "/clients", label: "Clients" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/reps", label: "Talent" },
  { href: "/finance", label: "Finance" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/documents", label: "Documents" },
  { href: "/connections", label: "Connections" },
  { href: "/settings/rr-score", label: "RR Score Config" },
];

export default function NavBar() {
  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-neutral-100">Rehab Revenue OS</span>
          <div className="flex gap-4 text-sm text-neutral-400">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-neutral-100">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <SignOutButton />
      </div>
    </nav>
  );
}
