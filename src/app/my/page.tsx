import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, SectionTitle, StatTile, Card, Badge, EmptyState } from "@/components/ui";
import { AnimatedNumber } from "@/components/motion";
import ResourceList from "@/components/ResourceList";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// §13.1/§13.2 — Closer Home / Setter Home. This is the rep's own scoped view:
// RLS (rep_own_*) already guarantees they see only their own opportunities,
// calls, and wallet — never another rep's pipeline or payout details (§20).
export default async function MyWorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isFounder = (roles ?? []).some((r) => r.role === "founder");

  const { data: rep } = await supabase.from("reps").select("*").eq("profile_id", user.id).single();

  // Founder OS is Home — "My Workspace" is a rep concept and would otherwise
  // dead-end for a founder with no linked rep profile of their own.
  if (!rep && isFounder) redirect("/");

  if (!rep) {
    return (
      <div className="flex-1">
        <div className="mx-auto max-w-lg px-6 py-10">
          <EmptyState
            title="No rep profile linked"
            hint="Ask the founder to link your login to your Sales Talent profile."
          />
        </div>
      </div>
    );
  }

  const isSetter = rep.capabilities.includes("setter");
  const isCloser = rep.capabilities.includes("closer");

  const [{ data: ownedOpps }, { data: setterOpps }, { data: wallet }, { data: assignments }] = await Promise.all([
    isCloser
      ? supabase
          .from("opportunities")
          .select("id, prospect_name, stage, client_id")
          .eq("owner_rep_id", rep.id)
          .order("first_booked_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    isSetter
      ? supabase
          .from("opportunities")
          .select("id, prospect_name, stage, client_id")
          .eq("setter_rep_id", rep.id)
          .order("first_booked_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("wallet_entries").select("amount, status").eq("rep_id", rep.id),
    supabase.from("rep_assignments").select("id, client_id, role, status, booking_link").eq("rep_id", rep.id),
  ]);

  const myPlatformRoles = (roles ?? []).map((r) => r.role);
  const { data: resourceAssignments } = await supabase
    .from("knowledge_assignments")
    .select("id, viewed_at, acknowledged_at, knowledge_items(id, title, type, body, external_url, storage_path)")
    .or([`rep_id.eq.${rep.id}`, ...myPlatformRoles.map((r) => `role.eq.${r}`)].join(","));

  const oppIds = (ownedOpps ?? []).map((o) => o.id);
  const { data: calls } = oppIds.length
    ? await supabase
        .from("calls")
        .select("id, opportunity_id, scheduled_at, outcome, next_call_at")
        .in("opportunity_id", oppIds)
    : { data: [] };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const todaysCalls = (calls ?? []).filter((c) => {
    const t = new Date(c.scheduled_at);
    return t >= today && t < tomorrow;
  });
  const overdueFollowUps = (calls ?? []).filter((c) => c.next_call_at && new Date(c.next_call_at) < new Date());

  const attended = (ownedOpps ?? []).filter((o) => o.stage === "won" || o.stage === "lost");
  const won = (ownedOpps ?? []).filter((o) => o.stage === "won");
  const closeRate = attended.length > 0 ? Math.round((won.length / attended.length) * 100) : null;

  // Real momentum signal, not invented: consecutive wins counting back from
  // the most recent attended call (ownedOpps is already ordered by
  // first_booked_at desc, so filtering preserves recency order).
  let winStreak = 0;
  for (const o of attended) {
    if (o.stage === "won") winStreak++;
    else break;
  }

  const earned = (wallet ?? []).reduce((s, w) => s + Number(w.amount), 0);
  const paid = (wallet ?? []).filter((w) => w.status === "paid").reduce((s, w) => s + Number(w.amount), 0);
  const outstanding = earned - paid;

  const oppById = new Map([...(ownedOpps ?? []), ...(setterOpps ?? [])].map((o) => [o.id, o]));

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          title={`${rep.full_name}'s Workspace`}
          subtitle={rep.capabilities.join(" · ")}
          action={
            winStreak >= 2 ? (
              <span className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning-bg px-3 py-1.5 text-sm font-medium text-warning shadow-[0_0_16px_-4px_rgba(234,179,8,0.5)]">
                🔥 {winStreak}-win streak
              </span>
            ) : undefined
          }
        />

        {/* Closer workspace is the OS's gamified surface — momentum-driven,
            numbers tick up live, same energy as the Leaderboard. */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Today's calls" value={String(todaysCalls.length)} />
          <StatTile label="Close rate" value={closeRate === null ? "—" : `${closeRate}%`} />
          <Card className="rr-fade-up">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Earned to date</p>
            <p className="mt-1.5 text-xl font-semibold text-success">
              <AnimatedNumber value={earned} kind="money" />
            </p>
          </Card>
          <Card className="rr-fade-up">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Outstanding payout</p>
            <p className={`mt-1.5 text-xl font-semibold ${outstanding > 0 ? "text-accent" : "text-foreground"}`}>
              <AnimatedNumber value={outstanding} kind="money" />
            </p>
          </Card>
        </section>

        {overdueFollowUps.length > 0 && (
          <section className="mb-8">
            <SectionTitle>
              <span className="text-warning">Overdue follow-ups</span>
            </SectionTitle>
            <ul className="space-y-1 text-sm">
              {overdueFollowUps.map((c) => (
                <li key={c.id} className="text-muted">
                  <Link href={`/opportunities/${c.opportunity_id}`} className="text-foreground hover:underline">
                    {oppById.get(c.opportunity_id)?.prospect_name ?? "Opportunity"}
                  </Link>{" "}
                  was due {new Date(c.next_call_at!).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isCloser && (
          <section className="mb-8">
            <SectionTitle>My pipeline</SectionTitle>
            <ul className="space-y-2">
              {(ownedOpps ?? []).map((o) => (
                <li key={o.id}>
                  <Card className="flex items-center justify-between transition-all hover:-translate-y-0.5 hover:border-accent/40">
                    <Link href={`/opportunities/${o.id}`} className="text-sm text-foreground">
                      {o.prospect_name}
                    </Link>
                    <Badge>{o.stage.replace(/_/g, " ")}</Badge>
                  </Card>
                </li>
              ))}
              {(ownedOpps ?? []).length === 0 && <EmptyState title="No opportunities yet." />}
            </ul>
          </section>
        )}

        {isSetter && (
          <section className="mb-8">
            <SectionTitle>Setting contribution</SectionTitle>
            <ul className="space-y-2">
              {(setterOpps ?? []).map((o) => (
                <li key={o.id}>
                  <Card className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{o.prospect_name}</span>
                    <Badge>{o.stage.replace(/_/g, " ")}</Badge>
                  </Card>
                </li>
              ))}
              {(setterOpps ?? []).length === 0 && <EmptyState title="Nothing booked yet." />}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle>Client assignments</SectionTitle>
          <ul className="space-y-2 text-sm">
            {(assignments ?? []).map((a) => (
              <li key={a.id}>
                <Card>
                  <p className="text-foreground">
                    {a.role} · {a.status}
                  </p>
                  {a.booking_link && (
                    <a href={a.booking_link} className="text-xs text-faint underline">
                      {a.booking_link}
                    </a>
                  )}
                </Card>
              </li>
            ))}
            {(assignments ?? []).length === 0 && <EmptyState title="No client assignments yet." />}
          </ul>
        </section>

        <section className="mt-8">
          <SectionTitle>Resources</SectionTitle>
          <ResourceList assignments={resourceAssignments ?? []} />
        </section>
      </div>
    </div>
  );
}
