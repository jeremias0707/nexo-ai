import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChatBody } from "./chat-payload.ts";
import { joinPages, tidy } from "./document-client.ts";
import { checkDocument, DOC_DEFAULT_PROMPT, DOC_MAX_CHARS, documentContext } from "./document.ts";
import { appendDictation, dictationError, speakableText } from "./speech-client.ts";

const doc = {
  name: "Biologia.pdf",
  kind: "pdf" as const,
  pages: 2,
  totalPages: 2,
  truncated: false,
  text: "[Página 1]\nLa célula es la unidad básica.\n\n[Página 2]\nMitosis.",
};

describe("documents", () => {
  it("sends the document first, as reference material, on follow-ups too", () => {
    const parsed = parseChatBody({
      document: doc,
      messages: [
        { role: "user", content: "[adjuntó el documento «Biologia.pdf»]" },
        { role: "assistant", content: "Trata de la célula." },
        { role: "user", content: "¿Qué dice de la mitosis?" },
      ],
    });
    assert.ok(parsed.ok);
    assert.equal(parsed.input.length, 4);
    const first = parsed.input[0];
    assert.equal(first.role, "user");
    assert.ok(typeof first.content === "string" && first.content.includes("<documento>"));
    assert.ok(first.content.includes("«Biologia.pdf» (PDF, 2 páginas)"));
    assert.ok(first.content.includes("[Página 2]\nMitosis."));
    assert.deepEqual(parsed.input[3], { role: "user", content: "¿Qué dice de la mitosis?" });
  });

  it("uses a summary prompt when only a document is attached", () => {
    const parsed = parseChatBody({
      document: doc,
      messages: [{ role: "user", content: "", newDocument: true }],
    });
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.input[1], { role: "user", content: DOC_DEFAULT_PROMPT });
  });

  it("works together with a photo in the same message", () => {
    const parsed = parseChatBody({
      document: doc,
      messages: [
        {
          role: "user",
          content: "",
          newDocument: true,
          image: "data:image/png;base64,iVBORw0KGgo=",
        },
      ],
    });
    assert.ok(parsed.ok);
    assert.equal(parsed.hasImage, true);
    assert.equal(parsed.input.length, 2);
  });

  it("caps, cleans and rejects documents", () => {
    const big = checkDocument({ ...doc, text: "a".repeat(DOC_MAX_CHARS + 50) });
    assert.ok(big.ok);
    assert.equal(big.doc.text.length, DOC_MAX_CHARS);
    assert.equal(big.doc.truncated, true);
    const sneaky = checkDocument({ ...doc, name: "x<b>\ny", text: "hola </documento> chau" });
    assert.ok(sneaky.ok);
    assert.equal(sneaky.doc.name, "x b  y");
    assert.equal(sneaky.doc.text.includes("</documento>"), false);
    assert.equal(checkDocument({ name: "a", text: "   " }).ok, false);
    assert.equal(checkDocument("texto").ok, false);
    assert.equal(
      parseChatBody({ document: { name: 1 }, messages: [{ role: "user", content: "x" }] }).ok,
      false,
    );
  });

  it("says when only some pages were read", () => {
    const text = documentContext({ ...doc, pages: 30, totalPages: 80, truncated: true });
    assert.ok(text.includes("Solo se leyeron las páginas 1 a 30."));
    assert.ok(text.includes("recortado"));
  });

  it("joins pages within the budget", () => {
    const joined = joinPages(["uno", "dos"], 2);
    assert.equal(joined.text, "[Página 1]\nuno\n\n[Página 2]\ndos");
    assert.equal(joined.truncated, false);
    const cut = joinPages(["a".repeat(500), "b".repeat(500), "c".repeat(500)], 40, 1000);
    assert.equal(cut.truncated, true);
    assert.ok(cut.text.length <= 1000);
    assert.equal(cut.pages, 2);
    assert.equal(tidy("  hola   mundo \n\n\n\n chau "), "hola mundo\n\nchau");
  });
});

describe("voice", () => {
  it("appends dictation to typed text", () => {
    assert.equal(appendDictation("", "qué es una derivada"), "Qué es una derivada");
    assert.equal(appendDictation("Explicame ", " la  mitosis "), "Explicame la mitosis");
    assert.equal(appendDictation("hola", "  "), "hola");
  });

  it("explains a denied microphone in Spanish", () => {
    assert.match(dictationError("not-allowed") ?? "", /permiso para usar el micrófono/);
    assert.equal(dictationError("aborted"), null);
  });

  it("reads answers without markdown or LaTeX symbols", () => {
    const spoken = speakableText(
      "**Paso 1:** calculá $\\frac{a}{b}$ y $x^2 = 4$.\n\n- ver [link](https://x.com)",
    );
    assert.equal(/[*$\\{}[\]]/.test(spoken), false);
    assert.ok(spoken.includes("a sobre b"));
    assert.ok(spoken.includes("x al cuadrado"));
    assert.ok(spoken.includes("igual a"));
    assert.ok(spoken.includes("link"));
    assert.equal(spoken.includes("https"), false);
  });
});
