import { createClient } from "@/lib/supabase/server";
import { createRep } from "./actions";
import { PageHeader, Button, Input } from "@/components/ui";
import { getDemoMode } from "@/lib/demoMode";
import TalentBoard from "./TalentBoard";

export default async function RepsPage() {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const [{ data: reps }, { data: assignments }] = await Promise.all([
    supabase
      .from("reps")
      .select(
        "id, full_name, email, phone, recruiting_status, capabilities, geography, timezone, linkedin_url, resume_url, intro_loom_url, sales_recording_url, offer_text, evidence_source, claimed_cash_collected, notes, community_waitlist, profile_id, is_demo",
      )
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
        <PageHeader title="Sales Talent" subtitle="Scouting and roster management, not a single applicant form." />

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

        <TalentBoard reps={reps ?? []} activeAccountCountByRep={Object.fromEntries(activeAccountCountByRep)} />
      </div>
    </div>
  );
}
