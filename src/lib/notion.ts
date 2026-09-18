// Read-only client for the "Closers/Setters Applications" Notion database —
// the real intake source for talent applications (not this app's own
// "+ Add applicant" form, which is just for manual entries). Every row
// there is a real applicant; there's no "imported" flag in Notion itself,
// so the sync cron dedupes against reps by email instead.

export type NotionApplication = {
  name: string;
  email: string | null;
  role: "closer" | "setter" | null;
  location: string | null;
  phone: string | null;
  linkedin: string | null;
  resume: string | null;
  loomIntro: string | null;
  salesRecording: string | null;
  offer: string | null;
};

type NotionRichText = { plain_text: string }[];
type NotionProperty =
  | { type: "title"; title: NotionRichText }
  | { type: "rich_text"; rich_text: NotionRichText }
  | { type: "email"; email: string | null }
  | { type: "phone_number"; phone_number: string | null }
  | { type: "url"; url: string | null }
  | { type: "select"; select: { name: string } | null };

function text(prop: NotionProperty | undefined): string | null {
  if (!prop) return null;
  if (prop.type === "title" || prop.type === "rich_text") {
    const arr = prop.type === "title" ? prop.title : prop.rich_text;
    return arr.map((t) => t.plain_text).join("").trim() || null;
  }
  if (prop.type === "email") return prop.email;
  if (prop.type === "phone_number") return prop.phone_number;
  if (prop.type === "url") return prop.url;
  if (prop.type === "select") return prop.select?.name ?? null;
  return null;
}

export async function fetchNotionApplications(): Promise<{ applications: NotionApplication[]; error?: string }> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_APPLICATIONS_DB_ID;
  if (!apiKey || !databaseId) return { applications: [], error: "NOTION_API_KEY or NOTION_APPLICATIONS_DB_ID missing" };

  const applications: NotionApplication[] = [];
  let cursor: string | undefined;

  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) return { applications, error: `Notion API ${res.status}: ${await res.text()}` };
    const data = await res.json();

    for (const page of data.results ?? []) {
      const props = page.properties as Record<string, NotionProperty>;
      const roleRaw = text(props.Role);
      applications.push({
        name: text(props.Name) ?? "Unknown",
        email: text(props.Email),
        role: roleRaw === "Closer" ? "closer" : roleRaw === "Setter" ? "setter" : null,
        location: text(props.Location),
        phone: text(props.Phone),
        linkedin: text(props.LinkedIn),
        resume: text(props.Resume),
        loomIntro: text(props["Loom Intro"]),
        salesRecording: text(props["Sales Recording"]),
        offer: text(props.Offer),
      });
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return { applications };
}
