"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { completeActionItemById, pinActionItem } from "@/app/actions";
import { Badge, Button } from "@/components/ui";
import { springSnappy } from "@/components/motion";

type QueueItem = {
  id: string;
  title: string;
  reason: string;
  pinned: boolean;
  deadline_at: string | null;
  money_impact: number | null;
  client_id: string | null;
};

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// Command Queue completion is the single most-emphasized interaction in the
// design brief: resolve smoothly, let remaining priorities reposition, give
// restrained success feedback — not a full-page revalidation flash.
export default function CommandQueueClient({ items }: { items: QueueItem[] }) {
  const [optimisticItems, removeItem] = useOptimistic(items, (state, id: string) => state.filter((i) => i.id !== id));
  const [, startTransition] = useTransition();

  function complete(id: string) {
    startTransition(() => {
      removeItem(id);
      completeActionItemById(id);
    });
  }

  return (
    <ul className="divide-y divide-border">
      <AnimatePresence initial={false}>
        {optimisticItems.slice(0, 7).map((item) => {
          const overdue = item.deadline_at && new Date(item.deadline_at) < new Date();
          return (
            <motion.li
              key={item.id}
              layout
              initial={false}
              exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
              transition={springSnappy}
              className={`flex items-center gap-3 overflow-hidden px-4 py-3 ${overdue ? "rr-urgent-pulse" : ""}`}
            >
              <button
                onClick={() => complete(item.id)}
                aria-label="Complete"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border transition-colors hover:border-accent active:scale-90"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.pinned && <span className="mr-1 text-warning">★</span>}
                  {item.title}
                </p>
                <p className="truncate text-xs text-faint">{item.reason}</p>
              </div>
              {item.client_id && (
                <Link href={`/clients/${item.client_id}`} className="shrink-0 rounded-full bg-surface-subtle px-2 py-1 text-xs text-muted hover:text-foreground">
                  Client
                </Link>
              )}
              <div className="shrink-0 text-right text-xs">
                <p className={item.money_impact === null ? "text-faint" : "font-medium text-foreground"}>
                  {item.money_impact === null ? "impact unknown" : money(item.money_impact)}
                </p>
                {overdue ? (
                  <Badge tone="danger">Overdue</Badge>
                ) : (
                  <p className="text-faint">{item.deadline_at ? new Date(item.deadline_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</p>
                )}
              </div>
              <form action={pinActionItem} className="shrink-0">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="pinned" value={String(item.pinned)} />
                <Button variant="secondary" className="!px-2.5 !py-1 text-xs">
                  {item.pinned ? "Unpin" : "Pin"}
                </Button>
              </form>
            </motion.li>
          );
        })}
      </AnimatePresence>
      {optimisticItems.length === 0 && (
        <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-8 text-center text-sm text-faint">
          Nothing open. Clear queue.
        </motion.li>
      )}
    </ul>
  );
}
