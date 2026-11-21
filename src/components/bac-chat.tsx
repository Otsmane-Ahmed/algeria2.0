"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Pencil, Send, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Input, cx } from "@/components/ui";
import {
  STREAMS,
  WILAYA_NAMES,
  WORK_STYLE_OPTIONS,
  bacCompleteness,
} from "@/lib/core/orientation/chat";
import type { BacProfileData } from "@/lib/core/orientation/types";

/**
 * Mode A intake chatbot (§7.1): full-page guided conversation with a live
 * "What I know about you" card. No file upload, no attachment button —
 * everything is typed or tapped. The AI only extracts interest tags from
 * free text; every mark is typed by the student (the engine never invents one).
 */

type Msg = {
  id: number;
  from: "bot" | "user";
  key: string; // i18n key or literal text (prefixed "raw:")
  vars?: Record<string, string | number>;
};

type Chip = { label: string; value: string; kind?: "estimate" };

interface TurnSpec {
  id: string;
  botKey: string;
  input:
    | { kind: "chips"; chips: (k: (key: string) => string) => Chip[] }
    | { kind: "number" }
    | { kind: "text"; datalist?: string[]; placeholder?: string }
    | { kind: "textarea" }
    | { kind: "tags" }
    | { kind: "confirm" };
  skippable: boolean;
  /** Which live-card fields to highlight for this turn. */
  fields: (keyof BacProfileData | "constraints.distance" | "constraints.housing" | "constraints.language" | "constraints.institution" | "constraints.budget" | "streamOption" | "bacYear")[];
}

const TURN_ORDER: TurnSpec[] = [
  { id: "greeting", botKey: "chat.bot.greeting", skippable: false, fields: [], input: { kind: "chips", chips: (t) => [{ label: t("chat.chip.start"), value: "start" }, { label: t("chat.chip.howItWorks"), value: "how" }] } },
  { id: "stream", botKey: "chat.bot.stream", skippable: false, fields: ["stream"], input: { kind: "chips", chips: (t) => STREAMS.map((s) => ({ label: t(`chat.stream.${s}`), value: s })) } },
  { id: "average", botKey: "chat.bot.average", skippable: false, fields: ["bacAverage"], input: { kind: "number" } },
  { id: "bac_year", botKey: "chat.bot.year", skippable: true, fields: ["bacYear"], input: { kind: "chips", chips: (t) => [{ label: t("chat.chip.thisYear"), value: "2026" }, { label: t("chat.chip.lastYear"), value: "2025" }, { label: t("chat.chip.twoYears"), value: "2024" }, { label: t("chat.chip.earlier"), value: "2023" }] } },
  { id: "wilaya", botKey: "chat.bot.wilaya", skippable: true, fields: ["homeWilaya"], input: { kind: "text", datalist: WILAYA_NAMES } },
  { id: "interests", botKey: "chat.bot.interests", skippable: true, fields: ["interests"], input: { kind: "textarea" } },
  { id: "work_style", botKey: "chat.bot.workStyle", skippable: true, fields: ["workStyle"], input: { kind: "chips", chips: (t) => WORK_STYLE_OPTIONS.map((w) => ({ label: t(`chat.work.${w}`), value: w })) } },
  { id: "practicality", botKey: "chat.bot.practicality", skippable: true, fields: ["practicality"], input: { kind: "chips", chips: (t) => [{ label: t("chat.chip.practical"), value: "practical" }, { label: t("chat.chip.theoretical"), value: "theoretical" }, { label: t("chat.chip.unsure"), value: "unsure" }] } },
  { id: "study_length", botKey: "chat.bot.studyLength", skippable: true, fields: ["studyLengthPref"], input: { kind: "chips", chips: (t) => [{ label: "3", value: "3" }, { label: "5", value: "5" }, { label: "5+", value: "5+" }, { label: t("chat.chip.unsure"), value: "unsure" }] } },
  { id: "constraints.distance", botKey: "chat.bot.distance", skippable: true, fields: ["constraints.distance"], input: { kind: "chips", chips: (t) => [{ label: t("chat.distance.myWilaya"), value: "my_wilaya" }, { label: t("chat.distance.nearby"), value: "nearby" }, { label: t("chat.distance.anywhere"), value: "anywhere" }] } },
  { id: "constraints.budget", botKey: "chat.bot.budget", skippable: true, fields: ["constraints.budget"], input: { kind: "chips", chips: (t) => [{ label: "0–8 000 DZD", value: "0-8000" }, { label: "8 000–20 000 DZD", value: "8000-20000" }, { label: "20 000–40 000 DZD", value: "20000-40000" }, { label: "+40 000 DZD", value: "40000+" }, { label: t("chat.chip.freeOnly"), value: "free_only" }] } },
  { id: "constraints.housing", botKey: "chat.bot.housing", skippable: true, fields: ["constraints.housing"], input: { kind: "chips", chips: (t) => [{ label: t("chat.housing.university"), value: "university" }, { label: t("chat.housing.own"), value: "own" }] } },
  { id: "constraints.institution", botKey: "chat.bot.institution", skippable: true, fields: ["constraints.institution"], input: { kind: "chips", chips: (t) => [{ label: t("chat.institution.public"), value: "public" }, { label: t("chat.institution.private"), value: "private" }, { label: t("chat.institution.both"), value: "both" }] } },
  { id: "constraints.language", botKey: "chat.bot.language", skippable: true, fields: ["constraints.language"], input: { kind: "chips", chips: (t) => [{ label: "العربية", value: "ar" }, { label: "Français", value: "fr" }, { label: "English", value: "en" }, { label: t("chat.chip.any"), value: "any" }] } },
  { id: "wishes", botKey: "chat.bot.wishes", skippable: true, fields: ["draftWishes"], input: { kind: "chips", chips: (t) => [{ label: t("chat.chip.wishesYes"), value: "yes" }, { label: t("chat.chip.wishesNotYet"), value: "not_yet" }] } },
  { id: "abroad", botKey: "chat.bot.abroad", skippable: true, fields: ["abroadOpenness"], input: { kind: "chips", chips: (t) => [{ label: t("chat.chip.yes"), value: "yes" }, { label: t("chat.chip.maybeLater"), value: "maybe_later" }, { label: t("chat.chip.no"), value: "no" }] } },
  { id: "confirm", botKey: "chat.bot.confirmIntro", skippable: false, fields: [], input: { kind: "confirm" } },
];

const STAGES = [
  { n: 1, key: "chat.stage.bac", turns: ["stream", "average", "bac_year", "wilaya"] },
  { n: 2, key: "chat.stage.interests", turns: ["interests", "work_style", "practicality", "study_length"] },
  { n: 3, key: "chat.stage.constraints", turns: ["constraints.distance", "constraints.budget", "constraints.housing", "constraints.institution", "constraints.language"] },
  { n: 4, key: "chat.stage.wishes", turns: ["wishes", "abroad"] },
  { n: 5, key: "chat.stage.confirm", turns: ["confirm"] },
];

export function BacChat({ initialProfile, initialConfirmed }: { initialProfile: BacProfileData | null; initialConfirmed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<BacProfileData | null>(initialProfile);
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [turn, setTurn] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [textValue, setTextValue] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [wishInputMode, setWishInputMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  const push = (from: Msg["from"], key: string, vars?: Record<string, string | number>) =>
    setMsgs((prev) => [...prev, { id: nextId(), from, key, vars }]);

  /** First turn with a missing field, used to resume a saved conversation. */
  function resumeTurn(p: BacProfileData): string {
    for (const spec of TURN_ORDER) {
      if (spec.id === "greeting") continue;
      if (spec.id === "confirm") return "confirm";
      if (!spec.fields.some((f) => fieldValue(p, f) != null && fieldValue(p, f) !== "")) return spec.id;
    }
    return "confirm";
  }

  function fieldValue(p: BacProfileData, f: TurnSpec["fields"][number]): unknown {
    if (f.startsWith("constraints.")) return (p.constraints as Record<string, unknown>)[f.slice(12)];
    return p[f as keyof BacProfileData];
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, turn]);

  useEffect(() => {
    if (!initialProfile) {
      setMsgs([{ id: nextId(), from: "bot", key: "chat.bot.greeting" }]);
      setTurn("greeting");
      return;
    }
    setProfile(initialProfile);
    if (initialConfirmed) {
      setConfirmed(true);
      return;
    }
    const first = resumeTurn(initialProfile);
    setMsgs([
      { id: nextId(), from: "bot", key: "chat.bot.welcomeBack" },
      { id: nextId(), from: "bot", key: turnBotKey(first) },
    ]);
    setTurn(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turnSpec = useMemo(() => TURN_ORDER.find((x) => x.id === turn) ?? null, [turn]);

  function turnBotKey(id: string) {
    return TURN_ORDER.find((x) => x.id === id)?.botKey ?? "chat.bot.greeting";
  }

  async function post(turnId: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bac/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turn: turnId, ...payload }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        applied?: boolean;
        warn?: string;
        next_turn?: string | null;
        profile?: BacProfileData | null;
        error?: { errors?: { message?: string }[] };
      };
      if (!res.ok) {
        const code = body.error?.errors?.[0]?.message ?? "error";
        throw new Error(code);
      }
      if (body.profile) setProfile(body.profile);
      return body;
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function advanceTo(id: string | null | undefined) {
    if (!id) {
      setTurn(null);
      return;
    }
    setTurn(id);
    push("bot", turnBotKey(id));
    const spec = TURN_ORDER.find((x) => x.id === id);
    if (spec?.id === "interests") setTags(profile?.interests ?? []);
    if (spec?.id === "wishes") setWishInputMode(false);
  }

  async function answer(value: unknown, opts?: { echo?: string; freeText?: string }) {
    if (!turn || busy) return;
    const spec = TURN_ORDER.find((x) => x.id === turn)!;
    if (opts?.echo !== undefined) push("user", `raw:${opts.echo}`);
    else if (typeof value === "string" || typeof value === "number") push("user", `raw:${String(value)}`);

    const body = await post(turn, opts?.freeText ? { free_text: opts.freeText } : { value });
    if (!body) return;

    if (turn === "interests" && opts?.freeText) {
      const extracted = (body.profile?.interests ?? []) as string[];
      setTags(extracted);
      push("bot", "chat.bot.tagsFound", { count: extracted.length });
      setTurn("interests"); // stay on the tag-confirmation UI
      return;
    }
    if (turn === "interests" && !opts?.freeText) {
      // Confirmed tags -> save, then continue with the micro-questions.
      advanceTo(body.next_turn);
      return;
    }
    if (body.warn === "estimate_mode") {
      push("bot", "chat.bot.estimatePrompt");
      setTurn("average"); // stay: next send is the estimate
      return;
    }
    // After the real average -> immediately ask the year (same stage).
    if (turn === "average" && !spec.skippable && body.profile?.bacYear == null) {
      advanceTo("bac_year");
      return;
    }
    if (turn === "stream" && value === "other") {
      push("bot", "chat.bot.streamOption");
      setTurn("stream_option");
      return;
    }
    advanceTo(body.next_turn);
  }

  async function sendEstimate(raw: string) {
    if (!turn || busy) return;
    push("user", `raw:${raw}`);
    const body = await post("average", { value: `estimate:${raw}` });
    if (!body) return;
    if (body.profile?.bacYear == null) advanceTo("bac_year");
    else advanceTo(body.next_turn);
  }

  async function confirm() {
    const body = await post("confirm", {});
    if (!body) return;
    setConfirmed(true);
    // "Not yet, suggest some" (§7.2): seed the fiche with the top compatible
    // formations before landing on it. Best-effort — a failed suggestion
    // still lands on the (possibly empty) fiche, never blocks the flow.
    try {
      const res = await fetch("/api/wishes/suggest", { method: "POST" });
      const suggested = res.ok && (await res.json()).seeded > 0;
      router.push(suggested ? "/wishes?suggested=1" : "/wishes");
    } catch {
      router.push("/wishes");
    }
    router.refresh();
  }

  async function updateTags(finalTags: string[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/bac/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turn: "interests", value: finalTags }),
      });
      const body = (await res.json().catch(() => ({}))) as { profile?: BacProfileData | null; next_turn?: string | null };
      if (body.profile) setProfile(body.profile);
      advanceTo(body.next_turn);
    } finally {
      setBusy(false);
    }
  }

  const completeness = profile ? bacCompleteness(profile) : 0;

  // ------- completed read-only state (§7.1.4) -------
  if (confirmed) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-6">
          <p className="eyebrow flex items-center gap-2 text-[var(--text-faint)]">
            <span className="eyebrow-dot" aria-hidden="true" />
            {t("chat.completedEyebrow")}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-normal">{t("chat.completedTitle")}</h1>
          <SummaryCard profile={profile} t={t} onEdit={() => { setConfirmed(false); setMsgs([{ id: nextId(), from: "bot", key: "chat.bot.welcomeBack" }]); setTurn("wilaya"); push("bot", "chat.bot.wilaya"); }} />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.push("/wishes")}>{t("chat.goWishes")}</Button>
            <Button size="sm" variant="outline" onClick={() => router.push("/matches")}>{t("chat.goMatches")}</Button>
          </div>
        </Card>
      </div>
    );
  }

  const stageDone = (stage: (typeof STAGES)[number]) =>
    stage.turns.every((id) => {
      const spec = TURN_ORDER.find((x) => x.id === id);
      if (!spec) return true;
      if (spec.skippable) {
        const anyFilled = spec.fields.some((f) => {
          const v = profile ? fieldValue(profile, f) : null;
          return v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
        });
        // visited = the turn is before or equal to current position
        return true;
      }
      const v = profile ? spec.fields.some((f) => {
        const x = fieldValue(profile, f);
        return x != null && x !== "";
      }) : false;
      return v;
    });
  const currentStageN = (() => {
    for (const s of STAGES) if (s.turns.includes(turn ?? "")) return s.n;
    return 0;
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* ------- chat column (§7.1.1, ~65%) ------- */}
      <Card className="flex min-h-[70vh] flex-col p-0">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft)]">
              <Sparkles className="h-4 w-4 text-[var(--brand-strong)]" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium">Nava</p>
              <p className="text-xs text-[var(--text-faint)]">{t("chat.subtitle")}</p>
            </div>
          </div>
          <ol className="hidden items-center gap-1.5 text-[11px] text-[var(--text-faint)] sm:flex" aria-label={t("chat.stageLabel")}>
            {STAGES.map((s) => (
              <li
                key={s.n}
                className={cx(
                  "rounded-full px-2 py-0.5",
                  s.n === currentStageN && "bg-[var(--brand-soft)] font-medium text-[var(--brand-strong)]",
                  s.n < currentStageN && "text-[var(--brand-strong)]",
                )}
              >
                {s.n}. {t(s.key)}
              </li>
            ))}
          </ol>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
          {msgs.map((m) => (
            <Bubble key={m.id} msg={m} t={t} />
          ))}

          {/* interests: extracted tag confirmation */}
          {turn === "interests" && tags.length > 0 && msgs.some((m) => m.key === "chat.bot.tagsFound") && (
            <div className="flex flex-wrap gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3">
              {tags.map((tag, i) => (
                <button
                  key={`${tag}-${i}`}
                  type="button"
                  onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium hover:border-[var(--brand)]"
                >
                  {tag}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const v = [...tags, textValue.trim()].filter(Boolean).slice(0, 12);
                  void updateTags(v);
                }}
                className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--brand)]"
              >
                + {t("chat.addTag")}
              </button>
              <Button size="sm" disabled={busy} onClick={() => updateTags(tags)}>
                {t("chat.confirmTags")}
              </Button>
              <span className="sr-only">{t("chat.aiSuggested")}</span>
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--danger)]" role="alert">
              {t(`chat.error.${error}`) !== `chat.error.${error}` ? t(`chat.error.${error}`) : t("chat.error.generic")}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ------- input area per current turn ------- */}
        <div className="border-t border-[var(--border)] px-5 py-4">
          {busy && (
            <p className="mb-2 flex items-center gap-2 text-xs text-[var(--text-faint)]">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t("chat.thinking")}
            </p>
          )}
          {!turnSpec && (
            <p className="text-sm text-[var(--text-muted)]">{t("chat.doneNote")}</p>
          )}
          {turnSpec?.input.kind === "chips" && turn !== "interests" && !busy && (
            <div className="flex flex-wrap gap-2">
              {turnSpec.input.chips(t).map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  disabled={busy}
                  onClick={() => answer(chip.value, { echo: chip.label })}
                  className="rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
          {(turnSpec?.input.kind === "number" || turnSpec?.input.kind === "text" || turnSpec?.input.kind === "textarea") && !busy && (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = textValue.trim();
                if (!v) return;
                setTextValue("");
                const isTextInput = turnSpec.input.kind === "text" || turnSpec.input.kind === "textarea";
                if (turn === "average" && profile?.averageIsEstimate && profile.bacAverage == null) {
                  void sendEstimate(v);
                } else if (turn === "interests" && isTextInput) {
                  void answer(undefined, { freeText: v, echo: v });
                } else if (turn === "wishes" && wishInputMode) {
                  void answer(v.split(/[,;\n]/).map((s) => s.trim().replace(/^\d+[.)]?\s*/, "")).filter(Boolean), { echo: v });
                  setWishInputMode(false);
                } else {
                  void answer(v, { echo: v });
                }
              }}
            >
              {turnSpec.input.kind === "textarea" ? (
                <textarea
                  className="min-h-20 w-full resize-none rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none"
                  placeholder={t("chat.ph.interests")}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  dir="auto"
                  aria-label={t("chat.inputLabel")}
                />
              ) : (
                <>
                  <Input
                    type={turnSpec.input.kind === "number" ? "text" : "text"}
                    inputMode={turnSpec.input.kind === "number" ? "decimal" : undefined}
                    list={turnSpec.input.kind === "text" && turnSpec.input.datalist ? "wilaya-list" : undefined}
                    className="flex-1"
                    dir="auto"
                    placeholder={
                      turn === "average"
                        ? t("chat.ph.average")
                        : turn === "wilaya"
                          ? t("chat.ph.wilaya")
                          : t("chat.ph.text")
                    }
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    aria-label={t("chat.inputLabel")}
                  />
                  {turnSpec.input.kind === "text" && turnSpec.input.datalist && (
                    <datalist id="wilaya-list">
                      {turnSpec.input.datalist.map((w: string) => (
                        <option key={w} value={w} />
                      ))}
                    </datalist>
                  )}
                </>
              )}
              <Button type="submit" disabled={busy || !textValue.trim()} size="sm" className="h-11">
                <Send className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                <span className="sr-only">{t("chat.send")}</span>
              </Button>
            </form>
          )}
          {turnSpec?.id === "wishes" && wishInputMode && !busy && (
            <form
              className="mt-2 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = textValue.trim();
                if (!v) return;
                setTextValue("");
                void answer(v.split(/[,;\n]/).map((s) => s.trim().replace(/^\d+[.)]?\s*/, "")).filter(Boolean), { echo: v });
                setWishInputMode(false);
              }}
            >
              <textarea
                className="min-h-20 flex-1 resize-none rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none"
                placeholder={t("chat.ph.wishes")}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                dir="auto"
                aria-label={t("chat.ph.wishes")}
              />
              <Button type="submit" size="sm" className="h-11" disabled={busy || !textValue.trim()}>
                <Send className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                <span className="sr-only">{t("chat.send")}</span>
              </Button>
            </form>
          )}
          {turnSpec?.id === "confirm" && !busy && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={confirm} size="sm">
                <Check className="h-4 w-4" aria-hidden="true" />
                {t("chat.confirmCta")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const firstIncomplete = resumeTurn(profile ?? {
                    stream: null, streamOption: null, bacAverage: null, averageIsEstimate: false,
                    bacYear: null, homeWilaya: null, interests: [], workStyle: null, practicality: null,
                    studyLengthPref: null, constraints: {}, draftWishes: [], abroadOpenness: null,
                  });
                  setTurn(firstIncomplete === "confirm" ? "stream" : firstIncomplete);
                  push("bot", turnBotKey(firstIncomplete === "confirm" ? "stream" : firstIncomplete));
                }}
              >
                {t("chat.editSomething")}
              </Button>
            </div>
          )}
          {turnSpec?.skippable && turnSpec.input.kind !== "chips" && !busy && turn !== "interests" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(null, { echo: t("chat.chip.skip") })}
              className="mt-2 text-xs font-medium text-[var(--text-faint)] underline hover:text-[var(--text-muted)]"
            >
              {t("chat.chip.skip")}
            </button>
          )}
          {turnSpec?.skippable && turnSpec.input.kind === "chips" && turn !== "confirm" && !busy && (
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(null, { echo: t("chat.chip.skip") })}
              className="mt-2 text-xs font-medium text-[var(--text-faint)] underline hover:text-[var(--text-muted)]"
            >
              {t("chat.chip.skip")}
            </button>
          )}
        </div>
      </Card>

      {/* ------- live card (§7.1.1, ~35%) ------- */}
      <LiveCard profile={profile} completeness={completeness} t={t} onEdit={(turnId) => {
        if (confirmed) return;
        setTurn(turnId);
        push("bot", turnBotKey(turnId));
      }} />
    </div>
  );
}

function Bubble({ msg, t }: { msg: Msg; t: (k: string, v?: Record<string, string | number>) => string }) {
  const text = msg.key.startsWith("raw:") ? msg.key.slice(4) : t(msg.key, msg.vars);
  return (
    <div className={cx("flex", msg.from === "user" ? "justify-end" : "justify-start")}>
      <p
        className={cx(
          "max-w-[85%] rounded-[var(--radius)] px-3.5 py-2.5 text-sm leading-relaxed",
          msg.from === "bot"
            ? "bg-[var(--surface-sunken)] text-[var(--text)]"
            : "bg-[var(--brand)] text-white",
        )}
      >
        {text}
      </p>
    </div>
  );
}

const CARD_FIELDS: { key: keyof BacProfileData | "constraints.distance" | "constraints.housing" | "constraints.language" | "constraints.institution" | "constraints.budget" | "streamOption" | "bacYear"; label: string }[] = [
  { key: "stream", label: "chat.field.stream" },
  { key: "bacAverage", label: "chat.field.average" },
  { key: "bacYear", label: "chat.field.year" },
  { key: "homeWilaya", label: "chat.field.wilaya" },
  { key: "interests", label: "chat.field.interests" },
  { key: "constraints.distance", label: "chat.field.distance" },
  { key: "constraints.budget", label: "chat.field.budget" },
  { key: "draftWishes", label: "chat.field.wishes" },
  { key: "abroadOpenness", label: "chat.field.abroad" },
];

const TURN_FOR_FIELD: Record<string, string> = {
  stream: "stream",
  streamOption: "stream_option",
  bacAverage: "average",
  bacYear: "bac_year",
  homeWilaya: "wilaya",
  interests: "interests",
  workStyle: "work_style",
  practicality: "practicality",
  studyLengthPref: "study_length",
  "constraints.distance": "constraints.distance",
  "constraints.housing": "constraints.housing",
  "constraints.language": "constraints.language",
  "constraints.institution": "constraints.institution",
  "constraints.budget": "constraints.budget",
  draftWishes: "wishes",
  abroadOpenness: "abroad",
};

function fieldValueFor(p: BacProfileData | null, key: string): string | null {
  if (!p) return null;
  if (key.startsWith("constraints.")) {
    const v = (p.constraints as Record<string, unknown>)[key.slice(12)];
    return v == null || v === "" ? null : String(v);
  }
  const v = p[key as keyof BacProfileData];
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  return String(v);
}

function LiveCard({
  profile,
  completeness,
  t,
  onEdit,
}: {
  profile: BacProfileData | null;
  completeness: number;
  t: (k: string, v?: Record<string, string | number>) => string;
  onEdit: (turnId: string) => void;
}) {
  return (
    <Card className="h-fit p-5 lg:sticky lg:top-24">
      <p className="eyebrow flex items-center gap-2 text-[var(--text-faint)]">
        <span className="eyebrow-dot" aria-hidden="true" />
        {t("chat.liveCard")}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("chat.completeness")}
          className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
        >
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-all"
            style={{ width: `${completeness}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">{completeness}%</span>
      </div>
      <dl className="mt-4 space-y-2.5">
        {CARD_FIELDS.map(({ key, label }) => {
          const v = fieldValueFor(profile, key);
          const turnId = TURN_FOR_FIELD[key];
          return (
            <div key={key} className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2 last:border-0">
              <dt className="text-xs text-[var(--text-faint)]">{t(label)}</dt>
              <dd className="flex items-start gap-1.5 text-right text-xs font-medium">
                <span className={cx(!v && "text-[var(--text-faint)] font-normal")}>
                  {v
                    ? key === "bacAverage" && profile?.averageIsEstimate
                      ? `${v} (${t("chat.estimate")})`
                      : tValue(key, v, t)
                    : t("chat.notYet")}
                </span>
                {turnId && (
                  <button
                    type="button"
                    onClick={() => onEdit(turnId)}
                    className="rounded p-0.5 text-[var(--text-faint)] hover:text-[var(--brand-strong)]"
                    aria-label={`${t("chat.edit")} ${t(label)}`}
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

function tValue(key: string, v: string, t: (k: string) => string): string {
  if (key === "stream") return t(`chat.stream.${v}`);
  if (key === "abroadOpenness") return t(`chat.open.${v}`);
  if (key === "constraints.distance") return t(`chat.distance.${v === "my_wilaya" ? "myWilaya" : v === "nearby" ? "nearby" : "anywhere"}`);
  if (key === "constraints.housing") return t(`chat.housing.${v}`);
  return v;
}

function summaryValue(key: string, v: string | null, t: (k: string) => string): string {
  if (v == null) return t("chat.notYet");
  if (key === "stream") return t(`chat.stream.${v}`);
  if (key === "abroadOpenness") return t(`chat.open.${v}`);
  return v;
}

function SummaryCard({
  profile,
  t,
  onEdit,
}: {
  profile: BacProfileData | null;
  t: (k: string, v?: Record<string, string | number>) => string;
  onEdit: () => void;
}) {
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {CARD_FIELDS.map(({ key, label }) => (
        <div key={key} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2">
          <dt className="text-[11px] text-[var(--text-faint)]">{t(label)}</dt>
          <dd className="mt-0.5 text-sm font-medium">{summaryValue(key, fieldValueFor(profile, key), t)}</dd>
        </div>
      ))}
      <button type="button" onClick={onEdit} className="text-xs font-medium text-[var(--brand-strong)] underline sm:col-span-2">
        {t("chat.editSomething")}
      </button>
    </dl>
  );
}
