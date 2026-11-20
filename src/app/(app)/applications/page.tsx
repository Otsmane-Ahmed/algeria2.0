import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listApplications, text } from "@/lib/app-data";
import { getMessages, formatDate, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import { cookies, headers } from "next/headers";
import { Badge, Card, LinkButton } from "@/components/ui";
import { DeadlineBadge, EmptyState, UnverifiedBadge } from "@/components/domain";

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

const FEASIBILITY_TONE = {
  ok: "success",
  tight: "warning",
  impossible: "danger",
} as const;

function daysFromToday(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round(
    (new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000,
  );
}

export default async function ApplicationsPage() {
  const user = (await getSessionUser())!;
  const locale = await currentLocale();
  const messages = getMessages(locale) as Record<string, string>;
  const t = (key: string) => messages[key] ?? key;
  const rows = await listApplications(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("nav.applications")}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t("app.title")}</p>
        </div>
        <LinkButton href="/matches" variant="secondary" size="sm">
          {t("dash.viewMatches")}
        </LinkButton>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title={t("app.empty")}
          body={t("app.emptyBody")}
          icon={<GraduationCap className="h-8 w-8" />}
          action={
            <LinkButton href="/matches" size="sm">
              {t("dash.viewMatches")}
            </LinkButton>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ application, scholarship }) => {
            const deadline = (scholarship.cycle as { deadline?: string | null })?.deadline ?? null;
            return (
              <Card key={application.id} as="li" className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/applications/${application.id}`}
                      className="font-semibold hover:text-[var(--brand-strong)]"
                    >
                      {text(scholarship.name, locale)}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{t(`app.status.${application.status}`)}</Badge>
                      {application.feasibility && application.feasibility !== "ok" && (
                        <Badge tone={FEASIBILITY_TONE[application.feasibility as keyof typeof FEASIBILITY_TONE] ?? "neutral"}>
                          {t(`app.feasibility.${feasibilityKey(application.feasibility)}`)}
                        </Badge>
                      )}
                      <DeadlineBadge daysToDeadline={daysFromToday(deadline)} />
                      {!deadline && <UnverifiedBadge compact />}
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {t("app.targetSubmission")}:{" "}
                      {application.targetSubmissionDate
                        ? formatDate(locale, application.targetSubmissionDate)
                        : t("common.unknown")}
                    </p>
                  </div>
                  <Link
                    href={`/applications/${application.id}`}
                    className="text-sm font-medium text-[var(--brand-strong)] hover:underline"
                  >
                    {t("common.open")}
                  </Link>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** DB stores "ok"; the message files call it "feasible". */
function feasibilityKey(v: string | null | undefined): string {
  if (v === "ok") return "feasible";
  if (v === "tight" || v === "impossible") return v;
  return "unknown";
}
