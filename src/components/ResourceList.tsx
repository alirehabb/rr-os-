"use client";

import { useEffect } from "react";
import { FileText, Video, Link2, File, Image as ImageIcon } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { markAssignmentViewed, acknowledgeAssignment } from "@/app/library/actions";
import DownloadButton from "@/app/library/DownloadButton";

const TYPE_ICON = { doc: FileText, template: FileText, video: Video, link: Link2, file: File, image: ImageIcon } as const;

type Assignment = {
  id: string;
  viewed_at: string | null;
  acknowledged_at: string | null;
  knowledge_items: {
    id: string;
    title: string;
    type: keyof typeof TYPE_ICON;
    body: string | null;
    external_url: string | null;
    storage_path: string | null;
  } | null;
};

// Shared by /my (rep) and /portal (client) — the assignee's own view of
// whatever was assigned to them. Marks itself viewed on mount; acknowledging
// is an explicit action, never assumed just because it rendered.
export default function ResourceList({ assignments }: { assignments: Assignment[] }) {
  useEffect(() => {
    for (const a of assignments) {
      if (!a.viewed_at) markAssignmentViewed(a.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (assignments.length === 0) return <EmptyState title="Nothing assigned to you yet." />;

  return (
    <ul className="space-y-2">
      {assignments.map((a) => {
        const item = a.knowledge_items;
        if (!item) return null;
        const Icon = TYPE_ICON[item.type] ?? FileText;
        return (
          <li key={a.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Icon size={16} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    {item.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{item.body}</p>}
                    {item.external_url && (
                      <a href={item.external_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-accent hover:underline">
                        {item.external_url}
                      </a>
                    )}
                    {item.storage_path && <DownloadButton storagePath={item.storage_path} label="Open file" />}
                  </div>
                </div>
                {a.acknowledged_at ? (
                  <Badge tone="success">Acknowledged</Badge>
                ) : (
                  <form action={acknowledgeAssignment}>
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <button className="shrink-0 rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground hover:bg-border">
                      Acknowledge
                    </button>
                  </form>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
