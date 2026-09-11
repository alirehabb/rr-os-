"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

type CheckResult = { status: "connected" | "degraded" | "disconnected"; last_error: string | null };

export default function CheckConnectionForm({ provider, action }: { provider: string; action: () => Promise<CheckResult> }) {
  const [result, formAction, pending] = useActionState<CheckResult | null>(async () => action(), null);
  const toast = useToast();

  useEffect(() => {
    if (!result) return;
    if (result.status === "connected") toast(`${provider} connected`, "success");
    else toast(`${provider}: ${result.last_error ?? result.status}`, "danger");
  }, [result, provider, toast]);

  return (
    <form action={formAction} className="mt-2">
      <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={pending}>
        {pending ? "Checking…" : "Check connection"}
      </Button>
    </form>
  );
}
