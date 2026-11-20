/** Shared domain types. Zod schemas for these live in src/lib/core/schemas. */

export const LOCALES = ["ar", "fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** DB localized JSON column: {en, fr, ar}; fallback locale -> fr -> en (spec §8.1). */
export type Localized = { en?: string | null; fr?: string | null; ar?: string | null };

export const LEVELS = ["bac", "licence", "master", "doctorate", "other"] as const;
export type Level = (typeof LEVELS)[number];

export const TARGET_LEVELS = [
  "licence",
  "master",
  "doctorate",
  "postdoc",
  "exchange",
  "language_course",
  "any",
] as const;
export type TargetLevel = (typeof TARGET_LEVELS)[number];

export const DOC_KINDS = [
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
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_STATUSES = [
  "uploaded",
  "processing",
  "extracted",
  "needs_review",
  "confirmed",
  "failed",
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const CHECKLIST_STATES = [
  "missing",
  "in_progress",
  "have_original",
  "have_certified",
  "have_translated",
  "ready",
] as const;
export type ChecklistState = (typeof CHECKLIST_STATES)[number];

export const TASK_KINDS = [
  "document",
  "procedure",
  "exam",
  "write",
  "review",
  "appointment",
  "submit",
  "custom",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const VERDICTS = ["eligible", "likely", "stretch", "unknown", "ineligible"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type LanguageEntry = {
  lang: string;
  level?: string | null; // CEFR
  cert?: {
    name?: string | null;
    score?: string | null;
    date?: string | null;
    expires?: string | null;
  } | null;
};

export type ExperienceEntry = {
  type: "internship" | "job" | "project" | "volunteering" | "research" | "publication" | "award";
  title?: string | null;
  org?: string | null;
  start?: string | null;
  end?: string | null;
  description?: string | null;
};

export type ProfileData = {
  fullNameLatin: string | null;
  fullNameArabic: string | null;
  birthDate: string | null;
  nationality: string | null;
  gender: string | null;
  wilaya: string | null;
  currentLevel: Level | null;
  currentYear: number | null;
  institution: string | null;
  faculty: string | null;
  fieldOfStudy: string | null;
  fieldFreeText: string | null;
  expectedGraduation: string | null;
  gpa20: number | null;
  gpaRankPercent: number | null;
  honors: string | null;
  languages: LanguageEntry[];
  experiences: ExperienceEntry[];
  skills: string[];
  targetLevel: TargetLevel | null;
  targetFields: string[];
  targetCountries: string[];
  needsFullFunding: boolean | null;
  targetIntake: string | null;
  budgetMonthlyDzd: number | null;
  constraints: { canRelocate?: boolean | null; family?: string | null; health?: string | null };
  completeness: number;
  confirmedAt: string | null;
};

export type Cycle = {
  cycle_id: string;
  opens: string | null;
  deadline: string | null;
  deadline_time?: string | null;
  deadline_tz?: string | null;
  results_expected?: string | null;
  intake?: string | null;
  rolling?: boolean;
  status?: "open" | "upcoming" | "closed" | "unknown";
  source_url?: string | null;
  verified_at?: string | null;
};

export type RequiredDocument = {
  code: string;
  label: Localized;
  mandatory: boolean;
  notes?: string | null;
  procedure_codes?: string[];
  format?: { mime?: string; max_mb?: number } | null;
};

export type LanguageRequirement = {
  lang: string;
  tests?: { name: string; min?: number | null }[];
  cefr_min?: string | null;
  alt?: string | null;
  notes?: string | null;
};

export type Funding = {
  tuition?: "full" | "partial" | "none" | null;
  stipend_monthly?: { amount: number; currency: string } | null;
  travel?: boolean | null;
  insurance?: boolean | null;
  notes?: string | null;
};

/** The curated scholarship record (data/scholarships/*.json shape). */
export type ScholarshipData = {
  slug: string;
  name: Localized;
  provider: { name: string; country?: string | null; type?: string | null };
  host_countries: string[];
  levels: string[];
  fields: string[];
  description: Localized | null;
  funding: Funding | null;
  duration_months: number | null;
  official_page_url: string;
  application_url: string | null;
  application_channel: string | null;
  language_requirements: LanguageRequirement[];
  eligibility_rules: Record<string, unknown>; // DSL, see schemas/rules.ts
  rules_human: string | null;
  competitiveness: number | null;
  cycle: Cycle;
  required_documents: RequiredDocument[];
  essay_requirements: {
    motivation_letter?: { max_words?: number | null; prompts?: string[] } | null;
    cv?: { format?: string; max_pages?: number | null } | null;
    research_proposal?: boolean;
  } | null;
  selection_process: string | null;
  tips: Localized[] | [];
  status: "draft" | "published" | "archived";
  needs_verification: boolean;
  verified_at: string | null;
};

export type ProcedureData = {
  code: string;
  title: Localized;
  summary: Localized | null;
  steps: {
    order: number;
    title: Localized;
    body: Localized;
    where: Localized | null;
    cost_dzd?: { min: number; max: number } | null;
    typical_days?: { min: number; max: number } | null;
    documents_needed?: string[];
    warnings?: Localized[];
  }[];
  typical_total_days: { min: number | null; max: number | null } | null;
  official_links: string[];
  needs_verification: boolean;
  verified_at: string | null;
};

/** Resolve a localized column with fallback locale -> fr -> en (spec §8.1). */
export function localize(loc: Localized | null | undefined, locale: Locale): string {
  if (!loc) return "";
  const primary = loc[locale];
  if (primary) return primary;
  const fr = loc.fr;
  if (fr) return fr;
  return loc.en ?? loc.ar ?? "";
}
