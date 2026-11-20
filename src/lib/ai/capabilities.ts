import { getAI } from "./client";
import type { Role } from "./models";
import { AiUnavailable, isRetryable } from "./errors";

/**
 * Capability probe result (arch.md §4.2). Probed once per process and cached;
 * without an API key the answer is "nothing supported", which is what makes
 * every AI feature degrade to its deterministic path instead of failing.
 */
export type Capabilities = {
  checked_at: string | null;
  models: string[];
  stream: boolean;
  json_object: boolean;
  json_schema: boolean;
  tools: { auto: boolean; required: boolean; parallel: boolean };
  vision: { single: boolean; multi: boolean; max_image_px: number | null };
  embeddings: boolean;
  responses_api: boolean;
  rate_limit: { rpm: number | null; concurrency_ok: number | null };
  error?: string;
};

const NONE: Capabilities = {
  checked_at: null,
  models: [],
  stream: false,
  json_object: false,
  json_schema: false,
  tools: { auto: false, required: false, parallel: false },
  vision: { single: false, multi: false, max_image_px: null },
  embeddings: false,
  responses_api: false,
  rate_limit: { rpm: null, concurrency_ok: null },
};

const TTL_MS = 60_000;
const g = globalThis as unknown as { __aiCaps?: { at: number; value: Capabilities } };

/** In-process cache, refreshed every 60s (spec: GET /models cached 60 s). */
export async function getCapabilities(force = false): Promise<Capabilities> {
  const now = Date.now();
  if (!force && g.__aiCaps && now - g.__aiCaps.at < TTL_MS) return g.__aiCaps.value;
  if (!process.env.AIGRID_API_KEY) {
    g.__aiCaps = { at: now, value: NONE };
    return NONE;
  }
  let value: Capabilities;
  try {
    const res = await getAI().models.list();
    value = { ...NONE, checked_at: new Date().toISOString(), models: res.data.map((m) => m.id) };
  } catch (e) {
    // A failed probe must not break the app: report "no capabilities" and let
    // callers fall back to their deterministic path.
    value = { ...NONE, checked_at: new Date().toISOString(), error: String(e).slice(0, 300) };
  }
  g.__aiCaps = { at: now, value };
  return value;
}

/** True when AI-backed features can run at all (used for the UI banner). */
export function aiReady(caps: Capabilities): boolean {
  return Boolean(process.env.AIGRID_API_KEY) && !caps.error && caps.models.length > 0;
}

export function throwIfUnavailable(): void {
  if (!process.env.AIGRID_API_KEY) {
    throw new AiUnavailable("No AIGRID_API_KEY configured. AI features are disabled for this session.");
  }
}

export type { Role };
