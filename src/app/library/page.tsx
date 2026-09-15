import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDemoMode } from "@/lib/demoMode";
import { PageHeader, SectionTitle, Card, Badge, Button, Input, Select, EmptyState } from "@/components/ui";
import { Folder, FileText, Video, Link2, File, Image as ImageIcon } from "lucide-react";
import { createFolder, createItem, deleteItem, deleteFolder, assignItem, removeAssignment } from "./actions";
import DownloadButton from "./DownloadButton";

const TYPE_ICON = { doc: FileText, template: FileText, video: Video, link: Link2, file: File, image: ImageIcon } as const;
const ROLE_LABEL: Record<string, string> = { internal: "Internal Team", closer: "Closers", setter: "Setters", finance: "Finance", client: "Clients" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const { folder: folderId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "founder")) redirect("/");

  const demoMode = await getDemoMode(supabase);

  const itemsQuery = supabase.from("knowledge_items").select("*").eq("is_demo", demoMode).order("created_at", { ascending: false });
  const scopedItemsQuery = folderId ? itemsQuery.eq("folder_id", folderId) : itemsQuery.is("folder_id", null);

  const [{ data: allFolders }, { data: items }, { data: assignments }, { data: reps }, { data: clients }] = await Promise.all([
    supabase.from("folders").select("*").eq("is_demo", demoMode).order("name"),
    scopedItemsQuery,
    supabase.from("knowledge_assignments").select("*").eq("is_demo", demoMode),
    supabase.from("reps").select("id, full_name").eq("is_demo", demoMode).eq("is_benchmark", false).eq("recruiting_status", "confirmed_active"),
    supabase.from("clients").select("id, name").eq("is_demo", demoMode),
  ]);

  const subfolders = (allFolders ?? []).filter((f) => f.parent_id === (folderId ?? null));
  const currentFolder = folderId ? (allFolders ?? []).find((f) => f.id === folderId) : null;
  const repById = new Map((reps ?? []).map((r) => [r.id, r]));
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));
  const assignmentsByItem = new Map<string, typeof assignments>();
  for (const a of assignments ?? []) {
    assignmentsByItem.set(a.item_id, [...(assignmentsByItem.get(a.item_id) ?? []), a]);
  }

  function assignmentLabel(a: NonNullable<typeof assignments>[number]) {
    if (a.rep_id) return repById.get(a.rep_id)?.full_name ?? "Unknown rep";
    if (a.client_id) return clientById.get(a.client_id)?.name ?? "Unknown client";
    if (a.role) return `All ${ROLE_LABEL[a.role] ?? a.role}`;
    return "Unknown";
  }

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PageHeader title="Library" subtitle="Training, scripts, client assets — organized, assignable, and trackable." />

        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted">
          <Link href="/library" className="hover:text-foreground hover:underline">
            Library
          </Link>
          {currentFolder && (
            <>
              <span className="text-faint">/</span>
              <span className="text-foreground">{currentFolder.name}</span>
            </>
          )}
        </nav>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <p className="mb-2 text-sm font-medium text-foreground">New folder</p>
            <form action={createFolder} className="flex gap-2">
              <input type="hidden" name="parent_id" value={folderId ?? ""} />
              <Input name="name" required placeholder="Folder name" className="flex-1 text-xs" />
              <Select name="client_id" className="w-32 text-xs">
                <option value="">General</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button className="!px-3 !py-1.5 text-xs shrink-0">Create</Button>
            </form>
          </Card>

          <Card>
            <p className="mb-2 text-sm font-medium text-foreground">New item</p>
            <form action={createItem} className="space-y-2">
              <input type="hidden" name="folder_id" value={folderId ?? ""} />
              <Input name="title" required placeholder="Title" className="text-xs" />
              <div className="flex gap-2">
                <Select name="type" className="flex-1 text-xs">
                  <option value="doc">Doc (text)</option>
                  <option value="template">Template (text)</option>
                  <option value="video">Video (link)</option>
                  <option value="link">Link</option>
                  <option value="file">File (PDF etc.)</option>
                  <option value="image">Image</option>
                </Select>
                <Select name="client_id" className="flex-1 text-xs">
                  <option value="">General</option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-faint">Doc/Template content is written in the editor after you add it.</p>
              <Input name="external_url" placeholder="URL (for Video/Link)" className="text-xs" />
              <input type="file" name="file" className="w-full text-xs text-muted" />
              <Button className="!py-1.5 text-xs">Add to library</Button>
            </form>
          </Card>
        </div>

        {subfolders.length > 0 && (
          <section className="mb-8">
            <SectionTitle>Folders</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {subfolders.map((f) => (
                <div key={f.id} className="group relative">
                  <Link
                    href={`/library?folder=${f.id}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm hover:bg-surface-subtle/40"
                  >
                    <Folder size={16} className="text-accent" />
                    <span className="truncate text-foreground">{f.name}</span>
                    {f.client_id && <Badge tone="neutral">{clientById.get(f.client_id)?.name ?? "client"}</Badge>}
                  </Link>
                  <form action={deleteFolder} className="absolute right-1 top-1 hidden group-hover:block">
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded px-1 text-xs text-faint hover:text-danger">×</button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle>{currentFolder ? currentFolder.name : "General"}</SectionTitle>
          <ul className="space-y-2">
            {(items ?? []).map((item) => {
              const Icon = TYPE_ICON[item.type];
              const itemAssignments = assignmentsByItem.get(item.id) ?? [];
              return (
                <li key={item.id}>
                  <Card>
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <Icon size={16} className="mt-0.5 shrink-0 text-accent" />
                        <div>
                          <p className="font-medium text-foreground">
                            {item.type === "doc" || item.type === "template" ? (
                              <Link href={`/library/${item.id}`} className="hover:underline">
                                {item.title}
                              </Link>
                            ) : (
                              item.title
                            )}
                          </p>
                          {item.client_id && <Badge tone="neutral">{clientById.get(item.client_id)?.name ?? "client"}</Badge>}
                          {(item.type === "doc" || item.type === "template") && (
                            <Link href={`/library/${item.id}`} className="mt-1 block text-xs text-accent hover:underline">
                              {item.body ? "Open document →" : "Write content →"}
                            </Link>
                          )}
                          {item.external_url && (
                            <a href={item.external_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-accent hover:underline">
                              {item.external_url}
                            </a>
                          )}
                          {item.storage_path && <DownloadButton storagePath={item.storage_path} label="Open file" />}
                        </div>
                      </div>
                      <form action={deleteItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="text-xs text-faint hover:text-danger">Delete</button>
                      </form>
                    </div>

                    <div className="mt-2 border-t border-border pt-2">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {itemAssignments.map((a) => (
                          <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-foreground">
                            {assignmentLabel(a)}
                            {a.acknowledged_at ? (
                              <Badge tone="success">acknowledged</Badge>
                            ) : a.viewed_at ? (
                              <Badge tone="accent">viewed</Badge>
                            ) : (
                              <Badge tone="neutral">assigned</Badge>
                            )}
                            <form action={removeAssignment} className="inline">
                              <input type="hidden" name="id" value={a.id} />
                              <button className="text-faint hover:text-danger">×</button>
                            </form>
                          </span>
                        ))}
                        {itemAssignments.length === 0 && <span className="text-xs text-faint">Not assigned to anyone yet</span>}
                      </div>
                      <form action={assignItem} className="flex gap-2">
                        <input type="hidden" name="item_id" value={item.id} />
                        <Select name="target" required className="flex-1 !py-1 text-xs">
                          <option value="">Assign to...</option>
                          <optgroup label="Roles (everyone)">
                            {Object.entries(ROLE_LABEL).map(([k, label]) => (
                              <option key={k} value={`role:${k}`}>
                                {label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Specific rep">
                            {(reps ?? []).map((r) => (
                              <option key={r.id} value={`rep:${r.id}`}>
                                {r.full_name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Specific client">
                            {(clients ?? []).map((c) => (
                              <option key={c.id} value={`client:${c.id}`}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        </Select>
                        <Button variant="secondary" className="!px-3 !py-1 text-xs">
                          Assign
                        </Button>
                      </form>
                    </div>
                  </Card>
                </li>
              );
            })}
            {(items ?? []).length === 0 && <EmptyState title="Nothing here yet." hint="Add a doc, video, link, or file above." />}
          </ul>
        </section>
      </div>
    </div>
  );
}
