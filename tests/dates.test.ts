import { describe, it, expect } from "vitest";
import {
  addDays,
  addWorkingDays,
  diffDays,
  isWorkingDay,
  subtractWorkingDays,
  todayIn,
  daysUntil,
  isValidISODate,
} from "@/lib/core/dates";

describe("dates", () => {
  it("adds and diffs calendar days across months", () => {
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
    expect(diffDays("2026-12-02", "2026-11-30")).toBe(2);
    expect(diffDays("2026-01-01", "2026-03-01")).toBe(-59);
  });

  it("treats Friday and Saturday as the Algerian weekend", () => {
    // 2026-11-20 is a Friday
    expect(isWorkingDay("2026-11-20")).toBe(false);
    expect(isWorkingDay("2026-11-21")).toBe(false); // Saturday
    expect(isWorkingDay("2026-11-22")).toBe(true); // Sunday
    expect(isWorkingDay("2026-11-23")).toBe(true); // Monday
  });

  it("honors the holidays list", () => {
    expect(isWorkingDay("2027-01-04", { holidays: ["2027-01-04"] })).toBe(false);
    expect(isWorkingDay("2027-01-04")).toBe(true); // Monday
  });

  it("subtracts working days skipping weekends and holidays", () => {
    // Sunday counts as a working day (weekend is Fri+Sat only)
    expect(subtractWorkingDays("2026-11-23", 1)).toBe("2026-11-22"); // Sunday
    expect(subtractWorkingDays("2026-11-23", 5)).toBe("2026-11-16"); // Sun 22, Thu 19, Wed 18, Tue 17, Mon 16
    // a holiday forces the start one day earlier
    expect(subtractWorkingDays("2026-11-23", 5, { holidays: ["2026-11-19"] })).toBe("2026-11-15");
  });

  it("adds working days symmetrically", () => {
    expect(addWorkingDays("2026-11-19", 1)).toBe("2026-11-22");
    expect(addWorkingDays("2026-11-12", 5)).toBe("2026-11-19");
  });

  it("round-trips working-day math", () => {
    for (const n of [1, 3, 7, 20]) {
      const start = "2026-12-01";
      const end = addWorkingDays(start, n);
      expect(subtractWorkingDays(end, n)).toBe(start);
    }
  });

  it("computes today in Africa/Algiers (UTC+1, no DST)", () => {
    const d = new Date("2026-11-20T00:30:00Z"); // 01:30 in Algiers
    expect(todayIn("Africa/Algiers", d)).toBe("2026-11-20");
    const late = new Date("2026-11-19T23:30:00Z"); // 00:30 Nov 20 in Algiers
    expect(todayIn("Africa/Algiers", late)).toBe("2026-11-20");
  });

  it("computes days until a deadline in the provider timezone", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(daysUntil("2027-01-31", "Europe/London", now)).toBe(72);
    expect(daysUntil("2026-11-01", "Europe/London", now)).toBe(-19);
  });

  it("validates ISO dates strictly", () => {
    expect(isValidISODate("2026-02-29")).toBe(false); // not a leap year
    expect(isValidISODate("2024-02-29")).toBe(true);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("nope")).toBe(false);
  });
});
