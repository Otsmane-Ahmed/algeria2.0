import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applications,
  checkFindings,
  checks,
  checklistItems,
  documents,
  drafts,
  draftVersions,
  extractions,
  profiles,
  scholarships,
  tasks,
} from "@/lib/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { uuidv7 } from "@/lib/core/ids";
import { runLayer1, readinessScore, type ChecklistInput, type DraftInput } from "@/lib/core/checker/rules";
import { deriveFacts } from "@/lib/core/eligibility/facts";
import { scoreMatch } from "@/lib/core/eligibility/score";
import { profileData, scholarshipData, getParentMap } from "@/lib/app-data";
import { findingCopy } from "@/lib/finding-copy";
import { loadCheck } from "@/lib/check-data";
import { localeOf } from "@/lib/http";
import { getCapabilities, aiReady } from "@/lib/ai/capabilities";
import { callJSON } from "@/lib/ai/callJSON";
import { CheckFindings, build as checkPrompt } from "@/lib/ai/prompts/check.v1";

/**
 * POST /api/applications/:id/check — runs the deterministic rule layer
 * (spec F9.1) plus the AI review layer when a key exists. Persists the check
 * and its findings; the response is the same shape as GET /api/checks/:id.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const locale = localeOf(req);

    const appRows = await db
      .select({ application: applications, scholarship: scholarships })
      .from(applications)
      .innerJoin(scholarships, eq(applications.scholarshipId, scholarships.id))
      .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
      .limit(1);
    const row = appRows[0];
    if (!row) throw ApiError.notFound("No such application");

    const scholarship = scholarshipData(row.scholarship);
    const profileRow = (
      await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
    )[0];
    const profile = profileRow ? profileData(profileRow) : null;

    const [taskRows, checklistRows, draftRows, docRows, extractionRows, parentOf] =
      await Promise.all([
        db.select().from(tasks).where(eq(tasks.applicationId, id)),
        db.select().from(checklistItems).where(eq(checklistItems.applicationId, id)),
        db
          .select()
          .from(drafts)
          .where(and(eq(drafts.applicationId, id), eq(drafts.userId, user.id))),
        db.select().from(documents).where(eq(documents.userId, user.id)),
        db
          .select({ raw: extractions.raw })
          .from(extractions)
          .where(and(eq(extractions.userId, user.id), isNotNull(extractions.confirmedByUserAt))),
        getParentMap(),
      ]);

    const today = new Date().toISOString().slice(0, 10);
    const deadline = (scholarship.cycle.deadline as string | null) ?? null;

    const checklistInput: ChecklistInput[] = checklistRows.map((c) => {
      const spec = scholarship.required_documents.find((d) => d.code === c.docCode);
      const attached = c.documentId ? docRows.find((d) => d.id === c.documentId) : null;
      return {
        docCode: c.docCode,
        mandatory: c.mandatory,
        status: c.status as ChecklistInput["status"],
        procedureCodes: spec?.procedure_codes ?? [],
        attachedMime: attached?.mime ?? null,
        attachedExpiresOn: attached?.expiresOn ?? null,
      };
    });

    // Current version content per draft.
    const draftInputs: DraftInput[] = [];
    for (const d of draftRows) {
      const v = (
        await db
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, d.id))
          .orderBy(desc(draftVersions.versionNo))
          .limit(1)
      )[0];
      draftInputs.push({
        kind: d.kind,
        language: d.language,
        wordCount: v?.wordCount ?? 0,
        contentMd: v?.contentMd ?? "",
      });
    }

    const namesSeen = new Set<string>();
    if (profile?.fullNameLatin) namesSeen.add(profile.fullNameLatin);
    if (profile?.fullNameArabic) namesSeen.add(profile.fullNameArabic);
    for (const e of extractionRows) {
      const holder = (e.raw as { holder?: { full_name_latin?: string | null; full_name_arabic?: string | null } })?.holder;
      if (holder?.full_name_latin) namesSeen.add(holder.full_name_latin);
      if (holder?.full_name_arabic) namesSeen.add(holder.full_name_arabic);
    }

    // Fresh verdict for eligibility-change detection (spec F9).
    let verdict: import("@/lib/core/types").Verdict | null = null;
    if (profile) {
      const facts = deriveFacts(profile, today);
      const scored = scoreMatch({
        facts,
        scholarship,
        today,
        parentOf,
        leadTimeDays: 60,
      });
      verdict = scored.verdict;
    }

    const findings = runLayer1({
      today,
      deadlineDate: deadline,
      feasibility: (row.application.feasibility as "ok" | "tight" | "impossible" | null) ?? null,
      profile: profile ?? emptyProfile(),
      scholarship,
      checklist: checklistInput,
      drafts: draftInputs,
      namesSeen: [...namesSeen],
      eligibilityVerdict: verdict,
    });

    // AI review layer (spec F9.2): only when a key exists, only on letters.
    let aiCount = 0;
    const caps = await getCapabilities();
    if (aiReady(caps)) {
      const letter = draftInputs.find((d) => d.kind === "motivation_letter" && d.contentMd.length > 200);
      if (letter && profile) {
        try {
          const prompt = checkPrompt({
            letter: letter.contentMd,
            factPackJson: JSON.stringify(profile),
            scholarshipJson: JSON.stringify({ name: scholarship.name, essay_requirements: scholarship.essay_requirements }),
          });
          const { data } = await callJSON<import("@/lib/ai/prompts/check.v1").CheckFindings>({
            role: "reasoner",
            promptId: "check.v1",
            system: prompt.system,
            user: prompt.user,
            schema: CheckFindings,
            userId: user.id,
            requestId: `check_${id}`,
          });
          for (const f of data.findings) {
            findings.push({
              code: `llm_${f.category}`,
              severity: f.severity,
              category: f.category,
              params: {},
              evidence: { quote: f.quote, title: f.title, detail: f.detail, fix: f.fix },
            });
            aiCount++;
          }
        } catch (e) {
          console.error(`[check] ai layer failed for ${id}:`, e); // rules still stand
        }
      }
    }

    const score = readinessScore(findings);
    const checkId = uuidv7();
    await db.insert(checks).values({
      id: checkId,
      applicationId: id,
      userId: user.id,
      status: "done",
      readinessScore: score,
      summary: { rules_ran: findings.length - aiCount, ai_findings: aiCount },
    });

    for (const f of findings) {
      const copy = findingCopy(f.code, f.params, locale);
      await db.insert(checkFindings).values({
        id: uuidv7(),
        checkId,
        severity: f.severity,
        category: f.category,
        title: { [locale]: copy.title },
        detail: { [locale]: copy.detail },
        evidence: (f.evidence ?? null) as Record<string, unknown> | null,
        fixHint: copy.fix ? { [locale]: copy.fix } : null,
        source: f.code.startsWith("llm_") ? "llm" : "deterministic",
      });
    }

    return ok(await loadCheck(checkId, user.id, locale), { status: 201 });
  } catch (e) {
    return errorResponse(req, e);
  }
}


function emptyProfile() {
  return {
    fullNameLatin: null,
    fullNameArabic: null,
    birthDate: null,
    nationality: "DZ",
    gender: null,
    wilaya: null,
    currentLevel: null,
    currentYear: null,
    institution: null,
    faculty: null,
    fieldOfStudy: null,
    fieldFreeText: null,
    expectedGraduation: null,
    gpa20: null,
    gpaRankPercent: null,
    honors: null,
    languages: [],
    experiences: [],
    skills: [],
    targetLevel: null,
    targetFields: [],
    targetCountries: [],
    needsFullFunding: null,
    targetIntake: null,
    budgetMonthlyDzd: null,
    constraints: {},
    completeness: 0,
    confirmedAt: null,
  } as ReturnType<typeof profileData>;
}
