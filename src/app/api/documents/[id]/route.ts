import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { academicTerms, documentPages, documents, extractions } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { deletePrefix } from "@/lib/storage";

async function ownedDocument(req: Request, id: string) {
  const user = await getSessionUser();
  if (!user) throw ApiError.unauthenticated();
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
    .limit(1);
  // Spec 8.1: another user's document is 404, never 403.
  const doc = rows[0];
  if (!doc) throw ApiError.notFound("No such document");
  return { user, doc };
}

/** GET /api/documents/:id — status, warnings, pages. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { doc } = await ownedDocument(_req, id);
    const pages = await db
      .select()
      .from(documentPages)
      .where(eq(documentPages.documentId, doc.id))
      .orderBy(documentPages.pageNo);
    const latest = await db
      .select()
      .from(extractions)
      .where(eq(extractions.documentId, doc.id))
      .orderBy(desc(extractions.createdAt))
      .limit(1);

    return ok({
      document: {
        id: doc.id,
        kind: doc.kind,
        filename: doc.originalFilename,
        mime: doc.mime,
        size_bytes: doc.sizeBytes,
        page_count: doc.pageCount,
        status: doc.status,
        error_code: doc.errorCode,
        expires_on: doc.expiresOn,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt,
      },
      pages: pages.map((p) => ({
        page_no: p.pageNo,
        width: p.width,
        height: p.height,
        has_text: Boolean(p.ocrText),
        // served through the authenticated blob route below
        url: `/api/documents/${doc.id}/pages/${p.pageNo}`,
      })),
      extraction: latest[0]
        ? {
            id: latest[0].id,
            status: latest[0].status,
            warnings: latest[0].warnings,
            field_confidence: latest[0].fieldConfidence,
            confirmed: Boolean(latest[0].confirmedByUserAt),
            created_at: latest[0].createdAt,
          }
        : null,
    });
  } catch (e) {
    return errorResponse(_req, e);
  }
}

const PatchSchema = z
  .object({
    kind: z
      .enum([
        "transcript",
        "diploma",
        "bac",
        "cv",
        "passport",
        "id_card",
        "language_cert",
        "recommendation",
        "motivation_letter",
        "birth_certificate",
        "bank_statement",
        "other",
      ])
      .optional(),
    expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .strict();

/** PATCH /api/documents/:id — {kind?, expires_on?} (spec 8.3). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { doc } = await ownedDocument(req, id);
    const patch = await readBody(req, PatchSchema);
    if (Object.keys(patch).length === 0) {
      throw ApiError.validation([{ path: "(root)", message: "No fields to update" }]);
    }
    const cols: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.kind !== undefined) cols.kind = patch.kind;
    if (patch.expires_on !== undefined) cols.expiresOn = patch.expires_on;
    await db.update(documents).set(cols).where(eq(documents.id, doc.id));
    return ok({ ok: true });
  } catch (e) {
    return errorResponse(req, e);
  }
}

/** DELETE /api/documents/:id — removes files + derived rows (spec 12.3). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { doc } = await ownedDocument(req, await ctx.params.then((p) => p.id));
    // academic_terms only cascade via extractionId set-null, so remove them
    // explicitly before the extraction rows go.
    const extIds = await db
      .select({ id: extractions.id })
      .from(extractions)
      .where(eq(extractions.documentId, doc.id));
    if (extIds.length) {
      await db
        .delete(academicTerms)
        .where(inArray(academicTerms.extractionId, extIds.map((r) => r.id)));
    }
    await db.delete(documents).where(eq(documents.id, doc.id));
    await deletePrefix(doc.userId, doc.id).catch(() => undefined);
    return ok({ ok: true });
  } catch (e) {
    return errorResponse(req, e);
  }
}
