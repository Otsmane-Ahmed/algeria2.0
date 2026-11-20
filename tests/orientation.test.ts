import { describe, expect, it } from "vitest";
import {
  bacCompleteness,
  applyTurn,
  parseAverage,
  saferWishOrder,
  wishWarnings,
  TURNS,
} from "../src/lib/core/orientation/chat";
import { evaluateFormation, wilayaNear } from "../src/lib/core/orientation/match";
import type { BacProfileData, FormationRow } from "../src/lib/core/orientation/types";

const emptyProfile: BacProfileData = {
  stream: null,
  streamOption: null,
  bacAverage: null,
  averageIsEstimate: false,
  bacYear: null,
  homeWilaya: null,
  interests: [],
  workStyle: null,
  practicality: null,
  studyLengthPref: null,
  constraints: {},
  draftWishes: [],
  abroadOpenness: null,
};

const formation: FormationRow = {
  id: "usthb-informatique",
  nameFr: "Informatique",
  nameEn: "Computer Science",
  nameAr: null,
  institution: "USTHB",
  institutionKind: "university",
  city: "Alger",
  wilayaCode: 16,
  wilayaName: "Alger",
  streams: ["sciences_experimentales", "mathematiques"],
  language: "fr",
  domainTags: ["informatique"],
  durationYears: 5,
  tuition: "public",
  cutoffLastYear: 14.5,
  needsVerification: false,
};

describe("turn engine", () => {
  it("has a fixed turn sequence ending in confirm", () => {
    expect(TURNS[TURNS.length - 1]!.id).toBe("confirm");
    expect(TURNS.find((t) => t.id === "stream")!.skippable).toBe(false);
    expect(TURNS.find((t) => t.id === "average")!.skippable).toBe(false);
  });

  it("accepts a plain stream chip", () => {
    const r = applyTurn("stream", "sciences_experimentales", emptyProfile);
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown stream", () => {
    expect(applyTurn("stream", "magie", emptyProfile)).toMatchObject({ ok: false });
  });

  it("parses French decimal averages", () => {
    expect(parseAverage("14,35")).toMatchObject({ value: 14.35, unusual: false });
    expect(parseAverage("14.35")).toMatchObject({ value: 14.35, unusual: false });
  });

  it("flags an impossible average instead of guessing", () => {
    expect(parseAverage("25")).toMatchObject({ unusual: true });
    const r = applyTurn("average", "25", emptyProfile);
    expect(r).toMatchObject({ ok: false, error: "unusual_average" });
  });

  it("never fills a mark the student did not give (no_result -> estimate mode)", () => {
    const r = applyTurn("average", "no_result", emptyProfile);
    expect(r).toMatchObject({ ok: true, patch: { bacAverage: null, averageIsEstimate: true } });
  });

  it("keeps constraint patches additive", () => {
    const p = { ...emptyProfile, constraints: { distance: "anywhere" as const } };
    const r = applyTurn("constraints.housing", "university", p);
    expect(r.ok && r.patch.constraints).toEqual({ distance: "anywhere", housing: "university" });
  });
});

describe("completeness", () => {
  it("is 0 when empty and grows with filled fields", () => {
    expect(bacCompleteness(emptyProfile)).toBe(0);
    expect(bacCompleteness({ ...emptyProfile, stream: "mathematiques" })).toBeGreaterThan(0);
  });
});

describe("formation matching", () => {
  it("eligible-ish profile with matching stream and good average", () => {
    const p: BacProfileData = {
      ...emptyProfile,
      stream: "mathematiques",
      bacAverage: 16,
      homeWilaya: "alger",
    };
    const m = evaluateFormation(formation, p);
    expect(m.verdict).toBe("likely");
    expect(m.blockers).toHaveLength(0);
    expect(m.score).toBeGreaterThan(80);
  });

  it("a wrong stream is a hard blocker -> ineligible", () => {
    const p: BacProfileData = { ...emptyProfile, stream: "lettres_philosophie" };
    expect(evaluateFormation(formation, p).verdict).toBe("ineligible");
  });

  it("an unverified cut-off never passes: verdict is unknown, not eligible", () => {
    const p: BacProfileData = { ...emptyProfile, stream: "mathematiques", bacAverage: 19 };
    const m = evaluateFormation({ ...formation, cutoffLastYear: null }, p);
    expect(m.verdict).toBe("unknown");
    expect(m.missing).toContain("cutoff_last_year");
  });

  it("my_wilaya_only constraint makes a far formation ineligible", () => {
    const p: BacProfileData = {
      ...emptyProfile,
      stream: "mathematiques",
      homeWilaya: "bechar",
      constraints: { distance: "my_wilaya" },
    };
    const m = evaluateFormation(formation, p);
    expect(m.blockers).toContain("outside_home_wilaya");
  });

  it("an average below the cut-off is stretch, never a promise", () => {
    const p: BacProfileData = { ...emptyProfile, stream: "mathematiques", bacAverage: 12 };
    const m = evaluateFormation(formation, p);
    expect(m.verdict).toBe("stretch");
  });
});

describe("wilaya proximity", () => {
  it("Alger neighbours Blida and Tizi", () => {
    expect(wilayaNear(16, 9)).toBe(true);
    expect(wilayaNear(16, 15)).toBe(true);
    expect(wilayaNear(16, 31)).toBe(false);
  });
});

describe("fiche de vœux intelligence", () => {
  it("suggests a safer order by sinking risky wishes", () => {
    const ordered = [{ verdict: "stretch" }, { verdict: "likely" }, { verdict: "ineligible" }];
    expect(saferWishOrder(ordered)).toEqual([1, 0, 2]);
  });

  it("warns when there is no safe option at the bottom", () => {
    expect(wishWarnings(["likely", "stretch"])).toContain("no_safe_option");
    expect(wishWarnings(["likely", "unknown"])).not.toContain("no_safe_option");
  });

  it("flags duplicates by id, not by verdict", () => {
    expect(wishWarnings(["unknown", "unknown"], ["a", "b"])).not.toContain("duplicates");
    expect(wishWarnings(["unknown", "unknown"], ["a", "a"])).toContain("duplicates");
  });
});
