/**
 * Racha y metas (NEXO 2.6): minutes of real study per day on this device and
 * a streak of days that reached the goal (10 min by default). Free and local:
 * no accounts, no purchases, no "streak freeze" for sale.
 */
import { bumpStreak, daysBetween, liveStreak, type Streak } from "./progress.ts";

export const GOAL_CHOICES = [5, 10, 15, 20] as const;
export type GoalMinutes = (typeof GOAL_CHOICES)[number];
export const DEFAULT_GOAL: GoalMinutes = 10;
/** Days of minutes history kept on the device. */
export const GOAL_HISTORY_DAYS = 60;
/** A single tick never adds more than this (sleep, frozen tab, clock jumps). */
export const MAX_TICK_SECONDS = 60;
/** No input for this long = not studying (the timer pauses). */
export const IDLE_AFTER_MS = 3 * 60_000;

export type GoalState = {
  v: 1;
  goal: GoalMinutes;
  /** "YYYY-MM-DD" → seconds studied that day. */
  days: Record<string, number>;
  /** Days that reached the goal (the goal of that moment). */
  streak: Streak;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyGoal(): GoalState {
  return { v: 1, goal: DEFAULT_GOAL, days: {}, streak: { current: 0, best: 0, last: null } };
}

export function sanitizeGoalMinutes(value: unknown): GoalMinutes {
  return (GOAL_CHOICES as readonly number[]).includes(value as number)
    ? (value as GoalMinutes)
    : DEFAULT_GOAL;
}

function prune(days: Record<string, number>, today: string) {
  const out: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(days)) {
    if (!DAY_RE.test(key)) continue;
    const age = daysBetween(key, today);
    if (age < 0 || age >= GOAL_HISTORY_DAYS) continue;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) continue;
    out[key] = Math.min(24 * 3600, Math.floor(seconds));
  }
  return out;
}

export function sanitizeGoal(value: unknown, today: string): GoalState {
  const base = emptyGoal();
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<string, unknown>;
  const s = (raw.streak ?? {}) as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  const current = num(s.current);
  return {
    v: 1,
    goal: sanitizeGoalMinutes(raw.goal),
    days: prune(
      raw.days && typeof raw.days === "object" ? (raw.days as Record<string, number>) : {},
      today,
    ),
    streak: {
      current,
      best: Math.max(current, num(s.best)),
      last: typeof s.last === "string" && DAY_RE.test(s.last) ? s.last : null,
    },
  };
}

/**
 * Adds study time to `today`. Returns `reached: true` only on the tick that
 * crosses the goal for the first time that day (the streak moves then).
 */
export function addStudySeconds(state: GoalState, today: string, seconds: number) {
  const add = Math.max(0, Math.min(MAX_TICK_SECONDS, Math.floor(seconds)));
  if (add === 0 || !DAY_RE.test(today)) return { state, reached: false };
  const before = state.days[today] ?? 0;
  const after = Math.min(24 * 3600, before + add);
  const target = state.goal * 60;
  const reached = before < target && after >= target && state.streak.last !== today;
  const days = prune({ ...state.days, [today]: after }, today);
  return {
    state: { ...state, days, streak: reached ? bumpStreak(state.streak, today) : state.streak },
    reached,
  };
}

/** Changing the goal never removes a streak already earned. */
export function setGoalMinutes(state: GoalState, goal: unknown, today: string) {
  const next = { ...state, goal: sanitizeGoalMinutes(goal) };
  const seconds = next.days[today] ?? 0;
  if (seconds >= next.goal * 60 && next.streak.last !== today) {
    return { ...next, streak: bumpStreak(next.streak, today) };
  }
  return next;
}

export function goalToday(state: GoalState, today: string) {
  const seconds = state.days[today] ?? 0;
  const target = state.goal * 60;
  return {
    minutes: Math.floor(seconds / 60),
    seconds,
    goal: state.goal,
    ratio: Math.min(1, seconds / target),
    met: seconds >= target || state.streak.last === today,
    streak: liveStreak(state.streak, today),
    best: state.streak.best,
  };
}

/** Last 7 days (oldest first) for the small week strip. */
export function lastWeek(state: GoalState, today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const out: { day: string; minutes: number; met: boolean }[] = [];
  for (let back = 6; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) - back));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    const seconds = state.days[key] ?? 0;
    out.push({ day: key, minutes: Math.floor(seconds / 60), met: seconds >= state.goal * 60 });
  }
  return out;
}

export function weekMinutes(state: GoalState, today: string) {
  return lastWeek(state, today).reduce((sum, d) => sum + d.minutes, 0);
}

/** "Racha de estudio: 3 días" style line. */
export function goalLine(state: GoalState, today: string) {
  const info = goalToday(state, today);
  const days = info.streak === 1 ? "día" : "días";
  if (info.met) return `Meta cumplida · racha ${info.streak} ${days}`;
  return `${info.minutes}/${info.goal} min hoy · racha ${info.streak} ${days}`;
}
