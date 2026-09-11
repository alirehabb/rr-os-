import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  const { data: rep } = await supabase.from("reps").select("*").eq("profile_id", user.id).single();

  if (!rep) {
    return (
      <div className="flex-1">
        <NavBar />
        <div className="mx-auto max-w-lg px-6 py-10 text-sm text-neutral-400">
          No rep profile is linked to your account yet. Ask the founder to link your login to your Sales Talent
          profile.
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

  const earned = (wallet ?? []).reduce((s, w) => s + Number(w.amount), 0);
  const paid = (wallet ?? []).filter((w) => w.status === "paid").reduce((s, w) => s + Number(w.amount), 0);
  const outstanding = earned - paid;

  const oppById = new Map([...(ownedOpps ?? []), ...(setterOpps ?? [])].map((o) => [o.id, o]));

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold">{rep.full_name}&apos;s Workspace</h1>
        <p className="mb-6 text-sm text-neutral-500">{rep.capabilities.join(" · ")}</p>

        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <Stat label="Today's calls" value={String(todaysCalls.length)} />
          <Stat label="Close rate" value={closeRate === null ? "—" : `${closeRate}%`} />
          <Stat label="Earned to date" value={money(earned)} />
          <Stat label="Outstanding payout" value={money(outstanding)} />
        </section>

        {overdueFollowUps.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-medium text-amber-400">Overdue follow-ups</h2>
            <ul className="space-y-1 text-sm">
              {overdueFollowUps.map((c) => (
                <li key={c.id}>
                  <Link href={`/opportunities/${c.opportunity_id}`} className="hover:underline">
                    {oppById.get(c.opportunity_id)?.prospect_name ?? "Opportunity"}
                  </Link>{" "}
                  — was due {new Date(c.next_call_at!).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isCloser && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-medium">My pipeline</h2>
            <ul className="space-y-2">
              {(ownedOpps ?? []).map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/opportunities/${o.id}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm hover:border-neutral-600"
                  >
                    <span>{o.prospect_name}</span>
                    <span className="text-neutral-400">{o.stage}</span>
                  </Link>
                </li>
              ))}
              {(ownedOpps ?? []).length === 0 && <p className="text-sm text-neutral-500">No opportunities yet.</p>}
            </ul>
          </section>
        )}

        {isSetter && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-medium">Setting contribution</h2>
            <ul className="space-y-2">
              {(setterOpps ?? []).map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">
                  <span>{o.prospect_name}</span>
                  <span className="text-neutral-400">{o.stage}</span>
                </li>
              ))}
              {(setterOpps ?? []).length === 0 && <p className="text-sm text-neutral-500">Nothing booked yet.</p>}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-medium">Client assignments</h2>
          <ul className="space-y-2 text-sm">
            {(assignments ?? []).map((a) => (
              <li key={a.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                <p>
                  {a.role} · {a.status}
                </p>
                {a.booking_link && (
                  <a href={a.booking_link} className="text-xs text-neutral-500 underline">
                    {a.booking_link}
                  </a>
                )}
              </li>
            ))}
            {(assignments ?? []).length === 0 && <p className="text-neutral-500">No client assignments yet.</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
