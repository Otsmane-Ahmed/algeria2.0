import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getDocument } from "@/lib/app-data";
import { db } from "@/lib/db";
import { documentPages, extractions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getMessages, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { StatusStepper } from "@/components/domain";
import { ReviewPanel } from "@/components/review-panel";

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

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const doc = await getDocument(user.id, id);
  if (!doc) notFound();

  const [ext, pages, ocr] = await Promise.all([
    db
      .select()
      .from(extractions)
      .where(eq(extractions.documentId, doc.id))
      .orderBy(desc(extractions.createdAt))
      .limit(1),
    db.select({ pageNo: documentPages.pageNo }).from(documentPages).where(eq(documentPages.documentId, doc.id)),
    db.select({ ocrText: documentPages.ocrText }).from(documentPages).where(eq(documentPages.documentId, doc.id)),
  ]);
  const extraction = ext[0];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("nav.documents")}
        </Link>
        <h1 className="text-xl font-semibold">{t("docs.reviewTitle")}</h1>
        <div className="ms-auto">
          <StatusStepper status={doc.status} />
        </div>
      </header>

      <ReviewPanel
        documentId={doc.id}
        pageCount={doc.pageCount ?? Math.max(1, pages.length)}
        values={(extraction?.raw as Record<string, unknown>) ?? {}}
        confidence={extraction?.fieldConfidence ?? {}}
        warnings={extraction?.warnings ?? []}
        ocrText={ocr
          .filter((p) => p.ocrText)
          .map((p, i) => `p.${i + 1}: ${p.ocrText}`)
          .join("\n")}
        confirmed={Boolean(extraction?.confirmedByUserAt)}
      />
    </div>
  );
}
