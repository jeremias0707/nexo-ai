import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareAiPrompt,
  compareWithNotes,
  numbersIn,
  passagesOf,
  plainAnswer,
  stem,
} from "./compare.ts";

const DOC = `[Página 1]
La Revolución de Mayo ocurrió en 1810 en Buenos Aires. El 25 de mayo se formó la Primera Junta de gobierno, presidida por Cornelio Saavedra.

[Página 2]
La Independencia se declaró en Tucumán el 9 de julio de 1816. El Congreso reunió diputados de varias provincias.`;

describe("compare with notes", () => {
  it("stems plurals and accents together", () => {
    assert.equal(stem("Provincias"), stem("provincia"));
    assert.equal(stem("Revolución"), stem("revolucion"));
    assert.deepEqual(numbersIn("En 1810 y 3,5 km"), ["1810", "3.5"]);
  });

  it("keeps the page of every passage", () => {
    const passages = passagesOf(DOC);
    assert.ok(passages.length >= 3);
    assert.equal(passages[0].page, 1);
    assert.equal(passages.at(-1)?.page, 2);
  });

  it("marks matching, different and missing sentences", () => {
    const answer =
      "La Primera Junta se formó el 25 de mayo de 1810 en Buenos Aires. La Independencia se declaró en Tucumán en 1820. Belgrano creó la bandera en Rosario.";
    const result = compareWithNotes(answer, DOC);
    const [first, second, third] = result.sentences;
    assert.equal(first.status, "coincide");
    assert.equal(first.page, 1);
    // Right idea, wrong year → partial, with the numbers that differ.
    assert.equal(second.status, "parcial");
    assert.deepEqual(second.numberDiff?.yours, ["1820"]);
    assert.ok(second.numberDiff?.notes.includes("1816"));
    assert.equal(second.page, 2);
    // Not in the notes at all.
    assert.equal(third.status, "no-esta");
    assert.ok(third.unknown.includes("belgrano"));
    assert.deepEqual(result.counts, { coincide: 1, parcial: 1, noEsta: 1 });
    assert.ok(result.coverage > 0 && result.coverage < 1);
    // Words of the matched pages the answer never used.
    const missing = result.missing.map((m) => m.word);
    assert.ok(missing.includes("saavedra") || missing.includes("congreso"));
  });

  it("ignores very short sentences and markdown", () => {
    const result = compareWithNotes("**Sí.** La Primera Junta se formó en 1810 (pág. 1).", DOC);
    assert.equal(result.sentences[0].status, "corta");
    assert.equal(result.sentences[1].status, "coincide");
    assert.equal(plainAnswer("## Hola **mundo** (pág. 3)"), "Hola mundo");
  });

  it("builds a bounded AI prompt", () => {
    const prompt = compareAiPrompt("x".repeat(10_000), "apunte.pdf");
    assert.match(prompt, /«apunte\.pdf»/);
    assert.ok(prompt.length < 4200);
  });
});
