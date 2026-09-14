import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader, SectionTitle, Card, Badge, Button, Input, Select } from "@/components/ui";
import { inviteUser, resendInvitation, revokeInvitation, setUserStatus, addUserRole, removeUserRole } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  founder: "Founder",
  internal: "Internal Team",
  closer: "Closer",
  setter: "Setter",
  finance: "Finance",
  client: "Client",
};

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isFounder = (myRoles ?? []).some((r) => r.role === "founder");
  if (!isFounder) redirect("/");

  const [{ data: profiles }, { data: roles }, { data: invitations }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, status, created_at").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("id, user_id, role, client_id"),
    supabase.from("invitations").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const rolesByUser = new Map<string, typeof roles>();
  for (const r of roles ?? []) {
    rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r]);
  }
  const pendingInvites = (invitations ?? []).filter((i) => i.status === "pending");

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader title="Users" subtitle="Who has access to RR OS, what role they have, and what they can see." />

        <section className="mb-8">
          <SectionTitle>Invite someone</SectionTitle>
          <form action={inviteUser} className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex gap-2">
              <Input name="full_name" required placeholder="Full name" className="flex-1" />
              <Input name="email" type="email" required placeholder="Email" className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Select name="role" required className="flex-1">
                <option value="">Role...</option>
                {Object.entries(ROLE_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select name="client_id" className="flex-1">
                <option value="">No client scope</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Send invite</Button>
          </form>
        </section>

        {pendingInvites.length > 0 && (
          <section className="mb-8">
            <SectionTitle>Pending invitations</SectionTitle>
            <ul className="space-y-2">
              {pendingInvites.map((i) => (
                <li key={i.id}>
                  <Card className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-foreground">{i.full_name}</p>
                      <p className="text-xs text-muted">
                        {i.email} · {ROLE_LABEL[i.role]}
                        {i.client_id && ` · ${clientNameById.get(i.client_id) ?? "client"}`}
                      </p>
                      <p className="text-xs text-faint">Expires {new Date(i.expires_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <form action={resendInvitation}>
                        <input type="hidden" name="id" value={i.id} />
                        <Button type="submit" variant="secondary" className="!px-3 !py-1 text-xs">
                          Resend
                        </Button>
                      </form>
                      <form action={revokeInvitation}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="rounded-xl bg-danger-bg px-3 py-1 text-xs font-medium text-danger transition-transform active:scale-[0.97]">
                          Revoke
                        </button>
                      </form>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle>Team ({(profiles ?? []).length})</SectionTitle>
          <ul className="space-y-2">
            {(profiles ?? []).map((p) => {
              const userRoles = rolesByUser.get(p.id) ?? [];
              return (
                <li key={p.id}>
                  <Card className="text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{p.full_name}</p>
                        <p className="text-xs text-muted">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={p.status === "active" ? "success" : "danger"}>{p.status}</Badge>
                        {p.id !== user.id && (
                          <form action={setUserStatus}>
                            <input type="hidden" name="user_id" value={p.id} />
                            <input type="hidden" name="status" value={p.status === "active" ? "suspended" : "active"} />
                            <Button type="submit" variant="secondary" className="!px-3 !py-1 text-xs">
                              {p.status === "active" ? "Suspend" : "Reactivate"}
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {userRoles.map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-xs text-foreground">
                          {ROLE_LABEL[r.role]}
                          {r.client_id && ` · ${clientNameById.get(r.client_id) ?? "client"}`}
                          <form action={removeUserRole} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <button className="ml-0.5 text-faint hover:text-danger" aria-label="Remove role">
                              ×
                            </button>
                          </form>
                        </span>
                      ))}
                    </div>
                    <form action={addUserRole} className="mt-2 flex gap-2">
                      <input type="hidden" name="user_id" value={p.id} />
                      <Select name="role" required className="flex-1 !py-1 text-xs">
                        <option value="">Add role...</option>
                        {Object.entries(ROLE_LABEL).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </Select>
                      <Select name="client_id" className="flex-1 !py-1 text-xs">
                        <option value="">No client scope</option>
                        {(clients ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" variant="secondary" className="!px-3 !py-1 text-xs">
                        Add
                      </Button>
                    </form>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
