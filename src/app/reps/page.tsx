import { createClient } from "@/lib/supabase/server";
import { createRep } from "./actions";
import { PageHeader, LinkCard, Badge, Button, Input } from "@/components/ui";

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

export default async function RepsPage() {
  const supabase = await createClient();
  const { data: reps } = await supabase
    .from("reps")
    .select("id, full_name, email, recruiting_status, capabilities, is_demo")
    .eq("is_benchmark", false)
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader title="Sales Talent" />

        <form action={createRep} className="mb-8 space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
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

        <ul className="space-y-2">
          {(reps ?? []).map((r) => (
            <li key={r.id}>
              <LinkCard href={`/reps/${r.id}`} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{r.full_name}</p>
                  <p className="text-sm text-muted">
                    {r.email} · {r.capabilities.join(", ") || "no role set"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_demo && <Badge tone="accent">Demo</Badge>}
                  <Badge tone={STATUS_TONE[r.recruiting_status]}>{r.recruiting_status.replace(/_/g, " ")}</Badge>
                </div>
              </LinkCard>
            </li>
          ))}
          {(reps ?? []).length === 0 && <p className="text-sm text-faint">No applicants yet.</p>}
        </ul>
      </div>
    </div>
  );
}
