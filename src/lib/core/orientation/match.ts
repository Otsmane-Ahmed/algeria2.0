/**
 * Mode A formation matching (§7.3). Deterministic and pure — like the
 * scholarship evaluator, a missing cut-off never passes: the verdict is
 * "unknown" (tri-state). Scoring is display-only; eligibility logic never
 * uses the score.
 */
import type {
  BacProfileData,
  FormationRow,
  OrientationFactor,
  OrientationMatch,
  OrientationVerdict,
} from "./types";

const WILAYA_NEIGHBOURS: Record<number, number[]> = {
  16: [9, 15, 35, 42], // Alger ~ Blida, Tizi-Ouzou, Médéa, Tipaza
  9: [16, 15, 42, 10], // Blida ~ Alger, Tizi-Ouzou, Tipaza, Bouira
  15: [16, 9, 6, 10], // Tizi-Ouzou ~ Alger, Blida, Béjaïa, Bouira
  6: [15, 19, 10, 18], // Béjaïa ~ Tizi-Ouzou, Sétif, Bouira, Jijel
  19: [6, 25, 34, 18], // Sétif ~ Béjaïa, Constantine, Batna, Jijel
  31: [22, 13, 27, 48], // Oran ~ SBA, Tlemcen, Mostaganem, Aïn Témouchent
  22: [31, 13, 8, 14], // SBA ~ Oran, Tlemcen, Béchar, Saïda
  13: [31, 22, 12, 14], // Tlemcen
  25: [19, 43, 21, 32], // Constantine ~ Sétif, Mila, Guelma, El Khroub
  23: [25, 21, 36], // Annaba ~ Constantine, Guelma, Souk Ahras
  7: [39, 5, 12, 45],
  8: [22, 45, 3],
};

export function wilayaNear(a: number, b: number): boolean {
  if (a === b) return true;
  return (WILAYA_NEIGHBOURS[a] ?? []).includes(b);
}

function avgFactor(
  average: number | null,
  cutoff: number | null,
): OrientationFactor {
  if (average == null || cutoff == null) {
    return {
      key: "average",
      label: "Average vs last year's cut-off",
      status: "unknown",
    };
  }
  const gap = average - cutoff;
  if (gap >= 1.5) return { key: "average", label: "Average vs cut-off", status: "ok" };
  if (gap >= 0) return { key: "average", label: "Average vs cut-off", status: "warn" };
  return { key: "average", label: "Average vs cut-off", status: "fail" };
}

export function evaluateFormation(
  formation: FormationRow,
  profile: BacProfileData | null,
): OrientationMatch {
  const factors: OrientationFactor[] = [];
  const blockers: string[] = [];
  const missing: string[] = [];

  // 1. Stream acceptance — hard rule.
  if (profile?.stream && profile.stream !== "other") {
    if (formation.streams.includes(profile.stream)) {
      factors.push({ key: "stream", label: "Stream accepted", status: "ok" });
    } else {
      factors.push({ key: "stream", label: "Stream accepted", status: "fail" });
      blockers.push("stream_not_accepted");
    }
  } else {
    missing.push("stream");
  }

  // 2. Average vs cut-off — unknown while either value is missing/unverified.
  factors.push(avgFactor(profile?.bacAverage ?? null, formation.cutoffLastYear));
  if (profile?.bacAverage == null) missing.push("bac_average");
  if (formation.cutoffLastYear == null) missing.push("cutoff_last_year");

  // 3. Distance.
  if (profile?.homeWilaya) {
    const same = wilayaNear(formation.wilayaCode, wilayaCodeOf(profile.homeWilaya));
    const constraint = profile.constraints.distance ?? "anywhere";
    if (same) factors.push({ key: "distance", label: "Close to home", status: "ok" });
    else if (constraint === "my_wilaya") {
      factors.push({ key: "distance", label: "Far from home", status: "fail" });
      blockers.push("outside_home_wilaya");
    } else if (constraint === "nearby") {
      factors.push({ key: "distance", label: "Far from home", status: "warn" });
    } else {
      factors.push({ key: "distance", label: "In another wilaya", status: "ok" });
    }
  } else {
    factors.push({ key: "distance", label: "Distance", status: "unknown" });
    missing.push("home_wilaya");
  }

  // 4. Study language vs preference.
  const langPref = profile?.constraints.language ?? "any";
  if (langPref === "any" || !profile) {
    factors.push({ key: "language", label: "Study language", status: "ok" });
  } else if (formation.language === langPref) {
    factors.push({ key: "language", label: "Study language", status: "ok" });
  } else {
    factors.push({ key: "language", label: "Study language differs", status: "warn" });
  }

  // Verdict: blockers => ineligible; any fail => stretch; any unknown => unknown;
  // warn => stretch (honest, given unverified data); all ok => likely/eligible.
  let verdict: OrientationVerdict;
  if (blockers.length > 0) verdict = "ineligible";
  else if (factors.some((f) => f.status === "fail")) verdict = "stretch";
  else if (factors.some((f) => f.status === "unknown")) verdict = "unknown";
  else if (factors.some((f) => f.status === "warn")) verdict = "stretch";
  else verdict = "likely";

  // Score (display only): stream 40, average 35, distance 15, language 10.
  let score = 0;
  const s = (key: string, max: number) => {
    const f = factors.find((x) => x.key === key);
    if (!f) return max;
    if (f.status === "ok") return max;
    if (f.status === "warn") return Math.round(max * 0.6);
    if (f.status === "unknown") return Math.round(max * 0.5);
    return 0;
  };
  score = s("stream", 40) + s("average", 35) + s("distance", 15) + s("language", 10);

  return { formation, verdict, score, factors, blockers, missing };
}

const WILAYA_CODES: Record<string, number> = {
  adrar: 1, chlef: 2, laghouat: 3, oum_el_bouaghi: 4, batna: 5, bejaia: 6, biskra: 7,
  bechar: 8, blida: 9, bouira: 10, tamanrasset: 11, tebessa: 12, tlemcen: 13, tiaret: 14,
  tizi_ouzou: 15, alger: 16, djelfa: 17, jijel: 18, setif: 19, saida: 20, skikda: 21,
  sidi_bel_abbes: 22, annaba: 23, guelma: 24, constantine: 25, medea: 26, mostaganem: 27,
  msila: 28, mascara: 29, ouargla: 30, oran: 31, el_bayadh: 32, illizi: 33, bordj_bou_arreridj: 34,
  boumerdes: 35, el_tarf: 36, tindouf: 37, tissemsilt: 38, el_oued: 39, khenchela: 40,
  souk_ahras: 41, tipaza: 42, mila: 43, ain_defla: 44, naama: 45, ain_temouchent: 46,
  ghardaia: 47, relizane: 48,
};

export function wilayaCodeOf(slugOrName: string): number {
  const key = slugOrName.toLowerCase().trim();
  if (WILAYA_CODES[key] != null) return WILAYA_CODES[key];
  return 0;
}
