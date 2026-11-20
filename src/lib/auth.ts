import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { magicLinks, users } from "./db/schema";
import { uuidv7 } from "./core/ids";
import type { Locale } from "./core/types";
import { LOCALE_COOKIE, SESSION_COOKIE } from "./cookies";

export { SESSION_COOKIE, LOCALE_COOKIE };

/**
 * Cookie session auth (spec F0: magic link, no password).
 * Deviation from Auth.js documented in README: the session is an HMAC-signed
 * cookie instead of a database session, and the user row is looked up on every
 * request (so a deleted account can never ride an old cookie).
 */

export const SESSION_DAYS = 30;
export const MAGIC_LINK_MINUTES = 15;
export const MAGIC_LINK_MAX_PER_HOUR = 5;

export type SessionUser = typeof users.$inferSelect;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set (see .env.example)");
  return s;
}

const hmac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: now + SESSION_DAYS * 86_400_000 }),
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifySessionToken(token: string | null | undefined): { sub: string } | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.sub !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    return { sub: parsed.sub };
  } catch {
    return null;
  }
}

/** Resolve the signed session to a live, non-deleted user row. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const parsed = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!parsed) return null;
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, parsed.sub), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export function sessionCookieOptions(maxAgeDays = SESSION_DAYS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: maxAgeDays * 86_400,
  };
}

export function localeCookieOptions() {
  return { ...sessionCookieOptions(365), httpOnly: false };
}

// --- magic links ---------------------------------------------------------------

export type MagicLinkResult =
  | { ok: true; token: string; url: string }
  | { ok: false; reason: "rate_limited" };

/** Create a single-use, 15-minute magic link. Only the token hash is stored. */
export async function createMagicLink(email: string): Promise<MagicLinkResult> {
  const since = new Date(Date.now() - 3_600_000);
  const recent = await db
    .select({ id: magicLinks.id })
    .from(magicLinks)
    .where(and(eq(magicLinks.email, email), gt(magicLinks.createdAt, since)));
  if (recent.length >= MAGIC_LINK_MAX_PER_HOUR) return { ok: false, reason: "rate_limited" };

  // Housekeeping: drop this address's already-expired links so the rate-limit
  // count above only ever sees live rows.
  await db
    .delete(magicLinks)
    .where(and(eq(magicLinks.email, email), lt(magicLinks.expiresAt, new Date())))
    .catch(() => undefined);

  const token = randomBytes(32).toString("base64url");
  await db.insert(magicLinks).values({
    id: uuidv7(),
    email,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000),
  });
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { ok: true, token, url: `${base}/login?token=${token}` };
}

/** Burn the link and return its email, or null if invalid/used/expired. */
export async function consumeMagicLink(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = sha256(token);
  const rows = await db
    .select()
    .from(magicLinks)
    .where(eq(magicLinks.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  await db
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(eq(magicLinks.id, row.id));
  return row.email;
}

/** Find (or create) the user behind an email address. */
export async function upsertUserByEmail(email: string, locale: Locale): Promise<SessionUser> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const existing = rows[0];
  if (existing) {
    if (existing.deletedAt) throw new Error("account_deleted");
    return existing;
  }
  const id = uuidv7();
  const inserted = await db
    .insert(users)
    .values({ id, email, locale, role: "student", plan: "free" })
    .returning();
  return inserted[0]!;
}
