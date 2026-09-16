"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { moveProspectStage } from "./actions";
import { displayCompanyName } from "@/lib/format";

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

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "lead", label: "Lead", dot: "bg-slate-400" },
  { key: "interested", label: "Interested", dot: "bg-accent" },
  { key: "call_booked", label: "Call Booked", dot: "bg-sky-500" },
  { key: "no_show", label: "No Show", dot: "bg-danger" },
  { key: "call_completed", label: "Call Completed", dot: "bg-warning" },
  { key: "follow_up", label: "Follow-Up", dot: "bg-amber-500" },
  { key: "not_fit", label: "Not Fit", dot: "bg-danger" },
  { key: "agreement_sent", label: "Agreement Sent", dot: "bg-emerald-500" },
  { key: "signed", label: "Signed", dot: "bg-success" },
];

// Fixed card height + windowed rendering per column, same principle as the
// Table view: only cards scrolled into view (plus overscan) ever hit the
// DOM, so a column with thousands of prospects costs the same as one with
// twenty. Each column scrolls independently; the board itself scrolls
// horizontally.
const CARD_HEIGHT = 92;
const CARD_GAP = 8;
const COLUMN_MAX_HEIGHT = 640;
const OVERSCAN = 6;

export default function ProspectBoard({ prospects }: { prospects: Prospect[] }) {
  const [optimistic, setOptimistic] = useState(prospects);
  const [dragId, setDragId] = useState<string | null>(null);
  const toast = useToast();

  function onDrop(stage: string) {
    if (!dragId) return;
    const card = optimistic.find((p) => p.id === dragId);
    if (!card || card.stage === stage || card.converted_client_id) {
      setDragId(null);
      return;
    }
    setOptimistic((prev) => prev.map((p) => (p.id === dragId ? { ...p, stage } : p)));
    moveProspectStage(dragId, stage as Parameters<typeof moveProspectStage>[1]);
    if (stage === "signed") toast(`${displayCompanyName(card.company_name)} signed, Client 360 created`, "success");
    setDragId(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((col) => {
        const cards = optimistic.filter((p) => p.stage === col.key);
        return (
          <Column key={col.key} label={col.label} dot={col.dot} cards={cards} onDragStart={setDragId} onDrop={() => onDrop(col.key)} />
        );
      })}
    </div>
  );
}

function Column({
  label,
  dot,
  cards,
  onDragStart,
  onDrop,
}: {
  label: string;
  dot: string;
  cards: Prospect[];
  onDragStart: (id: string) => void;
  onDrop: () => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(COLUMN_MAX_HEIGHT);

  const rowHeight = CARD_HEIGHT + CARD_GAP;
  const totalHeight = cards.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endIndex = Math.min(cards.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN);
  const visible = cards.slice(startIndex, endIndex);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex w-64 shrink-0 flex-col rounded-2xl border border-border bg-surface-subtle/40 p-2"
    >
      <div className="mb-2 flex items-center justify-between px-1.5 py-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-faint">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {label}
        </p>
        <span className="text-xs text-faint">{cards.length}</span>
      </div>

      {cards.length === 0 ? (
        <p className="px-1.5 py-4 text-center text-xs text-faint">Drop here</p>
      ) : (
        <div
          className="overflow-y-auto"
          style={{ maxHeight: COLUMN_MAX_HEIGHT }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          ref={(el) => {
            viewportRef.current = el;
            if (el && el.clientHeight !== viewportHeight) setViewportHeight(el.clientHeight);
          }}
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            {visible.map((p, i) => {
              const index = startIndex + i;
              const stale = p.next_action_date && new Date(p.next_action_date) < new Date();
              const locked = !!p.converted_client_id;
              return (
                <div
                  key={p.id}
                  style={{ position: "absolute", top: index * rowHeight, left: 0, right: 0, height: CARD_HEIGHT }}
                  draggable={!locked}
                  onDragStart={(e) => {
                    onDragStart(p.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", p.id);
                  }}
                  className={`rounded-xl border border-border bg-surface p-2.5 shadow-sm shadow-black/[0.03] transition-shadow ${
                    locked ? "cursor-default opacity-70" : "cursor-grab hover:shadow-md active:cursor-grabbing"
                  } ${stale && !locked ? "rr-urgent-pulse" : ""}`}
                >
                  <Link href={locked ? `/clients/${p.converted_client_id}` : `/prospects/${p.id}`} draggable={false} className="block">
                    <p className="truncate text-sm font-medium text-foreground">{p.contact_name || displayCompanyName(p.company_name)}</p>
                    <p className="truncate text-xs text-muted">{displayCompanyName(p.company_name)}</p>
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
