export const PROMPT_VERSION = "plan.v1";

/** Plan narrative (arch.md §9.4). Output is plain text, not JSON. */
export function build(opts: { language: string; factsJson: string }): { system: string; user: string } {
  return {
    system: `Summarize the application plan in ${opts.language} in max 100 words. Use ONLY these facts: scholarship name, deadline (as provided string), number of tasks, critical tasks list, today's date, feasibility. Do not change any date. If feasibility is "tight" or "impossible" say so plainly and mention the suggested options. No hype.
Output plain text only.`,
    user: `FACTS_JSON: ${opts.factsJson}`,
  };
}
