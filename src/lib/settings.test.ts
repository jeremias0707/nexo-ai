import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { systemPrompt } from "./tutor.server.ts";
import { explainAddon, replyAddon, sanitizeExplain, sanitizeReply, sanitizeSettings } from "./settings.ts";

describe("settings", () => {
  it("defaults to oscuro, normal and normal", () => {
    assert.deepEqual(sanitizeSettings(undefined), {
      theme: "oscuro",
      text: "normal",
      explain: "normal",
      reply: "normal",
    });
    assert.deepEqual(sanitizeSettings({ theme: "nope", text: 3, explain: "", reply: "largo" }), {
      theme: "oscuro",
      text: "normal",
      explain: "normal",
      reply: "normal",
    });
  });

  it("keeps the three choices", () => {
    assert.deepEqual(sanitizeSettings({ theme: "claro", text: "grande", explain: "simple", reply: "pasos" }), {
      theme: "claro",
      text: "grande",
      explain: "simple",
      reply: "pasos",
    });
    assert.equal(sanitizeExplain("fondo"), "fondo");
    assert.equal(sanitizeExplain("a fondo"), "normal");
  });

  it("adds a short instruction without dropping the tutor rules", () => {
    const base = systemPrompt();
    assert.equal(explainAddon("normal"), "");
    assert.equal(explainAddon(undefined), "");
    const simple = base + explainAddon("simple");
    const deep = base + explainAddon("fondo");
    assert.ok(simple.startsWith(base));
    assert.ok(deep.startsWith(base));
    assert.match(simple, /frases cortas/);
    assert.match(simple, /videojuego/);
    assert.match(deep, /límites/);
    assert.match(deep, /error típico/);
    assert.match(simple, /No lo sabes todo/);
    assert.match(deep, /Diagramas y gráficos/);
  });

  it("reply addon is empty for normal and short otherwise", () => {
    const base = systemPrompt();
    assert.equal(replyAddon("normal"), "");
    assert.equal(replyAddon(undefined), "");
    assert.equal(sanitizeReply("nope"), "normal");
    for (const mode of ["pasos", "preguntas", "examen"] as const) {
      const full = base + replyAddon(mode);
      assert.ok(full.startsWith(base));
      assert.notEqual(replyAddon(mode), "");
      assert.equal(full.includes("nickname"), false);
    }
    assert.match(replyAddon("pasos"), /pasos numerados/);
    assert.match(replyAddon("preguntas"), /una sola pregunta/);
    assert.match(replyAddon("examen"), /examen/);
  });
});
