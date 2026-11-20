import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/client";
import { getCapabilities } from "@/lib/ai/capabilities";

export const dynamic = "force-dynamic";

/**
 * GET /api/health (spec 8.3). Reports what is actually wired in this
 * environment: the local Postgres cluster, local storage, and AI Grid only when
 * a key is present (the probe result is cached for 60s).
 */
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  let aigrid: { ok: boolean; latency_ms: number | null; detail?: string } = {
    ok: false,
    latency_ms: null,
  };
  if (aiConfigured()) {
    const t0 = Date.now();
    const caps = await getCapabilities();
    aigrid = {
      ok: caps.models.length > 0 && !caps.error,
      latency_ms: Date.now() - t0,
      ...(caps.error ? { detail: caps.error } : {}),
    };
  } else {
    aigrid = { ok: false, latency_ms: null, detail: "no AIGRID_API_KEY (degraded mode)" };
  }

  return NextResponse.json(
    {
      db: dbOk,
      redis: "not_configured",
      storage: "local_fs",
      aigrid,
      checked_at: new Date().toISOString(),
      latency_ms: Date.now() - started,
    },
    { status: dbOk ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
