import { ApiError, errorResponse, ok, localeOf } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { matchRuns, matches, scholarships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { localize } from "@/lib/core/types";

/** GET /api/matches/:runId — one run with its items (spec 8.3). */
export async function GET(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { runId } = await ctx.params;
    const locale = localeOf(req);

    const runs = await db
      .select()
      .from(matchRuns)
      .where(and(eq(matchRuns.id, runId), eq(matchRuns.userId, user.id)))
      .limit(1);
    const run = runs[0];
    if (!run) throw ApiError.notFound("No such match run");

    const rows = await db
      .select({ match: matches, scholarship: scholarships })
      .from(matches)
      .innerJoin(scholarships, eq(matches.scholarshipId, scholarships.id))
      .where(eq(matches.runId, run.id));

    return ok({
      run: {
        id: run.id,
        created_at: run.createdAt,
        catalog_version: run.catalogVersion,
      },
      items: rows.map((r) => ({
        match_id: r.match.id,
        slug: r.scholarship.slug,
        name: localize(r.scholarship.name as never, locale),
        provider: (r.scholarship.provider as { name?: string })?.name ?? null,
        verdict: r.match.verdict,
        score: r.match.score,
        factors: r.match.factors,
        blockers: r.match.blockers,
        missing_info: r.match.missingInfo,
        days_to_deadline: r.match.daysToDeadline,
        needs_verification: r.scholarship.needsVerification,
      })),
      content_lang: locale,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
