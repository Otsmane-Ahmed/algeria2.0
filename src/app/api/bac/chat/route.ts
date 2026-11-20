import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { bacProfileData, getBacProfile, patchBacProfile } from "@/lib/app-data";
import { applyTurn, nextTurn, TURNS, type TurnResult } from "@/lib/core/orientation/chat";
import { logLlmCall } from "@/lib/ai/log";
import { callJSON } from "@/lib/ai/callJSON";
import { z as zod } from "zod";

/**
 * POST /api/bac/chat — one turn of the Mode A intake conversation.
 *
 * Deterministic: the turn sequence and validation live in
 * src/lib/core/orientation/chat.ts; the only AI touchpoint is free-text
 * interest extraction (turn "interests"), whose output is a tag list the
 * student confirms in the UI — the AI never writes a mark (§7.1.3).
 */
const BodySchema = z
  .object({
    turn: z.string(),
    value: z.union([z.string(), z.number(), z.array(z.string())]).nullish(),
    /** Free text from which the AI extracts interest tags. */
    free_text: z.string().max(2000).nullish(),
  })
  .strict();

const tagsSchema = zod.object({
  tags: zod.array(zod.string().min(1).max(40)).max(12),
});

function emptyProfile(): TurnResult extends never ? never : Parameters<typeof applyTurn>[2] {
  return {
    stream: null,
    streamOption: null,
    bacAverage: null,
    averageIsEstimate: false,
    bacYear: null,
    homeWilaya: null,
    interests: [],
    workStyle: null,
    practicality: null,
    studyLengthPref: null,
    constraints: {},
    draftWishes: [],
    abroadOpenness: null,
  };
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const body = await readBody(req, BodySchema);

    const def = TURNS.find((t) => t.id === body.turn);
    if (!def) throw ApiError.validation([{ path: "turn", message: "Unknown turn" }]);

    const row = await getBacProfile(user.id);
    const profile = row ? bacProfileData(row) : emptyProfile();

    // "confirm" turn: stamp the profile confirmed, return final state.
    if (body.turn === "confirm") {
      await patchBacProfile(user.id, { confirmed: true });
      const savedRow = await getBacProfile(user.id);
      return ok({
        applied: true,
        next_turn: null,
        done: true,
        profile: savedRow ? bacProfileData(savedRow) : null,
      });
    }

    let patch: Record<string, unknown> = {};
    let warn: string | undefined;

    // Interest tags from free text via the writer model; failure is honest:
    // the raw text becomes a single tag so nothing is lost silently.
    if (body.turn === "interests" && body.free_text && body.free_text.trim().length > 0) {
      let tags: string[] = [];
      const requestId = `bac-interests-${Date.now()}`;
      const started = Date.now();
      try {
        const res = await callJSON({
          schema: tagsSchema,
          role: "writer",
          system:
            "Extract 1 to 8 short interest tags (fields of study, careers, activities) from the student's message. Keep the student's language for the tags. Return only JSON.",
          user: body.free_text,
          requestId,
          promptId: "bac_interest_tags",
        });
        tags = res.data.tags;
        logLlmCall({
          userId: user.id,
          requestId,
          promptId: "bac_interest_tags",
          role: "writer",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch {
        tags = [body.free_text.trim().slice(0, 40)];
        logLlmCall({
          userId: user.id,
          requestId,
          promptId: "bac_interest_tags",
          role: "writer",
          status: "error",
          errorCode: "interest_tags_failed",
          latencyMs: Date.now() - started,
        });
      }
      patch = { interests: tags };
    } else if (body.turn !== "greeting") {
      // Skippable turns may advance with no value (§7.1.3): the field stays
      // empty and the UI explains the cost of skipping.
      if (def.skippable && (body.value == null || body.value === "")) {
        patch = {};
      } else {
        const result = applyTurn(body.turn, body.value, profile);
        if (!result.ok) {
          throw ApiError.validation([{ path: "value", message: result.error }]);
        }
        patch = result.patch as Record<string, unknown>;
        warn = result.warn;
      }
    }

    if (Object.keys(patch).length > 0) {
      await patchBacProfile(user.id, { patch });
    }
    const savedRow = await getBacProfile(user.id);
    const saved = savedRow ? bacProfileData(savedRow) : null;

    return ok({
      applied: Object.keys(patch).length > 0,
      warn,
      next_turn: nextTurn(body.turn),
      profile: saved,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
