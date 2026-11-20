import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistItems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { allowedNextStates, flagsForProcedureCodes } from "@/lib/core/checklist";
import type { ChecklistState } from "@/lib/core/types";
import { scholarships, applications } from "@/lib/db/schema";

/**
 * PATCH /api/checklist/:id — advance the document state machine (spec F6).
 * Only forward transitions the procedure chain allows are accepted, so the
 * checklist can never reach a dead end or skip certification/translation.
 */
const PatchSchema = z
  .object({
    status: z.enum([
      "missing",
      "in_progress",
      "have_original",
      "have_certified",
      "have_translated",
      "ready",
    ]),
    document_id: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const patch = await readBody(req, PatchSchema);

    const rows = await db
      .select({ item: checklistItems, application: applications, scholarship: scholarships })
      .from(checklistItems)
      .innerJoin(applications, eq(checklistItems.applicationId, applications.id))
      .innerJoin(scholarships, eq(applications.scholarshipId, scholarships.id))
      .where(and(eq(checklistItems.id, id), eq(checklistItems.userId, user.id)))
      .limit(1);
    const row = rows[0];
    if (!row) throw ApiError.notFound("No such checklist item");

    const required = row.scholarship.requiredDocuments as { code: string; procedure_codes?: string[] }[];
    const spec = required.find((d) => d.code === row.item.docCode);
    const flags = flagsForProcedureCodes(spec?.procedure_codes);
    const current = row.item.status as ChecklistState;
    const next = patch.status as ChecklistState;

    if (next !== current && !allowedNextStates(current, flags).includes(next)) {
      throw ApiError.validation([
        { path: "status", message: `"${current}" cannot move to "${next}" for this document` },
      ]);
    }

    const cols: Record<string, unknown> = { status: next };
    if (patch.document_id !== undefined) cols.documentId = patch.document_id;
    if (patch.notes !== undefined) cols.notes = patch.notes;
    await db.update(checklistItems).set(cols).where(eq(checklistItems.id, id));

    return ok({ ok: true, status: next });
  } catch (e) {
    return errorResponse(req, e);
  }
}
