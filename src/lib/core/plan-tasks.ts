import type { PlanTaskInput } from "./timeline";
import { planLeadTimeDays } from "./timeline";
import type { Facts } from "./eligibility/facts";
import type { ScholarshipData } from "./types";
import { daysUntil } from "./dates";

/**
 * Task graph builder (spec F5 step 2). Pure: scholarship + facts in, plan
 * inputs out. The timeline back-planner then dates them.
 *
 * Durations come from procedures' typical_days when present, otherwise from
 * config/planner_defaults.json (labelled "estimate" in the UI — they are
 * planning defaults, never presented as verified facts).
 */
import PLANNER from "../../../config/planner_defaults.json";

export type BuildGraphInput = {
  scholarship: ScholarshipData;
  facts: Facts;
  today: string;
};

const DEFAULTS = PLANNER.default_estimate_days as Record<string, number>;

function estFor(code: string): number {
  return DEFAULTS[code] ?? 7;
}

export function buildTaskGraph(input: BuildGraphInput): PlanTaskInput[] {
  const { scholarship, facts } = input;
  const tasks: PlanTaskInput[] = [];
  const has = (key: string) => tasks.some((t) => t.key === key);

  // --- document + procedure chains (each doc's procedure_codes) -------------
  const mandatoryDocs = scholarship.required_documents.filter((d) => d.mandatory);
  for (const doc of mandatoryDocs) {
    const codes = doc.procedure_codes ?? [];
    let prevKey: string | null = null;
    for (const code of codes) {
      const key = `proc:${doc.code}:${code}`;
      if (has(key)) continue;
      tasks.push({
        key,
        kind: "procedure",
        estDays: estFor(code),
        dependsOn: prevKey ? [prevKey] : [],
      });
      prevKey = key;
    }
    const docKey = `doc:${doc.code}`;
    if (!has(docKey)) {
      tasks.push({
        key: docKey,
        kind: "document",
        estDays: 2,
        dependsOn: prevKey ? [prevKey] : [],
      });
    }
  }

  // --- language test when the student lacks a valid certificate -------------
  const langReq = scholarship.language_requirements[0];
  if (langReq?.lang) {
    const entry = facts.languages[langReq.lang];
    const cert = entry?.cert;
    const valid = Boolean(cert?.name) && (!cert?.valid_until || cert?.valid_until >= input.today);
    if (!valid) {
      const regKey = `lang:${langReq.lang}:register`;
      const examKey = `lang:${langReq.lang}:exam`;
      const resKey = `lang:${langReq.lang}:results`;
      if (!has(resKey)) {
        tasks.push({ key: regKey, kind: "exam", estDays: 7, dependsOn: [] });
        tasks.push({ key: examKey, kind: "exam", estDays: 3, dependsOn: [regKey] });
        tasks.push({ key: resKey, kind: "exam", estDays: 14, dependsOn: [examKey] });
      }
    }
  }

  // --- recommendation letters: request >= 21 days before deadline ----------
  if (mandatoryDocs.some((d) => d.code === "recommendation")) {
    if (!has("rec:requests")) {
      tasks.push({ key: "rec:requests", kind: "document", estDays: 21, dependsOn: [] });
    }
  }

  // --- writing: motivation letter + CV, then internal review ---------------
  const hasLetter = Boolean(
    scholarship.essay_requirements && Object.keys(scholarship.essay_requirements).length > 0,
  );
  if (hasLetter && !has("write:letter")) {
    tasks.push({ key: "write:letter", kind: "write", estDays: 7, dependsOn: [] });
    tasks.push({ key: "write:review", kind: "review", estDays: 2, dependsOn: ["write:letter"] });
  }
  if (!has("write:cv")) {
    tasks.push({ key: "write:cv", kind: "write", estDays: 3, dependsOn: [] });
  }

  // --- final check, then submission ---------------------------------------
  if (!has("check:final")) {
    tasks.push({
      key: "check:final",
      kind: "review",
      estDays: 1,
      dependsOn: tasks.filter((t) => t.kind === "write").map((t) => t.key),
    });
  }
  if (!has("submit")) {
    const mandatoryKeys = tasks
      .filter((t) => t.key.startsWith("doc:") || t.key.startsWith("proc:") || t.key.startsWith("lang:"))
      .map((t) => t.key);
    tasks.push({
      key: "submit",
      kind: "submit",
      estDays: 1,
      dependsOn: [...mandatoryKeys, "check:final"],
    });
  }

  return tasks;
}

/** Critical-path lead time the matcher asks for (spec F4.4). */
export function leadTimeFor(input: BuildGraphInput): number {
  return planLeadTimeDays(buildTaskGraph(input));
}

/** Days until the cycle deadline; null when unknown (never invented). */
export function deadlineOf(scholarship: ScholarshipData): string | null {
  return scholarship.cycle.deadline ?? null;
}

export { daysUntil };
