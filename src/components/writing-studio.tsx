"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, History, LoaderCircle, Sparkles, Wand2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Input, cx } from "@/components/ui";
import { AIDisclosure, AIOffBanner, EmptyState } from "@/components/domain";

export type DraftSummary = {
  id: string;
  kind: string;
  language: string;
  title: string | null;
  word_count: number;
};

export type VersionRow = {
  id: string;
  version_no: number;
  word_count: number | null;
  source: string;
  created_at: string | null;
};

type Outline = { sections?: { heading?: string; points?: string[] }[]; missing_facts?: string[] };

const KINDS = ["motivation_letter", "cv"] as const;
const LANGS = ["fr", "en", "ar", "darija"] as const;

/**
 * Writing studio (spec F7): create a draft, edit with debounced autosave,
 * generate through the SSE endpoint, restore an older version. The fact pack
 * is server-built, so generation never invents a grade that is not stored.
 */
export function WritingStudio({
  applicationId,
  drafts,
  activeId,
  wordLimit,
  aiAvailable,
}: {
  applicationId: string;
  drafts: DraftSummary[];
  activeId: string | null;
  wordLimit: number | null;
  aiAvailable: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [activeDraft, setActiveDraft] = useState<string | null>(activeId ?? drafts[0]?.id ?? null);
  const [kind, setKind] = useState<string>("motivation_letter");
  const [lang, setLang] = useState<string>("fr");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (drafts.length === 0 || activeDraft === null) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          title={t("writing.empty")}
          body={t("writing.emptyBody")}
          icon={<FilePlus2 className="h-8 w-8" />}
        />
        <Card className="flex flex-wrap items-end gap-3 p-5">
          <Field label={t("common.status")} htmlFor="draft-kind">
            <select
              id="draft-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-11 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`writing.kind.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("writing.language")} htmlFor="draft-lang">
            <select
              id="draft-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="h-11 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Button
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              setError(null);
              try {
                const res = await fetch(`/api/applications/${applicationId}/drafts`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ kind, language: lang }),
                });
                const body = (await res.json().catch(() => ({}))) as {
                  draft_id?: string;
                  detail?: string; message?: string;
                };
                if (!res.ok) throw new Error(body.detail || "error");
                setActiveDraft(body.draft_id ?? null);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("writing.create")}
          </Button>
          {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("writing.title")}>
        {drafts.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={d.id === activeDraft}
            onClick={() => setActiveDraft(d.id)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-sm",
              d.id === activeDraft
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                : "border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]",
            )}
          >
            {t(`writing.kind.${d.kind}`)} · {d.language}
          </button>
        ))}
      </div>
      {!aiAvailable && <AIOffBanner body={t("writing.aiOff")} />}
      <Editor key={activeDraft} draftId={activeDraft} wordLimit={wordLimit} />
    </div>
  );
}

function Editor({ draftId, wordLimit }: { draftId: string; wordLimit: number | null }) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [content, setContent] = useState("");
  const [baseVersion, setBaseVersion] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [language, setLanguage] = useState("fr");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "stale">("idle");
  const [generating, setGenerating] = useState(false);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [aiOff, setAiOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/drafts/${draftId}`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      content_md?: string;
      base_version_id?: string | null;
      versions?: VersionRow[];
      draft?: { language?: string };
    };
    setContent(body.content_md ?? "");
    setBaseVersion(body.base_version_id ?? null);
    setVersions(body.versions ?? []);
    setLanguage(body.draft?.language ?? "fr");
    setLoaded(true);
  }, [draftId]);

  useEffect(() => {
    void load();
  }, [load]);

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const overLimit = wordLimit !== null && words > wordLimit;

  function scheduleSave(next: string) {
    if (timer.current) clearTimeout(timer.current);
    setSaveState("idle");
    timer.current = setTimeout(() => void save(next), 1200);
  }

  async function save(next: string) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content_md: next, base_version_id: baseVersion ?? undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        version_id?: string;
        version_no?: number;
        word_count?: number;
        detail?: string; message?: string;
      };
      if (res.status === 409) {
        setSaveState("stale");
        return;
      }
      if (!res.ok) throw new Error(body.detail || "error");
      setBaseVersion(body.version_id ?? null);
      setSaveState("saved");
      setVersions((v) => [
        {
          id: body.version_id ?? "",
          version_no: body.version_no ?? v.length + 1,
          word_count: body.word_count ?? null,
          source: "user",
          created_at: new Date().toISOString(),
        },
        ...v,
      ]);
    } catch {
      setSaveState("idle");
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setOutline(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/generate`, { method: "POST" });
      if (!res.body) throw new Error("error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const chunk of events) {
          const evMatch = chunk.match(/^event: (.+)$/m);
          const dataMatch = chunk.match(/^data: (.+)$/m);
          if (!evMatch || !dataMatch || !evMatch[1] || !dataMatch[1]) continue;
          const eventName = evMatch[1];
          const data = JSON.parse(dataMatch[1]) as Record<string, unknown>;
          if (eventName === "outline") setOutline(data as Outline);
          if (eventName === "error") {
            if (data.code === "ai_unavailable") setAiOff(true);
            else setError(String(data.code ?? "error"));
          }
          if (eventName === "done") {
            await load();
            router.refresh();
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function restore(versionNo: number) {
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/restore/${versionNo}`, { method: "POST" });
      if (!res.ok) throw new Error("error");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!loaded) {
    return <Card className="p-5">{t("common.loading")}</Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-3 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold">{t("writing.editor")}</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {t("writing.wordCount", { n: words })}
            {wordLimit !== null && ` / ${wordLimit}`}
          </span>
          {overLimit && <span className="text-xs font-medium text-[var(--danger)]">⚠</span>}
          <span className="ms-auto text-xs text-[var(--text-faint)]" role="status">
            {saveState === "saving" && t("common.loading")}
            {saveState === "saved" && t("writing.autosaved")}
            {saveState === "stale" && <span className="text-[var(--danger)]">{t("writing.stale")}</span>}
          </span>
        </div>

        <textarea
          dir={language === "ar" ? "rtl" : "ltr"}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleSave(e.target.value);
          }}
          rows={22}
          aria-label={t("writing.editor")}
          className={cx(
            "w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4 text-sm leading-relaxed",
            "focus:border-[var(--brand)] focus:outline-none",
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="h-4 w-4" aria-hidden="true" />
            )}
            {generating ? t("writing.generating") : t("writing.generate")}
          </Button>
          <AIDisclosure />
        </div>

        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {aiOff && <AIOffBanner body={t("writing.aiOff")} />}
      </div>

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[var(--text-faint)]" aria-hidden="true" />
            {t("writing.outline")}
          </h3>
          {outline ? (
            <div className="flex flex-col gap-3 text-sm">
              {(outline.sections ?? []).map((s, i) => (
                <div key={i}>
                  <p className="font-medium">{s.heading}</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--text-muted)]">
                    {(s.points ?? []).map((p, j) => (
                      <li key={j}>· {p}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {(outline.missing_facts ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--warning)]">{t("writing.missingFacts")}</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--text-muted)]">
                    {outline.missing_facts?.map((m, i) => (
                      <li key={i}>· {m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">{t("common.none")}</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-[var(--text-faint)]" aria-hidden="true" />
            {t("writing.versions")}
          </h3>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-[var(--text-muted)]">
                  v{v.version_no} · {v.word_count ?? 0} · {v.source}
                  <span className="block text-xs text-[var(--text-faint)]">
                    {formatDate(v.created_at ? v.created_at.slice(0, 10) : null)}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => restore(v.version_no)}>
                  {t("writing.restore")}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
