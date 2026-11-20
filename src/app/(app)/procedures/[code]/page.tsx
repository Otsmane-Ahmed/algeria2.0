import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Banknote, Clock, ExternalLink, MapPin, TriangleAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { procedures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { text } from "@/lib/app-data";
import { getMessages, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { Badge, Card } from "@/components/ui";
import { UnverifiedBadge } from "@/components/domain";

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

type Step = {
  order?: number;
  title?: Record<string, string>;
  body?: Record<string, string>;
  where?: Record<string, string> | null;
  cost_dzd?: number | null;
  typical_days?: number | null;
  documents_needed?: string[];
  warnings?: Record<string, string>[];
};

export default async function ProcedurePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await getSessionUser();
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const rows = await db.select().from(procedures).where(eq(procedures.code, code)).limit(1);
  const p = rows[0];
  if (!p) notFound();

  const steps = ((p.steps as unknown[]) as Step[]).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/procedures"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("procedures.title")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{text(p.title, locale)}</h1>
          {p.needsVerification && <UnverifiedBadge />}
        </div>
        {p.summary && <p className="mt-1 text-sm text-[var(--text-muted)]">{text(p.summary, locale)}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {p.typicalTotalDays && (
            <Badge tone="neutral">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {t("procedures.duration")}: {p.typicalTotalDays.min ?? "?"}–{p.typicalTotalDays.max ?? "?"} d
            </Badge>
          )}
          <Badge tone="neutral">
            {t("procedures.steps")}: {steps.length}
          </Badge>
        </div>
      </header>

      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <Card key={i} as="li" className="p-5">
            <div className="flex items-start gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-semibold text-[var(--brand-strong)]"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{text(s.title, locale)}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
                  {text(s.body, locale)}
                </p>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
                  {s.where && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {text(s.where, locale)}
                    </span>
                  )}
                  {s.cost_dzd != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("procedures.cost")}: {s.cost_dzd} DZD
                    </span>
                  )}
                  {s.typical_days != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {s.typical_days} d
                    </span>
                  )}
                </div>

                {s.documents_needed && s.documents_needed.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-[var(--text-faint)]">{t("scholarship.documents")}: </span>
                    {s.documents_needed.join(", ")}
                  </p>
                )}

                {(s.warnings ?? []).map((w, j) => (
                  <p
                    key={j}
                    className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 text-sm"
                  >
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden="true" />
                    <span>{text(w, locale)}</span>
                  </p>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </ol>

      {p.officialLinks.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">{t("procedures.officialLinks")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {p.officialLinks.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[var(--brand-strong)] hover:underline"
                >
                  {url}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
