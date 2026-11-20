import { getSessionUser } from "@/lib/auth";
import { listDocuments } from "@/lib/app-data";
import { getMessages, formatDate, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { Card, Badge } from "@/components/ui";
import { EmptyState, StatusStepper, UnverifiedBadge } from "@/components/domain";
import { DocUpload, DocRowActions } from "@/components/doc-actions";
import { FileText } from "lucide-react";

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

const STATUS_TONE = {
  uploaded: "neutral",
  processing: "brand",
  extracted: "brand",
  needs_review: "warning",
  confirmed: "success",
  failed: "danger",
} as const;

export default async function DocumentsPage() {
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;
  const docs = await listDocuments(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("docs.title")}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t("docs.aiOffNote")}</p>
        </div>
        <UnverifiedBadge compact />
      </header>

      <DocUpload />

      {docs.length === 0 ? (
        <EmptyState
          title={t("docs.empty")}
          body={t("docs.emptyBody")}
          icon={<FileText className="h-8 w-8" />}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {docs.map((d) => (
            <Card key={d.id} as="li" className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{d.originalFilename ?? d.id}</span>
                  <Badge tone={STATUS_TONE[d.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                    {t(`docs.status.${d.status}`)}
                  </Badge>
                  {d.errorCode && (
                    <Badge tone={d.status === "failed" ? "danger" : "warning"}>
                      {t(`errors.${d.errorCode}`)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {t(`docs.kind.${d.kind}`)} · {formatDate(locale, d.createdAt?.toISOString().slice(0, 10) ?? null)}
                  {d.pageCount ? ` · ${t("docs.pages")}: ${d.pageCount}` : ""}
                </p>
                <div className="mt-2">
                  <StatusStepper status={d.status} />
                </div>
              </div>
              <DocRowActions id={d.id} status={d.status} />
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
