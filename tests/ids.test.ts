import { describe, it, expect } from "vitest";
import { uuidv7 } from "@/lib/core/ids";

describe("uuidv7", () => {
  it("matches the UUID format and version/variant bits", () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is time-sortable", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_800_000_000_000);
    expect(a < b).toBe(true);
  });

  it("encodes the timestamp in the first 48 bits", () => {
    const at = 1_766_000_000_000;
    const hex = uuidv7(at).replace(/-/g, "");
    const ts = Number(BigInt(`0x${hex.slice(0, 12)}`));
    expect(ts).toBe(at);
  });
});
