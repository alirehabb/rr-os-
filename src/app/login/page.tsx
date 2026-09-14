"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

// Single-tenant app, one founder account — password-only sign-in against a
// fixed email so the user never has to see or type it.
const LOGIN_EMAIL = "ali@rehab-revenue.com";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: LOGIN_EMAIL, password });
    if (error) {
      setStatus("error");
      return;
    }
    router.replace("/");
    router.refresh();
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
          <p className="mt-1 text-sm text-muted">Enter your password to continue.</p>

          <form onSubmit={signIn} className="mt-6 space-y-3">
            <Input
              type="password"
              required
              autoFocus
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={status === "sending"} className="w-full">
              {status === "sending" ? "Signing in…" : "Sign in"}
            </Button>
            {status === "error" && <p className="text-sm text-danger">Incorrect password.</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
