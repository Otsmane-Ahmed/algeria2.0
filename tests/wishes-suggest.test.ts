import { describe, expect, it } from "vitest";
import { evaluateFormation, suggestWishOrder } from "@/lib/core/orientation/match";
import type { BacProfileData, FormationRow } from "@/lib/core/orientation/types";

function formation(over: Partial<FormationRow> = {}): FormationRow {
  return {
    id: "f",
    nameFr: "Informatique",
    nameEn: "Computer Science",
    nameAr: null,
    institution: "Université X",
    institutionKind: "university",
    city: "Alger",
    wilayaCode: 16,
    wilayaName: "Alger",
    streams: ["sciences_experimentales"],
    language: "fr",
    domainTags: ["informatique"],
    durationYears: 5,
    tuition: "public",
    cutoffLastYear: null,
    needsVerification: true,
    ...over,
  };
}

function profile(over: Partial<BacProfileData> = {}): BacProfileData {
  return {
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
    ...over,
  };
}

describe("suggestWishOrder", () => {
  it("never suggests a formation whose stream blocks the student", () => {
    const f = formation({ id: "blocked", streams: ["lettres_philosophie"] });
    const p = profile({ stream: "sciences_experimentales" });
    expect(suggestWishOrder([f], p)).toEqual([]);
    expect(evaluateFormation(f, p).verdict).toBe("ineligible");
  });

  it("ranks formations that accept the stream above those that do not know it", () => {
    const accepts = formation({ id: "accepts", streams: ["sciences_experimentales"] });
    const unknownStream = formation({ id: "nostream", streams: [] });
    const p = profile({ stream: "sciences_experimentales" });
    const ids = suggestWishOrder([unknownStream, accepts], p);
    expect(ids[0]).toBe("accepts");
  });

  it("boosts formations related to the AI-extracted interest tags (accent-insensitive)", () => {
    const cs = formation({ id: "cs", domainTags: ["informatique"] });
    const law = formation({ id: "law", nameFr: "Droit", domainTags: ["droit"] });
    const p = profile({ stream: "sciences_experimentales", interests: ["Informatique"] });
    expect(suggestWishOrder([law, cs], p)[0]).toBe("cs");
    // same verdicts, no interests → catalog order tie-break
    expect(suggestWishOrder([law, cs], profile({ stream: "sciences_experimentales" }))[0]).toBe("law");
  });

  it("matches multi-word interests on any significant word", () => {
    const cs = formation({ id: "cs", domainTags: ["informatique"], nameFr: "Informatique" });
    const p = profile({ interests: ["intelligence artificielle"] });
    expect(suggestWishOrder([cs], p)).toEqual(["cs"]); // "artificielle" not found, but order kept
    const med = formation({ id: "med", nameFr: "Médecine", domainTags: ["medecine"] });
    expect(suggestWishOrder([med], profile({ interests: ["médecine"] }))).toEqual(["med"]);
  });

  it("respects the limit and the input order for ties", () => {
    const fs = Array.from({ length: 10 }, (_, i) => formation({ id: `f${i}` }));
    const p = profile();
    const ids = suggestWishOrder(fs, p, 5);
    expect(ids).toEqual(["f0", "f1", "f2", "f3", "f4"]);
  });

  it("honours the public-only constraint", () => {
    const pub = formation({ id: "pub", tuition: "public" });
    const priv = formation({ id: "priv", tuition: "private" });
    const p = profile({ constraints: { budget: "free_only" } });
    expect(suggestWishOrder([pub, priv], p)).toEqual(["pub"]);
    const p2 = profile({ constraints: { institutionType: "public" } });
    expect(suggestWishOrder([pub, priv], p2)).toEqual(["pub"]);
    const p3 = profile({ constraints: { institutionType: "both" } });
    expect(suggestWishOrder([pub, priv], p3)).toEqual(["pub", "priv"]);
  });

  it("works with an empty profile (suggests generic top catalog entries)", () => {
    const fs = [formation({ id: "a" }), formation({ id: "b" })];
    expect(suggestWishOrder(fs, null, 1)).toEqual(["a"]);
  });
});
