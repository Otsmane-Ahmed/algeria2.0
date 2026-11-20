import type { Level, ProfileData } from "../types";
import { diffDays } from "../dates";

/**
 * Facts derivation (spec F4.1): flat, all-nullable object.
 * null = unknown. The evaluator never treats null as pass.
 */
export type Facts = {
  nationality: string | null;
  birth_date: string | null;
  current_level: Level | null;
  highest_completed_level: Level | null;
  expected_graduation: string | null;
  field_codes: string[];
  gpa_20: number | null;
  gpa_percent_equiv: number | null;
  gpa_de_bavarian: number | null;
  work_experience_months: number | null;
  research_experience: boolean | null;
  publications_count: number | null;
  languages: Record<string, { cefr: string | null; cert?: { name: string | null; score: string | null; valid_until: string | null } }>;
  target_level: string | null;
  target_countries: string[];
  needs_full_funding: boolean | null;
  years_since_graduation: number | null;
};

const WORK_TYPES = new Set(["job", "internship"]);

function monthsBetween(startIso: string, endIso: string): number {
  const [sy, sm] = startIso.split("-").map(Number);
  const [ey, em] = endIso.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return 0;
  return (ey - sy) * 12 + (em - sm);
}

/** Modified Bavarian formula (spec appendix B), indicative only. */
export function bavarianGrade(gpa20: number | null): number | null {
  if (gpa20 === null) return null;
  if (gpa20 < 10) return null; // below passing: not convertible
  const raw = 1 + 3 * ((20 - gpa20) / (20 - 10));
  return Math.min(4, Math.max(1, Math.round(raw * 100) / 100));
}

export function deriveFacts(profile: ProfileData, today: string): Facts {
  const current = profile.currentLevel;
  let highest: Level | null = null;
  if (current === "doctorate") highest = "master";
  else if (current === "master") highest = "licence";
  else if (current === "licence") highest = "bac";
  else if (current === "bac") highest = null;

  let workMonths = 0;
  let sawWork = false;
  let publications = 0;
  let research = false;
  for (const e of profile.experiences) {
    if (e.type === "publication") publications++;
    if (e.type === "research") research = true;
    if (WORK_TYPES.has(e.type) && e.start) {
      const end = e.end && e.end <= today ? e.end : today;
      const m = monthsBetween(e.start, end);
      if (m > 0) {
        workMonths += m;
        sawWork = true;
      }
    }
  }

  const languages: Facts["languages"] = {};
  for (const l of profile.languages) {
    if (!l.lang) continue;
    languages[l.lang] = {
      cefr: l.level ?? null,
      cert: l.cert
        ? {
            name: l.cert.name ?? null,
            score: l.cert.score ?? null,
            valid_until: l.cert.expires ?? null,
          }
        : undefined,
    };
  }

  let yearsSinceGraduation: number | null = null;
  if (profile.expectedGraduation && profile.expectedGraduation <= today) {
    yearsSinceGraduation = Math.floor(diffDays(today, profile.expectedGraduation) / 365.25);
  }

  return {
    nationality: profile.nationality,
    birth_date: profile.birthDate,
    current_level: profile.currentLevel,
    highest_completed_level: highest,
    expected_graduation: profile.expectedGraduation,
    field_codes: profile.targetFields.length ? profile.targetFields : profile.fieldOfStudy ? [profile.fieldOfStudy] : [],
    gpa_20: profile.gpa20,
    gpa_percent_equiv: profile.gpa20 === null ? null : Math.round(profile.gpa20 * 5 * 100) / 100,
    gpa_de_bavarian: bavarianGrade(profile.gpa20),
    work_experience_months: sawWork ? workMonths : null,
    research_experience: research || publications > 0 ? true : profile.experiences.length ? false : null,
    publications_count: publications,
    languages,
    target_level: profile.targetLevel,
    target_countries: profile.targetCountries,
    needs_full_funding: profile.needsFullFunding,
    years_since_graduation: yearsSinceGraduation,
  };
}

function ageOn(birthDate: string, on: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [oy, om, od] = on.split("-").map(Number);
  if (!by || !bm || !bd || !oy || !om || !od) return null;
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age--;
  return age;
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function cefrAtLeast(actual: string | null, min: string | null): boolean | null {
  if (!actual || !min) return null;
  const a = CEFR_ORDER.indexOf(actual.toUpperCase());
  const m = CEFR_ORDER.indexOf(min.toUpperCase());
  if (a < 0 || m < 0) return null;
  return a >= m;
}

/**
 * Resolve one leaf's fact value. Returns null => unknown (never silently pass).
 * `opts.value` is the rule's own value (needed by has_language_cert);
 * `opts.referenceDate` drives age / expected_to_hold_degree_by.
 */
export function resolveFact(
  fact: string,
  facts: Facts,
  opts: { referenceDate?: string | null; value?: unknown; lang?: string } = {},
): unknown {
  switch (fact) {
    case "age_on_reference_date": {
      if (!opts.referenceDate || !facts.birth_date) return null;
      return ageOn(facts.birth_date, opts.referenceDate);
    }
    case "expected_to_hold_degree_by": {
      if (!opts.referenceDate) return null;
      if (!facts.expected_graduation) return null;
      return facts.expected_graduation <= opts.referenceDate;
    }
    case "language_cefr": {
      const lang = opts.lang ?? "";
      return facts.languages[lang]?.cefr ?? null;
    }
    case "has_language_cert": {
      const v = opts.value;
      const lang = typeof v === "object" && v && "lang" in v ? String((v as { lang: unknown }).lang) : opts.lang;
      if (!lang) return null;
      const entry = facts.languages[lang];
      if (!entry?.cert?.name) return null;
      const until = entry.cert.valid_until;
      const today = opts.referenceDate ?? null;
      if (until && today && until < today) return false; // expired
      const req = typeof v === "object" && v && "min" in v ? (v as { min?: number | null }).min : null;
      if (req !== null && req !== undefined) {
        const score = entry.cert.score ? Number(String(entry.cert.score).replace(",", ".")) : NaN;
        if (Number.isNaN(score)) return null;
        return score >= req;
      }
      return true;
    }
    case "field_codes":
      return facts.field_codes;
    case "target_countries":
      return facts.target_countries;
    case "research_experience":
    case "needs_full_funding":
      return facts[fact];
    default: {
      const v = (facts as Record<string, unknown>)[fact];
      return v === undefined ? null : v;
    }
  }
}
