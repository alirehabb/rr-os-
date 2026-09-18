"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Card, Input, Textarea, Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { draftCustomEmail, sendCustomEmail } from "../actions";

// AI-generate step is a draft, never a send: the founder's prompt goes to
// the model, the result lands in editable subject/body fields, and only
// clicking Send actually emails anyone — same discipline as the AI reply
// agent's own draft-then-review flow, just manual here.
export default function CustomEmailComposer({ repId, firstName }: { repId: string; firstName: string }) {
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  async function generate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    const draft = await draftCustomEmail(repId, prompt.trim());
    setGenerating(false);
    if (draft) {
      setSubject(draft.subject);
      setBody(draft.body);
    } else {
      toast("Couldn't generate a draft right now.", "danger");
    }
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    const fd = new FormData();
    fd.set("rep_id", repId);
    fd.set("subject", subject);
    fd.set("body", body);
    await sendCustomEmail(fd);
    setSending(false);
    setPrompt("");
    setSubject("");
    setBody("");
    toast(`Sent to ${firstName}`, "success");
  }

  return (
    <Card className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`What do you want to tell ${firstName}? e.g. "ask for an updated resume and a recent call recording"`}
          className="flex-1"
        />
        <Button type="button" variant="secondary" onClick={generate} disabled={generating || !prompt.trim()} className="shrink-0 text-xs">
          <Sparkles size={13} /> {generating ? "Generating..." : "Generate with AI"}
        </Button>
      </div>

      {(subject || body) && (
        <div className="space-y-2 border-t border-border pt-2">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Email body" />
          <Button type="button" onClick={send} disabled={sending} className="text-xs">
            <Send size={13} /> {sending ? "Sending..." : "Send email"}
          </Button>
        </div>
      )}
    </Card>
  );
}
