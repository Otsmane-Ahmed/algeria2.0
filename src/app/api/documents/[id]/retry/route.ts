import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { runIngestion } from "@/lib/ingest";

/**
 * POST /api/documents/:id/retry — re-runs extraction after a failure
 * (spec F1 edge case: retry is idempotent; a confirmed document is skipped).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
      .limit(1);
    const doc = rows[0];
    if (!doc) throw ApiError.notFound("No such document");
    if (doc.status === "confirmed") throw ApiError.conflict("Document already confirmed");

    void runIngestion(doc.id).catch((e) => console.error(`[ingest-retry] ${doc.id}:`, e));
    return ok({ status: "processing" }, { status: 202 });
  } catch (e) {
    return errorResponse(req, e);
  }
}
