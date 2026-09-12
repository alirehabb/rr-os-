"use client";

import { useActionState, useEffect } from "react";
import { Field, Input, Select, Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { setRepCompensationTerms } from "@/app/finance/actions";

export default function SetCompensationForm({ assignmentId, repId }: { assignmentId: string; repId: string }) {
  const [result, formAction, pending] = useActionState<{ recomputedCount: number; totalAmount: number } | null, FormData>(
    async (_prev, formData) => setRepCompensationTerms(formData),
    null,
  );
  const toast = useToast();

  useEffect(() => {
    if (!result) return;
    if (result.recomputedCount > 0) {
      const money = result.totalAmount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
      toast(`Compensation set — backfilled ${result.recomputedCount} missed commission(s), ${money}`, "success");
    } else {
      toast("Compensation set", "success");
    }
  }, [result, toast]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="rep_id" value={repId} />
      <Field label="Rate (e.g. 0.4)">
        <Input name="rate" type="number" step="0.01" min="0" max="1" required className="w-24 text-xs" />
      </Field>
      <Field label="Basis">
        <Select name="basis" className="text-xs">
          <option value="client_cash">% of client cash collected</option>
          <option value="rr_share">% of RR&apos;s share</option>
        </Select>
      </Field>
      <Button variant="secondary" disabled={pending} className="!px-3 !py-1.5 text-xs">
        {pending ? "Setting…" : "Set compensation"}
      </Button>
    </form>
  );
}
