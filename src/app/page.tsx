import Link from "next/link";
import { Check, ChevronRight, ShieldCheck, Sparkles, Target, Upload } from "lucide-react";
import { I18nProvider } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge, LinkButton } from "@/components/ui";
import { getMessages, resolveLocale, dirFor, LOCALES, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/cookies";
import { db } from "@/lib/db";
import { scholarships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { localize } from "@/lib/core/types";
import { headers, cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Landing page (spec 11.3): hero, how it works, catalog ticker, FAQ, trust, CTA.
 * Server-rendered for SEO; the language of the page is resolved from the
 * middleware-pinned locale (header) or the cookie.
 */
async function pageLocale(): Promise<Locale> {
  const h = await headers();
  const fromHeader = h.get("x-safar-locale");
  if (fromHeader && (LOCALES as readonly string[]).includes(fromHeader)) return fromHeader as Locale;
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (fromCookie && (LOCALES as readonly string[]).includes(fromCookie)) return fromCookie as Locale;
  return resolveLocale(h.get("accept-language"));
}

export default async function LandingPage() {
  const locale = await pageLocale();
  const t = (key: string, vars?: Record<string, string | number>) => {
    const raw = (getMessages(locale) as Record<string, unknown>)[key];
    const base = typeof raw === "string" ? raw : key;
    if (!vars) return base;
    return base.replace(/\{(\w+)\}/g, (m, n) =>
      Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m,
    );
  };

  let catalog: { slug: string; name: string; provider: string; country: string }[] = [];
  try {
    const rows = await db
      .select({
        slug: scholarships.slug,
        name: scholarships.name,
        provider: scholarships.provider,
        hostCountries: scholarships.hostCountries,
      })
      .from(scholarships)
      .where(eq(scholarships.status, "published"))
      .limit(24);
    catalog = rows.map((r) => {
      const prov = r.provider as { name?: string };
      return {
        slug: r.slug,
        name: localize(r.name as never, locale),
        provider: prov?.name ?? "",
        country: (r.hostCountries ?? [])[0] ?? "",
      };
    });
  } catch {
    catalog = [];
  }

  const steps = [1, 2, 3] as const;
  const faqs = [
    { q: "landing.faq1q", a: "landing.faq1a" },
    { q: "landing.faq2q", a: "landing.faq2a" },
    { q: "landing.faq3q", a: "landing.faq3a" },
  ];
  const trust = ["landing.trust1", "landing.trust2", "landing.trust3"];

  return (
    <I18nProvider locale={locale}>
      <div className="min-h-dvh bg-[var(--surface)]">
        {/* header */}
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
            <span className="flex items-center gap-2 font-semibold">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand)] text-sm font-bold text-white"
                aria-hidden="true"
              >
                س
              </span>
              Safar
            </span>
            <div className="ms-auto flex items-center gap-3">
              <LocaleSwitcher compact />
              <LinkButton href="/login" size="sm" variant="secondary">
                {t("nav.signIn")}
              </LinkButton>
            </div>
          </div>
        </header>

        <main id="main">
          {/* hero */}
          <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                {t("landing.heroTitle")}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
                {t("landing.heroBody")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/login" size="lg">
                  {t("landing.ctaPrimary")}
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </LinkButton>
                <LinkButton href="/login?demo=1" size="lg" variant="secondary">
                  {t("landing.ctaSecondary")}
                </LinkButton>
              </div>
            </div>
          </section>

          {/* how it works */}
          <section className="border-y border-[var(--border)] bg-[var(--surface-raised)]">
            <div className="mx-auto max-w-5xl px-4 py-14">
              <h2 className="text-xl font-semibold sm:text-2xl">{t("landing.howTitle")}</h2>
              <ol className="mt-8 grid gap-6 sm:grid-cols-3">
                {steps.map((n) => {
                  const Icon = n === 1 ? Upload : n === 2 ? Target : Sparkles;
                  return (
                    <li key={n} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <h3 className="mt-3 font-medium">{t(`landing.step${n}Title`)}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                        {t(`landing.step${n}Body`)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          {/* catalog ticker */}
          <section className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-xl font-semibold sm:text-2xl">{t("landing.catalogTitle")}</h2>
            {catalog.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-2">
                {catalog.map((c) => (
                  <li key={c.slug}>
                    <Badge tone="neutral" className="px-3 py-1 text-sm">
                      {c.name}
                      {c.provider ? <span className="text-[var(--text-faint)]"> · {c.provider}</span> : null}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">{t("common.loading")}</p>
            )}
            <p className="mt-4 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("states.unverifiedHint")}
            </p>
          </section>

          {/* trust */}
          <section className="border-t border-[var(--border)] bg-[var(--surface-raised)]">
            <div className="mx-auto max-w-5xl px-4 py-14">
              <h2 className="text-xl font-semibold sm:text-2xl">{t("landing.trustTitle")}</h2>
              <ul className="mt-6 grid gap-3">
                {trust.map((k) => (
                  <li key={k} className="flex items-start gap-2.5 text-sm text-[var(--text-muted)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
                    {t(k)}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* FAQ */}
          <section className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-xl font-semibold sm:text-2xl">{t("landing.faqTitle")}</h2>
            <div className="mt-6 grid gap-4">
              {faqs.map((f) => (
                <details key={f.q} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <summary className="cursor-pointer font-medium">{t(f.q)}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{t(f.a)}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="border-t border-[var(--border)] bg-[var(--brand)] py-14 text-white">
            <div className="mx-auto max-w-5xl px-4 text-center">
              <p className="text-xl font-semibold sm:text-2xl">{t("landing.heroTitle")}</p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-[var(--radius)] bg-white px-6 text-base font-medium text-[var(--brand-strong)] hover:opacity-90"
                >
                  {t("landing.ctaPrimary")}
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-[var(--text-faint)]">
          <p>{t("common.dataDisclaimer")}</p>
          <p className="mt-3">Safar · {t("landing.trust3")}</p>
        </footer>
      </div>
    </I18nProvider>
  );
}
