"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, Textarea } from "@/components/ui";
import { draftFollowUpEmail } from "../actions";

// Drafts only — this never sends anything. The founder copies, edits, and
// sends it themselves through whatever channel they actually use.
export default function AIFollowUpDraft({ prospectId }: { prospectId: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function generate() {
    setLoading(true);
    setFailed(false);
    const text = await draftFollowUpEmail(prospectId);
    setLoading(false);
    if (text) setDraft(text);
    else setFailed(true);
  }

  return (
    <Card className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles size={14} className="text-accent" /> AI follow-up draft
        </p>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground hover:bg-border disabled:opacity-50"
        >
          {loading ? "Drafting..." : draft ? "Regenerate" : "Draft with AI"}
        </button>
      </div>
      {draft && <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="text-sm" />}
      {failed && <p className="text-xs text-danger">Couldn&apos;t generate a draft right now.</p>}
      {!draft && !failed && <p className="text-xs text-faint">Generates a starting point from this prospect&apos;s real notes and stage. Review before sending anything.</p>}
    </Card>
  );
}
