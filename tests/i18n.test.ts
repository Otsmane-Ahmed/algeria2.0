import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "../src/lib/core/types";
import { getMessages, t, pickLocalized } from "../src/lib/i18n";

const ROOT = join(__dirname, "..");

function flatten(o: Record<string, unknown>, prefix = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out);
    else out.push(key);
  }
  return out;
}

describe("i18n messages", () => {
  it("ships exactly one file per locale", () => {
    const files = readdirSync(join(ROOT, "src/messages")).filter((f) => f.endsWith(".json"));
    expect(files.sort()).toEqual(["ar.json", "en.json", "fr.json"]);
  });

  it("has identical key sets in ar, fr and en", () => {
    const sets = LOCALES.map((l) =>
      flatten(JSON.parse(readFileSync(join(ROOT, "src/messages", `${l}.json`), "utf8"))).sort(),
    );
    for (let i = 1; i < sets.length; i++) {
      const missing = sets[0]!.filter((k) => !sets[i]!.includes(k));
      const extra = sets[i]!.filter((k) => !sets[0]!.includes(k));
      expect({ locale: LOCALES[i], missing, extra }).toEqual({ locale: LOCALES[i], missing: [], extra: [] });
    }
    expect(sets[0]!.length).toBeGreaterThan(250);
  });

  it("has no empty translations", () => {
    for (const l of LOCALES) {
      const flat = flatten(JSON.parse(readFileSync(join(ROOT, "src/messages", `${l}.json`), "utf8")));
      expect({ locale: l, empty: flat.filter((k) => k.length === 0) }).toEqual({ locale: l, empty: [] });
    }
  });

  it("interpolates {n} and leaves unknown keys visible", () => {
    expect(t("en", "common.days", { n: 7 })).toBe("7 days");
    expect(t("fr", "common.days", { n: 7 })).toBe("7 jours");
    expect(t("ar", "common.days", { n: 7 })).toContain("7");
    expect(t("en", "no.such.key")).toBe("no.such.key");
  });

  it("loads all locales", () => {
    for (const l of LOCALES) expect(Object.keys(getMessages(l)).length).toBeGreaterThan(250);
  });
});

describe("pickLocalized", () => {
  it("follows locale -> fr -> en fallback (spec 8.1)", () => {
    expect(pickLocalized({ en: "E", fr: "F", ar: "A" }, "ar")).toBe("A");
    expect(pickLocalized({ en: "E", fr: "F" }, "ar")).toBe("F");
    expect(pickLocalized({ en: "E" }, "ar")).toBe("E");
    expect(pickLocalized(null, "ar")).toBe("");
  });
});
