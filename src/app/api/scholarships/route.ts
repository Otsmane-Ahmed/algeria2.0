import { errorResponse, ok, localeOf } from "@/lib/http";
import { db } from "@/lib/db";
import { scholarships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { localize } from "@/lib/core/types";

/**
 * GET /api/scholarships?limit=&cursor= — published catalog (spec 8.3).
 * Read-only, session optional (the landing page also uses it).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
    const locale = localeOf(req);

    const rows = await db
      .select()
      .from(scholarships)
      .where(eq(scholarships.status, "published"))
      .orderBy(scholarships.slug)
      .limit(limit);

    return ok({
      items: rows.map((s) => ({
        slug: s.slug,
        name: localize(s.name as never, locale),
        provider: (s.provider as { name?: string })?.name ?? null,
        host_countries: s.hostCountries,
        levels: s.levels,
        needs_verification: s.needsVerification,
        deadline: (s.cycle as { deadline?: string | null })?.deadline ?? null,
      })),
      next_cursor: rows.length === limit ? String(limit) : null,
      content_lang: locale,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
