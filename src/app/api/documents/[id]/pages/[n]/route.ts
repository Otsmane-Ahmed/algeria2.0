import { ApiError, errorResponse } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { documentPages, documents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getFile } from "@/lib/storage";
import { rasterizePdfPage } from "@/lib/pdfjs";

/**
 * GET /api/documents/:id/pages/:n — serves one page image to the owner.
 *
 * Images are returned from storage as-is; PDF pages are rasterized on demand
 * (there is no signed-URL flow in this build: every read is authenticated).
 * Never serves another user's file: 404 on ownership failure (spec 8.1).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; n: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id, n } = await ctx.params;
    const pageNo = Number.parseInt(n, 10);
    if (!Number.isInteger(pageNo) || pageNo < 1 || pageNo > 100) {
      throw ApiError.notFound("No such page");
    }

    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
      .limit(1);
    const doc = rows[0];
    if (!doc) throw ApiError.notFound("No such document");

    if (doc.mime === "application/pdf") {
      const data = await getFile(doc.storageKey);
      const raster = await rasterizePdfPage(data, pageNo, 1600);
      if (!raster) throw ApiError.notFound("No such page");
      return new Response(new Uint8Array(raster.jpeg), {
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "private, max-age=300",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (pageNo !== 1) throw ApiError.notFound("No such page");
    const pages = await db
      .select()
      .from(documentPages)
      .where(eq(documentPages.documentId, doc.id))
      .limit(1);
    if (!pages[0]) throw ApiError.notFound("No such page");
    const data = await getFile(doc.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": doc.mime ?? "application/octet-stream",
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
