/**
 * NEXO 2.7: "Seguir donde quedaste" and subject shortcuts. Pure helpers, so the
 * home screen and the tests share them. Everything stays on the device.
 */
import { SUBJECTS, type SubjectChoice } from "./subjects.ts";

type ThreadLike = {
  id: string;
  title: string;
  updatedAt: number;
  messages: { role: "user" | "assistant"; content: string }[];
};

function answered(thread: ThreadLike) {
  return thread.messages.some((m) => m.role === "assistant" && m.content.trim().length > 0);
}

/** Conversations with at least one answer, most recent first. */
export function recentThreads<T extends ThreadLike>(threads: T[], limit = 4): T[] {
  return threads
    .filter(answered)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/** The conversation to offer in "Seguir donde quedaste", or null. */
export function lastThread<T extends ThreadLike>(threads: T[]): T | null {
  return recentThreads(threads, 1)[0] ?? null;
}

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días", "12/10". */
export function timeAgo(ts: number, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - ts) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  const date = new Date(ts);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

/** Last line the student wrote, shortened, to remind them where they left off. */
export function lastQuestion(thread: ThreadLike, max = 70) {
  for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
    const m = thread.messages[i];
    if (m.role === "user" && m.content.trim()) {
      const clean = m.content.replace(/\s+/g, " ").trim();
      return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
    }
  }
  return "";
}

/** Text left ready in the box when a subject shortcut opens a new chat (costs nothing until sent). */
export function subjectStarter(id: SubjectChoice) {
  const subject = SUBJECTS.find((s) => s.id === id);
  if (!subject) return "";
  return `${subject.hint}: `;
}
