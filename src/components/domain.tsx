"use client";

import type { ReactNode } from "react";
import {
  TriangleAlert,
  BadgeCheck,
  Check,
  CircleHelp,
  Clock,
  Info,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button, Card, Skeleton, cx } from "./ui";
import { useI18n } from "./i18n-provider";
import type { Verdict } from "@/lib/core/types";

/** Spec 11.3 reusable components. No meaning by color alone: every color
 *  carries an icon and text next to it. */

// --- UnverifiedBadge ---------------------------------------------------------

export function UnverifiedBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Badge tone="warning" className="align-middle">
      <TriangleAlert className="h-3 w-3" aria-hidden="true" />
      {compact ? t("states.unverified") : `${t("states.unverified")} — ${t("states.unverifiedHint")}`}
    </Badge>
  );
}

// --- VerdictPill -------------------------------------------------------------

const VERDICT_STYLE: Record<
  Verdict,
  { tone: "success" | "brand" | "warning" | "neutral" | "danger"; icon: typeof Check }
> = {
  eligible: { tone: "success", icon: Check },
  likely: { tone: "brand", icon: BadgeCheck },
  stretch: { tone: "warning", icon: CircleHelp },
  unknown: { tone: "neutral", icon: CircleHelp },
  ineligible: { tone: "danger", icon: X },
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const { t } = useI18n();
  const style = VERDICT_STYLE[verdict];
  const Icon = style.icon;
  return (
    <Badge tone={style.tone}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`matches.verdict.${verdict}`)}
    </Badge>
  );
}

// --- ScoreRing ---------------------------------------------------------------

export function ScoreRing({
  score,
  size = 56,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const { formatNumber } = useI18n();
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color =
    pct >= 75 ? "var(--success)" : pct >= 60 ? "var(--brand)" : pct >= 40 ? "var(--warning)" : "var(--text-faint)";
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Score"} ${pct}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums" style={{ color }}>
        <bdi>{formatNumber(pct, 0)}</bdi>
      </span>
    </div>
  );
}

// --- DeadlineBadge ------------------------------------------------------------

export function DeadlineBadge({
  daysToDeadline,
  dateLabel,
}: {
  daysToDeadline: number | null;
  dateLabel?: string;
}) {
  const { t, locale } = useI18n();
  if (daysToDeadline === null) {
    return (
      <Badge tone="neutral">
        <CircleHelp className="h-3 w-3" aria-hidden="true" />
        {t("matches.noDeadline")}
      </Badge>
    );
  }
  const past = daysToDeadline < 0;
  return (
    <Badge tone={past ? "danger" : daysToDeadline <= 30 ? "warning" : "neutral"}>
      <Clock className="h-3 w-3" aria-hidden="true" />
      {past ? (
        <span>{t("matches.daysToDeadline", { n: daysToDeadline })}</span>
      ) : (
        <span title={dateLabel}>
          {t("matches.daysToDeadline", { n: daysToDeadline })}
        </span>
      )}
      <span className="sr-only">{locale}</span>
    </Badge>
  );
}

// --- FactorTable ---------------------------------------------------------------

type FactorRow = {
  key: string;
  label: { en?: string; fr?: string; ar?: string };
  weight: number;
  status: "pass" | "fail" | "unknown" | "partial";
  value: string | null;
  detail?: string | null;
};

const FACTOR_ICON = {
  pass: { icon: Check, tone: "text-[var(--success)]" },
  partial: { icon: CircleHelp, tone: "text-[var(--warning)]" },
  unknown: { icon: CircleHelp, tone: "text-[var(--text-faint)]" },
  fail: { icon: X, tone: "text-[var(--danger)]" },
} as const;

export function FactorTable({ factors }: { factors: FactorRow[] }) {
  const { t, locale } = useI18n();
  const label = (f: FactorRow) => f.label?.[locale] ?? f.label?.fr ?? f.label?.en ?? f.key;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("matches.factors")}</caption>
        <thead>
          <tr className="text-start text-xs uppercase text-[var(--text-faint)]">
            <th scope="col" className="py-1.5 text-start font-medium">
              {t("matches.factors")}
            </th>
            <th scope="col" className="py-1.5 text-start font-medium">
              {t("common.status")}
            </th>
            <th scope="col" className="py-1.5 text-start font-medium">
              {t("matches.score")}
            </th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => {
            const meta = FACTOR_ICON[f.status];
            const Icon = meta.icon;
            return (
              <tr key={f.key} className="border-t border-[var(--border)] align-top">
                <td className="py-2 pe-3">
                  <span className="font-medium">{label(f)}</span>
                  {f.detail && (
                    <span className="block text-xs text-[var(--text-faint)]">{f.detail}</span>
                  )}
                </td>
                <td className="py-2 pe-3">
                  <span className={cx("inline-flex items-center gap-1", meta.tone)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {f.value !== null && (
                      <bdi className="text-xs text-[var(--text-muted)]">{f.value}</bdi>
                    )}
                  </span>
                </td>
                <td className="py-2 text-end tabular-nums text-[var(--text-muted)]">
                  <bdi>{Math.round(f.weight * 100) / 100}</bdi>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- EmptyState / ErrorState ---------------------------------------------------

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    // White sub-card: reads as a distinct layer whether it sits on the page
    // (white) or nested inside a pale Card.
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
      <div className="text-[var(--text-faint)]" aria-hidden="true">
        {icon ?? <CircleHelp className="h-8 w-8" />}
      </div>
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-md text-sm text-[var(--text-muted)]">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  requestId,
  onRetry,
}: {
  message?: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center"
      role="alert"
    >
      <TriangleAlert className="h-8 w-8 text-[var(--danger)]" aria-hidden="true" />
      <p className="font-medium">{message || t("states.error")}</p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        )}
      </div>
      {requestId && (
        <p className="text-xs text-[var(--text-faint)]">
          {t("states.requestId")}: <bdi>{requestId}</bdi>
        </p>
      )}
    </div>
  );
}

// --- StatusStepper (documents) ---------------------------------------------------

const DOC_STEPS = ["uploaded", "processing", "extracted", "needs_review", "confirmed"] as const;

export function StatusStepper({ status }: { status: string }) {
  const { t } = useI18n();
  const currentIdx =
    status === "failed"
      ? DOC_STEPS.length
      : Math.max(0, DOC_STEPS.indexOf(status as (typeof DOC_STEPS)[number]));
  return (
    <ol className="flex items-center gap-1" aria-label={t("common.status")}>
      {DOC_STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx && status !== "failed";
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              className={cx(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                done && "border-transparent bg-[var(--success)] text-white",
                active && "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]",
                !done && !active && "border-[var(--border-strong)] text-[var(--text-faint)]",
              )}
              aria-label={t(`docs.status.${step}`)}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
            </span>
            {i < DOC_STEPS.length - 1 && (
              <span
                className={cx(
                  "h-px w-3 sm:w-5",
                  done ? "bg-[var(--success)]" : "bg-[var(--border-strong)]",
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
      {status === "failed" && (
        <li className="ms-1">
          <Badge tone="danger">
            <X className="h-3 w-3" aria-hidden="true" />
            {t("docs.status.failed")}
          </Badge>
        </li>
      )}
    </ol>
  );
}

// --- CompletenessBar ------------------------------------------------------------

export function CompletenessBar({ value, label }: { value: number; label?: string }) {
  const { t } = useI18n();
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--brand)" : "var(--accent)";
  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-[var(--text-muted)]">{label ?? t("profile.completeness")}</span>
        <bdi className="font-semibold" style={{ color }}>
          {t("dash.completenessFmt", { n: pct })}
        </bdi>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? t("profile.completeness")}
      >
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// --- ConfidenceDot ----------------------------------------------------------------

const CONF_TONE = {
  high: { cls: "bg-[var(--success)]", icon: Check },
  medium: { cls: "bg-[var(--warning)]", icon: CircleHelp },
  low: { cls: "bg-[var(--danger)]", icon: X },
} as const;

export function ConfidenceDot({ value }: { value: number }) {
  const { t, formatNumber } = useI18n();
  const level = value >= 0.85 ? "high" : value >= 0.6 ? "medium" : "low";
  const meta = CONF_TONE[level];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"
      title={`${t("docs.confidence")} ${formatNumber(value * 100, 0)}%`}
    >
      <span className={cx("inline-flex h-4 w-4 items-center justify-center rounded-full text-white", meta.cls)}>
        <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
      <bdi>{formatNumber(value * 100, 0)}%</bdi>
      <span className="sr-only">{t("docs.confidence")}</span>
    </span>
  );
}

// --- AIDisclosure ------------------------------------------------------------------

export function AIDisclosure({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <p className={cx("flex items-start gap-1.5 text-xs text-[var(--text-faint)]", compact && "text-[10px]")}>
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      {t("states.aiDisclosure")}
    </p>
  );
}

/** "AI unavailable" banner (spec: AI features degrade to a clear state). */
export function AIOffBanner({ body }: { body?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-faint)]" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-medium">{t("states.aiOff")}</p>
        <p className="mt-0.5 text-[var(--text-muted)]">{body ?? t("states.aiOffBody")}</p>
      </div>
    </div>
  );
}

// --- Loading skeleton row -----------------------------------------------------------

export function CardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-full" />
    </Card>
  );
}
