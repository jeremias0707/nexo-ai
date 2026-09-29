import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkExamRequest,
  checkGradeRequest,
  computeNota,
  examXp,
  examXpMax,
  formatNota,
  gradeChoice,
  looseJson,
  parseExamOutput,
  parseGradeOutput,
  passed,
  responseText,
  reviewPrompt,
  writtenCount,
  type ExamPaper,
} from "./exam.ts";

const mc = (i: number, answer = 1) => ({
  kind: "mc",
  prompt: `Pregunta número ${i}`,
  options: [`a${i}`, `b${i}`, `c${i}`, `d${i}`],
  answer_index: answer,
  expected_answer: `b${i}`,
  explanation: "Porque sí.",
});
const written = (i: number) => ({
  kind: "written",
  prompt: `Pregunta escrita ${i}`,
  options: [],
  answer_index: -1,
  expected_answer: "Respuesta",
  explanation: "Explicación.",
});

describe("exam scoring", () => {
  it("scales XP by difficulty and grade (mockup: 10 media, 8/10 → 120 of 150)", () => {
    assert.equal(examXpMax(10, "media"), 150);
    assert.equal(examXp(8, 10, "media"), 120);
    assert.equal(examXp(10, 5, "facil"), 50);
    assert.equal(examXp(10, 15, "dificil"), 300);
    assert.equal(examXp(-1, 10, "media"), 0);
  });
  it("computes the grade with partial credit and skipped questions", () => {
    const qs = parseExamOutput(
      JSON.stringify({ title: "t", questions: [mc(1), mc(2), written(3)] }),
      3,
      () => 0.99,
    );
    assert.ok(qs.ok);
    const questions = qs.ok ? qs.paper.questions : [];
    assert.equal(
      computeNota(questions, [
        { given: 1, verdict: "correcta" },
        { given: null, verdict: "incorrecta" },
        { given: "algo", verdict: "parcial" },
      ]),
      5,
    );
    // Ungraded written answer is left out of the total.
    assert.equal(
      computeNota(questions, [
        { given: 1, verdict: "correcta" },
        { given: 1, verdict: "correcta" },
        { given: "algo" },
      ]),
      10,
    );
    assert.equal(formatNota(6.7), "6,7");
    assert.equal(formatNota(8), "8");
    assert.equal(passed(6), true);
    assert.equal(passed(5.9), false);
  });
  it("grades multiple choice locally", () => {
    const parsed = parseExamOutput(
      JSON.stringify({ title: "t", questions: [mc(1, 2), mc(2), mc(3)] }),
      3,
      () => 0.99,
    );
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const q = parsed.paper.questions[0];
    assert.equal(q.kind, "mc");
    if (q.kind !== "mc") return;
    assert.equal(q.options[q.answer], "c1");
    assert.equal(gradeChoice(q, q.answer), "correcta");
    assert.equal(gradeChoice(q, (q.answer + 1) % 4), "incorrecta");
    assert.equal(gradeChoice(q, null), "incorrecta");
  });
  it("mixes ~30% written questions", () => {
    assert.deepEqual([5, 10, 15].map(writtenCount), [1, 3, 4]);
  });
});

describe("parseExamOutput", () => {
  it("accepts fenced JSON and shuffles options keeping the right answer", () => {
    const text =
      "```json\n" +
      JSON.stringify({ title: "Mayo", questions: [mc(1), mc(2), mc(3), mc(4), written(5)] }) +
      "\n```";
    let seed = 0.3;
    const parsed = parseExamOutput(text, 5, () => (seed = (seed * 9301 + 0.49297) % 1));
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    assert.equal(parsed.paper.questions.length, 5);
    parsed.paper.questions.forEach((q, i) => {
      if (q.kind === "mc") assert.equal(q.options[q.answer], `b${i + 1}`);
      else assert.equal(q.expected, "Respuesta");
    });
  });
  it("drops invalid questions and rejects exams with too few", () => {
    const bad = [
      { ...mc(1), options: ["a", "b", "c"] },
      { ...mc(2), options: ["a", "a", "b", "c"] },
      { ...mc(3), answer_index: 4 },
      { ...written(4), expected_answer: "" },
      mc(5),
    ];
    assert.deepEqual(parseExamOutput(JSON.stringify({ title: "x", questions: bad }), 5), {
      ok: false,
      error: "too-few",
    });
    assert.deepEqual(parseExamOutput("no es json", 5), { ok: false, error: "invalid-json" });
    const enough = parseExamOutput(
      JSON.stringify({ title: "", questions: [...bad, mc(6), mc(7), mc(8)] }),
      5,
    );
    assert.ok(enough.ok);
    if (enough.ok) {
      assert.equal(enough.paper.questions.length, 4);
      assert.equal(enough.paper.title, "Examen de práctica");
    }
  });
  it("never returns more than requested", () => {
    const many = Array.from({ length: 12 }, (_, i) => mc(i));
    const parsed = parseExamOutput(JSON.stringify({ title: "x", questions: many }), 10);
    assert.ok(parsed.ok && parsed.paper.questions.length === 10);
  });
});

describe("requests", () => {
  it("validates exam requests per source", () => {
    assert.equal(checkExamRequest({ source: "tema", topic: " " }).ok, false);
    const ok = checkExamRequest({
      source: "tema",
      topic: "Revolución de Mayo",
      count: 15,
      difficulty: "dificil",
    });
    assert.deepEqual(ok, {
      ok: true,
      request: { topic: "Revolución de Mayo", source: "tema", count: 15, difficulty: "dificil" },
    });
    const defaults = checkExamRequest({ topic: "Célula", count: 7, difficulty: "x" });
    assert.ok(
      defaults.ok && defaults.request.count === 10 && defaults.request.difficulty === "media",
    );
    assert.equal(checkExamRequest({ source: "tema", topic: "x".repeat(201) }).ok, false);
    assert.equal(checkExamRequest({ source: "pdf", topic: "" }).ok, false);
    const pdf = checkExamRequest({
      source: "pdf",
      document: { name: "a.pdf", kind: "pdf", text: "Texto", truncated: false },
    });
    assert.ok(pdf.ok && pdf.request.document?.text === "Texto");
    assert.equal(
      checkExamRequest({ source: "foto", image: "data:image/gif;base64,AAAA" }).ok,
      false,
    );
    assert.ok(checkExamRequest({ source: "foto", image: "data:image/jpeg;base64,/9j/4AAQ" }).ok);
  });
  it("validates grading requests", () => {
    assert.equal(checkGradeRequest({ items: [] }).ok, false);
    assert.equal(
      checkGradeRequest({
        items: Array.from({ length: 16 }, () => ({ prompt: "p", expected: "e", answer: "a" })),
      }).ok,
      false,
    );
    const ok = checkGradeRequest({
      items: [{ prompt: "p", expected: "e", answer: "" }],
      topic: "Mayo",
    });
    assert.deepEqual(ok, {
      ok: true,
      items: [{ prompt: "p", expected: "e", answer: "" }],
      topic: "Mayo",
    });
  });
  it("parses model output", () => {
    assert.equal(
      responseText({
        output: [
          { type: "reasoning" },
          { type: "message", content: [{ type: "output_text", text: '{"a":1}' }] },
        ],
      }),
      '{"a":1}',
    );
    assert.deepEqual(looseJson('Acá va: {"a": 1} listo'), { a: 1 });
    assert.deepEqual(
      parseGradeOutput(JSON.stringify({ results: [{ verdict: "parcial", feedback: "Casi." }] }), 1),
      [{ verdict: "parcial", feedback: "Casi." }],
    );
    assert.equal(
      parseGradeOutput(JSON.stringify({ results: [{ verdict: "bien", feedback: "" }] }), 1),
      null,
    );
    assert.equal(parseGradeOutput(JSON.stringify({ results: [] }), 1), null);
  });
});

describe("reviewPrompt", () => {
  it("lists only the mistakes", () => {
    const paper: ExamPaper = {
      title: "Mayo",
      questions: [
        {
          id: "q1",
          kind: "mc",
          prompt: "¿Quién presidió la Primera Junta?",
          options: ["Moreno", "Saavedra", "Belgrano", "Paso"],
          answer: 1,
          explanation: "",
        },
        {
          id: "q2",
          kind: "written",
          prompt: "¿Qué virrey fue destituido?",
          expected: "Cisneros",
          explanation: "",
        },
      ],
    };
    const text = reviewPrompt(
      paper,
      [
        { given: 0, verdict: "incorrecta" },
        { given: "Cisneros", verdict: "correcta" },
      ],
      "Revolución de Mayo",
    );
    assert.match(text, /Mi respuesta: A\) Moreno/);
    assert.match(text, /Respuesta correcta: B\) Saavedra/);
    assert.doesNotMatch(text, /virrey/);
    assert.match(
      reviewPrompt(
        paper,
        [
          { given: 1, verdict: "correcta" },
          { given: "x", verdict: "correcta" },
        ],
        "",
      ),
      /sin errores/,
    );
  });
});
