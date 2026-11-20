import type { RuleLeaf, RuleNode } from "./dsl";
import { resolveFact, type Facts } from "./facts";

export type Tri = "pass" | "fail" | "unknown";

export type EvaluatedLeaf = {
  fact: string;
  op: string;
  expected: unknown;
  actual: unknown;
  severity: "hard" | "soft";
  weight: number;
  status: Tri;
  label?: { en?: string; fr?: string; ar?: string };
  source_url?: string;
  lang?: string;
};

export type EvalResult = { tri: Tri; leaves: EvaluatedLeaf[] };

function leafResult(
  rule: RuleLeaf,
  facts: Facts,
  referenceDate: string | null,
): EvaluatedLeaf {
  const actual = resolveFact(rule.fact, facts, {
    referenceDate: rule.reference_date ?? referenceDate,
    value: rule.value,
    lang: rule.lang,
  });
  const base: EvaluatedLeaf = {
    fact: rule.lang ? `${rule.fact}.${rule.lang}` : rule.fact,
    op: rule.op,
    expected: rule.value ?? null,
    actual: actual as unknown,
    severity: rule.severity ?? "hard",
    weight: rule.weight ?? 1,
    status: "unknown",
    label: rule.label,
    source_url: rule.source_url,
    lang: rule.lang,
  };
  if (actual === null || actual === undefined) return base; // null => unknown, never pass

  // Facts that consume rule.value as their own query (e.g. has_language_cert
  // resolves to a boolean) assert the fact itself instead of comparing values.
  const selfAsserting = rule.fact === "has_language_cert";
  const want = selfAsserting ? (rule.op === "ne" ? false : true) : rule.value;

  let status: Tri;
  switch (rule.op) {
    case "eq":
      status = actual === want ? "pass" : "fail";
      break;
    case "ne":
      status = actual !== want ? "pass" : "fail";
      break;
    case "in":
      status = Array.isArray(rule.value) && rule.value.includes(actual) ? "pass" : "fail";
      break;
    case "not_in":
      status = Array.isArray(rule.value) && !rule.value.includes(actual) ? "pass" : "fail";
      break;
    case "gte":
      status = typeof actual === "number" && typeof rule.value === "number" && actual >= rule.value ? "pass" : "fail";
      break;
    case "lte":
      status = typeof actual === "number" && typeof rule.value === "number" && actual <= rule.value ? "pass" : "fail";
      break;
    case "between":
      status =
        typeof actual === "number" &&
        Array.isArray(rule.value) &&
        typeof rule.value[0] === "number" &&
        typeof rule.value[1] === "number" &&
        actual >= rule.value[0] &&
        actual <= rule.value[1]
          ? "pass"
          : "fail";
      break;
    case "includes_any":
      status =
        Array.isArray(actual) &&
        Array.isArray(rule.value) &&
        rule.value.some((x) => (actual as unknown[]).includes(x))
          ? "pass"
          : "fail";
      break;
    case "exists":
      status = "pass";
      break;
    default:
      status = "unknown";
  }
  return { ...base, status };
}

/**
 * Tri-state evaluation (spec F4.3 / appendix C):
 *  - all: any fail -> fail; else any unknown -> unknown; else pass
 *  - any:  any pass -> pass; else any unknown -> unknown; else fail
 *  - not:  invert pass/fail; unknown stays unknown
 * Hard leaves decide eligibility; soft leaves only affect the score.
 */
export function evalRule(rule: RuleNode, facts: Facts, referenceDate: string | null = null): EvalResult {
  if ("all" in rule && Array.isArray(rule.all)) {
    const rs = rule.all.map((r) => evalRule(r, facts, referenceDate));
    const tri: Tri = rs.some((r) => r.tri === "fail")
      ? "fail"
      : rs.some((r) => r.tri === "unknown")
        ? "unknown"
        : "pass";
    return { tri, leaves: rs.flatMap((r) => r.leaves) };
  }
  if ("any" in rule && Array.isArray(rule.any)) {
    const rs = rule.any.map((r) => evalRule(r, facts, referenceDate));
    const tri: Tri = rs.some((r) => r.tri === "pass")
      ? "pass"
      : rs.some((r) => r.tri === "unknown")
        ? "unknown"
        : "fail";
    return { tri, leaves: rs.flatMap((r) => r.leaves) };
  }
  if ("not" in rule) {
    const r = evalRule(rule.not, facts, referenceDate);
    const tri: Tri = r.tri === "pass" ? "fail" : r.tri === "fail" ? "pass" : "unknown";
    return { tri, leaves: r.leaves };
  }
  const leaf = leafResult(rule as RuleLeaf, facts, referenceDate);
  return { tri: leaf.status, leaves: [leaf] };
}

/** Evaluate a whole eligibility_rules document ({all: [...]}). */
export function evaluateEligibility(
  rules: { all?: RuleNode[]; any?: RuleNode[] },
  facts: Facts,
  referenceDate: string | null = null,
): EvalResult {
  const nodes: RuleNode[] = [];
  if (rules.all) nodes.push({ all: rules.all });
  if (rules.any) nodes.push({ any: rules.any });
  if (nodes.length === 0) return { tri: "pass", leaves: [] };
  const rs = nodes.map((n) => evalRule(n, facts, referenceDate));
  // top level behaves as AND over provided groups
  const tri: Tri = rs.some((r) => r.tri === "fail")
    ? "fail"
    : rs.some((r) => r.tri === "unknown")
      ? "unknown"
      : "pass";
  return { tri, leaves: rs.flatMap((r) => r.leaves) };
}
