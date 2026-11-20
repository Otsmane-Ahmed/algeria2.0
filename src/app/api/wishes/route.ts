import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { wishes } from "@/lib/db/schema";
import { listWishes } from "@/lib/app-data";
import { uuidv7 } from "@/lib/core/ids";
import { and, eq, sql } from "drizzle-orm";

/** GET /api/wishes — the ordered fiche de vœux (§7.2). */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const rows = await listWishes(user.id);
    return ok({ items: rows, count: rows.length });
  } catch (e) {
    return errorResponse(new Request("http://localhost/api/wishes"), e);
  }
}

const PostSchema = z
  .object({
    formation_id: z.string().min(1).max(80),
  })
  .strict();

/** POST /api/wishes — append a wish at the end of the ranking. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const body = await readBody(req, PostSchema);
    const existing = await listWishes(user.id);
    if (existing.some((w) => w.formationId === body.formation_id)) {
      throw ApiError.validation([{ path: "formation_id", message: "already_wishlisted" }]);
    }
    if (existing.length >= 20) {
      throw ApiError.validation([{ path: "formation_id", message: "wish_limit_reached" }]);
    }
    const max = existing.reduce((m, w) => Math.max(m, w.position), 0);
    await db.insert(wishes).values({
      id: uuidv7(),
      userId: user.id,
      formationId: body.formation_id,
      position: max + 1,
    });
    const rows = await listWishes(user.id);
    return ok({ items: rows, count: rows.length });
  } catch (e) {
    return errorResponse(req, e);
  }
}

const DeleteSchema = z
  .object({
    formation_id: z.string().min(1).max(80),
  })
  .strict();

/** DELETE /api/wishes — remove one wish and re-pack positions. */
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const body = await readBody(req, DeleteSchema);
    await db
      .delete(wishes)
      .where(and(eq(wishes.userId, user.id), eq(wishes.formationId, body.formation_id)));
    await repack(user.id);
    const rows = await listWishes(user.id);
    return ok({ items: rows, count: rows.length });
  } catch (e) {
    return errorResponse(req, e);
  }
}

const PatchSchema = z
  .object({
    order: z.array(z.string().min(1)).max(20),
  })
  .strict();

/** PATCH /api/wishes {order} — set a new ranking (safer-order accept). */
export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const body = await readBody(req, PatchSchema);
    const mine = await listWishes(user.id);
    const mineIds = new Set(mine.map((w) => w.formationId));
    if (body.order.some((id) => !mineIds.has(id))) {
      throw ApiError.validation([{ path: "order", message: "unknown_formation" }]);
    }
    for (let i = 0; i < body.order.length; i++) {
      await db
        .update(wishes)
        .set({ position: i + 1 })
        .where(and(eq(wishes.userId, user.id), eq(wishes.formationId, body.order[i]!)));
    }
    await repack(user.id);
    const rows = await listWishes(user.id);
    return ok({ items: rows, count: rows.length });
  } catch (e) {
    return errorResponse(req, e);
  }
}

async function repack(userId: string) {
  const rows = await listWishes(userId);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.position !== i + 1) {
      await db
        .update(wishes)
        .set({ position: i + 1 })
        .where(eq(wishes.id, rows[i]!.id));
    }
  }
}
