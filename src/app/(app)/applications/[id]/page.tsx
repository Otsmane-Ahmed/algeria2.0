import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getApplication, getAppTasks, getAppChecklist, scholarshipData, text } from "@/lib/app-data";
import { latestCheck } from "@/lib/check-data";
import { getCapabilities, aiReady } from "@/lib/ai/capabilities";
import { db } from "@/lib/db";
import { drafts, draftVersions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getMessages, formatDate, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { Badge, Card, cx } from "@/components/ui";
import { DeadlineBadge, UnverifiedBadge } from "@/components/domain";
import { AppActions } from "@/components/app-actions";
import { TaskTimeline, type Task } from "@/components/task-timeline";
import { ChecklistPanel, type ChecklistRow } from "@/components/checklist-panel";
import { WritingStudio, type DraftSummary } from "@/components/writing-studio";
import { CheckPanel } from "@/components/check-panel";
import { NotesPanel } from "@/components/notes-panel";

export const dynamic = "force-dynamic";

const TABS = ["overview", "timeline", "documents", "writing", "check", "notes"] as const;
type Tab = (typeof TABS)[number];

async function currentLocale(): Promise<Locale> {
  const h = await headers();
  const fromHeader = h.get(LOCALE_HEADER);
  if (fromHeader === "fr" || fromHeader === "en" || fromHeader === "ar") return fromHeader;
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  if (c === "fr" || c === "en" || c === "ar") return c;
  return "fr";
}

const FEASIBILITY_TONE = { ok: "success", tight: "warning", impossible: "danger" } as const;

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;

  const row = await getApplication(user.id, id);
  if (!row) notFound();

  const app = row.application;
  const data = scholarshipData(row.scholarship);
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";

  const [taskRows, checklistRows, draftRows, check, caps] = await Promise.all([
    getAppTasks(app.id),
    getAppChecklist(app.id),
    db.select().from(drafts).where(eq(drafts.applicationId, app.id)).orderBy(desc(drafts.updatedAt)),
    latestCheck(app.id, user.id, locale),
    getCapabilities(),
  ]);

  const tasks: Task[] = taskRows.map((x) => ({
    id: x.id,
    kind: x.kind,
    title: text(x.title, locale),
    detail: x.detail as Record<string, string> | null,
    due_date: x.dueDate,
    start_date: x.startDate,
    est_days: x.estDays,
    status: x.status,
    is_critical: x.isCritical,
    required_document_code: x.requiredDocumentCode,
    procedure_code: x.procedureCode,
  }));

  const checklist: ChecklistRow[] = checklistRows.map((c) => {
    const spec = data.required_documents.find((d) => d.code === c.docCode);
    return {
      id: c.id,
      doc_code: c.docCode,
      label: text(c.label, locale),
      mandatory: c.mandatory,
      status: c.status,
      document_id: c.documentId,
      notes: c.notes,
      procedure_codes: spec?.procedure_codes ?? [],
    };
  });

  // Draft summaries carry their current version's word count.
  const draftSummaries: DraftSummary[] = [];
  for (const d of draftRows) {
    const v = (
      await db
        .select({ wordCount: draftVersions.wordCount })
        .from(draftVersions)
        .where(eq(draftVersions.draftId, d.id))
        .orderBy(desc(draftVersions.versionNo))
        .limit(1)
    )[0];
    draftSummaries.push({
      id: d.id,
      kind: d.kind,
      language: d.language,
      title: d.title,
      word_count: v?.wordCount ?? 0,
    });
  }

  const wordLimit = data.essay_requirements?.motivation_letter?.max_words ?? null;
  const deadline = data.cycle.deadline;
  const days = deadline ? daysFromToday(deadline) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/applications"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {t("nav.applications")}
          </Link>
          <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">{text(data.name, locale)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{t(`app.status.${app.status}`)}</Badge>
            <Badge tone={FEASIBILITY_TONE[app.feasibility as keyof typeof FEASIBILITY_TONE] ?? "neutral"}>
              {t(`app.feasibility.${feasibilityKey(app.feasibility)}`)}
            </Badge>
            <DeadlineBadge daysToDeadline={days} dateLabel={deadline ?? undefined} />
            {!deadline && <UnverifiedBadge compact />}
            <span className="text-xs text-[var(--text-muted)]">
              {t("app.targetSubmission")}:{" "}
              {app.targetSubmissionDate ? formatDate(locale, app.targetSubmissionDate) : t("common.unknown")}
            </span>
          </div>
        </div>
        <AppActions applicationId={app.id} />
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label={t("app.title")}>
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/applications/${app.id}?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cx(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              tab === k
                ? "border-[var(--brand)] font-medium text-[var(--brand-strong)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {t(`app.tab.${k}`)}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-3 text-base font-semibold">{t("scholarship.rules")}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
              {text(data.rules_human, locale)}
            </p>
            <div className="mt-4 flex flex-wrap gap-5 text-sm">
              <div>
                <p className="text-[var(--text-faint)]">{t("scholarship.deadline")}</p>
                <p className="font-medium">
                  {deadline ? formatDate(locale, deadline) : t("common.unknown")}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-faint)]">{t("scholarship.cycle")}</p>
                <p className="font-medium">{data.cycle.cycle_id}</p>
              </div>
              <div>
                <p className="text-[var(--text-faint)]">{t("app.planNarrative")}</p>
                <p className="font-medium">{t(`app.feasibility.${feasibilityKey(app.feasibility)}`)}</p>
              </div>
            </div>
            <p className="mt-4">
              <Link
                href={`/scholarships/${row.scholarship.slug}`}
                className="text-sm font-medium text-[var(--brand-strong)] hover:underline"
              >
                {t("matches.detail")}
              </Link>
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-base font-semibold">{t("scholarship.documents")}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {checklist.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{c.label}</span>
                  <Badge tone={c.status === "ready" ? "success" : "neutral"}>
                    {t(`app.checklistState.${c.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "timeline" && <TaskTimeline tasks={tasks} feasibility={app.feasibility} />}
      {tab === "documents" && <ChecklistPanel rows={checklist} />}
      {tab === "writing" && (
        <WritingStudio
          applicationId={app.id}
          drafts={draftSummaries}
          activeId={draftSummaries[0]?.id ?? null}
          wordLimit={wordLimit}
          aiAvailable={aiReady(caps)}
        />
      )}
      {tab === "check" && (
        <CheckPanel applicationId={app.id} initial={serializeCheck(check)} aiAvailable={aiReady(caps)} />
      )}
      {tab === "notes" && <NotesPanel applicationId={app.id} initial={app.notes ?? ""} />}
    </div>
  );
}

/** Dates must cross the RSC boundary as strings, not Date objects. */
function serializeCheck(c: Awaited<ReturnType<typeof latestCheck>>) {
  if (!c) return null;
  return {
    check: { ...c.check, created_at: c.check.created_at?.toISOString() ?? null },
    findings: c.findings,
  };
}

function daysFromToday(iso: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return Math.round(
    (new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000,
  );
}

/** DB stores "ok"; the message files call it "feasible". */
function feasibilityKey(v: string | null | undefined): string {
  if (v === "ok") return "feasible";
  if (v === "tight" || v === "impossible") return v;
  return "unknown";
}
