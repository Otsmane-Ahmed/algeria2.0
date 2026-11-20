import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { draftVersions, drafts } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { uuidv7 } from "@/lib/core/ids";
import { countWords } from "@/lib/core/checker/rules";

/** GET /api/drafts/:id — draft + current content + version list (spec F7). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const rows = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)))
      .limit(1);
    const draft = rows[0];
    if (!draft) throw ApiError.notFound("No such draft");

    const versions = await db
      .select()
      .from(draftVersions)
      .where(eq(draftVersions.draftId, draft.id))
      .orderBy(desc(draftVersions.versionNo));

    const current = versions.find((v) => v.id === draft.currentVersionId) ?? versions[0];
    return ok({
      draft: {
        id: draft.id,
        application_id: draft.applicationId,
        kind: draft.kind,
        language: draft.language,
        title: draft.title,
        updated_at: draft.updatedAt,
      },
      content_md: current?.contentMd ?? "",
      word_count: current?.wordCount ?? 0,
      base_version_id: current?.id ?? null,
      versions: versions.map((v) => ({
        id: v.id,
        version_no: v.versionNo,
        word_count: v.wordCount,
        source: v.source,
        created_at: v.createdAt,
      })),
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}

const PutSchema = z
  .object({
    content_md: z.string().max(100_000),
    /** Optimistic concurrency: the version the client last saw. */
    base_version_id: z.string().uuid().optional(),
  })
  .strict();

/**
 * PUT /api/drafts/:id — save an edit as a new version (spec F7.4 autosave).
 * 409 when base_version_id is stale (another tab saved first).
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const body = await readBody(req, PutSchema);

    const rows = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)))
      .limit(1);
    const draft = rows[0];
    if (!draft) throw ApiError.notFound("No such draft");

    if (body.base_version_id && draft.currentVersionId !== body.base_version_id) {
      throw ApiError.conflict("This draft changed elsewhere. Reload before saving.");
    }

    const latest = await db
      .select({ versionNo: draftVersions.versionNo })
      .from(draftVersions)
      .where(eq(draftVersions.draftId, draft.id))
      .orderBy(desc(draftVersions.versionNo))
      .limit(1);
    const nextNo = (latest[0]?.versionNo ?? 0) + 1;
    const versionId = uuidv7();
    await db.insert(draftVersions).values({
      id: versionId,
      draftId: draft.id,
      versionNo: nextNo,
      contentMd: body.content_md,
      wordCount: countWords(body.content_md),
      source: "user",
    });
    await db
      .update(drafts)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(drafts.id, draft.id));

    return ok({
      version_id: versionId,
      version_no: nextNo,
      word_count: countWords(body.content_md),
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
