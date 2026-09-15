"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { Card, Button, Textarea, Badge, EmptyState } from "@/components/ui";
import { sendFollowUpDraft, dismissFollowUpDraft } from "./actions";
import { useToast } from "@/components/toast";

type Draft = {
  id: string;
  channel: "external" | "no_show";
  subject: string;
  body: string;
  created_at: string;
  prospects: { id: string; company_name: string; contact_name: string | null; contact_email: string | null; source: string | null } | null;
};

export default function FollowUpClient({ drafts: initial }: { drafts: Draft[] }) {
  const [drafts, setDrafts] = useState(initial);
  const toast = useToast();

  function remove(id: string) {
    setDrafts((d) => d.filter((x) => x.id !== id));
  }

  if (drafts.length === 0) return <EmptyState title="Nothing waiting for review." hint="Drafted follow-ups for non-Instantly leads and no-shows show up here." />;

  return (
    <ul className="space-y-3">
      {drafts.map((d) => (
        <DraftItem key={d.id} draft={d} onSent={() => { toast(`Sent to ${d.prospects?.company_name ?? "prospect"}`, "success"); remove(d.id); }} onDismiss={() => remove(d.id)} />
      ))}
    </ul>
  );
}

function DraftItem({ draft, onSent, onDismiss }: { draft: Draft; onSent: () => void; onDismiss: () => void }) {
  const [body, setBody] = useState(draft.body);
  const [subject, setSubject] = useState(draft.subject);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const p = draft.prospects;

  async function send() {
    setSending(true);
    setFailed(false);
    try {
      await sendFollowUpDraft(draft.id, subject, body);
      onSent();
    } catch {
      setFailed(true);
      setSending(false);
    }
  }

  async function dismiss() {
    await dismissFollowUpDraft(draft.id);
    onDismiss();
  }

  return (
    <li>
      <Card>
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{p?.company_name ?? "Unknown"}</p>
            <p className="text-xs text-faint">
              {p?.contact_name} · {p?.contact_email} · via {p?.source ?? "unknown"}
            </p>
          </div>
          <Badge tone={draft.channel === "no_show" ? "warning" : "neutral"}>{draft.channel === "no_show" ? "No-show" : "External"}</Badge>
        </div>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mb-2 w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mb-2 text-sm" />

        <div className="flex gap-2">
          <Button onClick={send} disabled={sending} className="text-xs">
            <Send size={13} /> {sending ? "Sending..." : "Send via Sarah"}
          </Button>
          <Button variant="secondary" onClick={dismiss} className="text-xs">
            <X size={13} /> Dismiss
          </Button>
        </div>
        {failed && <p className="mt-2 text-xs text-danger">Something went wrong. Try again.</p>}
      </Card>
    </li>
  );
}
