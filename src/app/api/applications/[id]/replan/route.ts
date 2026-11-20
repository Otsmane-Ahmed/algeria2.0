import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { replanApplication } from "@/lib/plan";

/**
 * POST /api/applications/:id/replan — rebuild dates from today's profile and
 * catalog (spec F5). Task completion and checklist progress are preserved by
 * graph key; only stale keys are removed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    try {
      const result = await replanApplication(user.id, id);
      return ok(result);
    } catch (e) {
      if (e instanceof Error && e.message === "not_found") throw ApiError.notFound("No such application");
      throw e;
    }
  } catch (e) {
    return errorResponse(req, e);
  }
}
