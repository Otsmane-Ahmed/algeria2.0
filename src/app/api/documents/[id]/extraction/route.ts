import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { documentPages, documents, extractions, profiles } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { computeCompleteness, missingForConfirm } from "@/lib/core/completeness";
import { profileData } from "@/lib/app-data";
import { uuidv7 } from "@/lib/core/ids";

async function ownedExtraction(req: Request, documentId: string) {
  const user = await getSessionUser();
  if (!user) throw ApiError.unauthenticated();
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .limit(1);
  const doc = docs[0];
  if (!doc) throw ApiError.notFound("No such document");
  const exts = await db
    .select()
    .from(extractions)
    .where(eq(extractions.documentId, doc.id))
    .orderBy(desc(extractions.createdAt))
    .limit(1);
  return { user, doc, extraction: exts[0] ?? null };
}

async function pageText(documentId: string): Promise<string> {
  const pages = await db
    .select({ ocrText: documentPages.ocrText, pageNo: documentPages.pageNo })
    .from(documentPages)
    .where(eq(documentPages.documentId, documentId))
    .orderBy(documentPages.pageNo);
  return pages
    .filter((p) => p.ocrText)
    .map((p) => `p.${p.pageNo}: ${p.ocrText}`)
    .join("\n");
}

/** GET /api/documents/:id/extraction — latest extraction + confidences. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { extraction, doc } = await ownedExtraction(req, id);
    const text = await pageText(doc.id);
    if (!extraction) {
      return ok({ extraction: null, document_status: doc.status, error_code: doc.errorCode, text });
    }
    return ok({
      extraction: {
        id: extraction.id,
        status: extraction.status,
        raw: extraction.raw,
        field_confidence: extraction.fieldConfidence,
        warnings: extraction.warnings,
        confirmed: Boolean(extraction.confirmedByUserAt),
        created_at: extraction.createdAt,
      },
      document_status: doc.status,
      error_code: doc.errorCode,
      text,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}

const ConfirmSchema = z
  .object({
    values: z.record(z.unknown()),
    /** Apply the accepted values to the profile too (default true). */
    write_profile: z.boolean().optional(),
  })
  .strict();

/**
 * POST /api/documents/:id/extraction/confirm {values} — accepts the reviewed
 * values and optionally writes them into the profile (spec F3 step 2).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, doc, extraction } = await ownedExtraction(req, id);
    const { values, write_profile = true } = await readBody(req, ConfirmSchema);

    if (extraction) {
      await db
        .update(extractions)
        .set({ status: "confirmed", confirmedByUserAt: new Date() })
        .where(eq(extractions.id, extraction.id));
    }
    await db
      .update(documents)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(documents.id, doc.id));

    if (!write_profile) return ok({ confirmed: true, completeness: null });

    const patch = mapValuesToProfile(values);
    const rows = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
    const existing = rows[0];
    const base = existing ? profileData(existing) : null;
    const merged = { ...(base ?? {}), ...patch };
    const cols: Record<string, unknown> = {
      completeness: computeCompleteness(merged),
      updatedAt: new Date(),
      ...patch,
    };
    if (existing) {
      await db.update(profiles).set(cols).where(eq(profiles.userId, user.id));
    } else {
      await db.insert(profiles).values({ id: uuidv7(), userId: user.id, ...cols });
    }

    const fresh = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
    const data = fresh[0] ? profileData(fresh[0]) : null;
    return ok({
      confirmed: true,
      completeness: data ? computeCompleteness(data) : 0,
      missing_for_confirm: data ? missingForConfirm(data) : [],
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}

/** Map extraction-shaped values onto profile columns (only known fields). */
function mapValuesToProfile(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  const name = str(values.full_name_latin);
  if (name) out.fullNameLatin = name;
  const nameAr = str(values.full_name_arabic);
  if (nameAr) out.fullNameArabic = nameAr;
  const birth = str(values.birth_date);
  if (birth && /^\d{4}-\d{2}-\d{2}$/.test(birth)) out.birthDate = birth;
  const inst = str(values.institution_name);
  if (inst) out.institution = inst;
  const fac = str(values.faculty);
  if (fac) out.faculty = fac;
  const level = str(values.level);
  if (level && ["bac", "licence", "master", "doctorate", "other"].includes(level)) {
    out.currentLevel = level;
  }
  const year = num(values.year);
  if (year && year >= 1 && year <= 8) out.currentYear = year;
  const field = str(values.field_free_text);
  if (field) out.fieldFreeText = field;
  const gpa = num(values.average_20);
  if (gpa !== undefined && gpa >= 0 && gpa <= 20) out.gpa20 = gpa;
  const rank = num(values.rank_percent);
  if (rank !== undefined && rank >= 0 && rank <= 100) out.gpaRankPercent = rank;
  return out;
}
