import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { simulateMatch } from "@/lib/matching";

/**
 * POST /api/matches/simulate — what-if panel (spec F4.6): score with profile
 * overrides, persist nothing. Only a whitelisted subset can be overridden.
 */
const SimulateSchema = z
  .object({
    gpa20: z.number().min(0).max(20).nullable().optional(),
    current_level: z.enum(["bac", "licence", "master", "doctorate", "other"]).nullable().optional(),
    target_level: z
      .enum(["bac", "licence", "master", "doctorate", "phd_internship", "other"])
      .nullable()
      .optional(),
    target_countries: z.array(z.string().max(10)).max(20).optional(),
    target_fields: z.array(z.string().max(120)).max(20).optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const patch = await readBody(req, SimulateSchema);

    const overrides: Record<string, unknown> = {};
    if ("gpa20" in patch) overrides.gpa20 = patch.gpa20;
    if ("current_level" in patch) overrides.currentLevel = patch.current_level;
    if ("target_level" in patch) overrides.targetLevel = patch.target_level;
    if (patch.target_countries) overrides.targetCountries = patch.target_countries;
    if (patch.target_fields) overrides.targetFields = patch.target_fields;

    const items = await simulateMatch(user.id, overrides as never);
    return ok({ items });
  } catch (e) {
    return errorResponse(req, e);
  }
}
