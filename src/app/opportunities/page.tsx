import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
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
  const [{ data: opportunities }, { data: clients }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, prospect_name, stage, value, client_id")
      .order("first_booked_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
  ]);
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex-1">
      <NavBar />
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
                <Badge tone={STAGE_TONE[o.stage]}>{o.stage.replace("_", " ")}</Badge>
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
