"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { sendBriefToSlack } from "./actions";

export default function SendToSlackButton() {
  const [result, formAction, pending] = useActionState<{ ok: boolean; error?: string } | null>(async () => sendBriefToSlack(), null);
  const toast = useToast();

  useEffect(() => {
    if (!result) return;
    if (result.ok) toast("Sent to Slack", "success");
    else toast(`Slack send failed: ${result.error}`, "danger");
  }, [result, toast]);

  return (
    <form action={formAction}>
      <Button variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send to Slack"}
      </Button>
    </form>
  );
}
