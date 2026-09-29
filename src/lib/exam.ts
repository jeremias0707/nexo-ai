/**
 * Exam mode ("Modo examen"), shared by the client and /api/exam(-grade).
 *
 * The server asks grok-4.5 for a strict-JSON exam (Structured Outputs) mixing
 * multiple-choice and short written questions. Multiple choice is graded on
 * the device; written answers go to /api/exam-grade. Nothing is stored on the
 * server: the finished exam lives only in the device's progress history.
 */
import { checkDocument, documentContext, type DocPayload } from "./document.ts";
import { checkImageDataUrl } from "./image.ts";

export type ExamSource = "tema" | "pdf" | "foto";
export type ExamDifficulty = "facil" | "media" | "dificil";
export type ExamCount = 5 | 10 | 15;

export const EXAM_COUNTS: readonly ExamCount[] = [5, 10, 15];
export const EXAM_DIFFICULTIES: readonly { id: ExamDifficulty; label: string }[] = [
  { id: "facil", label: "Fácil" },
  { id: "media", label: "Media" },
  { id: "dificil", label: "Difícil" },
];
export const EXAM_TOPIC_MAX = 200;
export const EXAM_PASS = 6;
/** XP per question at "fácil"; scaled by difficulty and by the grade. */
export const EXAM_XP_PER_QUESTION = 10;
const DIFFICULTY_XP: Record<ExamDifficulty, number> = { facil: 1, media: 1.5, dificil: 2 };

export function difficultyLabel(difficulty: ExamDifficulty) {
  return EXAM_DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? "Media";
}

export type ExamQuestion =
  | {
      id: string;
      kind: "mc";
      prompt: string;
      options: string[];
      answer: number;
      explanation: string;
    }
  | {
      id: string;
      kind: "written";
      prompt: string;
      expected: string;
      explanation: string;
    };

export type ExamPaper = { title: string; questions: ExamQuestion[] };

export type Verdict = "correcta" | "parcial" | "incorrecta";

export type ExamAnswer = {
  /** Option index (mc), text (written), or null when skipped. */
  given: number | string | null;
  /** Undefined while a written answer is waiting for (or failed) grading. */
  verdict?: Verdict;
  feedback?: string;
};

/** How many of the questions are short written answers (~30%). */
export function writtenCount(count: number) {
  if (count <= 5) return 1;
  if (count <= 10) return 3;
  return 4;
}

/** Rough duration shown on the config screen. */
export function examMinutes(count: number) {
  return Math.max(3, Math.round(count * 0.8));
}

export function examXpMax(count: number, difficulty: ExamDifficulty) {
  return Math.round(count * EXAM_XP_PER_QUESTION * DIFFICULTY_XP[difficulty]);
}

/** XP for a finished exam: the maximum scaled by the grade (0–10). */
export function examXp(nota: number, count: number, difficulty: ExamDifficulty) {
  const clamped = Math.min(10, Math.max(0, nota));
  return Math.round((examXpMax(count, difficulty) * clamped) / 10);
}

const POINTS: Record<Verdict, number> = { correcta: 1, parcial: 0.5, incorrecta: 0 };

export function verdictPoints(verdict: Verdict | undefined) {
  return verdict ? POINTS[verdict] : 0;
}

/** Local grading of a multiple-choice answer. */
export function gradeChoice(question: ExamQuestion, given: number | null): Verdict {
  return question.kind === "mc" && given === question.answer ? "correcta" : "incorrecta";
}

/**
 * Grade out of 10 with one decimal. Questions whose written answer could not
 * be graded (verdict undefined, not skipped) are left out of the total.
 */
export function computeNota(questions: ExamQuestion[], answers: ExamAnswer[]) {
  let points = 0;
  let total = 0;
  questions.forEach((_, index) => {
    const answer = answers[index];
    if (!answer) {
      total += 1;
      return;
    }
    if (answer.given !== null && answer.verdict === undefined) return;
    total += 1;
    points += verdictPoints(answer.verdict);
  });
  if (total === 0) return 0;
  return Math.round((points / total) * 100) / 10;
}

export function passed(nota: number) {
  return nota >= EXAM_PASS;
}

/** "8", "6,7" (es-AR decimal comma). */
export function formatNota(nota: number) {
  return Number.isInteger(nota) ? String(nota) : nota.toFixed(1).replace(".", ",");
}

export const LETTERS = ["A", "B", "C", "D"] as const;

/** What the student answered, as text. */
export function givenText(question: ExamQuestion, answer: ExamAnswer | undefined) {
  if (!answer || answer.given === null) return "(sin responder)";
  if (question.kind === "mc" && typeof answer.given === "number") {
    return `${LETTERS[answer.given] ?? "?"}) ${question.options[answer.given] ?? ""}`.trim();
  }
  return String(answer.given);
}

export function correctText(question: ExamQuestion) {
  return question.kind === "mc"
    ? `${LETTERS[question.answer]}) ${question.options[question.answer]}`
    : question.expected;
}

/** Chat prompt for "Repasar errores": explains every mistake of the exam. */
export function reviewPrompt(paper: ExamPaper, answers: ExamAnswer[], topic: string) {
  const wrong = paper.questions
    .map((question, index) => ({ question, answer: answers[index], index }))
    .filter(({ answer }) => !answer || answer.verdict !== "correcta");
  const subject = topic.trim() || paper.title;
  if (wrong.length === 0) {
    return `Aprobé un examen de práctica sobre «${subject}» sin errores. Dame un repaso breve de las ideas clave y dos preguntas para seguir practicando.`;
  }
  const lines = wrong.slice(0, 15).map(({ question, answer, index }) => {
    const mine = givenText(question, answer).slice(0, 300);
    return `${index + 1}. ${question.prompt.slice(0, 300)}\n   Mi respuesta: ${mine}\n   Respuesta correcta: ${correctText(question).slice(0, 300)}`;
  });
  return `Hice un examen de práctica sobre «${subject}» y me equivoqué en estas preguntas:\n\n${lines.join("\n\n")}\n\nExplicame cada error de forma breve y clara: por qué la respuesta correcta es esa y cómo darme cuenta la próxima vez.`.slice(
    0,
    5800,
  );
}

// ---- Request validation (server) -------------------------------------------

export type ExamRequest = {
  topic: string;
  source: ExamSource;
  count: ExamCount;
  difficulty: ExamDifficulty;
  document?: DocPayload;
  image?: string;
};

export type ExamRequestCheck = { ok: true; request: ExamRequest } | { ok: false; error: string };

export function checkExamRequest(body: unknown): ExamRequestCheck {
  if (!body || typeof body !== "object") return { ok: false, error: "Pedido de examen inválido." };
  const record = body as Record<string, unknown>;
  const topic = typeof record.topic === "string" ? record.topic.replace(/\s+/g, " ").trim() : "";
  if (topic.length > EXAM_TOPIC_MAX) {
    return { ok: false, error: "El tema es muy largo. Escribilo en pocas palabras." };
  }
  const source: ExamSource =
    record.source === "pdf" || record.source === "foto" ? record.source : "tema";
  const count = EXAM_COUNTS.includes(record.count as ExamCount) ? (record.count as ExamCount) : 10;
  const difficulty: ExamDifficulty =
    record.difficulty === "facil" || record.difficulty === "dificil" ? record.difficulty : "media";
  const request: ExamRequest = { topic, source, count, difficulty };
  if (source === "tema" && topic.length < 2) {
    return { ok: false, error: "Escribí el tema del examen." };
  }
  if (source === "pdf") {
    const doc = checkDocument(record.document);
    if (!doc.ok) return { ok: false, error: doc.error };
    request.document = doc.doc;
  }
  if (source === "foto") {
    const image = checkImageDataUrl(record.image);
    if (!image.ok) return { ok: false, error: image.error };
    request.image = image.url;
  }
  return { ok: true, request };
}

// ---- Model prompts and schemas (server) ---------------------------------------

const DIFFICULTY_GUIDE: Record<ExamDifficulty, string> = {
  facil: "fácil: conceptos y datos centrales, enunciados cortos y directos",
  media: "media: comprensión y relación entre ideas, además de datos",
  dificil: "difícil: aplicación, análisis y comparación, sin salirse del tema",
};

export function examUserPrompt(request: ExamRequest) {
  const written = writtenCount(request.count);
  const topic = request.topic || "(el contenido del material)";
  const lines = [
    `Armá un examen de práctica. Tema: ${topic}.`,
    `Dificultad ${DIFFICULTY_GUIDE[request.difficulty]}.`,
    `Exactamente ${request.count} preguntas: ${request.count - written} de opción múltiple (4 opciones, una sola correcta) y ${written} de respuesta escrita corta.`,
  ];
  if (request.source === "pdf" && request.document) {
    lines.push(
      "Basá TODAS las preguntas en el documento adjunto: cada respuesta tiene que poder verificarse leyendo el documento.",
      documentContext(request.document),
    );
  } else if (request.source === "foto") {
    lines.push(
      "Basá TODAS las preguntas en el contenido de la foto adjunta (apuntes, libro o ejercicio): cada respuesta tiene que poder verificarse con lo que se ve en la foto.",
    );
  }
  return lines.join("\n");
}

export const EXAM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título corto del examen, en español." },
    questions: {
      type: "array",
      minItems: 0,
      maxItems: 15,
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["mc", "written"] },
          prompt: { type: "string", description: "Enunciado de la pregunta." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "4 opciones para 'mc'; lista vacía para 'written'.",
          },
          answer_index: {
            type: "integer",
            description: "Índice 0-3 de la opción correcta para 'mc'; -1 para 'written'.",
          },
          expected_answer: {
            type: "string",
            description: "Respuesta correcta breve (para 'mc', el texto de la opción correcta).",
          },
          explanation: {
            type: "string",
            description: "Por qué es correcta, en 1 o 2 oraciones.",
          },
        },
        required: ["kind", "prompt", "options", "answer_index", "expected_answer", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
} as const;

export const GRADE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["correcta", "parcial", "incorrecta"] },
          feedback: { type: "string", description: "Devolución breve (1 o 2 oraciones)." },
        },
        required: ["verdict", "feedback"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

/** Text of the final message of a non-streaming Responses API reply. */
export function responseText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const record = json as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string" && record.output_text) return record.output_text;
  if (!Array.isArray(record.output)) return "";
  let text = "";
  for (const item of record.output as { type?: string; content?: unknown }[]) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content as { type?: string; text?: unknown }[]) {
      if (part?.type === "output_text" && typeof part.text === "string") text += part.text;
    }
  }
  return text;
}

/** Parses model JSON, tolerating code fences or stray text around the object. */
export function looseJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

export type ExamParse = { ok: true; paper: ExamPaper } | { ok: false; error: string };

/** Minimum usable questions for a requested count (rest may be dropped as invalid). */
export function minQuestions(count: number) {
  return Math.max(3, Math.ceil(count * 0.7));
}

/**
 * Validates the model's exam. Invalid questions are dropped; the exam is
 * rejected when too few survive. `random` shuffles multiple-choice options so
 * the right answer is not always in the same position.
 */
export function parseExamOutput(
  text: string,
  count: number,
  random: () => number = Math.random,
): ExamParse {
  const data = looseJson(text) as { title?: unknown; questions?: unknown } | undefined;
  if (!data || typeof data !== "object" || !Array.isArray(data.questions)) {
    return { ok: false, error: "invalid-json" };
  }
  const questions: ExamQuestion[] = [];
  for (const raw of data.questions as Record<string, unknown>[]) {
    if (questions.length >= count) break;
    if (!raw || typeof raw !== "object") continue;
    const prompt = clean(raw.prompt, 500);
    const explanation = clean(raw.explanation, 600);
    if (prompt.length < 5) continue;
    const id = `q${questions.length + 1}`;
    if (raw.kind === "mc") {
      const options = Array.isArray(raw.options)
        ? raw.options.map((option) => clean(option, 200))
        : [];
      const answer = raw.answer_index;
      if (options.length !== 4 || options.some((option) => !option)) continue;
      if (new Set(options.map((option) => option.toLowerCase())).size !== 4) continue;
      if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer > 3)
        continue;
      const order = [0, 1, 2, 3];
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      questions.push({
        id,
        kind: "mc",
        prompt,
        options: order.map((index) => options[index]),
        answer: order.indexOf(answer),
        explanation,
      });
    } else if (raw.kind === "written") {
      const expected = clean(raw.expected_answer, 400);
      if (!expected) continue;
      questions.push({ id, kind: "written", prompt, expected, explanation });
    }
  }
  if (questions.length < minQuestions(count)) return { ok: false, error: "too-few" };
  const title = clean(data.title, 120) || "Examen de práctica";
  return { ok: true, paper: { title, questions } };
}

// ---- Written-answer grading ----------------------------------------------------

export const GRADE_MAX_ITEMS = 15;

export type GradeItem = { prompt: string; expected: string; answer: string };

export type GradeRequestCheck =
  { ok: true; items: GradeItem[]; topic: string } | { ok: false; error: string };

export function checkGradeRequest(body: unknown): GradeRequestCheck {
  const bad = { ok: false as const, error: "No pude leer las respuestas para corregir." };
  if (!body || typeof body !== "object") return bad;
  const record = body as { items?: unknown; topic?: unknown };
  if (!Array.isArray(record.items) || record.items.length === 0) return bad;
  if (record.items.length > GRADE_MAX_ITEMS) return bad;
  const items: GradeItem[] = [];
  for (const raw of record.items as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") return bad;
    const prompt = clean(raw.prompt, 500);
    const expected = clean(raw.expected, 400);
    const answer = clean(raw.answer, 1000);
    if (!prompt || !expected) return bad;
    items.push({ prompt, expected, answer });
  }
  return { ok: true, items, topic: clean(record.topic, EXAM_TOPIC_MAX) };
}

export function gradeUserPrompt(items: GradeItem[], topic: string) {
  const blocks = items.map(
    (item, index) =>
      `${index + 1}.\nPregunta: ${item.prompt}\nRespuesta esperada: ${item.expected}\n<respuesta_del_estudiante>${item.answer.replace(/<\/?respuesta_del_estudiante>/gi, "") || "(vacía)"}</respuesta_del_estudiante>`,
  );
  return `Corregí estas ${items.length} respuestas escritas de un examen de práctica${
    topic ? ` sobre «${topic}»` : ""
  }. Devolvé un resultado por respuesta, en el mismo orden.\n\n${blocks.join("\n\n")}`;
}

export type GradeResult = { verdict: Verdict; feedback: string };

export function parseGradeOutput(text: string, expected: number): GradeResult[] | null {
  const data = looseJson(text) as { results?: unknown } | undefined;
  if (!data || !Array.isArray(data.results) || data.results.length !== expected) return null;
  const results: GradeResult[] = [];
  for (const raw of data.results as Record<string, unknown>[]) {
    const verdict = raw?.verdict;
    if (verdict !== "correcta" && verdict !== "parcial" && verdict !== "incorrecta") return null;
    results.push({ verdict, feedback: clean(raw.feedback, 400) });
  }
  return results;
}
