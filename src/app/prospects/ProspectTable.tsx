"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Input, Select } from "@/components/ui";

type Prospect = {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  source: string | null;
  stage: string;
  next_action: string | null;
  next_action_date: string | null;
  converted_client_id: string | null;
  is_demo: boolean;
  updated_at: string;
};

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  interested: "Interested",
  call_booked: "Call Booked",
  no_show: "No Show",
  call_completed: "Call Completed",
  follow_up: "Follow-Up",
  not_fit: "Not Fit",
  agreement_sent: "Agreement Sent",
  signed: "Signed",
};

const STAGE_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  lead: "neutral",
  interested: "accent",
  call_booked: "accent",
  no_show: "danger",
  call_completed: "warning",
  follow_up: "warning",
  not_fit: "danger",
  agreement_sent: "success",
  signed: "success",
};

// Won at the top, dead leads at the bottom — the pipeline read top to
// bottom the way the user actually scans it, not alphabetically.
export const STAGE_RANK: Record<string, number> = {
  signed: 0,
  agreement_sent: 1,
  call_completed: 2,
  follow_up: 3,
  call_booked: 4,
  interested: 5,
  lead: 6,
  no_show: 7,
  not_fit: 8,
};

type SortKey = "company" | "stage" | "next_action_date" | "updated_at";

// Fixed row height + windowed rendering: only rows scrolled into view (plus
// overscan) ever hit the DOM. A plain <table> can't do this without breaking
// its layout, so rows are a CSS grid instead. This is what keeps the CRM
// table fast at thousands of rows instead of thousands of live DOM nodes.
const ROW_HEIGHT = 60;
const OVERSCAN = 10;
const GRID_COLS = "minmax(160px,1.5fr) minmax(160px,1.5fr) 120px 100px minmax(140px,1.5fr) 90px";

export default function ProspectTable({ prospects }: { prospects: Prospect[] }) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("stage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(600);

  const sources = useMemo(() => Array.from(new Set(prospects.map((p) => p.source).filter(Boolean))) as string[], [prospects]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = prospects.filter((p) => {
      if (stageFilter !== "all" && p.stage !== stageFilter) return false;
      if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        p.company_name.toLowerCase().includes(q) ||
        (p.contact_name ?? "").toLowerCase().includes(q) ||
        (p.contact_email ?? "").toLowerCase().includes(q)
      );
    });
    filtered = filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "company") cmp = a.company_name.localeCompare(b.company_name);
      else if (sortKey === "stage") cmp = (STAGE_RANK[a.stage] ?? 99) - (STAGE_RANK[b.stage] ?? 99);
      else if (sortKey === "next_action_date") cmp = (a.next_action_date ?? "").localeCompare(b.next_action_date ?? "");
      else cmp = a.updated_at.localeCompare(b.updated_at);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [prospects, query, stageFilter, sourceFilter, sortKey, sortDir]);

  const totalHeight = rows.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(startIndex, endIndex);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "company" || key === "stage" ? "asc" : "desc");
    }
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <button
        onClick={() => toggleSort(k)}
        className="flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wide text-faint hover:text-foreground"
      >
        {label}
        {sortKey === k && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Search company, contact, email..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-64" />
        <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="w-auto">
          <option value="all">All stages</option>
          {Object.entries(STAGE_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
        {sources.length > 0 && (
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-auto">
            <option value="all">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}
        <span className="text-xs text-faint">
          {rows.length} of {prospects.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]">
        <div className="grid gap-0 border-b border-border bg-surface-subtle/40 px-4 py-2.5" style={{ gridTemplateColumns: GRID_COLS }}>
          <SortHeader label="Company" k="company" />
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Contact</p>
          <SortHeader label="Stage" k="stage" />
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Source</p>
          <SortHeader label="Next action" k="next_action_date" />
          <SortHeader label="Updated" k="updated_at" />
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-faint">No prospects match.</p>
        ) : (
          <div
            className="overflow-y-auto"
            style={{ maxHeight: "min(70vh, 640px)" }}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            ref={(el) => {
              viewportRef.current = el;
              if (el && el.clientHeight !== viewportHeight) setViewportHeight(el.clientHeight);
            }}
          >
            <div style={{ height: totalHeight, position: "relative" }}>
              {visibleRows.map((p, i) => {
                const index = startIndex + i;
                const stale = p.next_action_date && new Date(p.next_action_date) < new Date();
                const locked = !!p.converted_client_id;
                return (
                  <div
                    key={p.id}
                    className="grid items-center gap-0 border-b border-border px-4 hover:bg-surface-subtle/40"
                    style={{ gridTemplateColumns: GRID_COLS, position: "absolute", top: index * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
                  >
                    <div className="min-w-0 py-2.5">
                      <Link
                        href={locked ? `/clients/${p.converted_client_id}` : `/prospects/${p.id}`}
                        className="truncate font-medium text-foreground hover:underline"
                      >
                        {p.company_name}
                      </Link>
                      {p.is_demo && (
                        <Badge tone="accent" className="ml-1.5">
                          Demo
                        </Badge>
                      )}
                    </div>
                    <div className="min-w-0 py-2.5 text-muted">
                      {p.contact_name && <p className="truncate">{p.contact_name}</p>}
                      {p.contact_email && <p className="truncate text-xs text-faint">{p.contact_email}</p>}
                    </div>
                    <div className="py-2.5">
                      <Badge tone={STAGE_TONE[p.stage] ?? "neutral"}>{STAGE_LABEL[p.stage] ?? p.stage}</Badge>
                      {locked && <p className="mt-1 text-[11px] text-success">→ Client 360</p>}
                    </div>
                    <div className="truncate py-2.5 text-xs text-faint">{p.source ?? "—"}</div>
                    <div className="min-w-0 py-2.5">
                      {p.next_action ? (
                        <>
                          <p className={`truncate ${stale ? "text-danger" : "text-foreground"}`}>{p.next_action}</p>
                          {p.next_action_date && (
                            <p className={`text-xs ${stale ? "text-danger" : "text-faint"}`}>{new Date(p.next_action_date).toLocaleDateString()}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </div>
                    <div className="py-2.5 text-xs text-faint">{new Date(p.updated_at).toLocaleDateString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
