"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, ExternalLink } from "lucide-react";
import { Badge, Button, Select, Avatar } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { updateRecruitingStatus } from "./actions";

type Rep = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  recruiting_status: string;
  capabilities: string[];
  geography: string | null;
  timezone: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  intro_loom_url: string | null;
  sales_recording_url: string | null;
  offer_text: string | null;
  evidence_source: string | null;
  claimed_cash_collected: number | null;
  notes: string | null;
  community_waitlist: boolean;
  is_demo: boolean;
};

const STATUS_TONE = {
  application: "neutral",
  screening: "neutral",
  interview: "accent",
  talent_pool: "neutral",
  rejected: "danger",
  available_for_matching: "accent",
  selected: "accent",
  client_training: "warning",
  live_trial: "warning",
  confirmed_active: "success",
  bench: "warning",
  removed: "danger",
} as const;

const RECRUITING_STATUSES = Object.keys(STATUS_TONE) as (keyof typeof STATUS_TONE)[];

// Recruiting flow, grouped into a real scouting board: Applicants -> Review
// -> Talent Pool -> Matched -> Trial -> Active, with Bench/Removed off to
// the side. Every stage is split Closer/Setter — this is roster management,
// not a single flat applicant table.
const GROUPS: { label: string; statuses: (keyof typeof STATUS_TONE)[] }[] = [
  { label: "Applicants", statuses: ["application"] },
  { label: "Review", statuses: ["screening", "interview"] },
  { label: "Talent Pool", statuses: ["talent_pool", "available_for_matching", "selected"] },
  { label: "Matched", statuses: ["client_training"] },
  { label: "Trial", statuses: ["live_trial"] },
  { label: "Active", statuses: ["confirmed_active"] },
  { label: "Bench", statuses: ["bench"] },
  { label: "Removed", statuses: ["removed", "rejected"] },
];

const ROLE_COLUMNS: { label: string; capability: string }[] = [
  { label: "Closers", capability: "closer" },
  { label: "Setters", capability: "setter" },
];

function tone(status: string) {
  return STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral";
}

export default function TalentBoard({
  reps,
  activeAccountCountByRep,
}: {
  reps: Rep[];
  activeAccountCountByRep: Record<string, number>;
}) {
  const [selected, setSelected] = useState<Rep | null>(null);

  return (
    <div className="space-y-10">
      {GROUPS.map((group) => {
        const groupReps = reps.filter((r) => group.statuses.includes(r.recruiting_status as keyof typeof STATUS_TONE));
        if (groupReps.length === 0) return null;
        return (
          <section key={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
              <Badge tone="neutral">{groupReps.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {ROLE_COLUMNS.map((col) => {
                const colReps = groupReps.filter((r) => r.capabilities.includes(col.capability));
                if (colReps.length === 0) return null;
                return (
                  <div key={col.label}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                      {col.label} <span className="text-faint">({colReps.length})</span>
                    </p>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {colReps.map((r) => (
                        <li key={r.id}>
                          <button
                            onClick={() => setSelected(r)}
                            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-center shadow-sm shadow-black/[0.03] transition-transform hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                          >
                            <Avatar name={r.full_name} />
                            <p className="font-medium text-foreground">{r.full_name}</p>
                            {r.geography && (
                              <p className="flex items-center gap-1 text-xs text-muted">
                                <MapPin size={11} /> {r.geography}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {r.is_demo && <Badge tone="accent">Demo</Badge>}
                              <Badge tone={tone(r.recruiting_status)}>{r.recruiting_status.replace(/_/g, " ")}</Badge>
                            </div>
                            {(activeAccountCountByRep[r.id] ?? 0) > 0 && (
                              <p className="text-[11px] text-faint">{activeAccountCountByRep[r.id]} active account(s)</p>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {reps.length === 0 && <p className="text-sm text-faint">No applicants yet.</p>}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.full_name ?? ""}>
        {selected && <RepProfile rep={selected} onStatusChanged={(status) => setSelected({ ...selected, recruiting_status: status })} />}
      </Sheet>
    </div>
  );
}

function RepProfile({ rep, onStatusChanged }: { rep: Rep; onStatusChanged: (status: string) => void }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {rep.capabilities.map((c) => (
          <Badge key={c} tone="neutral">
            {c}
          </Badge>
        ))}
        <Badge tone={tone(rep.recruiting_status)}>{rep.recruiting_status.replace(/_/g, " ")}</Badge>
        {rep.community_waitlist && <Badge tone="accent">On community waitlist</Badge>}
      </div>

      <div className="rounded-2xl border border-border bg-surface-subtle/40 p-4">
        <form
          action={async (fd) => {
            const next = String(fd.get("recruiting_status"));
            await updateRecruitingStatus(fd);
            onStatusChanged(next);
          }}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="rep_id" value={rep.id} />
          <Select key={rep.recruiting_status} name="recruiting_status" defaultValue={rep.recruiting_status} className="flex-1">
            {RECRUITING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Update &amp; notify
          </Button>
        </form>
        <p className="mt-2 text-xs text-faint">
          Changing status emails {rep.full_name.split(" ")[0]} automatically. Interview requests include the Calendly link, rejections
          include the community waitlist offer.
        </p>
      </div>

      <dl className="space-y-2.5">
        <Row label="Email" value={rep.email} href={`mailto:${rep.email}`} />
        <Row label="Phone" value={rep.phone} href={rep.phone ? `tel:${rep.phone}` : undefined} />
        <Row label="Location" value={rep.geography} />
        <Row label="Timezone" value={rep.timezone} />
        <Row label="LinkedIn" value={rep.linkedin_url} href={isUrl(rep.linkedin_url) ? rep.linkedin_url! : undefined} />
        <Row label="Resume" value={rep.resume_url} href={isUrl(rep.resume_url) ? rep.resume_url! : undefined} />
        <Row label="Intro Loom" value={rep.intro_loom_url} href={isUrl(rep.intro_loom_url) ? rep.intro_loom_url! : undefined} />
        <Row label="Sales recording" value={rep.sales_recording_url} href={isUrl(rep.sales_recording_url) ? rep.sales_recording_url! : undefined} />
        <Row label="Applied for" value={rep.offer_text} />
        <Row label="Evidence / source" value={rep.evidence_source} />
        <Row label="Claimed cash collected" value={rep.claimed_cash_collected ? `$${Number(rep.claimed_cash_collected).toLocaleString()}` : null} />
        {rep.notes && (
          <div>
            <dt className="text-xs text-faint">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-foreground">{rep.notes}</dd>
          </div>
        )}
      </dl>

      <Link href={`/reps/${rep.id}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
        Full record (trial, compensation, history) <ExternalLink size={11} />
      </Link>
    </div>
  );
}

function isUrl(v: string | null) {
  return !!v && /^https?:\/\//.test(v);
}

function Row({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      {href ? (
        <dd className="mt-0.5 truncate text-accent hover:underline">
          <a href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        </dd>
      ) : (
        <dd className="mt-0.5 text-foreground">{value}</dd>
      )}
    </div>
  );
}
