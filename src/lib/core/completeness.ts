import type { ProfileData } from "./types";

/**
 * Profile completeness (spec §5.1): weighted sum, 0-100.
 * identity 10, level+year 10, institution 5, field 10, gpa 20,
 * languages 10, experiences 10, goals 20, birth_date 5.
 */
export function computeCompleteness(p: Partial<ProfileData>): number {
  let score = 0;
  if (p.fullNameLatin || p.fullNameArabic) score += 10;
  if (p.currentLevel && p.currentYear) score += 10;
  else if (p.currentLevel) score += 5;
  if (p.institution) score += 5;
  if (p.fieldOfStudy || p.fieldFreeText) score += 10;
  if (typeof p.gpa20 === "number") score += 20;
  if (Array.isArray(p.languages) && p.languages.length > 0) score += 10;
  if (Array.isArray(p.experiences) && p.experiences.length > 0) score += 10;
  const goals =
    (p.targetLevel ? 1 : 0) +
    (Array.isArray(p.targetFields) && p.targetFields.length ? 1 : 0) +
    (Array.isArray(p.targetCountries) && p.targetCountries.length ? 1 : 0) +
    (typeof p.needsFullFunding === "boolean" ? 1 : 0);
  score += Math.round((goals / 4) * 20);
  if (p.birthDate) score += 5;
  return Math.min(100, score);
}

/** Fields required to confirm a profile (spec F3 acceptance). */
export const REQUIRED_FOR_CONFIRM = ["gpa20", "currentLevel", "fieldOfStudy", "targetLevel"] as const;

export function missingForConfirm(p: Partial<ProfileData>): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_FOR_CONFIRM) {
    const v = p[f];
    // Extraction often lands the field as free text (a French/German label the
    // enum doesn't cover); computeCompleteness already counts it, so confirming
    // must too — otherwise a fully read transcript still 422s forever.
    const alt = f === "fieldOfStudy" ? p.fieldFreeText : null;
    if ((v === null || v === undefined || v === "") && !alt) missing.push(f);
  }
  if (!p.confirmedAt && !p.fullNameLatin && !p.fullNameArabic) missing.push("fullNameLatin");
  return missing;
}
