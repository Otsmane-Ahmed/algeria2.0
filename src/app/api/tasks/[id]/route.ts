import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * PATCH /api/tasks/:id — {status?, due_date?} (spec 8.3 / F5).
 * due_date accepts an explicit override; the task then stops being moved by
 * replans only if the graph key still exists (replan resets dates by design,
 * documented in README).
 */
const PatchSchema = z
  .object({
    status: z.enum(["todo", "doing", "done", "blocked"]).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const patch = await readBody(req, PatchSchema);
    if (Object.keys(patch).length === 0) {
      throw ApiError.validation([{ path: "(root)", message: "No fields to update" }]);
    }

    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .limit(1);
    if (!rows[0]) throw ApiError.notFound("No such task");

    const cols: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      cols.status = patch.status;
      cols.completedAt = patch.status === "done" ? new Date() : null;
    }
    if (patch.due_date !== undefined) cols.dueDate = patch.due_date;
    await db.update(tasks).set(cols).where(eq(tasks.id, id));
    return ok({ ok: true });
  } catch (e) {
    return errorResponse(req, e);
  }
}
