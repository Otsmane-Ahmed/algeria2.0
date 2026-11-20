import { describe, it, expect } from "vitest";
import { evalRule, evaluateEligibility } from "@/lib/core/eligibility/evaluate";
import { deriveFacts, type Facts } from "@/lib/core/eligibility/facts";
import type { RuleNode } from "@/lib/core/eligibility/dsl";
import type { ProfileData } from "@/lib/core/types";

const baseFacts = (): Facts => ({
  nationality: "DZ",
  birth_date: "2003-04-12",
  current_level: "licence",
  highest_completed_level: "bac",
  expected_graduation: "2027-06-30",
  field_codes: ["cs"],
  gpa_20: 14.5,
  gpa_percent_equiv: 72.5,
  gpa_de_bavarian: 2.55,
  work_experience_months: 6,
  research_experience: false,
  publications_count: 0,
  languages: {
    en: { cefr: "B2", cert: { name: "IELTS", score: "6.5", valid_until: "2028-03-01" } },
    fr: { cefr: "C1", cert: undefined },
    de: { cefr: null, cert: undefined },
  },
  target_level: "master",
  target_countries: ["FR", "DE"],
  needs_full_funding: true,
  years_since_graduation: null,
});

type Case = {
  name: string;
  rule: RuleNode;
  facts?: Partial<Facts>;
  expected: "pass" | "fail" | "unknown";
};

// Table-driven: >= 40 cases covering every op, tri-state semantics, and computed facts.
const cases: Case[] = [
  // eq / ne / in / not_in
  { name: "eq match", rule: { fact: "nationality", op: "eq", value: "DZ" }, expected: "pass" },
  { name: "eq mismatch", rule: { fact: "nationality", op: "eq", value: "FR" }, expected: "fail" },
  { name: "eq on null fact => unknown", rule: { fact: "nationality", op: "eq", value: "DZ" }, facts: { nationality: null }, expected: "unknown" },
  { name: "ne match", rule: { fact: "nationality", op: "ne", value: "FR" }, expected: "pass" },
  { name: "ne mismatch", rule: { fact: "nationality", op: "ne", value: "DZ" }, expected: "fail" },
  { name: "in match", rule: { fact: "current_level", op: "in", value: ["licence", "master"] }, expected: "pass" },
  { name: "in mismatch", rule: { fact: "current_level", op: "in", value: ["doctorate"] }, expected: "fail" },
  { name: "not_in match", rule: { fact: "current_level", op: "not_in", value: ["bac"] }, expected: "pass" },
  { name: "not_in mismatch", rule: { fact: "current_level", op: "not_in", value: ["licence"] }, expected: "fail" },
  { name: "not_in on null => unknown", rule: { fact: "current_level", op: "not_in", value: ["bac"] }, facts: { current_level: null }, expected: "unknown" },
  // numeric ops
  { name: "gte pass", rule: { fact: "gpa_20", op: "gte", value: 12 }, expected: "pass" },
  { name: "gte fail", rule: { fact: "gpa_20", op: "gte", value: 16 }, expected: "fail" },
  { name: "gte null => unknown", rule: { fact: "gpa_20", op: "gte", value: 12 }, facts: { gpa_20: null }, expected: "unknown" },
  { name: "lte pass", rule: { fact: "work_experience_months", op: "lte", value: 12 }, expected: "pass" },
  { name: "lte fail", rule: { fact: "work_experience_months", op: "lte", value: 3 }, expected: "fail" },
  { name: "between pass", rule: { fact: "gpa_20", op: "between", value: [14, 16] }, expected: "pass" },
  { name: "between fail low", rule: { fact: "gpa_20", op: "between", value: [16, 18] }, expected: "fail" },
  { name: "between fail high", rule: { fact: "gpa_20", op: "between", value: [10, 14] }, expected: "fail" },
  { name: "between null => unknown", rule: { fact: "gpa_20", op: "between", value: [10, 20] }, facts: { gpa_20: null }, expected: "unknown" },
  // array ops
  { name: "includes_any pass", rule: { fact: "target_countries", op: "includes_any", value: ["DE"] }, expected: "pass" },
  { name: "includes_any fail", rule: { fact: "target_countries", op: "includes_any", value: ["US"] }, expected: "fail" },
  { name: "includes_any empty fact => fail", rule: { fact: "target_countries", op: "includes_any", value: ["US"] }, facts: { target_countries: [] }, expected: "fail" },
  { name: "exists on present fact", rule: { fact: "gpa_20", op: "exists" }, expected: "pass" },
  { name: "exists never fires on null", rule: { fact: "gpa_20", op: "exists" }, facts: { gpa_20: null }, expected: "unknown" },
  // computed facts
  { name: "age on reference date pass", rule: { fact: "age_on_reference_date", op: "lte", value: 30, reference_date: "2027-01-01" }, expected: "pass" },
  { name: "age on reference date fail", rule: { fact: "age_on_reference_date", op: "lte", value: 20, reference_date: "2027-01-01" }, expected: "fail" },
  { name: "age without birth_date => unknown", rule: { fact: "age_on_reference_date", op: "lte", value: 30, reference_date: "2027-01-01" }, facts: { birth_date: null }, expected: "unknown" },
  { name: "degree-by pass", rule: { fact: "expected_to_hold_degree_by", op: "eq", value: true, reference_date: "2027-09-01" }, expected: "pass" },
  { name: "degree-by fail", rule: { fact: "expected_to_hold_degree_by", op: "eq", value: true, reference_date: "2027-01-01" }, expected: "fail" },
  { name: "degree-by missing graduation => unknown", rule: { fact: "expected_to_hold_degree_by", op: "eq", value: true, reference_date: "2027-09-01" }, facts: { expected_graduation: null }, expected: "unknown" },
  { name: "years since graduation unknown while studying", rule: { fact: "years_since_graduation", op: "lte", value: 5 }, expected: "unknown" },
  { name: "language cefr eq", rule: { fact: "language_cefr", op: "eq", value: "B2", lang: "en" }, expected: "pass" },
  { name: "language cefr mismatch", rule: { fact: "language_cefr", op: "eq", value: "C1", lang: "en" }, expected: "fail" },
  { name: "language missing entry => unknown", rule: { fact: "language_cefr", op: "eq", value: "B2", lang: "de" }, expected: "unknown" },
  { name: "has_language_cert pass with min", rule: { fact: "has_language_cert", op: "eq", value: { lang: "en", min: 6.0 } }, expected: "pass" },
  { name: "has_language_cert fail below min", rule: { fact: "has_language_cert", op: "eq", value: { lang: "en", min: 7.0 } }, expected: "fail" },
  { name: "has_language_cert expired => fail", rule: { fact: "has_language_cert", op: "eq", value: { lang: "en" }, reference_date: "2029-01-01" }, expected: "fail" },
  { name: "has_language_cert no cert => unknown", rule: { fact: "has_language_cert", op: "eq", value: { lang: "de" } }, expected: "unknown" },
  { name: "highest completed level", rule: { fact: "highest_completed_level", op: "in", value: ["bac"] }, expected: "pass" },
  { name: "bavarian gte", rule: { fact: "gpa_de_bavarian", op: "lte", value: 3.0 }, expected: "pass" },
  // boolean facts
  { name: "needs full funding true", rule: { fact: "needs_full_funding", op: "eq", value: true }, expected: "pass" },
  { name: "research false", rule: { fact: "research_experience", op: "eq", value: false }, expected: "pass" },
  // combinators
  { name: "all: both pass", rule: { all: [{ fact: "gpa_20", op: "gte", value: 12 }, { fact: "nationality", op: "eq", value: "DZ" }] }, expected: "pass" },
  { name: "all: one fail => fail", rule: { all: [{ fact: "gpa_20", op: "gte", value: 16 }, { fact: "nationality", op: "eq", value: "DZ" }] }, expected: "fail" },
  { name: "all: no fail but unknown => unknown", rule: { all: [{ fact: "gpa_20", op: "gte", value: 16 }, { fact: "gpa_percent_equiv", op: "exists" }] }, facts: { gpa_20: null }, expected: "unknown" },
  { name: "any: one pass => pass", rule: { any: [{ fact: "gpa_20", op: "gte", value: 16 }, { fact: "nationality", op: "eq", value: "DZ" }] }, expected: "pass" },
  { name: "any: all fail => fail", rule: { any: [{ fact: "gpa_20", op: "gte", value: 16 }, { fact: "nationality", op: "eq", value: "FR" }] }, expected: "fail" },
  { name: "any: unknown but no pass => unknown", rule: { any: [{ fact: "gpa_20", op: "gte", value: 16 }, { fact: "nationality", op: "eq", value: "FR" }] }, facts: { gpa_20: null }, expected: "unknown" },
  { name: "not: invert pass", rule: { not: { fact: "nationality", op: "eq", value: "FR" } }, expected: "pass" },
  { name: "not: invert fail", rule: { not: { fact: "nationality", op: "eq", value: "DZ" } }, expected: "fail" },
  { name: "not: unknown stays unknown", rule: { not: { fact: "gpa_20", op: "gte", value: 12 } }, facts: { gpa_20: null }, expected: "unknown" },
  { name: "nested all/any", rule: { all: [{ any: [{ fact: "gpa_20", op: "gte", value: 16 }, { fact: "work_experience_months", op: "gte", value: 5 }] }, { fact: "current_level", op: "in", value: ["licence"] }] }, expected: "pass" },
];

describe("tri-state rule evaluation", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const facts = { ...baseFacts(), ...(c.facts ?? {}) } as Facts;
    expect(evalRule(c.rule, facts).tri).toBe(c.expected);
  });

  it("has at least 40 table cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
  });

  it("records leaves with severity and labels for the UI", () => {
    const rule: RuleNode = {
      all: [
        { fact: "gpa_20", op: "gte", value: 16, label: { en: "Min GPA" }, severity: "hard" },
        { fact: "work_experience_months", op: "gte", value: 12, severity: "soft", weight: 2 },
      ],
    };
    const res = evalRule(rule, baseFacts());
    expect(res.leaves).toHaveLength(2);
    expect(res.leaves[0]?.label?.en).toBe("Min GPA");
    expect(res.leaves[1]?.severity).toBe("soft");
    expect(res.leaves[1]?.weight).toBe(2);
    expect(res.leaves[1]?.status).toBe("fail");
  });

  it("evaluateEligibility treats top-level groups as AND", () => {
    const res = evaluateEligibility(
      { all: [{ fact: "nationality", op: "eq", value: "DZ" }], any: [{ fact: "gpa_20", op: "gte", value: 16 }] },
      baseFacts(),
    );
    expect(res.tri).toBe("fail"); // the 'any' group fails
  });

  it("empty rules pass (no invented requirements)", () => {
    expect(evaluateEligibility({}, baseFacts()).tri).toBe("pass");
  });
});

describe("facts derivation", () => {
  const profile: Partial<ProfileData> = {
    fullNameLatin: "BENALI Yasmine",
    birthDate: "2003-04-12",
    nationality: "DZ",
    currentLevel: "master",
    currentYear: 1,
    gpa20: 14.5,
    targetLevel: "master",
    targetFields: ["cs"],
    targetCountries: ["FR"],
    needsFullFunding: true,
    languages: [
      { lang: "en", level: "B2", cert: { name: "IELTS", score: "6.5", expires: "2028-03-01" } },
      { lang: "fr", level: "C1" },
    ],
    experiences: [
      { type: "internship", start: "2025-06-01", end: "2025-09-01" },
      { type: "job", start: "2024-10-01", end: "2025-05-01" },
      { type: "publication", title: "paper" },
    ],
  };

  it("derives highest completed level from current level", () => {
    expect(deriveFacts(profile as ProfileData, "2026-11-20").highest_completed_level).toBe("licence");
    expect(deriveFacts({ ...profile, currentLevel: "bac" } as ProfileData, "2026-11-20").highest_completed_level).toBeNull();
    expect(deriveFacts({ ...profile, currentLevel: "doctorate" } as ProfileData, "2026-11-20").highest_completed_level).toBe("master");
  });

  it("sums work months from job + internship and counts publications", () => {
    const f = deriveFacts(profile as ProfileData, "2026-11-20");
    // Jun-Sep 2025 = 3 months, Oct 2024-May 2025 = 7 months
    expect(f.work_experience_months).toBe(10);
    expect(f.publications_count).toBe(1);
    expect(f.research_experience).toBe(true);
  });

  it("returns null work months when there is no work experience", () => {
    const f = deriveFacts({ ...profile, experiences: [] } as ProfileData, "2026-11-20");
    expect(f.work_experience_months).toBeNull();
    expect(f.research_experience).toBeNull();
  });

  it("computes percent equivalence and bavarian grade", () => {
    const f = deriveFacts(profile as ProfileData, "2026-11-20");
    expect(f.gpa_percent_equiv).toBe(72.5);
    expect(f.gpa_de_bavarian).toBeCloseTo(2.65, 2); // 1 + 3*(20-14.5)/10
  });

  it("years_since_graduation only after graduation", () => {
    expect(deriveFacts({ ...profile, expectedGraduation: "2027-06-30" } as ProfileData, "2026-11-20").years_since_graduation).toBeNull();
    expect(deriveFacts({ ...profile, expectedGraduation: "2024-06-30" } as ProfileData, "2026-11-20").years_since_graduation).toBe(2);
  });
});
