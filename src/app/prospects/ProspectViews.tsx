"use client";

import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import ProspectBoard from "./ProspectBoard";
import ProspectTable from "./ProspectTable";

type Prospect = Parameters<typeof ProspectTable>[0]["prospects"][number];

export default function ProspectViews({ prospects }: { prospects: Prospect[] }) {
  const [view, setView] = useState<"board" | "table">("board");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm shadow-black/[0.03]">
        <button
          onClick={() => setView("board")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "board" ? "bg-surface-subtle text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          <LayoutGrid size={14} /> Board
        </button>
        <button
          onClick={() => setView("table")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "table" ? "bg-surface-subtle text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          <List size={14} /> Table
        </button>
      </div>

      {view === "board" ? <ProspectBoard prospects={prospects} /> : <ProspectTable prospects={prospects} />}
    </div>
  );
}
