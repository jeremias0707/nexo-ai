import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blocksToText,
  cleanFormula,
  exportFileName,
  markdownToPlain,
  summaryBlocks,
} from "./export-summary.ts";
import { blocksToPdf, textWidth, toWinAnsi, wrapEncoded } from "./pdf.ts";

describe("export summary", () => {
  it("turns markdown into readable text", () => {
    const md =
      "## Título\n\n**Negrita** y *cursiva* con $x^2$.\n\n- uno\n- dos\n\n```mermaid\nflowchart TD\n```\n\n[fuente](https://ejemplo.com)";
    const plain = markdownToPlain(md);
    assert.ok(plain.includes("Título"));
    assert.ok(plain.includes("Negrita y cursiva con x^2."));
    assert.ok(plain.includes("• uno"));
    assert.ok(plain.includes("[Diagrama: miralo en la app]"));
    assert.ok(plain.includes("fuente (https://ejemplo.com)"));
    assert.ok(!plain.includes("**"));
  });

  it("makes formulas readable", () => {
    assert.equal(cleanFormula("6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6"), "6CO2 + 6H2O → C6H12O6");
    assert.equal(cleanFormula("\\frac{a}{b} \\cdot x^{2}"), "(a)/(b) · x^2");
    assert.equal(cleanFormula("v = \\sqrt{2gh}"), "v = √(2gh)");
  });

  it("builds sections only for what exists", () => {
    const empty = blocksToText(summaryBlocks({ date: "5/10/2026" }));
    assert.match(empty, /Todavía no hay nada para resumir/);
    const text = blocksToText(
      summaryBlocks({
        date: "5/10/2026",
        nick: "Jere",
        goal: { goal: 10, todayMinutes: 12, streak: 3, best: 5, weekMinutes: 70 },
        plan: {
          subject: "Bio",
          examDayText: "viernes 9/10",
          done: 1,
          total: 2,
          days: [
            {
              label: "Lun 5/10",
              tasks: [
                { title: "Entender: Célula", done: true },
                { title: "Fichas", done: false },
              ],
            },
          ],
        },
        exams: [{ day: "2026-10-04", topic: "Célula", nota: "8", count: 10 }],
        cards: [{ front: "¿Qué es ADN?", back: "Molécula de la herencia." }],
        conversation: {
          title: "Mitosis",
          messages: [
            { role: "user", content: "¿Qué es la mitosis?" },
            { role: "assistant", content: "Es una **división** celular." },
          ],
        },
      }),
    );
    assert.match(text, /RESUMEN DE ESTUDIO/);
    assert.match(text, /Racha de estudio: 3 días/);
    assert.match(text, /\[x\] Entender: Célula/);
    assert.match(text, /\[ \] Fichas/);
    assert.match(text, /nota 8\/10/);
    assert.match(text, /¿Qué es ADN\? → Molécula/);
    assert.match(text, /Pregunta: ¿Qué es la mitosis\?/);
    assert.match(text, /Es una división celular\./);
    assert.equal(exportFileName("2026-10-05", "pdf"), "nexo-resumen-2026-10-05.pdf");
    assert.equal(exportFileName("x", "txt"), "nexo-resumen-hoy.txt");
  });
});

describe("pdf writer", () => {
  it("encodes Spanish text in WinAnsi and replaces the rest", () => {
    const enc = toWinAnsi("¿Qué? ñandú «hola» – x² ≤ 3 √2 😀");
    assert.equal(enc.charCodeAt(0), 0xbf);
    assert.ok(enc.includes("ñandú"));
    assert.ok(enc.includes(String.fromCharCode(0x96)));
    assert.ok(enc.includes("<= 3"));
    assert.ok(enc.endsWith("?"));
    for (let i = 0; i < enc.length; i += 1) assert.ok(enc.charCodeAt(i) < 256);
  });

  it("wraps lines inside the width", () => {
    const enc = toWinAnsi("palabra ".repeat(80).trim());
    const lines = wrapEncoded(enc, 11, 200);
    assert.ok(lines.length > 5);
    for (const line of lines) assert.ok(textWidth(line, 11) <= 200);
    const long = wrapEncoded("x".repeat(500), 11, 100);
    for (const line of long) assert.ok(textWidth(line, 11) <= 100);
  });

  it("writes a valid PDF with a correct xref table", () => {
    const blocks = summaryBlocks({
      date: "5/10/2026",
      conversation: {
        title: "Largo",
        messages: Array.from({ length: 30 }, (_, i) => ({
          role: (i % 2 ? "assistant" : "user") as "assistant" | "user",
          content: `Mensaje ${i} (con paréntesis) y \\ barra. ${"texto ".repeat(60)}`,
        })),
      },
    });
    const bytes = blocksToPdf(blocks, "Resumen (prueba)");
    const text = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.ok(text.trimEnd().endsWith("%%EOF"));
    const count = Number(/\/Count (\d+)/.exec(text)?.[1]);
    assert.ok(count >= 2, "multi-page");
    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    assert.ok(text.slice(startxref).startsWith("xref"));
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    entries.forEach((offset, i) =>
      assert.ok(text.slice(offset).startsWith(`${i + 1} 0 obj`), `obj ${i + 1}`),
    );
    // Stream lengths match.
    for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = (m.index ?? 0) + m[0].length;
      assert.equal(text.slice(start + Number(m[1]), start + Number(m[1]) + 10), "\nendstream");
    }
    assert.ok(text.includes("\\(con par"));
  });
});
