import { ApiError, errorResponse, ok, localeOf } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { loadCheck } from "@/lib/check-data";

/** GET /api/checks/:id — a persisted check with its findings (spec 8.3). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const data = await loadCheck(id, user.id, localeOf(req));
    if (!data) throw ApiError.notFound("No such check");
    return ok(data);
  } catch (e) {
    return errorResponse(req, e);
  }
}
