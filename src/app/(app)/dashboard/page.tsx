import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, Target, TrendingUp } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getProfile, getLatestRun, listApplications, getAppTasks, text, getBacProfile, bacProfileData, listWishes, listFormations } from "@/lib/app-data";
import { bacCompleteness } from "@/lib/core/orientation/chat";
import { evaluateFormation } from "@/lib/core/orientation/match";
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

  // Mode A dashboard (§9.1): continue chat, wishes status, formation matches.
  if ((user.mode as string) === "bac") {
    return <BacDashboard user={user} locale={locale} t={t} />;
  }

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

async function BacDashboard({
  user,
  locale,
  t,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [profileRow, wishRows, formations] = await Promise.all([
    getBacProfile(user.id),
    listWishes(user.id),
    listFormations(),
  ]);
  const profile = profileRow ? bacProfileData(profileRow) : null;
  const completeness = profile ? bacCompleteness(profile) : 0;
  const risky = wishRows.filter((w) => {
    const f = formations.find((x) => x.id === w.formationId);
    if (!f) return false;
    const v = evaluateFormation(
      {
        id: f.id, nameFr: f.nameFr, nameEn: f.nameEn, nameAr: f.nameAr,
        institution: f.institution, institutionKind: f.institutionKind, city: f.city,
        wilayaCode: f.wilayaCode, wilayaName: f.wilayaName, streams: f.streams,
        language: f.language, domainTags: f.domainTags, durationYears: f.durationYears,
        tuition: f.tuition, cutoffLastYear: f.cutoffLastYear, needsVerification: f.needsVerification,
      },
      profile,
    ).verdict;
    return v === "stretch" || v === "ineligible";
  }).length;

  const nextAction = !profileRow
    ? { label: t("dashA.startChat"), href: "/chat" }
    : !profileRow.confirmedAt
      ? { label: t("dashA.continueChat"), href: "/chat" }
      : wishRows.length === 0
        ? { label: t("dashA.rankWishes"), href: "/wishes" }
        : { label: t("dashA.seeMatches"), href: "/matches" };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-normal sm:text-4xl">
            {t("dash.welcome", { name: user.name ?? user.email })}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{t("dashA.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/matches" variant="secondary" size="sm">
            <Target className="h-4 w-4" aria-hidden="true" />
            {t("dashA.matchesBtn")}
          </LinkButton>
          <LinkButton href="/chat" size="sm">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("dashA.chatBtn")}
          </LinkButton>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-[var(--text-muted)]">{t("dashA.completeness")}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div className="h-full rounded-full bg-[var(--brand)] transition-all" style={{ width: `${completeness}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums">{completeness}%</span>
          </div>
          {profile?.averageIsEstimate && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">{t("dashA.estimateNote")}</p>
          )}
        </Card>

        <Card className="p-5 md:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {t("dashA.wishesStatus")}
          </div>
          <div className="flex items-center gap-6">
            <p className="text-3xl font-semibold tabular-nums">{wishRows.length}</p>
            <p className="text-sm text-[var(--text-muted)]">{t("dashA.wishesCount")}</p>
            {risky > 0 && (
              <p className="text-sm font-medium text-[#b45309]">{t("dashA.riskyCount", { count: risky })}</p>
            )}
            <Link href="/wishes" className="ms-auto inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-strong)] hover:underline">
              {t("common.viewAll")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {t("dash.nextAction")}
          </div>
          <Link href={nextAction.href} className="font-medium text-[var(--brand-strong)] hover:underline">
            {nextAction.label}
          </Link>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("dashA.catalog")}
          </div>
          <p className="text-3xl font-semibold tabular-nums">{formations.length}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t("dashA.catalogNote")}</p>
          <Link href="/matches" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-strong)] hover:underline">
            {t("dash.viewMatches")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
