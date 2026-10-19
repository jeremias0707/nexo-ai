/**
 * Desafío diario: one short local challenge per calendar day. Completing it
 * can open a free chat (uses the normal daily chat quota). No paid path.
 */

import { dayKey } from "./progress.ts";

export type DailyChallenge = {
  id: string;
  title: string;
  prompt: string;
  /** Optional subject id for tone (mate, histo, …). */
  subject?: string;
};

/** Fixed pool — facts that do not depend on the current year. */
export const DAILY_POOL: DailyChallenge[] = [
  {
    id: "derivada-intuicion",
    title: "Derivada en 1 min",
    prompt: "Explicame qué es una derivada en pocas líneas, con un ejemplo de velocidad.",
    subject: "mate",
  },
  {
    id: "fotosintesis",
    title: "Fotosíntesis corta",
    prompt: "Resumime la fotosíntesis en 5 oraciones y nombrá un error típico.",
    subject: "bio",
  },
  {
    id: "mayo-1810",
    title: "Revolución de Mayo",
    prompt: "¿Qué pasó en mayo de 1810 en Buenos Aires? Solo lo esencial.",
    subject: "histo",
  },
  {
    id: "newton-1",
    title: "Primera ley de Newton",
    prompt: "Explicame la primera ley de Newton con un ejemplo de la vida diaria.",
    subject: "fisica",
  },
  {
    id: "atomo",
    title: "Átomo básico",
    prompt: "¿Cómo está formado un átomo? Protones, neutrones y electrones, simple.",
    subject: "quimica",
  },
  {
    id: "sujeto",
    title: "Sujeto y predicado",
    prompt: "¿Cómo reconozco el sujeto y el predicado? Dame 2 oraciones de ejemplo.",
    subject: "lengua",
  },
  {
    id: "present-simple",
    title: "Present simple",
    prompt: "Explicame el present simple en inglés con 3 ejemplos y un error común.",
    subject: "ingles",
  },
  {
    id: "clima-tiempo",
    title: "Clima vs tiempo",
    prompt: "¿Qué diferencia hay entre clima y tiempo atmosférico? Una analogía corta.",
    subject: "geo",
  },
  {
    id: "porcentajes",
    title: "Porcentajes",
    prompt: "¿Cómo calculo el 15 % de 240? Mostrame los pasos.",
    subject: "mate",
  },
  {
    id: "adn",
    title: "ADN en corto",
    prompt: "¿Qué es el ADN y para qué sirve? Explicalo como si fuera para 1º año.",
    subject: "bio",
  },
  {
    id: "ohm",
    title: "Ley de Ohm",
    prompt: "Explicame la ley de Ohm y resolvé un ejemplo simple con números.",
    subject: "fisica",
  },
  {
    id: "argumentativo",
    title: "Texto argumentativo",
    prompt: "¿Cómo se arma un texto argumentativo? Estructura en 4 pasos cortos.",
    subject: "lengua",
  },
];

export const DAILY_DONE_KEY = "nexo-daily-done";

export type DailyDone = { day: string; id: string };

/** Deterministic pick from the pool for a calendar day (local timezone). */
export function challengeForDay(
  date: Date = new Date(),
  pool: readonly DailyChallenge[] = DAILY_POOL,
) {
  if (pool.length === 0) {
    return {
      id: "vacio",
      title: "Desafío",
      prompt: "Elegí un tema de estudio y pedime un resumen corto.",
    } satisfies DailyChallenge;
  }
  const key = dayKey(date);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}

export function sanitizeDailyDone(value: unknown): DailyDone | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { day?: unknown; id?: unknown };
  if (typeof raw.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return null;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  return { day: raw.day, id: raw.id.trim().slice(0, 80) };
}

export function loadDailyDone(): DailyDone | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return sanitizeDailyDone(JSON.parse(localStorage.getItem(DAILY_DONE_KEY) ?? "null"));
  } catch {
    return null;
  }
}

export function markDailyDone(id: string, date: Date = new Date()) {
  const entry: DailyDone = { day: dayKey(date), id };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(DAILY_DONE_KEY, JSON.stringify(entry));
    } catch {
      // optional
    }
  }
  return entry;
}

export function isDailyDone(id: string, date: Date = new Date()) {
  const saved = loadDailyDone();
  return Boolean(saved && saved.day === dayKey(date) && saved.id === id);
}
