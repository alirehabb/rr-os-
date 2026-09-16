"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { runCampaignNow } from "../../actions";

export default function RunCampaignButton({ campaignId, disabled }: { campaignId: string; disabled?: boolean }) {
  const [running, setRunning] = useState(false);
  const toast = useToast();

  async function run() {
    setRunning(true);
    try {
      const result = await runCampaignNow(campaignId);
      const parts = [];
      if (result.sent) parts.push(`${result.sent} sent`);
      if (result.drafted) parts.push(`${result.drafted} drafted`);
      const skipped = result.checked - result.sent - result.drafted;
      if (skipped > 0) parts.push(`${skipped} skipped`);
      toast(parts.length ? `Checked ${result.checked}: ${parts.join(", ")}` : `Checked ${result.checked}, nothing eligible right now`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to run", "danger");
    }
    setRunning(false);
  }

  return (
    <Button onClick={run} disabled={running || disabled} className="text-xs">
      <Play size={13} /> {running ? "Running..." : "Run now"}
    </Button>
  );
}
