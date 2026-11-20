import { describe, it, expect } from "vitest";
import { runLayer1, readinessScore, readinessLabel, type CheckerInput } from "@/lib/core/checker/rules";
import { scholarshipFixture, factsFixture } from "./fixtures";
import { evaluateEligibility } from "@/lib/core/eligibility/evaluate";

const TODAY = "2026-11-20";

function input(over: Partial<CheckerInput> = {}): CheckerInput {
  return {
    today: TODAY,
    deadlineDate: "2027-01-31",
    feasibility: "ok",
    profile: {
      fullNameLatin: "BENALI Yasmine",
      fullNameArabic: null,
      birthDate: "2003-04-12",
      nationality: "DZ",
      gender: null,
      wilaya: "Alger",
      currentLevel: "licence",
      currentYear: 3,
      institution: "USTHB",
      faculty: null,
      fieldOfStudy: "cs",
      fieldFreeText: "Informatique",
      expectedGraduation: "2027-06-30",
      gpa20: 14.5,
      gpaRankPercent: null,
      honors: null,
      languages: [{ lang: "en", level: "B2", cert: { name: "IELTS", score: "6.5" } }],
      experiences: [],
      skills: [],
      targetLevel: "master",
      targetFields: ["cs"],
      targetCountries: ["FR"],
      needsFullFunding: true,
      targetIntake: "2027-09",
      budgetMonthlyDzd: null,
      constraints: {},
      completeness: 80,
      confirmedAt: "2026-11-19T10:00:00Z",
    },
    scholarship: scholarshipFixture(),
    checklist: [
      { docCode: "passport", mandatory: true, status: "ready", procedureCodes: [], attachedExpiresOn: "2030-01-01" },
      { docCode: "diploma_translated", mandatory: true, status: "missing", procedureCodes: ["copie-conforme", "traduction-assermentee"] },
    ],
    drafts: [
      {
        kind: "motivation_letter",
        language: "fr",
        wordCount: 420,
        contentMd: "Je souhaite candidater avec une moyenne de 14.5/20.",
      },
    ],
    namesSeen: ["BENALI Yasmine"],
    eligibilityVerdict: "likely",
    ...over,
  };
}

const codes = (f: { code: string }[]) => f.map((x) => x.code);

describe("checker layer 1 (deterministic)", () => {
  it("seeds: a fully ready package with a good letter scores 100 and passes", () => {
    const f = runLayer1(
      input({
        checklist: [
          { docCode: "passport", mandatory: true, status: "ready", procedureCodes: [], attachedExpiresOn: "2030-01-01" },
          { docCode: "diploma_translated", mandatory: true, status: "ready", procedureCodes: ["copie-conforme", "traduction-assermentee"] },
        ],
        eligibilityVerdict: "likely",
      }),
    );
    expect(f).toEqual([]);
    expect(readinessScore(f)).toBe(100);
    expect(readinessLabel(100)).toBe("ready");
  });

  it("detects a missing mandatory document (blocker)", () => {
    const f = runLayer1(input());
    expect(codes(f)).toContain("missing_mandatory_doc");
    expect(f.find((x) => x.code === "missing_mandatory_doc")?.severity).toBe("blocker");
  });

  it("detects missing certification and translation steps", () => {
    const f = runLayer1(
      input({
        checklist: [
          { docCode: "diploma_translated", mandatory: true, status: "have_original", procedureCodes: ["copie-conforme", "traduction-assermentee"] },
        ],
      }),
    );
    expect(codes(f)).toContain("doc_not_certified");
    expect(codes(f)).toContain("doc_not_translated");
  });

  it("progressing to have_certified clears certification but not translation", () => {
    const f = runLayer1(
      input({
        checklist: [
          { docCode: "diploma_translated", mandatory: true, status: "have_certified", procedureCodes: ["copie-conforme", "traduction-assermentee"] },
        ],
      }),
    );
    expect(codes(f)).not.toContain("doc_not_certified");
    expect(codes(f)).toContain("doc_not_translated");
  });

  it("flags an expired certificate as blocker and one expiring before deadline as warning", () => {
    const expired = runLayer1(
      input({
        checklist: [{ docCode: "language_cert", mandatory: true, status: "ready", procedureCodes: [], attachedExpiresOn: "2026-01-01" }],
      }),
    );
    expect(expired.find((x) => x.code === "cert_expired")?.severity).toBe("blocker");

    const soon = runLayer1(
      input({
        checklist: [{ docCode: "language_cert", mandatory: true, status: "ready", procedureCodes: [], attachedExpiresOn: "2026-12-25" }],
      }),
    );
    expect(soon.find((x) => x.code === "cert_expires_before_deadline")?.severity).toBe("warning");
  });

  it("flags impossible plans as blockers, tight as warnings", () => {
    expect(codes(runLayer1(input({ feasibility: "impossible" })))).toContain("plan_impossible");
    expect(codes(runLayer1(input({ feasibility: "tight" })))).toContain("plan_tight");
    expect(codes(runLayer1(input({ feasibility: "ok" })))).not.toContain("plan_impossible");
  });

  it("flags lost eligibility as a blocker", () => {
    const f = runLayer1(input({ eligibilityVerdict: "ineligible" }));
    expect(f.find((x) => x.code === "eligibility_lost")?.severity).toBe("blocker");
  });

  it("flags unresolved [[MISSING]] placeholders as blockers", () => {
    const f = runLayer1(
      input({
        drafts: [
          { kind: "motivation_letter", language: "fr", wordCount: 300, contentMd: "I did [[MISSING: internship duration]] last year." },
        ],
      }),
    );
    const hit = f.find((x) => x.code === "unresolved_placeholders");
    expect(hit?.severity).toBe("blocker");
    expect(hit?.params.count).toBe(1);
  });

  it("flags letters over and under the word limit", () => {
    const over = runLayer1(
      input({ drafts: [{ kind: "motivation_letter", language: "fr", wordCount: 600, contentMd: "x y z" }] }),
    );
    expect(over.find((x) => x.code === "letter_over_limit")?.severity).toBe("warning");

    const under = runLayer1(
      input({ drafts: [{ kind: "motivation_letter", language: "fr", wordCount: 100, contentMd: "x y z" }] }),
    );
    expect(under.find((x) => x.code === "letter_under_limit")?.severity).toBe("warning");
  });

  it("flags a GPA cited in the letter that does not match the transcript", () => {
    const f = runLayer1(
      input({
        drafts: [{ kind: "motivation_letter", language: "fr", wordCount: 400, contentMd: "J'ai une moyenne de 16,2/20." }],
      }),
    );
    const hit = f.find((x) => x.code === "gpa_citation_mismatch");
    expect(hit?.severity).toBe("warning");
    expect(hit?.params.cited).toBe(16.2);
    expect(hit?.params.actual).toBe(14.5);
  });

  it("accepts a letter whose GPA citation matches", () => {
    const f = runLayer1(
      input({
        drafts: [{ kind: "motivation_letter", language: "fr", wordCount: 400, contentMd: "Moyenne de 14,5/20 obtenue en L3." }],
      }),
    );
    expect(codes(f)).not.toContain("gpa_citation_mismatch");
  });

  it("flags inconsistent names across documents", () => {
    const f = runLayer1(input({ namesSeen: ["BENALI Yasmine", "Mohamed Cherif"] }));
    expect(codes(f)).toContain("name_mismatch");
  });

  it("flags a format mismatch on attached files", () => {
    const f = runLayer1(
      input({
        checklist: [
          { docCode: "passport", mandatory: true, status: "ready", procedureCodes: [], attachedMime: "image/jpeg" },
        ],
        scholarship: scholarshipFixture({
          required_documents: [
            { code: "passport", label: { en: "Passport" }, mandatory: true, format: { mime: "application/pdf" } },
          ],
        }),
      }),
    );
    expect(codes(f)).toContain("format_mismatch");
  });

  it("flags draft language not accepted by the scholarship", () => {
    const f = runLayer1(
      input({
        scholarship: scholarshipFixture({ language_requirements: [{ lang: "de", tests: [{ name: "TestDaF" }] }] }),
        drafts: [{ kind: "motivation_letter", language: "fr", wordCount: 400, contentMd: "texte" }],
      }),
    );
    expect(codes(f)).toContain("draft_language_mismatch");
  });

  it("warns when no stamp is visible on a diploma", () => {
    expect(codes(runLayer1(input({ diplomaHasStamp: false })))).toContain("stamp_missing");
    expect(codes(runLayer1(input({ diplomaHasStamp: true })))).not.toContain("stamp_missing");
  });

  it("blocks when the passport expires before intake + 6 months", () => {
    const f = runLayer1(
      input({
        checklist: [{ docCode: "passport", mandatory: true, status: "ready", procedureCodes: [], attachedExpiresOn: "2027-03-01" }],
      }),
    );
    // intake 2027-09 => needs validity to 2028-03
    expect(codes(f)).toContain("passport_validity_short");
  });

  it("readiness score formula: 100 - 25b - 7w - 1i, floor 0", () => {
    const f = runLayer1(input()); // default: 1 blocker (missing doc) ... plus cert chain blocker
    const b = f.filter((x) => x.severity === "blocker").length;
    const w = f.filter((x) => x.severity === "warning").length;
    const i = f.filter((x) => x.severity === "info").length;
    expect(readinessScore(f)).toBe(Math.max(0, 100 - 25 * b - 7 * w - i));
    expect(readinessLabel(95)).toBe("ready");
    expect(readinessLabel(75)).toBe("almost");
    expect(readinessLabel(40)).toBe("not_ready");
    expect(readinessScore(Array.from({ length: 6 }, () => ({ code: "x", severity: "blocker" as const, category: "format" as const, params: {} })))).toBe(0);
  });

  it("works against a fresh eligibility evaluation (integration with evaluator)", () => {
    const res = evaluateEligibility(
      scholarshipFixture().eligibility_rules as never,
      factsFixture({ nationality: "FR" }),
      "2027-01-31",
    );
    const f = runLayer1(input({ eligibilityVerdict: res.tri === "fail" ? "ineligible" : "likely" }));
    expect(codes(f)).toContain("eligibility_lost");
  });
});
