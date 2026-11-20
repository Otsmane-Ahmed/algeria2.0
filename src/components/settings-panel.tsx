"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileX, LoaderCircle, LogOut } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Input } from "@/components/ui";

const LOCALES = ["fr", "en", "ar"] as const;

/** Language, account data export and account deletion (spec §7 / F0). */
export function SettingsPanel({ email }: { email: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function setLocale(code: string) {
    document.cookie = `safar_locale=${code}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  async function exportData() {
    setBusy("export");
    setMessage(null);
    try {
      const res = await fetch("/api/me/export");
      if (!res.ok) throw new Error("error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `safar-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: "ok", text: t("common.done") });
    } catch {
      setMessage({ kind: "err", text: t("states.error") });
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    if (!window.confirm(t("settings.deleteAccount"))) return;
    setBusy("delete");
    setMessage(null);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm_email: confirmEmail }),
      });
      const body = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      router.push("/");
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : String(e) });
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-base font-semibold">{t("settings.language")}</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("settings.language")}>
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={locale === code}
              onClick={() => setLocale(code)}
              className={
                locale === code
                  ? "rounded-[var(--radius)] border border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-2 text-sm text-[var(--brand-strong)]"
                  : "rounded-[var(--radius)] border border-[var(--border-strong)] px-4 py-2 text-sm hover:bg-[var(--surface-raised)]"
              }
            >
              {code === "fr" ? "Français" : code === "en" ? "English" : "العربية"}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-base font-semibold">{t("settings.account")}</h2>
        <Field label={t("settings.email")} htmlFor="account-email">
          <Input id="account-email" value={email} readOnly />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportData} disabled={busy !== null}>
            {busy === "export" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {t("settings.exportData")}
          </Button>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("settings.signOut")}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 border-[var(--danger)] p-5">
        <h2 className="text-base font-semibold text-[var(--danger)]">{t("settings.deleteAccount")}</h2>
        <Field label={t("settings.email")} htmlFor="confirm-email" hint={t("settings.deleteAccount")}>
          <Input
            id="confirm-email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={email}
          />
        </Field>
        <div>
          <Button
            variant="danger"
            onClick={deleteAccount}
            disabled={busy !== null || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
          >
            {busy === "delete" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileX className="h-4 w-4" aria-hidden="true" />
            )}
            {t("common.delete")}
          </Button>
        </div>
      </Card>

      {message && (
        <p
          role="status"
          className={
            message.kind === "ok"
              ? "rounded-[var(--radius)] border border-[var(--success)] bg-[var(--success)]/10 px-4 py-2.5 text-sm"
              : "rounded-[var(--radius)] border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2.5 text-sm"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
