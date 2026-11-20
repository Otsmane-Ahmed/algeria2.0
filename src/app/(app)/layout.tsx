import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

/**
 * Auth guard for every app route (spec 8.1: all routes except health/auth
 * require a session). Middleware already bounced cookie-less requests; here the
 * signature and the user row are actually checked, so a forged or stale cookie
 * lands on /login too.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell userName={user.name ?? user.email} mode={(user.mode as "bac" | "abroad") ?? "abroad"}>
      {children}
    </AppShell>
  );
}
