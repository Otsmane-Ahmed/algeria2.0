import { z } from "zod";
import { ApiError, errorResponse, ok, readBody, localeOf } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getProfile, profileData } from "@/lib/app-data";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeCompleteness, missingForConfirm } from "@/lib/core/completeness";
import { uuidv7 } from "@/lib/core/ids";

/** Profile update schema (spec F3 /8.3: partial update, unknown fields rejected). */

const LanguageEntrySchema = z
  .object({
    lang: z.string().min(2).max(10),
    level: z.string().max(10).nullable().optional(),
    cert: z
      .object({
        name: z.string().max(120).nullable().optional(),
        score: z.string().max(40).nullable().optional(),
        issued: z.string().max(40).nullable().optional(),
        expires: z.string().max(40).nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .strict();

const ExperienceEntrySchema = z
  .object({
    type: z.enum(["job", "internship", "research", "publication", "volunteer", "other"]),
    title: z.string().max(200).nullable().optional(),
    org: z.string().max(200).nullable().optional(),
    start: z.string().max(40).nullable().optional(),
    end: z.string().max(40).nullable().optional(),
    detail: z.string().max(2000).nullable().optional(),
  })
  .strict();

const ProfileUpdateSchema = z
  .object({
    fullNameLatin: z.string().max(200).nullable().optional(),
    fullNameArabic: z.string().max(200).nullable().optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    nationality: z.string().max(10).nullable().optional(),
    gender: z.string().max(40).nullable().optional(),
    wilaya: z.string().max(80).nullable().optional(),
    currentLevel: z.enum(["bac", "licence", "master", "doctorate", "other"]).nullable().optional(),
    currentYear: z.number().int().min(1).max(8).nullable().optional(),
    institution: z.string().max(300).nullable().optional(),
    faculty: z.string().max(300).nullable().optional(),
    fieldOfStudy: z.string().max(120).nullable().optional(),
    fieldFreeText: z.string().max(300).nullable().optional(),
    expectedGraduation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    gpa20: z.number().min(0).max(20).nullable().optional(),
    gpaRankPercent: z.number().min(0).max(100).nullable().optional(),
    honors: z.string().max(500).nullable().optional(),
    languages: z.array(LanguageEntrySchema).max(20).optional(),
    experiences: z.array(ExperienceEntrySchema).max(50).optional(),
    skills: z.array(z.string().max(80)).max(60).optional(),
    targetLevel: z
      .enum(["bac", "licence", "master", "doctorate", "phd_internship", "other"])
      .nullable()
      .optional(),
    targetFields: z.array(z.string().max(120)).max(20).optional(),
    targetCountries: z.array(z.string().max(10)).max(20).optional(),
    needsFullFunding: z.boolean().nullable().optional(),
    targetIntake: z.string().max(40).nullable().optional(),
    budgetMonthlyDzd: z.number().int().min(0).max(10_000_000).nullable().optional(),
    constraints: z.record(z.unknown()).optional(),
  })
  .strict();



async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw ApiError.unauthenticated();
  return user;
}

/** GET /api/profile -> profile + completeness + confirm gaps. */
export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    if (!profile) return ok({ profile: null, completeness: 0, missing_for_confirm: [] });
    const data = profileData(profile);
    return ok({
      profile: data,
      completeness: computeCompleteness(data),
      missing_for_confirm: missingForConfirm(data),
    });
  } catch (e) {
    return errorResponse(new Request("http://localhost/api/profile"), e);
  }
}

/** PUT /api/profile — partial update (spec 8.3). */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const patch = await readBody(req, ProfileUpdateSchema);
    if (Object.keys(patch).length === 0) {
      throw ApiError.validation([{ path: "(root)", message: "No fields to update" }]);
    }

    const existing = await getProfile(user.id);
    const base = existing ? profileData(existing) : null;
    const merged = { ...(base ?? {}), ...patch } as Parameters<typeof computeCompleteness>[0];

    const columns: Record<string, unknown> = {
      completeness: computeCompleteness(merged),
      updatedAt: new Date(),
    };
    for (const [k, v] of Object.entries(patch)) columns[k] = v;

    if (existing) {
      await db.update(profiles).set(columns).where(eq(profiles.userId, user.id));
    } else {
      await db.insert(profiles).values({
        id: uuidv7(),
        userId: user.id,
        ...columns,
      });
    }

    const fresh = await getProfile(user.id);
    const data = fresh ? profileData(fresh) : null;
    return ok({
      profile: data,
      completeness: data ? computeCompleteness(data) : 0,
      missing_for_confirm: data ? missingForConfirm(data) : [],
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
