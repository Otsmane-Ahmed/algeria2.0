import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { applications, checklistItems, scholarships, tasks } from "./db/schema";
import { uuidv7 } from "./core/ids";
import { buildTaskGraph, deadlineOf } from "./core/plan-tasks";
import { buildPlan, type PlannedTask } from "./core/timeline";
import { buildChecklist } from "./core/checklist";
import { deriveFacts } from "./core/eligibility/facts";
import { getProfile, profileData, scholarshipData } from "./app-data";
import type { ScholarshipData } from "./core/types";
import PLANNER from "../../config/planner_defaults.json";

/**
 * Application lifecycle (spec F5/F6): create or rebuild the dated task plan
 * and the document checklist for one scholarship. Pure core logic does the
 * dating; this module only persists.
 *
 * Replan preserves human progress: task status/completed_at and checklist
 * status/document_id are kept when the graph key still exists.
 */

const BUFFER_DAYS = PLANNER.buffer_days as number;

export type PlanApplicationResult = {
  applicationId: string;
  feasibility: "ok" | "tight" | "impossible";
  targetSubmissionDate: string;
  taskCount: number;
  checklistCount: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Task titles: scholarship data when it has one, otherwise a fixed trilingual label. */
const GENERIC_TITLES: Record<string, { en: string; fr: string; ar: string }> = {
  "write:letter": { en: "Write the motivation letter", fr: "Rédiger la lettre de motivation", ar: "اكتب رسالة الدافع" },
  "write:review": { en: "Review the letter", fr: "Relire la lettre", ar: "راجع الرسالة" },
  "write:cv": { en: "Update the CV", fr: "Mettre à jour le CV", ar: "حدّث السيرة الذاتية" },
  "check:final": { en: "Run the pre-submission check", fr: "Lancer le contrôle final", ar: "شغّل الفحص النهائي" },
  submit: { en: "Submit the application", fr: "Déposer la candidature", ar: "قدّم الطلب" },
  "rec:requests": { en: "Request recommendation letters", fr: "Demander les lettres de recommandation", ar: "اطلب رسائل التوصية" },
};

const LANG_STEPS: Record<string, { en: string; fr: string; ar: string }> = {
  register: { en: "Register for the language test", fr: "S'inscrire au test de langue", ar: "سجّل في اختبار اللغة" },
  exam: { en: "Take the language test", fr: "Passer le test de langue", ar: "ادخل اختبار اللغة" },
  results: { en: "Get the language test results", fr: "Recevoir les résultats du test", ar: "استلم نتائج الاختبار" },
};

function taskTitle(key: string, scholarship: ScholarshipData): Record<string, string> {
  if (key.startsWith("doc:")) {
    const doc = scholarship.required_documents.find((d) => d.code === key.slice(4));
    if (doc) return doc.label as Record<string, string>;
  }
  if (GENERIC_TITLES[key]) return GENERIC_TITLES[key];
  if (key.startsWith("lang:")) {
    const step = key.split(":")[2];
    if (step && LANG_STEPS[step]) return LANG_STEPS[step];
  }
  if (key.startsWith("proc:")) {
    const code = key.split(":")[2] ?? key;
    return { en: code, fr: code, ar: code };
  }
  return { en: key, fr: key, ar: key };
}

/** Durations that came from planner defaults are labelled "estimate" (spec 6.4). */
function detailFor(key: string): Record<string, string> | null {
  if (
    key.startsWith("proc:") ||
    key.startsWith("lang:") ||
    key.startsWith("write:") ||
    key.startsWith("check:") ||
    key === "rec:requests" ||
    key === "submit"
  ) {
    return { estimate: "true" };
  }
  return null;
}

export async function createApplication(
  userId: string,
  scholarshipRow: typeof scholarships.$inferSelect,
): Promise<PlanApplicationResult> {
  const scholarship = scholarshipData(scholarshipRow);
  const existing = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        eq(applications.scholarshipId, scholarshipRow.id),
        eq(applications.cycleId, scholarship.cycle.cycle_id),
      ),
    )
    .limit(1);
  if (existing[0]) return replanApplication(userId, existing[0].id);

  const applicationId = uuidv7();
  const plan = await computePlan(userId, scholarship);
  await db.insert(applications).values({
    id: applicationId,
    userId,
    scholarshipId: scholarshipRow.id,
    cycleId: scholarship.cycle.cycle_id,
    status: "planning",
    targetSubmissionDate: plan.targetSubmit,
    feasibility: plan.feasibility,
  });
  await persistTasks(userId, applicationId, scholarship, plan.tasks);
  await persistChecklist(userId, applicationId, scholarship);

  return {
    applicationId,
    feasibility: plan.feasibility,
    targetSubmissionDate: plan.targetSubmit,
    taskCount: plan.tasks.length,
    checklistCount: buildChecklist(scholarship.required_documents).length,
  };
}

export async function replanApplication(
  userId: string,
  applicationId: string,
): Promise<PlanApplicationResult> {
  const rows = await db
    .select({ application: applications, scholarship: scholarships })
    .from(applications)
    .innerJoin(scholarships, eq(applications.scholarshipId, scholarships.id))
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("not_found");

  const scholarship = scholarshipData(row.scholarship);
  const plan = await computePlan(userId, scholarship);

  await db
    .update(applications)
    .set({
      targetSubmissionDate: plan.targetSubmit,
      feasibility: plan.feasibility,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId));

  await persistTasks(userId, applicationId, scholarship, plan.tasks);
  await persistChecklist(userId, applicationId, scholarship);

  return {
    applicationId,
    feasibility: plan.feasibility,
    targetSubmissionDate: plan.targetSubmit,
    taskCount: plan.tasks.length,
    checklistCount: buildChecklist(scholarship.required_documents).length,
  };
}

async function computePlan(userId: string, scholarship: ScholarshipData) {
  const profile = await getProfile(userId);
  const facts = deriveFacts(profile ? profileData(profile) : emptyProfile(), todayIso());
  const graph = buildTaskGraph({ scholarship, facts, today: todayIso() });
  return buildPlan({
    tasks: graph,
    deadlineDate: deadlineOf(scholarship),
    today: todayIso(),
    bufferDays: BUFFER_DAYS,
  });
}

/**
 * Upsert tasks by graph key. `dependsOn` is a uuid[] of task ids, so ids are
 * assigned first and dependencies resolved in a second pass.
 */
async function persistTasks(
  userId: string,
  applicationId: string,
  scholarship: ScholarshipData,
  planned: PlannedTask[],
) {
  const existing = await db.select().from(tasks).where(eq(tasks.applicationId, applicationId));
  const byKey = new Map(existing.filter((t) => t.key).map((t) => [t.key!, t]));
  const keep = new Set(planned.map((t) => t.key));

  // Graph keys that disappeared are removed (their history goes with them).
  const stale = existing.filter((t) => t.key && !keep.has(t.key));
  if (stale.length) {
    await db.delete(tasks).where(inArray(tasks.id, stale.map((t) => t.id)));
  }

  const inserts: (typeof tasks.$inferInsert)[] = [];
  const dateUpdates: Promise<unknown>[] = [];

  planned.forEach((t, idx) => {
    const id = byKey.get(t.key)?.id ?? uuidv7();
    const cols = {
      kind: t.kind,
      title: taskTitle(t.key, scholarship),
      detail: detailFor(t.key),
      dueDate: t.dueDate,
      startDate: t.startDate,
      estDays: t.estDays,
      isCritical: t.isCritical,
      orderIdx: idx,
      requiredDocumentCode: t.key.startsWith("doc:")
        ? t.key.slice(4)
        : t.key.startsWith("proc:")
          ? t.key.split(":")[1]
          : null,
      procedureCode: t.key.startsWith("proc:") ? t.key.split(":")[2] : null,
    };
    if (byKey.has(t.key)) {
      // status/completed_at intentionally untouched
      dateUpdates.push(db.update(tasks).set(cols).where(eq(tasks.id, id)));
    } else {
      inserts.push({ id, applicationId, userId, ...cols });
    }
  });

  if (inserts.length) await db.insert(tasks).values(inserts);
  await Promise.all(dateUpdates);

  // Second pass: dependsOn uuid[] (awaited, so the rows exist first).
  const all = await db.select().from(tasks).where(eq(tasks.applicationId, applicationId));
  const idByGraphKey = new Map(all.filter((t) => t.key).map((t) => [t.key!, t.id]));
  const plannedByKey = new Map(planned.map((t) => [t.key, t]));
  const updates: Promise<unknown>[] = [];
  for (const t of all) {
    if (!t.key) continue;
    const p = plannedByKey.get(t.key);
    if (!p) continue;
    const deps = p.dependsOn.map((d) => idByGraphKey.get(d)).filter((x): x is string => Boolean(x));
    const same = deps.length === t.dependsOn.length && deps.every((d, i) => d === t.dependsOn[i]);
    if (!same) updates.push(db.update(tasks).set({ dependsOn: deps }).where(eq(tasks.id, t.id)));
  }
  await Promise.all(updates);
}

async function persistChecklist(
  userId: string,
  applicationId: string,
  scholarship: ScholarshipData,
) {
  const rows = buildChecklist(scholarship.required_documents);
  const existing = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.applicationId, applicationId));
  const have = new Set(existing.map((c) => c.docCode));

  const stale = existing.filter((c) => !rows.some((r) => r.docCode === c.docCode));
  if (stale.length) {
    await db.delete(checklistItems).where(inArray(checklistItems.id, stale.map((c) => c.id)));
  }

  const inserts = rows
    .filter((r) => !have.has(r.docCode))
    .map((r) => ({
      id: uuidv7(),
      applicationId,
      userId,
      docCode: r.docCode,
      label: r.label as Record<string, string>,
      mandatory: r.mandatory,
      status: "missing" as const,
      notes: r.notes,
    }));
  if (inserts.length) await db.insert(checklistItems).values(inserts);
}

function emptyProfile() {
  return {
    fullNameLatin: null,
    fullNameArabic: null,
    birthDate: null,
    nationality: "DZ",
    gender: null,
    wilaya: null,
    currentLevel: null,
    currentYear: null,
    institution: null,
    faculty: null,
    fieldOfStudy: null,
    fieldFreeText: null,
    expectedGraduation: null,
    gpa20: null,
    gpaRankPercent: null,
    honors: null,
    languages: [],
    experiences: [],
    skills: [],
    targetLevel: null,
    targetFields: [],
    targetCountries: [],
    needsFullFunding: null,
    targetIntake: null,
    budgetMonthlyDzd: null,
    constraints: {},
    completeness: 0,
    confirmedAt: null,
  };
}
