import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  applications,
  bacProfiles,
  checklistItems,
  documents,
  formations,
  matchRuns,
  matches,
  profiles,
  scholarships,
  tasks,
  users,
  wishes,
} from "./db/schema";
import type { Locale, ProfileData, ScholarshipData } from "./core/types";
import type { BacProfileData } from "./core/orientation/types";
import { localize } from "./core/types";
import type { SessionUser } from "./auth";

/** Server-only data access for app pages. All queries scoped by user id. */

export async function getProfile(userId: string) {
  const rows = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

/** DB profile row -> the pure ProfileData shape the core logic expects. */
export function profileData(p: NonNullable<Awaited<ReturnType<typeof getProfile>>>): ProfileData {
  return {
    fullNameLatin: p.fullNameLatin,
    fullNameArabic: p.fullNameArabic,
    birthDate: p.birthDate,
    nationality: p.nationality,
    gender: p.gender,
    wilaya: p.wilaya,
    currentLevel: p.currentLevel as ProfileData["currentLevel"],
    currentYear: p.currentYear,
    institution: p.institution,
    faculty: p.faculty,
    fieldOfStudy: p.fieldOfStudy,
    fieldFreeText: p.fieldFreeText,
    expectedGraduation: p.expectedGraduation,
    gpa20: p.gpa20,
    gpaRankPercent: p.gpaRankPercent,
    honors: p.honors,
    languages: p.languages as ProfileData["languages"],
    experiences: p.experiences as ProfileData["experiences"],
    skills: p.skills,
    targetLevel: p.targetLevel as ProfileData["targetLevel"],
    targetFields: p.targetFields,
    targetCountries: p.targetCountries,
    needsFullFunding: p.needsFullFunding,
    targetIntake: p.targetIntake,
    budgetMonthlyDzd: p.budgetMonthlyDzd,
    constraints: p.constraints,
    completeness: p.completeness,
    confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
  };
}

/** DB scholarship row -> ScholarshipData (the pure shape core scoring takes). */
export function scholarshipData(s: typeof scholarships.$inferSelect): ScholarshipData {
  return {
    slug: s.slug,
    name: s.name as ScholarshipData["name"],
    provider: s.provider as ScholarshipData["provider"],
    host_countries: s.hostCountries,
    levels: s.levels,
    fields: s.fields,
    description: s.description as ScholarshipData["description"],
    funding: s.funding as ScholarshipData["funding"],
    duration_months: s.durationMonths,
    official_page_url: s.officialPageUrl,
    application_url: s.applicationUrl,
    application_channel: s.applicationChannel,
    language_requirements: s.languageRequirements as ScholarshipData["language_requirements"],
    eligibility_rules: s.eligibilityRules as Record<string, unknown>,
    rules_human: s.rulesHuman,
    competitiveness: s.competitiveness,
    cycle: s.cycle as ScholarshipData["cycle"],
    required_documents: s.requiredDocuments as ScholarshipData["required_documents"],
    essay_requirements: s.essayRequirements as ScholarshipData["essay_requirements"],
    selection_process: s.selectionProcess,
    tips: s.tips as ScholarshipData["tips"],
    status: s.status as ScholarshipData["status"],
    needs_verification: s.needsVerification,
    verified_at: s.verifiedAt ? s.verifiedAt.toISOString() : null,
  };
}

export async function getPublishedScholarships(): Promise<
  (typeof scholarships.$inferSelect)[]
> {
  return db
    .select()
    .from(scholarships)
    .where(eq(scholarships.status, "published"))
    .orderBy(scholarships.slug);
}

/** Latest match run for a user with its items joined to scholarships. */
export async function getLatestRun(userId: string) {
  const runs = await db
    .select()
    .from(matchRuns)
    .where(eq(matchRuns.userId, userId))
    .orderBy(desc(matchRuns.createdAt))
    .limit(1);
  const run = runs[0];
  if (!run) return null;
  const items = await db
    .select({
      match: matches,
      scholarship: scholarships,
    })
    .from(matches)
    .innerJoin(scholarships, eq(matches.scholarshipId, scholarships.id))
    .where(eq(matches.runId, run.id));
  return { run, items };
}

export async function listApplications(userId: string) {
  return db
    .select({
      application: applications,
      scholarship: scholarships,
    })
    .from(applications)
    .innerJoin(scholarships, eq(applications.scholarshipId, scholarships.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt));
}

export async function getApplication(userId: string, id: string) {
  const rows = await db
    .select({ application: applications, scholarship: scholarships })
    .from(applications)
    .innerJoin(scholarships, eq(applications.scholarshipId, scholarships.id))
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAppTasks(applicationId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.applicationId, applicationId))
    .orderBy(tasks.dueDate, tasks.orderIdx);
}

export async function getAppChecklist(applicationId: string) {
  return db.select().from(checklistItems).where(eq(checklistItems.applicationId, applicationId));
}

export async function listDocuments(userId: string, kind?: string) {
  return db
    .select()
    .from(documents)
    .where(
      kind
        ? and(eq(documents.userId, userId), eq(documents.kind, kind))
        : eq(documents.userId, userId),
    )
    .orderBy(desc(documents.createdAt));
}

export async function getDocument(userId: string, id: string) {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** taxonomy code -> parent code, for the matching engine's parent credit. */
export async function getParentMap(): Promise<Record<string, string | null>> {
  const { taxonomyFields } = await import("./db/schema");
  const rows = await db.select().from(taxonomyFields);
  const map: Record<string, string | null> = {};
  for (const r of rows) map[r.code] = r.parentCode;
  return map;
}

/** Localized display helper used by every page. Plain strings pass through. */
export function text(loc: unknown, locale: Locale): string {
  if (typeof loc === "string") return loc;
  return localize(loc as { en?: string; fr?: string; ar?: string } | null, locale);
}

export async function getDemoOrUser(userId: string): Promise<SessionUser | null> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export { inArray };

// --- Mode A (bac orientation) ---

export async function getBacProfile(userId: string) {
  const rows = await db.select().from(bacProfiles).where(eq(bacProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export function bacProfileData(
  p: NonNullable<Awaited<ReturnType<typeof getBacProfile>>>,
): BacProfileData {
  return {
    stream: (p.stream as BacProfileData["stream"]) ?? null,
    streamOption: p.streamOption,
    bacAverage: p.bacAverage ?? null,
    averageIsEstimate: p.averageIsEstimate,
    bacYear: p.bacYear ?? null,
    homeWilaya: p.homeWilaya,
    interests: p.interests ?? [],
    workStyle: (p.workStyle as BacProfileData["workStyle"]) ?? null,
    practicality: p.practicality,
    studyLengthPref: p.studyLengthPref,
    constraints: (p.constraints ?? {}) as BacProfileData["constraints"],
    draftWishes: p.draftWishes ?? [],
    abroadOpenness: (p.abroadOpenness as BacProfileData["abroadOpenness"]) ?? null,
  };
}

export async function listFormations() {
  return db.select().from(formations);
}

export async function listWishes(userId: string) {
  return db
    .select()
    .from(wishes)
    .where(eq(wishes.userId, userId))
    .orderBy(wishes.position);
}

/** Merge-patch the Mode A intake profile (used by /api/bac/chat and profile). */
export async function patchBacProfile(
  userId: string,
  opts: {
    patch?: Record<string, unknown>;
    constraints?: Record<string, unknown>;
    confirmed?: boolean;
  },
) {
  let existing = await getBacProfile(userId);
  if (!existing) {
    const { uuidv7 } = await import("./core/ids");
    const { bacProfiles } = await import("./db/schema");
    const inserted = await db
      .insert(bacProfiles)
      .values({ id: uuidv7(), userId })
      .returning();
    existing = inserted[0]!;
  }
  const current = bacProfileData(existing);
  const p = (opts.patch ?? {}) as Partial<BacProfileData>;
  const next: BacProfileData = {
    stream: (p.stream as BacProfileData["stream"]) ?? current.stream,
    streamOption: p.streamOption ?? current.streamOption,
    bacAverage: p.bacAverage !== undefined ? p.bacAverage : current.bacAverage,
    averageIsEstimate: p.averageIsEstimate ?? current.averageIsEstimate,
    bacYear: p.bacYear !== undefined ? p.bacYear : current.bacYear,
    homeWilaya: p.homeWilaya ?? current.homeWilaya,
    interests: p.interests ?? current.interests,
    workStyle: (p.workStyle as BacProfileData["workStyle"]) ?? current.workStyle,
    practicality: p.practicality ?? current.practicality,
    studyLengthPref: p.studyLengthPref ?? current.studyLengthPref,
    constraints:
      p.constraints !== undefined
        ? { ...current.constraints, ...p.constraints }
        : current.constraints,
    draftWishes: p.draftWishes ?? current.draftWishes,
    abroadOpenness: (p.abroadOpenness as BacProfileData["abroadOpenness"]) ?? current.abroadOpenness,
  };
  const { bacProfiles } = await import("./db/schema");
  const updated = await db
    .update(bacProfiles)
    .set({
      stream: next.stream,
      streamOption: next.streamOption,
      bacAverage: next.bacAverage,
      averageIsEstimate: next.averageIsEstimate,
      bacYear: next.bacYear,
      homeWilaya: next.homeWilaya,
      interests: next.interests,
      workStyle: next.workStyle,
      practicality: next.practicality,
      studyLengthPref: next.studyLengthPref,
      constraints: next.constraints,
      draftWishes: next.draftWishes,
      abroadOpenness: next.abroadOpenness,
      ...(opts.confirmed === true ? { confirmedAt: new Date() } : {}),
      ...(opts.confirmed === false ? { confirmedAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(bacProfiles.userId, userId))
    .returning();
  return updated[0]!;
}
