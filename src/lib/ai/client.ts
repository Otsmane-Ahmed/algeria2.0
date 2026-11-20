import OpenAI from "openai";

/**
 * AI Grid client (arch.md §4.4). maxRetries: 0 — we implement our own retry in
 * callJSON so every attempt gets logged to llm_calls.
 *
 * The client is lazy: with no AIGRID_API_KEY nothing is constructed and every
 * AI entry point returns a clean "AI unavailable" state instead of throwing at
 * module load (the demo must run with no key).
 */
let cached: OpenAI | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.AIGRID_API_KEY);
}

export function getAI(): OpenAI {
  if (!aiConfigured()) throw new Error("AIGRID_API_KEY is not set");
  cached ??= new OpenAI({
    baseURL: process.env.AIGRID_BASE_URL || "https://app.ai-grid.io/v1",
    apiKey: process.env.AIGRID_API_KEY as string,
    timeout: Number(process.env.AIGRID_TIMEOUT_MS ?? 60000),
    maxRetries: 0,
  });
  return cached;
}
