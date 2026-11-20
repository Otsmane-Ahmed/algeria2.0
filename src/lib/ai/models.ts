/** Model roles (arch.md §4.3). All ids come from env, never hard-coded in logic. */
export const MODELS = {
  vision: process.env.AIGRID_MODEL_VISION ?? "",
  agent: process.env.AIGRID_MODEL_AGENT ?? "",
  writer: process.env.AIGRID_MODEL_WRITER ?? "",
  reasoner: process.env.AIGRID_MODEL_REASONER || process.env.AIGRID_MODEL_AGENT || "",
} as const;

export type Role = keyof typeof MODELS;
