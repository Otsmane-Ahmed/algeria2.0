import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bacProfiles, wishes } from "@/lib/db/schema";
import { bacProfileData, getBacProfile } from "@/lib/app-data";
import { uuidv7 } from "@/lib/core/ids";
import { bacProfilePatchSchema } from "@/lib/core/orientation/types";
import { bacCompleteness } from "@/lib/core/orientation/chat";
import { eq } from "drizzle-orm";

/** GET /api/bac/profile -> the Mode A intake profile + completeness. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const row = await getBacProfile(user.id);
    if (!row) return ok({ profile: null, completeness: 0 });
    return ok({ profile: bacProfileData(row), completeness: bacCompleteness(bacProfileData(row)) });
  } catch (e) {
    return errorResponse(new Request("http://localhost/api/bac/profile"), e);
  }
}

const BodySchema = z
  .object({
    patch: bacProfilePatchSchema,
    confirmed: z.boolean().optional(),
    reset_wishes: z.boolean().optional(),
    checklist: z.record(z.string(), z.enum(["to_get", "in_progress", "done"])).optional(),
  })
  .strict();

/** PATCH /api/bac/profile — partial update from the chatbot or My Bac page.
 *  `confirmed` stamps confirmedAt; `reset_wishes` replaces draftWishes with
 *  the saved wish list's formation ids. */
export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const body = await readBody(req, BodySchema);
    const existing = await getBacProfile(user.id);
    const current = existing ? bacProfileData(existing) : null;

    // Merge constraint objects additively.
    const constraints =
      body.patch.constraints && current
        ? { ...current.constraints, ...body.patch.constraints }
        : (body.patch.constraints ?? (current ? undefined : {}));

    const values = {
      userId: user.id,
      id: existing?.id ?? uuidv7(),
      stream: (body.patch.stream ?? current?.stream) ?? null,
      streamOption: body.patch.streamOption ?? current?.streamOption ?? null,
      bacAverage: body.patch.bacAverage ?? current?.bacAverage ?? null,
      averageIsEstimate: body.patch.averageIsEstimate ?? current?.averageIsEstimate ?? false,
      bacYear: body.patch.bacYear ?? current?.bacYear ?? null,
      homeWilaya: body.patch.homeWilaya ?? current?.homeWilaya ?? null,
      interests: body.patch.interests ?? current?.interests ?? [],
      workStyle: (body.patch.workStyle ?? current?.workStyle) ?? null,
      practicality: (body.patch.practicality ?? current?.practicality) ?? null,
      studyLengthPref: (body.patch.studyLengthPref ?? current?.studyLengthPref) ?? null,
      constraints,
      draftWishes: current?.draftWishes ?? [],
      abroadOpenness: (body.patch.abroadOpenness ?? current?.abroadOpenness) ?? null,
      checklist: body.checklist ? { ...(existing?.checklist ?? {}), ...body.checklist } : (existing?.checklist ?? {}),
      confirmedAt:
        body.confirmed === true
          ? new Date()
          : body.confirmed === false
            ? null
            : (existing?.confirmedAt ?? null),
      updatedAt: new Date(),
    };

    if (body.reset_wishes === true) {
      await db.delete(wishes).where(eq(wishes.userId, user.id));
    }

    const saved = existing
      ? (
          await db
            .update(bacProfiles)
            .set(values)
            .where(eq(bacProfiles.userId, user.id))
            .returning()
        )[0]!
      : (await db.insert(bacProfiles).values(values).returning())[0]!;

    const data = bacProfileData(saved);
    return ok({
      profile: data,
      completeness: bacCompleteness(data),
      confirmedAt: saved.confirmedAt,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
