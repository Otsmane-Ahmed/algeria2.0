import { errorResponse, ok } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/auth";

/** POST /api/auth/logout -> {ok}; clears the session cookie. */
export async function POST(req: Request) {
  try {
    const res = ok({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
    return res;
  } catch (e) {
    return errorResponse(req, e);
  }
}
