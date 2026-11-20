"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Target,
  User,
  X,
} from "lucide-react";
import { useI18n } from "./i18n-provider";
import { LocaleSwitcher } from "./locale-switcher";
import { cx } from "./ui";

const NAV = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/matches", key: "nav.matches", icon: Target },
  { href: "/applications", key: "nav.applications", icon: GraduationCap },
  { href: "/documents", key: "nav.documents", icon: FileText },
  { href: "/profile", key: "nav.profile", icon: User },
  { href: "/procedures", key: "nav.procedures", icon: BookOpen },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string | null;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const navList = (
    <nav aria-label={t("nav.menu")} className="flex flex-col gap-1">
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center justify-between gap-2 rounded-full px-3.5 py-2.5 text-[14px] transition-colors",
              active
                ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-strong)]"
                : "font-medium text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]",
            )}
          >
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "bg-[var(--sage)]" : "bg-[var(--border-strong)]",
                )}
              />
              {t(key)}
            </span>
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <>
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
        <GraduationCap className="h-8 w-8 shrink-0 text-[var(--brand)]" aria-hidden="true" />
        <span className="font-serif text-2xl font-medium tracking-normal text-[var(--brand-strong)]">Nava</span>
      </Link>
      <p className="eyebrow mt-8 flex items-center gap-2 px-2 text-[var(--text-faint)]">
        <span className="eyebrow-dot" aria-hidden="true" />
        {t("nav.section")}
      </p>
      <div className="mt-3">{navList}</div>
      <div className="mt-auto flex flex-col gap-5 pt-8">
        <div className="rounded-[var(--radius)] bg-[var(--surface-raised)] p-4 text-[var(--text)]">
          <p className="text-sm font-semibold leading-snug">{t("nav.promoTitle")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
            {t("nav.promoBody")}
          </p>
        </div>
        <p className="eyebrow px-2 text-[10px] text-[var(--text-faint)]">© Nava 2026</p>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-[var(--surface)]">
      {/* Fixed paper sidebar (desktop) — flat surface + hairline, no shadow */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[264px] flex-col border-e border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-[var(--text)] lg:flex no-print">
        {sidebarInner}
      </aside>

      <div className="flex min-h-dvh flex-col lg:ps-[264px]">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur no-print">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:px-8">
            <button
              type="button"
              className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={t("nav.menu")}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-serif text-lg font-medium tracking-normal lg:hidden"
            >
              <GraduationCap className="h-6 w-6 text-[var(--brand)]" aria-hidden="true" />
              Nava
            </Link>
            <div className="ms-auto flex items-center gap-2">
              <LocaleSwitcher compact />
              {userName && (
                <span className="hidden max-w-40 truncate text-xs text-[var(--text-faint)] sm:inline">
                  {userName}
                </span>
              )}
              <button
                type="button"
                onClick={signOut}
                className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
                aria-label={t("nav.signOut")}
                title={t("nav.signOut")}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {open && (
          <div className="fixed inset-x-0 top-16 z-30 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] lg:hidden no-print">
            {sidebarInner}
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-5 no-print">
          <p className="mx-auto max-w-6xl text-xs leading-relaxed text-[var(--text-faint)]">
            {t("common.dataDisclaimer")}
          </p>
        </footer>
      </div>
    </div>
  );
}
