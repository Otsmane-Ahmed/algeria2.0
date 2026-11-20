/** Grade conversion helpers (spec §6.5, appendix B). All output is INDICATIVE. */

export const GRADE_DISCLAIMER =
  "Indicative conversion only; the institution or evaluating body decides.";

/** Modified Bavarian formula: 14/20 -> 2.8. null when below passing (10). */
export function toGermanScale(gpa20: number | null): { value: number | null; note: string } {
  if (gpa20 === null) return { value: null, note: "no grade" };
  if (gpa20 < 10) return { value: null, note: "below passing grade, not convertible" };
  const raw = 1 + 3 * ((20 - gpa20) / (20 - 10));
  const clamped = Math.min(4, Math.max(1, raw));
  return { value: Math.round(clamped * 100) / 100, note: GRADE_DISCLAIMER };
}

/** Percent equivalence used by some portals: gpa_20 * 5. */
export function toPercent(gpa20: number | null): number | null {
  return gpa20 === null ? null : Math.round(gpa20 * 5 * 100) / 100;
}

/** Indicative US/CA/UK GPA bands from a 0-20 average (labelled indicative). */
export function toGpa4Band(gpa20: number | null): { band: string; note: string } | null {
  if (gpa20 === null) return null;
  if (gpa20 >= 16) return { band: "A- / 3.7-4.0", note: GRADE_DISCLAIMER };
  if (gpa20 >= 14) return { band: "B+ / 3.3-3.6", note: GRADE_DISCLAIMER };
  if (gpa20 >= 12) return { band: "B / 3.0-3.2", note: GRADE_DISCLAIMER };
  if (gpa20 >= 10) return { band: "C / 2.0-2.9", note: GRADE_DISCLAIMER };
  return { band: "below minimum", note: GRADE_DISCLAIMER };
}

/** Algerian mention classification (appendix A; verify per institution). */
export function mentionFor(gpa20: number | null): string | null {
  if (gpa20 === null) return null;
  if (gpa20 >= 16) return "Très bien";
  if (gpa20 >= 14) return "Bien";
  if (gpa20 >= 12) return "Assez bien";
  if (gpa20 >= 10) return "Passable";
  return null;
}
