/**
 * Flatten spec §9.1 nested extraction values into the flat keys the rest of
 * the app speaks (review panel FIELD_ORDER, extraction/confirm's
 * mapValuesToProfile). Both consumers were written against flat keys while
 * the extraction raw is nested — without this, a perfectly read document
 * displays as "[object Object]" and confirms zero profile fields.
 */

const PATHS: Record<string, string[]> = {
  full_name_latin: ["holder", "full_name_latin"],
  full_name_arabic: ["holder", "full_name_arabic"],
  birth_date: ["holder", "birth_date"],
  student_id: ["holder", "student_id"],
  institution_name: ["institution", "name"],
  faculty: ["institution", "faculty"],
  level: ["program", "level"],
  year: ["program", "year"],
  field_free_text: ["program", "field_free_text"],
  specialty: ["program", "specialty"],
  average_20: ["cumulative", "average_20"],
  rank_percent: ["cumulative", "rank"],
};

/** Flat review/confirm fields from nested extraction raw. */
export function flattenExtraction(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [flat, path] of Object.entries(PATHS)) {
    let v: unknown = raw;
    for (const seg of path) {
      v = v && typeof v === "object" ? (v as Record<string, unknown>)[seg] : undefined;
    }
    if (v === undefined || v === null) continue;
    // cumulative.rank is a label ("12/200"); the flat field is a 0-100 number.
    if (flat === "rank_percent") {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[flat] = n;
      continue;
    }
    out[flat] = v;
  }
  return out;
}

/** field_confidence uses dotted paths ("holder.full_name_latin"); UI keys are flat. */
export function flattenConfidence(conf: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [path, value] of Object.entries(conf)) {
    const leaf = path.split(".").pop();
    if (leaf) out[leaf] = value;
  }
  return out;
}
