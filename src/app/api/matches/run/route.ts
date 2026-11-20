import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { runMatch } from "@/lib/matching";

/**
 * POST /api/matches/run — deterministic match run (spec F4).
 * Requires a confirmed profile; 422 with code profile_not_confirmed otherwise.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    try {
      const result = await runMatch(user.id);
      return ok({ run_id: result.runId, items: result.items }, { status: 201 });
    } catch (e) {
      if (e instanceof Error && e.message === "profile_not_confirmed") {
        throw new ApiError("profile_not_confirmed", 422, "Confirm your profile before running a match.");
      }
      if (e instanceof Error && e.message === "no_profile") {
        throw ApiError.validation([{ path: "(root)", message: "No profile yet" }]);
      }
      throw e;
    }
  } catch (e) {
    return errorResponse(req, e);
  }
}
