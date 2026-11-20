import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { draftVersions, drafts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "@/lib/core/ids";

/**
 * POST /api/drafts/:id/restore/:version_no — make an older version current
 * (spec 8.3). The restored content is copied forward as a new version, so the
 * history stays append-only and nothing is lost by restoring.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; version_no: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id, version_no } = await ctx.params;
    const versionNo = Number.parseInt(version_no, 10);
    if (!Number.isInteger(versionNo) || versionNo < 1) throw ApiError.notFound("No such version");

    const rows = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)))
      .limit(1);
    const draft = rows[0];
    if (!draft) throw ApiError.notFound("No such draft");

    const source = await db
      .select()
      .from(draftVersions)
      .where(and(eq(draftVersions.draftId, draft.id), eq(draftVersions.versionNo, versionNo)))
      .limit(1);
    if (!source[0]) throw ApiError.notFound("No such version");

    const all = await db
      .select({ versionNo: draftVersions.versionNo })
      .from(draftVersions)
      .where(eq(draftVersions.draftId, draft.id));
    const maxNo = all.reduce((m, v) => Math.max(m, v.versionNo), 0);

    const newId = uuidv7();
    await db.insert(draftVersions).values({
      id: newId,
      draftId: draft.id,
      versionNo: maxNo + 1,
      contentMd: source[0].contentMd,
      wordCount: source[0].wordCount,
      source: "user",
      instruction: `restore:${versionNo}`,
    });
    await db
      .update(drafts)
      .set({ currentVersionId: newId, updatedAt: new Date() })
      .where(eq(drafts.id, draft.id));

    return ok({ version_id: newId, version_no: maxNo + 1 });
  } catch (e) {
    return errorResponse(req, e);
  }
}
