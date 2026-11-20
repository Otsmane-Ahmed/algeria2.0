import { ApiError, errorResponse, ok, localeOf } from "@/lib/http";
import { db } from "@/lib/db";
import { scholarships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { localize } from "@/lib/core/types";
import { scholarshipData } from "@/lib/app-data";

/** GET /api/scholarships/:slug — one scholarship, localized (spec 8.3). */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const locale = localeOf(req);
    const rows = await db
      .select()
      .from(scholarships)
      .where(eq(scholarships.slug, slug))
      .limit(1);
    const s = rows[0];
    if (!s || s.status !== "published") throw ApiError.notFound("No such scholarship");
    const data = scholarshipData(s);
    return ok({
      scholarship: {
        slug: s.slug,
        name: localize(s.name as never, locale),
        provider: s.provider,
        description: localize(s.description as never, locale),
        host_countries: s.hostCountries,
        levels: s.levels,
        fields: s.fields,
        funding: s.funding,
        duration_months: s.durationMonths,
        official_page_url: s.officialPageUrl,
        application_url: s.applicationUrl,
        application_channel: s.applicationChannel,
        language_requirements: data.language_requirements,
        rules_human: s.rulesHuman,
        competitiveness: s.competitiveness,
        cycle: data.cycle,
        required_documents: data.required_documents,
        essay_requirements: data.essay_requirements,
        selection_process: s.selectionProcess,
        tips: s.tips,
        needs_verification: s.needsVerification,
        verified_at: s.verifiedAt,
      },
      content_lang: locale,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
