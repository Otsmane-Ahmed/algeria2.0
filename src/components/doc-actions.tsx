"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, Upload, RotateCcw, Eye } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Button, cx } from "@/components/ui";

const KINDS = [
  "transcript",
  "diploma",
  "bac",
  "cv",
  "passport",
  "id_card",
  "language_cert",
  "recommendation",
  "motivation_letter",
  "birth_certificate",
  "bank_statement",
  "other",
] as const;

async function json(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = (await res.json().catch(() => ({}))) as { detail?: string; message?: string; code?: string };
  if (!res.ok) throw new Error(body.detail || body.code || "error");
  return body;
}

/** Upload card: pick a kind, drop a file, POST multipart, then refresh. */
export function DocUpload() {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>("transcript");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      await json("/api/documents", { method: "POST", body: form });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40">
          <label htmlFor="doc-kind" className="mb-1.5 block text-sm font-medium">
            {t("docs.kindLabel")}
          </label>
          <select
            id="doc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`docs.kind.${k}`)}
              </option>
            ))}
          </select>
        </div>

        <input
          ref={inputRef}
          id="doc-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor="doc-file"
          className={cx(
            "flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] px-4 text-sm",
            "hover:border-[var(--brand)] hover:bg-[var(--surface-raised)]",
          )}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {file ? file.name : t("docs.browse")}
        </label>

        <Button onClick={submit} disabled={!file || busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t("docs.upload")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{t("docs.drop")}</p>
      {error && (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Row actions: retry a failed run, open the review, delete. */
export function DocRowActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await json(`/api/documents/${id}/retry`, { method: "POST" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("docs.deleteConfirm"))) return;
    setBusy(true);
    try {
      await json(`/api/documents/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {(status === "failed" || status === "needs_review") && (
        <Button variant="ghost" size="sm" onClick={retry} disabled={busy} title={t("docs.retry")}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t("docs.retry")}</span>
        </Button>
      )}
      {status !== "uploaded" && status !== "processing" && (
        <Link
          href={`/documents/${id}/review`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] px-3 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {t("docs.reviewTitle")}
        </Link>
      )}
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy} title={t("common.delete")}>
        <Trash2 className="h-4 w-4 text-[var(--danger)]" aria-hidden="true" />
        <span className="sr-only">{t("common.delete")}</span>
      </Button>
      {error && (
        <span className="ms-2 text-xs text-[var(--danger)]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
