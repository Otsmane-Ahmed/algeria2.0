import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { wishes } from "@/lib/db/schema";
import { bacProfileData, getBacProfile, listFormations, listWishes } from "@/lib/app-data";
import { suggestWishOrder } from "@/lib/core/orientation/match";
import { uuidv7 } from "@/lib/core/ids";

/**
 * POST /api/wishes/suggest — seed the fiche de vœux with a personalized
 * starting list (§7.2 "Not yet, suggest some").
 *
 * Deterministic: the same pure match engine the Matches page uses ranks the
 * whole catalog (stream/average/distance/language), the AI-extracted interest
 * tags from the chat only reorder candidates, and the public-only budget
 * constraint filters private schools. Top N (5) compatible formations are
 * appended as real wish rows the student can reorder or delete.
 *
 * Idempotent: if the student already has wishes, nothing is added.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();

    const existing = await listWishes(user.id);
    if (existing.length > 0) {
      return ok({ seeded: 0, items: existing, count: existing.length });
    }

    const [profileRow, formations] = await Promise.all([
      getBacProfile(user.id),
      listFormations(),
    ]);
    const profile = profileRow ? bacProfileData(profileRow) : null;
    const ids = suggestWishOrder(formations, profile);

    if (ids.length > 0) {
      await db.insert(wishes).values(
        ids.map((formationId, i) => ({
          id: uuidv7(),
          userId: user.id,
          formationId,
          position: i + 1,
        })),
      );
    }

    const rows = await listWishes(user.id);
    return ok({ seeded: ids.length, items: rows, count: rows.length });
  } catch (e) {
    return errorResponse(req, e);
  }
}
