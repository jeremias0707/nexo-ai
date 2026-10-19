import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { systemPrompt } from "./tutor.server.ts";
import {
  explainAddon,
  mobileShortAddon,
  replyAddon,
  isOralReply,
  sanitizeExplain,
  sanitizeReply,
  sanitizeSettings,
} from "./settings.ts";

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
    assert.deepEqual(
      sanitizeSettings({ theme: "claro", text: "grande", explain: "simple", reply: "pasos" }),
      {
        theme: "claro",
        text: "grande",
        explain: "simple",
        reply: "pasos",
      },
    );
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
    assert.match(simple, /4–6 líneas|4-6 líneas|párrafo corto/);
    assert.match(deep, /límites/);
    assert.match(deep, /error típico/);
    assert.match(simple, /No lo sabes todo/);
    assert.match(deep, /Diagramas y gráficos/);
    assert.match(base, /Menos inventos/);
  });

  it("reply addon is empty for normal and short otherwise", () => {
    const base = systemPrompt();
    assert.equal(replyAddon("normal"), "");
    assert.equal(replyAddon(undefined), "");
    assert.equal(sanitizeReply("nope"), "normal");
    assert.equal(sanitizeReply("guiado"), "guiado");
    for (const mode of ["pasos", "preguntas", "examen", "guiado"] as const) {
      const full = base + replyAddon(mode);
      assert.ok(full.startsWith(base));
      assert.notEqual(replyAddon(mode), "");
      assert.equal(full.includes("nickname"), false);
    }
    assert.match(replyAddon("pasos"), /pasos numerados/);
    assert.match(replyAddon("preguntas"), /una sola pregunta/);
    assert.match(replyAddon("examen"), /examen/);
    assert.match(replyAddon("guiado"), /estudio guiado|socrático/);
  });

  it("mobile short addon skips fondo and empty when not mobile", () => {
    assert.equal(mobileShortAddon(false, "normal"), "");
    assert.equal(mobileShortAddon(true, "fondo"), "");
    assert.match(mobileShortAddon(true, "normal"), /pantalla chica|cortas/);
    assert.match(mobileShortAddon(true, "simple"), /celular/);
  });

  it("2.6 modo oral: oral and profe modes add their own instruction", () => {
    assert.equal(sanitizeReply("oral"), "oral");
    assert.equal(sanitizeReply("profe"), "profe");
    assert.match(replyAddon("oral"), /examen oral/);
    assert.match(replyAddon("oral"), /Te pueden repreguntar/);
    assert.match(replyAddon("profe"), /UNA sola pregunta/);
    assert.match(replyAddon("profe"), /«Bien», «A medias» o «Mal»/);
    assert.equal(isOralReply("profe"), true);
    assert.equal(isOralReply("guiado"), false);
    assert.equal(sanitizeSettings({ reply: "profe" }).reply, "profe");
  });
});
