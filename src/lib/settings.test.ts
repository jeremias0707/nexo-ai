import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { systemPrompt } from "./tutor.server.ts";
import { explainAddon, sanitizeExplain, sanitizeSettings } from "./settings.ts";

describe("settings", () => {
  it("defaults to oscuro, normal and normal", () => {
    assert.deepEqual(sanitizeSettings(undefined), {
      theme: "oscuro",
      text: "normal",
      explain: "normal",
    });
    assert.deepEqual(sanitizeSettings({ theme: "nope", text: 3, explain: "" }), {
      theme: "oscuro",
      text: "normal",
      explain: "normal",
    });
  });

  it("keeps the three choices", () => {
    assert.deepEqual(sanitizeSettings({ theme: "claro", text: "grande", explain: "simple" }), {
      theme: "claro",
      text: "grande",
      explain: "simple",
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
});
