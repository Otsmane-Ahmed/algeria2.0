import { getSessionUser } from "@/lib/auth";
import { getLatestRun, getProfile, text } from "@/lib/app-data";
import { getMessages, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { MatchesPanel, type MatchItem } from "@/components/matches-panel";

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

export default async function MatchesPage() {
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const [run, profile] = await Promise.all([getLatestRun(user.id), getProfile(user.id)]);

  const initial: MatchItem[] = (run?.items ?? []).map((r) => ({
    match_id: r.match.id,
    slug: r.scholarship.slug,
    name: text(r.scholarship.name, locale),
    provider: (r.scholarship.provider as { name?: string } | null)?.name ?? null,
    verdict: r.match.verdict,
    score: r.match.score,
    factors: r.match.factors as MatchItem["factors"],
    blockers: r.match.blockers as unknown[],
    missing_info: r.match.missingInfo ?? [],
    days_to_deadline: r.match.daysToDeadline,
    needs_verification: r.scholarship.needsVerification,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">{t("matches.title")}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("matches.factors")}</p>
      </header>
      <MatchesPanel initial={initial} profileConfirmed={Boolean(profile?.confirmedAt)} />
    </div>
  );
}
