"use client";

import { useState } from "react";
import { getSignedFileUrl } from "./actions";

export default function DownloadButton({ storagePath, label }: { storagePath: string; label: string }) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    const url = await getSignedFileUrl(storagePath);
    setLoading(false);
    if (url) window.open(url, "_blank");
  }

  return (
    <button onClick={open} disabled={loading} className="text-xs text-accent hover:underline disabled:opacity-50">
      {loading ? "Opening..." : label}
    </button>
  );
}
