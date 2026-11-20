import type { ChecklistState, ProfileData, ScholarshipData, Verdict } from "../types";
import { diffDays } from "../dates";
import { nameSimilarity, extractPlaceholders, countWords } from "../extraction/postprocess";

/**
 * Pre-submission checker, Layer 1: deterministic rules (spec F9).
 * Every finding carries a stable `code`; UI localizes via messages `check.*`.
 * Layer 2 (LLM review) lives in the AI layer and degrades independently.
 */

export type Severity = "blocker" | "warning" | "info";
export type FindingCategory =
  | "missing_document"
  | "expired"
  | "mismatch"
  | "format"
  | "language"
  | "eligibility"
  | "deadline"
  | "content_quality"
  | "translation"
  | "legalisation";

export type RuleFinding = {
  code: string;
  severity: Severity;
  category: FindingCategory;
  params: Record<string, string | number>;
  evidence?: Record<string, unknown>;
};

export type ChecklistInput = {
  docCode: string;
  mandatory: boolean;
  status: ChecklistState;
  procedureCodes: string[];
  attachedMime?: string | null;
  attachedExpiresOn?: string | null;
};

export type DraftInput = {
  kind: string;
  language: string;
  wordCount: number;
  contentMd: string;
};

export type CheckerInput = {
  today: string;
  deadlineDate: string | null;
  feasibility: "ok" | "tight" | "impossible" | null;
  profile: ProfileData;
  scholarship: ScholarshipData;
  checklist: ChecklistInput[];
  drafts: DraftInput[];
  /** holder names extracted from the user's documents (for consistency check) */
  namesSeen: string[];
  /** fresh verdict from re-running the matcher (eligibility change detection) */
  eligibilityVerdict: Verdict | null;
  diplomaHasStamp?: boolean | null;
};

const needsCertified = (codes: string[]) => codes.includes("copie-conforme");
const needsTranslated = (codes: string[]) => codes.includes("traduction-assermentee");

export function runLayer1(input: CheckerInput): RuleFinding[] {
  const f: RuleFinding[] = [];
  const { scholarship, today, checklist, drafts } = input;

  // 1. Missing mandatory documents
  for (const item of checklist) {
    if (item.mandatory && item.status !== "ready") {
      f.push({
        code: "missing_mandatory_doc",
        severity: "blocker",
        category: "missing_document",
        params: { doc: item.docCode },
        evidence: { docCode: item.docCode, status: item.status },
      });
    }
    // 2. Required certification / translation chain (only while not ready)
    if (item.status !== "ready") {
      if (needsCertified(item.procedureCodes) && rank(item.status) < rank("have_certified")) {
        f.push({
          code: "doc_not_certified",
          severity: "blocker",
          category: "legalisation",
          params: { doc: item.docCode },
          evidence: { docCode: item.docCode, status: item.status },
        });
      }
      if (needsTranslated(item.procedureCodes) && rank(item.status) < rank("have_translated")) {
        f.push({
          code: "doc_not_translated",
          severity: "blocker",
          category: "translation",
          params: { doc: item.docCode },
          evidence: { docCode: item.docCode, status: item.status },
        });
      }
    }
    // 3. Expiry checks (language certificates carry expires_on)
    if (item.attachedExpiresOn) {
      if (item.attachedExpiresOn < today) {
        f.push({
          code: "cert_expired",
          severity: "blocker",
          category: "expired",
          params: { doc: item.docCode, date: item.attachedExpiresOn },
          evidence: { docCode: item.docCode, expires_on: item.attachedExpiresOn },
        });
      } else if (input.deadlineDate && item.attachedExpiresOn < input.deadlineDate) {
        f.push({
          code: "cert_expires_before_deadline",
          severity: "warning",
          category: "expired",
          params: { doc: item.docCode, date: item.attachedExpiresOn },
          evidence: { docCode: item.docCode, expires_on: item.attachedExpiresOn },
        });
      }
    }
    // 4. Format constraints from required_documents[].format
    const req = scholarship.required_documents.find((d) => d.code === item.docCode);
    const wantMime = req?.format?.mime;
    if (wantMime && item.attachedMime && item.attachedMime !== wantMime) {
      f.push({
        code: "format_mismatch",
        severity: "warning",
        category: "format",
        params: { doc: item.docCode, expected: wantMime, actual: item.attachedMime },
        evidence: { docCode: item.docCode, mime: item.attachedMime },
      });
    }
  }

  // 5. Deadline feasibility
  if (input.feasibility === "impossible") {
    f.push({
      code: "plan_impossible",
      severity: "blocker",
      category: "deadline",
      params: { deadline: input.deadlineDate ?? "unknown" },
      evidence: { deadline: input.deadlineDate },
    });
  } else if (input.feasibility === "tight") {
    f.push({
      code: "plan_tight",
      severity: "warning",
      category: "deadline",
      params: { deadline: input.deadlineDate ?? "unknown" },
      evidence: { deadline: input.deadlineDate },
    });
  }

  // 6. Eligibility changed since tracking (profile edits) — fresh evaluation
  if (input.eligibilityVerdict === "ineligible") {
    f.push({
      code: "eligibility_lost",
      severity: "blocker",
      category: "eligibility",
      params: { slug: scholarship.slug },
      evidence: { verdict: "ineligible" },
    });
  }

  // 7-10. Draft checks
  const letterReq = scholarship.essay_requirements?.motivation_letter ?? null;
  for (const d of drafts) {
    if (d.kind === "motivation_letter" || d.kind === "personal_statement") {
      const max = letterReq?.max_words ?? null;
      if (max && d.wordCount > max) {
        f.push({
          code: "letter_over_limit",
          severity: "warning",
          category: "content_quality",
          params: { words: d.wordCount, max },
          evidence: { word_count: d.wordCount, max_words: max },
        });
      } else if (max && d.wordCount < Math.floor(max * 0.6)) {
        f.push({
          code: "letter_under_limit",
          severity: "warning",
          category: "content_quality",
          params: { words: d.wordCount, max },
          evidence: { word_count: d.wordCount, max_words: max },
        });
      }
    }
    const placeholders = extractPlaceholders(d.contentMd);
    if (placeholders.length) {
      f.push({
        code: "unresolved_placeholders",
        severity: "blocker",
        category: "content_quality",
        params: { count: placeholders.length },
        evidence: { placeholders },
      });
    }
    // 11. Draft language vs scholarship accepted languages
    const reqLangs = scholarship.language_requirements.map((l) => l.lang);
    if (reqLangs.length && !reqLangs.includes(d.language) && d.language !== "ar") {
      // an Arabic draft is always a translation risk for a non-Arabic program
      f.push({
        code: "draft_language_mismatch",
        severity: "warning",
        category: "language",
        params: { draft: d.language, expected: reqLangs.join(",") },
        evidence: { draft_language: d.language, accepted: reqLangs },
      });
    }
    // 12. GPA cited in the letter must match the transcript
    if (input.profile.gpa20 !== null) {
      const re = /(\d{1,2}[.,]\d{1,2})\s*\/\s*20/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(d.contentMd)) !== null) {
        const cited = Number(m[1]?.replace(",", "."));
        if (Number.isFinite(cited) && Math.abs(cited - input.profile.gpa20) > 0.01) {
          f.push({
            code: "gpa_citation_mismatch",
            severity: "warning",
            category: "mismatch",
            params: { cited, actual: input.profile.gpa20 },
            evidence: { cited, profile: input.profile.gpa20 },
          });
          break;
        }
      }
    }
  }

  // 13. Name consistency across documents
  const names = input.namesSeen.filter(Boolean);
  if (names.length > 1) {
    for (let i = 1; i < names.length; i++) {
      const sim = nameSimilarity(names[0]!, names[i]!);
      if (sim < 0.75) {
        f.push({
          code: "name_mismatch",
          severity: "warning",
          category: "mismatch",
          params: { a: names[0]!, b: names[i]!, similarity: Math.round(sim * 100) },
          evidence: { names, similarity: sim },
        });
        break;
      }
    }
  }

  // 14. Stamps / signatures on diploma copies (info)
  if (input.diplomaHasStamp === false) {
    f.push({
      code: "stamp_missing",
      severity: "info",
      category: "legalisation",
      params: {},
      evidence: { stamps_signatures_present: false },
    });
  }

  // 15. Passport validity < intake + 6 months (only when we know expiry)
  const passportExpiry = attachedExpiry(checklist, "passport");
  const intake = scholarship.cycle.intake; // 'YYYY-MM'
  if (passportExpiry && intake) {
    const lastDay = new Date(Date.UTC(Number(intake.slice(0, 4)), Number(intake.slice(5, 7)), 0)).getUTCDate();
    const intakeEnd = `${intake}-${String(lastDay).padStart(2, "0")}`;
    const plus6 = addMonthsISO(intakeEnd, 6);
    if (passportExpiry < plus6) {
      f.push({
        code: "passport_validity_short",
        severity: "blocker",
        category: "expired",
        params: { expires: passportExpiry, required_by: plus6 },
        evidence: { expires_on: passportExpiry, required_by: plus6 },
      });
    }
  }

  return dedupe(f);
}

function rank(s: ChecklistState): number {
  return ["missing", "in_progress", "have_original", "have_certified", "have_translated", "ready"].indexOf(s);
}

function attachedExpiry(checklist: ChecklistInput[], code: string): string | null {
  return checklist.find((c) => c.docCode === code)?.attachedExpiresOn ?? null;
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

function dedupe(findings: RuleFinding[]): RuleFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const k = `${f.code}|${JSON.stringify(f.params)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Spec F9 readiness score: 100 - 25*blockers - 7*warnings - 1*infos, floor 0. */
export function readinessScore(findings: RuleFinding[]): number {
  const b = findings.filter((f) => f.severity === "blocker").length;
  const w = findings.filter((f) => f.severity === "warning").length;
  const i = findings.filter((f) => f.severity === "info").length;
  return Math.max(0, 100 - 25 * b - 7 * w - 1 * i);
}

export function readinessLabel(score: number): "ready" | "almost" | "not_ready" {
  if (score >= 90) return "ready";
  if (score >= 70) return "almost";
  return "not_ready";
}

/** Word count helper re-export for routes. */
export { countWords };

/** Days until deadline helper used by rules that need it. */
export { diffDays };
