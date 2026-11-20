import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompareView } from "@/components/compare-view";

export const dynamic = "force-dynamic";

/** Compare + what-if (§7.4) — Mode A. */
export default async function ComparePage() {
  const user = (await getSessionUser())!;
  if ((user.mode as string) !== "bac") redirect("/dashboard");
  return <CompareView />;
}
