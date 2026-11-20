/** AI-layer errors mapped to the API error codes in arch.md §8.2. */

export class AiUnavailable extends Error {
  readonly code = "ai_unavailable";
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailable";
  }
}

export class AiOutputInvalid extends Error {
  readonly code = "ai_output_invalid";
  readonly status = 502;
  /** Raw model output, kept server-side for the llm_calls log only. */
  readonly raw: string;
  constructor(message: string, raw = "") {
    super(message);
    this.name = "AiOutputInvalid";
    this.raw = raw;
  }
}

export function isRetryable(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  if (typeof status === "number") return status === 429 || status >= 500;
  const msg = e instanceof Error ? e.message : String(e);
  return /timed? ?out|timeout|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg);
}
