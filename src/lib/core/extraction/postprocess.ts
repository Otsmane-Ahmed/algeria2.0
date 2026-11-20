/**
 * Deterministic post-processing for vision extraction output (spec F2 step 3).
 * Never trust the model: normalize, sanity-check, recompute in code.
 */

const ARABIC_INDIC = /[٠-٩]/g;
const ARABIC_EXT_INDIC = /[۰-۹]/g;

/** '١٤٫٥' / '14,56' / 'moyenne: 14,5/20' -> 14.56 ; returns null when not parseable. */
export function normalizeNumeric(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(ARABIC_EXT_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٬\s]/g, "") // thousands separators / spaces
    .replace(/٫/g, ".");
  // grade-with-denominator form: '14,5/20' -> take the decimal part first
  const graded = /(\d+)[,.](\d+)\s*\//.exec(s);
  if (graded && graded[1] && graded[2]) return Number(`${graded[1]}.${graded[2]}`);
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  // '1.234,56' (EU) -> 1234.56 ; '14,56' -> 14.56 ; '14.56' -> 14.56
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    const parts = s.split(",");
    // comma as decimal separator when a single short group follows
    s = parts.length === 2 && (parts[1]?.length ?? 0) <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** DD/MM/YYYY (Algerian default), D/M/YY, or YYYY-MM-DD -> ISO date or null. */
export function parseDocDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s);
  if (m) {
    let [, d, mo, y] = m;
    if (!d || !mo || !y) return null;
    if (y.length === 2) y = `20${y}`;
    const dd = d.padStart(2, "0");
    const mm = mo.padStart(2, "0");
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

/** Academic year labels: '2024/2025' normalized; '2024-2025' accepted. */
export function normalizeAcademicYear(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})\s*[/\-]\s*(\d{4})$/.exec(raw.trim());
  if (!m || !m[1] || !m[2]) return null;
  return `${m[1]}/${m[2]}`;
}

/** Level inference from transcript labels (spec F2 rule 6). */
export function inferLevel(label: string | null | undefined): "bac" | "licence" | "master" | "doctorate" | "other" | null {
  if (!label) return null;
  const s = label.toLowerCase();
  // Arabic script first: \b word boundaries do not work on non-ASCII letters
  if (/ليسانس|إجازة/.test(label)) return "licence";
  if (/ماستر/.test(label)) return "master";
  if (/دكتوراه/.test(label)) return "doctorate";
  if (/بكالوريا/.test(label)) return "bac";
  if (/\b(l1|l2|l3|licence|license)\b/.test(s)) return "licence";
  if (/\b(m1|m2|master)\b/.test(s)) return "master";
  if (/\b(phd|doctorat|doctoral)\b/.test(s)) return "doctorate";
  if (/\bbac/.test(s)) return "bac";
  return null;
}

/** Level label -> year (L3 -> 3, M2 -> 2, Licence 2 -> 2). */
export function inferYear(label: string | null | undefined): number | null {
  if (!label) return null;
  const m = /\b(?:licence|license|master|l|m)\s*([1-3])\b/i.exec(label);
  if (m && m[1]) return Number(m[1]);
  const ar = /([1-3])\s*(?:ليسانس|ماстер)/.exec(label);
  return ar && ar[1] ? Number(ar[1]) : null;
}

export type Course = { name: string; coef?: number | null; credits?: number | null; grade_20?: number | null };

/** Weighted average from courses (coef, else credits, else plain mean). */
export function recomputeAverage(courses: Course[]): number | null {
  const valid = courses.filter((c) => typeof c.grade_20 === "number");
  if (!valid.length) return null;
  let num = 0;
  let den = 0;
  for (const c of valid) {
    const w = typeof c.coef === "number" && c.coef > 0 ? c.coef : typeof c.credits === "number" && c.credits > 0 ? c.credits : 1;
    num += (c.grade_20 as number) * w;
    den += w;
  }
  return den === 0 ? null : Math.round((num / den) * 100) / 100;
}

export type SanityResult = {
  warnings: string[];
  gradesInRange: boolean;
  averageMismatch: { printed: number | null; recomputed: number | null; delta: number | null };
};

/** Grade range check + printed-vs-recomputed average check (spec F2 step 3). */
export function sanityCheckTerms(
  terms: { average_20?: number | null; courses?: Course[] }[],
  printedCumulative: number | null,
): SanityResult {
  const warnings: string[] = [];
  let gradesInRange = true;
  let recomputedCum: number | null = null;

  for (const t of terms) {
    for (const c of t.courses ?? []) {
      if (typeof c.grade_20 === "number" && (c.grade_20 < 0 || c.grade_20 > 20)) {
        gradesInRange = false;
        warnings.push("grade_out_of_range");
      }
    }
    const rc = recomputeAverage(t.courses ?? []);
    if (rc !== null && typeof t.average_20 === "number" && Math.abs(rc - t.average_20) > 0.15) {
      warnings.push("average_mismatch");
    }
    if (rc !== null) t.average_20 = rc; // prefer recomputed term average
  }

  const allCourses = terms.flatMap((t) => t.courses ?? []);
  recomputedCum = allCourses.length ? recomputeAverage(allCourses) : null;
  const delta =
    recomputedCum !== null && printedCumulative !== null
      ? Math.round(Math.abs(recomputedCum - printedCumulative) * 100) / 100
      : null;
  if (delta !== null && delta > 0.15) warnings.push("average_mismatch");

  if (!gradesInRange) warnings.push("grade_out_of_range");
  return {
    warnings: [...new Set(warnings)],
    gradesInRange,
    averageMismatch: { printed: printedCumulative, recomputed: recomputedCum, delta },
  };
}

/** Normalized similarity 0..1 for cross-document name checks (spec F2 rule 5 / F9). */
export function nameSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const d = levenshtein(s1, s2);
  return 1 - d / Math.max(s1.length, s2.length);
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[n] ?? Math.max(m, n);
}

/** Extract [[MISSING: ...]] placeholders from a draft (spec F7.2 step 4). */
export function extractPlaceholders(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[MISSING:\s*([^\]]{1,200})\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) if (m[1]) out.push(m[1].trim());
  return [...new Set(out)];
}

export function countWords(text: string): number {
  return text
    .replace(/\[\[MISSING:[^\]]*\]\]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
