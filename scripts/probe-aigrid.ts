/**
 * AI Grid capability probe (arch.md §4.2) — first task of the build.
 * Records pass/fail + latency + raw error for 10 checks and writes
 * `probe-report.json`. Without AIGRID_API_KEY it reports `skipped` and exits 0
 * so CI stays green while the app runs in degraded mode.
 *
 * A check the key's model genuinely cannot satisfy (key scoped to one model,
 * that model takes no images) is recorded as `unsupported` with the raw error
 * and does not fail the run: the app degrades for exactly those capabilities.
 * Anything else is a real failure and exits 1.
 *
 * Run: npm run probe
 */
import { writeFileSync } from "node:fs";
import "./env";
import OpenAI from "openai";

const OUT = new URL("../probe-report.json", import.meta.url);
const hasKey = Boolean(process.env.AIGRID_API_KEY);
const client = hasKey
  ? new OpenAI({
      baseURL: process.env.AIGRID_BASE_URL || "https://app.ai-grid.io/v1",
      apiKey: process.env.AIGRID_API_KEY as string,
      timeout: Number(process.env.AIGRID_TIMEOUT_MS ?? 60000),
      maxRetries: 0,
    })
  : null;

const report: Record<string, unknown> = { checked_at: new Date().toISOString() };
const failures: string[] = [];
const unsupported: string[] = [];

/** The provider says this key/model has no such capability, as opposed to a broken probe. */
function isUnsupported(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /not allowed to access|image\(s\) may be provided|At most \d+ image|404|not supported/i.test(msg);
}

async function step(
  name: string,
  fn: () => Promise<unknown>,
  opts: { allowUnsupported?: boolean } = {},
): Promise<void> {
  const t0 = Date.now();
  try {
    const value = await fn();
    report[name] = value;
    console.log(`  ok   ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const latency = Date.now() - t0;
    if (opts.allowUnsupported && isUnsupported(e)) {
      report[name] = { ok: false, unsupported: true, error: detail.slice(0, 400), latency_ms: latency };
      unsupported.push(name);
      console.log(`  n/a  ${name}: unsupported by this key/model (${detail.slice(0, 160)})`);
    } else {
      report[name] = { ok: false, error: detail.slice(0, 400), latency_ms: latency };
      failures.push(name);
      console.log(`  FAIL ${name}: ${detail.slice(0, 200)}`);
    }
  }
}

const chat = (params: Record<string, unknown>) =>
  client!.chat.completions.create(params as never) as Promise<OpenAI.ChatCompletion>;

const streamChat = (params: Record<string, unknown>) =>
  client!.chat.completions.create({ ...params, stream: true } as never) as unknown as AsyncIterable<{
    choices?: { delta?: { content?: string | null } }[];
  }>;

async function main() {
  if (!client) {
    console.log("SKIPPED: AIGRID_API_KEY is not set. AI features run degraded (no key).");
    report.skipped = true;
    report.reason = "no AIGRID_API_KEY";
    writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
    return;
  }
  console.log(`Probing ${process.env.AIGRID_BASE_URL} ...`);

  const model = process.env.AIGRID_MODEL_VISION || process.env.AIGRID_MODEL_AGENT || "";

  await step("models", async () => {
    const res = await client.models.list();
    const ids = res.data.map((m) => m.id);
    return { ids, expected_present: ["google/gemma-4-31B"].map((m) => ({ m, present: ids.includes(m) })) };
  });

  await step("plain_chat", async () => {
    const res = await chat({ model, messages: [{ role: "user", content: "ping" }] });
    const content = res.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("empty content");
    return { ok: true, sample: content.slice(0, 80) };
  });

  await step("stream", async () => {
    const stream = await streamChat({ model, messages: [{ role: "user", content: "ping" }] });
    let chunks = 0;
    let text = "";
    for await (const c of stream) {
      chunks += 1;
      text += c.choices?.[0]?.delta?.content ?? "";
    }
    if (!chunks) throw new Error("no SSE chunks");
    return { ok: true, chunks, received: text.length };
  });

  await step("json_object", async () => {
    const res = await chat({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: 'Return {"pong": true} as JSON.' }],
    });
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? "{}");
    if (parsed.pong !== true) throw new Error("unexpected payload");
    return { ok: true };
  });

  await step("json_schema", async () => {
    const res = await chat({
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "pong",
          strict: true,
          schema: { type: "object", properties: { pong: { type: "boolean" } }, required: ["pong"], additionalProperties: false },
        },
      },
      messages: [{ role: "user", content: "Return pong=true." }],
    });
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? "{}");
    if (parsed.pong !== true) throw new Error("unexpected payload");
    return { ok: true };
  });

  await step("json_prompt_only", async () => {
    const res = await chat({
      model,
      messages: [{ role: "user", content: 'Output ONLY JSON: {"pong": true}' }],
    });
    JSON.parse((res.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim());
    return { ok: true };
  });

  await step("tools", async () => {
    const tools = [
      {
        type: "function",
        function: {
          name: "get_time",
          description: "Get the current time in a timezone",
          parameters: { type: "object", properties: { tz: { type: "string" } }, required: ["tz"] },
        },
      },
    ];
    const out: Record<string, unknown> = {};
    for (const tool_choice of ["auto", "required"] as const) {
      const res = await chat({ model, tools, tool_choice, messages: [{ role: "user", content: "What time is it in Africa/Algiers?" }] });
      const calls = (res.choices?.[0]?.message?.tool_calls ?? []) as { id: string; function: { arguments: string } }[];
      if (!calls.length) throw new Error(`no tool_calls with tool_choice=${tool_choice}`);
      JSON.parse(calls[0]!.function.arguments);
      out[tool_choice] = true;
      if (tool_choice === "required") {
        // follow-up with role:"tool" must be accepted
        await chat({
          model,
          tools,
          messages: [
            { role: "user", content: "What time is it in Africa/Algiers?" },
            res.choices[0]!.message as never,
            { role: "tool", tool_call_id: calls[0]!.id, content: JSON.stringify({ time: "12:00" }) },
          ],
        });
        out.follow_up_tool = true;
      }
    }
    return out;
  });

  await step("vision", async () => {
    // 1x1 transparent PNG; enough to prove the endpoint accepts image_url parts.
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const out: Record<string, unknown> = {};
    for (const n of [1, 4]) {
      const content: unknown[] = [{ type: "text", text: "PAGE 1 of 1" }, ...Array.from({ length: n }, () => ({ type: "image_url", image_url: { url: png, detail: "low" } })), { type: "text", text: "Describe what you see in one sentence." }];
      const res = await chat({ model, max_tokens: 200, messages: [{ role: "user", content }] });
      out[n === 1 ? "single" : "multi"] = Boolean(res.choices?.[0]?.message?.content);
    }
    return out;
  }, { allowUnsupported: true });

  await step("multilingual", async () => {
    const res = await chat({
      model,
      messages: [
        { role: "user", content: "Translate to French, output only the translation: 'Safi, nqdar ndirha' (Darija)." },
      ],
    });
    const text = res.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error("empty translation");
    return { ok: true, sample: text.slice(0, 80), utf8_ok: text.length > 0 };
  });

  await step("max_tokens", async () => {
    const res = await chat({ model, max_tokens: 4000, messages: [{ role: "user", content: "Write 300 words about study in France." }] });
    const len = (res.choices?.[0]?.message?.content ?? "").length;
    if (!len) throw new Error("empty output");
    return { ok: true, chars: len, finish: res.choices?.[0]?.finish_reason };
  });

  await step("concurrency", async () => {
    const t0 = Date.now();
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => chat({ model, max_tokens: 16, messages: [{ role: "user", content: "ping" }] })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const rate = (results.find((r) => r.status === "rejected" && (r as PromiseRejectedResult).reason?.status === 429) as PromiseRejectedResult | undefined) ?? null;
    return { ok, concurrency_ok: ok, rate_limit_429: Boolean(rate), latency_ms: Date.now() - t0 };
  });

  await step("embeddings", async () => {
    const res = await (client as unknown as { embeddings: { create: (p: unknown) => Promise<{ data: unknown[] }> } }).embeddings.create({
      model: process.env.AIGRID_MODEL_EMBEDDINGS || "text-embedding-3-small",
      input: "safar",
    });
    return { ok: true, n: res.data.length };
  }, { allowUnsupported: true });

  report.failures = failures;
  report.unsupported = unsupported;
  writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  if (failures.length) console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  else if (unsupported.length) console.log(`\nall checks passed; unsupported by this key/model: ${unsupported.join(", ")}`);
  else console.log("\nall checks passed");
  console.log(`report -> ${OUT.pathname}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
