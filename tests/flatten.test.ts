import { describe, expect, it } from "vitest";
import { flattenExtraction, flattenConfidence } from "@/lib/core/extraction/flatten";

/**
 * The extraction raw is nested (spec §9.1); the review panel and
 * extraction/confirm speak flat keys. A wrong shape here means a read
 * document confirms zero profile fields — the exact dead end this fixes.
 */
const NESTED = {
  document_type: "transcript",
  language: "fr",
  holder: { full_name_latin: "OTSMANE AHMED", full_name_arabic: null, birth_date: "2004-01-21", student_id: "UN2201..." },
  institution: { name: "Université de Sidi Bel Abbes", faculty: "Faculté des sciences exactes", city: null },
  program: { level: "licence", year: 2, field_free_text: "Informatique", specialty: null },
  cumulative: { average_20: 10.47, rank: "42", mention: null },
  terms: [{ academic_year: "2022/2023", average_20: 10.17, courses: [] }],
  field_confidence: { "holder.full_name_latin": 0.97, "cumulative.average_20": 0.91 },
  warnings: [],
};

describe("flattenExtraction", () => {
  it("maps nested §9.1 paths onto the flat confirm keys", () => {
    const flat = flattenExtraction(NESTED);
    expect(flat).toMatchObject({
      full_name_latin: "OTSMANE AHMED",
      birth_date: "2004-01-21",
      institution_name: "Université de Sidi Bel Abbes",
      level: "licence",
      year: 2,
      field_free_text: "Informatique",
      average_20: 10.47,
      rank_percent: 42,
    });
  });

  it("skips nulls and missing branches, keeps nothing invented", () => {
    const flat = flattenExtraction({ holder: { full_name_arabic: null }, cumulative: {} });
    expect(flat).toEqual({});
    expect(flattenExtraction({})).toEqual({});
  });

  it("drops non-numeric rank labels instead of coercing them", () => {
    expect(flattenExtraction({ cumulative: { rank: "12/200" } })).toEqual({});
    expect(flattenExtraction({ cumulative: { rank: "42" } })).toEqual({ rank_percent: 42 });
  });
});

describe("flattenConfidence", () => {
  it("keeps the leaf of each dotted path", () => {
    expect(flattenConfidence(NESTED.field_confidence)).toEqual({
      full_name_latin: 0.97,
      average_20: 0.91,
    });
  });
});
