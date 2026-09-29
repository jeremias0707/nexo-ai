/**
 * "Repasar errores": questions the student got wrong, kept only on the device
 * (localStorage). A review exam replays these questions; it does not ask the
 * model for new ones. Getting one right removes it. Cap 40, newest first.
 */
import type { ExamAnswer, ExamPaper, ExamQuestion } from "./exam.ts";

export const MISTAKE_CAP = 40;
export const MISTAKES_KEY = "nexo-mistakes";
export const EMPTY_MISTAKES = "Todavía no tenés errores para repasar";

export type Mistake = {
  id: string;
  savedAt: number;
  question: ExamQuestion;
};

function norm(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable id so the same question is not stored twice. */
export function mistakeKey(question: ExamQuestion) {
  if (question.kind === "mc") {
    const options = question.options.map(norm).slice().sort().join("\u001f");
    return `mc\u001f${norm(question.prompt)}\u001f${options}`;
  }
  return `w\u001f${norm(question.prompt)}\u001f${norm(question.expected)}`;
}

function asQuestion(raw: unknown): ExamQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const prompt = typeof q.prompt === "string" ? q.prompt.replace(/\s+/g, " ").trim() : "";
  const explanation = typeof q.explanation === "string" ? q.explanation : "";
  const id = typeof q.id === "string" && q.id.trim() ? q.id.trim().slice(0, 40) : "q";
  if (prompt.length < 1) return null;
  if (q.kind === "mc" && Array.isArray(q.options)) {
    const options = q.options.map((option) => (typeof option === "string" ? option : ""));
    const answer = q.answer;
    if (options.length !== 4 || options.some((option) => !option.trim())) return null;
    if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer > 3)
      return null;
    return { id, kind: "mc", prompt, options, answer, explanation };
  }
  if (q.kind === "written" && typeof q.expected === "string" && q.expected.trim()) {
    return { id, kind: "written", prompt, expected: q.expected, explanation };
  }
  return null;
}

export function sanitizeMistakes(value: unknown): Mistake[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, Mistake>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as { savedAt?: unknown; question?: unknown };
    const question = asQuestion(record.question);
    if (!question) continue;
    const id = mistakeKey(question);
    const savedAt =
      typeof record.savedAt === "number" && Number.isFinite(record.savedAt) ? record.savedAt : 0;
    const previous = byId.get(id);
    if (!previous || savedAt >= previous.savedAt)
      byId.set(id, { id, savedAt, question: { ...question, id } });
  }
  return [...byId.values()]
    .sort((a, b) => b.savedAt - a.savedAt || b.id.localeCompare(a.id))
    .slice(0, MISTAKE_CAP);
}

/**
 * Merge a graded exam into the pile.
 * Correct → drop it. Wrong, partial or skipped → keep it, newest first.
 * A written answer that could not be graded stays if it was already saved,
 * and is added otherwise so it can be tried again.
 */
export function foldMistakes(
  pile: Mistake[],
  questions: ExamQuestion[],
  answers: Array<ExamAnswer | undefined>,
  now: number,
): Mistake[] {
  const byId = new Map(sanitizeMistakes(pile).map((item) => [item.id, item]));
  questions.forEach((question, index) => {
    const id = mistakeKey(question);
    const answer = answers[index];
    const verdict = answer?.verdict;
    if (verdict === "correcta") {
      byId.delete(id);
      return;
    }
    const unresolved = Boolean(answer && answer.given !== null && verdict === undefined);
    if (unresolved && byId.has(id)) return;
    const savedAt = now + index;
    byId.set(id, { id, savedAt, question: { ...question } });
  });
  return [...byId.values()]
    .sort((a, b) => b.savedAt - a.savedAt || b.id.localeCompare(a.id))
    .slice(0, MISTAKE_CAP);
}

/** Exam made only of the saved questions (newest first). Null when the pile is empty. */
export function reviewPaper(pile: Mistake[]): ExamPaper | null {
  const items = sanitizeMistakes(pile);
  if (items.length === 0) return null;
  return {
    title: "Repaso de errores",
    questions: items.map((item, index) => ({ ...item.question, id: `r${index + 1}` })),
  };
}

/** "Repasar errores (4)", or null when there is nothing to review. */
export function mistakeButtonLabel(count: number) {
  if (!Number.isFinite(count) || count <= 0) return null;
  return `Repasar errores (${Math.min(MISTAKE_CAP, Math.floor(count))})`;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeMistakes(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

export function loadMistakes(): Mistake[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return sanitizeMistakes(JSON.parse(localStorage.getItem(MISTAKES_KEY) ?? "null"));
  } catch {
    return [];
  }
}

export function saveMistakes(pile: Mistake[]) {
  const next = sanitizeMistakes(pile);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(MISTAKES_KEY, JSON.stringify(next));
    } catch {
      // Storage full: the review pile is optional.
    }
  }
  emit();
  return next;
}
