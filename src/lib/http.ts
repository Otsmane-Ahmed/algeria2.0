import { NextResponse } from "next/server";
import type { z } from "zod";
import { t, type Locale, resolveLocale, LOCALES } from "./i18n";

/** API error codes and response shape (arch.md §8.2). */

const TITLES: Record<string, string> = {
  unauthenticated: "Unauthenticated",
  forbidden_role: "Forbidden",
  validation_failed: "Validation failed",
  unsupported_media: "Unsupported media type",
  file_too_large: "File too large",
  pdf_encrypted: "PDF encrypted",
  profile_not_confirmed: "Profile not confirmed",
  quota_exceeded: "Quota exceeded",
  rate_limited: "Rate limited",
  ai_unavailable: "AI unavailable",
  ai_output_invalid: "AI output invalid",
  not_found: "Not found",
  conflict: "Conflict",
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly errors?: { path: string; message: string }[];

  constructor(code: string, status: number, detail?: string, errors?: { path: string; message: string }[]) {
    super(detail ?? code);
    this.code = code;
    this.status = status;
    this.errors = errors;
  }

  static unauthenticated(detail?: string) {
    return new ApiError("unauthenticated", 401, detail);
  }
  static notFound(detail?: string) {
    return new ApiError("not_found", 404, detail);
  }
  static conflict(detail?: string) {
    return new ApiError("conflict", 409, detail);
  }
  static validation(errors: { path: string; message: string }[]) {
    return new ApiError("validation_failed", 422, "Validation failed", errors);
  }
}

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function requestIdFrom(req: Request): string {
  const header = req.headers.get("x-request-id");
  return header && /^[\w.-]{8,64}$/.test(header) ? header : newRequestId();
}

export function errorResponse(req: Request, e: unknown): NextResponse {
  const id = requestIdFrom(req);
  if (e instanceof ApiError) {
    return NextResponse.json(
      {
        type: `https://safar.app/errors/${e.code}`,
        title: TITLES[e.code] ?? e.code,
        status: e.status,
        code: e.code,
        detail: e.message,
        request_id: id,
        ...(e.errors ? { errors: e.errors } : {}),
      },
      { status: e.status, headers: { "x-request-id": id } },
    );
  }
  const detail = e instanceof Error ? e.message : String(e);
  console.error(`[api] unhandled error ${id}:`, e);
  return NextResponse.json(
    {
      type: "https://safar.app/errors/internal",
      title: "Internal error",
      status: 500,
      code: "internal",
      detail: process.env.NODE_ENV === "production" ? "Internal error" : detail,
      request_id: id,
    },
    { status: 500, headers: { "x-request-id": id } },
  );
}

export function ok(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** Zod-parse a JSON body; unknown fields are rejected (spec 8.1). */
export async function readBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.validation([{ path: "", message: "Body must be valid JSON" }]);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw ApiError.validation(
      parsed.error.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message })),
    );
  }
  return parsed.data;
}

/** Best-available locale: cookie -> Accept-Language -> fr (spec 8.1/11.5). */
export function localeOf(req: Request, fallback?: Locale | null): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const m = /(?:^|;\s*)safar_locale=(ar|fr|en)(?:;|$)/.exec(cookie);
  if (m?.[1]) return m[1] as Locale;
  if (fallback && LOCALES.includes(fallback)) return fallback;
  return resolveLocale(req.headers.get("accept-language"));
}
