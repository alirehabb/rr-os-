"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Field, Input, Select, Button } from "@/components/ui";
import { createClient_ } from "./actions";

export default function QuickAddClientSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-accent/40 hover:bg-accent/5"
      >
        <Building2 size={15} className="text-accent" />
        Add Client
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Sign new client">
        <form action={createClient_} className="space-y-4">
          <Field label="Client name">
            <Input name="name" required />
          </Field>
          <Field label="Workflow type">
            <Select name="workflow_type" className="w-full">
              <option value="closing_only">Closing only</option>
              <option value="setting_enabled">Setting enabled</option>
              <option value="azgari">Azgari (broker/candidate)</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full">
            Sign new client
          </Button>
        </form>
      </Sheet>
    </>
  );
}
