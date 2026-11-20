"use client";

import { useT } from "./i18n-provider";

/** Spec 11.6: skip link, first focusable element on every page. */
export function SkipLink() {
  const t = useT();
  return (
    <a href="#main" className="skip-link">
      {t("nav.skipToContent")}
    </a>
  );
}
