"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { acceptInvitation } from "@/app/settings/users/actions";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData();
    fd.set("token", token);
    fd.set("password", password);
    try {
      await acceptInvitation(fd);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signInWithPassword({ email, password });
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <Input value={email} disabled className="opacity-60" />
      <Input
        type="password"
        required
        minLength={8}
        autoFocus
        placeholder="Set a password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" disabled={status === "sending"} className="w-full">
        {status === "sending" ? "Activating…" : "Activate account"}
      </Button>
      {status === "error" && <p className="text-sm text-danger">{errorMsg}</p>}
    </form>
  );
}
