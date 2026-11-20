import { LOCALES, localize, type Locale, type Localized } from "./core/types";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

/**
 * Hand-rolled i18n (spec asks for next-intl; see README deviations).
 * Message files are flat-ish JSON; keys are dotted paths. Arabic is RTL and
 * formats numbers with Western digits (`numberingSystem: "latn"`, spec 11.5).
 */

export { LOCALES };
export type { Locale, Localized };

type Messages = Record<string, unknown>;

const FILES: Record<Locale, Messages> = { en, fr, ar } as unknown as Record<Locale, Messages>;

export function getMessages(locale: Locale): Messages {
  return FILES[locale] ?? FILES.en;
}

function lookup(msgs: Messages, key: string): unknown {
  // Message files use flat dotted keys ("common.days"); fall back to nested
  // traversal so a future nested file also works.
  if (Object.prototype.hasOwnProperty.call(msgs, key)) return msgs[key];
  let cur: unknown = msgs;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Messages)) cur = (cur as Messages)[part];
    else return undefined;
  }
  return cur;
}

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(getMessages(locale), key);
  const base = typeof raw === "string" ? raw : key;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
  );
}

/** Resolve a localized DB column with fallback locale -> fr -> en (spec 8.1). */
export function pickLocalized(loc: Localized | null | undefined, locale: Locale): string {
  return localize(loc, locale);
}

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}

/** Accept-Language header -> one of our locales; default fr (spec F0). */
export function resolveLocale(header: string | null | undefined): Locale {
  if (!header) return "fr";
  for (const part of header.split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    const hit = LOCALES.find((l) => l === code);
    if (hit) return hit;
  }
  return "fr";
}

const DATE_OPTS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

/** Dates always in Latin digits, calendar gregory (spec 11.5). */
export function formatDate(locale: Locale, iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : locale, {
    ...DATE_OPTS,
    timeZone: "UTC",
  }).format(d);
}

export function formatNumber(locale: Locale, n: number, maxFrac = 1): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : locale, {
    maximumFractionDigits: maxFrac,
  }).format(n);
}

/** "7 days" / "7 jours" / "7 يوم", localized. */
export function formatDays(locale: Locale, n: number): string {
  return t(locale, "common.days", { n });
}

/** Locale-aware list join (Arabic uses "،"). */
export function joinList(locale: Locale, items: string[]): string {
  const sep = locale === "en" ? ", " : locale === "fr" ? ", " : "، ";
  return items.filter(Boolean).join(sep);
}
