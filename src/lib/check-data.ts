import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { checkFindings, checks } from "./db/schema";
import type { Locale } from "./core/types";

/**
 * Shared check reader (spec F9): POST returns exactly this shape, GET reads
 * the same rows, and the application page seeds its tab from the latest run.
 */
export async function loadCheck(checkId: string, userId: string, locale: Locale) {
  const rows = await db
    .select()
    .from(checks)
    .where(and(eq(checks.id, checkId), eq(checks.userId, userId)))
    .limit(1);
  const check = rows[0];
  if (!check) return null;

  const findings = await db.select().from(checkFindings).where(eq(checkFindings.checkId, check.id));
  const resolve = (loc: Record<string, string> | null | undefined) =>
    loc?.[locale] ?? loc?.fr ?? loc?.en ?? "";

  return {
    check: {
      id: check.id,
      application_id: check.applicationId,
      status: check.status,
      readiness_score: check.readinessScore,
      summary: check.summary,
      created_at: check.createdAt,
    },
    findings: findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      category: f.category,
      title: resolve(f.title),
      detail: resolve(f.detail),
      fix_hint: f.fixHint ? resolve(f.fixHint) : null,
      evidence: f.evidence,
      source: f.source,
      resolved: f.resolved,
    })),
  };
}

/** Latest finished check for one application, or null (tab starts empty). */
export async function latestCheck(applicationId: string, userId: string, locale: Locale) {
  const rows = await db
    .select({ id: checks.id })
    .from(checks)
    .where(and(eq(checks.applicationId, applicationId), eq(checks.userId, userId)))
    .orderBy(checks.createdAt)
    .limit(1);
  const last = rows[rows.length - 1];
  if (!last) return null;
  return loadCheck(last.id, userId, locale);
}
