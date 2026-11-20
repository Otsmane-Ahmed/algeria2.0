"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Input } from "@/components/ui";
import { VerdictChip } from "@/components/wishes-panel";
import type { OrientationMatch } from "@/lib/core/orientation/types";

/**
 * Compare + what-if (§7.4): 2–3 columns, identical rows, a what-if bac
 * average slider recomputing verdicts live, always labeled "Simulation,
 * not your real result". Works for Algeria-only sets in this build.
 */
type ApiItem = { match: OrientationMatch; name: string; institution: string; city: string };

const COMPARE_KEY = "nava.compare.ids";

const ROWS: { key: string; get: (m: ApiItem) => string }[] = [
  { key: "institution", get: (i) => i.institution },
  { key: "city", get: (i) => i.city },
  { key: "duration", get: (i) => `${i.match.formation.durationYears} {y}` },
  { key: "cost", get: () => "0 DZD" },
  { key: "language", get: (i) => i.match.formation.language.toUpperCase() },
  { key: "chance", get: (i) => i.match.verdict },
];

export function CompareView() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<ApiItem[] | null>(null);
  const [avg, setAvg] = useState<string>("");
  const [simulating, setSimulating] = useState(false);

  async function load(simulate?: number) {
    setSimulating(true);
    try {
      const res = await fetch(`/api/formations${simulate != null ? `?simulate_average=${simulate}` : ""}`);
      const body = (await res.json().catch(() => ({}))) as { items?: OrientationMatch[] };
      const ids = new Set(JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "[]") as string[]);
      const all = (body.items ?? []).map((m) => ({
        match: m,
        name: m.formation.nameEn ?? m.formation.nameFr,
        institution: m.formation.institution,
        city: m.formation.city,
      }));
      const byId = new Map((body.items ?? []).map((m) => [m.formation.id, m]));
      const picked = [...ids]
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((m) => ({ match: m!, name: m!.formation.nameEn ?? m!.formation.nameFr, institution: m!.formation.institution, city: m!.formation.city }));
      setItems(picked.length > 0 ? picked : (simulate != null ? all.slice(0, 3) : all.slice(0, 3)));
    } finally {
      setSimulating(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSim() {
    const v = Number(avg);
    if (!Number.isFinite(v) || v < 0 || v > 20) return;
    await load(v);
  }

  function reset() {
    setAvg("");
    void load();
  }

  return (
    <div className="flex flex-col gap-5">
      {simulating && <p className="flex items-center gap-2 text-xs text-[var(--text-faint)]"><LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> {t("compare.loading")}</p>}

      <Card className="p-5">
        <p className="eyebrow flex items-center gap-2 text-[var(--text-faint)]">
          <span className="eyebrow-dot" aria-hidden="true" />
          {t("compare.whatIfEyebrow")}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-36">
            <label htmlFor="whatif-avg" className="text-xs text-[var(--text-faint)]">{t("compare.avgLabel")}</label>
            <Input
              id="whatif-avg"
              inputMode="decimal"
              dir="ltr"
              placeholder="14.35"
              value={avg}
              onChange={(e) => setAvg(e.target.value.replace(",", "."))}
            />
          </div>
          <Button size="sm" onClick={runSim} disabled={simulating || avg.trim() === ""}>{t("compare.run")}</Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={simulating}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("compare.reset")}
          </Button>
          <p className="text-xs text-[var(--text-muted)]">{t("compare.simNote")}</p>
        </div>
      </Card>

      {items && items.length === 0 && (
        <Card className="p-6 text-center text-sm text-[var(--text-muted)]">{t("compare.empty")}</Card>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{t("compare.title")}</caption>
            <thead>
              <tr>
                <th className="w-32" />
                {items.map((i) => (
                  <th key={i.name} className="border-b border-[var(--border)] px-3 pb-3 text-start align-bottom">
                    <p className="text-sm font-semibold">{i.name}</p>
                    <p className="mt-0.5 text-xs font-normal text-[var(--text-faint)]">{i.institution}</p>
                    <div className="mt-1.5"><VerdictChip verdict={i.match.verdict} t={t} /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="border-b border-[var(--border)] py-2.5 pe-3 text-start text-xs font-medium text-[var(--text-faint)]">
                    {t(`compare.row.${row.key}`)}
                  </th>
                  {items.map((i) => (
                    <td key={`${i.name}-${row.key}`} className="border-b border-[var(--border)] px-3 py-2.5">
                      {row.key === "chance" ? t(`verdict.${i.match.verdict}`) : row.get(i).replace("{y}", t("compare.years"))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="p-5">
        <p className="text-xs text-[var(--text-faint)]">{t("compare.tradeoffsLabel")}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{t("compare.tradeoffsBody")}</p>
      </Card>

      <Button variant="outline" size="sm" className="w-fit" onClick={() => router.push("/wishes")}>
        {t("compare.goWishes")}
      </Button>
    </div>
  );
}
