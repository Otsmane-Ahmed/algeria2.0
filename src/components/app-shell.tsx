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
    <nav aria-label={t("nav.menu")} className="flex flex-col gap-0.5">
      {NAV.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={isActive(href) ? "page" : undefined}
          className={cx(
            "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium",
            isActive(href)
              ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t(key)}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[var(--surface-sunken)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur no-print">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button
            type="button"
            className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t("nav.menu")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand)] text-xs font-bold text-white"
              aria-hidden="true"
            >
              س
            </span>
            Safar
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
              className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block no-print">{navList}</aside>
        {open && (
          <div className="fixed inset-x-0 top-14 z-30 border-b border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] lg:hidden no-print">
            {navList}
          </div>
        )}
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-5 no-print">
        <p className="mx-auto max-w-6xl text-xs leading-relaxed text-[var(--text-faint)]">
          {t("common.dataDisclaimer")}
        </p>
      </footer>
    </div>
  );
}
