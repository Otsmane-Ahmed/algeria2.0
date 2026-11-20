"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Input } from "@/components/ui";
import { STREAMS, WILAYA_NAMES } from "@/lib/core/orientation/chat";
import type { BacProfileData } from "@/lib/core/orientation/types";

/**
 * "My Bac" profile summary (§7.5→7.1.5): same fields as the chatbot live
 * card, inline-editable, with a completeness ring and a "Chat to update"
 * action. No documents section in this tab (§19).
 */
export function MyBacForm({ initial, initialConfirmed }: { initial: BacProfileData | null; initialConfirmed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [p, setP] = useState<BacProfileData | null>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: Partial<BacProfileData>) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/bac/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { profile?: BacProfileData; error?: unknown };
      if (!res.ok) throw new Error("save_failed");
      if (body.profile) setP(body.profile);
      setSaved(true);
      router.refresh();
    } catch {
      setError("save_failed");
    } finally {
      setSaving(false);
    }
  }

  if (!p) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">{t("mybac.empty")}</p>
        <Button className="mt-3" onClick={() => router.push("/chat")}>
          {t("mybac.startChat")}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow flex items-center gap-2 text-[var(--text-faint)]">
              <span className="eyebrow-dot" aria-hidden="true" />
              {t("mybac.eyebrow")}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-medium tracking-normal">{t("mybac.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            {initialConfirmed && (
              <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-medium text-[var(--brand-strong)]">
                {t("mybac.confirmed")}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => router.push("/chat")}>
              {t("mybac.chatUpdate")}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={t("chat.field.stream")}>
            <select
              className="h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--brand)] focus:outline-none"
              value={p.stream ?? ""}
              onChange={(e) => setP({ ...p, stream: (e.target.value || null) as BacProfileData["stream"] })}
              onBlur={(e) => void save({ stream: (e.target.value || null) as BacProfileData["stream"] })}
            >
              <option value="">—</option>
              {STREAMS.map((s) => (
                <option key={s} value={s}>
                  {t(`chat.stream.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("chat.field.average")}>
            <Input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={p.bacAverage ?? ""}
              onChange={(e) => setP({ ...p, bacAverage: Number(e.target.value.replace(",", ".")) || null })}
              onBlur={() => void save({ bacAverage: p.bacAverage })}
              placeholder="14.35"
            />
            {p.averageIsEstimate && <p className="mt-1 text-xs text-[var(--text-muted)]">{t("chat.estimate")}</p>}
          </Field>
          <Field label={t("chat.field.year")}>
            <Input
              type="number"
              dir="ltr"
              value={p.bacYear ?? ""}
              onChange={(e) => setP({ ...p, bacYear: Number(e.target.value) || null })}
              onBlur={() => void save({ bacYear: p.bacYear })}
            />
          </Field>
          <Field label={t("chat.field.wilaya")}>
            <Input
              list="wilaya-list-mybac"
              dir="auto"
              value={p.homeWilaya ?? ""}
              onChange={(e) => setP({ ...p, homeWilaya: e.target.value })}
              onBlur={() => void save({ homeWilaya: p.homeWilaya })}
            />
            <datalist id="wilaya-list-mybac">
              {WILAYA_NAMES.map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
          </Field>
        </div>

        {p.interests.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[var(--text-faint)]">{t("chat.field.interests")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {p.interests.map((tag, i) => (
                <span key={`${tag}-${i}`} className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs text-[var(--brand-strong)]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {error && <p className="text-xs text-[var(--danger)]">{t("mybac.saveFailed")}</p>}
      {saved && !error && <p className="text-xs text-[var(--brand-strong)]">{t("mybac.saved")}</p>}
      {saving && <p className="text-xs text-[var(--text-faint)]">{t("common.saving")}</p>}
    </div>
  );
}
