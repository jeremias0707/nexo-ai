/**
 * NEXO 3.0 — "Repaso que se adapta". Weak points the student had, kept only on
 * this device (localStorage), grouped by subject + topic. Each topic carries a
 * weight: misses raise it, hits lower it, and at 0 it is dropped.
 * Sources: wrong exam answers, flashcards marked "No la sabía", and chat
 * messages like "no entendí".
 */
import { sanitizeSubject, subjectLabel, type SubjectChoice } from "./subjects.ts";

export const WEAK_KEY = "nexo-weak-spots";
export const WEAK_CAP = 30;
export const WEAK_MAX = 10;
export const WEAK_SAMPLES = 3;
export const WEAK_ROUND_TOPICS = 3;
export const WEAK_TOPIC_LEN = 70;
export const WEAK_SAMPLE_LEN = 160;

export type WeakSource = "examen" | "ficha" | "chat";

export type WeakSpot = {
  id: string;
  subject: SubjectChoice;
  topic: string;
  weight: number;
  misses: number;
  hits: number;
  updatedAt: number;
  from: WeakSource[];
  samples: string[];
};

function clean(text: unknown, max: number) {
  if (typeof text !== "string") return "";
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function norm(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function weakId(subject: SubjectChoice, topic: string) {
  return `${subject || "-"}|${norm(topic)}`;
}

const SOURCES: WeakSource[] = ["examen", "ficha", "chat"];

export function sanitizeWeak(value: unknown): WeakSpot[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, WeakSpot>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const topic = clean(r.topic, WEAK_TOPIC_LEN);
    if (norm(topic).length < 2) continue;
    const subject = sanitizeSubject(r.subject);
    const weight = typeof r.weight === "number" && Number.isFinite(r.weight) ? r.weight : 0;
    if (weight <= 0) continue;
    const id = weakId(subject, topic);
    byId.set(id, {
      id,
      subject,
      topic,
      weight: Math.min(WEAK_MAX, Math.round(weight * 10) / 10),
      misses: Math.max(0, Math.floor(Number(r.misses) || 0)),
      hits: Math.max(0, Math.floor(Number(r.hits) || 0)),
      updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
      from: Array.isArray(r.from) ? SOURCES.filter((s) => (r.from as unknown[]).includes(s)) : [],
      samples: Array.isArray(r.samples)
        ? r.samples
            .map((s) => clean(s, WEAK_SAMPLE_LEN))
            .filter(Boolean)
            .slice(0, WEAK_SAMPLES)
        : [],
    });
  }
  return rank([...byId.values()]).slice(0, WEAK_CAP);
}

/** Heaviest first; ties → most recent. */
export function rank(list: WeakSpot[]) {
  return list.slice().sort((a, b) => b.weight - a.weight || b.updatedAt - a.updatedAt);
}

export type WeakEvent = {
  subject: SubjectChoice;
  topic: string;
  /** Positive = missed (raise), negative = got it right (lower). */
  delta: number;
  source: WeakSource;
  sample?: string;
};

export function applyWeak(list: WeakSpot[], events: WeakEvent[], now: number): WeakSpot[] {
  const byId = new Map(sanitizeWeak(list).map((s) => [s.id, s]));
  for (const event of events) {
    const topic = clean(event.topic, WEAK_TOPIC_LEN);
    if (norm(topic).length < 2 || !Number.isFinite(event.delta) || event.delta === 0) continue;
    const subject = sanitizeSubject(event.subject);
    const id = weakId(subject, topic);
    const prev = byId.get(id);
    if (!prev && event.delta < 0) continue; // nothing to lower
    const spot: WeakSpot = prev
      ? { ...prev, from: [...prev.from], samples: [...prev.samples] }
      : {
          id,
          subject,
          topic,
          weight: 0,
          misses: 0,
          hits: 0,
          updatedAt: now,
          from: [],
          samples: [],
        };
    spot.weight = Math.min(WEAK_MAX, Math.round((spot.weight + event.delta) * 10) / 10);
    spot.updatedAt = now;
    if (event.delta > 0) spot.misses += 1;
    else spot.hits += 1;
    if (event.delta > 0 && !spot.from.includes(event.source)) spot.from.push(event.source);
    const sample = clean(event.sample, WEAK_SAMPLE_LEN);
    if (event.delta > 0 && sample && !spot.samples.some((s) => norm(s) === norm(sample))) {
      spot.samples = [sample, ...spot.samples].slice(0, WEAK_SAMPLES);
    }
    if (spot.weight <= 0) byId.delete(id);
    else byId.set(id, spot);
  }
  return rank([...byId.values()]).slice(0, WEAK_CAP);
}

/** "no entendí", "no me quedó claro", "no lo entiendo"… */
export function saysConfused(text: string) {
  const t = norm(text);
  if (t.length > 160) return false;
  return /\b(no (lo |la |te |le )?(entendi|entiendo|comprendo|comprendi|cache|capto)|no me (quedo|queda) claro|no me sale|sigo sin entender|explicame de nuevo|no se entiende)\b/.test(
    t,
  );
}

/** The topics for a practice round: the heaviest few. */
export function pickRound(list: WeakSpot[], limit = WEAK_ROUND_TOPICS) {
  return rank(sanitizeWeak(list)).slice(0, limit);
}

export function spotLabel(spot: Pick<WeakSpot, "subject" | "topic">) {
  const s = subjectLabel(spot.subject);
  return s ? `${s} · ${spot.topic}` : spot.topic;
}

/** Topic line for /api/exam (≤200 chars). */
export function roundTopic(spots: WeakSpot[]) {
  const text = `Repaso de puntos débiles: ${spots.map(spotLabel).join("; ")}`;
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/** Example misses sent with the round so the model aims at them. */
export function roundFocus(spots: WeakSpot[]) {
  return spots.flatMap((s) => s.samples.slice(0, 2)).slice(0, 5);
}

/**
 * After a round: each round topic moves by its share of the result.
 * Wrong answers raise, right ones lower (1 point per question split across topics).
 */
export function roundEvents(spots: WeakSpot[], correct: number, wrong: number): WeakEvent[] {
  if (spots.length === 0) return [];
  const delta = (wrong - correct * 1.5) / spots.length;
  if (delta === 0) return [];
  return spots.map((s) => ({ subject: s.subject, topic: s.topic, delta, source: "examen" }));
}

/** Weight 0–10 as a word for the UI. */
export function weightWord(weight: number) {
  if (weight >= 6) return "Flojo";
  if (weight >= 3) return "A reforzar";
  return "Casi listo";
}

// ---- storage ----------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeWeak(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadWeak(): WeakSpot[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return sanitizeWeak(JSON.parse(localStorage.getItem(WEAK_KEY) ?? "null"));
  } catch {
    return [];
  }
}

export function saveWeak(list: WeakSpot[]) {
  const next = sanitizeWeak(list);
  if (typeof localStorage !== "undefined") {
    try {
      if (next.length) localStorage.setItem(WEAK_KEY, JSON.stringify(next));
      else localStorage.removeItem(WEAK_KEY);
    } catch {
      // optional
    }
  }
  for (const l of listeners) l();
  return next;
}

export function recordWeak(events: WeakEvent[]) {
  if (events.length === 0) return;
  saveWeak(applyWeak(loadWeak(), events, Date.now()));
}

export function clearWeak() {
  saveWeak([]);
}

export function currentSubject(): SubjectChoice {
  if (typeof localStorage === "undefined") return "";
  return sanitizeSubject(localStorage.getItem("nexo-subject") ?? "");
}
