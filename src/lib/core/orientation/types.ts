/**
 * Mode A shared types (nava-full-documentation.md §7). Pure, no I/O.
 */
import { z } from "zod";

export const BAC_STREAMS = [
  "sciences_experimentales",
  "mathematiques",
  "technique_mathematique",
  "gestion_economie",
  "lettres_philosophie",
  "langues_etrangeres",
  "other",
] as const;
export type BacStream = (typeof BAC_STREAMS)[number];

export const WORK_STYLES = ["people", "machines", "data", "ideas"] as const;
export type WorkStyle = (typeof WORK_STYLES)[number];

export const PRACTICALITY = ["practical", "theoretical", "unsure"] as const;

export const STUDY_LENGTHS = ["3", "5", "5+", "unsure"] as const;

export const ABROAD_OPENNESS = ["yes", "maybe_later", "no"] as const;
export type AbroadOpenness = (typeof ABROAD_OPENNESS)[number];

export const VERDICTS = ["eligible", "likely", "stretch", "unknown", "ineligible"] as const;
export type OrientationVerdict = (typeof VERDICTS)[number];

export interface BacProfileData {
  stream: BacStream | null;
  streamOption: string | null;
  bacAverage: number | null;
  averageIsEstimate: boolean;
  bacYear: number | null;
  homeWilaya: string | null;
  interests: string[];
  workStyle: WorkStyle | null;
  practicality: string | null;
  studyLengthPref: string | null;
  constraints: {
    distance?: "my_wilaya" | "nearby" | "anywhere";
    budget?: string;
    housing?: "university" | "own";
    institutionType?: "public" | "private" | "both";
    language?: "ar" | "fr" | "en" | "any";
    avoid?: string;
  };
  draftWishes: string[];
  abroadOpenness: AbroadOpenness | null;
}

export interface FormationRow {
  id: string;
  nameFr: string;
  nameEn: string | null;
  nameAr: string | null;
  institution: string;
  institutionKind: string;
  city: string;
  wilayaCode: number;
  wilayaName: string;
  streams: string[];
  language: string;
  domainTags: string[];
  durationYears: number;
  tuition: string;
  cutoffLastYear: number | null;
  needsVerification: boolean;
}

export interface OrientationFactor {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail" | "unknown";
}

export interface OrientationMatch {
  formation: FormationRow;
  verdict: OrientationVerdict;
  score: number; // 0–100, display only
  factors: OrientationFactor[];
  blockers: string[];
  missing: string[];
}

/** Zod boundary for the intake profile written from the chatbot. */
export const bacProfilePatchSchema = z
  .object({
    stream: z.enum(BAC_STREAMS).nullish(),
    streamOption: z.string().max(60).nullish(),
    bacAverage: z.number().min(0).max(20).nullish(),
    averageIsEstimate: z.boolean().nullish(),
    bacYear: z.number().int().min(2000).max(2100).nullish(),
    homeWilaya: z.string().max(40).nullish(),
    interests: z.array(z.string().min(1).max(40)).max(12).nullish(),
    workStyle: z.enum(WORK_STYLES).nullish(),
    practicality: z.enum(PRACTICALITY).nullish(),
    studyLengthPref: z.enum(STUDY_LENGTHS).nullish(),
    abroadOpenness: z.enum(ABROAD_OPENNESS).nullish(),
    constraints: z
      .object({
        distance: z.enum(["my_wilaya", "nearby", "anywhere"]).nullish(),
        budget: z.string().max(60).nullish(),
        housing: z.enum(["university", "own"]).nullish(),
        institutionType: z.enum(["public", "private", "both"]).nullish(),
        language: z.enum(["ar", "fr", "en", "any"]).nullish(),
        avoid: z.string().max(120).nullish(),
      })
      .nullish(),
  })
  .strict();
