import Link from "next/link";
import { ArrowRight, Check, GraduationCap, ShieldCheck, Sparkles, Target, Upload } from "lucide-react";
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
 * Landing page (spec 11.3): hero, how it works, trust, FAQ, CTA.
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
  // Stat strip: the numbers are the seeded catalog size — curated data, not a claim.
  const stats = [
    { n: "17", k: "landing.stat1" },
    { n: "12", k: "landing.stat2" },
    { n: "3", k: "landing.stat3" },
    { n: "0", k: "landing.stat4" },
  ];

  return (
    <I18nProvider locale={locale}>
      <div className="min-h-dvh bg-[var(--surface-sunken)]">
        {/* header */}
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex h-20 max-w-6xl items-center gap-6 px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <GraduationCap className="h-9 w-9 text-[var(--brand)]" aria-hidden="true" />
              <span className="font-serif text-2xl font-medium tracking-normal text-[var(--brand-strong)]">
                Nava
              </span>
            </Link>
            <div className="ms-auto flex items-center gap-5">
              <LocaleSwitcher compact />
              <Link
                href="/login"
                className="hidden text-[15px] font-medium text-[var(--text)] hover:text-[var(--brand-strong)] sm:inline"
              >
                {t("nav.signIn")}
              </Link>
              <LinkButton href="/login" size="sm" className="px-5">
                {t("landing.ctaPrimary")}
              </LinkButton>
            </div>
          </div>
        </header>

        <main id="main">
          {/* honesty pill banner — the product's own principle, in mono */}
          <div className="mx-auto max-w-6xl px-5 pt-8">
            <div className="flex justify-center">
              <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-2.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
                <span className="eyebrow text-[var(--brand-strong)]">{t("landing.bannerLead")}</span>
                <span className="text-sm text-[var(--text-muted)]">{t("landing.bannerBody")}</span>
                <Link
                  href="#how"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-strong)] hover:underline"
                >
                  {t("landing.bannerCta")}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          {/* hero */}
          <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
              <div>
                <p className="eyebrow flex items-center gap-2 text-[var(--brand-strong)]">
                  <span className="eyebrow-dot" aria-hidden="true" />
                  {t("landing.eyebrow")}
                </p>
                <h1 className="mt-5 max-w-xl font-serif text-4xl font-medium leading-[1.16] tracking-normal text-[var(--text)] sm:text-5xl lg:text-6xl">
                  {t("landing.heroTitle")}
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--text-muted)]">
                  {t("landing.heroBody")}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <LinkButton href="/login" size="lg" variant="primary" className="px-7">
                    {t("landing.ctaPrimary")}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </LinkButton>
                  {/* navy secondary: the reference's dual-CTA system */}
                  <LinkButton href="/login?demo=1" size="lg" variant="navy">
                    {t("landing.ctaSecondary")}
                  </LinkButton>
                </div>
                <p className="mt-4 text-sm text-[var(--text-faint)]">{t("auth.subtitle")}</p>
              </div>

              {/* catalog panel: white card with hairline on the mint canvas */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
                <p className="eyebrow flex items-center gap-2 text-[var(--text-muted)]">
                  <span className="eyebrow-dot" aria-hidden="true" />
                  {t("landing.catalogTitle")}
                </p>
                {catalog.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {catalog.map((c) => (
                      <li key={c.slug}>
                        <Badge
                          tone="neutral"
                          className="px-3 py-1 text-[13px] text-[var(--text)]"
                        >
                          {c.name}
                          {c.provider ? (
                            <span className="text-[var(--text-faint)]"> · {c.provider}</span>
                          ) : null}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-[var(--text-muted)]">{t("common.loading")}</p>
                )}
                <div className="mt-5 rounded-[var(--radius)] bg-[var(--surface-raised)] p-4">
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
                    {t("states.unverifiedHint")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* stat strip: mono uppercase with hairline borders, pipe separators */}
          <section className="border-y border-[var(--border-strong)] bg-[var(--surface)]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-6">
              {stats.map((s, i) => (
                <span key={s.k} className="flex items-center gap-6">
                  {i > 0 && <span className="hidden h-4 w-px bg-[var(--sea)] sm:block" aria-hidden="true" />}
                  <span className="eyebrow flex items-baseline gap-2 text-[var(--text)]">
                    <bdi className="font-semibold">{s.n}</bdi>
                    <span className="font-medium text-[var(--text-muted)]">{t(s.k)}</span>
                  </span>
                </span>
              ))}
            </div>
          </section>

          {/* how it works — mint feature cards on the canvas */}
          <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20">
            <p className="eyebrow flex items-center gap-2 text-[var(--brand-strong)]">
              <span className="eyebrow-dot" aria-hidden="true" />
              {t("landing.howEyebrow")}
            </p>
            <h2 className="mt-4 font-serif text-3xl font-medium tracking-normal text-[var(--text)] sm:text-4xl">
              {t("landing.howTitle")}
            </h2>
            <ol className="mt-8 grid gap-5 sm:grid-cols-3">
              {steps.map((n) => {
                const Icon = n === 1 ? Upload : n === 2 ? Target : Sparkles;
                return (
                  <li
                    key={n}
                    className="rounded-[var(--radius-lg)] bg-[var(--surface-raised)] p-6"
                  >
                    <div className="flex items-center gap-3">
                      <span className="eyebrow flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--brand-strong)]">
                        {String(n).padStart(2, "0")}
                      </span>
                      <h3 className="font-serif text-xl font-medium tracking-normal text-[var(--text)]">
                        {t(`landing.step${n}Title`)}
                      </h3>
                      <Icon className="ms-auto h-5 w-5 text-[var(--brand)]" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
                      {t(`landing.step${n}Body`)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* trust band — blush sand, warm counter-rhythm */}
          <section className="mx-auto max-w-6xl px-5 py-8">
            <div className="rounded-[var(--radius-lg)] bg-[var(--blush)] p-8 text-[var(--text)] sm:p-10">
              <p className="eyebrow flex items-center gap-2 text-[var(--brand-strong)]">
                <span className="eyebrow-dot" aria-hidden="true" />
                {t("landing.trustEyebrow")}
              </p>
              <h2 className="mt-4 font-serif text-3xl font-medium tracking-normal sm:text-4xl">
                {t("landing.trustTitle")}
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {trust.map((k) => (
                  <li key={k} className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* FAQ */}
          <section className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-serif text-3xl font-medium tracking-normal text-[var(--text)] sm:text-4xl">
              {t("landing.faqTitle")}
            </h2>
            <div className="mt-6 border-t border-[var(--border)]">
              {faqs.map((f) => (
                <details key={f.q} className="group border-b border-[var(--border)] py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium text-[var(--text)]">
                    {t(f.q)}
                    <span
                      aria-hidden="true"
                      className="text-[var(--sage)] transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-muted)]">
                    {t(f.a)}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="mx-auto max-w-6xl px-5 pb-16 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] p-8 sm:p-10">
              <p className="max-w-xl font-serif text-3xl font-medium leading-[1.2] tracking-normal sm:text-4xl">
                {t("landing.heroTitle")}
              </p>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="/login" size="lg" className="px-7">
                  {t("landing.ctaPrimary")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </LinkButton>
                <LinkButton href="/login?demo=1" size="lg" variant="outline">
                  {t("landing.ctaSecondary")}
                </LinkButton>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-[var(--border)] px-5 py-8">
          <div className="mx-auto max-w-6xl text-xs leading-relaxed text-[var(--text-faint)]">
            <p className="eyebrow text-[10px]">© 2026 Nava</p>
            <p className="mt-2 max-w-3xl">{t("common.dataDisclaimer")}</p>
            <p className="mt-2">{t("landing.trust3")}</p>
          </div>
        </footer>
      </div>
    </I18nProvider>
  );
}
