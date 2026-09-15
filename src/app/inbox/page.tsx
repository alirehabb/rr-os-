import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { syncInstantlyInbox } from "./actions";
import InboxClient from "./InboxClient";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "founder" || r.role === "internal")) redirect("/");

  const rows = await syncInstantlyInbox();

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          title="Inbox"
          subtitle="Real Instantly replies from interested leads. Draft with AI, review, then send yourself, nothing goes out on its own."
        />
        <InboxClient initialRows={rows} />
      </div>
    </div>
  );
}
