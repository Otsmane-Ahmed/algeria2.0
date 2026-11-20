"use client";

import { createContext, useContext, useMemo } from "react";
import { getMessages, t as translate, formatDate, formatNumber, dirFor, type Locale } from "@/lib/i18n";

/**
 * Client-side i18n. The server layout resolves the locale and passes the whole
 * message file for that locale once; client components call `useT()` and get
 * `t(key, vars)` plus the locale-aware formatters. (next-intl not installed;
 * see README deviations.)
 */

export type T = (key: string, vars?: Record<string, string | number>) => string;

export type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: T;
  formatDate: (iso: string | null | undefined) => string;
  formatNumber: (n: number, maxFrac?: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const messages = getMessages(locale);
    const t: T = (key, vars) => {
      const raw = Object.prototype.hasOwnProperty.call(messages, key)
        ? messages[key]
        : key;
      const base = typeof raw === "string" ? raw : key;
      if (!vars) return base;
      return base.replace(/\{(\w+)\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
      );
    };
    return {
      locale,
      dir: dirFor(locale),
      t,
      formatDate: (iso) => formatDate(locale, iso),
      formatNumber: (n, maxFrac) => formatNumber(locale, n, maxFrac),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useT(): T {
  return useI18n().t;
}
