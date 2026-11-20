"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { CompletenessBar } from "@/components/domain";

type LangEntry = { lang: string; level: string | null };
type ExpEntry = { type: string; title: string | null; org: string | null; start: string | null; end: string | null };

type Initial = {
  fullNameLatin: string | null;
  fullNameArabic: string | null;
  birthDate: string | null;
  nationality: string | null;
  wilaya: string | null;
  currentLevel: string | null;
  currentYear: number | null;
  institution: string | null;
  faculty: string | null;
  fieldOfStudy: string | null;
  expectedGraduation: string | null;
  gpa20: number | null;
  gpaRankPercent: number | null;
  honors: string | null;
  languages: LangEntry[];
  experiences: ExpEntry[];
  skills: string[];
  targetLevel: string | null;
  targetFields: string[];
  targetCountries: string[];
  needsFullFunding: boolean | null;
  targetIntake: string | null;
  budgetMonthlyDzd: number | null;
};

const EXP_TYPES = ["job", "internship", "research", "publication", "volunteer", "other"] as const;
const LEVELS = ["bac", "licence", "master", "doctorate", "other"] as const;
const TARGET_LEVELS = [...LEVELS, "phd_internship"] as const;

/**
 * Full profile form (spec F3). Saves through PUT /api/profile with the exact
 * camelCase contract; confirm runs the server's required-field validation and
 * reports what is still missing instead of guessing.
 */
export function ProfileForm({ initial, completeness, confirmed }: { initial: Initial; completeness: number; confirmed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();

  const [f, setF] = useState<Initial>(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(confirmed);

  const set = <K extends keyof Initial>(key: K, value: Initial[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save(): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        fullNameLatin: f.fullNameLatin,
        fullNameArabic: f.fullNameArabic,
        birthDate: f.birthDate,
        nationality: f.nationality,
        wilaya: f.wilaya,
        currentLevel: f.currentLevel,
        currentYear: f.currentYear,
        institution: f.institution,
        faculty: f.faculty,
        fieldOfStudy: f.fieldOfStudy,
        expectedGraduation: f.expectedGraduation,
        gpa20: f.gpa20,
        gpaRankPercent: f.gpaRankPercent,
        honors: f.honors,
        languages: f.languages,
        experiences: f.experiences,
        skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
        targetLevel: f.targetLevel,
        targetFields: f.targetFields,
        targetCountries: f.targetCountries,
        needsFullFunding: f.needsFullFunding,
        targetIntake: f.targetIntake,
        budgetMonthlyDzd: f.budgetMonthlyDzd,
      };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        detail?: string; message?: string;
        completeness?: number;
        missing_for_confirm?: string[];
      };
      if (!res.ok) throw new Error(body.detail || "error");
      setMissing(body.missing_for_confirm ?? []);
      setMessage({ kind: "ok", text: t("common.saved") });
      return true;
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!(await save())) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/confirm", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        detail?: string; message?: string;
        errors?: { path: string }[];
      };
      if (!res.ok) {
        setMissing((body.errors ?? []).map((x) => x.path));
        throw new Error(body.detail || t("profile.missing"));
      }
      setIsConfirmed(true);
      setMessage({ kind: "ok", text: t("profile.confirmed") });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-md">
        <CompletenessBar value={completeness} />
      </div>

      {message && (
        <p
          role="status"
          className={
            message.kind === "ok"
              ? "rounded-[var(--radius)] border border-[var(--success)] bg-[var(--success)]/10 px-4 py-2.5 text-sm"
              : "rounded-[var(--radius)] border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2.5 text-sm"
          }
        >
          {message.text}
        </p>
      )}
      {missing.length > 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          {t("profile.missing")}: <bdi>{missing.join(", ")}</bdi>
        </p>
      )}

      <Section title={t("profile.identity")}>
        <Field label={t("profile.fullNameLatin")} htmlFor="fullNameLatin">
          <Input id="fullNameLatin" value={f.fullNameLatin ?? ""} onChange={(e) => set("fullNameLatin", e.target.value)} />
        </Field>
        <Field label={t("profile.fullNameArabic")} htmlFor="fullNameArabic">
          <Input id="fullNameArabic" dir="rtl" value={f.fullNameArabic ?? ""} onChange={(e) => set("fullNameArabic", e.target.value)} />
        </Field>
        <Field label={t("profile.birthDate")} htmlFor="birthDate">
          <Input id="birthDate" type="date" value={f.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value || null)} />
        </Field>
        <Field label={t("profile.nationality")} htmlFor="nationality">
          <Input id="nationality" value={f.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} />
        </Field>
        <Field label={t("profile.wilaya")} htmlFor="wilaya">
          <Input id="wilaya" value={f.wilaya ?? ""} onChange={(e) => set("wilaya", e.target.value)} />
        </Field>
      </Section>

      <Section title={t("profile.academics")}>
        <Field label={t("profile.currentLevel")} htmlFor="currentLevel">
          <select
            id="currentLevel"
            value={f.currentLevel ?? ""}
            onChange={(e) => set("currentLevel", e.target.value || null)}
            className="h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
          >
            <option value="">{t("common.none")}</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label={t("profile.currentYear")} htmlFor="currentYear">
          <Input id="currentYear" type="number" min={1} max={8} value={f.currentYear ?? ""} onChange={(e) => set("currentYear", e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label={t("profile.institution")} htmlFor="institution">
          <Input id="institution" value={f.institution ?? ""} onChange={(e) => set("institution", e.target.value)} />
        </Field>
        <Field label={t("profile.faculty")} htmlFor="faculty">
          <Input id="faculty" value={f.faculty ?? ""} onChange={(e) => set("faculty", e.target.value)} />
        </Field>
        <Field label={t("profile.fieldOfStudy")} htmlFor="fieldOfStudy">
          <Input id="fieldOfStudy" value={f.fieldOfStudy ?? ""} onChange={(e) => set("fieldOfStudy", e.target.value)} />
        </Field>
        <Field label={t("profile.expectedGraduation")} htmlFor="expectedGraduation">
          <Input id="expectedGraduation" type="date" value={f.expectedGraduation ?? ""} onChange={(e) => set("expectedGraduation", e.target.value || null)} />
        </Field>
        <Field label={t("profile.gpa20")} htmlFor="gpa20" hint={t("profile.gradesDisclaimer")}>
          <Input id="gpa20" type="number" step="0.01" min={0} max={20} value={f.gpa20 ?? ""} onChange={(e) => set("gpa20", num(e.target.value))} />
        </Field>
        <Field label={t("profile.gpaRankPercent")} htmlFor="gpaRankPercent">
          <Input id="gpaRankPercent" type="number" step="0.01" min={0} max={100} value={f.gpaRankPercent ?? ""} onChange={(e) => set("gpaRankPercent", num(e.target.value))} />
        </Field>
        <Field label={t("profile.honors")} htmlFor="honors">
          <Input id="honors" value={f.honors ?? ""} onChange={(e) => set("honors", e.target.value)} />
        </Field>
      </Section>

      <Section title={t("profile.languages")}>
        <div className="flex flex-col gap-3">
          {f.languages.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={t("common.language")} htmlFor={`lang-${i}`}>
                <Input id={`lang-${i}`} value={l.lang} onChange={(e) => set("languages", f.languages.map((x, j) => (j === i ? { ...x, lang: e.target.value } : x)))} />
              </Field>
              <Field label={t("common.status")} htmlFor={`lvl-${i}`}>
                <Input id={`lvl-${i}`} value={l.level ?? ""} onChange={(e) => set("languages", f.languages.map((x, j) => (j === i ? { ...x, level: e.target.value || null } : x)))} />
              </Field>
              <Button variant="ghost" size="sm" onClick={() => set("languages", f.languages.filter((_, j) => j !== i))} aria-label={t("common.remove")}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => set("languages", [...f.languages, { lang: "", level: null }])}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("profile.addLanguage")}
        </Button>
      </Section>

      <Section title={t("profile.experience")}>
        <div className="flex flex-col gap-4">
          {f.experiences.map((x, i) => (
            <div key={i} className="grid gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3 sm:grid-cols-2">
              <Field label={t("common.status")} htmlFor={`exp-type-${i}`}>
                <select
                  id={`exp-type-${i}`}
                  value={x.type}
                  onChange={(e) => set("experiences", f.experiences.map((y, j) => (j === i ? { ...y, type: e.target.value } : y)))}
                  className="h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
                >
                  {EXP_TYPES.map((ty) => (
                    <option key={ty} value={ty}>{ty}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("common.edit")} htmlFor={`exp-title-${i}`}>
                <Input id={`exp-title-${i}`} value={x.title ?? ""} onChange={(e) => set("experiences", f.experiences.map((y, j) => (j === i ? { ...y, title: e.target.value || null } : y)))} />
              </Field>
              <Field label={t("profile.institution")} htmlFor={`exp-org-${i}`}>
                <Input id={`exp-org-${i}`} value={x.org ?? ""} onChange={(e) => set("experiences", f.experiences.map((y, j) => (j === i ? { ...y, org: e.target.value || null } : y)))} />
              </Field>
              <div className="flex items-end gap-2">
                <Field label="Start" htmlFor={`exp-start-${i}`}>
                  <Input id={`exp-start-${i}`} placeholder="2023" value={x.start ?? ""} onChange={(e) => set("experiences", f.experiences.map((y, j) => (j === i ? { ...y, start: e.target.value || null } : y)))} />
                </Field>
                <Field label="End" htmlFor={`exp-end-${i}`}>
                  <Input id={`exp-end-${i}`} placeholder="2025" value={x.end ?? ""} onChange={(e) => set("experiences", f.experiences.map((y, j) => (j === i ? { ...y, end: e.target.value || null } : y)))} />
                </Field>
                <Button variant="ghost" size="sm" onClick={() => set("experiences", f.experiences.filter((_, j) => j !== i))} aria-label={t("common.remove")}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => set("experiences", [...f.experiences, { type: "internship", title: null, org: null, start: null, end: null }])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("profile.addExperience")}
        </Button>
      </Section>

      <Section title={t("profile.skills")}>
        <Field label={t("profile.addSkill")} htmlFor="skills" hint="csv">
          <Textarea id="skills" rows={2} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
        </Field>
      </Section>

      <Section title={t("profile.goals")}>
        <Field label={t("profile.targetLevel")} htmlFor="targetLevel">
          <select
            id="targetLevel"
            value={f.targetLevel ?? ""}
            onChange={(e) => set("targetLevel", e.target.value || null)}
            className="h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
          >
            <option value="">{t("common.none")}</option>
            {TARGET_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label={t("profile.targetCountries")} htmlFor="targetCountries" hint="FR, DE, CA">
          <Input
            id="targetCountries"
            value={f.targetCountries.join(", ")}
            onChange={(e) => set("targetCountries", e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))}
          />
        </Field>
        <Field label={t("profile.targetFields")} htmlFor="targetFields" hint="csv">
          <Input
            id="targetFields"
            value={f.targetFields.join(", ")}
            onChange={(e) => set("targetFields", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          />
        </Field>
        <Field label={t("profile.targetIntake")} htmlFor="targetIntake">
          <Input id="targetIntake" placeholder="2027-fall" value={f.targetIntake ?? ""} onChange={(e) => set("targetIntake", e.target.value || null)} />
        </Field>
        <Field label={t("profile.budgetMonthlyDzd")} htmlFor="budget">
          <Input id="budget" type="number" min={0} value={f.budgetMonthlyDzd ?? ""} onChange={(e) => set("budgetMonthlyDzd", num(e.target.value))} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={f.needsFullFunding === true}
            onChange={(e) => set("needsFullFunding", e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          {t("profile.needsFullFunding")}
        </label>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("common.save")}
        </Button>
        {isConfirmed ? (
          <span className="inline-flex items-center gap-2 text-sm text-[var(--success)]">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            {t("profile.confirmed")}
          </span>
        ) : (
          <Button variant="secondary" onClick={confirm} disabled={busy}>
            {t("profile.confirmProfile")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}
