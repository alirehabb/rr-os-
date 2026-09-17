import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateProspectStage, convertProspectToClient } from "../actions";
import { clearHumanReview } from "../../follow-ups/actions";
import { PageHeader, Card, Field, Input, Select, Textarea, Button, Badge } from "@/components/ui";
import AIFollowUpDraft from "./AIFollowUpDraft";
import { displayCompanyName } from "@/lib/format";

const STAGES = [
  "lead",
  "interested",
  "call_booked",
  "call_completed",
  "follow_up",
  "pending",
  "proposal_sent",
  "agreement_sent",
  "won",
  "signed",
  "no_show",
  "not_fit",
  "lost",
];

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).single();
  if (!prospect) notFound();

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-xl px-6 py-10">
        <PageHeader
          title={prospect.contact_name || displayCompanyName(prospect.company_name)}
          subtitle={`${displayCompanyName(prospect.company_name)} · ${prospect.contact_email ?? ""}`}
        />

        {prospect.converted_client_id ? (
          <div className="mb-6 rounded-2xl bg-success-bg px-4 py-3 text-sm text-success">
            Converted:{" "}
            <Link href={`/clients/${prospect.converted_client_id}`} className="underline">
              view Client 360
            </Link>
          </div>
        ) : (
          <form action={convertProspectToClient} className="mb-6">
            <Card className="flex items-center gap-2 border-success/30 bg-success-bg/40">
              <input type="hidden" name="prospect_id" value={prospect.id} />
              <input type="hidden" name="company_name" value={prospect.company_name} />
              <Select name="workflow_type">
                <option value="closing_only">Closing only</option>
                <option value="setting_enabled">Setting enabled</option>
                <option value="azgari">Azgari (broker/candidate)</option>
              </Select>
              <button className="rounded-xl bg-success px-3 py-2 text-sm font-medium text-background transition-transform active:scale-[0.97]">
                Mark signed, create Client 360
              </button>
            </Card>
          </form>
        )}

        {prospect.needs_human_review && (
          <Card className="mb-6 flex items-center justify-between gap-3 border-warning/30 bg-warning-bg/40">
            <div>
              <Badge tone="warning">Needs a human reply</Badge>
              <p className="mt-1.5 text-sm text-foreground">{prospect.human_review_reason ?? "The agent flagged this for you."}</p>
              <p className="mt-0.5 text-xs text-muted">The agent will not reply or follow up on this prospect until you clear this.</p>
            </div>
            <form action={clearHumanReview.bind(null, prospect.id)}>
              <Button variant="secondary" className="shrink-0 text-xs">
                Mark Handled
              </Button>
            </form>
          </Card>
        )}

        <AIFollowUpDraft prospectId={prospect.id} />

        <form action={updateProspectStage}>
          <Card className="space-y-4">
            <input type="hidden" name="id" value={prospect.id} />
            <Field label="Stage">
              <Select key={prospect.stage} name="stage" defaultValue={prospect.stage} className="w-full">
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qualification notes">
              <Textarea name="qualification_notes" defaultValue={prospect.qualification_notes ?? ""} rows={2} />
            </Field>
            <Field label="Proposed plan">
              <Textarea name="proposed_plan" defaultValue={prospect.proposed_plan ?? ""} rows={2} />
            </Field>
            <Field label="Next action">
              <Input name="next_action" defaultValue={prospect.next_action ?? ""} />
            </Field>
            <Field label="Next action date">
              <Input type="datetime-local" name="next_action_date" defaultValue={prospect.next_action_date?.slice(0, 16) ?? ""} />
            </Field>
            <Button className="w-full">Save</Button>
          </Card>
        </form>
      </div>
    </div>
  );
}
