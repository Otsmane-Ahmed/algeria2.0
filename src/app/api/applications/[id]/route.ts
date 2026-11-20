import { z } from "zod";
import { ApiError, errorResponse, ok, readBody, localeOf } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, scholarships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { localize } from "@/lib/core/types";
import { getAppTasks, getAppChecklist } from "@/lib/app-data";

async function ownedApplication(userId: string, id: string) {
  const rows = await db
    .select({ application: applications, scholarship: scholarships })
    .from(applications)
    .innerJoin(scholarships, eq(applications.scholarshipId, scholarships.id))
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound("No such application");
  return row;
}

/** GET /api/applications/:id — application + tasks + checklist (spec 8.3). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const locale = localeOf(req);
    const row = await ownedApplication(user.id, id);

    const [taskRows, checklistRows] = await Promise.all([
      getAppTasks(row.application.id),
      getAppChecklist(row.application.id),
    ]);

    return ok({
      application: {
        id: row.application.id,
        status: row.application.status,
        cycle_id: row.application.cycleId,
        target_submission_date: row.application.targetSubmissionDate,
        feasibility: row.application.feasibility,
        notes: row.application.notes,
        created_at: row.application.createdAt,
        updated_at: row.application.updatedAt,
      },
      scholarship: {
        slug: row.scholarship.slug,
        name: localize(row.scholarship.name as never, locale),
        cycle: row.scholarship.cycle,
        needs_verification: row.scholarship.needsVerification,
      },
      tasks: taskRows.map((t) => ({
        id: t.id,
        key: t.key,
        kind: t.kind,
        title: localize(t.title as never, locale),
        detail: t.detail,
        due_date: t.dueDate,
        start_date: t.startDate,
        est_days: t.estDays,
        status: t.status,
        is_critical: t.isCritical,
        order_idx: t.orderIdx,
        depends_on: t.dependsOn,
        required_document_code: t.requiredDocumentCode,
        procedure_code: t.procedureCode,
      })),
      checklist: checklistRows.map((c) => ({
        id: c.id,
        doc_code: c.docCode,
        label: localize(c.label as never, locale),
        mandatory: c.mandatory,
        status: c.status,
        document_id: c.documentId,
        notes: c.notes,
      })),
      content_lang: locale,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}

const PatchSchema = z
  .object({
    status: z.enum(["planning", "preparing", "submitted", "decided", "closed"]).optional(),
    notes: z.string().max(20000).nullable().optional(),
  })
  .strict();

/** PATCH /api/applications/:id — {status?, notes?} (spec 8.3). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    await ownedApplication(user.id, id);
    const patch = await readBody(req, PatchSchema);
    if (Object.keys(patch).length === 0) {
      throw ApiError.validation([{ path: "(root)", message: "No fields to update" }]);
    }
    const cols: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) cols.status = patch.status;
    if (patch.notes !== undefined) cols.notes = patch.notes;
    await db.update(applications).set(cols).where(eq(applications.id, id));
    return ok({ ok: true });
  } catch (e) {
    return errorResponse(req, e);
  }
}
