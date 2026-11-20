"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarSync, FileDown, FileText, LoaderCircle, Printer } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui";

/** Header actions: rebuild dates from today, or export the plan (spec F8). */
export function AppActions({ applicationId }: { applicationId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function replan() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/replan`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={replan} disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarSync className="h-4 w-4" aria-hidden="true" />}
          {t("app.replan")}
        </Button>
        <a
          href={`/api/applications/${applicationId}/plan.pdf`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm hover:bg-[var(--surface-raised)]"
        >
          <FileDown className="h-4 w-4" aria-hidden="true" />
          {t("app.exportPdf")}
        </a>
        <a
          href={`/api/applications/${applicationId}/calendar.ics`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm hover:bg-[var(--surface-raised)]"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {t("app.exportIcs")}
        </a>
        <a
          href={`/print/plan/${applicationId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm hover:bg-[var(--surface-raised)]"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("app.exportPrint")}
        </a>
      </div>
      {error && (
        <span className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
