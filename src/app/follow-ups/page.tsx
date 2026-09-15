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

  const { data: drafts } = await supabase
    .from("followup_drafts")
    .select("id, channel, subject, body, created_at, prospects(id, company_name, contact_name, contact_email, source)")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          title="Follow-Ups"
          subtitle="AI-drafted follow-ups for interested leads and no-shows that came through anything other than Instantly. Review, edit, then send yourself, nothing goes out on its own."
        />
        <FollowUpClient drafts={(drafts ?? []) as Parameters<typeof FollowUpClient>[0]["drafts"]} />
      </div>
    </div>
  );
}
