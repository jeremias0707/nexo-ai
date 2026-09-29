/** One fixed mission per Monday–Sunday week. Progress is local. No model call. */

export const WEEK_KINDS = ["questions", "favorites", "cards", "exams"] as const;
export type WeekKind = (typeof WEEK_KINDS)[number];

export type WeekMission = {
  id: string;
  title: string;
  detail: string;
  kind: WeekKind;
  need: number;
};

export const WEEK_MISSIONS: WeekMission[] = [
  {
    id: "preguntas",
    title: "Tres preguntas",
    detail: "Hacé 3 preguntas esta semana.",
    kind: "questions",
    need: 3,
  },
  {
    id: "favoritos",
    title: "Dos favoritos",
    detail: "Marcá 2 respuestas con la estrella.",
    kind: "favorites",
    need: 2,
  },
  {
    id: "fichas",
    title: "Tres fichas",
    detail: "Marcá 3 fichas como «la sabía».",
    kind: "cards",
    need: 3,
  },
  {
    id: "examen",
    title: "Un examen",
    detail: "Terminá un examen de práctica.",
    kind: "exams",
    need: 1,
  },
];

export type WeekProgress = { weekId: string; n: number; done: boolean };

export function emptyWeek(): WeekProgress {
  return { weekId: "", n: 0, done: false };
}

/** ISO week of the local calendar date (Monday start). */
export function isoWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const id = `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  return { id, index: week };
}

export function missionFor(date: Date) {
  const week = isoWeek(date);
  const mission = WEEK_MISSIONS[week.index % WEEK_MISSIONS.length];
  return { ...mission, weekId: week.id };
}

export function sanitizeWeek(value: unknown): WeekProgress {
  const base = emptyWeek();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<WeekProgress>;
  const weekId = typeof raw.weekId === "string" && /^\d{4}-W\d{2}$/.test(raw.weekId) ? raw.weekId : "";
  const n = typeof raw.n === "number" && Number.isFinite(raw.n) && raw.n > 0 ? Math.floor(raw.n) : 0;
  return { weekId, n: Math.min(n, 99), done: raw.done === true && Boolean(weekId) };
}

/** Counts one local action toward this week's mission. Resets when the week changes. */
export function touchWeek(previous: WeekProgress, date: Date, kind: WeekKind) {
  const mission = missionFor(date);
  const state =
    previous.weekId === mission.weekId
      ? { ...previous }
      : { weekId: mission.weekId, n: 0, done: false };
  if (state.done || mission.kind !== kind) return { progress: state, justDone: false };
  const n = Math.min(mission.need, state.n + 1);
  const done = n >= mission.need;
  return { progress: { ...state, n, done }, justDone: done && !state.done };
}

export function shareLines(input: {
  level: number;
  levelName: string;
  streak: number;
  medal: string | null;
  mission: string;
}) {
  const days = input.streak === 1 ? "día" : "días";
  return [
    "NEXO AI",
    `Nivel ${input.level} · ${input.levelName}`,
    `Racha: ${input.streak} ${days}`,
    input.medal ? `Medalla: ${input.medal}` : "Medallas en camino",
    input.mission,
  ];
}
