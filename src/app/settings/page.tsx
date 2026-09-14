import { PageHeader, LinkCard } from "@/components/ui";
import { SlidersHorizontal, Target, FlaskConical, BellRing, Users } from "lucide-react";

const PAGES = [
  { href: "/settings/users", label: "Users", desc: "Invite, suspend, and manage roles and client access", icon: Users },
  { href: "/settings/targets", label: "Founder Targets", desc: "Monthly revenue and deal goals for Founder Progress", icon: Target },
  { href: "/settings/rr-score", label: "RR Score Configuration", desc: "Weights for the leaderboard's overall score", icon: SlidersHorizontal },
  { href: "/settings/chasing", label: "Automatic Chasing", desc: "Daily overdue-condition sweep, posts to Slack", icon: BellRing },
  { href: "/settings/demo", label: "Demo Data Mode", desc: "Populate the OS with a fictional scenario for testing", icon: FlaskConical },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <PageHeader title="Settings" />
      <ul className="space-y-2">
        {PAGES.map((p) => (
          <li key={p.href}>
            <LinkCard href={p.href} className="flex items-center gap-3">
              <p.icon size={18} className="text-accent" />
              <div>
                <p className="font-medium text-foreground">{p.label}</p>
                <p className="text-sm text-muted">{p.desc}</p>
              </div>
            </LinkCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
