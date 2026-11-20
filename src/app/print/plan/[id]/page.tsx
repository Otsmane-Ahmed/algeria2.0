import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getApplication, getAppTasks, getAppChecklist, scholarshipData, text } from "@/lib/app-data";
import { getMessages, formatDate, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Printable plan (spec F8). This is the `ar` target of the PDF export: the
 * hand-rolled PDF writer cannot shape Arabic, so the browser's own print
 * engine renders this page instead. Also useful as a paper hand-off in any
 * locale, hence /print/plan/:id rather than a locale-pinned route.
 */
async function currentLocale(): Promise<Locale> {
  const h = await headers();
  const fromHeader = h.get(LOCALE_HEADER);
  if (fromHeader === "fr" || fromHeader === "en" || fromHeader === "ar") return fromHeader;
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  if (c === "fr" || c === "en" || c === "ar") return c;
  return "fr";
}

export default async function PrintPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const row = await getApplication(user.id, id);
  if (!row) notFound();

  const app = row.application;
  const data = scholarshipData(row.scholarship);
  const [tasks, checklist] = await Promise.all([getAppTasks(app.id), getAppChecklist(app.id)]);
  const deadline = data.cycle.deadline;

  return (
    <html lang={locale}>
      <body className="bg-white text-black">
        <main className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
          <header className="mb-6 border-b border-black pb-4">
            <p className="text-xs uppercase tracking-wide">SAFAR</p>
            <h1 className="text-2xl font-bold">{text(data.name, locale)}</h1>
            <p className="mt-1 text-sm">
              {t("scholarship.deadline")}: {deadline ? formatDate(locale, deadline) : t("common.unknown")}
              {" · "}
              {t("app.targetSubmission")}:{" "}
              {app.targetSubmissionDate ? formatDate(locale, app.targetSubmissionDate) : t("common.unknown")}
              {" · "}
              {t("app.status")}: {t(`app.status.${app.status}`)}
            </p>
            <p className="text-sm">
              {t("app.feasibilityLabel")}: {t(`app.feasibility.${feasibilityKey(app.feasibility)}`)}
            </p>
          </header>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">{t("app.tasks")}</h2>
            <ol className="flex flex-col gap-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3 border-b border-gray-200 pb-2 text-sm">
                  <span className="w-24 shrink-0 tabular-nums">{formatDate(locale, task.dueDate)}</span>
                  <span className="w-16 shrink-0 text-xs uppercase">
                    {t(`app.task.${task.status}`)}
                  </span>
                  <span className="flex-1">
                    {text(task.title, locale)}
                    {task.isCritical && <strong className="ms-1">({t("app.critical")})</strong>}
                    {task.detail && (task.detail as { estimate?: string }).estimate === "true" && (
                      <span className="block text-xs text-gray-600">{t("app.estimateLabel")}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">{t("scholarship.documents")}</h2>
            <ul className="flex flex-col gap-2">
              {checklist.map((c) => (
                <li key={c.id} className="flex items-start gap-3 border-b border-gray-200 pb-2 text-sm">
                  <span className="w-20 shrink-0 text-xs uppercase">{t(`app.checklistState.${c.status}`)}</span>
                  <span className="flex-1">
                    {text(c.label, locale)}
                    {c.mandatory && <span className="ms-1 text-xs">({t("app.mandatory")})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <footer className="mt-8 border-t border-black pt-3 text-xs text-gray-600">
            {data.needs_verification ? `${t("states.unverified")} · ${t("states.unverifiedHint")}` : ""}
          </footer>
        </main>
      </body>
    </html>
  );
}

/** DB stores "ok"; the message files call it "feasible". */
function feasibilityKey(v: string | null | undefined): string {
  if (v === "ok") return "feasible";
  if (v === "tight" || v === "impossible") return v;
  return "unknown";
}
