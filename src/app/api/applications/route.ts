import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scholarships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createApplication } from "@/lib/plan";

/**
 * POST /api/applications {slug} — track a scholarship and build its plan
 * (spec F5: graph -> back-plan -> persist tasks + checklist). Idempotent per
 * (user, scholarship, cycle): an existing application is replanned instead.
 */
const CreateSchema = z.object({ slug: z.string().min(1).max(120) }).strict();

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { slug } = await readBody(req, CreateSchema);

    const rows = await db
      .select()
      .from(scholarships)
      .where(eq(scholarships.slug, slug))
      .limit(1);
    const scholarship = rows[0];
    if (!scholarship || scholarship.status !== "published") {
      throw ApiError.notFound("No such scholarship");
    }

    const result = await createApplication(user.id, scholarship);
    return ok(result, { status: 201 });
  } catch (e) {
    return errorResponse(req, e);
  }
}
