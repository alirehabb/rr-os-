"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { moveProspectStage } from "./actions";

type Prospect = {
  id: string;
  company_name: string;
  contact_name: string | null;
  source: string | null;
  stage: string;
  next_action: string | null;
  next_action_date: string | null;
  converted_client_id: string | null;
  is_demo: boolean;
  updated_at: string;
};

const STAGES: { key: string; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "interested", label: "Interested" },
  { key: "call_booked", label: "Call Booked" },
  { key: "no_show", label: "No Show" },
  { key: "call_completed", label: "Call Completed" },
  { key: "follow_up", label: "Follow-Up" },
  { key: "not_fit", label: "Not Fit" },
  { key: "agreement_sent", label: "Agreement Sent" },
  { key: "signed", label: "Signed" },
];

export default function ProspectBoard({ prospects }: { prospects: Prospect[] }) {
  const [optimistic, setOptimistic] = useState(prospects);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  function onDrop(stage: string) {
    if (!dragId) return;
    const card = optimistic.find((p) => p.id === dragId);
    if (!card || card.stage === stage || card.converted_client_id) {
      setDragId(null);
      return;
    }
    setOptimistic((prev) => prev.map((p) => (p.id === dragId ? { ...p, stage } : p)));
    startTransition(() => {
      moveProspectStage(dragId, stage as Parameters<typeof moveProspectStage>[1]);
    });
    if (stage === "signed") toast(`${card.company_name} signed — Client 360 created`, "success");
    setDragId(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((col) => {
        const cards = optimistic.filter((p) => p.stage === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(col.key)}
            className="flex w-64 shrink-0 flex-col rounded-2xl border border-border bg-surface-subtle/40 p-2"
          >
            <div className="mb-2 flex items-center justify-between px-1.5 py-1">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">{col.label}</p>
              <span className="text-xs text-faint">{cards.length}</span>
            </div>
            <div className="flex-1 space-y-2">
              <AnimatePresence initial={false}>
                {cards.map((p) => {
                  const stale = p.next_action_date && new Date(p.next_action_date) < new Date();
                  const locked = !!p.converted_client_id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      layoutId={p.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="rounded-xl"
                    >
                      <div
                        draggable={!locked}
                        onDragStart={(e) => {
                          setDragId(p.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", p.id);
                        }}
                        className={`rounded-xl border border-border bg-surface p-2.5 shadow-sm shadow-black/[0.03] ${
                          locked ? "cursor-default opacity-70" : "cursor-grab active:cursor-grabbing"
                        } ${stale && !locked ? "rr-urgent-pulse" : ""}`}
                      >
                      <Link
                        href={locked ? `/clients/${p.converted_client_id}` : `/prospects/${p.id}`}
                        draggable={false}
                        className="block"
                      >
                        <p className="truncate text-sm font-medium text-foreground">{p.company_name}</p>
                        {p.contact_name && <p className="truncate text-xs text-muted">{p.contact_name}</p>}
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {p.is_demo && <Badge tone="accent">Demo</Badge>}
                          {p.source && <span className="text-[11px] text-faint">{p.source}</span>}
                        </div>
                        {p.next_action && (
                          <p className={`mt-1.5 truncate text-[11px] ${stale ? "text-danger" : "text-faint"}`}>
                            {p.next_action}
                            {p.next_action_date && ` · ${new Date(p.next_action_date).toLocaleDateString()}`}
                          </p>
                        )}
                        {locked && <p className="mt-1.5 text-[11px] text-success">→ Client 360</p>}
                      </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {cards.length === 0 && <p className="px-1.5 py-4 text-center text-xs text-faint">Drop here</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
