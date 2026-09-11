"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rr-fade-up">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Rehab Revenue OS</span>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm shadow-black/[0.03]">
          <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted">We&apos;ll email you a one-time link — no password needed.</p>

          {status === "sent" ? (
            <div className="mt-6 rounded-xl bg-success-bg px-4 py-3 text-sm text-success">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
              <Input
                type="email"
                required
                placeholder="you@rehabrevenues.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={status === "sending"} className="w-full">
                {status === "sending" ? "Sending…" : "Send magic link"}
              </Button>
              {status === "error" && <p className="text-sm text-danger">Something went wrong. Try again.</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
