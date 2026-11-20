import { ApiError, errorResponse } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applications,
  checklistItems,
  checkFindings,
  checks,
  documents,
  draftVersions,
  drafts,
  matchRuns,
  profiles,
  tasks,
} from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/me/export — the student's own data as one JSON file (spec §7).
 * Exports only rows owned by the session user; no catalog or other users' data.
 */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();

    const [
      profile,
      docs,
      runs,
      apps,
      taskRows,
      checklistRows,
      draftRows,
      checkRows,
    ] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
      db.select().from(documents).where(eq(documents.userId, user.id)).orderBy(desc(documents.createdAt)),
      db.select().from(matchRuns).where(eq(matchRuns.userId, user.id)).orderBy(desc(matchRuns.createdAt)).limit(50),
      db.select().from(applications).where(eq(applications.userId, user.id)),
      db.select().from(tasks).where(eq(tasks.userId, user.id)),
      db.select().from(checklistItems).where(eq(checklistItems.userId, user.id)),
      db.select().from(drafts).where(eq(drafts.userId, user.id)),
      db.select().from(checks).where(eq(checks.userId, user.id)).orderBy(desc(checks.createdAt)).limit(50),
    ]);

    const draftContents = await Promise.all(
      draftRows.map(async (d) => ({
        draft: d,
        versions: await db
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, d.id))
          .orderBy(draftVersions.versionNo),
      })),
    );

    const allFindings: (typeof checkFindings.$inferSelect)[] = [];
    for (const c of checkRows) {
      const rows = await db.select().from(checkFindings).where(eq(checkFindings.checkId, c.id));
      allFindings.push(...rows);
    }

    const payload = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        created_at: user.createdAt,
      },
      profile: profile[0] ?? null,
      documents: docs,
      match_runs: runs,
      applications: apps,
      tasks: taskRows,
      checklist: checklistRows,
      drafts: draftContents,
      checks: checkRows,
      check_findings: allFindings,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="safar-export-${user.id}.json"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
