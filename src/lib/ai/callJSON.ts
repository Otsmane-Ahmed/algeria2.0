import type { z } from "zod";
import type OpenAI from "openai";
import { getAI } from "./client";
import { MODELS, type Role } from "./models";
import { getCapabilities, type Capabilities } from "./capabilities";
import { AiOutputInvalid, AiUnavailable, isRetryable } from "./errors";
import { logLlmCall } from "./log";

/** OpenAI-format content parts (arch.md §4.4.2). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type Usage = { prompt_tokens?: number | null; completion_tokens?: number | null } | null;

export type CallJSONArgs<T> = {
  role: Role;
  promptId: string;
  system: string;
  user: string | ContentPart[];
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** JSON Schema form when json_schema mode is available (§4.2 runtime rule). */
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
  requestId: string;
};

export type CallJSONResult<T> = {
  data: T;
  usage: Usage;
  latencyMs: number;
  attempts: number;
  modelUsed: string;
};

const TRANSPORT_RETRIES = Number(process.env.AIGRID_MAX_RETRIES ?? 2);
const RETRY_BASE_MS = 800;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => Math.floor(Math.random() * 250);

/** §4.3: never show chain-of-thought; strip thinking blocks before parsing. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "");
}

function stripFences(text: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return m?.[1] ?? text;
}

/** Lenient parse: exact JSON, then fenced, then first `{` to last `}`. */
export function parseLoose(text: string): unknown | null {
  const candidates = [text.trim(), stripFences(stripThinking(text)).trim()];
  const stripped = stripThinking(text);
  const a = stripped.indexOf("{");
  const b = stripped.lastIndexOf("}");
  if (a >= 0 && b > a) candidates.push(stripped.slice(a, b + 1));
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      /* next candidate */
    }
  }
  return null;
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 12)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

function isRetryableStatus(e: unknown): boolean {
  return isRetryable(e);
}

export async function callJSON<T>(args: CallJSONArgs<T>): Promise<CallJSONResult<T>> {
  const { schema, requestId, promptId, role } = args;
  const model = MODELS[role];
  if (!process.env.AIGRID_API_KEY) {
    throw new AiUnavailable("AIGRID_API_KEY is not set; AI features are unavailable.");
  }
  if (!model) throw new AiUnavailable(`No model configured for role "${role}".`);

  const caps = await getCapabilities();
  const client = getAI();
  const started = Date.now();
  const temperature = args.temperature ?? 0;

  let attempts = 0;
  let lastRaw = "";
  let lastErrors = "";
  let messages = buildMessages(args, caps);
  let temp = temperature;

  // Two passes: normal, then one repair pass with the Zod errors (§4.4.1 step 5).
  for (let pass = 0; pass < 2; pass++) {
    const body: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature: temp,
      ...(args.maxTokens ? { max_tokens: args.maxTokens } : {}),
      ...responseFormat(caps, args),
    };

    let text = "";
    let transportAttempts = 0;
    for (;;) {
      attempts += 1;
      transportAttempts += 1;
      try {
        const res = await client.chat.completions.create(body);
        text = res.choices?.[0]?.message?.content ?? "";
        break;
      } catch (e) {
        if (isRetryableStatus(e) && transportAttempts <= TRANSPORT_RETRIES) {
          await sleep(RETRY_BASE_MS * 2 ** (transportAttempts - 1) + jitter());
          continue;
        }
        const latencyMs = Date.now() - started;
        logLlmCall({
          userId: args.userId ?? null,
          requestId,
          role,
          model,
          promptId,
          latencyMs,
          attempts,
          status: "error",
          errorCode: e instanceof AiUnavailable ? e.code : "ai_transport_error",
        });
        throw new AiUnavailable(
          `AI Grid request failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 400),
        );
      }
    }

    lastRaw = text;
    const parsed = parseLoose(text);
    if (parsed !== null) {
      const check = schema.safeParse(parsed);
      if (check.success) {
        const latencyMs = Date.now() - started;
        logLlmCall({
          userId: args.userId ?? null,
          requestId,
          role,
          model,
          promptId,
          latencyMs,
          promptTokens: null,
          completionTokens: null,
          attempts,
          status: "ok",
        });
        return {
          data: check.data,
          usage: null,
          latencyMs,
          attempts,
          modelUsed: model,
        };
      }
      lastErrors = formatZodError(check.error);
    } else {
      lastErrors = "no JSON object found in model output";
    }

    if (pass === 0) {
      messages = repairMessages(args, lastRaw, lastErrors);
      temp = 0;
    }
  }

  const latencyMs = Date.now() - started;
  logLlmCall({
    userId: args.userId ?? null,
    requestId,
    role,
    model,
    promptId,
    latencyMs,
    attempts,
    status: "invalid_output",
    errorCode: "ai_output_invalid",
  });
  throw new AiOutputInvalid(`Model output failed validation: ${lastErrors}`.slice(0, 500), lastRaw);
}

function responseFormat(caps: Capabilities, args: CallJSONArgs<unknown>): Record<string, unknown> {
  if (caps.json_schema && args.jsonSchema) {
    return {
      response_format: {
        type: "json_schema",
        json_schema: { name: args.promptId.replace(/\W+/g, "_"), schema: args.jsonSchema, strict: true },
      },
    };
  }
  if (caps.json_object) return { response_format: { type: "json_object" } };
  return {}; // prompt-only + repair loop
}

function schemaNote(args: CallJSONArgs<unknown>, caps: Capabilities): string {
  const pretty = args.jsonSchema
    ? JSON.stringify(args.jsonSchema)
    : "// JSON Schema not supplied; infer from the field list below";
  return [
    "",
    "Return ONLY valid JSON matching this JSON Schema. No markdown, no commentary.",
    caps.json_schema && args.jsonSchema ? "" : pretty,
  ].join("\n");
}

type Msg = OpenAI.ChatCompletionMessageParam;

/** Our ContentPart shape matches the SDK's text | image_url parts. */
const userContent = (u: string | ContentPart[]): string | OpenAI.ChatCompletionContentPart[] =>
  u as string | OpenAI.ChatCompletionContentPart[];

function buildMessages(args: CallJSONArgs<unknown>, caps: Capabilities): Msg[] {
  return [
    { role: "system", content: `${args.system}${schemaNote(args, caps)}` },
    { role: "user", content: userContent(args.user) },
  ];
}

function repairMessages(args: CallJSONArgs<unknown>, raw: string, errors: string): Msg[] {
  return [
    { role: "system", content: args.system },
    { role: "user", content: userContent(args.user) },
    { role: "assistant", content: raw.slice(0, 12_000) },
    {
      role: "user",
      content: `The JSON above failed validation:\n${errors}\n\nFix the JSON so it validates. Output JSON only.`,
    },
  ];
}
