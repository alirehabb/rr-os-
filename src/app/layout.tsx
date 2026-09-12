import type { Metadata } from "next";
import { Geist, Geist_Mono, Caveat } from "next/font/google";
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
  let queueCount = 0;
  let userName = "";
  let userEmail = "";
  let demoActive = false;
  let notifications: { id: string; title: string; href: string }[] = [];

  if (user) {
    const { data: demo } = await supabase.from("demo_mode").select("enabled").limit(1).single();
    demoActive = !!demo?.enabled;

    const [{ data: roles }, { count }, { data: profile }, { data: overdue }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase
        .from("action_items")
        .select("*", { count: "exact", head: true })
        .eq("is_demo", demoActive)
        .in("status", ["open", "in_progress"]),
      supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
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
    isFounder = (roles ?? []).some((r) => r.role === "founder");
    queueCount = count ?? 0;
    userName = profile?.full_name ?? user.email?.split("@")[0] ?? "You";
    userEmail = profile?.email ?? user.email ?? "";
    notifications = (overdue ?? []).map((o) => ({ id: o.id, title: o.title, href: "/command-center" }));
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppShellClient
          isFounder={isFounder}
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
