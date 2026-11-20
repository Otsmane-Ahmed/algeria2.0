import { db } from "../db";
import { llmCalls } from "../db/schema";
import { uuidv7 } from "../core/ids";

/**
 * Write an llm_calls row (arch.md §5 / §4.4.1 step 7: "always write a row in
 * finally"). Never throws: a failed log must not fail the request.
 */
export function logLlmCall(row: {
  userId?: string | null;
  requestId?: string | null;
  role?: string | null;
  model?: string | null;
  promptId?: string | null;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  attempts?: number | null;
  status: string;
  errorCode?: string | null;
}): void {
  void db
    .insert(llmCalls)
    .values({ id: uuidv7(), ...row })
    .then(undefined, (e: unknown) => {
      console.warn("[llm_calls] log failed:", e instanceof Error ? e.message : e);
    });
}
