import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFindings, checks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * PATCH /api/check-findings/:id — {resolved} (spec F9.5: the student decides
 * what to act on; resolving never rewrites the finding itself).
 */
const PatchSchema = z.object({ resolved: z.boolean() }).strict();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const body = await readBody(req, PatchSchema);

    const rows = await db
      .select({ finding: checkFindings })
      .from(checkFindings)
      .innerJoin(checks, eq(checkFindings.checkId, checks.id))
      .where(and(eq(checkFindings.id, id), eq(checks.userId, user.id)))
      .limit(1);
    if (!rows[0]) throw ApiError.notFound("No such finding");

    await db.update(checkFindings).set({ resolved: body.resolved }).where(eq(checkFindings.id, id));
    return ok({ ok: true });
  } catch (e) {
    return errorResponse(req, e);
  }
}
