import { errorResponse, ok, localeOf } from "@/lib/http";
import { db } from "@/lib/db";
import { taxonomyFields } from "@/lib/db/schema";
import { localize, type Locale } from "@/lib/core/types";

/**
 * GET /api/taxonomy/fields?q= — autocomplete over the field taxonomy
 * (spec 8.3). Returns localized labels + synonyms matching the query.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    const locale = localeOf(req);

    const rows = await db.select().from(taxonomyFields).orderBy(taxonomyFields.code);

    const needle = q.toLowerCase();
    const matches = rows.filter((r) => {
      if (!needle) return true;
      const labels = [r.label.fr, r.label.en, r.label.ar].filter(Boolean).map((s) => s!.toLowerCase());
      const syns = Object.values(r.synonyms ?? {}).flat().map((s) => s.toLowerCase());
      return (
        r.code.toLowerCase().includes(needle) ||
        labels.some((l) => l.includes(needle)) ||
        syns.some((s) => s.includes(needle))
      );
    });

    const items = matches.slice(0, 20).map((r) => ({
      code: r.code,
      parent_code: r.parentCode,
      label: localize(r.label as never, locale),
      synonyms: (r.synonyms as Record<string, string[]>)[locale] ?? [],
    }));

    return ok({ items, content_lang: locale });
  } catch (e) {
    return errorResponse(req, e);
  }
}
