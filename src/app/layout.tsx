import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

  if (user) {
    const [{ data: roles }, { count }, { data: profile }, { data: demo }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("action_items").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
      supabase.from("demo_mode").select("enabled").limit(1).single(),
    ]);
    isFounder = (roles ?? []).some((r) => r.role === "founder");
    queueCount = count ?? 0;
    userName = profile?.full_name ?? user.email?.split("@")[0] ?? "You";
    userEmail = profile?.email ?? user.email ?? "";
    demoActive = !!demo?.enabled;
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppShellClient isFounder={isFounder} queueCount={queueCount} userName={userName} userEmail={userEmail} demoActive={demoActive}>
          {children}
        </AppShellClient>
      </body>
    </html>
  );
}
