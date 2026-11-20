import type { ScholarshipData } from "@/lib/core/types";

/** Minimal published scholarship fixture for tests. Facts deliberately structural. */
export function scholarshipFixture(over: Partial<ScholarshipData> = {}): ScholarshipData {
  return {
    slug: "test-scholarship",
    name: { en: "Test Scholarship", fr: "Bourse test", ar: "منحة اختبار" },
    provider: { name: "Test Provider", country: "FR", type: "government" },
    host_countries: ["FR"],
    levels: ["master"],
    fields: [],
    description: null,
    funding: { tuition: "full" },
    duration_months: 12,
    official_page_url: "https://example.org/",
    application_url: "https://example.org/apply",
    application_channel: "portal",
    language_requirements: [],
    eligibility_rules: {
      all: [{ fact: "nationality", op: "in", value: ["DZ"], severity: "hard" }],
    },
    rules_human: "Algerian students only.",
    competitiveness: 3,
    cycle: {
      cycle_id: "2027",
      opens: "2026-09-01",
      deadline: "2027-01-31",
      deadline_tz: "Europe/Paris",
      intake: "2027-09",
      rolling: false,
      status: "upcoming",
      source_url: "https://example.org/",
      verified_at: "2026-11-01",
    },
    required_documents: [
      { code: "passport", label: { en: "Passport", fr: "Passeport", ar: "جواز السفر" }, mandatory: true },
      {
        code: "diploma_translated",
        label: { en: "Degree (sworn translation)", fr: "Diplôme (traduction assermentée)", ar: "الشهادة (ترجمة محلفة)" },
        mandatory: true,
        procedure_codes: ["copie-conforme", "traduction-assermentee"],
      },
    ],
    essay_requirements: { motivation_letter: { max_words: 500, prompts: [] }, cv: { format: "standard", max_pages: 2 } },
    selection_process: null,
    tips: [],
    status: "published",
    needs_verification: true,
    verified_at: "2026-11-01",
    ...over,
  };
}

export function factsFixture(over: Record<string, unknown> = {}) {
  return {
    nationality: "DZ",
    birth_date: "2003-04-12",
    current_level: "licence",
    highest_completed_level: "bac",
    expected_graduation: "2027-06-30",
    field_codes: ["cs"],
    gpa_20: 14.5,
    gpa_percent_equiv: 72.5,
    gpa_de_bavarian: 2.65,
    work_experience_months: 6,
    research_experience: false,
    publications_count: 0,
    languages: {
      en: { cefr: "B2", cert: { name: "IELTS", score: "6.5", valid_until: "2028-03-01" } },
      fr: { cefr: "C1", cert: undefined },
    },
    target_level: "master",
    target_countries: ["FR", "DE"],
    needs_full_funding: true,
    years_since_graduation: null,
    ...over,
  } as Parameters<typeof import("@/lib/core/eligibility/score").scoreMatch>[0]["facts"];
}

export const PARENT_OF: Record<string, string | null> = {
  cs: "stem",
  ee: "stem",
  civil: "eng",
  stem: null,
  eng: null,
  econ: null,
};
