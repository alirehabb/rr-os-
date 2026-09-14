"use client";

import { useMemo, useState } from "react";
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

type SortKey = "company" | "stage" | "next_action_date" | "updated_at";

export default function ProspectTable({ prospects }: { prospects: Prospect[] }) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
      else if (sortKey === "stage") cmp = a.stage.localeCompare(b.stage);
      else if (sortKey === "next_action_date") cmp = (a.next_action_date ?? "").localeCompare(b.next_action_date ?? "");
      else cmp = a.updated_at.localeCompare(b.updated_at);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [prospects, query, stageFilter, sourceFilter, sortKey, sortDir]);

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
        <span className="text-xs text-faint">{rows.length} of {prospects.length}</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left"><SortHeader label="Company" k="company" /></th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-faint">Contact</th>
              <th className="px-4 py-2.5 text-left"><SortHeader label="Stage" k="stage" /></th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-faint">Source</th>
              <th className="px-4 py-2.5 text-left"><SortHeader label="Next action" k="next_action_date" /></th>
              <th className="px-4 py-2.5 text-left"><SortHeader label="Updated" k="updated_at" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const stale = p.next_action_date && new Date(p.next_action_date) < new Date();
              const locked = !!p.converted_client_id;
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-subtle/40">
                  <td className="px-4 py-2.5">
                    <Link href={locked ? `/clients/${p.converted_client_id}` : `/prospects/${p.id}`} className="font-medium text-foreground hover:underline">
                      {p.company_name}
                    </Link>
                    {p.is_demo && <Badge tone="accent" className="ml-1.5">Demo</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {p.contact_name && <p>{p.contact_name}</p>}
                    {p.contact_email && <p className="text-xs text-faint">{p.contact_email}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STAGE_TONE[p.stage] ?? "neutral"}>{STAGE_LABEL[p.stage] ?? p.stage}</Badge>
                    {locked && <p className="mt-1 text-[11px] text-success">→ Client 360</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-faint">{p.source ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {p.next_action ? (
                      <>
                        <p className={stale ? "text-danger" : "text-foreground"}>{p.next_action}</p>
                        {p.next_action_date && (
                          <p className={`text-xs ${stale ? "text-danger" : "text-faint"}`}>{new Date(p.next_action_date).toLocaleDateString()}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-faint">{new Date(p.updated_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-faint">
                  No prospects match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
