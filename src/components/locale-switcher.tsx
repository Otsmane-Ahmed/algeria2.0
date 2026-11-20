"use client";

import { usePathname, useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/cookies";
import { useI18n } from "./i18n-provider";
import { cx } from "./ui";

const LABELS: Record<Locale, string> = { ar: "العربية", fr: "Français", en: "English" };

/**
 * Locale switcher (spec 11.3). Sets the cookie and navigates to the
 * locale-pinned URL, so the page renders in the new language immediately.
 */
export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, dir } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${365 * 86400}; samesite=lax`;
    // Strip a previous /{locale} prefix, then navigate to the pinned URL.
    const stripped = pathname.replace(/^\/(ar|fr|en)(?=\/|$)/, "") || "/";
    router.push(`/${next}${stripped === "/" ? "" : stripped}`);
    router.refresh();
  }

  return (
    <div
      className={cx(
        "inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-0.5",
        compact && "text-xs",
      )}
      role="group"
      aria-label="Language"
    >
      <Languages className="mx-1.5 h-3.5 w-3.5 text-[var(--text-faint)]" aria-hidden="true" />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          lang={l}
          dir={l === "ar" ? "rtl" : "ltr"}
          aria-pressed={l === locale}
          className={cx(
            "rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium",
            l === locale
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)]",
          )}
        >
          {LABELS[l]}
        </button>
      ))}
      <span className="sr-only">{dir}</span>
    </div>
  );
}
