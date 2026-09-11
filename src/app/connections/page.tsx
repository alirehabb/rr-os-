import { createClient } from "@/lib/supabase/server";
import { ensureConnectionRows, checkResendConnection, checkCalendlyConnection, checkStripeConnection, updateConnectionStatus } from "./actions";
import CheckConnectionForm from "./CheckConnectionForm";

const AUTO_CHECK: Record<string, () => Promise<{ status: "connected" | "degraded" | "disconnected"; last_error: string | null }>> = {
  resend: checkResendConnection,
  calendly: checkCalendlyConnection,
  stripe: checkStripeConnection,
};
import { PageHeader, Card, Badge, Button, Select, Input } from "@/components/ui";

const STATUS_TONE = {
  connected: "success",
  disconnected: "neutral",
  degraded: "warning",
  access_pending: "warning",
} as const;

export default async function ConnectionsPage() {
  await ensureConnectionRows();

  const supabase = await createClient();
  const { data: connections } = await supabase
    .from("connections")
    .select("*")
    .is("client_id", null)
    .order("provider");

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          title="Connections"
          subtitle='Real status only — an unconnected provider shows disconnected, never a fabricated "connected" state (§19).'
        />

        <ul className="space-y-2">
          {(connections ?? []).map((c) => (
            <li key={c.id}>
              <Card className="text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium capitalize text-foreground">{c.provider.replace("_", " ")}</p>
                  <Badge tone={STATUS_TONE[c.status as keyof typeof STATUS_TONE] ?? "neutral"}>{c.status.replace(/_/g, " ")}</Badge>
                </div>
                {c.authorized_account && <p className="text-muted">Account: {c.authorized_account}</p>}
                {c.last_synced_at && <p className="text-xs text-faint">Last synced: {new Date(c.last_synced_at).toLocaleString()}</p>}
                {c.last_error && <p className="text-xs text-danger">{c.last_error}</p>}

                {AUTO_CHECK[c.provider] ? (
                  <CheckConnectionForm provider={c.provider} action={AUTO_CHECK[c.provider]} />
                ) : (
                  <form action={updateConnectionStatus} className="mt-2 flex gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <Select name="status" defaultValue={c.status} className="!px-2 !py-1 text-xs">
                      <option value="disconnected">Disconnected</option>
                      <option value="access_pending">Access pending</option>
                      <option value="degraded">Degraded</option>
                      <option value="connected">Connected</option>
                    </Select>
                    <Input
                      name="authorized_account"
                      placeholder="Authorized account"
                      defaultValue={c.authorized_account ?? ""}
                      className="flex-1 text-xs"
                    />
                    <Button variant="secondary" className="!px-3 !py-1 text-xs">
                      Save
                    </Button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
