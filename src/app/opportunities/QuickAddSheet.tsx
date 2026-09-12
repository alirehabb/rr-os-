"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Field, Input, Select, Button } from "@/components/ui";
import { createOpportunity } from "./actions";

export default function QuickAddOpportunitySheet({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-accent/40 hover:bg-accent/5"
      >
        <PlusCircle size={15} className="text-accent" />
        Add Opportunity
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Log a booked call">
        <form action={createOpportunity} className="space-y-4">
          <Field label="Client">
            <Select name="client_id" required className="w-full">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prospect name">
            <Input name="prospect_name" required />
          </Field>
          <Field label="Prospect contact (email/phone)">
            <Input name="prospect_contact" />
          </Field>
          <Field label="Source">
            <Input name="source" placeholder="e.g. Calendly, referral" />
          </Field>
          <Field label="Scheduled call time">
            <Input type="datetime-local" name="scheduled_at" required />
          </Field>
          <Button type="submit" className="w-full">
            Create opportunity
          </Button>
        </form>
      </Sheet>
    </>
  );
}
