"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, PlayCircle, SlidersHorizontal, Target } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Input, cx } from "@/components/ui";
import { DeadlineBadge, EmptyState, FactorTable, ScoreRing, UnverifiedBadge, VerdictPill } from "@/components/domain";

export type MatchItem = {
  match_id: string | null;
  slug: string;
  name: string;
  provider: string | null;
  verdict: string;
  score: number;
  factors: { key: string; label: { en?: string; fr?: string; ar?: string }; weight: number; status: "pass" | "fail" | "unknown" | "partial"; value: string | null; detail?: string | null }[];
  blockers: { message?: unknown; code?: unknown }[] | unknown[];
  missing_info: string[];
  days_to_deadline: number | null;
  needs_verification: boolean;
  tracked?: boolean;
};

const VERDICTS = ["eligible", "likely", "stretch", "unknown", "ineligible"] as const;

/**
 * Match results (spec F4): run, filter, inspect factors, track, and a what-if
 * panel that re-scores with profile overrides without persisting anything.
 */
export function MatchesPanel({
  initial,
  profileConfirmed,
  hideHeader = false,
}: {
  initial: MatchItem[];
  profileConfirmed: boolean;
  hideHeader?: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [items, setItems] = useState<MatchItem[]>(initial);
  const [verdicts, setVerdicts] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState(false);
  const [gpa, setGpa] = useState("");
  const [countries, setCountries] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [tracked, setTracked] = useState<Record<string, boolean>>({});

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/matches/run", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        run_id?: string;
        detail?: string; message?: string;
        code?: string;
      };
      if (!res.ok) throw new Error(body.detail || body.code || "error");
      if (body.run_id) {
        const detail = await fetch(`/api/matches/${body.run_id}`);
        const detailBody = (await detail.json()) as { items?: MatchItem[] };
        setItems(detailBody.items ?? []);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    setSimulating(true);
    setError(null);
    try {
      const overrides: Record<string, unknown> = {};
      if (gpa.trim() !== "") overrides.gpa20 = Number(gpa);
      const list = countries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (list.length) overrides.target_countries = list;
      const res = await fetch("/api/matches/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(overrides),
      });
      const body = (await res.json().catch(() => ({}))) as { items?: MatchItem[]; detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      setItems(
        (body.items ?? []).map((i) => ({
          ...i,
          match_id: i.match_id ?? `sim_${i.slug}`,
          missing_info: i.missing_info ?? [],
          blockers: i.blockers ?? [],
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSimulating(false);
    }
  }

  function reset() {
    setVerdicts([]);
    setWhatIf(false);
    setGpa("");
    setCountries("");
    router.refresh();
  }

  async function track(slug: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      setTracked((prev) => ({ ...prev, [slug]: true }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const visible = items.filter((i) => verdicts.length === 0 || verdicts.includes(i.verdict));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy || !profileConfirmed}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlayCircle className="h-4 w-4" aria-hidden="true" />}
          {initial.length > 0 ? t("matches.rerun") : t("matches.run")}
        </Button>
        <Button variant="secondary" onClick={() => setWhatIf((v) => !v)} aria-expanded={whatIf}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("matches.whatIf")}
        </Button>
        <span className="ms-auto text-sm text-[var(--text-muted)]">{t("matches.score")}: {visible.length}</span>
      </div>

      {!profileConfirmed && (
        <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-muted)]">
          {t("profile.notConfirmed")}{" "}
          <Link href="/profile" className="text-[var(--brand-strong)] underline">
            {t("profile.title")}
          </Link>
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      {whatIf && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {t("matches.whatIf")}
          </div>
          <p className="text-xs text-[var(--text-muted)]">{t("matches.whatIfHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.gpa20")} htmlFor="sim-gpa">
              <Input id="sim-gpa" type="number" step="0.1" min={0} max={20} value={gpa} onChange={(e) => setGpa(e.target.value)} />
            </Field>
            <Field label={t("profile.targetCountries")} htmlFor="sim-countries" hint="FR, DE">
              <Input id="sim-countries" value={countries} onChange={(e) => setCountries(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={simulate} disabled={simulating}>
              {simulating && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.apply")}
            </Button>
            <Button size="sm" variant="secondary" onClick={reset}>
              {t("common.reset")}
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("common.filter")}>
        {VERDICTS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={verdicts.includes(v)}
            onClick={() =>
              setVerdicts((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
            }
            className={cx(
              "rounded-full border px-3 py-1.5 text-sm",
              verdicts.includes(v)
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                : "border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]",
            )}
          >
            {t(`matches.verdict.${v}`)}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={t("matches.empty")}
          body={t("matches.emptyBody")}
          icon={<Target className="h-8 w-8" />}
          action={
            profileConfirmed ? (
              <Button size="sm" onClick={run} disabled={busy}>
                {t("matches.run")}
              </Button>
            ) : undefined
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState title={t("matches.noResults")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((item) => {
            const key = `${item.slug}`;
            const isOpen = expanded === key;
            const isTracked = tracked[item.slug];
            return (
              <Card key={key} as="li" className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <ScoreRing score={item.score} label={t("matches.score")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/scholarships/${item.slug}`}
                        className="font-semibold hover:text-[var(--brand-strong)]"
                      >
                        {item.name}
                      </Link>
                      <VerdictPill verdict={item.verdict as never} />
                      {item.needs_verification && <UnverifiedBadge compact />}
                    </div>
                    {item.provider && (
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">{item.provider}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <DeadlineBadge daysToDeadline={item.days_to_deadline} />
                      {item.missing_info.length > 0 && (
                        <span className="text-xs text-[var(--text-faint)]">
                          {t("matches.missingInfo")}: {item.missing_info.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(isOpen ? null : key)}
                      aria-expanded={isOpen}
                    >
                      {t("matches.explain")}
                      <ArrowRight className={cx("h-4 w-4 rtl:rotate-180", isOpen && "rotate-90")} aria-hidden="true" />
                    </Button>
                    <Button size="sm" onClick={() => track(item.slug)} disabled={busy || isTracked}>
                      {isTracked ? t("matches.tracking") : t("matches.track")}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-[var(--border)] pt-4">
                    <FactorTable factors={item.factors as never} />
                    {item.blockers.length > 0 && (
                      <div>
                        <h3 className="mb-1.5 text-sm font-medium">{t("matches.blockers")}</h3>
                        <ul className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                          {item.blockers.map((b, i) => (
                            <li key={i}>{blockerText(b, locale)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Link
                        href={`/scholarships/${item.slug}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-strong)] hover:underline"
                      >
                        {t("matches.detail")}
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Blockers are stored as localized objects or plain strings; be forgiving. */
function blockerText(b: unknown, locale: string): string {
  if (typeof b === "string") return b;
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    for (const key of [locale, "fr", "en"]) {
      if (typeof o[key] === "string") return o[key] as string;
    }
    if (typeof o.message === "string") return o.message;
    if (typeof o.detail === "string") return o.detail;
    return JSON.stringify(b);
  }
  return String(b);
}
