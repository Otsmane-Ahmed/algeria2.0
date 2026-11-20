"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, Globe, LoaderCircle, Target } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Input, cx } from "@/components/ui";
import { EmptyState } from "@/components/domain";
import { flattenExtraction } from "@/lib/core/extraction/flatten";
import type { Locale } from "@/lib/i18n";

const LEVELS = ["bac", "licence", "master", "doctorate", "other"] as const;
const COUNTRIES = ["FR", "DE", "CA", "TR", "IT", "NL", "BE", "CH", "UK", "US", "AE"] as const;

/**
 * Poll the document until ingestion leaves `uploaded`/`processing`, then hand
 * back the read values (null when nothing could be read — the document parks
 * at needs_review and the student fills in manually). Ingestion runs
 * in-process, so first use can take a while (AI call, OCR for scans).
 */
async function waitForExtraction(documentId: string): Promise<Record<string, unknown> | null> {
  // Generous: scans OCR through up to 4 orientations per page, then the text
  // model runs — a multi-page sideways scan can take a couple of minutes.
  const deadline = Date.now() + 150_000;
  for (;;) {
    const res = await fetch(`/api/documents/${documentId}/extraction`).catch(() => null);
    const body = res?.ok
      ? ((await res.json().catch(() => ({}))) as {
          extraction?: { raw?: Record<string, unknown> } | null;
          document_status?: string;
        })
      : null;
    const status = body?.document_status;
    if (!status) return null; // gone or unreachable: let confirm report the gaps
    if (status !== "uploaded" && status !== "processing") return body?.extraction?.raw ?? null;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 2500));
  }
}

/**
 * Three-step onboarding (spec F0/F2): language + consent, goals, transcript
 * upload. Saves only what the API accepts; the confirm call reports which
 * fields are still missing and the wizard links to the full form.
 */
export function OnboardingWizard() {
  const { t } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [who, setWho] = useState<"undecided" | "chosen">("undecided");
  const [consent, setConsent] = useState(false);
  const [level, setLevel] = useState<string>("");
  const [countries, setCountries] = useState<string[]>([]);
  const [fullFunding, setFullFunding] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const toggleCountry = (code: string) =>
    setCountries((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  /** Human label for a missing-field path ("gpa20" or "profile.gpa20"). */
  const labelFor = (path: string) => {
    const leaf = path.split(".").pop() ?? path;
    const label = t(`profile.${leaf}`);
    return label === `profile.${leaf}` ? leaf : label;
  };

  async function call(path: string, init?: RequestInit): Promise<{ ok: boolean; body: Record<string, unknown> }> {
    const res = await fetch(path, init);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = body as { code?: string; detail?: string; message?: string };
      throw new Error(err.detail || err.message || err.code || "error");
    }
    return { ok: true, body };
  }

  /** "Who are you?" (§6.1 #4): sets the mode before the wizard continues.
   *  Mode A goes straight to the intake chatbot — no file upload there. */
  async function chooseMode(mode: "bac" | "abroad") {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      setWho("chosen");
      if (mode === "bac") {
        router.push("/chat");
        router.refresh();
        return;
      }
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveGoals() {
    setBusy(true);
    setError(null);
    try {
      await call("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetLevel: level || null,
          targetCountries: countries,
          needsFullFunding: fullFunding,
        }),
      });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    setMissing([]);
    try {
      let id = docId;
      if (file && !id) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "transcript");
        const res = await fetch("/api/documents", { method: "POST", body: form });
        const body = (await res.json().catch(() => ({}))) as {
          document_id?: string;
          detail?: string;
          code?: string;
        };
        // 409 = this exact file is already uploaded (retry): recover its id so
        // the extraction still lands in the profile instead of stalling at 422.
        if (!res.ok && res.status !== 409) throw new Error(body.detail || body.code || "upload failed");
        if (res.status === 409) {
          const list = (await fetch("/api/documents?kind=transcript").then((r) => r.json().catch(() => null)).catch(() => null)) as
            | { items?: { id: string; filename: string | null }[] }
            | null;
          id = list?.items?.find((d) => d.filename === file.name)?.id ?? null;
        } else {
          id = body.document_id ?? null;
        }
        setDocId(id);
      }

      // Accept the read values into the profile before confirming it — the
      // wizard uploads on the student's behalf, so it does what the review
      // panel does; the extraction stays reviewable under Documents.
      if (id) {
        setHint(t("docs.status.extracted"));
        const values = await waitForExtraction(id);
        setHint(null);
        if (values) {
          await fetch(`/api/documents/${id}/extraction/confirm`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            // The API speaks the flat field names; raw is nested (spec §9.1).
            body: JSON.stringify({ values: flattenExtraction(values), write_profile: true }),
          }).catch(() => undefined);
        }
      }

      const res = await fetch("/api/profile/confirm", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        errors?: { path: string; message: string }[];
        detail?: string;
        code?: string;
      };
      if (!res.ok) {
        // Missing fields are expected when nothing could be read: name them.
        const paths = (body.errors ?? []).map((x) => x.path);
        if (paths.length) setMissing(paths);
        else setError(body.detail || body.code || String(res.status));
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const steps = [t("onboarding.step1"), t("onboarding.step2"), t("onboarding.step3")];

  if (who === "undecided") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <h1 className="font-serif text-2xl font-medium tracking-normal">{t("mode.whoTitle")}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t("mode.whoBody")}</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["bac", "mode.cardBacTitle", "mode.cardBacBody"],
            ["abroad", "mode.cardAbroadTitle", "mode.cardAbroadBody"],
          ] as const).map(([value, title, body]) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => void chooseMode(value)}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-start transition-colors hover:border-[var(--brand)] focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
            >
              <p className="font-serif text-xl font-medium text-[var(--brand-strong)]">{t(title)}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{t(body)}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-faint)]">{t("mode.tryBoth")}</p>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-serif text-2xl font-medium tracking-normal">{t("onboarding.title")}</h1>
        <ol className="mt-4 flex items-center gap-2">
          {steps.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "border-transparent bg-[var(--success)] text-white",
                    active && "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]",
                    !done && !active && "border-[var(--border-strong)] text-[var(--text-faint)]",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : n}
                </span>
                <span className={cx("hidden text-sm sm:block", active ? "font-medium" : "text-[var(--text-muted)]")}>
                  {label}
                </span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </header>

      {step === 1 && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4" aria-hidden="true" />
            {t("common.language")}
          </div>
          <LanguageChoices />
          <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
            />
            <label htmlFor="consent" className="text-sm">
              <span className="font-medium">{t("onboarding.consent")}</span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">{t("onboarding.consentNote")}</span>
            </label>
          </div>
          <Button disabled={!consent} onClick={() => setStep(2)}>
            {t("common.next")}
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4" aria-hidden="true" />
            {t("onboarding.intent")}
          </div>

          <Field label={t("profile.targetLevel")} htmlFor="level">
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
            >
              <option value="">{t("common.none")}</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("onboarding.countries")}</legend>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCountry(c)}
                  aria-pressed={countries.includes(c)}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-sm",
                    countries.includes(c)
                      ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                      : "border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]",
                  )}
                >
                  {c}
                </button>
              ))}
              <span className="self-center text-xs text-[var(--text-faint)]">{t("onboarding.anywhere")}</span>
            </div>
          </fieldset>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={fullFunding}
              onChange={(e) => setFullFunding(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            {t("onboarding.funding")}
          </label>

          {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
              {t("common.back")}
            </Button>
            <Button onClick={saveGoals} disabled={busy}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.next")}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileUp className="h-4 w-4" aria-hidden="true" />
            {t("onboarding.uploadPrompt")}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-6 py-10 text-center hover:border-[var(--brand)]"
          >
            <FileUp className="h-8 w-8 text-[var(--text-faint)]" aria-hidden="true" />
            <span className="text-sm font-medium">
              {file ? file.name : t("onboarding.uploadPrompt")}
            </span>
            <span className="text-xs text-[var(--text-muted)]">{t("onboarding.uploadHint")}</span>
          </button>

          {hint && (
            <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              {hint}
            </p>
          )}

          {missing.length > 0 && (
            <EmptyState
              title={t("profile.missing", { fields: missing.map(labelFor).join(", ") })}
              action={
                <Button variant="secondary" size="sm" onClick={() => router.push("/profile")}>
                  {t("onboarding.manualPath")}
                </Button>
              }
            />
          )}
          {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={busy}>
              {t("common.back")}
            </Button>
            <Button onClick={finish} disabled={busy}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("onboarding.finish")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Locale picker: sets the locale cookie, then reloads unpinned. */
function LanguageChoices() {
  const { locale } = useI18n();
  const router = useRouter();
  const options: { code: Locale; label: string }[] = [
    { code: "fr", label: "Français" },
    { code: "en", label: "English" },
    { code: "ar", label: "العربية" },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Language">
      {options.map((o) => (
        <button
          key={o.code}
          type="button"
          aria-pressed={locale === o.code}
          onClick={() => {
            document.cookie = `safar_locale=${o.code}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
          className={cx(
            "rounded-[var(--radius)] border px-4 py-2 text-sm",
            locale === o.code
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
              : "border-[var(--border-strong)] hover:bg-[var(--surface-raised)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
