import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { bacProfileData, getBacProfile } from "@/lib/app-data";
import { MyBacForm } from "@/components/my-bac-form";

export const dynamic = "force-dynamic";

/** "My Bac" — Mode A profile summary (§7.1.5). */
export default async function MyBacPage() {
  const user = (await getSessionUser())!;
  if ((user.mode as string) !== "bac") redirect("/dashboard");
  const row = await getBacProfile(user.id);
  return <MyBacForm initial={row ? bacProfileData(row) : null} initialConfirmed={Boolean(row?.confirmedAt)} />;
}
