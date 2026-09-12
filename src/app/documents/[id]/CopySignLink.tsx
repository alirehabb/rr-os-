"use client";

import { useState } from "react";
import { Input, Button } from "@/components/ui";

export default function CopySignLink({ documentId }: { documentId: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/documents/${documentId}/sign` : `/documents/${documentId}/sign`;

  return (
    <div className="flex gap-2">
      <Input readOnly value={url} className="flex-1 text-xs" />
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
