import { describe, expect, it } from "vitest";
import { isSparseText } from "@/lib/ocr";

/**
 * OCR is the fallback that makes scans readable when the vision model is
 * unavailable; `isSparseText` decides whether we need it. Thresholds here pin
 * the decision: a real transcript's layer must trigger OCR, real OCR output
 * must not loop back into another OCR pass.
 */
describe("isSparseText", () => {
  it("treats empty and whitespace-only text as a scan", () => {
    expect(isSparseText("")).toBe(true);
    expect(isSparseText("  \n\t  \n")).toBe(true);
  });

  it("treats a bare header as a scan (below the threshold)", () => {
    expect(isSparseText("République Algérienne Démocratique et Populaire")).toBe(true);
  });

  it("accepts transcript-length text (at or above 120 non-space chars)", () => {
    const line = "Relevé de Notes — Master 1 — Mention Très Bien — Moyenne 14.20 sur 20";
    expect(isSparseText([line, line, line].join(" \n "))).toBe(false);
  });

  it("ignores whitespace when measuring (dense Arabic/tables)", () => {
    const dense = "x".repeat(60) + "\n".repeat(30) + "y".repeat(60);
    expect(isSparseText(dense)).toBe(false);
  });
});
