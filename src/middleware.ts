import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, resolveLocale, type Locale } from "./lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER, SESSION_COOKIE } from "./lib/cookies";

/**
 * Locale + auth gate (spec 3.3: `middleware.ts  # locale + auth`).
 *
 * - `/ar|/fr|/en/**` rewrites to the unpinned path and pins the locale cookie,
 *   so the landing page lives at `/{locale}` without a parallel route tree.
 * - The resolved locale is also echoed on the *request* headers: a cookie set
 *   on the response is invisible to the render already in flight.
 * - App routes require a session cookie here; the real signature + user check
 *   happens server-side in `src/app/(app)/layout.tsx`.
 */

const PROTECTED = [
  "/dashboard",
  "/onboarding",
  "/documents",
  "/profile",
  "/matches",
  "/scholarships",
  "/applications",
  "/procedures",
  "/writing",
  "/settings",
  "/print",
];

const isProtected = (path: string) =>
  PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

function nextWithLocale(req: NextRequest, locale: Locale) {
  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, locale);
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 365 * 86_400,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}

function rewriteWithLocale(req: NextRequest, locale: Locale, pathname: string) {
  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, locale);
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  const res = NextResponse.rewrite(url, { request: { headers } });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 365 * 86_400,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Locale-pinned URL: /fr/matches -> /matches, cookie pinned.
  const pinned = /^\/(ar|fr|en)(\/.*)?$/.exec(pathname);
  if (pinned) {
    const locale = pinned[1] as Locale;
    const rest = pinned[2] && pinned[2] !== "/" ? pinned[2] : "/";
    return rewriteWithLocale(req, locale, rest);
  }

  // 2. Auth gate for app routes (cookie presence only; verified in the layout).
  if (isProtected(pathname) && !req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // 3. First visit (or an unreadable value): detect from Accept-Language and pin.
  const current = req.cookies.get(LOCALE_COOKIE)?.value;
  if (current && (LOCALES as readonly string[]).includes(current)) {
    return nextWithLocale(req, current as Locale);
  }
  return nextWithLocale(req, resolveLocale(req.headers.get("accept-language")));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
