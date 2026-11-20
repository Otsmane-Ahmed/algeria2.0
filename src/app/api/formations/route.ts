import { ApiError, errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { bacProfileData, getBacProfile, listFormations } from "@/lib/app-data";
import { evaluateFormation } from "@/lib/core/orientation/match";
import type { FormationRow } from "@/lib/core/orientation/types";
import { z } from "zod";

/**
 * GET /api/formations — Mode A catalog scored against the bac profile.
 * `?simulate_average=14` recomputes with a simulated value for the what-if
 * panel; the response always marks what is simulated.
 */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const url = new URL(req.url);
    const sim = z.coerce.number().min(0).max(20).optional().catch(undefined).parse(
      url.searchParams.get("simulate_average") ?? undefined,
    );

    const row = await getBacProfile(user.id);
    const profile = row ? bacProfileData(row) : null;
    const effective = sim !== undefined && profile ? { ...profile, bacAverage: sim, averageIsEstimate: true } : profile;

    const rows = await listFormations();
    const catalog: FormationRow[] = rows.map((f) => ({
      id: f.id,
      nameFr: f.nameFr,
      nameEn: f.nameEn,
      nameAr: f.nameAr,
      institution: f.institution,
      institutionKind: f.institutionKind,
      city: f.city,
      wilayaCode: f.wilayaCode,
      wilayaName: f.wilayaName,
      streams: f.streams,
      language: f.language,
      domainTags: f.domainTags,
      durationYears: f.durationYears,
      tuition: f.tuition,
      cutoffLastYear: f.cutoffLastYear,
      needsVerification: f.needsVerification,
    }));

    const scored = catalog
      .map((f) => evaluateFormation(f, effective))
      .sort((a, b) => {
        const rank = { ineligible: 4, stretch: 3, unknown: 2, likely: 1, eligible: 0 } as const;
        return rank[a.verdict] - rank[b.verdict] || b.score - a.score;
      });

    return ok({
      items: scored,
      count: scored.length,
      simulated: sim !== undefined,
      note:
        sim !== undefined
          ? "Simulation, not your real result"
          : undefined,
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
