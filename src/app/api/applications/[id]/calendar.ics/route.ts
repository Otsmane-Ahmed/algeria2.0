import { ApiError, errorResponse } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getApplication, getAppTasks, text } from "@/lib/app-data";
import { buildIcs, type IcsEvent } from "@/lib/ics";

/**
 * GET /api/applications/:id/calendar.ics — one VEVENT per task with 7/3/1-day
 * reminders (spec F8). UID is derived from the task id, so a re-import updates
 * existing events instead of duplicating them.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const app = await getApplication(user.id, id);
    if (!app) throw ApiError.notFound("No such application");

    const tasks = await getAppTasks(id);
    const events: IcsEvent[] = tasks.map((t) => ({
      uid: `task-${t.id}@safar.dz`,
      summary: text(t.title, "fr"),
      description: t.isCritical ? "Critical path (SAFAR)" : null,
      start: t.dueDate,
      allDay: true,
      status: t.status === "done" ? "CONFIRMED" : t.status === "blocked" ? "TENTATIVE" : "CONFIRMED",
    }));

    const ics = buildIcs("SAFAR", events);
    return new Response(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="safar-plan-${id}.ics"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
