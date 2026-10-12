import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addStudySeconds,
  emptyGoal,
  goalLine,
  goalToday,
  lastWeek,
  sanitizeGoal,
  setGoalMinutes,
  weekMinutes,
} from "./study-goal.ts";

function study(state: ReturnType<typeof emptyGoal>, day: string, minutes: number) {
  let s = state;
  let reached = 0;
  for (let i = 0; i < minutes * 4; i += 1) {
    const r = addStudySeconds(s, day, 15);
    s = r.state;
    if (r.reached) reached += 1;
  }
  return { state: s, reached };
}

describe("study goal (10 min/day streak)", () => {
  it("defaults to 10 minutes and counts real seconds", () => {
    const s = emptyGoal();
    assert.equal(s.goal, 10);
    const { state, reached } = study(s, "2026-10-05", 9);
    assert.equal(reached, 0);
    assert.equal(goalToday(state, "2026-10-05").minutes, 9);
    assert.equal(goalToday(state, "2026-10-05").met, false);
  });

  it("reaches the goal once per day and builds a streak", () => {
    const first = study(emptyGoal(), "2026-10-05", 12);
    let state = first.state;
    assert.equal(first.reached, 1);
    assert.equal(goalToday(state, "2026-10-05").streak, 1);
    ({ state } = study(state, "2026-10-06", 10));
    assert.equal(goalToday(state, "2026-10-06").streak, 2);
    // A skipped day breaks it (shown as 0), the best stays.
    assert.equal(goalToday(state, "2026-10-08").streak, 0);
    ({ state } = study(state, "2026-10-08", 10));
    assert.equal(goalToday(state, "2026-10-08").streak, 1);
    assert.equal(state.streak.best, 2);
  });

  it("caps each tick so a sleeping tab cannot fake study time", () => {
    const r = addStudySeconds(emptyGoal(), "2026-10-05", 3600);
    assert.equal(r.state.days["2026-10-05"], 60);
    assert.equal(
      addStudySeconds(emptyGoal(), "2026-10-05", -5).state.days["2026-10-05"],
      undefined,
    );
  });

  it("changing the goal keeps the streak and can complete today", () => {
    const { state } = study(emptyGoal(), "2026-10-05", 6);
    const lower = setGoalMinutes(state, 5, "2026-10-05");
    assert.equal(goalToday(lower, "2026-10-05").met, true);
    assert.equal(lower.streak.current, 1);
    assert.equal(setGoalMinutes(lower, 99, "2026-10-05").goal, 10);
  });

  it("summarizes the week and sanitizes storage", () => {
    let { state } = study(emptyGoal(), "2026-10-01", 10);
    ({ state } = study(state, "2026-10-05", 3));
    const week = lastWeek(state, "2026-10-05");
    assert.equal(week.length, 7);
    assert.equal(week[0].day, "2026-09-29");
    assert.equal(week.at(-1)?.minutes, 3);
    assert.equal(weekMinutes(state, "2026-10-05"), 13);
    assert.equal(goalLine(state, "2026-10-05"), "3/10 min hoy · racha 0 días");
    const restored = sanitizeGoal(JSON.parse(JSON.stringify(state)), "2026-10-05");
    assert.deepEqual(restored, state);
    const old = sanitizeGoal(
      { goal: 15, days: { "2025-01-01": 900, bad: 5, "2026-10-04": -1 } },
      "2026-10-05",
    );
    assert.deepEqual(old.days, {});
    assert.equal(old.goal, 15);
  });
});
