import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getProfile, profileData } from "@/lib/app-data";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeCompleteness, missingForConfirm } from "@/lib/core/completeness";

/**
 * POST /api/profile/confirm — validates required fields then sets
 * confirmed_at (spec F3 acceptance: match runs only on a confirmed profile).
 */
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();

    const profile = await getProfile(user.id);
    if (!profile) {
      throw ApiError.validation([{ path: "(root)", message: "No profile yet" }]);
    }
    const data = profileData(profile);
    const missing = missingForConfirm(data);
    if (missing.length > 0) {
      throw ApiError.validation(
        missing.map((f) => ({ path: f, message: "Required to confirm your profile" })),
      );
    }

    await db
      .update(profiles)
      .set({ confirmedAt: new Date(), completeness: computeCompleteness(data), updatedAt: new Date() })
      .where(eq(profiles.userId, user.id));

    const fresh = await getProfile(user.id);
    return ok({
      confirmed: true,
      completeness: fresh ? computeCompleteness(profileData(fresh)) : 0,
    });
  } catch (e) {
    return errorResponse(new Request("http://localhost/api/profile/confirm"), e);
  }
}
