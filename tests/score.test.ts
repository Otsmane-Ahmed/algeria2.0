import { describe, it, expect } from "vitest";
import { scoreMatch, rankItems, academicStrength } from "@/lib/core/eligibility/score";
import { scholarshipFixture, factsFixture, PARENT_OF } from "./fixtures";

const TODAY = "2026-11-20";

function run(over: Record<string, unknown> = {}, factsOver: Record<string, unknown> = {}, schOver = {}) {
  return scoreMatch({
    facts: factsFixture(factsOver),
    scholarship: scholarshipFixture(schOver),
    today: TODAY,
    parentOf: PARENT_OF,
    leadTimeDays: 60,
    now: new Date("2026-11-20T12:00:00Z"),
    ...over,
  });
}

describe("scoreMatch", () => {
  it("is deterministic: identical inputs give identical outputs", () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("marks ineligible when a hard rule fails", () => {
    const r = run({}, { nationality: "FR" });
    expect(r.verdict).toBe("ineligible");
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(r.blockers[0]?.label?.en).toBeUndefined(); // no label on this rule
  });

  it("marks unknown (never pass) when a hard fact is missing", () => {
    const r = run({}, { nationality: null });
    expect(r.verdict).toBe("unknown");
    expect(r.missingInfo).toContain("nationality");
    expect(r.blockers).toHaveLength(0);
  });

  it("flags a passed deadline as ineligible", () => {
    const r = run({}, {}, {
      cycle: { cycle_id: "2026", deadline: "2026-01-31", deadline_tz: "Europe/Paris", rolling: false, status: "closed" },
    });
    expect(r.verdict).toBe("ineligible");
    expect(r.daysToDeadline).toBeLessThan(0);
    expect(r.blockers.some((b) => b.fact === "deadline")).toBe(true);
  });

  it("excludes unknown factors from the score instead of counting them as 0", () => {
    // no language requirement, no soft rules, unknown deadline => only level/field/gpa/country/funding known
    const r = run({}, {}, { cycle: { cycle_id: "2027", deadline: null, rolling: false } });
    const unknown = r.factors.filter((f) => f.status === "unknown");
    expect(unknown.length).toBeGreaterThanOrEqual(1); // deadline unknown
    const deadlineFactor = r.factors.find((f) => f.key === "deadline")!;
    expect(deadlineFactor.status).toBe("unknown");
  });

  it("scores a well-matched profile >= 60 (likely or better)", () => {
    const r = run();
    expect(["eligible", "likely", "stretch"]).toContain(r.verdict);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it("penalizes funding mismatch when full funding is required", () => {
    const withFull = run({}, {}, { funding: { tuition: "full" } });
    const withNone = run({}, {}, { funding: { tuition: "none" } });
    expect(withNone.score).toBeLessThan(withFull.score);
    const noneFactor = withNone.factors.find((f) => f.key === "funding")!;
    expect(noneFactor.status).toBe("fail");
  });

  it("rewards target country match", () => {
    const hit = run({}, { target_countries: ["FR"] });
    const miss = run({}, { target_countries: ["JP"] });
    expect(hit.score).toBeGreaterThan(miss.score);
  });

  it("gives partial credit for a related parent field", () => {
    const open = run({}, {}, { fields: [] });
    const parentMatch = run({}, {}, { fields: ["stem"] }); // student's cs -> parent stem
    const noMatch = run({}, {}, { fields: ["econ"] });
    const f = (r: typeof open) => r.factors.find((x) => x.key === "field")!;
    expect(f(open).status).toBe("pass");
    expect(f(parentMatch).status).toBe("partial");
    expect(f(noMatch).status).toBe("fail");
    expect(parentMatch.score).toBeGreaterThan(noMatch.score);
  });

  it("treats a target level mismatch as a scoring fail (not a hard blocker)", () => {
    const r = run({}, { target_level: "doctorate" });
    expect(r.verdict).not.toBe("ineligible");
    expect(r.factors.find((f) => f.key === "level")?.status).toBe("fail");
  });

  it("computes days to deadline in the deadline timezone", () => {
    const r = run();
    // 2026-11-20 -> 2027-01-31 = 72 days
    expect(r.daysToDeadline).toBe(72);
  });

  it("deadline feasibility: impossible when lead time exceeds days left", () => {
    const r = run({ leadTimeDays: 200 }); // 72 days left < 200 needed
    const f = r.factors.find((x) => x.key === "deadline")!;
    expect(f.status).toBe("fail");
  });

  it("rolling deadlines always feasible", () => {
    const r = run({}, {}, { cycle: { cycle_id: "2027", deadline: null, rolling: true, status: "open" } });
    expect(r.factors.find((f) => f.key === "deadline")?.status).toBe("pass");
    expect(r.daysToDeadline).toBeNull();
  });

  it("language requirement unknown => factor unknown, not fail", () => {
    const r = run({}, { languages: {} }, { language_requirements: [{ lang: "en", tests: [{ name: "IELTS", min: 6.5 }] }] });
    const f = r.factors.find((x) => x.key === "language")!;
    expect(f.status).toBe("unknown");
  });

  it("valid certificate above min => language pass", () => {
    const r = run({}, {}, { language_requirements: [{ lang: "en", tests: [{ name: "IELTS", min: 6.0 }] }] });
    expect(r.factors.find((f) => f.key === "language")?.status).toBe("pass");
  });

  it("certificate below min => language fail", () => {
    const r = run({}, {}, { language_requirements: [{ lang: "en", tests: [{ name: "IELTS", min: 8.0 }] }] });
    expect(r.factors.find((f) => f.key === "language")?.status).toBe("fail");
  });

  it("expired certificate is not counted as valid", () => {
    const r = run({}, {
      languages: { en: { cefr: "B2", cert: { name: "IELTS", score: "7.0", valid_until: "2020-01-01" } } },
    }, { language_requirements: [{ lang: "en", tests: [{ name: "IELTS", min: 6.0 }] }] });
    // expired + numeric-only requirement => unknown (never silently pass)
    expect(r.factors.find((f) => f.key === "language")?.status).toBe("unknown");
  });

  it("scores are in 0..100", () => {
    for (const gpa of [null, 8, 11, 13, 15, 17, 20]) {
      const r = run({}, { gpa_20: gpa });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("higher GPA never lowers the score (competitiveness fixed)", () => {
    const low = run({}, { gpa_20: 11 }).score;
    const mid = run({}, { gpa_20: 14.5 }).score;
    const high = run({}, { gpa_20: 17 }).score;
    expect(low).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(high);
  });
});

describe("academicStrength", () => {
  it("follows the spec bands and competitiveness adjustment", () => {
    expect(academicStrength(16, 1)).toBe(1);
    expect(academicStrength(14, 1)).toBeCloseTo(0.8, 5);
    expect(academicStrength(12, 1)).toBeCloseTo(0.55, 5);
    expect(academicStrength(10, 1)).toBeCloseTo(0.3, 5);
    // competitiveness 5 => s *= (1 - 0.08*4) = 0.68
    expect(academicStrength(16, 5)).toBeCloseTo(0.68, 5);
    expect(academicStrength(null, 3)).toBeNull();
  });
});

describe("rankItems", () => {
  const items = [
    { verdict: "stretch" as const, score: 90, daysToDeadline: 10, name: "z" },
    { verdict: "eligible" as const, score: 70, daysToDeadline: 10, name: "b" },
    { verdict: "eligible" as const, score: 70, daysToDeadline: 5, name: "a" },
    { verdict: "ineligible" as const, score: 99, daysToDeadline: 1, name: "c" },
    { verdict: "likely" as const, score: 65, daysToDeadline: null, name: "d" },
  ];

  it("orders by verdict class, then score desc, then nearest deadline, then name", () => {
    const ranked = rankItems(items);
    expect(ranked.map((i) => i.name)).toEqual(["a", "b", "d", "z", "c"]);
  });

  it("puts unknown deadlines after dated ones within the same class", () => {
    const ranked = rankItems([
      { verdict: "likely" as const, score: 65, daysToDeadline: null, name: "x" },
      { verdict: "likely" as const, score: 65, daysToDeadline: 40, name: "y" },
    ]);
    expect(ranked[0]?.name).toBe("y");
  });

  it("is stable across runs", () => {
    expect(rankItems(items)).toEqual(rankItems(items));
  });
});
