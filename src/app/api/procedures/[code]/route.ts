import { ApiError, errorResponse, ok, localeOf } from "@/lib/http";
import { db } from "@/lib/db";
import { procedures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { localize } from "@/lib/core/types";

/**
 * GET /api/procedures/:code — one Algerian procedure guide (spec F6).
 * Bodies exist in EN only in this seed (documented in README); the UI falls
 * back fr -> en per spec 8.1.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const locale = localeOf(req);
    const rows = await db.select().from(procedures).where(eq(procedures.code, code)).limit(1);
    const p = rows[0];
    if (!p) throw ApiError.notFound("No such procedure");

    const steps = (p.steps as Record<string, unknown>[]).map((s) => ({
      order: s.order,
      title: localize(s.title as never, locale),
      body: localize(s.body as never, locale),
      where: s.where ? localize(s.where as never, locale) : null,
      cost_dzd: s.cost_dzd ?? null,
      typical_days: s.typical_days ?? null,
      documents_needed: s.documents_needed ?? [],
      warnings: Array.isArray(s.warnings)
        ? (s.warnings as never[]).map((w) => localize(w, locale))
        : [],
    }));

    return ok({
      procedure: {
        code: p.code,
        title: localize(p.title as never, locale),
        summary: p.summary ? localize(p.summary as never, locale) : null,
        steps,
        typical_total_days: p.typicalTotalDays,
        official_links: p.officialLinks,
        needs_verification: p.needsVerification,
        verified_at: p.verifiedAt,
      },
      content_lang: locale,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
