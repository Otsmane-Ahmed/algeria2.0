import { ApiError, errorResponse, localeOf } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getApplication, getAppTasks, scholarshipData, text } from "@/lib/app-data";
import { buildPdf } from "@/lib/pdf";
import type { Locale } from "@/lib/core/types";

/**
 * GET /api/applications/:id/plan.pdf — downloadable plan (spec F8).
 * fr/en render as a real PDF; `ar` redirects to the printable HTML view,
 * because the hand-rolled writer has no Arabic shaping (documented in README).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const locale = localeOf(req);
    const row = await getApplication(user.id, id);
    if (!row) throw ApiError.notFound("No such application");

    if (locale === "ar") {
      return Response.redirect(new URL(`/print/plan/${id}`, req.url), 302);
    }

    const app = row.application;
    const data = scholarshipData(row.scholarship);
    const tasks = await getAppTasks(id);
    const l = labels(locale);

    const bytes = buildPdf(`SAFAR plan - ${text(data.name, locale)}`, [
      { text: text(data.name, locale), size: 18, bold: true, gap: 4 },
      {
        text: `${l.deadline}: ${data.cycle.deadline ?? l.unknown}  |  ${l.target}: ${app.targetSubmissionDate ?? l.unknown}`,
        size: 10,
        gap: 2,
      },
      { text: `${l.feasibility}: ${app.feasibility ?? l.unknown}  |  ${l.status}: ${app.status}`, size: 10, gap: 14 },
      { text: l.tasks, size: 13, bold: true, gap: 6 },
      ...tasks.flatMap((t) => [
        {
          text: `${t.dueDate}  ${statusMark(t.status, l)}  ${text(t.title, locale)}${t.isCritical ? "  *" : ""}`,
          size: 10.5,
          gap: 1,
        },
        ...(t.detail && (t.detail as { estimate?: string }).estimate === "true"
          ? [{ text: l.estimate, size: 8.5, gap: 4 }]
          : []),
      ]),
      { text: l.note, size: 8.5 },
    ]);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="safar-plan-${id}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}

type Labels = {
  deadline: string;
  target: string;
  feasibility: string;
  status: string;
  tasks: string;
  estimate: string;
  note: string;
  unknown: string;
  todo: string;
  doing: string;
  done: string;
  blocked: string;
};

function labels(locale: Locale): Labels {
  if (locale === "fr") {
    return {
      deadline: "Date limite", target: "Dépôt visé", feasibility: "Faisabilité", status: "Statut",
      tasks: "Plan d'action", estimate: "Durée estimée (valeur par défaut)",
      note: "* tâche critique. Les dates non vérifiées sont des estimations à +60 jours.",
      unknown: "inconnue", todo: "[ ]", doing: "[~]", done: "[x]", blocked: "[!]",
    };
  }
  return {
    deadline: "Deadline", target: "Target submission", feasibility: "Feasibility", status: "Status",
    tasks: "Action plan", estimate: "Estimated duration (default value)",
    note: "* critical task. Unverified dates are +60 day estimates.",
    unknown: "unknown", todo: "[ ]", doing: "[~]", done: "[x]", blocked: "[!]",
  };
}

function statusMark(status: string, l: Labels) {
  if (status === "done") return l.done;
  if (status === "doing") return l.doing;
  if (status === "blocked") return l.blocked;
  return l.todo;
}
