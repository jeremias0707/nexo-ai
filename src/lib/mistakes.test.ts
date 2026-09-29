import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExamQuestion } from "./exam.ts";
import { foldMistakes, mistakeButtonLabel, MISTAKE_CAP, reviewPaper } from "./mistakes.ts";

const mc = (n: number): ExamQuestion => ({
  id: `q${n}`,
  kind: "mc",
  prompt: `Pregunta ${n}`,
  options: ["a", "b", "c", "d"],
  answer: 1,
  explanation: "Porque b.",
});

const written = (n: number): ExamQuestion => ({
  id: `w${n}`,
  kind: "written",
  prompt: `Escrita ${n}`,
  expected: `Respuesta ${n}`,
  explanation: "",
});

describe("repasar errores", () => {
  it("saves a wrong answer and not a correct one", () => {
    const questions = [mc(1), mc(2)];
    const pile = foldMistakes(
      [],
      questions,
      [
        { given: 0, verdict: "incorrecta" },
        { given: 1, verdict: "correcta" },
      ],
      1000,
    );
    assert.equal(pile.length, 1);
    assert.equal(pile[0].question.prompt, "Pregunta 1");
    assert.equal(mistakeButtonLabel(pile.length), "Repasar errores (1)");
  });

  it("removes a saved question after a correct review and keeps a repeat miss", () => {
    const first = foldMistakes(
      [],
      [mc(1), written(2)],
      [
        { given: 0, verdict: "incorrecta" },
        { given: "no", verdict: "incorrecta" },
      ],
      1000,
    );
    assert.equal(first.length, 2);
    const after = foldMistakes(
      first,
      [mc(1), written(2)],
      [
        { given: 1, verdict: "correcta" },
        { given: "tampoco", verdict: "incorrecta" },
      ],
      5000,
    );
    assert.equal(after.length, 1);
    assert.equal(after[0].question.kind, "written");
    assert.ok(after[0].savedAt >= 5000);
  });

  it("caps the pile at 40, newest first", () => {
    const questions = Array.from({ length: 45 }, (_, i) => mc(i + 1));
    const answers = questions.map(() => ({ given: 0 as const, verdict: "incorrecta" as const }));
    const pile = foldMistakes([], questions, answers, 10_000);
    assert.equal(pile.length, MISTAKE_CAP);
    assert.equal(pile[0].question.prompt, "Pregunta 45");
    assert.equal(pile[39].question.prompt, "Pregunta 6");
    assert.equal(
      pile.some((item) => item.question.prompt === "Pregunta 1"),
      false,
    );
    const paper = reviewPaper(pile);
    assert.ok(paper);
    assert.equal(paper?.questions[0].prompt, "Pregunta 45");
    assert.equal(paper?.title, "Repaso de errores");
  });

  it("hides the button label when the pile is empty", () => {
    assert.equal(mistakeButtonLabel(0), null);
    assert.equal(mistakeButtonLabel(4), "Repasar errores (4)");
    assert.equal(reviewPaper([]), null);
  });

  it("keeps a written question that could not be regraded", () => {
    const saved = foldMistakes([], [written(1)], [{ given: "x", verdict: "incorrecta" }], 1000);
    const kept = foldMistakes(saved, [written(1)], [{ given: "y" }], 9000);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].savedAt, saved[0].savedAt);
  });
});
