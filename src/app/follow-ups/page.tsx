import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import FollowUpClient from "./FollowUpClient";

export default async function FollowUpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "founder" || r.role === "internal")) redirect("/");

  const [{ data: prospects }, { data: campaigns }, { data: campaignProspects }, { data: drafts }] = await Promise.all([
    supabase
      .from("prospects")
      .select("id, company_name, contact_name, contact_email, source, stage, next_action_date, updated_at")
      .eq("is_demo", false)
      .not("contact_email", "is", null)
      .order("updated_at", { ascending: false }),
    supabase.from("campaigns").select("id, name, channel").eq("is_demo", false).order("created_at"),
    supabase.from("campaign_prospects").select("id, campaign_id, prospect_id, status"),
    supabase
      .from("followup_drafts")
      .select("id, channel, subject, body, created_at, prospects(id, company_name, contact_name, contact_email, source)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }),
  ]);

  // The shared app shell's <main> scrolls the whole page by default, which
  // is right for ordinary content pages but wrong here — an inbox-style
  // split view needs its own panes to scroll independently while the
  // header stays put, the same way Gmail's own layout works. h-full alone
  // doesn't reach a real height here since the shell's animated wrapper
  // around {children} has no explicit height of its own to inherit from.
  return (
    <div className="flex h-[calc(100vh-65px)] flex-col">
      <div className="px-6 pt-8">
        <PageHeader
          title="Follow-Ups"
          subtitle="Every prospect, one place. Drag into a campaign for automated cadence, or follow up on the spot, review the copy, then send."
        />
      </div>
      <FollowUpClient
        prospects={prospects ?? []}
        campaigns={(campaigns ?? []) as Parameters<typeof FollowUpClient>[0]["campaigns"]}
        campaignProspects={campaignProspects ?? []}
        pendingDrafts={(drafts ?? []) as Parameters<typeof FollowUpClient>[0]["pendingDrafts"]}
      />
    </div>
  );
}
