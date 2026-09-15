"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, Send, Bell } from "lucide-react";
import { Card, Button, Textarea, EmptyState } from "@/components/ui";
import { draftFollowUpEmail } from "@/app/prospects/actions";
import { syncInstantlyInboxAction, sendFollowUpEmail, remindFollowUp, type InboxRow } from "./actions";
import { useToast } from "@/components/toast";

export default function InboxClient({ initialRows }: { initialRows: InboxRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [syncing, setSyncing] = useState(false);
  const toast = useToast();

  async function sync() {
    setSyncing(true);
    const fresh = await syncInstantlyInboxAction();
    setRows(fresh);
    setSyncing(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" onClick={sync} disabled={syncing} className="text-xs">
          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync from Instantly"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No recent Instantly replies." hint="Click Sync from Instantly to pull the latest interest replies." />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <InboxItem key={row.replyId} row={row} onSent={() => toast(`Sent to ${row.companyGuess}`, "success")} onRemind={() => toast("Reminder added to your queue", "success")} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxItem({ row, onSent, onRemind }: { row: InboxRow; onSent: () => void; onRemind: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function generate() {
    setLoading(true);
    setFailed(false);
    const text = await draftFollowUpEmail(row.prospectId);
    setLoading(false);
    if (text) setDraft(text);
    else setFailed(true);
  }

  async function send() {
    if (!draft) return;
    setSending(true);
    try {
      await sendFollowUpEmail(row.prospectId, `Re: ${row.subject}`, draft);
      setSent(true);
      onSent();
    } catch {
      setFailed(true);
    }
    setSending(false);
  }

  return (
    <li>
      <Card>
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{row.companyGuess}</p>
            <p className="text-xs text-faint">
              {row.contactName} · {row.contactEmail}
            </p>
          </div>
          <p className="shrink-0 text-xs text-faint">{new Date(row.receivedAt).toLocaleDateString()}</p>
        </div>
        <p className="mb-3 rounded-xl bg-surface-subtle/60 p-3 text-xs text-muted">{row.preview}</p>

        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles size={14} className="text-accent" /> AI follow-up draft
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => remindFollowUp(row.prospectId, row.companyGuess).then(onRemind)}
              className="flex items-center gap-1 rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground hover:bg-border"
            >
              <Bell size={12} /> Remind me
            </button>
            <button
              onClick={generate}
              disabled={loading}
              className="rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground hover:bg-border disabled:opacity-50"
            >
              {loading ? "Drafting..." : draft ? "Regenerate" : "Draft with AI"}
            </button>
          </div>
        </div>

        {draft && (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="text-sm" disabled={sent} />
            {!sent ? (
              <Button onClick={send} disabled={sending} className="text-xs">
                <Send size={13} /> {sending ? "Sending..." : "Send via email"}
              </Button>
            ) : (
              <p className="text-xs font-medium text-success">Sent.</p>
            )}
          </div>
        )}
        {failed && <p className="text-xs text-danger">Something went wrong. Try again.</p>}
        {!draft && !failed && <p className="text-xs text-faint">Nothing is ever sent automatically. Draft, review, then send.</p>}
      </Card>
    </li>
  );
}
