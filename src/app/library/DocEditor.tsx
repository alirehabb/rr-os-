"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Heading2, List, ListOrdered, Quote } from "lucide-react";
import { updateItemBody } from "./actions";

// A Notion/Google-Docs-style writing surface instead of a plain textarea —
// formats (bold, headings, lists) are real, not typed markdown, and every
// assignee reads the same rendered HTML back in ResourceList.tsx. Autosaves
// on a short debounce so there's no explicit "Save" step to forget.
export default function DocEditor({ itemId, initialBody }: { itemId: string; initialBody: string | null }) {
  const [status, setStatus] = useState<"saved" | "saving" | "idle">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialBody || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] text-foreground",
      },
    },
    onUpdate: ({ editor }) => {
      setStatus("idle");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setStatus("saving");
        await updateItemBody(itemId, editor.getHTML());
        setStatus("saved");
      }, 800);
    },
  });

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  if (!editor) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </ToolbarButton>
        <span className="ml-auto text-xs text-faint">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}</span>
      </div>
      <div className="px-6 py-5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-1.5 transition-colors ${active ? "bg-accent/12 text-accent" : "text-muted hover:bg-surface-subtle hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
