"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { runChasingNow } from "./actions";

export default function RunChasingButton() {
  const [result, formAction, pending] = useActionState<{ checked: number; created: string[] } | null>(async () => runChasingNow(), null);
  const toast = useToast();

  useEffect(() => {
    if (!result) return;
    if (result.created.length > 0) toast(`Chasing found ${result.created.length} new overdue item(s)`, "success");
    else toast(`Checked ${result.checked} condition(s) — nothing new`, "neutral");
  }, [result, toast]);

  return (
    <form action={formAction}>
      <Button disabled={pending}>{pending ? "Checking…" : "Run chasing now"}</Button>
    </form>
  );
}
