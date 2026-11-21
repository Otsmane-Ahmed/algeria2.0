import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { bacProfileData, getBacProfile, listFormations, listWishes } from "@/lib/app-data";
import { evaluateFormation } from "@/lib/core/orientation/match";
import { getMessages, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies } from "next/headers";
import { localize } from "@/lib/core/types";
import { WishesPanel, type WishRow } from "@/components/wishes-panel";

export const dynamic = "force-dynamic";

/** Fiche de vœux (§7.2) — Mode A. */
export default async function WishesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = (await getSessionUser())!;
  if ((user.mode as string) !== "bac") redirect("/dashboard");
  const sp = await searchParams;
  const suggested = sp.suggested === "1";

  const h = await headers();
  const fromHeader = h.get(LOCALE_HEADER);
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = (fromHeader ?? c ?? "fr") as Locale;
  const t = (key: string) => (getMessages(locale) as Record<string, string>)[key] ?? key;

  const [profileRow, wishRows, formations] = await Promise.all([
    getBacProfile(user.id),
    listWishes(user.id),
    listFormations(),
  ]);
  const profile = profileRow ? bacProfileData(profileRow) : null;

  const byId = new Map(formations.map((f) => [f.id, f]));
  const rows: WishRow[] = wishRows
    .map((w) => {
      const f = byId.get(w.formationId);
      if (!f) return null;
      const match = evaluateFormation(
        {
          id: f.id,
          nameFr: f.nameFr,
          nameEn: f.nameEn,
          nameAr: f.nameAr,
          institution: f.institution,
          institutionKind: f.institutionKind,
          city: f.city,
          wilayaCode: f.wilayaCode,
          wilayaName: f.wilayaName,
          streams: f.streams,
          language: f.language,
          domainTags: f.domainTags,
          durationYears: f.durationYears,
          tuition: f.tuition,
          cutoffLastYear: f.cutoffLastYear,
          needsVerification: f.needsVerification,
        },
        profile,
      );
      const name = localize({ en: f.nameEn, fr: f.nameFr, ar: f.nameAr }, locale) || f.nameFr;
      return {
        formationId: f.id,
        name,
        institution: f.institution,
        city: f.city,
        match,
      } satisfies WishRow;
    })
    .filter((x): x is WishRow => x !== null);

  const catalog = formations.map((f) => ({
    id: f.id,
    name: localize({ en: f.nameEn, fr: f.nameFr, ar: f.nameAr }, locale) || f.nameFr,
    institution: f.institution,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">{t("wishes.title")}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("wishes.subtitle")}</p>
      </header>
      <WishesPanel initial={rows} catalog={catalog} suggested={suggested} />
    </div>
  );
}
