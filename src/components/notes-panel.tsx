"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Textarea, cx } from "@/components/ui";

/**
 * Free-form notes on one application (spec F8). Autosaves after a short pause;
 * the same 409-free endpoint as PATCH /api/applications/:id.
 */
export function NotesPanel({ applicationId, initial }: { applicationId: string; initial: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initial);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function schedule(next: string) {
    if (timer.current) clearTimeout(timer.current);
    setState("idle");
    timer.current = setTimeout(() => void save(next), 900);
  }

  async function save(next: string) {
    if (next === lastSaved.current) return;
    setState("saving");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: next }),
      });
      if (!res.ok) throw new Error("error");
      lastSaved.current = next;
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="app-notes" className="text-sm font-medium">
        {t("common.notes")}
      </label>
      <Textarea
        id="app-notes"
        rows={14}
        value={value}
        placeholder={t("app.notesPlaceholder")}
        onChange={(e) => {
          setValue(e.target.value);
          schedule(e.target.value);
        }}
      />
      <p
        role="status"
        className={cx(
          "text-xs",
          state === "error" ? "text-[var(--danger)]" : "text-[var(--text-faint)]",
        )}
      >
        {state === "saving" && t("common.loading")}
        {state === "saved" && t("writing.autosaved")}
        {state === "error" && t("states.error")}
      </p>
    </div>
  );
}
