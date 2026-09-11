import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { ensureConnectionRows, checkResendConnection, updateConnectionStatus } from "./actions";

const STATUS_COLOR: Record<string, string> = {
  connected: "text-emerald-400",
  disconnected: "text-neutral-500",
  degraded: "text-amber-400",
  access_pending: "text-amber-400",
};

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
      <NavBar />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold">Connections</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Real status only — an unconnected provider shows disconnected, never a fabricated "connected" state (§19).
        </p>

        <ul className="space-y-2">
          {(connections ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium capitalize">{c.provider.replace("_", " ")}</p>
                <span className={STATUS_COLOR[c.status] ?? "text-neutral-400"}>{c.status}</span>
              </div>
              {c.authorized_account && <p className="text-neutral-400">Account: {c.authorized_account}</p>}
              {c.last_synced_at && (
                <p className="text-xs text-neutral-500">Last synced: {new Date(c.last_synced_at).toLocaleString()}</p>
              )}
              {c.last_error && <p className="text-xs text-red-400">{c.last_error}</p>}

              {c.provider === "resend" ? (
                <form action={checkResendConnection} className="mt-2">
                  <button className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800">
                    Check connection
                  </button>
                </form>
              ) : (
                <form action={updateConnectionStatus} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <select name="status" defaultValue={c.status} className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs">
                    <option value="disconnected">Disconnected</option>
                    <option value="access_pending">Access pending</option>
                    <option value="degraded">Degraded</option>
                    <option value="connected">Connected</option>
                  </select>
                  <input
                    name="authorized_account"
                    placeholder="Authorized account"
                    defaultValue={c.authorized_account ?? ""}
                    className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
                  />
                  <button className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800">
                    Save
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
