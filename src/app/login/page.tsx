"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "suspended">("idle");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setStatus("error");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).single();
    if (profile?.status === "suspended") {
      await supabase.auth.signOut();
      setStatus("suspended");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rr-fade-up">
        <div className="mb-8 text-center">
          <p className="rr-serif text-2xl font-semibold tracking-tight text-foreground">Rehab Revenue</p>
          <p className="mt-1.5 text-sm text-muted">Shaping the future of sales placement.</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm shadow-black/[0.03]">
          <h1 className="rr-serif text-lg font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Enter your email and password to continue.</p>

          <form onSubmit={signIn} className="mt-6 space-y-3">
            <Input
              type="email"
              required
              autoFocus
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={status === "sending"} className="w-full">
              {status === "sending" ? "Signing in…" : "Sign in"}
            </Button>
            {status === "error" && <p className="text-sm text-danger">Incorrect email or password.</p>}
            {status === "suspended" && <p className="text-sm text-danger">This account has been suspended. Contact your admin.</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
