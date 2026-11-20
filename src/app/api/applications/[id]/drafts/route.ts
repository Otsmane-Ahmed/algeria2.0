import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, drafts, draftVersions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "@/lib/core/ids";

/**
 * POST /api/applications/:id/drafts {kind, language} — create an empty draft
 * (spec F7). The first version is a blank the studio can edit.
 */
const CreateSchema = z
  .object({
    kind: z.enum(["motivation_letter", "cv"]),
    language: z.enum(["fr", "en", "ar", "darija"]),
  })
  .strict();

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const body = await readBody(req, CreateSchema);

    const apps = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
      .limit(1);
    if (!apps[0]) throw ApiError.notFound("No such application");

    const draftId = uuidv7();
    const versionId = uuidv7();
    await db.insert(drafts).values({
      id: draftId,
      applicationId: id,
      userId: user.id,
      kind: body.kind,
      language: body.language,
      title: body.kind === "motivation_letter" ? "Motivation letter" : "Curriculum vitae",
      currentVersionId: versionId,
    });
    await db.insert(draftVersions).values({
      id: versionId,
      draftId,
      versionNo: 1,
      contentMd: "",
      wordCount: 0,
      source: "user",
    });

    return ok({ draft_id: draftId }, { status: 201 });
  } catch (e) {
    return errorResponse(req, e);
  }
}
