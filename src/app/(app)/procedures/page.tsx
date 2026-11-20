import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { procedures } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { text } from "@/lib/app-data";
import { getMessages, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { Card } from "@/components/ui";
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

export default async function ProceduresPage() {
  await getSessionUser();
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const rows = await db.select().from(procedures).orderBy(asc(procedures.code));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("procedures.title")}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t("procedures.subtitle")}</p>
      </header>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--text-muted)]">{t("procedures.empty")}</Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((p) => {
            const days = p.typicalTotalDays;
            return (
              <Card key={p.id} as="li">
                <Link
                  href={`/procedures/${p.code}`}
                  className="flex items-start gap-3 p-4 hover:bg-[var(--surface-raised)]"
                >
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-faint)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{text(p.title, locale)}</span>
                      {p.needsVerification && <UnverifiedBadge compact />}
                    </div>
                    {p.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{text(p.summary, locale)}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-faint)]">
                      <span>{t("procedures.steps")}: {(p.steps as unknown[]).length}</span>
                      {days && (
                        <span>
                          {t("procedures.duration")}: {days.min ?? "?"}–{days.max ?? "?"} d
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-faint)] rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
