import type { Facts } from "./facts";
import { cefrAtLeast, deriveFacts } from "./facts";
import { evaluateEligibility, type EvaluatedLeaf } from "./evaluate";
import type { ScholarshipData, Verdict } from "../types";
import { daysUntil } from "../dates";

/** One scored factor shown in the UI factor table (spec F4.4 / appendix E). */
export type Factor = {
  key: string;
  label: { en?: string; fr?: string; ar?: string };
  weight: number;
  status: "pass" | "fail" | "unknown" | "partial";
  value: string | null;
  detail?: string | null;
};

export type Blocker = {
  fact: string;
  label: { en?: string; fr?: string; ar?: string } | null;
  detail: string;
  source_url?: string | null;
};

export type MatchInput = {
  facts: Facts;
  scholarship: ScholarshipData;
  today: string;
  /** code -> parent code, from taxonomy_fields (for the "related parent" 0.5 credit). */
  parentOf: Record<string, string | null>;
  /** Critical-path lead time in days from the F5 planner. */
  leadTimeDays: number;
  now?: Date;
};

export type MatchResult = {
  verdict: Verdict;
  score: number;
  factors: Factor[];
  blockers: Blocker[];
  missingInfo: string[];
  daysToDeadline: number | null;
};

/** All weights and thresholds live in config/scoring.json (spec F4.4). */
import SCORING from "../../../../config/scoring.json";

const W = SCORING.weights;
const VERDICT_CFG = SCORING.verdict;

function pct(n: number): number {
  return Math.round(n * 100);
}

/** gpa -> [0,1] academic strength bands (spec F4.4 table, config/scoring.json). */
export function academicStrength(gpa20: number | null, competitiveness: number | null): number | null {
  if (gpa20 === null) return null;
  const band = SCORING.gpa_bands.find((b) => gpa20 >= b.min);
  const s = band?.score ?? 0;
  // competitiveness null => neutral 3 (documented: editorial prior not yet set)
  const comp = competitiveness ?? 3;
  return Math.max(0, Math.min(1, s * (1 - SCORING.competitiveness_penalty_per_level * (comp - 1))));
}

function fieldScore(targetFields: string[], scholarshipFields: string[], parentOf: Record<string, string | null>): number | null {
  if (!scholarshipFields.length) return 1; // open to all fields
  if (!targetFields.length) return null;
  if (targetFields.some((f) => scholarshipFields.includes(f))) return 1;
  // related parent: scholarship accepts the parent of the student's field
  if (targetFields.some((f) => {
    const p = parentOf[f];
    return p ? scholarshipFields.includes(p) : false;
  })) return SCORING.parent_field_partial_credit;
  return 0;
}

function languageScore(
  facts: Facts,
  reqs: ScholarshipData["language_requirements"],
  today: string,
): { score: number | null; detail: string | null } {
  if (!reqs.length) return { score: null, detail: null };
  const req = reqs[0];
  if (!req) return { score: null, detail: null };
  const entry = facts.languages[req.lang];
  if (!entry) return { score: null, detail: `no ${req.lang} entry` };
  const cefrMin = req.cefr_min ?? null;
  const testMin = req.tests?.find((t) => typeof t.min === "number")?.min ?? null;
  if (cefrMin === null && testMin === null) return { score: null, detail: "requirement unverified" };

  const cert = entry.cert;
  const certValid = Boolean(cert?.name) && (!cert?.valid_until || cert.valid_until >= today);
  const certScore = cert?.score ? Number(String(cert.score).replace(",", ".")) : NaN;

  // valid certificate with a comparable numeric minimum
  if (certValid && testMin !== null && !Number.isNaN(certScore)) {
    return certScore >= testMin
      ? { score: 1, detail: `${cert?.name} ${certScore} >= ${testMin}` }
      : { score: 0.2, detail: `${cert?.name} ${certScore} < ${testMin}` };
  }
  // CEFR-expressible requirement: fall back to self-level (0.6 without a valid cert)
  if (cefrMin !== null) {
    const ok = cefrAtLeast(entry.cefr, cefrMin);
    if (ok === null) return { score: null, detail: "no CEFR level on file" };
    if (ok) return certValid ? { score: 1, detail: `certificate valid, ${entry.cefr}` } : { score: 0.6, detail: `self-level ${entry.cefr} (no valid certificate)` };
    return { score: 0.2, detail: `self-level ${entry.cefr} below ${cefrMin}` };
  }
  // numeric requirement but no valid certificate to compare
  return { score: null, detail: certValid ? "certificate score not comparable" : "certificate missing or expired" };
}

/**
 * Deterministic match: eligibility (tri-state) + 0-100 fit score + verdict.
 * Pure: same inputs => same output (spec F4 acceptance).
 */
export function scoreMatch(input: MatchInput): MatchResult {
  const { facts, scholarship, today, parentOf, leadTimeDays } = input;
  const cycle = scholarship.cycle;
  const deadline = cycle.deadline ?? null;
  const rolling = Boolean(cycle.rolling);
  const daysToDeadline = deadline ? daysUntil(deadline, cycle.deadline_tz, input.now) : null;

  // --- eligibility (hard leaves) ---
  const referenceDate = cycle.deadline ?? today;
  const evalRes = evaluateEligibility(
    scholarship.eligibility_rules as { all?: never[]; any?: never[] },
    facts,
    referenceDate,
  );
  const hardLeaves = evalRes.leaves.filter((l) => l.severity === "hard");
  const blockers: Blocker[] = hardLeaves
    .filter((l) => l.status === "fail")
    .map((l) => ({
      fact: l.fact,
      label: l.label ?? null,
      detail: `expected ${JSON.stringify(l.expected)}, got ${JSON.stringify(l.actual)}`,
      source_url: l.source_url ?? null,
    }));
  const missingInfo = [
    ...new Set(hardLeaves.filter((l) => l.status === "unknown").map((l) => l.fact)),
  ];

  // --- scoring factors (unknown factors are excluded from the denominator) ---
  const factors: Factor[] = [];
  const comp = scholarship.competitiveness ?? 3;

  // Level
  const targetLevel = facts.target_level;
  const levelOk =
    targetLevel === null
      ? null
      : targetLevel === "any" || scholarship.levels.includes(targetLevel)
        ? 1
        : 0;
  factors.push({
    key: "level",
    label: { en: "Target level matches", fr: "Niveau visé correspond", ar: "المستوى المطلوب مطابق" },
    weight: W.level,
    status: levelOk === null ? "unknown" : levelOk === 1 ? "pass" : "fail",
    value: targetLevel,
    detail: scholarship.levels.join(", "),
  });

  // Field
  const fs = fieldScore(facts.field_codes, scholarship.fields, parentOf);
  factors.push({
    key: "field",
    label: { en: "Field of study match", fr: "Domaine d'études", ar: "مجال الدراسة" },
    weight: W.field,
    status: fs === null ? "unknown" : fs === 1 ? "pass" : fs === SCORING.parent_field_partial_credit ? "partial" : "fail",
    value: facts.field_codes.join(", ") || null,
    detail: scholarship.fields.length ? scholarship.fields.join(", ") : "open to all fields",
  });

  // Academic strength
  const acad = academicStrength(facts.gpa_20, scholarship.competitiveness);
  factors.push({
    key: "gpa",
    label: { en: "Academic strength", fr: "Niveau académique", ar: "القوة الأكاديمية" },
    weight: W.academic,
    status: acad === null ? "unknown" : acad >= 0.7 ? "pass" : acad >= 0.4 ? "partial" : "fail",
    value: facts.gpa_20 === null ? null : `${facts.gpa_20}/20`,
    detail: `competitiveness ${comp}/5`,
  });

  // Language readiness
  const lang = languageScore(facts, scholarship.language_requirements, today);
  factors.push({
    key: "language",
    label: { en: "Language readiness", fr: "Niveau linguistique", ar: "المستوى اللغوي" },
    weight: W.language,
    status: lang.score === null ? "unknown" : lang.score >= 0.9 ? "pass" : lang.score >= 0.5 ? "partial" : "fail",
    value: Object.entries(facts.languages).map(([k, v]) => `${k}:${v.cefr ?? "?"}`).join(" ") || null,
    detail: lang.detail,
  });

  // Experience fit (soft rules pass ratio)
  const softLeaves: EvaluatedLeaf[] = evalRes.leaves.filter((l) => l.severity === "soft");
  const softKnown = softLeaves.filter((l) => l.status !== "unknown");
  const expScore = softKnown.length
    ? softKnown.filter((l) => l.status === "pass").length / softKnown.length
    : null;
  factors.push({
    key: "experience",
    label: { en: "Experience fit", fr: "Expérience", ar: "الخبرة" },
    weight: W.experience,
    status: expScore === null ? "unknown" : expScore >= 0.9 ? "pass" : expScore >= 0.5 ? "partial" : "fail",
    value: facts.work_experience_months === null ? null : `${facts.work_experience_months} months`,
    detail: softKnown.length ? `${softKnown.filter((l) => l.status === "pass").length}/${softKnown.length} soft requirements` : "no soft requirements",
  });

  // Country preference
  const targets = facts.target_countries;
  const hostHit = targets.length === 0 || scholarship.host_countries.some((c) => targets.includes(c));
  factors.push({
    key: "country",
    label: { en: "Host country matches preference", fr: "Pays hôte correspond", ar: "بلد الاستضافة مطابق" },
    weight: W.country,
    status: hostHit ? "pass" : "fail",
    value: targets.length ? targets.join(", ") : "any",
    detail: scholarship.host_countries.join(", "),
  });

  // Funding fit
  let fundingScore: number | null = null;
  const tuition = scholarship.funding?.tuition ?? null;
  if (facts.needs_full_funding === null || tuition === null) fundingScore = null;
  else if (!facts.needs_full_funding) fundingScore = 1;
  else fundingScore = tuition === "full" ? 1 : tuition === "partial" ? 0.4 : 0;
  factors.push({
    key: "funding",
    label: { en: "Funding fits your need", fr: "Financement adapté", ar: "التمويل مناسب" },
    weight: W.funding,
    status: fundingScore === null ? "unknown" : fundingScore >= 0.9 ? "pass" : fundingScore >= 0.35 ? "partial" : "fail",
    value: facts.needs_full_funding === null ? null : facts.needs_full_funding ? "needs full funding" : "partial ok",
    detail: tuition,
  });

  // Deadline feasibility
  let deadlineScore: number | null = null;
  let deadlineDetail: string | null = null;
  if (rolling) {
    deadlineScore = 1;
    deadlineDetail = "rolling";
  } else if (daysToDeadline === null) {
    deadlineDetail = "deadline unknown (unverified)";
  } else if (daysToDeadline < 0) {
    deadlineScore = 0;
    deadlineDetail = "deadline passed";
  } else if (daysToDeadline >= leadTimeDays) {
    deadlineScore = 1;
    deadlineDetail = `${daysToDeadline}d >= ${leadTimeDays}d needed`;
  } else if (daysToDeadline >= leadTimeDays * 0.5) {
    deadlineScore = 0.5;
    deadlineDetail = `tight: ${daysToDeadline}d of ${leadTimeDays}d needed`;
  } else {
    deadlineScore = 0;
    deadlineDetail = `impossible: ${daysToDeadline}d < ${leadTimeDays}d needed`;
  }
  factors.push({
    key: "deadline",
    label: { en: "Time before deadline", fr: "Temps avant la date limite", ar: "الوقت قبل آخر أجل" },
    weight: W.deadline,
    status: deadlineScore === null ? "unknown" : deadlineScore >= 0.9 ? "pass" : deadlineScore >= 0.4 ? "partial" : "fail",
    value: daysToDeadline === null ? null : `${daysToDeadline} days`,
    detail: deadlineDetail,
  });

  // --- weighted fit score over known factors ---
  let num = 0;
  let den = 0;
  for (const f of factors) {
    const s =
      f.status === "pass" ? 1 : f.status === "partial" ? 0.5 : f.status === "fail" ? 0 : null;
    if (s === null) continue;
    num += f.weight * s;
    den += f.weight;
  }
  const score = den === 0 ? 0 : Math.round((num / den) * 100);

  // --- verdict (spec F4.3) ---
  let verdict: Verdict;
  const deadlinePassed = !rolling && daysToDeadline !== null && daysToDeadline < 0;
  if (blockers.length > 0 || deadlinePassed) {
    verdict = "ineligible";
    if (deadlinePassed) {
      blockers.push({
        fact: "deadline",
        label: { en: "Deadline passed", fr: "Date limite passée", ar: "انقضى آخر أجل" },
        detail: `deadline ${deadline} already passed`,
        source_url: cycle.source_url ?? null,
      });
    }
  } else if (missingInfo.length > 0) {
    verdict = "unknown";
  } else if (score >= VERDICT_CFG.eligible_min_score && comp <= VERDICT_CFG.eligible_max_competitiveness) {
    verdict = "eligible";
  } else if (score >= VERDICT_CFG.likely_min_score) {
    verdict = "likely";
  } else {
    verdict = "stretch";
  }

  return { verdict, score, factors, blockers, missingInfo, daysToDeadline };
}

const VERDICT_ORDER: Record<Verdict, number> = {
  eligible: 0,
  likely: 1,
  stretch: 2,
  unknown: 3,
  ineligible: 4,
};

export type RankedItem<T> = { verdict: Verdict; score: number; daysToDeadline: number | null; name: string; data: T };

/** Spec F4.4 final ranking: verdict class, score desc, nearest deadline first, then name. */
export function rankItems<T extends { verdict: Verdict; score: number; daysToDeadline: number | null; name: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const vo = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict];
    if (vo !== 0) return vo;
    if (a.score !== b.score) return b.score - a.score;
    const da = a.daysToDeadline ?? Number.MAX_SAFE_INTEGER;
    const db = b.daysToDeadline ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });
}

export { deriveFacts };
