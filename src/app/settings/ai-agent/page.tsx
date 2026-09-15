import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Button, Textarea, Field, Badge } from "@/components/ui";
import { saveAIAgentConfig, setAutoReplyEnabled } from "./actions";

export default async function AIAgentSettingsPage() {
  const supabase = await createClient();
  const { data: config } = await supabase.from("ai_agent_config").select("*").limit(1).single();

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-lg px-6 py-10">
        <PageHeader
          title="AI Reply Agent"
          subtitle="Trains the agent that will eventually reply to interested Instantly leads on its own. Off until you turn it on."
        />

        <Card className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-reply</p>
            <p className="mt-0.5 text-xs text-muted">
              {config?.auto_reply_enabled
                ? "ON: the agent will draft and send replies to new interest replies on its own."
                : "OFF: nothing is ever sent without a human clicking Send in the Inbox."}
            </p>
          </div>
          <form action={setAutoReplyEnabled}>
            <input type="hidden" name="enabled" value={String(!config?.auto_reply_enabled)} />
            <Button variant={config?.auto_reply_enabled ? "danger" : "primary"} className="text-xs">
              {config?.auto_reply_enabled ? "Turn off" : "Turn on"}
            </Button>
          </form>
        </Card>

        {!config?.tone && !config?.guidelines && (
          <div className="mb-4">
            <Badge tone="warning">Not trained yet, fill in the fields below before turning this on</Badge>
          </div>
        )}

        <form action={saveAIAgentConfig}>
          <Card className="space-y-5">
            <Field label="Tone" hint="How the agent should sound, e.g. casual and direct, no corporate language">
              <Textarea name="tone" defaultValue={config?.tone ?? ""} rows={2} />
            </Field>
            <Field label="Guidelines" hint="Rules for what it can/can't say, when to escalate to a human instead of replying">
              <Textarea name="guidelines" defaultValue={config?.guidelines ?? ""} rows={5} />
            </Field>
            <Field label="Knowledge base" hint="What Rehab Revenue is, pricing, offer details, objection handling, anything it should draw from">
              <Textarea name="knowledge_base" defaultValue={config?.knowledge_base ?? ""} rows={8} />
            </Field>
            <Field label="Discovery call booking link" hint="Real Calendly link for Ali's discovery calls. Without this, the agent will never invent one, it will just say a human will follow up to schedule">
              <input
                name="booking_link"
                type="url"
                defaultValue={config?.booking_link ?? ""}
                placeholder="https://calendly.com/..."
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
              />
            </Field>
            <Button type="submit">Save</Button>
          </Card>
        </form>
      </div>
    </div>
  );
}
