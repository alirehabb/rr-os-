import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email!,
        full_name: data.user.email!.split("@")[0],
      });

      // Bootstrap: exactly one founder (Ali) per spec §4. The DB policy only
      // allows this insert to succeed while no founder exists yet, so it's
      // safe to just attempt it and ignore failure for every later sign-in.
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: "founder" });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
