import { z } from "zod";

export const PROMPT_VERSION = "write.v1";

const OutlineShape = z.object({
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        purpose: z.string(),
        fact_ids: z.array(z.string()).default([]),
        target_words: z.number().int().positive(),
        missing: z.string().optional(),
      }),
    )
    .min(1)
    .max(7),
  // Small local models frequently omit this field even after the repair pass,
  // killing the whole outline call; it is derivable, so accept it missing and
  // compute it in normalizeOutline from the per-section targets.
  total_target_words: z.number().int().positive().optional(),
});
export const Outline = OutlineShape;
export type Outline = z.infer<typeof OutlineShape>;

export function normalizeOutline(o: Outline): Required<Outline> {
  return {
    ...o,
    total_target_words:
      o.total_target_words ?? o.sections.reduce((s, x) => s + x.target_words, 0),
  };
}

export const VerifyResult = z.object({
  unsupported_claims: z.array(z.object({ sentence: z.string(), reason: z.string() })),
});

/** Outline prompt (arch.md §9.5). */
export function outline(vars: {
  factPackJson: string;
  scholarshipJson: string;
  essayRequirementsJson: string;
  maxWords: number | null;
}): { system: string; user: string } {
  return {
    system: `You plan motivation letters. Given the FACT_PACK (the only allowed source of claims), the SCHOLARSHIP info and ESSAY_REQUIREMENTS, produce an outline with 4-6 sections that follow: hook (specific, not generic) -> past (academic/professional proof) -> present (why this program/country/scholarship, referencing its stated values) -> future (concrete plan and contribution) -> closing commitment.
For each section list the fact_ids you will use. Do not reference fact ids that do not exist. If a needed fact is absent, add a section field "missing":"<what is needed>".
Target words: respect max_words ${vars.maxWords ?? "null"} (aim for 92-100% of it; if null aim for 380 words).
Output JSON only.`,
    user: `<<<FACT_PACK
${vars.factPackJson}
FACT_PACK>>>
<<<SCHOLARSHIP
${vars.scholarshipJson}
SCHOLARSHIP>>>
<<<ESSAY_REQUIREMENTS
${vars.essayRequirementsJson}
ESSAY_REQUIREMENTS>>>`,
  };
}

/** Draft system prompt (arch.md §9.5). */
export function draft(vars: {
  kind: string;
  language: string;
  tone: string;
  factPackJson: string;
  scholarshipJson: string;
  outlineJson: string;
}): { system: string; user: string } {
  return {
    system: `You are a careful writing assistant helping an Algerian student write an HONEST, specific ${vars.kind} in ${vars.language}.

ABSOLUTE RULES
1. Every factual claim about the student (grades, projects, jobs, awards, skills, certificates) MUST come from FACT_PACK. If you need a fact that is not there, write a placeholder exactly like [[MISSING: short description]] and continue. Never invent.
2. Write in the first person. Natural, human, specific. Prefer concrete numbers from FACT_PACK.
3. Forbidden clichés: "since my childhood", "passionate about", "dream of", "I am writing to apply" (as the first words), "once in a lifetime", "make the world a better place", "I believe that I am the perfect candidate". Avoid starting more than two sentences with "I".
4. Do not flatter the country or institution; reference only values/prompts present in SCHOLARSHIP info.
5. Follow the OUTLINE section order and target words. Use "## " headings only if the scholarship requires sections; otherwise use plain paragraphs.
6. Language register: ${vars.tone}. For French use proper formal conventions (vouvoiement toward the committee, no anglicisms). For Arabic use Modern Standard Arabic, natural not literal. For English use clear international English (avoid idioms).
7. Do not include a greeting/closing block unless ESSAY_REQUIREMENTS says it is a letter format.
8. Output ONLY the text of the document.`,
    user: `<<<FACT_PACK
${vars.factPackJson}
FACT_PACK>>>
<<<SCHOLARSHIP
${vars.scholarshipJson}
SCHOLARSHIP>>>
<<<OUTLINE
${vars.outlineJson}
OUTLINE>>>`,
  };
}

/** Claim verification (arch.md §9.5 `verify.v1`). */
export function verify(vars: { draft: string; factPackJson: string }): { system: string; user: string } {
  return {
    system: `You are a strict fact-checker. Compare DRAFT against FACT_PACK. List every sentence in DRAFT that states a concrete fact about the student that is NOT supported by FACT_PACK (invented employers, grades, awards, durations, technologies, outcomes). Quote the sentence EXACTLY as it appears. Ignore opinions, goals and wishes that are clearly framed as future intentions.
Return JSON: {"unsupported_claims":[{"sentence":"...","reason":"..."}]}`,
    user: `FACT_PACK:\n${vars.factPackJson}\n\nDRAFT:\n${vars.draft}`,
  };
}
