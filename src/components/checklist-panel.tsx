"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, FileText, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Badge, Button, Card, cx } from "@/components/ui";
import { EmptyState } from "@/components/domain";

export type ChecklistRow = {
  id: string;
  doc_code: string;
  label: string;
  mandatory: boolean;
  status: string;
  document_id: string | null;
  notes: string | null;
  procedure_codes: string[];
};

const STATES = [
  "missing",
  "in_progress",
  "have_original",
  "have_certified",
  "have_translated",
  "ready",
] as const;

const STATE_TONE = {
  missing: "danger",
  in_progress: "brand",
  have_original: "neutral",
  have_certified: "brand",
  have_translated: "brand",
  ready: "success",
} as const;

/**
 * Document checklist (spec F6). The server rejects backwards or skipping
 * transitions, so the select simply offers every state and shows the error if
 * the procedure chain does not allow that jump.
 */
export function ChecklistPanel({ rows }: { rows: ChecklistRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function move(id: string, status: string) {
    const prev = items;
    setItems((list) => list.map((x) => (x.id === id ? { ...x, status } : x)));
    setBusyId(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch(`/api/checklist/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await res.json().catch(() => ({}))) as { detail?: string; message?: string; status?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      router.refresh();
    } catch (e) {
      setItems(prev);
      setErrors((x) => ({ ...x, [id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) return <EmptyState title={t("app.noTasks")} icon={<FileText className="h-8 w-8" />} />;

  const readyCount = items.filter((i) => i.status === "ready").length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--text-muted)]">
        {readyCount} / {items.length} {t("app.checklistState.ready")}
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <Card key={item.id} as="li" className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  <Badge tone={STATE_TONE[item.status as keyof typeof STATE_TONE] ?? "neutral"}>
                    {t(`app.checklistState.${item.status}`)}
                  </Badge>
                  <Badge tone={item.mandatory ? "warning" : "neutral"}>
                    {item.mandatory ? t("app.mandatory") : t("app.optionalDoc")}
                  </Badge>
                  {item.status === "ready" && <Check className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />}
                </div>
                {item.notes && <p className="mt-1 text-xs text-[var(--text-muted)]">{item.notes}</p>}
                {item.procedure_codes.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-2 text-xs">
                    {item.procedure_codes.map((code) => (
                      <Link
                        key={code}
                        href={`/procedures/${code}`}
                        className="inline-flex items-center gap-1 text-[var(--brand-strong)] hover:underline"
                      >
                        <BookOpen className="h-3 w-3" aria-hidden="true" />
                        {code}
                      </Link>
                    ))}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`st-${item.id}`}>
                  {t("common.status")}
                </label>
                <select
                  id={`st-${item.id}`}
                  value={item.status}
                  disabled={busyId === item.id}
                  onChange={(e) => move(item.id, e.target.value)}
                  className={cx(
                    "h-9 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm",
                    "focus:border-[var(--brand)] focus:outline-none",
                  )}
                >
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {t(`app.checklistState.${s}`)}
                    </option>
                  ))}
                </select>
                {busyId === item.id && (
                  <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-faint)]" aria-hidden="true" />
                )}
              </div>
            </div>
            {errors[item.id] && (
              <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
                {errors[item.id]}
              </p>
            )}
          </Card>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          {t("common.reset")}
        </Button>
      </div>
    </div>
  );
}
