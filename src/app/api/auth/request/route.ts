import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { createMagicLink, MAGIC_LINK_MAX_PER_HOUR } from "@/lib/auth";

/**
 * POST /api/auth/request {email} -> {ok, dev_link?}
 *
 * Always answers `{ok:true}` so the endpoint cannot be used to probe which
 * addresses have accounts. There is no email provider in this build, so when
 * MAGIC_LINK_DEBUG=1 the link is returned in the response instead of being
 * delivered (documented deviation in README).
 */

// 20 sign-in requests per IP per hour (spec F0 edge cases).
const WINDOW_MS = 3_600_000;
const g = globalThis as unknown as { __magicIp?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__magicIp ??= new Map<string, number[]>());

function ipOf(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(req: Request) {
  try {
    const { email } = await readBody(req, z.object({ email: z.string().email().max(254) }));
    const normalized = email.trim().toLowerCase();

    const now = Date.now();
    const ip = ipOf(req);
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= 20) {
      throw new ApiError("rate_limited", 429, "Too many sign-in requests from this network.");
    }
    recent.push(now);
    hits.set(ip, recent);

    const created = await createMagicLink(normalized);
    if (!created.ok) {
      throw new ApiError(
        "rate_limited",
        429,
        `Too many sign-in links for this address. Try again in an hour (limit ${MAGIC_LINK_MAX_PER_HOUR}/hour).`,
      );
    }

    return ok({
      ok: true,
      ...(process.env.MAGIC_LINK_DEBUG === "1"
        ? { dev_link: created.url, token: created.token }
        : {}),
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
