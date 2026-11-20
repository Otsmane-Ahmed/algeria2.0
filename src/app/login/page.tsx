"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, GraduationCap, LoaderCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button, Input, LinkButton } from "@/components/ui";

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<"idle" | "working" | "failed">("idle");

  const next = params.get("next") || "/dashboard";
  const demo = params.get("demo") === "1";

  // A token in the URL means "verify this magic link now".
  useEffect(() => {
    const t0 = params.get("token");
    if (!t0) return;
    setToken(t0);
    setVerifyState("working");
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: t0 }),
    })
      .then(async (res) => {
        if (res.ok) {
          router.replace(next);
          router.refresh();
        } else {
          setVerifyState("failed");
        }
      })
      .catch(() => setVerifyState("failed"));
  }, [params, next, router]);

  // ?demo=1: sign straight into the prepared demo account.
  useEffect(() => {
    if (!demo) return;
    let cancelled = false;
    (async () => {
      setSending(true);
      try {
        const req = await fetch("/api/auth/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "demo@safar.dz" }),
        });
        const data = (await req.json()) as { token?: string };
        if (!data.token) throw new Error("no token");
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: data.token }),
        });
        if (res.ok && !cancelled) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
      } catch {
        /* fall through to the manual form */
      }
      if (!cancelled) setSending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { dev_link?: string; code?: string; detail?: string };
      if (!res.ok) {
        setError(data.detail || t(`errors.${data.code ?? "generic"}`));
        return;
      }
      setSent(true);
      setDevLink(data.dev_link ?? null);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface)]">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <GraduationCap className="h-9 w-9 text-[var(--brand)]" aria-hidden="true" />
          <span className="font-serif text-2xl font-medium tracking-normal text-[var(--brand-strong)]">Nava</span>
        </Link>
        <div className="ms-auto">
          <LocaleSwitcher compact />
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-6">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="max-w-md font-serif text-4xl font-medium leading-[1.16] tracking-normal text-[var(--text)] sm:text-5xl">
              {t("auth.heroTitle")}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--text-muted)]">
              {t("auth.heroBody")}
            </p>
          </div>

          <div className="w-full rounded-[var(--radius-lg)] bg-[var(--surface-raised)] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-medium tracking-normal">{t("auth.title")}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t("auth.subtitle")}</p>
              </div>
            </div>

            {verifyState === "working" && (
              <p className="mt-6 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("common.loading")}
              </p>
            )}

            {verifyState === "failed" && (
              <p
                className="mt-6 rounded-[var(--radius)] border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
                role="alert"
              >
                {t("auth.invalidToken")}
              </p>
            )}

            {!token && !sending && (
              <>
                {!sent ? (
                  <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
                        {t("auth.email")}
                      </label>
                      <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        dir="ltr"
                        placeholder={t("auth.emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-[var(--danger)]" role="alert">
                        {error}
                      </p>
                    )}
                    <Button type="submit" disabled={sending} className="w-full">
                      {sending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {sending ? t("auth.sending") : t("auth.sendLink")}
                    </Button>
                    <p className="text-xs leading-relaxed text-[var(--text-faint)]">
                      {t("auth.terms")}
                    </p>
                  </form>
                ) : (
                  <div className="mt-6 flex flex-col gap-4" aria-live="polite">
                    <div className="rounded-[var(--radius)] border border-[var(--brand)] bg-white p-4">
                      <p className="font-semibold text-[var(--brand-strong)]">{t("auth.linkSent")}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {t("auth.linkSentBody", { email })}
                      </p>
                      {devLink && (
                        <a
                          href={devLink}
                          dir="ltr"
                          className="mt-3 block break-all rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-2 text-xs text-[var(--brand-strong)] underline"
                        >
                          {devLink}
                        </a>
                      )}
                    </div>
                    <Button variant="secondary" onClick={() => setSent(false)}>
                      {t("common.back")}
                    </Button>
                  </div>
                )}

                <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-faint)]">
                  <span className="h-px flex-1 bg-[var(--border-strong)]" />
                  {t("common.or")}
                  <span className="h-px flex-1 bg-[var(--border-strong)]" />
                </div>

                <LinkButton href="/login?demo=1" variant="secondary" className="w-full">
                  {t("auth.demoCta")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </LinkButton>
                <p className="mt-3 text-xs leading-relaxed text-[var(--text-faint)]">
                  {t("auth.demoBody")}
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
