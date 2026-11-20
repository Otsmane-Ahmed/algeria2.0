/** Date math for planning. All dates are ISO 'YYYY-MM-DD' strings unless noted. */

export const DEFAULT_WEEKEND = [5, 6]; // Algeria: Friday + Saturday (spec F5)

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`invalid date: ${iso}`);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // noon avoids DST edges
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** a - b in calendar days (positive when a is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);
}

export function dayOfWeek(iso: string): number {
  return parse(iso).getUTCDay(); // 0=Sun .. 6=Sat
}

export type WorkingDaysOpts = {
  weekend?: number[];
  holidays?: string[];
};

export function isWorkingDay(iso: string, opts: WorkingDaysOpts = {}): boolean {
  const weekend = opts.weekend ?? DEFAULT_WEEKEND;
  if (weekend.includes(dayOfWeek(iso))) return false;
  if (opts.holidays?.includes(iso)) return false;
  return true;
}

/** Step back `n` working days from `end` (exclusive of end itself). */
export function subtractWorkingDays(
  end: string,
  n: number,
  opts: WorkingDaysOpts = {},
): string {
  let d = end;
  let count = 0;
  let guard = 0;
  while (count < n) {
    d = addDays(d, -1);
    if (isWorkingDay(d, opts)) count++;
    if (++guard > 4000) throw new Error("subtractWorkingDays: runaway");
  }
  return d;
}

/** Step forward `n` working days from `start` (exclusive of start itself). */
export function addWorkingDays(
  start: string,
  n: number,
  opts: WorkingDaysOpts = {},
): string {
  let d = start;
  let count = 0;
  let guard = 0;
  while (count < n) {
    d = addDays(d, 1);
    if (isWorkingDay(d, opts)) count++;
    if (++guard > 4000) throw new Error("addWorkingDays: runaway");
  }
  return d;
}

/** Today's date in a given IANA timezone (default Africa/Algiers). */
export function todayIn(tz: string = "Africa/Algiers", now: Date = new Date()): string {
  // en-CA yields ISO-like YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from today (in `tz`) until `deadlineDate`. Negative = passed. */
export function daysUntil(deadlineDate: string, tz: string | null | undefined, now: Date = new Date()): number {
  return diffDays(deadlineDate, todayIn(tz || "Africa/Algiers", now));
}

/** 'YYYY-MM' from an ISO date. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Is `iso` a valid YYYY-MM-DD date string? */
export function isValidISODate(iso: unknown): iso is string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parse(iso);
  return toISO(d) === iso;
}
