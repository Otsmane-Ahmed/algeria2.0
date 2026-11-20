"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, cx } from "@/components/ui";

/**
 * My Plan (§7.5): inscription timeline (dates unverified) and a documents
 * checklist with "How to get it in Algeria" guides and status selectors.
 * No file upload anywhere in Mode A — status toggles only (§19).
 */
type DocSpec = {
  code: string;
  titleKey: string;
  whyKey: string;
  howKey: string;
  cost: string;
  days: string;
};

const DOCS: DocSpec[] = [
  { code: "bac_certificate", titleKey: "plan.doc.bac_certificate.title", whyKey: "plan.doc.bac_certificate.why", howKey: "plan.doc.bac_certificate.how", cost: "0–500 DZD", days: "1–3" },
  { code: "birth_certificate", titleKey: "plan.doc.birth_certificate.title", whyKey: "plan.doc.birth_certificate.why", howKey: "plan.doc.birth_certificate.how", cost: "0–500 DZD", days: "1–2" },
  { code: "photos", titleKey: "plan.doc.photos.title", whyKey: "plan.doc.photos.why", howKey: "plan.doc.photos.how", cost: "300–800 DZD", days: "1" },
  { code: "residence", titleKey: "plan.doc.residence.title", whyKey: "plan.doc.residence.why", howKey: "plan.doc.residence.how", cost: "0–1000 DZD", days: "1–5" },
  { code: "attestation_reussite", titleKey: "plan.doc.attestation_reussite.title", whyKey: "plan.doc.attestation_reussite.why", howKey: "plan.doc.attestation_reussite.how", cost: "0 DZD", days: "1–2" },
  { code: "fiche_voeux", titleKey: "plan.doc.fiche_voeux.title", whyKey: "plan.doc.fiche_voeux.why", howKey: "plan.doc.fiche_voeux.how", cost: "0 DZD", days: "1" },
];

const STATUS = ["to_get", "in_progress", "done"] as const;

export function PlanPanel({ initial }: { initial: Record<string, string> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, string>>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function setStatus(code: string, status: string) {
    const next = { ...statuses, [code]: status };
    if (status === statuses[code]) delete next[code];
    setStatuses(next);
    setBusy(true);
    try {
      await fetch("/api/bac/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: { [code]: status } }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const done = DOCS.filter((d) => statuses[d.code] === "done").length;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow flex items-center gap-2 text-[var(--text-faint)]">
              <span className="eyebrow-dot" aria-hidden="true" />
              {t("plan.timelineEyebrow")}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t("plan.timelineNote")}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            {t("plan.print")}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div className="h-full rounded-full bg-[var(--brand)] transition-all" style={{ width: `${Math.round((done / DOCS.length) * 100)}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums">{done}/{DOCS.length}</span>
        </div>
      </Card>

      <ul className="flex flex-col gap-3">
        {DOCS.map((doc) => (
          <li key={doc.code}>
            <Card className="p-0">
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t(doc.titleKey)}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t(doc.whyKey)}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                    {t("plan.cost")} {doc.cost} · {t("plan.days")} {doc.days} · {t("plan.notVerified")}
                  </p>
                </div>
                <div role="group" aria-label={t(doc.titleKey)} className="flex rounded-full border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-0.5 text-[11px] font-medium">
                  {STATUS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(doc.code, s)}
                      aria-pressed={statuses[doc.code] === s}
                      className={cx(
                        "rounded-full px-2.5 py-1",
                        statuses[doc.code] === s ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
                      )}
                    >
                      {t(`plan.status.${s}`)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(open === doc.code ? null : doc.code)}
                  className="text-xs font-medium text-[var(--brand-strong)] underline"
                  aria-expanded={open === doc.code}
                >
                  {t("plan.howToGet")}
                </button>
              </div>
              {open === doc.code && (
                <div className="border-t border-[var(--border)] px-5 py-4 text-sm leading-relaxed text-[var(--text-muted)]">
                  {t(doc.howKey)}
                  <p className="mt-2 text-xs text-[var(--text-faint)]">{t("plan.verifyNote")}</p>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {busy && <p className="text-xs text-[var(--text-faint)]">{t("common.saving")}</p>}
    </div>
  );
}
