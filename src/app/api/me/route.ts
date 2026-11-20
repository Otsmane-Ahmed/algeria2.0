import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getProfile, profileData } from "@/lib/app-data";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeCompleteness } from "@/lib/core/completeness";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw ApiError.unauthenticated();
  return user;
}

/** GET /api/me -> {user, profile_completeness, plan, quotas} (spec 8.3). */
export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        role: user.role,
        plan: user.plan,
        mode: user.mode as "bac" | "abroad",
      },
      profile_completeness: profile?.completeness ?? 0,
      plan: user.plan,
      quotas: {
        ai_calls_per_day: Number(process.env.FREE_TIER_AI_CALLS_PER_DAY ?? 40),
      },
    });
  } catch (e) {
    return errorResponse(new Request("http://localhost/api/me"), e);
  }
}

const PatchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    locale: z.enum(["ar", "fr", "en"]).optional(),
    marketing_opt_in: z.boolean().optional(),
    mode: z.enum(["bac", "abroad"]).optional(),
  })
  .strict();

/** PATCH /api/me {name?, locale?, marketing_opt_in?} (spec 8.3). */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const patch = await readBody(req, PatchSchema);
    if (Object.keys(patch).length === 0) {
      throw ApiError.validation([{ path: "(root)", message: "No fields to update" }]);
    }
    const updated = await db
      .update(users)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
        ...(patch.marketing_opt_in !== undefined ? { marketingOptIn: patch.marketing_opt_in } : {}),
        ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();
    const u = updated[0]!;
    const profile = await getProfile(user.id);
    return ok({
      user: { id: u.id, email: u.email, name: u.name, locale: u.locale, mode: u.mode as "bac" | "abroad", role: u.role, plan: u.plan },
      profile_completeness: profile ? computeCompleteness(profileData(profile)) : 0,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
