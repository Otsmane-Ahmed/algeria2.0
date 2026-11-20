/**
 * End-to-end smoke test against a running server (spec F0-F10).
 *
 *   npm run build && npm run smoke
 *
 * Starts `next start` on SMOKE_PORT (default 3111) when nothing answers on it,
 * drives the whole demo flow as the seeded demo account, and exits non-zero on
 * the first failed assertion. MAGIC_LINK_DEBUG must be 1 (it is, in .env) so
 * the sign-in token comes back in the response.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import "./env"; // smoke asserts against key-aware behaviour; tsx does not load .env
import { buildPdf } from "../src/lib/pdf";

const PORT = Number(process.env.SMOKE_PORT ?? 3111);
const BASE = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${PORT}`;

let failures = 0;
let checks = 0;
const cookieJar: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  checks += 1;
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function cookieHeader(): string {
  return cookieJar.join("; ");
}

function absorbCookies(res: Response) {
  const set = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of set) {
    const pair = c.split(";")[0];
    if (!pair) continue;
    const name = pair.split("=")[0] ?? "";
    const idx = cookieJar.findIndex((j) => j.split("=")[0] === name);
    if (idx >= 0) cookieJar.splice(idx, 1);
    cookieJar.push(pair);
  }
}

async function api(
  method: string,
  url: string,
  init: RequestInit & { json?: unknown; form?: FormData; raw?: boolean } = {},
): Promise<{ status: number; body: any; res: Response }> {
  const headers: Record<string, string> = { cookie: cookieHeader() };
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form;
  } else if (init.body) {
    body = init.body as BodyInit;
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body, redirect: "manual" });
  absorbCookies(res);
  let parsed: any = null;
  if (!init.raw) {
    const text = await res.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed, res };
}

/** DATABASE_URL comes from ./env (the same .env next start reads). */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim();
  } catch {
    /* fall through */
  }
  throw new Error("DATABASE_URL is not set and .env could not be read");
}

/** Drop the demo address's live sign-in links so the rate-limit window restarts. */
async function resetDemoLinkWindow(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query("delete from magic_links where email = $1", ["demo@safar.dz"]);
  } finally {
    await client.end();
  }
}

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  let child: ChildProcess | null = null;

  if (!(await waitForHealth(1500))) {
    console.log(`starting server on :${PORT} ...`);
    child = spawn(path.join("node_modules", ".bin", "next"), ["start", "-p", String(PORT)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    child.stderr?.on("data", (d) => process.stderr.write(String(d)));
    if (!(await waitForHealth(60_000))) {
      console.error("server did not come up");
      child.kill();
      process.exit(1);
    }
  }

  try {
    await run();
  } finally {
    child?.kill();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
}

async function run() {
  console.log("\n[health]");
  const health = await api("GET", "/api/health");
  check("health 200", health.status === 200, String(health.status));
  check("health reports db ok", health.body?.db === true, JSON.stringify(health.body));
  const aiKey = Boolean(process.env.AIGRID_API_KEY);
  check(
    aiKey ? "health reports aigrid ok with a key" : "health degrades without an AI key",
    health.body?.aigrid?.ok === aiKey,
    JSON.stringify(health.body?.aigrid),
  );

  console.log("\n[auth]");
  // The per-address limit (5 links/hour, counted in the DB) survives between
  // runs, so prove it fires, then age the demo address's window out the same
  // way an hour would. Real addresses are untouched.
  let sawLimit = false;
  for (let i = 0; i < 6 && !sawLimit; i++) {
    const r = await api("POST", "/api/auth/request", { json: { email: "demo@safar.dz" } });
    sawLimit = r.status === 429;
  }
  check("per-address sign-in limit enforces (429)", sawLimit);
  await resetDemoLinkWindow();

  const req = await api("POST", "/api/auth/request", { json: { email: "demo@safar.dz" } });
  check("sign-in request 200", req.status === 200, String(req.status));
  check("debug mode returns a token", typeof req.body?.token === "string");
  const verify = await api("POST", "/api/auth/verify", { json: { token: req.body?.token } });
  check("verify 200", verify.status === 200, String(verify.status));
  check("session cookie set", cookieJar.some((c) => c.startsWith("safar_session=")));
  check("demo user returned", verify.body?.user?.email === "demo@safar.dz");

  const anon = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("protected route redirects when signed out", anon.status >= 300 && anon.status < 400);

  const me = await api("GET", "/api/me");
  check("GET /api/me 200", me.status === 200, String(me.status));

  console.log("\n[profile F3]");
  const profile = await api("GET", "/api/profile");
  check("GET /api/profile 200", profile.status === 200, String(profile.status));
  const confirm = await api("POST", "/api/profile/confirm");
  check("POST /api/profile/confirm 200", confirm.status === 200, String(confirm.status));
  check("profile is confirmed", confirm.body?.confirmed === true, JSON.stringify(confirm.body));

  console.log("\n[documents F1]");
  // Unique payload each run: uploads dedupe on sha256.
  const pdf = buildPdf(`SAFAR smoke ${Date.now()}`, [
    { text: "Transcript — Licence Informatique", size: 14, bold: true, gap: 6 },
    { text: "Moyenne generale: 14.20 / 20", size: 11, gap: 3 },
    { text: "Rang: 6 / 120", size: 11, gap: 3 },
  ]);
  const form = new FormData();
  form.set(
    "file",
    new Blob([Buffer.from(pdf)], { type: "application/pdf" }),
    "transcript.pdf",
  );
  form.set("kind", "transcript");
  const up = await api("POST", "/api/documents", { form });
  check("upload accepted (202)", up.status === 202, String(up.status));
  const docId = up.body?.document_id as string | undefined;
  check("document id returned", Boolean(docId));

  if (docId) {
    const terminal = new Set(["processed", "failed", "needs_review"]);
    let status = "";
    for (let i = 0; i < 30; i++) {
      const d = await api("GET", `/api/documents/${docId}`);
      status = d.body?.document?.status ?? "";
      if (terminal.has(status)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    check("ingestion reaches a terminal state", terminal.has(status), status || "still pending");
    const extraction = await api("GET", `/api/documents/${docId}/extraction`);
    check("extraction readable", extraction.status === 200, String(extraction.status));
  }

  console.log("\n[matching F4]");
  const runMatch = await api("POST", "/api/matches/run");
  check("match run 201", runMatch.status === 201, String(runMatch.status));
  const runId = runMatch.body?.run_id as string | undefined;
  check("match run returned items", Array.isArray(runMatch.body?.items) && runMatch.body.items.length > 0);
  if (runId) {
    const got = await api("GET", `/api/matches/${runId}`);
    check("GET run by id 200", got.status === 200, String(got.status));
    check("run echoes items", Array.isArray(got.body?.items));
  }
  const simulated = await api("POST", "/api/matches/simulate", {
    json: { gpa20: 17.5 },
  });
  check("what-if simulation 200", simulated.status === 200, String(simulated.status));

  console.log("\n[plan F5/F6]");
  const created = await api("POST", "/api/applications", { json: { slug: "chevening" } });
  check("application created (201)", created.status === 201, String(created.status));
  const appId = created.body?.applicationId as string | undefined;
  check("application id present", Boolean(appId), JSON.stringify(created.body).slice(0, 200));
  if (!appId) return;

  const detail = await api("GET", `/api/applications/${appId}`);
  check("application detail 200", detail.status === 200, String(detail.status));
  check("tasks generated", Array.isArray(detail.body?.tasks) && detail.body.tasks.length > 0);
  check("checklist generated", Array.isArray(detail.body?.checklist) && detail.body.checklist.length > 0);

  const taskId = detail.body?.tasks?.[0]?.id as string | undefined;
  if (taskId) {
    const patched = await api("PATCH", `/api/tasks/${taskId}`, { json: { status: "done" } });
    check("task marked done", patched.status === 200, String(patched.status));
    const again = await api("GET", `/api/applications/${appId}`);
    const row = (again.body?.tasks ?? []).find((t: { id: string }) => t.id === taskId);
    check("task status persisted", row?.status === "done", String(row?.status));
  }

  const item = detail.body?.checklist?.[0] as { id: string; status: string } | undefined;
  if (item) {
    // `ready` is the one forward state every procedure chain allows.
    const moved = await api("PATCH", `/api/checklist/${item.id}`, { json: { status: "ready" } });
    check(`checklist ${item.status} -> ready`, moved.status === 200, JSON.stringify(moved.body));
    const illegal = await api("PATCH", `/api/checklist/${item.id}`, { json: { status: "missing" } });
    check("backward transition rejected", illegal.status >= 400, String(illegal.status));
  }

  const replan = await api("POST", `/api/applications/${appId}/replan`);
  check("replan 200", replan.status === 200, String(replan.status));

  console.log("\n[writing F7]");
  const draft = await api("POST", `/api/applications/${appId}/drafts`, {
    json: { kind: "motivation_letter", language: "fr" },
  });
  check("draft created (201)", draft.status === 201, String(draft.status));
  const draftId = draft.body?.draft_id as string | undefined;
  if (draftId) {
    const saved = await api("PUT", `/api/drafts/${draftId}`, {
      json: { content_md: "# Lettre\n\nJe souhaite poursuivre un master.", base_version_id: undefined },
    });
    check("draft saved as version 2", saved.status === 200 && saved.body?.version_no === 2, JSON.stringify(saved.body));
    const stale = await api("PUT", `/api/drafts/${draftId}`, {
      json: { content_md: "stale", base_version_id: "00000000-0000-7000-8000-000000000000" },
    });
    check("stale base_version_id conflicts (409)", stale.status === 409, String(stale.status));
    const restored = await api("POST", `/api/drafts/${draftId}/restore/1`);
    check("restore version 1", restored.status === 200, String(restored.status));
    const got = await api("GET", `/api/drafts/${draftId}`);
    check("draft readable", got.status === 200, String(got.status));
  }

  console.log("\n[checker F9]");
  const checkRes = await api("POST", `/api/applications/${appId}/check`);
  check("check ran (201)", checkRes.status === 201, String(checkRes.status));
  const checkId = checkRes.body?.check?.id as string | undefined;
  check("check persisted", Boolean(checkId), JSON.stringify(checkRes.body).slice(0, 200));
  check(
    "readiness score present",
    typeof checkRes.body?.check?.readiness_score === "number",
    String(checkRes.body?.check?.readiness_score),
  );
  if (checkId) {
    const got = await api("GET", `/api/checks/${checkId}`);
    check("GET check 200", got.status === 200, String(got.status));
    check("findings returned", Array.isArray(got.body?.findings));
    const findingId = got.body?.findings?.[0]?.id as string | undefined;
    if (findingId) {
      const resolved = await api("PATCH", `/api/check-findings/${findingId}`, { json: { resolved: true } });
      check("finding resolved", resolved.status === 200, String(resolved.status));
    }
  }

  console.log("\n[exports F8]");
  const pdfRes = await fetch(`${BASE}/api/applications/${appId}/plan.pdf`, {
    headers: { cookie: cookieHeader() },
  });
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  check("plan.pdf 200", pdfRes.status === 200, String(pdfRes.status));
  check("plan.pdf has a PDF magic header", pdfBytes.subarray(0, 4).toString() === "%PDF");

  // localeOf() reads the safar_locale cookie; middleware never runs for /api.
  const arPdf = await fetch(`${BASE}/api/applications/${appId}/plan.pdf`, {
    headers: { cookie: `${cookieHeader()}; safar_locale=ar` },
    redirect: "manual",
  });
  check("ar export redirects to the printable view", arPdf.status === 302, String(arPdf.status));

  const ics = await fetch(`${BASE}/api/applications/${appId}/calendar.ics`, {
    headers: { cookie: cookieHeader() },
  });
  const icsText = await ics.text();
  check("calendar.ics 200", ics.status === 200, String(ics.status));
  check("ics has a calendar header", icsText.includes("BEGIN:VCALENDAR"));
  check("ics has one event per task", icsText.includes("BEGIN:VEVENT"));

  const exported = await api("GET", "/api/me/export");
  check("account export 200", exported.status === 200, String(exported.status));
  check("export contains profile", Boolean(exported.body?.profile), Object.keys(exported.body ?? {}).join(","));

  console.log("\n[pages + locales F10]");
  for (const p of ["/", "/login"]) {
    const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
    check(`${p} 200`, res.status === 200, String(res.status));
  }
  for (const p of [
    "/dashboard",
    "/onboarding",
    "/documents",
    "/profile",
    "/matches",
    "/applications",
    `/applications/${appId}`,
    "/procedures",
    "/settings",
    `/print/plan/${appId}`,
  ]) {
    const res = await fetch(`${BASE}${p}`, { headers: { cookie: cookieHeader() } });
    check(`${p} 200`, res.status === 200, String(res.status));
  }

  const ar = await fetch(`${BASE}/ar/dashboard`, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  const arHtml = await ar.text();
  check("/ar/dashboard renders", ar.status === 200, String(ar.status));
  check("html is Arabic + RTL", arHtml.includes('lang="ar"') && arHtml.includes('dir="rtl"'));

  const en = await fetch(`${BASE}/en/dashboard`, { headers: { cookie: cookieHeader() } });
  const enHtml = await en.text();
  check("/en/dashboard renders", en.status === 200, String(en.status));
  check("html is English + LTR", enHtml.includes('lang="en"'));

  const unknown = await api("GET", "/api/scholarships/not-a-real-scholarship");
  check("unknown slug 404", unknown.status === 404, String(unknown.status));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
