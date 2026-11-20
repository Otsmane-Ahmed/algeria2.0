import { describe, it, expect } from "vitest";
import {
  normalizeNumeric,
  parseDocDate,
  normalizeAcademicYear,
  inferLevel,
  inferYear,
  recomputeAverage,
  sanityCheckTerms,
  nameSimilarity,
  extractPlaceholders,
  countWords,
} from "@/lib/core/extraction/postprocess";
import { computeCompleteness, missingForConfirm } from "@/lib/core/completeness";
import { toGermanScale, toPercent, mentionFor } from "@/lib/core/grades";

describe("normalizeNumeric", () => {
  it.each([
    ["14,56", 14.56],
    ["14.56", 14.56],
    ["١٤", 14],
    ["۱۳٫۷۵", 13.75],
    ["1 234,5", 1234.5],
    ["1.234,56", 1234.56],
    ["13.8", 13.8],
    ["moyenne: 14,5/20", 14.5],
    ["", null],
    ["abc", null],
    [42, 42],
    [null, null],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeNumeric(input)).toBe(expected);
  });
});

describe("parseDocDate", () => {
  it.each([
    ["12/04/2003", "2003-04-12"],
    ["1/2/24", "2024-02-01"], // D/M/Y default for Algerian documents
    ["2003-04-12", "2003-04-12"],
    ["31/12/2026", "2026-12-31"],
    ["not a date", null],
    ["32/01/2026", null],
  ])("%s -> %s", (input, expected) => {
    expect(parseDocDate(input)).toBe(expected);
  });
});

describe("academic years", () => {
  it("normalizes separators", () => {
    expect(normalizeAcademicYear("2024/2025")).toBe("2024/2025");
    expect(normalizeAcademicYear("2024-2025")).toBe("2024/2025");
    expect(normalizeAcademicYear("2024")).toBeNull();
  });
});

describe("level inference", () => {
  it.each([
    ["L3 informatique", "licence", 3],
    ["Licence 2", "licence", 2],
    ["M1", "master", 1],
    ["Master 2 Génie civil", "master", 2],
    ["Doctorat", "doctorate", null],
    ["ليسانس", "licence", null],
    ["ماستر", "master", null],
    ["Baccalauréat", "bac", null],
    ["unknown", null, null],
  ])("%s", (label, level, year) => {
    expect(inferLevel(label)).toBe(level);
    expect(inferYear(label)).toBe(year);
  });
});

describe("recomputeAverage", () => {
  it("weights by coef when present", () => {
    const avg = recomputeAverage([
      { name: "a", coef: 3, grade_20: 15 },
      { name: "b", coef: 1, grade_20: 10 },
    ]);
    expect(avg).toBe(13.75); // (45+10)/4
  });

  it("falls back to credits, then plain mean", () => {
    expect(
      recomputeAverage([
        { name: "a", credits: 6, grade_20: 12 },
        { name: "b", credits: 3, grade_20: 18 },
      ]),
    ).toBe(14); // (72+54)/9
    expect(recomputeAverage([{ name: "a", grade_20: 10 }, { name: "b", grade_20: 16 }])).toBe(13);
  });

  it("returns null with no graded courses", () => {
    expect(recomputeAverage([])).toBeNull();
    expect(recomputeAverage([{ name: "a", grade_20: null }])).toBeNull();
  });
});

describe("sanityCheckTerms", () => {
  it("flags out-of-range grades", () => {
    const r = sanityCheckTerms([{ courses: [{ name: "x", grade_20: 25 }] }], null);
    expect(r.warnings).toContain("grade_out_of_range");
    expect(r.gradesInRange).toBe(false);
  });

  it("flags printed vs recomputed average mismatch > 0.15", () => {
    const r = sanityCheckTerms(
      [{ average_20: 15, courses: [{ name: "a", coef: 1, grade_20: 12 }] }],
      null,
    );
    expect(r.warnings).toContain("average_mismatch");
    expect(r.averageMismatch.recomputed).toBe(12);
  });

  it("accepts a consistent average", () => {
    const r = sanityCheckTerms(
      [{ average_20: 12, courses: [{ name: "a", coef: 1, grade_20: 12 }] }],
      12,
    );
    expect(r.warnings).not.toContain("average_mismatch");
  });
});

describe("names, placeholders, words", () => {
  it("scores identical and different names", () => {
    expect(nameSimilarity("BENALI Yasmine", "BENALI Yasmine")).toBe(1);
    expect(nameSimilarity("BENALI Yasmine", "BENALI Yasmina")).toBeGreaterThan(0.8);
    expect(nameSimilarity("BENALI Yasmine", "Mohamed Cherif")).toBeLessThan(0.5);
  });

  it("extracts MISSING placeholders", () => {
    const text = "I did [[MISSING: internship duration]] and [[MISSING: PFE title]] here. [[MISSING: internship duration]]";
    expect(extractPlaceholders(text)).toEqual(["internship duration", "PFE title"]);
    expect(extractPlaceholders("no placeholders")).toEqual([]);
  });

  it("counts words ignoring placeholders", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("one [[MISSING: x y z]] two")).toBe(2);
  });
});

describe("completeness", () => {
  it("weights fields per spec §5.1", () => {
    const full = computeCompleteness({
      fullNameLatin: "A B",
      birthDate: "2003-01-01",
      currentLevel: "licence",
      currentYear: 3,
      institution: "USTHB",
      fieldOfStudy: "cs",
      gpa20: 14,
      languages: [{ lang: "fr", level: "B2" }],
      experiences: [{ type: "internship" }],
      targetLevel: "master",
      targetFields: ["cs"],
      targetCountries: ["FR"],
      needsFullFunding: true,
    });
    expect(full).toBe(100);
  });

  it("empty profile scores 0", () => {
    expect(completeness0()).toBe(0);
  });

  it("gpa alone is worth 20", () => {
    expect(computeCompleteness({ gpa20: 14 })).toBe(20);
  });

  it("goals scale proportionally", () => {
    const half = computeCompleteness({ targetLevel: "master", targetCountries: ["FR"] });
    expect(half).toBe(10); // 2 of 4 goal fields => 10
  });
});

function completeness0(): number {
  return computeCompleteness({
    fullNameLatin: null,
    fullNameArabic: null,
    birthDate: null,
    currentLevel: null,
    currentYear: null,
    institution: null,
    fieldOfStudy: null,
    fieldFreeText: null,
    gpa20: null,
    languages: [],
    experiences: [],
    targetLevel: null,
    targetFields: [],
    targetCountries: [],
    needsFullFunding: null,
  });
}

describe("missingForConfirm", () => {
  it("lists required fields", () => {
    const m = missingForConfirm({ gpa20: null, currentLevel: null, fieldOfStudy: null, targetLevel: null });
    expect(m).toEqual(["gpa20", "currentLevel", "fieldOfStudy", "targetLevel", "fullNameLatin"]);
  });

  it("empty when complete", () => {
    expect(
      missingForConfirm({
        gpa20: 14,
        currentLevel: "licence",
        fieldOfStudy: "cs",
        targetLevel: "master",
        fullNameLatin: "X Y",
      }),
    ).toEqual([]);
  });
});

describe("grade conversions", () => {
  it("bavarian: 14/20 -> 2.8 (spec appendix B)", () => {
    expect(toGermanScale(14).value).toBeCloseTo(2.8, 5);
    expect(toGermanScale(20).value).toBe(1);
    expect(toGermanScale(10).value).toBe(4);
    expect(toGermanScale(9.5).value).toBeNull(); // not convertible
    expect(toGermanScale(null).value).toBeNull();
  });

  it("percent equivalence is gpa*5", () => {
    expect(toPercent(14.5)).toBe(72.5);
    expect(toPercent(null)).toBeNull();
  });

  it("mention bands", () => {
    expect(mentionFor(16.5)).toBe("Très bien");
    expect(mentionFor(14)).toBe("Bien");
    expect(mentionFor(12)).toBe("Assez bien");
    expect(mentionFor(10)).toBe("Passable");
    expect(mentionFor(9)).toBeNull();
  });
});
