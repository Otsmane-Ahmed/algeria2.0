/**
 * Validate every data/ and config/ file against its Zod schema (spec 6.2.1:
 * "validated by Zod in scripts/validate-data.ts, CI fails on invalid").
 * Also enforces the hard rule: while needs_verification=true, no concrete
 * deadlines or language-test minimums may be present (6.2.1).
 *
 * Run: npm run db:validate
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  scholarshipSchema,
  procedureSchema,
  taxonomyNodeSchema,
  countrySchema,
  formationSchema,
  assertNoUnverifiedNumbers,
} from "../src/lib/core/schemas/data";

const ROOT = new URL("..", import.meta.url).pathname;
let failures = 0;
let checked = 0;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function check(label: string, run: () => void) {
  checked += 1;
  try {
    run();
  } catch (e) {
    failures += 1;
    console.error(`FAIL ${label}\n     ${e instanceof Error ? e.message.replace(/\n/g, "\n     ") : String(e)}`);
  }
}

// --- scholarships ---
for (const file of readdirSync(join(ROOT, "data/scholarships")).sort()) {
  if (!file.endsWith(".json")) continue;
  check(`data/scholarships/${file}`, () => {
    const parsed = scholarshipSchema.parse(readJson(join(ROOT, "data/scholarships", file)));
    const hard = assertNoUnverifiedNumbers(parsed);
    if (hard.length) throw new Error(hard.join("; "));
    if (!parsed.cycle.source_url) throw new Error("cycle.source_url required for published entries (spec 6.3.5)");
    if (parsed.status === "published" && !parsed.needs_verification && !parsed.verified_at)
      throw new Error("published without verified_at");
    for (const leaf of collectFacts(parsed.eligibility_rules)) {
      if (leaf.fact === "has_language_cert" && leaf.op === "eq" && leaf.value && typeof leaf.value === "object" && "min" in (leaf.value as object) && (leaf.value as { min: unknown }).min != null)
        throw new Error("has_language_cert.min must be null while unverified");
    }
  });
}

// --- procedures ---
for (const file of readdirSync(join(ROOT, "data/procedures")).sort()) {
  if (!file.endsWith(".json")) continue;
  check(`data/procedures/${file}`, () => {
    procedureSchema.parse(readJson(join(ROOT, "data/procedures", file)));
  });
}

// --- formations (Mode A, §7.3): cut-off must be null while unverified ---
for (const file of readdirSync(join(ROOT, "data/formations")).sort()) {
  if (!file.endsWith(".json")) continue;
  const items = readJson(join(ROOT, "data/formations", file)) as unknown[];
  check(`data/formations/${file}`, () => {
    if (!Array.isArray(items)) throw new Error("expected a JSON array");
    const ids = new Set<string>();
    for (const item of items) {
      const f = formationSchema.parse(item);
      if (ids.has(f.id)) throw new Error(`duplicate formation id ${f.id}`);
      ids.add(f.id);
      if (f.cutoff_last_year !== null && (!f.cutoff_source || f.needs_verification))
        throw new Error(`${f.id}: a cut-off number requires cutoff_source and needs_verification=false`);
    }
    if (ids.size < 10) throw new Error("catalog too small to be useful (min 10)");
  });
}

// --- taxonomy (parents must exist, no cycles) ---
check("data/taxonomy.json", () => {
  const nodes = z.array(taxonomyNodeSchema).parse(readJson(join(ROOT, "data/taxonomy.json")));
  const codes = new Set(nodes.map((n) => n.code));
  if (codes.size !== nodes.length) throw new Error("duplicate codes");
  for (const n of nodes) {
    if (n.parent_code && !codes.has(n.parent_code)) throw new Error(`${n.code}: parent ${n.parent_code} missing`);
    if (n.parent_code === n.code) throw new Error(`${n.code}: self-parent`);
    let p = n.parent_code;
    const seen = new Set<string>([n.code]);
    while (p) {
      if (seen.has(p)) throw new Error(`${n.code}: parent cycle at ${p}`);
      seen.add(p);
      p = nodes.find((x) => x.code === p)?.parent_code ?? null;
    }
    if (!n.label.en || !n.label.fr) throw new Error(`${n.code}: FR+EN label required`);
  }
  const roots = nodes.filter((n) => !n.parent_code);
  if (roots.length < 10 || roots.length > 15) throw new Error(`expected ~13 parent nodes, got ${roots.length}`);
});

// --- countries ---
check("data/countries.json", () => {
  const rows = z.array(countrySchema).parse(readJson(join(ROOT, "data/countries.json")));
  if (!rows.some((c) => c.code === "DZ")) throw new Error("DZ missing");
  for (const c of rows) {
    if (!c.names.en || !c.names.fr) throw new Error(`${c.code}: FR+EN names required`);
    if (c.tz && !isValidTz(c.tz)) throw new Error(`${c.code}: unknown tz ${c.tz}`);
  }
});

// --- grade scales / language equivalences (shape + tz-free) ---
check("data/grade_scales.json", () => {
  const rows = z
    .array(z.object({ country: z.string().length(2), system: z.string().min(1), config: z.record(z.unknown()), notes: z.string().min(1) }))
    .parse(readJson(join(ROOT, "data/grade_scales.json")));
  if (rows.length < 4) throw new Error("expected FR/DE/US/CA/UK at least");
  for (const r of rows) if (!/indicative|identity|official conversion|unit-tested/i.test(r.notes)) throw new Error(`${r.country}: notes must state indicative status`);
});

check("data/language_equivalences.json", () => {
  const doc = z
    .object({
      notes: z.string().min(1),
      tests: z.record(z.object({ kind: z.enum(["score_range", "exam_name"]), unit: z.string().optional(), ranges: z.array(z.object({ min: z.number(), max: z.number().nullable().optional(), cefr: z.string() })).optional(), note: z.string().optional() })),
    })
    .parse(readJson(join(ROOT, "data/language_equivalences.json")));
  for (const [name, t] of Object.entries(doc.tests)) {
    if (t.kind === "score_range" && t.ranges && t.ranges.length) {
      for (const r of t.ranges) if (!/^A1$|^A2$|^B1$|^B2$|^C1$|^C2$/.test(r.cefr)) throw new Error(`${name}: bad cefr ${r.cefr}`);
      const sorted = [...t.ranges].sort((a, b) => b.min - a.min);
      for (let i = 1; i < sorted.length; i++) if ((sorted[i - 1]!.min) <= (sorted[i]!.min)) throw new Error(`${name}: overlapping ranges`);
    }
  }
});

// --- config ---
check("config/scoring.json", () => {
  const s = z
    .object({
      weights: z.record(z.number().positive()),
      gpa_bands: z.array(z.object({ min: z.number(), score: z.number().min(0).max(1) })).length(5),
      competitiveness_penalty_per_level: z.number().min(0).max(1),
      parent_field_partial_credit: z.number().min(0).max(1),
      verdict: z.object({ eligible_min_score: z.number(), eligible_max_competitiveness: z.number(), likely_min_score: z.number() }),
      notes: z.string(),
    })
    .parse(readJson(join(ROOT, "config/scoring.json")));
  const keys = ["level", "field", "academic", "language", "experience", "country", "funding", "deadline"];
  for (const k of keys) if (s.weights[k] === undefined) throw new Error(`missing weight ${k}`);
  if (s.verdict.likely_min_score >= s.verdict.eligible_min_score) throw new Error("likely_min_score must be < eligible_min_score");
});

check("config/planner_defaults.json", () => {
  const c = z
    .object({
      default_estimate_days: z.record(z.number().int().positive()),
      buffer_days: z.number().int().nonnegative(),
      duration_multiplier: z.number().min(1),
      notes: z.string(),
    })
    .parse(readJson(join(ROOT, "config/planner_defaults.json")));
  for (const code of ["copie-conforme", "legalisation", "traduction-assermentee", "passport-biometric", "language-test", "visa"])
    if (c.default_estimate_days[code] === undefined) throw new Error(`missing default for ${code}`);
});

check("config/holidays_dz.json", () => {
  const c = z
    .object({ timezone: z.string(), weekend_days: z.array(z.number().int().min(0).max(6)).length(2), holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)), notes: z.string() })
    .parse(readJson(join(ROOT, "config/holidays_dz.json")));
  if (c.timezone !== "Africa/Algiers") throw new Error("timezone must be Africa/Algiers");
  if (c.weekend_days.join(",") !== "5,6") throw new Error("Algerian weekend is Fri(5)+Sat(6)");
});

// --- helpers ---
function collectFacts(rule: unknown, out: { fact: string; op: string; value: unknown }[] = []) {
  if (!rule || typeof rule !== "object") return out;
  const r = rule as Record<string, unknown>;
  if (Array.isArray(r.all)) r.all.forEach((x) => collectFacts(x, out));
  else if (Array.isArray(r.any)) r.any.forEach((x) => collectFacts(x, out));
  else if (r.not) collectFacts(r.not, out);
  else if (typeof r.fact === "string") out.push({ fact: r.fact, op: String(r.op), value: r.value });
  return out;
}

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

if (failures) {
  console.error(`\n${failures}/${checked} data files failed validation.`);
  process.exit(1);
}
console.log(`ok: ${checked} data/config files valid.`);
