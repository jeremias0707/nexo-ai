import { useEffect, useMemo, useState } from "react";
import { dayKey } from "./progress.ts";
import { usePlanStore } from "./study-store.ts";
import {
  buildSchedule,
  loadPlan3,
  savePlan3,
  snapshot,
  subscribePlan3,
  type PlanState,
} from "./plan3.ts";
import { useToday } from "./use-progress.ts";

/** Plan 3.0 + today's schedule. Re-plans once per day (missed tasks move to today onward). */
export function usePlan3() {
  const today = useToday();
  const [plan, setPlan] = useState<PlanState | null>(null);
  useEffect(() => {
    const read = () => setPlan(loadPlan3());
    read();
    return subscribePlan3(read);
  }, []);

  // One-time move of the 2.6 single-subject plan into the new planner.
  useEffect(() => {
    if (!plan || plan.exams.length > 0 || localStorage.getItem("nexo-plan3-migrated")) return;
    localStorage.setItem("nexo-plan3-migrated", "1");
    const old = usePlanStore.getState().plan;
    if (old && old.examDay >= dayKey(new Date())) {
      savePlan3({
        ...plan,
        minutes: old.minutes,
        exams: [
          {
            id: "p26",
            subject: old.subject,
            date: old.examDay,
            topics: old.generic ? [] : old.topics,
          },
        ],
      });
    }
  }, [plan]);

  const schedule = useMemo(() => (plan ? buildSchedule(plan, today) : null), [plan, today]);

  useEffect(() => {
    const needs =
      plan &&
      schedule &&
      plan.exams.length &&
      (plan.builtDay !== today ||
        (plan.todayTasks.length === 0 &&
          schedule.days[0]?.day === today &&
          schedule.days[0].tasks.length > 0));
    if (plan && schedule && needs) {
      savePlan3(snapshot(plan, schedule, today));
    }
  }, [plan, schedule, today]);

  return { plan, schedule, today };
}
