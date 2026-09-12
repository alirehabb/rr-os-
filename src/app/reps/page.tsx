import { createClient } from "@/lib/supabase/server";
import { createRep } from "./actions";
import { PageHeader, LinkCard, Badge, Button, Input, Avatar } from "@/components/ui";
import { getDemoMode } from "@/lib/demoMode";

const STATUS_TONE = {
  application: "neutral",
  screening: "neutral",
  interview: "accent",
  talent_pool: "neutral",
  rejected: "danger",
  available_for_matching: "accent",
  selected: "accent",
  client_training: "warning",
  live_trial: "warning",
  confirmed_active: "success",
  bench: "warning",
  removed: "danger",
} as const;

// Recruiting flow, grouped into a real scouting board: Applicants -> Review
// -> Talent Pool -> Matched -> Trial -> Active, with Bench/Removed off to
// the side. This is roster management, not a single flat applicant table.
const GROUPS: { label: string; statuses: (keyof typeof STATUS_TONE)[] }[] = [
  { label: "Applicants", statuses: ["application"] },
  { label: "Review", statuses: ["screening", "interview"] },
  { label: "Talent Pool", statuses: ["talent_pool", "available_for_matching", "selected"] },
  { label: "Matched", statuses: ["client_training"] },
  { label: "Trial", statuses: ["live_trial"] },
  { label: "Active", statuses: ["confirmed_active"] },
  { label: "Bench", statuses: ["bench"] },
  { label: "Removed", statuses: ["removed", "rejected"] },
];

export default async function RepsPage() {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const [{ data: reps }, { data: assignments }] = await Promise.all([
    supabase
      .from("reps")
      .select("id, full_name, email, recruiting_status, capabilities, is_demo")
      .eq("is_benchmark", false)
      .eq("is_demo", demoMode)
      .order("created_at", { ascending: false }),
    supabase.from("rep_assignments").select("rep_id, status").eq("status", "active"),
  ]);

  const activeAccountCountByRep = new Map<string, number>();
  for (const a of assignments ?? []) {
    activeAccountCountByRep.set(a.rep_id, (activeAccountCountByRep.get(a.rep_id) ?? 0) + 1);
  }

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <PageHeader title="Sales Talent" subtitle="Scouting and roster management — not a single applicant form." />

        <details className="mb-8 rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground">+ Add applicant</summary>
          <form action={createRep} className="space-y-3 border-t border-border p-4">
            <div className="flex gap-2">
              <Input name="full_name" required placeholder="Full name" className="flex-1" />
              <Input name="email" type="email" required placeholder="Email" className="flex-1" />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="capabilities" value="closer" className="accent-[var(--accent)]" /> Closer
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="capabilities" value="setter" className="accent-[var(--accent)]" /> Setter
              </label>
              <Input name="geography" placeholder="Geography" className="w-auto" />
              <Input name="timezone" placeholder="Timezone" className="w-auto" />
              <Input name="claimed_cash_collected" type="number" placeholder="Claimed cash collected" className="w-auto" />
            </div>
            <Input name="evidence_source" placeholder="Evidence source (Loom link, referral, past recordings...)" />
            <Button>Add applicant</Button>
          </form>
        </details>

        <div className="space-y-8">
          {GROUPS.map((group) => {
            const groupReps = (reps ?? []).filter((r) => group.statuses.includes(r.recruiting_status as keyof typeof STATUS_TONE));
            if (groupReps.length === 0) return null;
            return (
              <section key={group.label}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                  <Badge tone="neutral">{groupReps.length}</Badge>
                </div>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {groupReps.map((r) => (
                    <li key={r.id}>
                      <LinkCard href={`/reps/${r.id}`} className="flex flex-col items-center gap-3 p-5 text-center">
                        <Avatar name={r.full_name} />
                        <div>
                          <p className="font-medium text-foreground">{r.full_name}</p>
                          <p className="mt-0.5 text-xs text-muted">{r.capabilities.join(" · ") || "no role set"}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {r.is_demo && <Badge tone="accent">Demo</Badge>}
                          <Badge tone={STATUS_TONE[r.recruiting_status]}>{r.recruiting_status.replace(/_/g, " ")}</Badge>
                        </div>
                        {(activeAccountCountByRep.get(r.id) ?? 0) > 0 && (
                          <p className="text-[11px] text-faint">{activeAccountCountByRep.get(r.id)} active account(s)</p>
                        )}
                      </LinkCard>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {(reps ?? []).length === 0 && <p className="text-sm text-faint">No applicants yet.</p>}
        </div>
      </div>
    </div>
  );
}
