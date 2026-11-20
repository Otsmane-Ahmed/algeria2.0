import { addDays, diffDays, subtractWorkingDays, DEFAULT_WEEKEND, type WorkingDaysOpts } from "./dates";
import type { TaskKind } from "./types";

/** Administrative tasks count working days (Fri/Sat weekend); self-paced use calendar days. */
const ADMIN_KINDS: TaskKind[] = ["document", "procedure", "appointment", "exam"];

export type PlanTaskInput = {
  key: string;
  kind: TaskKind;
  estDays: number;
  dependsOn: string[];
  /** default: derived from kind (admin => working days). */
  workingDays?: boolean;
};

export type PlannedTask = PlanTaskInput & {
  dueDate: string;
  startDate: string;
  isCritical: boolean;
};

export type Feasibility = "ok" | "tight" | "impossible";

export type PlanResult = {
  tasks: PlannedTask[];
  feasibility: Feasibility;
  /** earliest start across the plan; negative diff vs today drives feasibility */
  minStart: string;
  targetSubmit: string;
  /** days the plan would need to have started before today (0 when feasible) */
  daysOverdue: number;
};

export type PlanInput = {
  tasks: PlanTaskInput[];
  /** verified deadline (local date in provider tz) or null => today+60 placeholder */
  deadlineDate: string | null;
  today: string;
  bufferDays?: number; // spec F5: submit target = deadline - 3
  /** +20% duration buffer for critical-path planning (spec F5.2) */
  durationBuffer?: number;
  workingDaysOpts?: WorkingDaysOpts;
};

function topoSort(tasks: PlanTaskInput[]): PlanTaskInput[] {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const t of tasks) {
    indeg.set(t.key, 0);
    succ.set(t.key, []);
  }
  for (const t of tasks) {
    for (const d of t.dependsOn) {
      if (!byKey.has(d)) continue; // dangling dep tolerated (data may reference optional tasks)
      indeg.set(t.key, (indeg.get(t.key) ?? 0) + 1);
      succ.get(d)?.push(t.key);
    }
  }
  const queue = tasks.filter((t) => (indeg.get(t.key) ?? 0) === 0).map((t) => t.key);
  const out: PlanTaskInput[] = [];
  while (queue.length) {
    const k = queue.shift()!;
    const t = byKey.get(k);
    if (t) out.push(t);
    for (const s of succ.get(k) ?? []) {
      const n = (indeg.get(s) ?? 0) - 1;
      indeg.set(s, n);
      if (n === 0) queue.push(s);
    }
  }
  if (out.length !== tasks.length) throw new Error("plan has a dependency cycle");
  return out;
}

/**
 * Back-planning (spec appendix D): backward pass in reverse topological order,
 * durations pulled back from successors (or the buffered submission target).
 * Marks the dependency chain of the earliest start as critical.
 */
export function buildPlan(input: PlanInput): PlanResult {
  const { today, bufferDays = 3, durationBuffer = 1.2, workingDaysOpts = {} } = input;
  const opts = workingDaysOpts;
  const deadline = input.deadlineDate ?? addDays(today, 60); // null deadline => +60d estimate (spec F5.5)
  const targetSubmit = addDays(deadline, -bufferDays);

  const sorted = topoSort(input.tasks);
  const byKey = new Map(sorted.map((t) => [t.key, t]));
  const startOf = new Map<string, string>();
  const dueOf = new Map<string, string>();

  const durStart = (due: string, est: number, working: boolean): string => {
    const n = Math.max(1, Math.ceil(est * durationBuffer));
    return working ? subtractWorkingDays(due, n, opts) : addDays(due, -n);
  };

  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i]!;
    const successors = sorted.filter((s) => s.dependsOn.includes(t.key));
    let due: string;
    if (successors.length === 0) {
      due = targetSubmit; // sink tasks land on the buffered submission target
    } else {
      const starts = successors.map((s) => startOf.get(s.key)!);
      due = starts.reduce((a, b) => (diffDays(a, b) <= 0 ? a : b));
    }
    const working = t.workingDays ?? ADMIN_KINDS.includes(t.kind);
    dueOf.set(t.key, due);
    startOf.set(t.key, durStart(due, t.estDays, working));
  }

  // critical chain: walk predecessors from the earliest-start task
  const minStart = sorted
    .map((t) => startOf.get(t.key)!)
    .reduce((a, b) => (diffDays(a, b) <= 0 ? a : b));
  const earliest = sorted.find((t) => startOf.get(t.key) === minStart)!;
  const critical = new Set<string>();
  const walk = (key: string) => {
    if (critical.has(key)) return;
    critical.add(key);
    const t = byKey.get(key);
    if (!t) return;
    for (const d of t.dependsOn) if (byKey.has(d)) walk(d);
  };
  walk(earliest.key);
  // tasks already past due are critical too
  for (const t of sorted) {
    if (diffDays(startOf.get(t.key)!, today) < 0) critical.add(t.key);
  }

  const daysOverdue = diffDays(today, minStart);
  const feasibility: Feasibility =
    daysOverdue <= 0 ? "ok" : daysOverdue <= 7 ? "tight" : "impossible";

  const tasks: PlannedTask[] = sorted.map((t) => ({
    ...t,
    dueDate: dueOf.get(t.key)!,
    startDate: startOf.get(t.key)!,
    isCritical: critical.has(t.key),
  }));

  return { tasks, feasibility, minStart, targetSubmit, daysOverdue: Math.max(0, daysOverdue) };
}

/** Lead time the matcher needs: longest chain duration + buffer (used by scoreMatch). */
export function planLeadTimeDays(tasks: PlanTaskInput[], workingDaysOpts: WorkingDaysOpts = {}): number {
  if (!tasks.length) return 0;
  try {
    const plan = buildPlan({
      tasks,
      deadlineDate: "2099-01-01", // far future: measure pure duration
      today: "2099-01-01",
      bufferDays: 0,
      workingDaysOpts,
    });
    const minStart = plan.minStart;
    return Math.max(0, diffDays("2099-01-01", minStart));
  } catch {
    return tasks.reduce((m, t) => Math.max(m, t.estDays), 0);
  }
}

export { DEFAULT_WEEKEND };
