import { z } from "zod";

export const PROMPT_VERSION = "check.v1";

export const CheckFindings = z.object({
  findings: z
    .array(
      z.object({
        severity: z.enum(["warning", "info"]),
        category: z.enum(["content_quality", "language", "mismatch", "translation"]),
        quote: z.string(),
        title: z.string(),
        detail: z.string(),
        fix: z.string(),
      }),
    )
    .max(12),
});
export type CheckFindings = z.infer<typeof CheckFindings>;

/** Checker LLM layer (arch.md §9.7). Deterministic rules run separately. */
export function build(vars: {
  letter: string;
  factPackJson: string;
  scholarshipJson: string;
}): { system: string; user: string } {
  return {
    system: `You review an application package for a scholarship. Return structured findings only.
Check: (1) generic or cliché passages, (2) mismatch with the scholarship's stated values/essay prompts, (3) claims with weak or missing evidence compared to FACT_PACK, (4) tone/register problems for the committee, (5) literal-translation artifacts (calques from Arabic/French/Darija), (6) grammar issues that change meaning.
Each finding MUST include "quote": an exact substring from the provided letter or CV that triggers it, and a concrete "fix". Do not output findings without an exact quote. Max 12 findings, ordered by importance. Output JSON:
{"findings":[{"severity":"warning|info","category":"content_quality|language|mismatch|translation","quote":"...","title":"...","detail":"...","fix":"..."}]}`,
    user: `<<<SCHOLARSHIP
${vars.scholarshipJson}
SCHOLARSHIP>>>
<<<FACT_PACK
${vars.factPackJson}
FACT_PACK>>>
<<<LETTER
${vars.letter}
LETTER>>>`,
  };
}
