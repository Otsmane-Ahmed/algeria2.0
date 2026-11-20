import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { bacProfileData, getBacProfile } from "@/lib/app-data";
import { getMessages } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { BacChat } from "@/components/bac-chat";

export const dynamic = "force-dynamic";

/**
 * Mode A intake chatbot (§7.1). Mode B users are bounced back — the intake
 * conversation belongs to bac orientation.
 */
export default async function ChatPage() {
  const user = (await getSessionUser())!;
  if ((user.mode as string) !== "bac") redirect("/dashboard");

  const h = await headers();
  const fromHeader = h.get(LOCALE_HEADER);
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  const locale = (fromHeader ?? c ?? "fr") as "fr" | "ar" | "en";

  const row = await getBacProfile(user.id);
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">
          {locale === "ar" ? "دردشة التوجيه بعد الباك" : locale === "en" ? "Post-bac orientation chat" : "Chat d'orientation post-bac"}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {locale === "ar" ? "لا نماذج ولا رفع ملفات — محادثة واحدة تملأ بطاقتك." : locale === "en" ? "No forms, no uploads — one conversation fills your card." : "Pas de formulaire, pas de fichier — une conversation remplit votre fiche."}
        </p>
      </header>
      <BacChat
        initialProfile={row ? bacProfileData(row) : null}
        initialConfirmed={Boolean(row?.confirmedAt)}
      />
    </div>
  );
}
