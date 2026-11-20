"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, cx } from "@/components/ui";
import { MatchesPanel, type MatchItem } from "@/components/matches-panel";
import { VerdictChip } from "@/components/wishes-panel";
import type { OrientationMatch } from "@/lib/core/orientation/types";

/**
 * Mode A Matches (§7.3): "In Algeria" (default) and "Abroad" tabs. The
 * Algeria cards carry the honest state of the catalog — a cut-off that is
 * not verified yet shows as unknown, never as a pass.
 */
export type FormationCard = {
  formationId: string;
  name: string;
  institution: string;
  city: string;
  streamsLabel: string[];
  language: string;
  durationYears: number;
  match: OrientationMatch;
  wishlisted: boolean;
};

const COMPARE_KEY = "nava.compare.ids";

export function BacMatches({
  formations,
  abroad,
  profileConfirmed,
}: {
  formations: FormationCard[];
  abroad: MatchItem[];
  profileConfirmed: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<"algeria" | "abroad">("algeria");
  const [openId, setOpenId] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState<Set<string>>(
    () => new Set(formations.filter((f) => f.wishlisted).map((f) => f.formationId)),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addWish(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formation_id: id }),
      });
      if (res.ok) {
        setWishlisted((prev) => new Set(prev).add(id));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  function addCompare(id: string) {
    const ids = new Set<string>(JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "[]") as string[]);
    ids.add(id);
    localStorage.setItem(COMPARE_KEY, JSON.stringify([...ids].slice(-3)));
    router.push("/compare");
  }

  const unknown = formations.filter((f) => f.match.verdict === "unknown").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs: In Algeria is the default (§2.3 — Algeria first). */}
      <div role="tablist" aria-label={t("matchesA.tablist")} className="flex w-fit rounded-full border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-1 text-sm font-medium">
        {([
          ["algeria", "matchesA.tabAlgeria"],
          ["abroad", "matchesA.tabAbroad"],
        ] as const).map(([value, key]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cx(
              "rounded-full px-4 py-1.5 transition-colors",
              tab === value ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {tab === "algeria" ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            {t("matchesA.count", { count: formations.length })}
            {unknown > 0 && ` · ${t("matchesA.unknownNote", { count: unknown })}`}
          </p>
          {!profileConfirmed && (
            <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3 text-xs text-[var(--text-muted)]">
              {t("matchesA.profileNote")}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {formations.map((f) => (
              <li key={f.formationId}>
                <Card className="p-0">
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === f.formationId ? null : f.formationId)}
                    aria-expanded={openId === f.formationId}
                    className="flex w-full items-center gap-4 px-5 py-4 text-start"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{f.name}</p>
                      <p className="truncate text-xs text-[var(--text-faint)]">{f.institution} · {f.city}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                        <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5">{f.durationYears} {t("matchesA.years")}</span>
                        <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 uppercase">{f.language}</span>
                        {f.match.formation.cutoffLastYear == null ? (
                          <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5">{t("matchesA.estimateLastYear")}</span>
                        ) : (
                          <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5">
                            {t("matchesA.cutoffShort", { value: f.match.formation.cutoffLastYear })}
                          </span>
                        )}
                      </div>
                    </div>
                    <VerdictChip verdict={f.match.verdict} t={t} />
                    <span className="hidden w-12 text-center font-serif text-2xl tabular-nums text-[var(--text)] sm:block">
                      {f.match.score}
                    </span>
                    <ChevronDown className={cx("h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform", openId === f.formationId && "rotate-180")} aria-hidden="true" />
                  </button>

                  {openId === f.formationId && (
                    <div className="border-t border-[var(--border)] px-5 py-4">
                      <table className="w-full text-sm">
                        <caption className="sr-only">{t("matchesA.factorsTitle")}</caption>
                        <thead>
                          <tr className="text-start text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                            <th className="py-1 text-start font-medium">{t("matchesA.factor")}</th>
                            <th className="py-1 text-start font-medium">{t("matchesA.status")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.match.factors.map((factor) => (
                            <tr key={factor.key} className="border-t border-[var(--border)]">
                              <td className="py-1.5">{factor.label}</td>
                              <td className="py-1.5">
                                <FactorStatus status={factor.status} t={t} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {f.match.formation.cutoffLastYear == null && (
                        <p className="mt-3 text-xs text-[var(--text-muted)]">{t("matchesA.unverifiedCutoff")}</p>
                      )}
                      {f.match.missing.length > 0 && (
                        <p className="mt-3 text-xs text-[var(--text-muted)]">
                          {t("matchesA.missingNote", { fields: f.match.missing.map((m) => t(`missing.${m}`)).join(", ") })}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" disabled={busyId === f.formationId || wishlisted.has(f.formationId)} onClick={() => addWish(f.formationId)}>
                          {wishlisted.has(f.formationId) ? (
                            <>
                              <Check className="h-4 w-4" aria-hidden="true" />
                              {t("matchesA.inWishes")}
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" aria-hidden="true" />
                              {t("matchesA.addToWishes")}
                            </>
                          )}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => addCompare(f.formationId)}>
                          {t("matchesA.addToCompare")}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <MatchesPanel initial={abroad} profileConfirmed={profileConfirmed} hideHeader />
      )}
    </div>
  );
}

function FactorStatus({ status, t }: { status: string; t: (k: string, v?: Record<string, string | number>) => string }) {
  const map: Record<string, string> = {
    ok: "matchesA.f.ok",
    warn: "matchesA.f.warn",
    fail: "matchesA.f.fail",
    unknown: "matchesA.f.unknown",
  };
  const color: Record<string, string> = {
    ok: "text-[var(--brand-strong)]",
    warn: "text-[#b45309]",
    fail: "text-[var(--danger)]",
    unknown: "text-[var(--text-faint)]",
  };
  return <span className={`text-xs font-medium ${color[status]}`}>{t(map[status] ?? "matchesA.f.unknown")}</span>;
}
