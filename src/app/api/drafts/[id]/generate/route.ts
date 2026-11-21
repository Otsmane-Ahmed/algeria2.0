import { z } from "zod";
import { ApiError, errorResponse, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, draftVersions, drafts, scholarships } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { uuidv7 } from "@/lib/core/ids";
import { countWords } from "@/lib/core/checker/rules";
import { getCapabilities, aiReady } from "@/lib/ai/capabilities";
import { getAI } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/models";
import { callJSON } from "@/lib/ai/callJSON";
import { Outline, normalizeOutline, outline as outlinePrompt, draft as draftPrompt } from "@/lib/ai/prompts/write.v1";
import { getProfile, profileData, scholarshipData } from "@/lib/app-data";
import { AiUnavailable } from "@/lib/ai/errors";

/**
 * POST /api/drafts/:id/generate — SSE stream (spec F7.4).
 *
 * Events: `outline` (JSON), `done` ({version_id, word_count}),
 * `error` ({code}). Without an API key the stream ends immediately with
 * error=ai_unavailable; the studio then shows its deterministic outline
 * state (no text is ever invented).
 */
const GenSchema = z
  .object({
    instruction: z.string().max(2000).optional(),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const { id } = await ctx.params;
    const body = await readBody(req, GenSchema);

    const rows = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)))
      .limit(1);
    const draft = rows[0];
    if (!draft) throw ApiError.notFound("No such draft");
    if (!draft.applicationId) {
      throw ApiError.validation([{ path: "(root)", message: "Draft has no application" }]);
    }

    const caps = await getCapabilities();
    if (!aiReady(caps)) {
      return sse((send) => {
        send("error", { code: "ai_unavailable" });
      });
    }

    const appRows = await db
      .select({ scholarship: scholarships })
      .from(applications)
      .innerJoin(scholarships, eq(applications.scholarshipId, scholarships.id))
      .where(eq(applications.id, draft.applicationId))
      .limit(1);
    const scholarshipRow = appRows[0]?.scholarship;
    if (!scholarshipRow) throw ApiError.notFound("No such application");

    const profile = await getProfile(user.id);
    const scholarship = scholarshipData(scholarshipRow);
    const factPack = buildFactPack(profile ? profileData(profile) : null);
    const scholarshipJson = JSON.stringify({
      name: scholarship.name,
      rules_human: scholarship.rules_human,
      essay_requirements: scholarship.essay_requirements,
    });
    const factPackJson = JSON.stringify(factPack);

    return sse(async (send) => {
      try {
        // 1. Outline (structured; validated against the §9.5 schema).
        const outlineArgs = outlinePrompt({
          factPackJson,
          scholarshipJson,
          essayRequirementsJson: JSON.stringify(scholarship.essay_requirements),
          maxWords: null,
        });
        const { data: outline } = await callJSON<Outline>({
          role: "agent",
          promptId: "write.v1",
          system: outlineArgs.system,
          user: outlineArgs.user,
          schema: Outline,
          userId: user.id,
          requestId: `gen_${draft.id}`,
        });
        send("outline", outline);

        // 2. Draft text (plain completion; the prompt forbids JSON output).
        const prompt = draftPrompt({
          kind: draft.kind,
          language: draft.language,
          tone: "formal committee register",
          factPackJson,
          scholarshipJson,
          outlineJson: JSON.stringify(normalizeOutline(outline)),
        });
        const completion = await getAI().chat.completions.create({
          model: MODELS.writer,
          temperature: 0.6,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });
        const contentMd = (completion.choices[0]?.message?.content ?? "").trim();
        if (!contentMd) throw new AiUnavailable("empty completion");

        const versionId = uuidv7();
        const latest = await db
          .select({ versionNo: draftVersions.versionNo })
          .from(draftVersions)
          .where(eq(draftVersions.draftId, draft.id))
          .orderBy(desc(draftVersions.versionNo))
          .limit(1);
        await db.insert(draftVersions).values({
          id: versionId,
          draftId: draft.id,
          versionNo: (latest[0]?.versionNo ?? 0) + 1,
          contentMd,
          wordCount: countWords(contentMd),
          source: "ai",
          instruction: body.instruction ?? null,
          model: MODELS.writer || "writer",
          promptId: "write.v1",
          factsUsed: factPack.facts as unknown[],
        });
        await db
          .update(drafts)
          .set({ currentVersionId: versionId, updatedAt: new Date() })
          .where(eq(drafts.id, draft.id));

        send("done", { version_id: versionId, word_count: countWords(contentMd) });
      } catch (e) {
        const code = e instanceof AiUnavailable ? "ai_unavailable" : "internal";
        console.error(`[generate] ${draft.id}:`, e);
        send("error", { code });
      }
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}

/** Minimal fact pack (spec F7.3): only what the profile actually holds. */
function buildFactPack(profile: ReturnType<typeof profileData> | null) {
  const facts: { id: string; label: string; value: string }[] = [];
  if (!profile) return { ids: [] as string[], facts };
  const push = (id: string, label: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") {
      facts.push({ id, label, value: String(value) });
    }
  };
  push("name", "Full name", profile.fullNameLatin);
  push("gpa20", "Average out of 20", profile.gpa20);
  push("rank", "Rank percent", profile.gpaRankPercent);
  push("level", "Current level", profile.currentLevel);
  push("institution", "Institution", profile.institution);
  push("field", "Field of study", profile.fieldOfStudy ?? profile.fieldFreeText);
  push("graduation", "Expected graduation", profile.expectedGraduation);
  push("honors", "Honours", profile.honors);
  for (const l of profile.languages) push(`lang_${l.lang}`, `Language ${l.lang}`, l.level);
  profile.experiences.forEach((e, i) => {
    push(`exp_${i}`, `${e.type}: ${e.title ?? ""}`.trim(), `${e.org ?? ""} ${e.start ?? ""}`.trim());
  });
  return { ids: facts.map((f) => f.id), facts };
}

/** SSE helper: streams named events, closes cleanly. */
function sse(run: (send: (event: string, data: unknown) => void) => void | Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await run(send);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
