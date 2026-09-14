import { createClient } from "@/lib/supabase/server";
import { getDemoMode } from "@/lib/demoMode";
import { PageHeader, LinkCard, Badge, EmptyState } from "@/components/ui";

const STAGE_TONE = {
  upstream: "neutral",
  booked: "accent",
  follow_up: "warning",
  won: "success",
  lost: "danger",
} as const;

export default async function OpportunitiesPage() {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const [{ data: opportunities }, { data: clients }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, prospect_name, stage, custom_stage_label, value, client_id, is_demo")
      .eq("is_demo", demoMode)
      .order("first_booked_at", { ascending: false }),
    supabase.from("clients").select("id, name").eq("is_demo", demoMode),
  ]);
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader title="Opportunities" />
        <ul className="space-y-2">
          {(opportunities ?? []).map((o) => (
            <li key={o.id}>
              <LinkCard href={`/opportunities/${o.id}`} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{o.prospect_name}</p>
                  <p className="text-sm text-muted">{clientNameById.get(o.client_id) ?? "Unknown client"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {o.is_demo && <Badge tone="accent">Demo</Badge>}
                  <Badge tone={STAGE_TONE[o.stage]}>{o.custom_stage_label ?? o.stage.replace("_", " ")}</Badge>
                </div>
              </LinkCard>
            </li>
          ))}
          {(opportunities ?? []).length === 0 && (
            <EmptyState title="No booked calls yet." hint="Log one from a Client 360 page." />
          )}
        </ul>
      </div>
    </div>
  );
}
