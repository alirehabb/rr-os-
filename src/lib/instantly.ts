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
  // The Instantly-connected mailbox this thread is running through (e.g.
  // Sundeep's account) — a reply must go out from this same account, not
  // from some other Rehab Revenue address, or it lands in a thread the
  // lead never wrote to.
  eaccount: string;
};

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
      .filter((item) => item.ue_type === 2 && typeof item.lead === "string")
      .map((item) => {
        const fromJson = (item.from_address_json as { name?: string; address?: string }[] | undefined)?.[0];
        return {
          id: String(item.id),
          leadEmail: String(item.lead),
          fromName: fromJson?.name || String(item.lead).split("@")[0],
          subject: String(item.subject ?? ""),
          preview: String(item.content_preview ?? "").slice(0, 500),
          html: String((item.body as { html?: string } | undefined)?.html ?? ""),
          receivedAt: String(item.timestamp_email ?? item.timestamp_created ?? new Date().toISOString()),
          campaignId: (item.campaign_id as string) ?? null,
          eaccount: String(item.eaccount ?? ""),
        };
      });
  } catch {
    return [];
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
}: {
  eaccount: string;
  replyToUuid: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.instantly.ai/api/v2/emails/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ eaccount, reply_to_uuid: replyToUuid, subject, body: { html } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
