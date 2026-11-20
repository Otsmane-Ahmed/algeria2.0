import { getSessionUser } from "@/lib/auth";
import { getProfile, profileData } from "@/lib/app-data";
import { getMessages, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { ProfileForm } from "@/components/profile-form";

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

export default async function ProfilePage() {
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const profile = await getProfile(user.id);
  const data = profile ? profileData(profile) : null;

  const initial = {
    fullNameLatin: data?.fullNameLatin ?? null,
    fullNameArabic: data?.fullNameArabic ?? null,
    birthDate: data?.birthDate ?? null,
    nationality: data?.nationality ?? "DZ",
    wilaya: data?.wilaya ?? null,
    currentLevel: data?.currentLevel ?? null,
    currentYear: data?.currentYear ?? null,
    institution: data?.institution ?? null,
    faculty: data?.faculty ?? null,
    fieldOfStudy: data?.fieldOfStudy ?? null,
    expectedGraduation: data?.expectedGraduation ?? null,
    gpa20: data?.gpa20 ?? null,
    gpaRankPercent: data?.gpaRankPercent ?? null,
    honors: data?.honors ?? null,
    languages: (data?.languages ?? []) as { lang: string; level: string | null }[],
    experiences: (data?.experiences ?? []) as {
      type: string;
      title: string | null;
      org: string | null;
      start: string | null;
      end: string | null;
    }[],
    skills: data?.skills ?? [],
    targetLevel: data?.targetLevel ?? null,
    targetFields: data?.targetFields ?? [],
    targetCountries: data?.targetCountries ?? [],
    needsFullFunding: data?.needsFullFunding ?? null,
    targetIntake: data?.targetIntake ?? null,
    budgetMonthlyDzd: data?.budgetMonthlyDzd ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">{t("profile.title")}</h1>
        {!profile?.confirmedAt && <p className="mt-1 text-sm text-[var(--text-muted)]">{t("profile.notConfirmed")}</p>}
      </header>
      <ProfileForm
        initial={initial}
        completeness={data?.completeness ?? 0}
        confirmed={Boolean(profile?.confirmedAt)}
      />
    </div>
  );
}
