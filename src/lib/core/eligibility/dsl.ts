import { z } from "zod";

/**
 * Rule DSL (spec F4.2). Stored in `scholarships.eligibility_rules` and validated
 * at publish time so rules can only reference defined facts.
 */

export const FACT_KEYS = [
  "nationality",
  "birth_date",
  "current_level",
  "highest_completed_level",
  "expected_graduation",
  "field_codes",
  "gpa_20",
  "gpa_percent_equiv",
  "gpa_de_bavarian",
  "work_experience_months",
  "research_experience",
  "publications_count",
  "target_level",
  "target_countries",
  "needs_full_funding",
  "years_since_graduation",
  "age_on_reference_date",
  "expected_to_hold_degree_by",
  "language_cefr",
  "has_language_cert",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export const OPS = [
  "eq",
  "ne",
  "in",
  "not_in",
  "gte",
  "lte",
  "between",
  "includes_any",
  "exists",
] as const;
export type Op = (typeof OPS)[number];

export type Severity = "hard" | "soft";

export type RuleLeaf = {
  fact: FactKey;
  op: Op;
  value?: unknown;
  severity?: Severity; // default 'hard'
  weight?: number; // soft rules only, default 1
  label?: { en?: string; fr?: string; ar?: string };
  source_url?: string;
  /** Reference date for age / degree-by computations, e.g. "2027-01-01". */
  reference_date?: string;
  /** For fact 'language_cefr': which language, e.g. "en". */
  lang?: string;
};

export type RuleNode =
  | { all: RuleNode[] }
  | { any: RuleNode[] }
  | { not: RuleNode }
  | RuleLeaf;

const localizedLabel = z.object({
  en: z.string().optional(),
  fr: z.string().optional(),
  ar: z.string().optional(),
});

export const leafSchema = z.object({
  fact: z.enum(FACT_KEYS),
  op: z.enum(OPS),
  value: z.unknown().optional(),
  severity: z.enum(["hard", "soft"]).optional(),
  weight: z.number().positive().optional(),
  label: localizedLabel.optional(),
  source_url: z.string().url().optional(),
  reference_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  lang: z.string().min(2).max(5).optional(),
});

export const ruleSchema: z.ZodType<RuleNode> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ruleSchema) }),
    z.object({ any: z.array(ruleSchema) }),
    z.object({ not: ruleSchema }),
    leafSchema,
  ]),
);

export const eligibilityRulesSchema = z.object({
  all: z.array(ruleSchema).optional(),
  any: z.array(ruleSchema).optional(),
});

/** Walk a rule tree and collect every leaf (for validation and display). */
export function collectLeaves(rule: RuleNode, out: RuleLeaf[] = []): RuleLeaf[] {
  if ("all" in rule) rule.all.forEach((r) => collectLeaves(r, out));
  else if ("any" in rule) rule.any.forEach((r) => collectLeaves(r, out));
  else if ("not" in rule) collectLeaves(rule.not, out);
  else out.push(rule);
  return out;
}
