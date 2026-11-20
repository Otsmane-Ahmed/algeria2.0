import { ReticleDev } from './reticle-dev';
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/i18n-provider";
import { SkipLink } from "@/components/skip-link";
import { LOCALES, dirFor, resolveLocale, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/cookies";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nava — From your transcript to a plan to study abroad",
    template: "%s · Nava",
  },
  description:
    "Nava reads your Algerian transcript, matches you against curated scholarships, and turns the result into a dated plan with a document checklist.",
  robots: { index: false }, // demo build: app is noindex, landing is reachable
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f8f7",
};

/**
 * Resolve the locale the same way middleware does: request header first (set
 * by middleware on every pass, including first visits), then the cookie, then
 * Accept-Language, defaulting to fr (spec F0).
 */
async function currentLocale(): Promise<Locale> {
  const h = await headers();
  const fromHeader = h.get(LOCALE_HEADER);
  if (fromHeader && (LOCALES as readonly string[]).includes(fromHeader)) {
    return fromHeader as Locale;
  }
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (fromCookie && (LOCALES as readonly string[]).includes(fromCookie)) {
    return fromCookie as Locale;
  }
  return resolveLocale(h.get("accept-language"));
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <body>{process.env.NODE_ENV === 'development' ? <ReticleDev /> : null}
        <I18nProvider locale={locale}>
          <SkipLink />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
