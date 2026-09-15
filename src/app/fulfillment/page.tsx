import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDemoMode } from "@/lib/demoMode";
import { PageHeader, Badge, EmptyState } from "@/components/ui";

// Status priority for the deployment list: what needs a decision now
// (a trial to review, training to advance) reads before steady-state
// active reps, which reads before dead assignments.
const STATUS_RANK: Record<string, number> = {
  trial: 0,
  training: 1,
  selected: 2,
  active: 3,
  bench: 4,
  removed: 5,
};

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  selected: "neutral",
  training: "accent",
  trial: "warning",
  active: "success",
  bench: "neutral",
  removed: "danger",
};

const TRIAL_DAYS = 7;

export default async function FulfillmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "founder" || r.role === "internal")) redirect("/");

  const demoMode = await getDemoMode(supabase);

  const { data: assignments } = await supabase
    .from("rep_assignments")
    .select("id, role, status, trial_started_at, compensation_terms, rep_id, client_id, reps(full_name, is_demo), clients(name, is_demo)")
    .order("created_at", { ascending: false });

  // rep_assignments has no is_demo column of its own — scope through the
  // (already demo-filtered) rep and client rows so demo and real
  // deployments never mix on this board either.
  const rows = (assignments ?? []).filter((a) => a.reps?.is_demo === demoMode && a.clients?.is_demo === demoMode);
  const sorted = [...rows].sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99));

  const stats = [
    { label: "In Trial", value: rows.filter((r) => r.status === "trial").length, tone: "warning" as const },
    { label: "In Training", value: rows.filter((r) => r.status === "training").length, tone: "accent" as const },
    { label: "Active", value: rows.filter((r) => r.status === "active").length, tone: "success" as const },
    { label: "Selected", value: rows.filter((r) => r.status === "selected").length, tone: "neutral" as const },
    { label: "Bench", value: rows.filter((r) => r.status === "bench").length, tone: "neutral" as const },
    { label: "Removed", value: rows.filter((r) => r.status === "removed").length, tone: "danger" as const },
  ];
  const statText = { neutral: "text-foreground", success: "text-success", accent: "text-accent", warning: "text-warning", danger: "text-danger" };

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="Fulfillment"
          subtitle="Every rep deployed to a client, in whatever stage they're actually in — connect, train, trial, deliver."
        />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rr-fade-up rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${statText[s.tone]}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {sorted.length === 0 ? (
          <EmptyState title="No reps deployed yet." hint="Assign a rep to a client from their Talent profile to see them here." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]">
            <div className="grid grid-cols-[1.4fr_1.4fr_100px_120px_140px_100px] gap-0 border-b border-border bg-surface-subtle/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-faint">
              <p>Client</p>
              <p>Rep</p>
              <p>Role</p>
              <p>Status</p>
              <p>Trial deadline</p>
              <p>Comp</p>
            </div>
            <ul>
              {sorted.map((a) => {
                const trialDeadline = a.status === "trial" && a.trial_started_at ? new Date(new Date(a.trial_started_at).getTime() + TRIAL_DAYS * 86400000) : null;
                const trialOverdue = trialDeadline && trialDeadline < new Date();
                return (
                  <li key={a.id} className="grid grid-cols-[1.4fr_1.4fr_100px_120px_140px_100px] items-center gap-0 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-surface-subtle/40">
                    <Link href={`/clients/${a.client_id}`} className="truncate font-medium text-foreground hover:underline">
                      {a.clients?.name ?? "Unknown client"}
                    </Link>
                    <Link href={`/reps/${a.rep_id}`} className="truncate text-foreground hover:underline">
                      {a.reps?.full_name ?? "Unknown rep"}
                    </Link>
                    <p className="text-muted">{a.role}</p>
                    <div>
                      <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status}</Badge>
                    </div>
                    <p className={trialOverdue ? "text-danger" : "text-faint"}>
                      {trialDeadline ? trialDeadline.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                    </p>
                    <p className="text-xs text-faint">{a.compensation_terms ? `${(((a.compensation_terms as { rate: number }).rate ?? 0) * 100).toFixed(0)}%` : "not set"}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
