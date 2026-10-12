import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasUncertainty } from "./uncertain.ts";
import { systemPrompt } from "./tutor.server.ts";

describe("uncertainty (2.7)", () => {
  it("detects the marker line the prompt asks for", () => {
    assert.equal(hasUncertainty("No estoy seguro: el año exacto."), true);
    assert.equal(hasUncertainty("La Revolución fue en 1810.\n\n**No estoy segura:** del día."), true);
    assert.equal(hasUncertainty("> No estoy seguro: chequealo."), true);
  });

  it("ignores normal answers", () => {
    assert.equal(hasUncertainty("La mitosis tiene 4 fases."), false);
    assert.equal(hasUncertainty("Si no estoy seguro de algo, lo digo."), false);
  });

  it("the tutor prompt asks for the marker and forbids invented pages and sources", () => {
    const prompt = systemPrompt();
    assert.ok(prompt.includes('"No estoy seguro:"'));
    assert.ok(prompt.includes("nunca la calcules ni la adivines"));
    assert.ok(prompt.includes("no las inventes"));
    assert.ok(prompt.includes("(esto no está en tu apunte)"));
  });
});
