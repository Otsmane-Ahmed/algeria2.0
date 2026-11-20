import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, Target, TrendingUp } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getProfile, getLatestRun, listApplications, getAppTasks, text } from "@/lib/app-data";
import { getMessages, formatDate, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { Card, LinkButton } from "@/components/ui";
import { CompletenessBar, DeadlineBadge, EmptyState, UnverifiedBadge } from "@/components/domain";

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

export default async function DashboardPage() {
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const t = (key: string, vars?: Record<string, string | number>) => {
    const messages = getMessages(locale) as Record<string, string>;
    const raw = messages[key] ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : raw;
  };

  const [profile, run, apps] = await Promise.all([
    getProfile(user.id),
    getLatestRun(user.id),
    listApplications(user.id),
  ]);

  // Next best action: earliest open task across every tracked application (F5).
  const appTasks = await Promise.all(apps.map((a) => getAppTasks(a.application.id)));
  const openTasks = apps
    .flatMap((a, i) =>
      (appTasks[i] ?? [])
        .filter((task) => task.status === "todo" || task.status === "doing")
        .map((task) => ({ task, app: a })),
    )
    .sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate));
  const next = openTasks[0];

  const newMatches = run
    ? run.items.filter((i) => i.match.verdict === "eligible" || i.match.verdict === "likely").length
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">
            {t("dash.welcome", { name: user.name ?? user.email })}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{t("dash.title")}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/matches" variant="secondary" size="sm">
            <Target className="h-4 w-4" aria-hidden="true" />
            {t("dash.viewMatches")}
          </LinkButton>
          <LinkButton href="/onboarding" size="sm">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("dash.startUpload")}
          </LinkButton>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <CompletenessBar value={profile?.completeness ?? 0} />
          {!profile?.confirmedAt && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">{t("profile.notConfirmed")}</p>
          )}
        </Card>

        <Card className="p-5 md:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {t("dash.newMatches")}
          </div>
          {run ? (
            <div className="flex items-center gap-4">
              <p className="text-3xl font-semibold tabular-nums">{newMatches}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {formatDate(locale, run.run.createdAt?.toISOString().slice(0, 10) ?? null)}
              </p>
              <Link
                href="/matches"
                className="ms-auto inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-strong)] hover:underline"
              >
                {t("common.viewAll")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <EmptyState
              title={t("matches.empty")}
              body={t("matches.emptyBody")}
              action={
                <LinkButton href="/matches" size="sm">
                  {t("dash.viewMatches")}
                </LinkButton>
              }
              icon={<Target className="h-8 w-8" />}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {t("dash.nextAction")}
          </div>
          {next ? (
            <div>
              <p className="font-medium">{text(next.task.title, locale)}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <bdi>{formatDate(locale, next.task.dueDate)}</bdi>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/applications/${next.app.application.id}?tab=timeline`}
                  className="text-[var(--brand-strong)] hover:underline"
                >
                  {text(next.app.scholarship.name, locale)}
                </Link>
              </p>
            </div>
          ) : apps.length === 0 ? (
            <EmptyState title={t("dash.noApps")} body={t("dash.noAppsBody")} icon={<Target className="h-8 w-8" />} />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">{t("dash.noDeadlines")}</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("dash.tracked")}
          </div>
          {apps.length === 0 ? (
            <EmptyState
              title={t("dash.noApps")}
              body={t("dash.noAppsBody")}
              action={
                <LinkButton href="/matches" size="sm">
                  {t("dash.viewMatches")}
                </LinkButton>
              }
              icon={<Target className="h-8 w-8" />}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {apps.slice(0, 5).map(({ application, scholarship }) => (
                <li key={application.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/applications/${application.id}`}
                    className="flex items-center justify-between gap-3 hover:text-[var(--brand-strong)]"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {text(scholarship.name, locale)}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <DeadlineBadge
                        daysToDeadline={daysFromToday(scholarship.cycle?.deadline as string | null)}
                      />
                    </span>
                  </Link>
                  {!(scholarship.cycle as { deadline?: string | null })?.deadline && (
                    <div className="mt-1">
                      <UnverifiedBadge compact />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function daysFromToday(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
}
