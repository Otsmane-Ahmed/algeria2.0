import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBacProfile } from "@/lib/app-data";
import { PlanPanel } from "@/components/plan-panel";

export const dynamic = "force-dynamic";

/** My Plan (§7.5) — Mode A inscription plan. */
export default async function PlanPage() {
  const user = (await getSessionUser())!;
  if ((user.mode as string) !== "bac") redirect("/dashboard");
  const row = await getBacProfile(user.id);
  return <PlanPanel initial={(row?.checklist as Record<string, string>) ?? {}} />;
}
