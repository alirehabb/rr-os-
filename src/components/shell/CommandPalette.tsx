"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const ROUTES: { label: string; href: string; hint?: string }[] = [
  { label: "Home", href: "/", hint: "RR Pulse & Command Queue" },
  { label: "My Workspace", href: "/my" },
  { label: "Morning Brief", href: "/brief" },
  { label: "RR CRM", href: "/prospects", hint: "Acquisition pipeline" },
  { label: "Clients", href: "/clients" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Log a booked call", href: "/opportunities/new" },
  { label: "Finance", href: "/finance" },
  { label: "Talent", href: "/reps" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Documents", href: "/documents" },
  { label: "Connections", href: "/connections" },
  { label: "RR Score settings", href: "/settings/rr-score" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = ROUTES.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()));

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      go(filtered[selected].href);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-64 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-faint transition-colors hover:border-accent/30"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search or go to...</span>
        <kbd className="rounded-md border border-border bg-surface-subtle px-1.5 py-0.5 text-[10px] text-faint">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onClick={() => setOpen(false)}>
          <div
            className="rr-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search size={16} className="text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search or go to..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
              />
              <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-faint">esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-faint">No matches.</p>}
              {filtered.map((r, i) => (
                <button
                  key={r.href}
                  onClick={() => go(r.href)}
                  onMouseEnter={() => setSelected(i)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    i === selected ? "bg-accent/12 text-accent" : "text-foreground"
                  }`}
                >
                  <span>{r.label}</span>
                  {r.hint && <span className="text-xs text-faint">{r.hint}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
