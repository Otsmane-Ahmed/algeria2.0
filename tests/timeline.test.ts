import { describe, it, expect } from "vitest";
import { buildPlan, planLeadTimeDays, type PlanTaskInput } from "@/lib/core/timeline";

const TODAY = "2026-11-20"; // Friday

/** Simple chain: copy -> translate -> write -> review -> submit. */
function chain(over: Partial<PlanTaskInput>[] = []): PlanTaskInput[] {
  const base: PlanTaskInput[] = [
    { key: "copy", kind: "document", estDays: 3, dependsOn: [] },
    { key: "translate", kind: "procedure", estDays: 7, dependsOn: ["copy"] },
    { key: "write", kind: "write", estDays: 10, dependsOn: [], workingDays: false },
    { key: "review", kind: "review", estDays: 3, dependsOn: ["translate", "write"], workingDays: false },
    { key: "submit", kind: "submit", estDays: 1, dependsOn: ["review"], workingDays: false },
  ];
  over.forEach((o, i) => Object.assign(base[i]!, o));
  return base;
}

describe("back-planning", () => {
  const deadline = "2027-01-31";

  it("1. lands the submit task on deadline minus buffer", () => {
    const plan = buildPlan({ tasks: chain(), deadlineDate: deadline, today: TODAY, bufferDays: 3 });
    const submit = plan.tasks.find((t) => t.key === "submit")!;
    expect(submit.dueDate).toBe("2027-01-28");
    expect(plan.targetSubmit).toBe("2027-01-28");
  });

  it("2. backward pass gives predecessors earlier start dates", () => {
    const plan = buildPlan({ tasks: chain(), deadlineDate: deadline, today: TODAY });
    const get = (k: string) => plan.tasks.find((t) => t.key === k)!;
    expect(get("copy").startDate < get("translate").startDate).toBe(true);
    expect(get("translate").dueDate <= get("review").startDate).toBe(true);
    expect(get("write").startDate < get("review").startDate).toBe(true);
  });

  it("3. respects dependency order for every edge", () => {
    const plan = buildPlan({ tasks: chain(), deadlineDate: deadline, today: TODAY });
    for (const t of plan.tasks) {
      for (const d of t.dependsOn) {
        const dep = plan.tasks.find((x) => x.key === d)!;
        expect(dep.dueDate <= t.startDate).toBe(true);
      }
    }
  });

  it("4. administrative tasks skip the Fri/Sat weekend", () => {
    const plan = buildPlan({
      tasks: [{ key: "proc", kind: "procedure", estDays: 5, dependsOn: [] }],
      deadlineDate: "2026-12-14", // Monday
      today: "2026-12-01",
      bufferDays: 0,
    });
    const t = plan.tasks[0]!;
    // ceil(5*1.2)=6 working days back from Mon 14th: skip Fri+Sat => Sun 6th
    expect(t.startDate).toBe("2026-12-06");
  });

  it("5. self-paced tasks (write) use calendar days", () => {
    const plan = buildPlan({
      tasks: [{ key: "write", kind: "write", estDays: 7, dependsOn: [], workingDays: false }],
      deadlineDate: "2026-12-14",
      today: "2026-12-01",
      bufferDays: 0,
    });
    // ceil(7*1.2)=9 calendar days back from Mon 14th => Sun 5th
    expect(plan.tasks[0]!.startDate).toBe("2026-12-05");
  });

  it("6. applies the 20% duration buffer", () => {
    const plan = buildPlan({
      tasks: [{ key: "w", kind: "write", estDays: 10, dependsOn: [], workingDays: false }],
      deadlineDate: "2026-12-20",
      today: "2026-12-01",
      bufferDays: 0,
    });
    // ceil(10*1.2)=12 days back from Sun 20th => Mon 8th
    expect(plan.tasks[0]!.startDate).toBe("2026-12-08");
  });

  it("7. feasible plan (enough time) reports ok", () => {
    const plan = buildPlan({ tasks: chain(), deadlineDate: "2027-06-30", today: TODAY });
    expect(plan.feasibility).toBe("ok");
    expect(plan.daysOverdue).toBe(0);
  });

  it("8. impossible when start would be > 7 days in the past", () => {
    const plan = buildPlan({ tasks: chain(), deadlineDate: "2026-11-25", today: TODAY });
    expect(plan.feasibility).toBe("impossible");
    expect(plan.daysOverdue).toBeGreaterThan(7);
  });

  it("9. tight when start is 1..7 days in the past", () => {
    // 12 working days (x1.2 => 15) back from Thu 2026-12-10 lands on Thu 2026-11-19
    const plan = buildPlan({
      tasks: [{ key: "visa", kind: "procedure", estDays: 12, dependsOn: [] }],
      deadlineDate: "2026-12-10",
      today: "2026-11-20",
      bufferDays: 0,
    });
    expect(plan.feasibility).toBe("tight");
    expect(plan.daysOverdue).toBeLessThanOrEqual(7);
    expect(plan.daysOverdue).toBeGreaterThan(0);
  });

  it("10. null deadline falls back to today + 60 days", () => {
    const plan = buildPlan({ tasks: chain(), deadlineDate: null, today: TODAY, bufferDays: 0 });
    expect(plan.targetSubmit).toBe("2027-01-19"); // 2026-11-20 + 60
  });

  it("11. holidays extend administrative tasks (earlier start)", () => {
    const withoutH = buildPlan({
      tasks: [{ key: "p", kind: "procedure", estDays: 5, dependsOn: [] }],
      deadlineDate: "2026-12-31",
      today: "2026-12-01",
      bufferDays: 0,
    });
    const withH = buildPlan({
      tasks: [{ key: "p", kind: "procedure", estDays: 5, dependsOn: [] }],
      deadlineDate: "2026-12-31",
      today: "2026-12-01",
      bufferDays: 0,
      workingDaysOpts: { holidays: ["2026-12-28", "2026-12-29"] },
    });
    // holidays inside the working window force an earlier start
    expect(withH.tasks[0]!.startDate < withoutH.tasks[0]!.startDate).toBe(true);
  });

  it("12. marks the earliest chain as critical", () => {
    const plan = buildPlan({ tasks: chain(), deadlineDate: deadline, today: TODAY });
    const critical = plan.tasks.filter((t) => t.isCritical).map((t) => t.key);
    expect(critical.length).toBeGreaterThan(0);
    expect(critical).toContain("copy"); // longest chain is copy->translate->review->submit
  });

  it("13. throws on dependency cycles instead of hanging", () => {
    expect(() =>
      buildPlan({
        tasks: [
          { key: "a", kind: "write", estDays: 1, dependsOn: ["b"], workingDays: false },
          { key: "b", kind: "write", estDays: 1, dependsOn: ["a"], workingDays: false },
        ],
        deadlineDate: deadline,
        today: TODAY,
      }),
    ).toThrow(/cycle/);
  });

  it("14. tolerates dangling dependencies (optional tasks not present)", () => {
    const plan = buildPlan({
      tasks: [
        { key: "a", kind: "write", estDays: 2, dependsOn: ["ghost"], workingDays: false },
        { key: "submit", kind: "submit", estDays: 1, dependsOn: ["a"], workingDays: false },
      ],
      deadlineDate: deadline,
      today: TODAY,
    });
    expect(plan.tasks).toHaveLength(2);
  });

  it("15. parallel branches both finish before the shared successor", () => {
    const plan = buildPlan({
      tasks: [
        { key: "fast", kind: "write", estDays: 2, dependsOn: [], workingDays: false },
        { key: "slow", kind: "procedure", estDays: 20, dependsOn: [] },
        { key: "both", kind: "review", estDays: 3, dependsOn: ["fast", "slow"], workingDays: false },
        { key: "submit", kind: "submit", estDays: 1, dependsOn: ["both"], workingDays: false },
      ],
      deadlineDate: "2027-03-01",
      today: TODAY,
    });
    const get = (k: string) => plan.tasks.find((t) => t.key === k)!;
    expect(get("slow").startDate < get("fast").startDate).toBe(true); // slow branch starts earlier
    expect(get("fast").dueDate <= get("both").startDate).toBe(true);
    expect(get("slow").dueDate <= get("both").startDate).toBe(true);
  });

  it("16. plan regenerates identically (idempotent)", () => {
    const a = buildPlan({ tasks: chain(), deadlineDate: deadline, today: TODAY });
    const b = buildPlan({ tasks: chain(), deadlineDate: deadline, today: TODAY });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("17. crossing a midnight in another tz is handled by date-only inputs", () => {
    // deadline given as provider-local date; planner must not shift it
    const plan = buildPlan({ tasks: chain(), deadlineDate: "2027-01-31", today: TODAY });
    expect(plan.targetSubmit).toBe("2027-01-28");
  });
});

describe("planLeadTimeDays", () => {
  it("measures the critical chain duration", () => {
    const lead = planLeadTimeDays([
      { key: "a", kind: "procedure", estDays: 10, dependsOn: [] },
      { key: "b", kind: "procedure", estDays: 10, dependsOn: ["a"] },
      { key: "c", kind: "write", estDays: 3, dependsOn: [], workingDays: false },
      { key: "s", kind: "submit", estDays: 1, dependsOn: ["b", "c"], workingDays: false },
    ]);
    // a(12 incl buffer, working) + b(12 working) + s(2) calendar-ish
    expect(lead).toBeGreaterThanOrEqual(20);
    expect(lead).toBeLessThanOrEqual(60);
  });

  it("returns 0 for an empty plan", () => {
    expect(planLeadTimeDays([])).toBe(0);
  });
});
