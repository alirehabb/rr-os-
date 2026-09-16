"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Send, X, Sparkles, Inbox as InboxIcon, ListChecks } from "lucide-react";
import { Card, Button, Input, Select, Textarea, Badge, EmptyState } from "@/components/ui";
import { useToast } from "@/components/toast";
import { displayCompanyName } from "@/lib/format";
import {
  createCampaign,
  addToCampaign,
  removeFromCampaign,
  getThreadForProspect,
  draftFollowUpNow,
  sendFollowUpNow,
  sendCampaignDraft,
  dismissCampaignDraft,
} from "./actions";

type Prospect = {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  source: string | null;
  stage: string;
  next_action_date: string | null;
  updated_at: string;
};
type Campaign = { id: string; name: string; channel: "instantly" | "sarah" };
type CampaignProspect = { id: string; campaign_id: string; prospect_id: string; status: string };
type PendingDraft = {
  id: string;
  channel: "external" | "no_show";
  subject: string;
  body: string;
  created_at: string;
  prospects: { id: string; company_name: string; contact_name: string | null; contact_email: string | null; source: string | null } | null;
};
type ThreadMessage = { id: string; fromLead: boolean; fromAddress: string; text: string; sentAt: string };

export default function FollowUpClient({
  prospects,
  campaigns,
  campaignProspects,
  pendingDrafts,
}: {
  prospects: Prospect[];
  campaigns: Campaign[];
  campaignProspects: CampaignProspect[];
  pendingDrafts: PendingDraft[];
}) {
  const [tab, setTab] = useState<"inbox" | "review">("inbox");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1 border-b border-border px-6 pt-4">
        <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")} icon={InboxIcon} label="Inbox" />
        <TabButton active={tab === "review"} onClick={() => setTab("review")} icon={ListChecks} label="Pending Review" badge={pendingDrafts.length} />
      </div>
      {tab === "inbox" ? (
        <InboxView prospects={prospects} campaigns={campaigns} campaignProspects={campaignProspects} />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <ReviewQueue drafts={pendingDrafts} />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, badge }: { active: boolean; onClick: () => void; icon: typeof InboxIcon; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-t-xl border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      <Icon size={14} />
      {label}
      {!!badge && <Badge tone="accent">{badge}</Badge>}
    </button>
  );
}

// ---------- Inbox: campaigns sidebar (drop targets) + prospect list (drag source) + thread pane ----------
function InboxView({ prospects, campaigns, campaignProspects }: { prospects: Prospect[]; campaigns: Campaign[]; campaignProspects: CampaignProspect[] }) {
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [query, setQuery] = useState("");
  const [campaignList, setCampaignList] = useState(campaigns);
  const [memberships, setMemberships] = useState(campaignProspects);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const toast = useToast();

  // Server actions here revalidatePath() rather than returning fresh data,
  // so new props from the re-fetched server component need to flow into
  // this local state explicitly, or a newly created campaign / a removed
  // membership would only ever show up after a manual reload.
  useEffect(() => setCampaignList(campaigns), [campaigns]);
  useEffect(() => setMemberships(campaignProspects), [campaignProspects]);

  const filtered = prospects.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.company_name.toLowerCase().includes(q) || (p.contact_name ?? "").toLowerCase().includes(q) || (p.contact_email ?? "").toLowerCase().includes(q);
  });

  function campaignsFor(prospectId: string) {
    const ids = memberships.filter((m) => m.prospect_id === prospectId).map((m) => m.campaign_id);
    return campaignList.filter((c) => ids.includes(c.id));
  }

  async function handleDrop(campaignId: string) {
    if (!dragId) return;
    const already = memberships.some((m) => m.campaign_id === campaignId && m.prospect_id === dragId);
    if (!already) {
      setMemberships((m) => [...m, { id: `temp-${dragId}-${campaignId}`, campaign_id: campaignId, prospect_id: dragId, status: "active" }]);
      addToCampaign(dragId, campaignId);
      const campaign = campaignList.find((c) => c.id === campaignId);
      toast(`Added to ${campaign?.name ?? "campaign"}`, "success");
    }
    setDragId(null);
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Campaigns sidebar */}
      <div className="w-56 shrink-0 border-r border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Campaigns</p>
          <button onClick={() => setShowNewCampaign((v) => !v)} className="text-faint hover:text-foreground">
            <Plus size={14} />
          </button>
        </div>
        {showNewCampaign && (
          <form
            action={async (fd) => {
              await createCampaign(fd);
              setShowNewCampaign(false);
            }}
            className="mb-3 space-y-1.5 rounded-xl border border-border bg-surface-subtle/40 p-2"
          >
            <Input name="name" placeholder="Campaign name" required className="text-xs" />
            <Select name="channel" className="w-full text-xs">
              <option value="sarah">Via Sarah (review first)</option>
              <option value="instantly">Via Instantly (auto-send)</option>
            </Select>
            <Button className="w-full !py-1 text-xs">Create</Button>
          </form>
        )}
        <div className="space-y-1.5">
          {campaignList.length === 0 && <p className="text-xs text-faint">No campaigns yet.</p>}
          {campaignList.map((c) => (
            <div
              key={c.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(c.id)}
              className="rounded-xl border border-dashed border-border p-2.5 text-xs transition-colors hover:border-accent/50 hover:bg-accent/5"
            >
              <Link href={`/follow-ups/campaigns/${c.id}`} className="font-medium text-foreground hover:underline">
                {c.name}
              </Link>
              <p className="mt-0.5 text-[11px] text-faint">{c.channel === "instantly" ? "Instantly, auto-send" : "Sarah, review first"}</p>
              <p className="mt-1 text-[11px] text-faint">{memberships.filter((m) => m.campaign_id === c.id).length} prospects · drop here, click name to open</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prospect list */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-2.5">
          <Input placeholder="Search prospects..." value={query} onChange={(e) => setQuery(e.target.value)} className="text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onClick={() => setSelected(p)}
              className={`cursor-pointer border-b border-border px-3 py-2.5 transition-colors hover:bg-surface-subtle/60 ${selected?.id === p.id ? "bg-accent/8" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">{p.contact_name || displayCompanyName(p.company_name)}</p>
                <span className="shrink-0 text-[10px] text-faint">{new Date(p.updated_at).toLocaleDateString()}</span>
              </div>
              <p className="truncate text-xs text-muted">{displayCompanyName(p.company_name)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge tone={p.source === "instantly" ? "accent" : "neutral"}>{p.source ?? "unknown"}</Badge>
                <Badge>{p.stage.replace(/_/g, " ")}</Badge>
                {campaignsFor(p.id).map((c) => (
                  <span key={c.id} className="rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="p-4 text-center text-sm text-faint">No prospects match.</p>}
        </div>
      </div>

      {/* Thread + composer */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <ThreadPane prospect={selected} campaignsHere={campaignsFor(selected.id)} onRemoveCampaign={(cpId) => setMemberships((m) => m.filter((x) => x.id !== cpId))} allMemberships={memberships} />
        ) : (
          <EmptyState title="Select a prospect" hint="Pick someone from the list to see their conversation and follow up." />
        )}
      </div>
    </div>
  );
}

function ThreadPane({
  prospect,
  campaignsHere,
  onRemoveCampaign,
  allMemberships,
}: {
  prospect: Prospect;
  campaignsHere: Campaign[];
  onRemoveCampaign: (id: string) => void;
  allMemberships: CampaignProspect[];
}) {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<{ subject: string; body: string; suggestedChannel: "instantly" | "sarah" } | null>(null);
  const [channel, setChannel] = useState<"instantly" | "sarah">("sarah");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    setMessages(null);
    getThreadForProspect(prospect.id).then((r) => {
      setMessages(r.messages);
      setLoading(false);
    });
  }, [prospect.id]);

  async function generate() {
    setDrafting(true);
    const d = await draftFollowUpNow(prospect.id);
    setDrafting(false);
    if (d) {
      setDraft(d);
      setChannel(d.suggestedChannel);
    }
  }

  async function send() {
    if (!draft) return;
    setSending(true);
    try {
      await sendFollowUpNow(prospect.id, channel, draft.subject, draft.body);
      toast(`Sent via ${channel === "instantly" ? "Instantly" : "Sarah"}`, "success");
      setDraft(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send", "danger");
    }
    setSending(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{prospect.contact_name || displayCompanyName(prospect.company_name)}</h2>
          <p className="text-sm text-muted">
            {displayCompanyName(prospect.company_name)} · {prospect.contact_email}
          </p>
        </div>
        <div className="flex gap-1">
          {campaignsHere.map((c) => {
            const membership = allMemberships.find((m) => m.campaign_id === c.id && m.prospect_id === prospect.id);
            return (
              <span key={c.id} className="flex items-center gap-1 rounded-full bg-success-bg px-2 py-1 text-xs text-success">
                {c.name}
                {membership && (
                  <button onClick={() => { removeFromCampaign(membership.id); onRemoveCampaign(membership.id); }} className="hover:text-danger">
                    <X size={11} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Gmail-style thread */}
      <div className="mb-6 space-y-2">
        {loading ? (
          <p className="text-sm text-faint">Loading conversation...</p>
        ) : (messages ?? []).length === 0 ? (
          <Card className="text-sm text-faint">No Instantly thread found. {prospect.source !== "instantly" && "This lead came in through a different channel."}</Card>
        ) : (
          (messages ?? []).map((m) => (
            <div key={m.id} className={`rounded-2xl border p-3 text-sm ${m.fromLead ? "border-border bg-surface-subtle/40" : "border-accent/20 bg-accent/5"}`}>
              <div className="mb-1 flex items-center justify-between text-xs text-faint">
                <span className="font-medium text-foreground">{m.fromAddress}</span>
                <span>{new Date(m.sentAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-foreground">{m.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Compose */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles size={14} className="text-accent" /> Follow up
          </p>
          <button onClick={generate} disabled={drafting} className="rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground hover:bg-border disabled:opacity-50">
            {drafting ? "Drafting..." : draft ? "Regenerate" : "Draft with AI"}
          </button>
        </div>
        {draft && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={channel} onChange={(e) => setChannel(e.target.value as "instantly" | "sarah")} className="text-xs">
                <option value="sarah">Send via Sarah (Resend)</option>
                <option value="instantly" disabled={prospect.source !== "instantly"}>
                  Reply on Instantly thread
                </option>
              </Select>
            </div>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-accent/40"
            />
            <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6} className="text-sm" />
            <Button onClick={send} disabled={sending} className="text-xs">
              <Send size={13} /> {sending ? "Sending..." : `Send via ${channel === "instantly" ? "Instantly" : "Sarah"}`}
            </Button>
          </div>
        )}
        {!draft && <p className="text-xs text-faint">Nothing is ever sent automatically here. Draft, review, then send.</p>}
      </Card>
    </div>
  );
}

// ---------- Pending Review: campaign-generated drafts (Sarah-channel campaigns) ----------
function ReviewQueue({ drafts: initial }: { drafts: PendingDraft[] }) {
  const [drafts, setDrafts] = useState(initial);
  const toast = useToast();

  if (drafts.length === 0) return <EmptyState title="Nothing waiting for review." hint="Sarah-channel campaign follow-ups show up here before sending." />;

  return (
    <ul className="mx-auto max-w-2xl space-y-3">
      {drafts.map((d) => (
        <li key={d.id}>
          <ReviewItem
            draft={d}
            onDone={(sent) => {
              setDrafts((prev) => prev.filter((x) => x.id !== d.id));
              if (sent) toast(`Sent to ${d.prospects?.contact_name || (d.prospects ? displayCompanyName(d.prospects.company_name) : "prospect")}`, "success");
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function ReviewItem({ draft, onDone }: { draft: PendingDraft; onDone: (sent: boolean) => void }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [sending, setSending] = useState(false);
  const p = draft.prospects;

  async function send() {
    setSending(true);
    try {
      await sendCampaignDraft(draft.id, subject, body);
      onDone(true);
    } catch {
      setSending(false);
    }
  }
  async function dismiss() {
    await dismissCampaignDraft(draft.id);
    onDone(false);
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{p?.contact_name || (p ? displayCompanyName(p.company_name) : "Unknown")}</p>
          <p className="text-xs text-faint">
            {p ? displayCompanyName(p.company_name) : ""} · {p?.contact_email} · via {p?.source ?? "unknown"}
          </p>
        </div>
        <Badge tone={draft.channel === "no_show" ? "warning" : "neutral"}>{draft.channel === "no_show" ? "No-show" : "External"}</Badge>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="mb-2 w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-accent/40"
      />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mb-2 text-sm" />
      <div className="flex gap-2">
        <Button onClick={send} disabled={sending} className="text-xs">
          <Send size={13} /> {sending ? "Sending..." : "Send via Sarah"}
        </Button>
        <Button variant="secondary" onClick={dismiss} className="text-xs">
          <X size={13} /> Dismiss
        </Button>
      </div>
    </Card>
  );
}
