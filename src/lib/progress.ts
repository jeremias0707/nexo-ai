/**
 * Streak, XP, levels and medals. Everything lives on the device (no accounts):
 * the web app keeps it in localStorage, the Flutter app ports the same rules to
 * shared_preferences. All functions are pure so the rules are easy to test.
 */
import type { ExamDifficulty } from "./exam.ts";

// ---- Calendar days (local time, DST-safe) --------------------------------------

/** Local calendar day, "YYYY-MM-DD". */
export function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole days from `a` to `b` (keys), independent of DST and time zone. */
export function daysBetween(a: string, b: string) {
  const parse = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}

export type Streak = { current: number; best: number; last: string | null };

/** Records activity on `today`. Same day: unchanged; next day: +1; gap: back to 1. */
export function bumpStreak(streak: Streak, today: string): Streak {
  if (!streak.last) return { current: 1, best: Math.max(1, streak.best), last: today };
  const gap = daysBetween(streak.last, today);
  if (gap === 0) return streak;
  // Clock moved backwards (travel, manual change): keep the streak as is.
  if (gap < 0) return streak;
  const current = gap === 1 ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), last: today };
}

/** Streak to show today: it is lost once a whole calendar day was skipped. */
export function liveStreak(streak: Streak, today: string) {
  if (!streak.last) return 0;
  const gap = daysBetween(streak.last, today);
  return gap <= 1 ? streak.current : 0;
}

// ---- XP and levels ---------------------------------------------------------------

export const XP = {
  question: 10,
  photo: 15,
  pdf: 20,
  medal: 50,
} as const;

/** Anti-farming: rewarded actions per local day. */
export const DAILY = {
  questions: 10, // 100 XP
  photos: 4, // 60 XP
  pdfs: 2, // 40 XP
  exams: 3,
} as const;

export const LEVELS = [
  { level: 1, name: "Novato", xp: 0 },
  { level: 2, name: "Curioso", xp: 100 },
  { level: 3, name: "Aprendiz", xp: 250 },
  { level: 4, name: "Estudioso", xp: 500 },
  { level: 5, name: "Investigador", xp: 850 },
  { level: 6, name: "Experto", xp: 1300 },
  { level: 7, name: "Maestro", xp: 1900 },
  { level: 8, name: "Sabio", xp: 2700 },
  { level: 9, name: "Estratega", xp: 3700 },
  { level: 10, name: "Leyenda", xp: 5000 },
] as const;

export type LevelInfo = {
  level: number;
  name: string;
  /** XP where this level starts. */
  floor: number;
  /** XP of the next level (null at the top). */
  next: number | null;
  nextName: string | null;
  /** 0–1 progress inside the level. */
  ratio: number;
  /** XP still missing for the next level. */
  missing: number;
};

export function levelFor(xp: number): LevelInfo {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) if (xp >= LEVELS[i].xp) index = i;
  const current = LEVELS[index];
  const upcoming = LEVELS[index + 1];
  if (!upcoming) {
    return {
      level: current.level,
      name: current.name,
      floor: current.xp,
      next: null,
      nextName: null,
      ratio: 1,
      missing: 0,
    };
  }
  return {
    level: current.level,
    name: current.name,
    floor: current.xp,
    next: upcoming.xp,
    nextName: upcoming.name,
    ratio: Math.min(1, Math.max(0, (xp - current.xp) / (upcoming.xp - current.xp))),
    missing: upcoming.xp - xp,
  };
}

// ---- Subjects (for the "Explorador" medal) ------------------------------------------

const SUBJECTS: Record<string, string[]> = {
  matematica: [
    "matematica",
    "ecuacion",
    "derivada",
    "integral",
    "fraccion",
    "algebra",
    "geometria",
    "triangulo",
    "porcentaje",
    "logaritmo",
    "funcion lineal",
    "funcion cuadratica",
    "polinomio",
    "trigonometria",
    "teorema de pitagoras",
    "probabilidad",
  ],
  biologia: [
    "biologia",
    "celula",
    "mitosis",
    "meiosis",
    "adn",
    "fotosintesis",
    "ecosistema",
    "respiracion celular",
    "genetica",
    "organismo",
    "sistema digestivo",
    "sistema nervioso",
  ],
  historia: [
    "historia",
    "revolucion",
    "independencia",
    "guerra",
    "imperio",
    "colonia",
    "virreinato",
    "primera junta",
    "cabildo",
    "siglo xix",
    "siglo xx",
    "edad media",
  ],
  fisica: [
    "fisica",
    "fuerza",
    "velocidad",
    "aceleracion",
    "gravedad",
    "newton",
    "energia cinetica",
    "movimiento",
    "electricidad",
    "circuito",
    "optica",
  ],
  quimica: [
    "quimica",
    "atomo",
    "molecula",
    "tabla periodica",
    "enlace",
    "reaccion quimica",
    "elemento quimico",
    "compuesto",
    "ph",
    "estequiometria",
  ],
  lengua: [
    "lengua",
    "literatura",
    "sustantivo",
    "verbo",
    "adjetivo",
    "oracion",
    "sintaxis",
    "ortografia",
    "poema",
    "novela",
    "cuento",
    "narrador",
    "texto argumentativo",
  ],
  geografia: [
    "geografia",
    "clima",
    "continente",
    "relieve",
    "poblacion",
    "hidrografia",
    "latitud",
    "longitud",
    "biomas",
    "cordillera",
  ],
  ingles: [
    "ingles",
    "english",
    "present simple",
    "past simple",
    "present perfect",
    "verb to be",
    "vocabulary",
    "grammar",
  ],
  ciudadania: [
    "ciudadania",
    "constitucion",
    "democracia",
    "derechos humanos",
    "etica",
    "filosofia",
    "poder ejecutivo",
    "poder legislativo",
  ],
  economia: ["economia", "inflacion", "oferta y demanda", "mercado", "contabilidad", "presupuesto"],
  informatica: [
    "informatica",
    "programacion",
    "algoritmo",
    "python",
    "javascript",
    "codigo",
    "base de datos",
  ],
  arte: ["musica", "partitura", "acorde", "arte", "pintura", "escultura", "dibujo"],
};

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** School subjects a question mentions (cheap local keyword match). */
export function detectSubjects(text: string) {
  const plain = ` ${normalize(text).replace(/[^a-z0-9ñ]+/g, " ")} `;
  return Object.entries(SUBJECTS)
    .filter(([, words]) =>
      words.some(
        (word) =>
          plain.includes(` ${word} `) ||
          plain.includes(` ${word}s `) ||
          plain.includes(` ${word}es `),
      ),
    )
    .map(([subject]) => subject);
}

// ---- State -----------------------------------------------------------------------

export type ExamRecord = {
  at: number;
  day: string;
  topic: string;
  source: "tema" | "pdf" | "foto";
  difficulty: ExamDifficulty;
  count: number;
  correct: number;
  nota: number;
  xp: number;
};

export type Progress = {
  v: 1;
  xp: number;
  streak: Streak;
  daily: {
    day: string;
    questions: number;
    photos: number;
    pdfs: number;
    exams: number;
    xp: number;
  };
  stats: {
    questions: number;
    photos: number;
    pdfs: number;
    night: number;
    exams: number;
    passed: number;
    perfect: number;
    subjects: string[];
  };
  /** Medal id → unlock time (ms). */
  medals: Record<string, number>;
  exams: ExamRecord[];
};

export const EXAM_HISTORY_MAX = 30;

export function emptyProgress(): Progress {
  return {
    v: 1,
    xp: 0,
    streak: { current: 0, best: 0, last: null },
    daily: { day: "", questions: 0, photos: 0, pdfs: 0, exams: 0, xp: 0 },
    stats: {
      questions: 0,
      photos: 0,
      pdfs: 0,
      night: 0,
      exams: 0,
      passed: 0,
      perfect: 0,
      subjects: [],
    },
    medals: {},
    exams: [],
  };
}

/** Repairs whatever came from storage (older versions, manual edits, corruption). */
export function sanitizeProgress(value: unknown): Progress {
  const base = emptyProgress();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Progress>;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  const str = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const stats = (raw.stats ?? {}) as Partial<Progress["stats"]>;
  const daily = (raw.daily ?? {}) as Partial<Progress["daily"]>;
  const streak = (raw.streak ?? {}) as Partial<Streak>;
  const medals: Record<string, number> = {};
  if (raw.medals && typeof raw.medals === "object") {
    for (const [id, at] of Object.entries(raw.medals))
      if (MEDALS.some((m) => m.id === id)) medals[id] = num(at);
  }
  return {
    v: 1,
    xp: num(raw.xp),
    streak: {
      current: num(streak.current),
      best: Math.max(num(streak.best), num(streak.current)),
      last: str(streak.last),
    },
    daily: {
      day: str(daily.day) ?? "",
      questions: num(daily.questions),
      photos: num(daily.photos),
      pdfs: num(daily.pdfs),
      exams: num(daily.exams),
      xp: num(daily.xp),
    },
    stats: {
      questions: num(stats.questions),
      photos: num(stats.photos),
      pdfs: num(stats.pdfs),
      night: num(stats.night),
      exams: num(stats.exams),
      passed: num(stats.passed),
      perfect: num(stats.perfect),
      subjects: Array.isArray(stats.subjects)
        ? [
            ...new Set(
              stats.subjects.filter((s): s is string => typeof s === "string" && s in SUBJECTS),
            ),
          ]
        : [],
    },
    medals,
    exams: Array.isArray(raw.exams)
      ? raw.exams
          .filter(
            (e): e is ExamRecord =>
              Boolean(e) && typeof e === "object" && typeof e.nota === "number",
          )
          .slice(0, EXAM_HISTORY_MAX)
      : [],
  };
}

// ---- Medals ------------------------------------------------------------------------

export type MedalIcon =
  | "target"
  | "file"
  | "camera"
  | "moon"
  | "flame"
  | "images"
  | "compass"
  | "book"
  | "star"
  | "graduation"
  | "trophy"
  | "message"
  | "zap";

export type Medal = {
  id: string;
  name: string;
  /** How to get it (shown while locked). */
  hint: string;
  /** What you did (shown once unlocked). */
  done: string;
  icon: MedalIcon;
  target: number;
  value: (p: Progress) => number;
};

export const MEDALS: Medal[] = [
  {
    id: "primera-mision",
    name: "Primera misión",
    hint: "Hacé tu primera pregunta",
    done: "Hiciste tu primera pregunta",
    icon: "target",
    target: 1,
    value: (p) => p.stats.questions,
  },
  {
    id: "primer-pdf",
    name: "Primer PDF",
    hint: "Estudiá con un apunte en PDF",
    done: "Estudiaste con un apunte",
    icon: "file",
    target: 1,
    value: (p) => p.stats.pdfs,
  },
  {
    id: "primera-foto",
    name: "Primera foto",
    hint: "Mandá la foto de un ejercicio",
    done: "Resolviste tu primera foto",
    icon: "camera",
    target: 1,
    value: (p) => p.stats.photos,
  },
  {
    id: "nocturno",
    name: "Nocturno",
    hint: "Estudiá después de las 23 h",
    done: "Estudiaste después de las 23 h",
    icon: "moon",
    target: 1,
    value: (p) => p.stats.night,
  },
  {
    id: "racha-7",
    name: "Racha de 7 días",
    hint: "Estudiá 7 días seguidos",
    done: "Estudiaste 7 días seguidos",
    icon: "flame",
    target: 7,
    value: (p) => p.streak.best,
  },
  {
    id: "fotos-10",
    name: "10 fotos resueltas",
    hint: "Resolvé 10 ejercicios con foto",
    done: "Resolviste 10 ejercicios con foto",
    icon: "images",
    target: 10,
    value: (p) => p.stats.photos,
  },
  {
    id: "explorador",
    name: "Explorador",
    hint: "Preguntá de 5 materias",
    done: "Preguntaste de 5 materias",
    icon: "compass",
    target: 5,
    value: (p) => p.stats.subjects.length,
  },
  {
    id: "primer-examen",
    name: "Primer examen",
    hint: "Terminá tu primer examen",
    done: "Terminaste tu primer examen",
    icon: "book",
    target: 1,
    value: (p) => p.stats.exams,
  },
  {
    id: "examen-perfecto",
    name: "Examen perfecto",
    hint: "Sacá 10/10 en un examen",
    done: "Sacaste 10/10 en un examen",
    icon: "star",
    target: 1,
    value: (p) => p.stats.perfect,
  },
  {
    id: "aprobados-5",
    name: "5 exámenes aprobados",
    hint: "Aprobá 5 exámenes",
    done: "Aprobaste 5 exámenes",
    icon: "graduation",
    target: 5,
    value: (p) => p.stats.passed,
  },
  {
    id: "racha-30",
    name: "Racha de 30 días",
    hint: "Estudiá 30 días seguidos",
    done: "Estudiaste 30 días seguidos",
    icon: "trophy",
    target: 30,
    value: (p) => p.streak.best,
  },
  {
    id: "preguntas-100",
    name: "100 preguntas",
    hint: "Hacé 100 preguntas",
    done: "Hiciste 100 preguntas",
    icon: "message",
    target: 100,
    value: (p) => p.stats.questions,
  },
  {
    id: "nivel-5",
    name: "Nivel 5",
    hint: "Llegá al nivel 5 · Investigador",
    done: "Llegaste al nivel 5",
    icon: "zap",
    target: 5,
    value: (p) => levelFor(p.xp).level,
  },
];

export function medalProgress(medal: Medal, progress: Progress) {
  const value = Math.min(medal.target, medal.value(progress));
  return {
    value,
    target: medal.target,
    ratio: value / medal.target,
    unlocked: Boolean(progress.medals[medal.id]),
  };
}

// ---- Applying activity -----------------------------------------------------------

export type Activity =
  | { kind: "question"; text: string; photo?: boolean; pdf?: boolean }
  | {
      kind: "exam";
      topic: string;
      source: ExamRecord["source"];
      difficulty: ExamDifficulty;
      count: number;
      correct: number;
      nota: number;
      /** XP earned by the grade before the daily cap. */
      xp: number;
    };

export type Unlock = { id: string; name: string; done: string; icon: MedalIcon; xp: number };

export type ActivityResult = {
  progress: Progress;
  /** Total XP gained, medals included. */
  gained: number;
  /** XP from the activity itself (after caps), medals excluded. */
  earned: number;
  unlocked: Unlock[];
  levelUp: LevelInfo | null;
};

function isNight(date: Date) {
  const hour = date.getHours();
  return hour >= 23 || hour < 5;
}

export function applyActivity(previous: Progress, activity: Activity, now: Date): ActivityResult {
  const today = dayKey(now);
  const p: Progress = structuredClone(previous);
  if (p.daily.day !== today)
    p.daily = { day: today, questions: 0, photos: 0, pdfs: 0, exams: 0, xp: 0 };
  p.streak = bumpStreak(p.streak, today);
  let earned = 0;

  if (activity.kind === "question") {
    p.stats.questions += 1;
    if (p.daily.questions < DAILY.questions) earned += XP.question;
    p.daily.questions += 1;
    if (activity.photo) {
      p.stats.photos += 1;
      if (p.daily.photos < DAILY.photos) earned += XP.photo;
      p.daily.photos += 1;
    }
    if (activity.pdf) {
      p.stats.pdfs += 1;
      if (p.daily.pdfs < DAILY.pdfs) earned += XP.pdf;
      p.daily.pdfs += 1;
    }
    if (isNight(now)) p.stats.night += 1;
    const found = detectSubjects(activity.text);
    p.stats.subjects = [...new Set([...p.stats.subjects, ...found])];
  } else {
    p.stats.exams += 1;
    if (activity.nota >= 6) p.stats.passed += 1;
    if (activity.nota >= 10) p.stats.perfect += 1;
    const rewarded = p.daily.exams < DAILY.exams ? Math.max(0, Math.round(activity.xp)) : 0;
    earned += rewarded;
    p.daily.exams += 1;
    const found = detectSubjects(activity.topic);
    p.stats.subjects = [...new Set([...p.stats.subjects, ...found])];
    p.exams = [
      {
        at: now.getTime(),
        day: today,
        topic: activity.topic.slice(0, 120),
        source: activity.source,
        difficulty: activity.difficulty,
        count: activity.count,
        correct: activity.correct,
        nota: activity.nota,
        xp: rewarded,
      },
      ...p.exams,
    ].slice(0, EXAM_HISTORY_MAX);
  }

  const levelBefore = levelFor(previous.xp).level;
  p.xp += earned;
  let gained = earned;
  const unlocked: Unlock[] = [];
  // Medals can unlock others (e.g. XP from medals reaching level 5).
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const medal of MEDALS) {
      if (p.medals[medal.id] || medal.value(p) < medal.target) continue;
      p.medals[medal.id] = now.getTime();
      p.xp += XP.medal;
      gained += XP.medal;
      unlocked.push({
        id: medal.id,
        name: medal.name,
        done: medal.done,
        icon: medal.icon,
        xp: XP.medal,
      });
      changed = true;
    }
    if (!changed) break;
  }
  p.daily.xp += gained;
  const after = levelFor(p.xp);
  return {
    progress: p,
    gained,
    earned,
    unlocked,
    levelUp: after.level > levelBefore ? after : null,
  };
}

/** Averages for the profile. */
export function examSummary(progress: Progress) {
  const list = progress.exams;
  if (list.length === 0)
    return {
      count: progress.stats.exams,
      passed: progress.stats.passed,
      average: null as number | null,
    };
  const average =
    Math.round((list.reduce((sum, exam) => sum + exam.nota, 0) / list.length) * 10) / 10;
  return { count: progress.stats.exams, passed: progress.stats.passed, average };
}

/** XP earned today (0 when the stored day is not today). */
export function xpToday(progress: Progress, today: string) {
  return progress.daily.day === today ? progress.daily.xp : 0;
}
