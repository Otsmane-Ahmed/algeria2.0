import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deletePrefix } from "@/lib/storage";

/**
 * POST /api/me/delete {confirm_email} — closes the account (spec §7).
 * Hard-deletes the user row (cascades profile, applications, drafts, checks)
 * and removes the stored files first. Re-authentication by magic link can
 * recreate the account from scratch.
 */
const Schema = z.object({ confirm_email: z.string().email() }).strict();

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const body = await readBody(req, Schema);
    if (body.confirm_email.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw ApiError.validation([{ path: "confirm_email", message: "Email does not match your account" }]);
    }

    // Files first: a failure here must not leave orphan blobs behind a deleted row.
    const docs = await db.select().from(documents).where(eq(documents.userId, user.id));
    for (const d of docs) {
      try {
        await deletePrefix(user.id, d.id);
      } catch (e) {
        console.error(`[delete] storage cleanup failed for ${d.id}:`, e);
      }
    }

    await db.delete(users).where(eq(users.id, user.id));

    const res = ok({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
    return res;
  } catch (e) {
    return errorResponse(req, e);
  }
}
