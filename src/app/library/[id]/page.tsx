import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import DocEditor from "../DocEditor";

export default async function LibraryDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "founder")) redirect("/");

  const { data: item } = await supabase.from("knowledge_items").select("id, title, body, folder_id").eq("id", id).single();
  if (!item) notFound();

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted">
          <Link href={item.folder_id ? `/library?folder=${item.folder_id}` : "/library"} className="hover:text-foreground hover:underline">
            Library
          </Link>
          <span className="text-faint">/</span>
          <span className="text-foreground">{item.title}</span>
        </nav>
        <PageHeader title={item.title} subtitle="Changes save automatically." />
        <DocEditor itemId={item.id} initialBody={item.body} />
      </div>
    </div>
  );
}
