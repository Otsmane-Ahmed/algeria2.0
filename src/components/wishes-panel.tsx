"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LoaderCircle, Printer, Search, Shuffle, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Input } from "@/components/ui";
import { saferWishOrder, wishWarnings } from "@/lib/core/orientation/chat";
import type { OrientationMatch } from "@/lib/core/orientation/types";

/**
 * Fiche de vœux (§7.2): an ordered wish list with verdict chips, warnings,
 * a safer-order suggestion shown as a diff before anything is reordered,
 * and a print/PDF export. Nothing is reordered without confirmation.
 */
export type WishRow = {
  formationId: string;
  name: string;
  institution: string;
  city: string;
  match: OrientationMatch;
};

export function WishesPanel({ initial, catalog }: { initial: WishRow[]; catalog: { id: string; name: string; institution: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<WishRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<WishRow[] | null>(null);

  const warnings = useMemo(
    () => wishWarnings(rows.map((r) => r.match.verdict), rows.map((r) => r.formationId)),
    [rows],
  );
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => `${c.name} ${c.institution}`.toLowerCase().includes(q)).slice(0, 8);
  }, [search, catalog]);

  async function api(method: "POST" | "DELETE" | "PATCH", body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch("/api/wishes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.ok;
    } finally {
      setBusy(false);
    }
  }

  async function add(id: string) {
    if (await api("POST", { formation_id: id })) {
      setSearch("");
      setShowSearch(false);
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (await api("DELETE", { formation_id: id })) {
      setRows((prev) => prev.filter((r) => r.formationId !== id));
      router.refresh();
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const next = [...rows];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!] as [WishRow, WishRow];
    setRows(next);
    if (await api("PATCH", { order: next.map((r) => r.formationId) })) router.refresh();
  }

  /** Safer-order suggestion: risky wishes sink to the bottom (§7.2). */
  function suggestSaferOrder() {
    const idx = saferWishOrder(rows.map((r) => ({ verdict: r.match.verdict })));
    const next = idx.map((i) => rows[i]!);
    setPendingOrder(next);
  }

  async function acceptPending() {
    if (!pendingOrder) return;
    setRows(pendingOrder);
    setPendingOrder(null);
    if (await api("PATCH", { order: pendingOrder.map((r) => r.formationId) })) router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {warnings.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--warn,#b45309)]/40 bg-[var(--surface-sunken)] px-4 py-3 text-sm" role="alert">
          {warnings.includes("too_many_risky") && <p>{t("wishes.warn.tooManyRisky")}</p>}
          {warnings.includes("no_safe_option") && <p>{t("wishes.warn.noSafe")}</p>}
          {warnings.includes("duplicates") && <p>{t("wishes.warn.duplicates")}</p>}
        </div>
      )}

      <Card className="p-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-serif text-xl font-medium">{t("wishes.listTitle")}</h2>
          <div className="flex gap-2">
            {rows.length > 1 && (
              <Button size="sm" variant="outline" onClick={suggestSaferOrder} disabled={busy}>
                <Shuffle className="h-4 w-4" aria-hidden="true" />
                {t("wishes.suggestSafer")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowSearch((v) => !v)}>
              <Search className="h-4 w-4" aria-hidden="true" />
              {t("wishes.add")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t("wishes.print")}
            </Button>
          </div>
        </header>

        {showSearch && (
          <div className="border-b border-[var(--border)] px-5 py-3">
            <Input
              autoFocus
              placeholder={t("wishes.searchPh")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("wishes.searchPh")}
            />
            {results.length > 0 && (
              <ul className="mt-2 max-h-64 overflow-y-auto">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => add(c.id)}
                      className="flex w-full flex-col rounded-[var(--radius-sm)] px-3 py-2 text-start text-sm hover:bg-[var(--surface-sunken)]"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-[var(--text-faint)]">{c.institution}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim() && results.length === 0 && (
              <p className="mt-2 text-xs text-[var(--text-faint)]">{t("wishes.noResults")}</p>
            )}
          </div>
        )}

        {pendingOrder && (
          <div className="border-b border-[var(--border)] bg-[var(--surface-sunken)] px-5 py-4">
            <p className="text-sm font-medium">{t("wishes.diffTitle")}</p>
            <ol className="mt-2 space-y-1 text-sm">
              {pendingOrder.map((r, i) => (
                <li key={r.formationId} className="flex items-center gap-2">
                  <span className="w-5 tabular-nums text-[var(--text-faint)]">{i + 1}.</span>
                  {r.name}
                  <span aria-hidden="true">·</span>
                  <span className="text-xs text-[var(--text-faint)]">
                    {t("wishes.was")} {rows.findIndex((x) => x.formationId === r.formationId) + 1}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={acceptPending} disabled={busy}>{t("wishes.accept")}</Button>
              <Button size="sm" variant="outline" onClick={() => setPendingOrder(null)}>{t("wishes.reject")}</Button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">{t("wishes.empty")}</p>
            <Button className="mt-3" size="sm" onClick={() => setShowSearch(true)}>{t("wishes.startFromMatches")}</Button>
          </div>
        ) : (
          <ol>
            {rows.map((r, i) => (
              <li key={r.formationId} className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3.5 last:border-0">
                <span className="w-6 text-center font-serif text-lg tabular-nums text-[var(--text-faint)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-[var(--text-faint)]">{r.institution} · {r.city}</p>
                  {r.match.formation.cutoffLastYear == null ? (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("wishes.noCutoff")}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {t("wishes.cutoffLine", { value: r.match.formation.cutoffLastYear })}
                    </p>
                  )}
                </div>
                <VerdictChip verdict={r.match.verdict} t={t} />
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} className="rounded p-1 text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30" aria-label={t("wishes.moveUp")}>
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={busy || i === rows.length - 1} className="rounded p-1 text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30" aria-label={t("wishes.moveDown")}>
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <button type="button" onClick={() => remove(r.formationId)} disabled={busy} className="rounded p-1.5 text-[var(--text-faint)] hover:text-[var(--danger)]" aria-label={t("wishes.remove")}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {busy && (
          <p className="flex items-center gap-2 px-5 py-2 text-xs text-[var(--text-faint)]">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t("common.saving")}
          </p>
        )}
      </Card>

      <p className="text-xs text-[var(--text-faint)]">{t("wishes.limitNote")}</p>
    </div>
  );
}

export function VerdictChip({ verdict, t }: { verdict: string; t: (k: string) => string }) {
  const styles: Record<string, string> = {
    eligible: "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
    likely: "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
    stretch: "bg-[var(--blush)] text-[var(--text)]",
    unknown: "border border-[var(--border-strong)] text-[var(--text-muted)]",
    ineligible: "bg-[var(--surface-sunken)] text-[var(--danger)]",
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[verdict] ?? styles.unknown}`}>
      {t(`verdict.${verdict}`)}
    </span>
  );
}
