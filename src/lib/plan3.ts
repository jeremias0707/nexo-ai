/**
 * NEXO 3.0 — Plan de estudio con varias materias. Built on the device (no AI
 * call): subjects + exam dates + optional topics + minutes a day → a
 * day-by-day plan up to each exam. Missed tasks go back into the pool and are
 * re-planned from today. Everything lives in localStorage.
 */
import { daysBetween } from "./progress.ts";

export const PLAN3_KEY = "nexo-plan3";
export const PLAN3_EXAMS_MAX = 8;
export const PLAN3_TOPICS_MAX = 10;
export const PLAN3_MINUTES = [20, 30, 45, 60, 90] as const;
export const PLAN3_HORIZON = 120;

export type TaskKind =
  "apuntes" | "aprender" | "fichas" | "repaso" | "errores" | "examen" | "final";

export type PlanExam = { id: string; subject: string; date: string; topics: string[] };

export type Task = {
  /** Unit key: stable across re-plans so "done" survives. */
  key: string;
  examId: string;
  subject: string;
  kind: TaskKind;
  title: string;
  topic: string;
  minutes: number;
  /** It was scheduled on an earlier day and not done. */
  moved?: boolean;
};

export type PlanState = {
  v: 3;
  exams: PlanExam[];
  minutes: number;
  done: string[];
  /** Day the schedule was last built; tasks for earlier days that were not done are "missed". */
  builtDay: string;
  /** Snapshot keys per day from the last build (to detect missed tasks). */
  lastDays: Record<string, string[]>;
  notify: boolean;
  notifiedDay: string;
  /** Tasks that were left undone on earlier days and got re-planned today. */
  moved: string[];
  /** Today's list, frozen once built so checking a task off doesn't reshuffle the day. */
  todayTasks: Task[];
};

export const EMPTY_PLAN: PlanState = {
  v: 3,
  exams: [],
  minutes: 45,
  done: [],
  builtDay: "",
  lastDays: {},
  notify: false,
  notifiedDay: "",
  moved: [],
  todayTasks: [],
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function line(text: unknown, max: number) {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function splitTopics(text: string) {
  const raw = text.includes("\n") ? text.split(/\r?\n/) : text.split(/[;,]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw) {
    const t = line(part.replace(/^\s*(?:[-*•·]+|\d+[.)])\s*/, ""), 60);
    if (t.length < 2 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= PLAN3_TOPICS_MAX) break;
  }
  return out;
}

export function sanitizePlan3(value: unknown): PlanState {
  if (!value || typeof value !== "object") return { ...EMPTY_PLAN };
  const r = value as Record<string, unknown>;
  const exams = (Array.isArray(r.exams) ? r.exams : [])
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return {
        id: line(x.id, 40),
        subject: line(x.subject, 40),
        date: typeof x.date === "string" && DAY_RE.test(x.date) ? x.date : "",
        topics: Array.isArray(x.topics)
          ? x.topics
              .map((t) => line(t, 60))
              .filter((t) => t.length >= 2)
              .slice(0, PLAN3_TOPICS_MAX)
          : [],
      };
    })
    .filter((e) => e.id && e.subject.length >= 2 && e.date)
    .slice(0, PLAN3_EXAMS_MAX);
  const minutes = (PLAN3_MINUTES as readonly number[]).includes(r.minutes as number)
    ? (r.minutes as number)
    : 45;
  const lastDays: Record<string, string[]> = {};
  if (r.lastDays && typeof r.lastDays === "object") {
    for (const [k, v] of Object.entries(r.lastDays as Record<string, unknown>)) {
      if (DAY_RE.test(k) && Array.isArray(v)) lastDays[k] = v.filter((x) => typeof x === "string");
    }
  }
  return {
    v: 3,
    exams,
    minutes,
    done: Array.isArray(r.done) ? r.done.filter((x) => typeof x === "string").slice(-600) : [],
    builtDay: typeof r.builtDay === "string" && DAY_RE.test(r.builtDay) ? r.builtDay : "",
    lastDays,
    notify: r.notify === true,
    notifiedDay: typeof r.notifiedDay === "string" ? r.notifiedDay : "",
    todayTasks: (Array.isArray(r.todayTasks) ? r.todayTasks : [])
      .filter(
        (t): t is Task =>
          !!t &&
          typeof t === "object" &&
          typeof (t as Task).key === "string" &&
          typeof (t as Task).title === "string" &&
          typeof (t as Task).kind === "string",
      )
      .slice(0, 8),
    moved: Array.isArray(r.moved) ? r.moved.filter((x) => typeof x === "string").slice(0, 60) : [],
  };
}

/** Ordered study units for one exam (without the fixed last days). */
function units(exam: PlanExam): Task[] {
  const base = { examId: exam.id, subject: exam.subject, minutes: 0 };
  const k = (s: string) => `${exam.id}:${s}`;
  const list: Task[] = [];
  if (exam.topics.length === 0) {
    list.push({
      ...base,
      key: k("apuntes"),
      kind: "apuntes",
      topic: "",
      title: `Subí tus apuntes de ${exam.subject} y armá el kit`,
    });
    for (const [i, part] of [
      "lo básico",
      "los temas centrales",
      "los ejercicios típicos",
    ].entries())
      list.push({
        ...base,
        key: k(`aprender:${i}`),
        kind: "aprender",
        topic: `${part} de ${exam.subject}`,
        title: `Aprender ${part}`,
      });
  } else {
    exam.topics.forEach((topic, i) => {
      list.push({
        ...base,
        key: k(`aprender:${i}`),
        kind: "aprender",
        topic,
        title: `Aprender: ${topic}`,
      });
      if (i % 2 === 1 || i === exam.topics.length - 1)
        list.push({
          ...base,
          key: k(`fichas:${i}`),
          kind: "fichas",
          topic,
          title: "Repasar con fichas",
        });
    });
  }
  list.push({
    ...base,
    key: k("errores"),
    kind: "errores",
    topic: "",
    title: "Repasar mis errores",
  });
  return list;
}

export type BuiltDay = { day: string; tasks: Task[] };
export type Schedule = { days: BuiltDay[]; missed: number };

function taskMinutes(total: number, count: number) {
  return Math.max(10, Math.round(total / Math.max(1, count) / 5) * 5);
}

/**
 * Day-by-day plan from `today` to the last exam. Each day gets
 * ~minutes/15 slots (2–6). The day before an exam is a calm final review and,
 * with room, two days before is a practice exam. Other slots go to the exam
 * whose pending work per remaining day is highest (most urgent first);
 * when an exam has no pending units left, spaced reviews of its topics fill in.
 */
export function buildSchedule(plan: PlanState, today: string): Schedule {
  const done = new Set(plan.done);
  const exams = plan.exams
    .filter((e) => daysBetween(today, e.date) >= 1 && daysBetween(today, e.date) <= PLAN3_HORIZON)
    .sort((a, b) => a.date.localeCompare(b.date));
  const missedKeys = new Set(plan.builtDay === today ? plan.moved : missedSince(plan, today));
  const examIds = new Set(exams.map((e) => e.id));
  const fixed =
    plan.builtDay === today && plan.todayTasks.length
      ? plan.todayTasks.filter((t) => examIds.has(t.examId))
      : null;
  const fixedKeys = new Set(fixed?.map((t) => t.key) ?? []);
  const pending = new Map(
    exams.map((e) => [e.id, units(e).filter((u) => !done.has(u.key) && !fixedKeys.has(u.key))]),
  );
  const reviewCursor = new Map(exams.map((e) => [e.id, 0]));
  const slots = Math.min(6, Math.max(2, Math.round(plan.minutes / 15)));
  const last = exams.length ? exams[exams.length - 1].date : today;
  const days: BuiltDay[] = [];
  for (let day = today; day < last; day = addDays(day, 1)) {
    if (fixed && day === today) {
      days.push({
        day,
        tasks: fixed.map((t) => ({ ...t, moved: missedKeys.has(t.key) ? true : undefined })),
      });
      continue;
    }
    const tasks: Task[] = [];
    const active = exams.filter((e) => e.date > day);
    for (const exam of active) {
      const left = daysBetween(day, exam.date);
      const base = { examId: exam.id, subject: exam.subject, minutes: 0, topic: "" };
      if (left === 1)
        tasks.push({
          ...base,
          key: `${exam.id}:final`,
          kind: "final",
          title: `Repaso final tranquilo de ${exam.subject}`,
        });
      if (left === 2 && daysBetween(today, exam.date) >= 3)
        tasks.push({
          ...base,
          key: `${exam.id}:examen`,
          kind: "examen",
          title: `Examen de práctica de ${exam.subject}`,
        });
    }
    let guard = 0;
    while (tasks.length < slots && active.length && guard++ < 20) {
      // most urgent: pending units per day left (subjects already today get a small penalty)
      let best: PlanExam | null = null;
      let bestScore = -1;
      for (const exam of active) {
        const left = Math.max(1, daysBetween(day, exam.date) - 1);
        const already = tasks.filter((t) => t.examId === exam.id).length;
        const score = ((pending.get(exam.id)?.length ?? 0) + 0.5) / left - already * 0.6;
        if (score > bestScore) {
          bestScore = score;
          best = exam;
        }
      }
      if (!best) break;
      const queue = pending.get(best.id) ?? [];
      const next = queue.shift();
      if (next) {
        tasks.push({ ...next });
        continue;
      }
      const topics = best.topics.length ? best.topics : [`los temas de ${best.subject}`];
      const i = reviewCursor.get(best.id) ?? 0;
      reviewCursor.set(best.id, i + 1);
      const topic = topics[i % topics.length];
      tasks.push({
        examId: best.id,
        subject: best.subject,
        minutes: 0,
        key: `${best.id}:repaso:${day}:${i}`,
        kind: "repaso",
        topic,
        title: `Repasar: ${topic}`,
      });
      if (tasks.filter((t) => t.examId === best!.id).length > slots) break;
    }
    const each = taskMinutes(plan.minutes, tasks.length);
    days.push({
      day,
      tasks: tasks.map((t) => ({
        ...t,
        minutes: t.kind === "examen" ? Math.max(each, 15) : each,
        moved: day === today && missedKeys.has(t.key) ? true : undefined,
      })),
    });
  }
  let missed = 0;
  for (const key of missedKeys) if (!done.has(key)) missed += 1;
  return { days, missed };
}

/** Undone (non-filler) tasks from days since the last build, before today. */
export function missedSince(plan: PlanState, today: string) {
  const done = new Set(plan.done);
  const out: string[] = [];
  for (const [day, keys] of Object.entries(plan.lastDays)) {
    if (day < today && (!plan.builtDay || day >= plan.builtDay))
      for (const key of keys) if (!done.has(key) && !key.includes(":repaso:")) out.push(key);
  }
  return out;
}

/** Rebuild bookkeeping: remember what each day had so tomorrow we know what was missed. */
export function snapshot(plan: PlanState, schedule: Schedule, today: string): PlanState {
  const lastDays: Record<string, string[]> = {};
  for (const [day, keys] of Object.entries(plan.lastDays)) if (day < today) lastDays[day] = keys;
  for (const d of schedule.days) lastDays[d.day] = d.tasks.map((t) => t.key);
  // keep only ~3 weeks of past days
  for (const day of Object.keys(lastDays)) if (daysBetween(day, today) > 21) delete lastDays[day];
  const todayTasks = schedule.days[0]?.day === today ? schedule.days[0].tasks : [];
  return {
    ...plan,
    lastDays,
    builtDay: today,
    moved: plan.builtDay === today ? plan.moved : missedSince(plan, today),
    todayTasks,
  };
}

export function toggleDone(plan: PlanState, key: string): PlanState {
  const done = plan.done.includes(key) ? plan.done.filter((k) => k !== key) : [...plan.done, key];
  return { ...plan, done };
}

export function nextExams(plan: PlanState, today: string) {
  return plan.exams
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ ...e, left: daysBetween(today, e.date) }));
}

export function leftLabel(left: number) {
  if (left <= 0) return "hoy";
  if (left === 1) return "mañana";
  return `en ${left} días`;
}

/** Chat prompt for "Aprender"/"Repasar" tasks (uses one free chat). */
export function taskPrompt(task: Task) {
  if (task.kind === "aprender")
    return `Estoy estudiando ${task.subject} para un examen. Explicame ${task.topic} paso a paso, con un ejemplo, y al final haceme 2 preguntas cortas.`;
  if (task.kind === "repaso" || task.kind === "final")
    return `Haceme un repaso rápido de ${task.topic || task.subject} (${task.subject}): las ideas clave en pocas líneas y 3 preguntas para ver si lo sé.`;
  return "";
}

export function loadPlan3(): PlanState {
  if (typeof localStorage === "undefined") return { ...EMPTY_PLAN };
  try {
    return sanitizePlan3(JSON.parse(localStorage.getItem(PLAN3_KEY) ?? "null"));
  } catch {
    return { ...EMPTY_PLAN };
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribePlan3(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function savePlan3(plan: PlanState) {
  const next = sanitizePlan3(plan);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PLAN3_KEY, JSON.stringify(next));
    } catch {
      // optional
    }
  }
  for (const l of listeners) l();
  return next;
}
