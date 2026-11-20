import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, scholarships } from "@/lib/db/schema";
import { scholarshipData, text } from "@/lib/app-data";
import { getMessages, formatDate, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { Badge, Card, LinkButton } from "@/components/ui";
import { UnverifiedBadge } from "@/components/domain";
import { TrackButton } from "@/components/track-button";

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

export default async function ScholarshipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const rows = await db.select().from(scholarships).where(eq(scholarships.slug, slug)).limit(1);
  const row = rows[0];
  if (!row || row.status !== "published") notFound();

  const data = scholarshipData(row);
  const trackedRows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.userId, user.id), eq(applications.scholarshipId, row.id)))
    .limit(1);
  const alreadyTracked = trackedRows.length > 0;
  const provider = (row.provider as { name?: string; country?: string } | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/matches"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {t("matches.title")}
          </Link>
          <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">{text(data.name, locale)}</h1>
          {provider?.name && <p className="mt-1 text-sm text-[var(--text-muted)]">{provider.name}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {data.needs_verification && <UnverifiedBadge />}
            <Badge tone="neutral">{data.cycle.cycle_id}</Badge>
            <Badge tone="neutral">{t("scholarship.channel")}: {data.application_channel}</Badge>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <TrackButton slug={slug} tracked={alreadyTracked} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">{t("scholarship.rules")}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
            {text(data.rules_human, locale)}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-[var(--text-faint)]">{t("scholarship.deadline")}</p>
              <p className="font-medium">
                {data.cycle.deadline ? formatDate(locale, data.cycle.deadline) : t("common.unknown")}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">{t("scholarship.opens")}</p>
              <p className="font-medium">
                {data.cycle.opens ? formatDate(locale, data.cycle.opens) : t("common.unknown")}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">{t("scholarship.funding")}</p>
              <p className="font-medium">{fundingLabel(data.funding, t)}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">{t("scholarship.competitiveness")}</p>
              <p className="font-medium">{row.competitiveness ?? t("common.unknown")}</p>
            </div>
          </div>
          {data.official_page_url && (
            <p className="mt-4">
              <a
                href={data.official_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-strong)] hover:underline"
              >
                {t("scholarship.officialPage")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">{t("scholarship.documents")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {data.required_documents.map((d) => (
              <li key={d.code} className="flex items-start justify-between gap-3">
                <span>{text(d.label, locale)}</span>
                <Badge tone={d.mandatory ? "warning" : "neutral"}>
                  {d.mandatory ? t("app.mandatory") : t("app.optionalDoc")}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">{t("scholarship.languageReqs")}</h2>
          {data.language_requirements.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("common.none")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.language_requirements.map((l, i) => (
                <li key={i}>
                  <span className="font-medium">{l.lang}</span>
                  <span className="text-[var(--text-muted)]">
                    {l.cefr_min ? ` · CEFR ≥ ${l.cefr_min}` : ""}
                    {l.tests?.length
                      ? ` · ${l.tests.map((x) => `${x.name}${x.min != null ? ` ≥ ${x.min}` : ""}`).join(", ")}`
                      : ""}
                    {l.alt ? ` · ${l.alt}` : ""}
                    {!l.cefr_min && !l.tests?.length && !l.alt ? ` · ${t("common.unknown")}` : ""}
                  </span>
                  {l.notes && <span className="block text-xs text-[var(--text-faint)]">{l.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">{t("scholarship.essay")}</h2>
          {!data.essay_requirements || Object.keys(data.essay_requirements).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("common.none")}</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {data.essay_requirements.motivation_letter && (
                <div className="border-s-2 border-[var(--border)] ps-3">
                  <p className="font-medium">{t("writing.kind.motivation_letter")}</p>
                  <ul className="mt-1 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                    {(data.essay_requirements.motivation_letter.prompts ?? []).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                  {data.essay_requirements.motivation_letter.max_words != null && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      ≤ {data.essay_requirements.motivation_letter.max_words} words
                    </p>
                  )}
                </div>
              )}
              {data.essay_requirements.cv && (
                <div className="border-s-2 border-[var(--border)] ps-3">
                  <p className="font-medium">{t("writing.kind.cv")}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {data.essay_requirements.cv.format ?? ""}
                    {data.essay_requirements.cv.max_pages != null
                      ? ` · ≤ ${data.essay_requirements.cv.max_pages}p`
                      : ""}
                  </p>
                </div>
              )}
              {data.essay_requirements.research_proposal && (
                <div className="border-s-2 border-[var(--border)] ps-3">
                  <p className="font-medium">research_proposal</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {data.tips && (
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">{t("scholarship.tips")}</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-[var(--text-muted)]">
            {data.tips.map((tip, i) => (
              <li key={i}>{text(tip, locale)}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-end">
        <LinkButton href="/matches" variant="secondary" size="sm">
          {t("common.back")}
        </LinkButton>
      </div>
    </div>
  );
}

function fundingLabel(f: { tuition?: string | null; stipend_monthly?: { amount: number; currency: string } | null } | null | undefined, t: (k: string) => string): string {
  if (!f) return t("common.unknown");
  const parts: string[] = [];
  if (f.tuition) parts.push(`tuition: ${f.tuition}`);
  if (f.stipend_monthly) parts.push(`${f.stipend_monthly.amount} ${f.stipend_monthly.currency}/mo`);
  return parts.length ? parts.join(" · ") : t("common.unknown");
}
