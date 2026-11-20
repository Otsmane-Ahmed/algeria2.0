/** Cookie names shared by middleware (edge) and server code.
 *  Kept in its own module so `middleware.ts` never imports `src/lib/auth.ts`,
 *  which pulls in `pg` and cannot run on the edge runtime. */
export const SESSION_COOKIE = "safar_session";
export const LOCALE_COOKIE = "safar_locale";
/**
 * Middleware pins the resolved locale here on the *request*, because a cookie it
 * sets on the response is not visible to the render that is already running.
 */
export const LOCALE_HEADER = "x-safar-locale";
