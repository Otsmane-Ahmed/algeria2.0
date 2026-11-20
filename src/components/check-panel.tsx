"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LoaderCircle, PlayCircle, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Badge, Button, Card, cx } from "@/components/ui";
import { AIDisclosure, EmptyState, ScoreRing } from "@/components/domain";

export type Finding = {
  id: string;
  severity: string;
  category: string;
  title: string;
  detail: string;
  fix_hint: string | null;
  evidence: Record<string, unknown> | null;
  source: string;
  resolved: boolean;
};

export type CheckResult = {
  check: { id: string; status: string; readiness_score: number | null; summary: Record<string, unknown> | null; created_at: string | null };
  findings: Finding[];
} | null;

const SEVERITY_ORDER = ["blocker", "warning", "info"] as const;

/**
 * Pre-submission check (spec F9): deterministic rules first, AI review only
 * when a key exists. Findings are read-only except for the student's own
 * resolve flag.
 */
export function CheckPanel({ applicationId, initial, aiAvailable }: { applicationId: string; initial: CheckResult; aiAvailable: boolean }) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const [result, setResult] = useState<CheckResult>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/check`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as CheckResult & { detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      setResult(body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolved(id: string, resolved: boolean) {
    setResult((prev) =>
      prev
        ? { ...prev, findings: prev.findings.map((f) => (f.id === id ? { ...f, resolved } : f)) }
        : prev,
    );
    try {
      await fetch(`/api/check-findings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
    } catch {
      setError("error");
    }
  }

  const findings = result?.findings ?? [];
  const rulesRan = Number((result?.check.summary as { rules_ran?: number } | null)?.rules_ran ?? 0);
  const aiFindings = Number((result?.check.summary as { ai_findings?: number } | null)?.ai_findings ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlayCircle className="h-4 w-4" aria-hidden="true" />}
          {busy ? t("check.running") : t("check.run")}
        </Button>
        {result && (
          <span className="text-xs text-[var(--text-muted)]">
            {formatDate(result.check.created_at ? result.check.created_at.slice(0, 10) : null)}
          </span>
        )}
        <span className="ms-auto" />
        <AIDisclosure />
      </div>

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      {result ? (
        <>
          <Card className="flex flex-wrap items-center gap-5 p-5">
            <ScoreRing score={result.check.readiness_score ?? 0} label={t("check.readiness")} size={72} />
            <div>
              <p className="font-medium">{t("check.readiness")}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {t("check.rulesRan")}: {rulesRan}
                {aiFindings > 0 && ` · ${t("check.source.llm")}: ${aiFindings}`}
              </p>
            </div>
          </Card>

          {!aiAvailable && <p className="text-sm text-[var(--text-muted)]">{t("check.aiLayerOff")}</p>}

          {findings.length === 0 ? (
            <EmptyState
              title={t("check.noFindings")}
              body={t("check.noFindingsBody")}
              icon={<BadgeCheck className="h-8 w-8 text-[var(--success)]" />}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {SEVERITY_ORDER.flatMap((sev) =>
                findings
                  .filter((f) => f.severity === sev)
                  .map((f) => (
                    <Card key={f.id} as="li" className={cx("p-4", f.resolved && "opacity-60")}>
                      <div className="flex flex-wrap items-start gap-3">
                        <span
                          className={cx(
                            "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white",
                            sev === "blocker" && "bg-[var(--danger)]",
                            sev === "warning" && "bg-[var(--warning)]",
                            sev === "info" && "bg-[var(--brand)]",
                          )}
                          aria-hidden="true"
                        >
                          {sev === "blocker" ? (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          ) : sev === "warning" ? (
                            <TriangleAlert className="h-3.5 w-3.5" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cx("font-medium", f.resolved && "line-through")}>{f.title}</span>
                            <Badge tone={sev === "blocker" ? "danger" : sev === "warning" ? "warning" : "neutral"}>
                              {t(`check.severity.${sev}`)}
                            </Badge>
                            <Badge tone="neutral">
                              {f.source === "llm" ? t("check.source.llm") : t("check.source.deterministic")}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">{f.detail}</p>
                          {f.fix_hint && <p className="mt-1 text-sm">{f.fix_hint}</p>}
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={f.resolved}
                            onChange={(e) => toggleResolved(f.id, e.target.checked)}
                            className="h-4 w-4 accent-[var(--brand)]"
                          />
                          {f.resolved ? t("check.resolved") : t("check.resolve")}
                        </label>
                      </div>
                    </Card>
                  )),
              )}
            </ul>
          )}
        </>
      ) : (
        <EmptyState
          title={t("check.title")}
          body={t("check.rulesRan")}
          action={
            <Button size="sm" onClick={run} disabled={busy}>
              {t("check.run")}
            </Button>
          }
        />
      )}
    </div>
  );
}
