/**
 * Mode A intake chatbot turn engine (§7.1). The conversation is a fixed,
 * deterministic sequence of turns — the AI never invents a mark and only
 * extracts tags from free text (done in the API route, not here, so this
 * module stays pure and unit-testable). Every turn except stream and average
 * is skippable (§7.1.3).
 */
import type { BacProfileData, BacStream, WorkStyle } from "./types";

export interface TurnDef {
  id: string;
  /** Which profile fields this turn fills (for the live card + skip cost). */
  fields: (keyof BacProfileData)[];
  skippable: boolean;
}

export const TURNS: TurnDef[] = [
  { id: "greeting", fields: [], skippable: true },
  { id: "stream", fields: ["stream"], skippable: false },
  { id: "stream_option", fields: ["streamOption"], skippable: true },
  { id: "average", fields: ["bacAverage"], skippable: false },
  { id: "bac_year", fields: ["bacYear"], skippable: true },
  { id: "wilaya", fields: ["homeWilaya"], skippable: true },
  { id: "interests", fields: ["interests"], skippable: true },
  { id: "work_style", fields: ["workStyle"], skippable: true },
  { id: "practicality", fields: ["practicality"], skippable: true },
  { id: "study_length", fields: ["studyLengthPref"], skippable: true },
  { id: "constraints.distance", fields: ["constraints"], skippable: true },
  { id: "constraints.budget", fields: ["constraints"], skippable: true },
  { id: "constraints.housing", fields: ["constraints"], skippable: true },
  { id: "constraints.institution", fields: ["constraints"], skippable: true },
  { id: "constraints.language", fields: ["constraints"], skippable: true },
  { id: "wishes", fields: ["draftWishes"], skippable: true },
  { id: "abroad", fields: ["abroadOpenness"], skippable: true },
  { id: "confirm", fields: [], skippable: false },
];

export function turnIndex(id: string): number {
  return TURNS.findIndex((t) => t.id === id);
}

export function nextTurn(id: string): string | null {
  const i = turnIndex(id);
  if (i < 0 || i >= TURNS.length - 1) return null;
  return TURNS[i + 1]!.id;
}

/** Completeness of the live card (§7.1.1): filled non-empty fields / total. */
export function bacCompleteness(p: BacProfileData): number {
  const checks: boolean[] = [
    p.stream != null && p.stream !== "other",
    p.bacAverage != null,
    p.bacYear != null,
    p.homeWilaya != null,
    p.interests.length > 0 || p.workStyle != null,
    Object.keys(p.constraints).length > 0,
    p.draftWishes.length > 0,
    p.abroadOpenness != null,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

const numRe = /^(\d{1,2})([.,](\d{1,2}))?$/;

/** Tolerant average parsing: "14.35", "14,35", "14.3" — never invents digits. */
export function parseAverage(raw: string): { value: number; unusual: boolean } | null {
  const m = numRe.exec(raw.trim());
  if (!m) return null;
  const value = Number(`${m[1]}.${m[3] ?? "0"}`);
  if (!Number.isFinite(value)) return null;
  return { value, unusual: value > 20 || (value < 5 && raw.includes(".")) };
}

export const STREAMS: BacStream[] = [
  "sciences_experimentales",
  "mathematiques",
  "technique_mathematique",
  "gestion_economie",
  "lettres_philosophie",
  "langues_etrangeres",
  "other",
];

export const WORK_STYLE_OPTIONS: WorkStyle[] = ["people", "machines", "data", "ideas"];

/** French names of the 58 wilayas (stable official list). */
export const WILAYA_NAMES = [
  "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra",
  "Béchar", "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret",
  "Tizi-Ouzou", "Alger", "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda",
  "Sidi-Bel-Abbès", "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem",
  "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh", "Illizi",
  "Bordj-Bou-Arreridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued",
  "Khenchela", "Souk-Ahras", "Tipaza", "Mila", "Aïn-Defla", "Naâma",
  "Aïn-Témouchent", "Ghardaïa", "Relizane",
];

/** Turn-specific validation. Returns either a patch or a validation error. */
export type TurnResult =
  | { ok: true; patch: Partial<BacProfileData>; warn?: string }
  | { ok: false; error: "invalid_average" | "unusual_average" | "invalid_value"; value?: number };

export function applyTurn(
  turnId: string,
  input: string | string[] | number | null | undefined,
  profile: BacProfileData,
): TurnResult {
  switch (turnId) {
    case "stream": {
      const v = String(input);
      if (!STREAMS.includes(v as BacStream)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { stream: v as BacStream } };
    }
    case "average": {
      if (typeof input === "string" && input === "no_result") {
        return {
          ok: true,
          patch: { bacAverage: null, averageIsEstimate: true },
          warn: "estimate_mode",
        };
      }
      // "estimate:14" — an expected average, shown as estimate until a real
      // result replaces it (§7.1.2 turn 2).
      if (typeof input === "string" && input.startsWith("estimate:")) {
        const parsed = parseAverage(input.slice("estimate:".length));
        if (!parsed || parsed.unusual) return { ok: false, error: "invalid_average" };
        return { ok: true, patch: { bacAverage: parsed.value, averageIsEstimate: true } };
      }
      const raw = typeof input === "string" ? input : String(input);
      const parsed = parseAverage(raw);
      if (!parsed) return { ok: false, error: "invalid_average" };
      if (parsed.unusual) return { ok: false, error: "unusual_average", value: parsed.value };
      return { ok: true, patch: { bacAverage: parsed.value, averageIsEstimate: false } };
    }
    case "stream_option": {
      const v = String(input).trim();
      if (v.length < 2 || v.length > 60) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { streamOption: v } };
    }
    case "bac_year": {
      const year = Number(input);
      if (!Number.isInteger(year) || year < 2000 || year > 2100)
        return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { bacYear: year } };
    }
    case "wilaya": {
      const v = String(input).trim();
      if (v.length < 2 || v.length > 40) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { homeWilaya: v } };
    }
    case "interests": {
      const arr = Array.isArray(input) ? input.map(String) : String(input ?? "").split(",");
      const tags = arr
        .map((s) => s.trim().slice(0, 40))
        .filter((s) => s.length > 0 && s.length <= 40)
        .slice(0, 12);
      return { ok: true, patch: { interests: tags } };
    }
    case "work_style": {
      const v = String(input);
      if (!WORK_STYLE_OPTIONS.includes(v as WorkStyle)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { workStyle: v as WorkStyle } };
    }
    case "practicality": {
      const v = String(input);
      if (!["practical", "theoretical", "unsure"].includes(v))
        return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { practicality: v } };
    }
    case "study_length": {
      const v = String(input);
      if (!["3", "5", "5+", "unsure"].includes(v)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { studyLengthPref: v } };
    }
    case "constraints.distance": {
      const v = String(input);
      if (!["my_wilaya", "nearby", "anywhere"].includes(v)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { constraints: { ...profile.constraints, distance: v as BacProfileData["constraints"]["distance"] } } };
    }
    case "constraints.housing": {
      const v = String(input);
      if (!["university", "own"].includes(v)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { constraints: { ...profile.constraints, housing: v as BacProfileData["constraints"]["housing"] } } };
    }
    case "constraints.language": {
      const v = String(input);
      if (!["ar", "fr", "en", "any"].includes(v)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { constraints: { ...profile.constraints, language: v as BacProfileData["constraints"]["language"] } } };
    }
    case "constraints.institution": {
      const v = String(input);
      if (!["public", "private", "both"].includes(v)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { constraints: { ...profile.constraints, institutionType: v as BacProfileData["constraints"]["institutionType"] } } };
    }
    case "constraints.budget": {
      const v = String(input);
      if (v.length > 60) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { constraints: { ...profile.constraints, budget: v } } };
    }
    case "wishes": {
      const arr = Array.isArray(input) ? input : String(input ?? "").split(",");
      const w = arr.map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 20);
      return { ok: true, patch: { draftWishes: w } };
    }
    case "abroad": {
      const v = String(input);
      if (!["yes", "maybe_later", "no"].includes(v)) return { ok: false, error: "invalid_value" };
      return { ok: true, patch: { abroadOpenness: v as BacProfileData["abroadOpenness"] } };
    }
    default:
      return { ok: false, error: "invalid_value" };
  }
}

/** Safer wish order (§7.2): risky (stretch/ineligible) wishes sink to the
 *  bottom, unknown stays, others keep relative order. Pure suggestion. */
export function saferWishOrder<T extends { verdict: string }>(ordered: T[]): number[] {
  const rank = (v: string) =>
    v === "ineligible" || v === "stretch" ? 2 : v === "unknown" ? 1 : 0;
  return ordered
    .map((w, i) => ({ w, i }))
    .sort((a, b) => rank(a.w.verdict) - rank(b.w.verdict) || a.i - b.i)
    .map((x) => x.i);
}

/** Fiche de vœux warnings (§7.2). `ids` are the wish formation ids. */
export function wishWarnings(verdicts: string[], ids: string[] = []): string[] {
  const out: string[] = [];
  const risky = verdicts.filter((v) => v === "stretch" || v === "ineligible").length;
  if (verdicts.length >= 3 && risky === verdicts.length)
    out.push("too_many_risky");
  const last = verdicts[verdicts.length - 1];
  if (verdicts.length >= 2 && !(last === "likely" || last === "eligible" || last === "unknown"))
    out.push("no_safe_option");
  if (new Set(ids).size !== ids.length) out.push("duplicates");
  return out;
}
