// Instantly v2 API client — read-only reply fetching. Auth is a plain
// Bearer token (the whole INSTANTLY_API_KEY value), confirmed against the
// real account: GET /api/v2/emails returns Unibox items where ue_type=2 is
// an inbound reply (ue_type=3 is our own sent email) and content_preview/
// body.html carry the message.
export type InstantlyReply = {
  id: string;
  leadEmail: string;
  fromName: string;
  subject: string;
  preview: string;
  html: string;
  receivedAt: string;
  campaignId: string | null;
  threadId: string;
  // The Instantly-connected mailbox this thread is running through (e.g.
  // Sundeep's account) — a reply must go out from this same account, not
  // from some other Rehab Revenue address, or it lands in a thread the
  // lead never wrote to.
  eaccount: string;
};

const ALI_EMAIL = "ali@rehab-revenue.com";

// Instantly's own content_preview field truncates early enough to cut off
// the actual ask — confirmed live on a real reply where content_preview
// stopped at "interested in chatting b" and never showed the "Can you send
// me more information? What's the pay structure?" that followed. The real
// message text has to come from the HTML body instead: strip the quoted
// thread history (everything from the first blockquote/reply-chain marker
// on) so only the lead's actual new text is used, then strip tags.
function extractNewMessageText(html: string): string {
  if (!html) return "";
  const beforeQuote = html.split(/<blockquote/i)[0].split(/<div[^>]*class="gmail_quote"/i)[0];
  const text = beforeQuote
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    // Trailing Gmail/Outlook attribution line ("On Fri, Sep 11... wrote:")
    // that sits just before the quoted blockquote, not inside it.
    .replace(/\n?On [\s\S]{0,120}wrote:\s*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, 2000);
}

export type ThreadMessage = {
  id: string;
  fromLead: boolean;
  fromAddress: string;
  text: string;
  sentAt: string;
};

// Full conversation history for one lead, oldest first — for a Gmail-style
// reading pane, not a single "latest reply." Uses the same `search=` param
// as getLatestThreadState (confirmed reliable; thread_id alone was not).
export async function getFullThread(leadEmail: string): Promise<ThreadMessage[]> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(`https://api.instantly.ai/api/v2/emails?limit=50&search=${encodeURIComponent(leadEmail)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items = (json.items ?? []) as Record<string, unknown>[];

    return items
      .filter((item) => item.lead === leadEmail)
      .map((item) => {
        const html = String((item.body as { html?: string } | undefined)?.html ?? "");
        return {
          id: String(item.id),
          fromLead: item.ue_type === 2 && String(item.from_address_email ?? "").toLowerCase() === leadEmail.toLowerCase(),
          fromAddress: String(item.from_address_email ?? ""),
          text: extractNewMessageText(html) || String(item.content_preview ?? ""),
          sentAt: String(item.timestamp_email ?? item.timestamp_created ?? ""),
        };
      })
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  } catch {
    return [];
  }
}

export async function getRecentReplies(limit = 25): Promise<InstantlyReply[]> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(`https://api.instantly.ai/api/v2/emails?limit=${limit}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items = (json.items ?? []) as Record<string, unknown>[];

    return items
      .filter((item) => {
        // ue_type 2 means "landed in this mailbox," not "written by the
        // lead" — a message Ali sends by hitting reply-all also lands here
        // as ue_type 2, since it's inbound to Sundeep's connected account.
        // Confirmed against real data: two of Ali's own replies showed up
        // with ue_type 2 and from_address_email = ali@rehab-revenue.com.
        // Only a message actually authored by the lead counts as a reply
        // to draft against.
        if (item.ue_type !== 2 || typeof item.lead !== "string") return false;
        const from = String(item.from_address_email ?? "").toLowerCase();
        return from === String(item.lead).toLowerCase();
      })
      .map((item) => {
        const fromJson = (item.from_address_json as { name?: string; address?: string }[] | undefined)?.[0];
        const html = String((item.body as { html?: string } | undefined)?.html ?? "");
        const fullText = extractNewMessageText(html);
        return {
          id: String(item.id),
          leadEmail: String(item.lead),
          fromName: fromJson?.name || String(item.lead).split("@")[0],
          subject: String(item.subject ?? ""),
          preview: fullText || String(item.content_preview ?? "").slice(0, 500),
          html,
          receivedAt: String(item.timestamp_email ?? item.timestamp_created ?? new Date().toISOString()),
          campaignId: (item.campaign_id as string) ?? null,
          threadId: String(item.thread_id ?? ""),
          eaccount: String(item.eaccount ?? ""),
        };
      });
  } catch {
    return [];
  }
}

export type ThreadState = {
  threadId: string;
  eaccount: string;
  subject: string;
  lastMessageId: string;
  lastMessageAt: string;
  lastMessageFromLead: boolean;
  leadMessagePreview: string;
};

// For proactive follow-up (rule 9): finds the most recent message in a
// lead's thread regardless of direction, so the cron can tell "they went
// quiet after our last message" (follow up) apart from "they just replied"
// (that's the reactive pipeline's job, not this one). Uses the `search`
// query param, confirmed working against the real API — the `thread_id`
// param alone was seen returning occasional items from a different thread.
export async function getLatestThreadState(leadEmail: string): Promise<ThreadState | null> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api.instantly.ai/api/v2/emails?limit=50&search=${encodeURIComponent(leadEmail)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const items = (json.items ?? []) as Record<string, unknown>[];
    const forThisLead = items.filter((item) => item.lead === leadEmail);
    if (forThisLead.length === 0) return null;

    forThisLead.sort((a, b) => {
      const at = new Date(String(a.timestamp_email ?? a.timestamp_created ?? 0)).getTime();
      const bt = new Date(String(b.timestamp_email ?? b.timestamp_created ?? 0)).getTime();
      return bt - at;
    });
    const latest = forThisLead[0];
    const fromLead = latest.ue_type === 2 && String(latest.from_address_email ?? "").toLowerCase() === leadEmail.toLowerCase();
    const html = String((latest.body as { html?: string } | undefined)?.html ?? "");

    return {
      threadId: String(latest.thread_id ?? ""),
      eaccount: String(latest.eaccount ?? ""),
      subject: String(latest.subject ?? ""),
      lastMessageId: String(latest.id),
      lastMessageAt: String(latest.timestamp_email ?? latest.timestamp_created ?? ""),
      lastMessageFromLead: fromLead,
      leadMessagePreview: fromLead ? extractNewMessageText(html) : "",
    };
  } catch {
    return null;
  }
}

// Rule 2 (Human Ownership Override) is the single most important gate in
// the whole agent: if Ali has sent anything into this thread, the agent
// must never act on it again, full stop. This is checked in code rather
// than trusted to the model's judgment. The API's thread_id filter isn't
// fully reliable on its own (observed returning an occasional item from a
// different thread), so the match is re-verified client-side.
export async function hasHumanReplied(threadId: string): Promise<boolean> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey || !threadId) return false;

  try {
    const res = await fetch(`https://api.instantly.ai/api/v2/emails?limit=25&thread_id=${encodeURIComponent(threadId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return false;
    const json = await res.json();
    const items = (json.items ?? []) as Record<string, unknown>[];
    return items.some((item) => item.thread_id === threadId && String(item.from_address_email ?? "").toLowerCase() === ALI_EMAIL);
  } catch {
    // Fail closed: if we can't confirm Ali hasn't entered the thread, treat
    // it as human-owned rather than risk the agent talking over him.
    return true;
  }
}

// Replies land back inside the same Instantly thread the lead is already
// reading, sent from that thread's own connected mailbox (Sundeep's
// account, in practice) — never a separate outside email address.
export async function replyToEmail({
  eaccount,
  replyToUuid,
  subject,
  html,
  cc,
}: {
  eaccount: string;
  replyToUuid: string;
  subject: string;
  html: string;
  cc?: string[];
}): Promise<boolean> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.instantly.ai/api/v2/emails/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        eaccount,
        reply_to_uuid: replyToUuid,
        subject,
        body: { html },
        ...(cc && cc.length > 0 ? { cc_address_email_list: cc.join(",") } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
