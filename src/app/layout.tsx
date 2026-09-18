import type { Metadata } from "next";
import { Geist, Geist_Mono, Caveat, Playfair_Display } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import AppShellClient from "@/components/shell/AppShellClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-signature",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Rehab Revenue OS",
  description: "Founder OS, Client 360, Opportunities, Finance and more.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isFounder = false;
  let isStaff = false;
  let isRep = false;
  let isClientOnly = false;
  let queueCount = 0;
  let userName = "";
  let userEmail = "";
  let demoActive = false;
  let notifications: { id: string; title: string; href: string }[] = [];

  if (user) {
    const { data: demo } = await supabase.from("demo_mode").select("enabled").limit(1).single();
    demoActive = !!demo?.enabled;

    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    ]);
    const roleSet = new Set((roles ?? []).map((r) => r.role));
    isFounder = roleSet.has("founder");
    isStaff = isFounder || roleSet.has("internal") || roleSet.has("finance");
    isRep = !isStaff && (roleSet.has("closer") || roleSet.has("setter"));
    isClientOnly = !isStaff && !isRep && roleSet.has("client");
    userName = profile?.full_name ?? user.email?.split("@")[0] ?? "You";
    userEmail = profile?.email ?? user.email ?? "";

    // The badge count and notification bell must never show one person's
    // internal action items to another role — a client seeing the whole
    // company's overdue queue would be a real data leak, not a cosmetic bug.
    if (isStaff) {
      const [{ count }, { data: overdue }] = await Promise.all([
        supabase.from("action_items").select("*", { count: "exact", head: true }).eq("is_demo", demoActive).in("status", ["open", "in_progress"]),
        supabase
          .from("action_items")
          .select("id, title, deadline_at")
          .eq("is_demo", demoActive)
          .in("status", ["open", "in_progress"])
          .not("deadline_at", "is", null)
          .lt("deadline_at", new Date().toISOString())
          .order("deadline_at", { ascending: true })
          .limit(8),
      ]);
      queueCount = count ?? 0;
      notifications = (overdue ?? []).map((o) => ({ id: o.id, title: o.title, href: "/command-center" }));
    } else if (isRep) {
      const { data: rep } = await supabase.from("reps").select("id").eq("profile_id", user.id).maybeSingle();
      if (rep) {
        const { data: overdue } = await supabase
          .from("action_items")
          .select("id, title, deadline_at")
          .eq("rep_id", rep.id)
          .in("status", ["open", "in_progress"])
          .not("deadline_at", "is", null)
          .lt("deadline_at", new Date().toISOString())
          .order("deadline_at", { ascending: true })
          .limit(8);
        queueCount = overdue?.length ?? 0;
        notifications = (overdue ?? []).map((o) => ({ id: o.id, title: o.title, href: "/my" }));
      }
    } else if (isClientOnly) {
      const { data: clientRole } = await supabase.from("user_roles").select("client_id").eq("user_id", user.id).eq("role", "client").not("client_id", "is", null).maybeSingle();
      if (clientRole?.client_id) {
        const { data: overdue } = await supabase
          .from("action_items")
          .select("id, title, deadline_at")
          .eq("client_id", clientRole.client_id)
          .in("status", ["open", "in_progress"])
          .not("deadline_at", "is", null)
          .lt("deadline_at", new Date().toISOString())
          .order("deadline_at", { ascending: true })
          .limit(8);
        queueCount = overdue?.length ?? 0;
        notifications = (overdue ?? []).map((o) => ({ id: o.id, title: o.title, href: "/portal" }));
      }
    }
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppShellClient
          isFounder={isFounder}
          isStaff={isStaff}
          isRep={isRep}
          isClientOnly={isClientOnly}
          queueCount={queueCount}
          userName={userName}
          userEmail={userEmail}
          demoActive={demoActive}
          notifications={notifications}
        >
          {children}
        </AppShellClient>
      </body>
    </html>
  );
}
