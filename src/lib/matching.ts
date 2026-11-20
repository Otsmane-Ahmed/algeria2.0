import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { matchRuns, matches, profiles, scholarships, taxonomyFields } from "./db/schema";
import { uuidv7 } from "./core/ids";
import { deriveFacts } from "./core/eligibility/facts";
import { scoreMatch, rankItems } from "./core/eligibility/score";
import { buildTaskGraph, leadTimeFor } from "./core/plan-tasks";
import { profileData, scholarshipData } from "./app-data";
import type { ProfileData, ScholarshipData, Verdict } from "./core/types";

/**
 * Deterministic matching run (spec F4): freeze the profile, score every
 * published scholarship in-process, persist factors/blockers. No LLM anywhere
 * in this path, so identical inputs always give identical output.
 */

export type RunItem = {
  matchId: string;
  scholarshipId: string;
  slug: string;
  name: string;
  provider: string;
  verdict: Verdict;
  score: number;
  factors: unknown[];
  blockers: unknown[];
  missingInfo: string[];
  daysToDeadline: number | null;
  needsVerification: boolean;
  hostCountries: string[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function runMatch(userId: string): Promise<{ runId: string; items: RunItem[] }> {
  const profRows = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const profile = profRows[0];
  if (!profile) throw new Error("no_profile");
  if (!profile.confirmedAt) throw new Error("profile_not_confirmed");

  const data = profileData(profile);
  const facts = deriveFacts(data, todayIso());

  const rows = await db
    .select()
    .from(scholarships)
    .where(eq(scholarships.status, "published"))
    .orderBy(scholarships.slug);

  const tax = await db.select().from(taxonomyFields);
  const parentOf: Record<string, string | null> = {};
  for (const r of tax) parentOf[r.code] = r.parentCode;

  // catalog_version = SHA-256 of concatenated updated_at (spec F4.5)
  const catalogVersion = createHash("sha256")
    .update(rows.map((r) => `${r.slug}:${r.updatedAt?.getTime() ?? 0}`).join("|"))
    .digest("hex")
    .slice(0, 16);

  const runId = uuidv7();
  await db.insert(matchRuns).values({
    id: runId,
    userId,
    profileSnapshot: data as unknown as Record<string, unknown>,
    catalogVersion,
  });

  const items: RunItem[] = [];
  for (const row of rows) {
    const s = scholarshipData(row);
    const graph = buildTaskGraph({ scholarship: s, facts, today: todayIso() });
    const result = scoreMatch({
      facts,
      scholarship: s,
      today: todayIso(),
      parentOf,
      leadTimeDays: leadTimeFor({ scholarship: s, facts, today: todayIso() }),
    });

    const matchId = uuidv7();
    await db.insert(matches).values({
      id: matchId,
      runId,
      userId,
      scholarshipId: row.id,
      verdict: result.verdict,
      score: result.score,
      factors: result.factors as unknown[],
      blockers: result.blockers as unknown[],
      missingInfo: result.missingInfo,
      daysToDeadline: result.daysToDeadline,
    });

    items.push({
      matchId,
      scholarshipId: row.id,
      slug: row.slug,
      name: localizeName(row.name, data),
      provider: providerName(row.provider),
      verdict: result.verdict,
      score: result.score,
      factors: result.factors,
      blockers: result.blockers,
      missingInfo: result.missingInfo,
      daysToDeadline: result.daysToDeadline,
      needsVerification: row.needsVerification,
      hostCountries: row.hostCountries,
    });
  }

  // Spec F4.4 ranking: verdict class, score desc, nearest deadline, name.
  const ranked = rankItems(items);
  return { runId, items: ranked };
}

function localizeName(name: unknown, _p: ProfileData): string {
  const n = name as { fr?: string; en?: string; ar?: string };
  return n?.fr ?? n?.en ?? n?.ar ?? "";
}

function providerName(provider: unknown): string {
  const p = provider as { name?: string };
  return p?.name ?? "";
}

export async function getLatestRunWithItems(userId: string) {
  const runs = await db
    .select()
    .from(matchRuns)
    .where(eq(matchRuns.userId, userId))
    .orderBy(desc(matchRuns.createdAt))
    .limit(1);
  const run = runs[0];
  if (!run) return null;
  const rows = await db
    .select({ match: matches, scholarship: scholarships })
    .from(matches)
    .innerJoin(scholarships, eq(matches.scholarshipId, scholarships.id))
    .where(eq(matches.runId, run.id));
  return {
    run,
    items: rows.map((r) => ({
      match: r.match,
      scholarship: r.scholarship,
    })),
  };
}

export async function simulateMatch(
  userId: string,
  overrides: Partial<ProfileData>,
): Promise<RunItem[]> {
  const profRows = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const profile = profRows[0];
  if (!profile) throw new Error("no_profile");
  const data: ProfileData = { ...profileData(profile), ...overrides };
  const facts = deriveFacts(data, todayIso());

  const rows = await db
    .select()
    .from(scholarships)
    .where(eq(scholarships.status, "published"))
    .orderBy(scholarships.slug);
  const tax = await db.select().from(taxonomyFields);
  const parentOf: Record<string, string | null> = {};
  for (const r of tax) parentOf[r.code] = r.parentCode;

  const items: RunItem[] = [];
  for (const row of rows) {
    const s = scholarshipData(row);
    const result = scoreMatch({
      facts,
      scholarship: s,
      today: todayIso(),
      parentOf,
      leadTimeDays: leadTimeFor({ scholarship: s, facts, today: todayIso() }),
    });
    items.push({
      matchId: "",
      scholarshipId: row.id,
      slug: row.slug,
      name: localizeName(row.name, data),
      provider: providerName(row.provider),
      verdict: result.verdict,
      score: result.score,
      factors: result.factors,
      blockers: result.blockers,
      missingInfo: result.missingInfo,
      daysToDeadline: result.daysToDeadline,
      needsVerification: row.needsVerification,
      hostCountries: row.hostCountries,
    });
  }
  return rankItems(items);
}
