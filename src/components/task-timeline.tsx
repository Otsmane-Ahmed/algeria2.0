"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, CircleDot, LoaderCircle, Lock, TriangleAlert } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Badge, Button, cx } from "@/components/ui";
import { EmptyState } from "@/components/domain";

export type Task = {
  id: string;
  kind: string;
  title: string;
  detail: Record<string, string> | null;
  due_date: string;
  start_date: string | null;
  est_days: number | null;
  status: string;
  is_critical: boolean;
  required_document_code: string | null;
  procedure_code: string | null;
};

const STATUSES = ["todo", "doing", "done", "blocked"] as const;

const STATUS_META = {
  todo: { icon: CircleDot, tone: "neutral" },
  doing: { icon: CalendarClock, tone: "brand" },
  done: { icon: Check, tone: "success" },
  blocked: { icon: Lock, tone: "danger" },
} as const;

/**
 * Dated task list (spec F5/F8.4). Status changes PATCH /api/tasks/:id; a
 * blocked task is always reachable, so the plan can never trap the student.
 */
export function TaskTimeline({ tasks, feasibility }: { tasks: Task[]; feasibility: string | null }) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    const prev = items;
    setItems((list) => list.map((x) => (x.id === id ? { ...x, status } : x)));
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
      if (!res.ok) throw new Error(body.detail || "error");
      router.refresh();
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <EmptyState title={t("app.noTasks")} />;
  }

  const sorted = [...items].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      {feasibility && feasibility !== "ok" && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--warning)] bg-[var(--warning)]/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
          <span>{t(`app.feasibility.${feasibilityKey(feasibility)}`)}</span>
        </div>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {sorted.map((task) => {
          const meta = STATUS_META[task.status as keyof typeof STATUS_META] ?? STATUS_META.todo;
          const Icon = meta.icon;
          const overdue = task.status !== "done" && task.due_date < today;
          const estimate = task.detail?.estimate === "true";
          return (
            <li
              key={task.id}
              className={cx(
                "flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3",
                overdue && "border-[var(--warning)]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cx(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full",
                      task.status === "done" && "bg-[var(--success)] text-white",
                      task.status === "doing" && "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
                      task.status === "blocked" && "bg-[var(--danger)] text-white",
                      task.status === "todo" && "bg-[var(--surface-sunken)] text-[var(--text-faint)]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className={cx("font-medium", task.status === "done" && "text-[var(--text-faint)] line-through")}>
                    {task.title}
                  </span>
                  {task.is_critical && (
                    <Badge tone="warning">{t("app.critical")}</Badge>
                  )}
                  {estimate && <Badge tone="neutral">{t("app.estimateLabel")}</Badge>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                  <bdi className={cx(overdue && "text-[var(--warning)]")}>{formatDate(task.due_date)}</bdi>
                  {task.est_days != null && <span>· {t("app.leadTime", { n: task.est_days })}</span>}
                </p>
              </div>

              <div className="flex items-center gap-1" role="group" aria-label={t("common.status")}>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busyId === task.id}
                    aria-pressed={task.status === s}
                    onClick={() => setStatus(task.id, s)}
                    className={cx(
                      "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs",
                      task.status === s
                        ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-strong)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)]",
                    )}
                  >
                    {t(`app.task.${s}`)}
                  </button>
                ))}
                {busyId === task.id && (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[var(--text-faint)]" aria-hidden="true" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          {t("common.reset")}
        </Button>
      </div>
    </div>
  );
}

/** DB stores "ok"; the message files call it "feasible". */
function feasibilityKey(v: string | null | undefined): string {
  if (v === "ok") return "feasible";
  if (v === "tight" || v === "impossible") return v;
  return "unknown";
}
