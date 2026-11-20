"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Target } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui";

/** Track a scholarship: POST /api/applications, then jump to the new plan. */
export function TrackButton({ slug, tracked }: { slug: string; tracked: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(tracked);
  const [error, setError] = useState<string | null>(null);

  async function track() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = (await res.json().catch(() => ({}))) as { application_id?: string; detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      setDone(true);
      if (body.application_id) router.push(`/applications/${body.application_id}`);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-[var(--success)]">
        <Check className="h-4 w-4" aria-hidden="true" />
        {t("matches.tracking")}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={track} disabled={busy}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Target className="h-4 w-4" aria-hidden="true" />}
        {t("scholarship.track")}
      </Button>
      {error && (
        <span className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
