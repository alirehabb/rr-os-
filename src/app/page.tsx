import { getPulseTotals, getCommandQueue, getCashCollectedTrend, getCallsBookedTrend } from "@/lib/queries";
import { getClientPulse, getLiveFeed, getToday } from "@/lib/homeExtras";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import CommandQueueClient from "@/components/CommandQueueClient";
import { AnimatedNumber } from "@/components/motion";
import {
  DollarSign,
  ArrowUpRight,
  BarChart3,
  Clock,
  Users2,
  CheckCircle2,
  Circle,
  PhoneCall,
  UserPlus,
  Building2,
  PlusCircle,
  ClipboardList,
  Award,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import { Card, Badge, ProgressBar, Sparkline } from "@/components/ui";
import QuickAddOpportunitySheet from "@/app/opportunities/QuickAddSheet";
import QuickAddClientSheet from "@/app/clients/QuickAddSheet";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Role-aware home: this Command Center is the Founder/internal/finance
  // workspace. Closers and setters have their own workspace at /my; a
  // client-only login has no business seeing company-wide numbers.
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roleSet = new Set((myRoles ?? []).map((r) => r.role));
  if (!roleSet.has("founder") && !roleSet.has("internal") && !roleSet.has("finance")) {
    if (roleSet.has("closer") || roleSet.has("setter")) redirect("/my");
    if (roleSet.has("client")) redirect("/portal");
  }

  const [{ data: demo }, { data: profile }, { data: clientOptions }] = await Promise.all([
    supabase.from("demo_mode").select("enabled").limit(1).single(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const demoMode = !!demo?.enabled;
  const firstName = (profile?.full_name ?? "there").split(" ")[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // The shell (greeting, quick actions) needs only the three fast queries
  // above and renders immediately. Everything data-heavy streams in behind
  // its own Suspense boundary instead of blocking the whole page — this is
  // what makes the dashboard open right away instead of showing a blank
  // screen while ~20 queries resolve.
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-6 flex items-center justify-between rr-fade-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting}, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-muted">Here&apos;s what&apos;s happening with Rehab Revenue today.</p>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardBody demoMode={demoMode} clientOptions={clientOptions ?? []} />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[92px] rounded-2xl border border-border bg-surface-subtle" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl border border-border bg-surface-subtle" />
        ))}
      </div>
    </div>
  );
}

async function DashboardBody({ demoMode, clientOptions }: { demoMode: boolean; clientOptions: { id: string; name: string }[] }) {
  const supabase = await createClient();

  const [{ data: targets }, { count: realClientCount }, { data: rrScoreConfig }, { count: connectedCount }] = await Promise.all([
    supabase.from("founder_targets").select("*").limit(1).single(),
    // Setup completeness is about the REAL business, independent of
    // whether demo mode happens to be toggled on for exploration.
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_demo", false),
    supabase.from("rr_score_config").select("configured").limit(1).single(),
    supabase.from("connections").select("*", { count: "exact", head: true }).is("client_id", null).eq("status", "connected"),
  ]);

  const setupSteps = [
    { label: "Set a monthly revenue target", href: "/settings/targets", done: !!targets?.monthly_revenue_target },
    { label: "Configure RR Score weights", href: "/settings/rr-score", done: !!rrScoreConfig?.configured },
    { label: "Connect at least one integration", href: "/connections", done: (connectedCount ?? 0) > 0 },
    { label: "Sign or convert your first real client", href: "/clients", done: (realClientCount ?? 0) > 0 },
  ];
  const setupIncomplete = setupSteps.some((s) => !s.done);

  const [pulse, queue, clientPulse, feed, today, cashTrend, callsTrend] = await Promise.all([
    getPulseTotals(demoMode),
    getCommandQueue(demoMode),
    getClientPulse(demoMode),
    getLiveFeed(demoMode),
    getToday(demoMode),
    getCashCollectedTrend(demoMode),
    getCallsBookedTrend(demoMode),
  ]);

  const now = new Date();
  const monthProgress = targets?.monthly_revenue_target ? Math.min(100, (pulse.rrEarned / targets.monthly_revenue_target) * 100) : null;
  const daysLeftInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  const overdue = queue.filter((q) => q.deadline_at && new Date(q.deadline_at) < now);
  const contextLine =
    overdue.length > 0
      ? `${overdue.length} item${overdue.length > 1 ? "s" : ""} in your queue ${overdue.length > 1 ? "are" : "is"} overdue.`
      : queue.length > 0
        ? `${queue.length} item${queue.length > 1 ? "s" : ""} waiting on you. Nothing overdue.`
        : "Nothing urgent. You're clear.";

  return (
    <>
      {/* RR Pulse */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <PulseTile icon={DollarSign} label="Cash Collected" numericValue={pulse.cashCollected} kind="money" tone="success" trend={cashTrend} />
        <PulseTile icon={ArrowUpRight} label="RR Outstanding" numericValue={pulse.rrOutstanding} kind="money" tone={pulse.rrOutstanding > 0 ? "warning" : "neutral"} />
        <PulseTile icon={BarChart3} label="Active Pipeline" numericValue={pulse.activePipelineValue} kind="money" tone="accent" />
        <PulseTile icon={Clock} label="Projected RR Revenue" numericValue={pulse.projectedRRRevenue} kind="money" tone="accent" />
        <PulseTile icon={TrendingUp} label="Close Rate" numericValue={pulse.closeRate ?? 0} kind="percent" dash={pulse.closeRate === null} tone="neutral" />
        <PulseTile icon={Users2} label="Calls Booked" numericValue={pulse.callsBookedThisMonth} kind="count" tone="neutral" trend={callsTrend} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        {/* Command Queue */}
        <Card className="!p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Command Queue</h2>
              {queue.length > 0 && <Badge tone="danger">{queue.length}</Badge>}
            </div>
            <Link href="/command-center" className="text-xs text-faint hover:text-muted">
              View all →
            </Link>
          </div>
          <CommandQueueClient items={queue} />
        </Card>

        {/* Today */}
        <Card className="!p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Today</h2>
              {today.length > 0 && <Badge>{today.length}</Badge>}
            </div>
          </div>
          <ol className="relative space-y-0 px-4 py-3">
            {today.map((t, i) => (
              <li key={t.id} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  {t.done ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} className="text-faint" />}
                  {i < today.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-xs text-faint">{new Date(t.time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="truncate text-xs text-muted">{t.detail}</p>
                </div>
              </li>
            ))}
            {today.length === 0 && <li className="py-8 text-center text-sm text-faint">Nothing scheduled today.</li>}
          </ol>
        </Card>

        {/* Founder Progress */}
        <Card className="!p-0">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Founder Progress</h2>
          </div>
          <div className="p-4">
            {targets?.monthly_revenue_target ? (
              <>
                <p className="text-xs text-faint">Monthly RR target</p>
                <p className="mt-0.5 text-xl font-semibold text-foreground">{money(targets.monthly_revenue_target)}</p>
                <div className="mt-2">
                  <ProgressBar value={monthProgress ?? 0} tone="success" />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {money(pulse.rrEarned)} earned ({Math.round(monthProgress ?? 0)}%) · {daysLeftInMonth} days left
                </p>
              </>
            ) : (
              <p className="text-sm text-faint">
                No target set.{" "}
                <Link href="/settings/targets" className="text-accent underline">
                  Configure one
                </Link>
                .
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        {/* Client Pulse */}
        <Card className="!p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Client Pulse</h2>
            <Link href="/clients" className="text-xs text-faint hover:text-muted">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Opps</th>
                  <th className="px-2 py-2 font-medium">Expected</th>
                  <th className="px-2 py-2 font-medium">RR Rev</th>
                  <th className="px-4 py-2 font-medium">Health</th>
                </tr>
              </thead>
              <tbody>
                {clientPulse.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link href={`/clients/${c.id}`} className="font-medium text-foreground hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={c.lifecycleState === "active" ? "success" : c.lifecycleState === "paused" ? "warning" : "neutral"}>
                        {c.lifecycleState}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-muted">{c.opportunityCount}</td>
                    <td className="px-2 py-2 text-muted">{money(c.expectedRevenue)}</td>
                    <td className="px-2 py-2 text-muted">{money(c.rrRevenue)}</td>
                    <td className="px-4 py-2 w-28">
                      <ProgressBar value={c.healthPct} tone={c.healthLabel === "good" ? "success" : c.healthLabel === "watch" ? "warning" : "danger"} />
                    </td>
                  </tr>
                ))}
                {clientPulse.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-faint">
                      No clients yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Live Feed */}
        <Card className="!p-0">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Live Feed</h2>
          </div>
          <ul className="divide-y divide-border">
            {feed.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <FeedIcon kind={f.kind} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{f.label}</p>
                  <p className="truncate text-xs text-faint">{f.detail}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs text-faint">{timeAgo(f.at)}</span>
              </li>
            ))}
            {feed.length === 0 && <li className="px-4 py-8 text-center text-sm text-faint">No activity yet.</li>}
          </ul>
        </Card>

        {/* Quick Actions */}
        <Card className="!p-0">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 gap-1.5 p-3">
            <QuickAction href="/opportunities/new" icon={PhoneCall} label="Log a Call" />
            <QuickAddOpportunitySheet clients={clientOptions} />
            <QuickAddClientSheet />
            <QuickAction href="/reps" icon={UserPlus} label="Review Talent" />
            <QuickAction href="/documents" icon={FolderOpen} label="Create Document" />
            <QuickAction href="/leaderboard" icon={Award} label="View Leaderboard" />
            <QuickAction href="/opportunities" icon={ClipboardList} label="Open Pipeline" />
          </div>
        </Card>
      </div>

      {/* Context banner — setup incompleteness always wins over "nothing
          urgent": those are two different truths and conflating them was
          a real audit failure (calm feedback during an unconfigured OS). */}
      {setupIncomplete ? (
        <Card className="mt-4 border-warning/30 bg-warning-bg/40">
          <p className="text-sm font-semibold text-warning">RR OS is not fully operational</p>
          <ul className="mt-2 space-y-1.5">
            {setupSteps
              .filter((s) => !s.done)
              .map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="text-sm text-foreground underline hover:text-warning">
                    {s.label}
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      ) : (
        <Card className="mt-4 flex items-center justify-between bg-surface-subtle">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Keep going</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{contextLine}</p>
          </div>
          <p className="hidden text-sm italic text-faint sm:block">&ldquo;A calm operator always wins.&rdquo;</p>
        </Card>
      )}
    </>
  );

  function PulseTile({
    icon: Icon,
    label,
    numericValue,
    kind,
    dash,
    tone,
    trend,
  }: {
    icon: typeof DollarSign;
    label: string;
    numericValue: number;
    kind: "money" | "percent" | "count";
    dash?: boolean;
    tone: "success" | "warning" | "accent" | "neutral";
    trend?: number[];
  }) {
    const toneClasses = {
      success: "bg-success-bg text-success",
      warning: "bg-warning-bg text-warning",
      accent: "bg-accent/12 text-accent",
      neutral: "bg-surface-subtle text-muted",
    }[tone];
    const washClasses = {
      success: "bg-gradient-to-br from-success-bg/70 to-transparent",
      warning: "bg-gradient-to-br from-warning-bg/70 to-transparent",
      accent: "bg-gradient-to-br from-accent/10 to-transparent",
      neutral: "",
    }[tone];
    const hasTrend = trend && trend.some((v) => v > 0);
    return (
      <Card className={`rr-fade-up transition-transform hover:-translate-y-0.5 ${washClasses}`}>
        <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon size={14} />
        </div>
        <p className="text-xs text-faint">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-foreground">
          <AnimatedNumber value={numericValue} kind={kind} dash={dash} />
        </p>
        {hasTrend && (
          <div className={`mt-1 ${toneClasses.split(" ")[1]} opacity-70`}>
            <Sparkline values={trend} />
          </div>
        )}
      </Card>
    );
  }
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof PhoneCall; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      <Icon size={15} className="text-accent" />
      {label}
    </Link>
  );
}

function FeedIcon({ kind }: { kind: "payment" | "call" | "client" | "rep" }) {
  const map = {
    payment: { Icon: DollarSign, cls: "bg-success-bg text-success" },
    call: { Icon: PhoneCall, cls: "bg-accent/12 text-accent" },
    client: { Icon: Building2, cls: "bg-warning-bg text-warning" },
    rep: { Icon: UserPlus, cls: "bg-surface-subtle text-muted" },
  }[kind];
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${map.cls}`}>
      <map.Icon size={13} />
    </div>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
