import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommandQueue } from "@/lib/queries";
import CommandQueueClient from "@/components/CommandQueueClient";
import { PageHeader, Card } from "@/components/ui";

// Command Center = actionable work requiring attention. Distinct from Home
// (company overview) and Brief (a point-in-time intelligence summary) —
// this is where the founder actually works through the queue.
export default async function CommandCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: demo } = await supabase.from("demo_mode").select("enabled").limit(1).single();
  const demoMode = !!demo?.enabled;

  const queue = await getCommandQueue(demoMode);
  const overdue = queue.filter((q) => q.deadline_at && new Date(q.deadline_at) < new Date());

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Command Center"
        subtitle={
          overdue.length > 0
            ? `${overdue.length} item${overdue.length > 1 ? "s" : ""} overdue out of ${queue.length} open.`
            : `${queue.length} open item${queue.length === 1 ? "" : "s"}. Nothing overdue.`
        }
        action={
          <Link href="/brief" className="text-sm text-muted underline hover:text-foreground">
            View Morning Brief
          </Link>
        }
      />
      <Card className="!p-0">
        <CommandQueueClient items={queue} limit={queue.length || 1} />
      </Card>
    </div>
  );
}
