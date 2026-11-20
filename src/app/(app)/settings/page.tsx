import { getSessionUser } from "@/lib/auth";
import { getMessages, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { SettingsPanel } from "@/components/settings-panel";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

async function currentLocale(): Promise<Locale> {
  const h = await headers();
  const fromHeader = h.get(LOCALE_HEADER);
  if (fromHeader === "fr" || fromHeader === "en" || fromHeader === "ar") return fromHeader;
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  if (c === "fr" || c === "en" || c === "ar") return c;
  return "fr";
}

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      </header>

      <SettingsPanel email={user.email} />

      <Card className="p-5">
        <h2 className="mb-2 text-base font-semibold">{t("settings.about")}</h2>
        <p className="text-sm text-[var(--text-muted)]">SAFAR · v0.1.0</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="neutral">{locale}</Badge>
          <Badge tone="neutral">{user.plan}</Badge>
        </div>
      </Card>
    </div>
  );
}
