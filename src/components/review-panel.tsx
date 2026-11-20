"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Input } from "@/components/ui";
import { ConfidenceDot, UnverifiedBadge } from "@/components/domain";

type Props = {
  documentId: string;
  pageCount: number;
  values: Record<string, unknown>;
  confidence: Record<string, number>;
  warnings: string[];
  ocrText: string;
  confirmed: boolean;
};

const FIELD_ORDER = [
  "full_name_latin",
  "full_name_arabic",
  "birth_date",
  "institution_name",
  "faculty",
  "level",
  "year",
  "field_free_text",
  "average_20",
  "rank_percent",
] as const;

/**
 * Split review (spec F2/F8.6): document on the left, extracted values with
 * per-field confidence on the right. The student can correct any value before
 * confirming; nothing is written to the profile until they do.
 */
export function ReviewPanel({ documentId, pageCount, values, confidence, warnings, ocrText, confirmed }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) out[k] = v === null || v === undefined ? "" : String(v);
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(confirmed);

  const autoFields = useMemo(() => {
    const known = FIELD_ORDER.filter((k) => k in values || k in confidence);
    const extra = Object.keys(values).filter((k) => !(FIELD_ORDER as readonly string[]).includes(k));
    return [...known, ...extra];
  }, [values, confidence]);

  /**
   * No extraction (a scan or photo with no vision key): fall back to the
   * canonical field set so the student can type the details the copy above
   * promises, instead of hitting an empty panel with a dead Confirm button.
   */
  const manual = autoFields.length === 0;
  const fields = manual ? [...FIELD_ORDER] : autoFields;
  const filled = Object.values(draft).some((v) => v.trim() !== "");

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const parsed: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(draft)) {
        if (raw === "") continue;
        parsed[k] = Number.isFinite(Number(raw)) && /average_20|rank_percent|year/.test(k) ? Number(raw) : raw;
      }
      const res = await fetch(`/api/documents/${documentId}/extraction/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: parsed, write_profile: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: the document itself */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="text-sm font-medium">{t("docs.reviewLeft")}</span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                <span className="sr-only">{t("common.back")}</span>
              </Button>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {page} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                <span className="sr-only">{t("common.next")}</span>
              </Button>
            </div>
          )}
        </div>
        <div className="bg-[var(--surface-sunken)] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/documents/${documentId}/pages/${page}`}
            alt={`${t("docs.reviewLeft")} ${page}`}
            className="mx-auto max-h-[70vh] w-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-white"
            loading="lazy"
          />
        </div>
        {ocrText && (
          <details className="border-t border-[var(--border)] px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">{t("docs.extractedText")}</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">
              {ocrText}
            </pre>
          </details>
        )}
      </Card>

      {/* Right: extracted values */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("docs.reviewRight")}</span>
            <UnverifiedBadge compact />
          </div>

          {warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)]">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {manual && (
            <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
              {t("docs.noValues")}. {t("docs.aiOffNote")}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {fields.map((key) => (
              <Field
                key={key}
                label={key.replace(/_/g, " ")}
                htmlFor={`f-${key}`}
              >
                <div className="flex items-center gap-3">
                  <Input
                    id={`f-${key}`}
                    value={draft[key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    disabled={done}
                  />
                  {confidence[key] !== undefined && <ConfidenceDot value={confidence[key]} />}
                </div>
              </Field>
            ))}
          </div>

          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}

          {done ? (
            <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--success)] bg-[var(--success)]/10 px-4 py-3 text-sm">
              <Check className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
              {t("profile.confirmed")}
            </p>
          ) : (
            <Button onClick={confirm} disabled={busy || !filled}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.confirm")}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
