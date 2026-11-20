import { z } from "zod";
import { LOCALES, LEVELS } from "../types";
import { eligibilityRulesSchema } from "../eligibility/dsl";

/**
 * Zod mirrors of the data-file shapes (spec 6.2.1: validated by Zod in
 * scripts/validate-data.ts; CI fails on invalid). Keep in sync with types.ts —
 * these are the trust boundary for data/ and config/ files.
 */

export const localizedSchema = z.object({
  en: z.string().nullish(),
  fr: z.string().nullish(),
  ar: z.string().nullish(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected ISO date YYYY-MM-DD");
const isoDateTimeish = z.string(); // timestamptz from db

export const cycleSchema = z.object({
  cycle_id: z.string().min(1),
  opens: isoDate.nullish(),
  deadline: isoDate.nullish(),
  deadline_time: z.string().nullish(),
  deadline_tz: z.string().nullish(),
  results_expected: isoDate.nullish(),
  intake: z.string().nullish(), // YYYY-MM
  rolling: z.boolean().optional(),
  status: z.enum(["open", "upcoming", "closed", "unknown"]).optional(),
  source_url: z.string().url().nullish(),
  verified_at: isoDateTimeish.nullish(),
});

export const requiredDocumentSchema = z.object({
  code: z.string().min(1),
  label: localizedSchema,
  mandatory: z.boolean(),
  notes: z.string().nullish(),
  procedure_codes: z.array(z.string()).optional(),
  format: z.object({ mime: z.string().optional(), max_mb: z.number().positive().optional() }).nullish(),
});

export const languageRequirementSchema = z.object({
  lang: z.string().min(2),
  tests: z.array(z.object({ name: z.string(), min: z.number().nullable().optional() })).optional(),
  cefr_min: z.string().nullable().optional(),
  alt: z.string().nullish(),
  notes: z.string().nullish(),
});

export const fundingSchema = z.object({
  tuition: z.enum(["full", "partial", "none"]).nullable().optional(),
  stipend_monthly: z.object({ amount: z.number().positive(), currency: z.string().min(3).max(3) }).nullable().optional(),
  travel: z.boolean().nullable().optional(),
  insurance: z.boolean().nullable().optional(),
  notes: z.string().nullish(),
});

export const scholarshipSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: localizedSchema.refine((l) => Boolean(l.en && l.fr), "FR+EN text required (spec 6.3.5)"),
  provider: z.object({ name: z.string().min(1), country: z.string().nullable().optional(), type: z.string().nullable().optional() }),
  host_countries: z.array(z.string()),
  levels: z.array(z.string()),
  fields: z.array(z.string()),
  description: localizedSchema.nullish(),
  funding: fundingSchema.nullish(),
  duration_months: z.number().int().positive().nullable().optional(),
  official_page_url: z.string().url(),
  application_url: z.string().url().nullish(),
  application_channel: z.string().nullable().optional(),
  language_requirements: z.array(languageRequirementSchema),
  eligibility_rules: eligibilityRulesSchema,
  rules_human: z.string().nullable().optional(),
  competitiveness: z.number().int().min(1).max(5).nullable().optional(),
  cycle: cycleSchema,
  required_documents: z.array(requiredDocumentSchema).min(1, "at least 1 required document (spec 6.3.5)"),
  essay_requirements: z
    .object({
      motivation_letter: z.object({ max_words: z.number().int().positive().nullable().optional(), prompts: z.array(z.string()).optional() }).nullish(),
      cv: z.object({ format: z.string().optional(), max_pages: z.number().int().positive().nullable().optional() }).nullish(),
      research_proposal: z.boolean().optional(),
    })
    .nullish(),
  selection_process: z.string().nullable().optional(),
  tips: z.array(localizedSchema).default([]),
  status: z.enum(["draft", "published", "archived"]),
  needs_verification: z.boolean(),
  verified_at: isoDateTimeish.nullish(),
});

export const procedureStepSchema = z.object({
  order: z.number().int().min(1),
  title: localizedSchema,
  body: localizedSchema,
  where: localizedSchema.nullish(),
  cost_dzd: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }).nullish(),
  typical_days: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).nullish(),
  documents_needed: z.array(z.string()).optional(),
  warnings: z.array(localizedSchema).optional(),
});

export const procedureSchema = z.object({
  code: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: localizedSchema,
  summary: localizedSchema.nullish(),
  steps: z.array(procedureStepSchema).min(1),
  typical_total_days: z.object({ min: z.number().int().nullable(), max: z.number().int().nullable() }).nullish(),
  official_links: z.array(z.string().url()),
  needs_verification: z.boolean(),
  verified_at: isoDateTimeish.nullish(),
});

export const taxonomyNodeSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/),
  parent_code: z.string().nullable(),
  label: localizedSchema,
  synonyms: z.object({
    en: z.array(z.string()).optional(),
    fr: z.array(z.string()).optional(),
    ar: z.array(z.string()).optional(),
  }),
});

export const countrySchema = z.object({
  code: z.string().min(2).max(3),
  names: localizedSchema,
  tz: z.string().nullish(),
  notes: z.string().optional(),
});

/** Mode A formation (Algerian post-bac, §7.3). Cut-offs stay null while
 *  unverified — the evaluator treats a missing cut-off as "Unknown", never as
 *  a pass. Stream acceptance and city are general-knowledge facts of real
 *  public institutions; every numeric claim waits for a verified source. */
export const formationSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name_fr: z.string().min(1),
  name_en: z.string().min(1).nullish(),
  name_ar: z.string().min(1).nullish(),
  institution: z.string().min(1),
  institution_kind: z.enum(["university", "grande_ecole", "institute"]),
  city: z.string().min(1),
  wilaya_code: z.number().int().min(1).max(58),
  wilaya_name: z.string().min(1),
  streams: z.array(
    z.enum([
      "sciences_experimentales",
      "mathematiques",
      "technique_mathematique",
      "gestion_economie",
      "lettres_philosophie",
      "langues_etrangeres",
    ]),
  ).min(1),
  language: z.enum(["fr", "ar", "en"]),
  domain_tags: z.array(z.string().min(1)).min(1),
  duration_years: z.number().int().min(2).max(12),
  tuition: z.enum(["public", "private"]).default("public"),
  cutoff_last_year: z.number().min(0).max(20).nullable(),
  cutoff_source: z.string().url().nullable(),
  needs_verification: z.boolean(),
});

/** Hard rule (6.2.1): a published scholarship must never carry a concrete
 *  deadline/test minimum the dataset has not verified. needs_verification=true
 *  is the honest state; this guards against accidental memory-fills. */
export function assertNoUnverifiedNumbers(s: {
  cycle: { deadline?: string | null };
  language_requirements: { tests?: { name?: string; min?: number | null }[] }[];
  needs_verification: boolean;
}): string[] {
  const errors: string[] = [];
  if (s.cycle.deadline != null) errors.push("cycle.deadline must be null while needs_verification=true");
  for (const lr of s.language_requirements) {
    for (const t of lr.tests ?? []) {
      if (t.min != null) errors.push(`language test ${t.name ?? "?"}.min must be null while needs_verification=true`);
    }
  }
  return errors;
}

export const LOCALES_SET = new Set(LOCALES);
export const LEVELS_SET = new Set(LEVELS);
