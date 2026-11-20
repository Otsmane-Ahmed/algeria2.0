/**
 * iCalendar (RFC 5545) writer for the plan export (spec F8).
 * One VEVENT per task, stable UIDs so re-imports update instead of duplicate.
 */

export type IcsEvent = {
  uid: string;
  summary: string;
  description?: string | null;
  /** ISO date (YYYY-MM-DD) or full ISO datetime with offset */
  start: string;
  allDay?: boolean;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
};

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 73) {
    parts.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

function stamp(d: Date): string {
  return (
    d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0") +
    "T" +
    String(d.getUTCHours()).padStart(2, "0") +
    String(d.getUTCMinutes()).padStart(2, "0") +
    String(d.getUTCSeconds()).padStart(2, "0") +
    "Z"
  );
}

export function buildIcs(prodId: string, events: IcsEvent[]): string {
  const now = stamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${prodId}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:SAFAR",
  ];

  for (const e of events) {
    const allDay = e.allDay ?? /^\d{4}-\d{2}-\d{2}$/.test(e.start);
    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${e.uid}`));
    lines.push(`DTSTAMP:${now}`);
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${e.start.replace(/-/g, "")}`);
      // all-day events are exclusive of the end date; +1 day
      const d = new Date(`${e.start}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      lines.push(
        `DTEND;VALUE=DATE:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`,
      );
    } else {
      const d = new Date(e.start);
      lines.push(`DTSTART:${stamp(d)}`);
      lines.push(`DTEND:${stamp(new Date(d.getTime() + 3600_000))}`);
    }
    lines.push(fold(`SUMMARY:${esc(e.summary)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${esc(e.description)}`));
    lines.push(`STATUS:${e.status ?? "CONFIRMED"}`);
    // Reminders at 7, 3 and 1 day(s) out (spec F8).
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P7D", `DESCRIPTION:${esc(e.summary)}`, "END:VALARM");
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P3D", `DESCRIPTION:${esc(e.summary)}`, "END:VALARM");
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", `DESCRIPTION:${esc(e.summary)}`, "END:VALARM");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
