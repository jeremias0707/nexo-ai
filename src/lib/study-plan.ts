/**
 * Plan de estudio semanal (NEXO 2.6). Built on the device from a subject, the
 * exam date and an optional list of topics. No model call: the AI only helps
 * when the student taps a task's "Pedir ayuda" (normal chat, normal quota).
 * The plan lives in localStorage.
 */
import { dayKey, daysBetween } from "./progress.ts";

export const PLAN_MAX_DAYS = 7;
export const PLAN_MIN_DAYS = 5;
export const PLAN_TOPICS_MAX = 12;
export const PLAN_TOPIC_MAX_CHARS = 80;
export const PLAN_MINUTES = [20, 30, 45, 60] as const;
export type PlanMinutes = (typeof PLAN_MINUTES)[number];

export type PlanTaskKind = "aprender" | "repaso" | "fichas" | "oral" | "examen" | "final";

export type PlanTask = {
  id: string;
  kind: PlanTaskKind;
  title: string;
  detail: string;
  minutes: number;
  /** Chat prompt for "Pedir ayuda" (uses one free chat). Empty = local only. */
  prompt: string;
  done: boolean;
};

export type PlanDay = { day: string; tasks: PlanTask[] };

export type StudyPlan = {
  v: 1;
  subject: string;
  examDay: string;
  createdDay: string;
  minutes: PlanMinutes;
  topics: string[];
  /** True when the topic list was empty and generic steps were used. */
  generic: boolean;
  days: PlanDay[];
};

export type PlanInput = {
  subject: string;
  examDay: string;
  today: string;
  topics: string[];
  minutes: number;
};

export type PlanBuild =
  { ok: true; plan: StudyPlan; note: string | null } | { ok: false; error: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function oneLine(text: string, max: number) {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function norm(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Topics from free text: one per line; a single line may use commas or ";".
 * List bullets / numbers are removed. Deduplicated, capped.
 */
export function parseTopics(text: string): string[] {
  const raw = String(text ?? "");
  let parts = raw.split(/\r?\n/);
  if (parts.filter((line) => line.trim()).length <= 1) parts = raw.split(/[;,]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const clean = oneLine(
      part.replace(/^\s*(?:[-*•·]+|\d+[.)-]|[a-z][.)])\s*/i, "").replace(/\*\*|__|`/g, ""),
      PLAN_TOPIC_MAX_CHARS,
    ).replace(/[.:;]+$/, "");
    if (clean.length < 2) continue;
    const key = norm(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= PLAN_TOPICS_MAX) break;
  }
  return out;
}

/**
 * List items of a markdown answer ("- tema", "1. tema"), e.g. to reuse the
 * tutor's suggested topics. Text after a colon or dash is dropped.
 */
export function topicsFromAnswer(markdown: string): string[] {
  const lines = String(markdown ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/);
  const items: string[] = [];
  for (const line of lines) {
    const match = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);
    if (!match) continue;
    const head = match[1].replace(/\*\*|__|`|\$/g, "").split(/\s[—–-]\s|:\s/)[0];
    items.push(head);
  }
  return parseTopics(items.join("\n"));
}

export function sanitizeMinutes(value: unknown): PlanMinutes {
  return (PLAN_MINUTES as readonly number[]).includes(value as number)
    ? (value as PlanMinutes)
    : 30;
}

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + n);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "Lun 6/10" for a "YYYY-MM-DD" key (calendar math only, no time zone). */
export function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d}/${m}`;
}

/** "lunes 6/10". */
export function dayLabelLong(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return `${WEEKDAYS_LONG[weekday]} ${d}/${m}`;
}

/** Days the plan covers: today … the day before the exam, at most 7. */
export function planLength(today: string, examDay: string) {
  const until = daysBetween(today, examDay);
  return { until, days: Math.max(0, Math.min(PLAN_MAX_DAYS, until)) };
}

function split<T>(items: T[], groups: number): T[][] {
  const out: T[][] = Array.from({ length: groups }, () => []);
  if (groups <= 0) return out;
  const base = Math.floor(items.length / groups);
  let extra = items.length % groups;
  let cursor = 0;
  for (let g = 0; g < groups; g += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    out[g] = items.slice(cursor, cursor + size);
    cursor += size;
  }
  return out;
}

function share(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => Math.max(5, Math.round((total * w) / sum / 5) * 5));
  return raw;
}

function joinTopics(list: string[]) {
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}

/**
 * Builds the plan. Learning days spread the topics in order; each later day
 * reviews what came 1 and 3 days before (light spacing). With 3+ days the
 * second to last day is a practice exam and the last one a calm final review.
 */
export function buildPlan(input: PlanInput): PlanBuild {
  const subject = oneLine(input.subject, 60);
  if (subject.length < 2) return { ok: false, error: "Elegí o escribí la materia." };
  if (!DAY_RE.test(input.examDay)) return { ok: false, error: "Elegí la fecha del examen." };
  if (!DAY_RE.test(input.today)) return { ok: false, error: "Fecha de hoy inválida." };
  const { until, days } = planLength(input.today, input.examDay);
  if (until <= 0) return { ok: false, error: "La fecha del examen tiene que ser después de hoy." };
  if (until > 120) return { ok: false, error: "Elegí un examen dentro de los próximos 4 meses." };
  const minutes = sanitizeMinutes(input.minutes);
  const topics = parseTopics(input.topics.join("\n"));
  const generic = topics.length === 0;
  const subjectTopics = generic
    ? [
        `lo básico de ${subject}`,
        `los temas centrales de ${subject}`,
        `los ejercicios típicos de ${subject}`,
      ]
    : topics;

  const hasExamDay = days >= 3;
  const hasFinal = days >= 1;
  const learnDays = Math.max(1, days - (hasExamDay ? 1 : 0) - (hasFinal ? 1 : 0));
  const groups = split(subjectTopics, Math.min(learnDays, subjectTopics.length));
  // More learning days than topic groups: alternate new topics with practice days.
  const schedule: (string[] | null)[] = [];
  if (groups.length >= learnDays) {
    schedule.push(...groups.slice(0, learnDays));
  } else {
    const slots = learnDays;
    const step = slots / groups.length;
    const marks = new Set(groups.map((_, i) => Math.floor(i * step)));
    let g = 0;
    for (let s = 0; s < slots; s += 1) {
      if (marks.has(s) && g < groups.length) {
        schedule.push(groups[g]);
        g += 1;
      } else schedule.push(null);
    }
  }

  const planDays: PlanDay[] = [];
  const learnedByDay: string[][] = [];
  const idFor = (day: number, n: number) => `d${day + 1}t${n + 1}`;

  for (let i = 0; i < days; i += 1) {
    const key = addDays(input.today, i);
    const tasks: Omit<PlanTask, "id" | "done">[] = [];
    const isFinal = hasFinal && i === days - 1;
    const isExam = hasExamDay && i === days - 2;
    if (isFinal) {
      const [a, b, c] = share(minutes, [2, 1, 1]);
      tasks.push({
        kind: "final",
        title: "Repaso final tranquilo",
        detail: "Leé tus resúmenes y repasá solo las ideas clave. Nada nuevo hoy.",
        minutes: a,
        prompt: `Mañana rindo ${subject}. Haceme un repaso final corto de ${joinTopics(subjectTopics.slice(0, 6))}: solo lo esencial para recordar, en una lista.`,
      });
      tasks.push({
        kind: "fichas",
        title: "Fichas: las que fallaste",
        detail: "Pasá tus fichas y tus errores guardados. Marcá cuáles ya sabés.",
        minutes: b,
        prompt: "",
      });
      tasks.push({
        kind: "oral",
        title: "Explicalo en voz alta (2 min por tema)",
        detail: "Contá cada tema sin mirar, como en un oral. Dormí bien.",
        minutes: c,
        prompt: "",
      });
    } else if (isExam) {
      const [a, b] = share(minutes, [3, 2]);
      tasks.push({
        kind: "examen",
        title: "Simulacro: examen de práctica",
        detail: `Hacé un Modo examen de ${subject} con 10 preguntas. Usa 1 de tus exámenes gratis.`,
        minutes: a,
        prompt: "",
      });
      tasks.push({
        kind: "repaso",
        title: "Repasá los errores del simulacro",
        detail: "Abrí «Repasar errores» y anotá por qué te equivocaste.",
        minutes: b,
        prompt: `Hice un simulacro de ${subject}. ¿Cuáles son los errores más comunes en ${joinTopics(subjectTopics.slice(0, 5))} y cómo evitarlos? Corto.`,
      });
    } else {
      const learnIndex = i;
      const today = schedule[learnIndex] ?? null;
      const previous = [learnedByDay[i - 1], learnedByDay[i - 3]]
        .filter((list): list is string[] => Array.isArray(list) && list.length > 0)
        .flat();
      const reviewList = [...new Set(previous)].slice(0, 3);
      if (today && today.length > 0) {
        const topicText = joinTopics(today);
        const weights = reviewList.length > 0 ? [3, 1, 1] : [3, 1];
        const parts = share(minutes, weights);
        tasks.push({
          kind: "aprender",
          title: `Entender: ${topicText}`,
          detail: generic
            ? "Leé tu carpeta o apuntes. Anotá 3 ideas clave con tus palabras."
            : "Leé el tema y anotá 3 ideas clave con tus palabras.",
          minutes: parts[0],
          prompt: `Explicame ${topicText} de ${subject} para un examen: las ideas clave, un ejemplo y un error típico. Corto.`,
        });
        tasks.push({
          kind: "fichas",
          title: "Armá 3 a 5 fichas",
          detail: "En el chat, tocá «Fichas» debajo de una explicación. Practicalas sin internet.",
          minutes: parts[1],
          prompt: "",
        });
        if (reviewList.length > 0) {
          tasks.push({
            kind: "repaso",
            title: `Repaso corto: ${joinTopics(reviewList)}`,
            detail: "Sin mirar: escribí lo que recordás y después compará con el apunte.",
            minutes: parts[2],
            prompt: `Haceme 3 preguntas rápidas de repaso sobre ${joinTopics(reviewList)} (${subject}). Esperá mis respuestas antes de corregir.`,
          });
        }
        learnedByDay[i] = today;
      } else {
        const pool = reviewList.length > 0 ? reviewList : subjectTopics.slice(0, 3);
        const [a, b] = share(minutes, [2, 1]);
        tasks.push({
          kind: "oral",
          title: `Práctica oral: ${joinTopics(pool)}`,
          detail:
            "Pedile a NEXO que te tome oral (modo Profe) y respondé con el micrófono o escribiendo.",
          minutes: a,
          prompt: `Tomame oral de ${subject} sobre ${joinTopics(pool)}. Una pregunta por vez; corregime con Bien, A medias o Mal.`,
        });
        tasks.push({
          kind: "fichas",
          title: "Fichas del tema",
          detail: "Pasá tus fichas y marcá las que ya sabés.",
          minutes: b,
          prompt: "",
        });
        learnedByDay[i] = [];
      }
    }
    planDays.push({
      day: key,
      tasks: tasks.map((task, n) => ({ ...task, id: idFor(i, n), done: false })),
    });
  }

  let note: string | null = null;
  if (until < PLAN_MIN_DAYS) {
    note = `Quedan ${until} ${until === 1 ? "día" : "días"}: armé un plan corto e intensivo.`;
  } else if (until > PLAN_MAX_DAYS) {
    note = `Faltan ${until} días. Este plan cubre la primera semana; cuando termine, armá otro.`;
  }
  if (generic) {
    note = `${note ? `${note} ` : ""}Sin temas cargados uso pasos generales. Podés pedirle a NEXO los temas clave.`;
  }

  return {
    ok: true,
    note,
    plan: {
      v: 1,
      subject,
      examDay: input.examDay,
      createdDay: input.today,
      minutes,
      topics,
      generic,
      days: planDays,
    },
  };
}

export function toggleTask(plan: StudyPlan, taskId: string): StudyPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      tasks: day.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    })),
  };
}

export function planProgress(plan: StudyPlan | null) {
  if (!plan) return { done: 0, total: 0, ratio: 0 };
  let done = 0;
  let total = 0;
  for (const day of plan.days) {
    for (const task of day.tasks) {
      total += 1;
      if (task.done) done += 1;
    }
  }
  return { done, total, ratio: total ? done / total : 0 };
}

/** Index of today's day in the plan, -1 before it starts, `days.length` after it ends. */
export function todayIndex(plan: StudyPlan, today: string) {
  if (plan.days.length === 0) return -1;
  const first = plan.days[0].day;
  const offset = daysBetween(first, today);
  if (offset < 0) return -1;
  return Math.min(offset, plan.days.length);
}

/** "Faltan 3 días", "El examen es mañana", "Hoy es el examen". */
export function countdownLine(examDay: string, today: string = dayKey(new Date())) {
  const n = daysBetween(today, examDay);
  if (n < 0) return "El examen ya pasó";
  if (n === 0) return "Hoy es el examen. ¡Éxitos!";
  if (n === 1) return "El examen es mañana";
  return `Faltan ${n} días para el examen`;
}

/** Prompt asking the tutor for the key topics (answer can be reused as topics). */
export function topicsPrompt(subject: string, examDay: string) {
  const name = oneLine(subject, 60) || "la materia";
  const when = DAY_RE.test(examDay) ? ` el ${dayLabelLong(examDay)}` : "";
  return `Tengo examen de ${name}${when} (secundaria). Dame los 5 a 7 temas que más conviene repasar, como lista con guiones, uno por línea, sin explicar. Si no sabés el programa de mi escuela, aclaralo en una frase.`;
}

const KINDS: readonly PlanTaskKind[] = ["aprender", "repaso", "fichas", "oral", "examen", "final"];

export function sanitizePlan(value: unknown): StudyPlan | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.subject !== "string" || !raw.subject.trim()) return null;
  if (typeof raw.examDay !== "string" || !DAY_RE.test(raw.examDay)) return null;
  if (typeof raw.createdDay !== "string" || !DAY_RE.test(raw.createdDay)) return null;
  if (!Array.isArray(raw.days) || raw.days.length === 0 || raw.days.length > PLAN_MAX_DAYS)
    return null;
  const days: PlanDay[] = [];
  for (const rawDay of raw.days as unknown[]) {
    if (!rawDay || typeof rawDay !== "object") return null;
    const d = rawDay as Record<string, unknown>;
    if (typeof d.day !== "string" || !DAY_RE.test(d.day) || !Array.isArray(d.tasks)) return null;
    const tasks: PlanTask[] = [];
    for (const rawTask of (d.tasks as unknown[]).slice(0, 6)) {
      if (!rawTask || typeof rawTask !== "object") continue;
      const t = rawTask as Record<string, unknown>;
      if (typeof t.id !== "string" || typeof t.title !== "string") continue;
      const kind = KINDS.includes(t.kind as PlanTaskKind) ? (t.kind as PlanTaskKind) : "repaso";
      tasks.push({
        id: t.id.slice(0, 12),
        kind,
        title: oneLine(t.title, 200),
        detail: typeof t.detail === "string" ? oneLine(t.detail, 300) : "",
        minutes:
          typeof t.minutes === "number" && Number.isFinite(t.minutes)
            ? Math.max(0, Math.min(240, Math.round(t.minutes)))
            : 10,
        prompt: typeof t.prompt === "string" ? t.prompt.slice(0, 600) : "",
        done: t.done === true,
      });
    }
    days.push({ day: d.day, tasks });
  }
  return {
    v: 1,
    subject: oneLine(raw.subject, 60),
    examDay: raw.examDay,
    createdDay: raw.createdDay,
    minutes: sanitizeMinutes(raw.minutes),
    topics: Array.isArray(raw.topics)
      ? parseTopics((raw.topics as unknown[]).filter((t) => typeof t === "string").join("\n"))
      : [],
    generic: raw.generic === true,
    days,
  };
}
