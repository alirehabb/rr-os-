import { getInvitationByToken } from "@/app/settings/users/actions";
import AcceptInviteForm from "./AcceptInviteForm";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  const invalid = !invitation || invitation.status !== "pending" || new Date(invitation.expires_at) < new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rr-fade-up">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Rehab Revenue OS</span>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm shadow-black/[0.03]">
          {invalid ? (
            <>
              <h1 className="text-lg font-semibold text-foreground">Invitation not valid</h1>
              <p className="mt-1 text-sm text-muted">
                This invite link has expired, been revoked, or already been used. Ask your admin to resend it.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-foreground">Welcome, {invitation!.full_name.split(" ")[0]}</h1>
              <p className="mt-1 text-sm text-muted">Set a password to activate your account.</p>
              <AcceptInviteForm token={token} email={invitation!.email} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
