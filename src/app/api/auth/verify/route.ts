import { z } from "zod";
import { ApiError, errorResponse, localeOf, ok, readBody } from "@/lib/http";
import {
  SESSION_COOKIE,
  consumeMagicLink,
  createSessionToken,
  sessionCookieOptions,
  upsertUserByEmail,
} from "@/lib/auth";

function publicUser(u: {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  role: string;
  plan: string;
}) {
  return { id: u.id, email: u.email, name: u.name, locale: u.locale, role: u.role, plan: u.plan };
}

/** POST /api/auth/verify {token} -> {user}; burns the link and sets the session. */
export async function POST(req: Request) {
  try {
    const { token } = await readBody(req, z.object({ token: z.string().min(16).max(200) }));
    const email = await consumeMagicLink(token);
    if (!email) {
      throw new ApiError("unauthenticated", 401, "This sign-in link is invalid or has expired.");
    }

    let user;
    try {
      user = await upsertUserByEmail(email, localeOf(req));
    } catch (e) {
      if (e instanceof Error && e.message === "account_deleted") {
        throw new ApiError("unauthenticated", 401, "This account was deleted.");
      }
      throw e;
    }

    const res = ok({ user: publicUser(user) });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
    return res;
  } catch (e) {
    return errorResponse(req, e);
  }
}
