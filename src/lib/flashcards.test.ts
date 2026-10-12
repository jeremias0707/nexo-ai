import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStudyDeck } from "./cards.ts";
import {
  addChatCards,
  BACK_MAX,
  cardsFromAnswer,
  parseQaPairs,
  sanitizeChatCards,
} from "./flashcards.ts";

describe("flashcards from chat", () => {
  it("uses P:/R: pairs when the tutor wrote them", () => {
    const md =
      "P: ¿Qué es la mitosis?\nR: Una división celular que da 2 células iguales.\n\nP: ¿Dónde ocurre?\nR: En células somáticas.";
    assert.deepEqual(parseQaPairs(md), [
      { front: "¿Qué es la mitosis?", back: "Una división celular que da 2 células iguales." },
      { front: "¿Dónde ocurre?", back: "En células somáticas." },
    ]);
    assert.equal(cardsFromAnswer(md).length, 2);
  });

  it("turns bold definitions and 'término: definición' items into cards", () => {
    const md = [
      "La fotosíntesis tiene dos fases.",
      "",
      "- **Fase luminosa**: ocurre en los tilacoides y produce ATP.",
      "- **Ciclo de Calvin**: fija el CO₂ y arma glucosa.",
      "- Clorofila: pigmento verde que capta la luz.",
      "",
      "**Importante** recordar que las plantas también respiran.",
    ].join("\n");
    const cards = cardsFromAnswer(md, "fotosíntesis");
    const fronts = cards.map((c) => c.front);
    assert.ok(fronts.includes("¿Qué es fase luminosa?"));
    assert.ok(fronts.includes("¿Qué es Ciclo de Calvin?"));
    assert.ok(fronts.includes("Clorofila"));
    assert.ok(!fronts.some((f) => f.includes("Importante")));
    assert.match(cards.find((c) => c.front === "Clorofila")!.back, /pigmento verde/);
  });

  it("finds 'X es Y' sentences and numbered procedures, skipping diagrams", () => {
    const md = [
      "La mitosis es una división celular que produce dos células hijas idénticas.",
      "",
      "```mermaid",
      "flowchart TD",
      '  A["Profase"] --> B["Metafase"]',
      "```",
      "",
      "1. Profase: se condensa el ADN.",
      "2. Metafase: los cromosomas se alinean.",
      "3. Anafase: se separan las cromátidas.",
    ].join("\n");
    const cards = cardsFromAnswer(md, "Fases de la mitosis");
    assert.ok(cards.some((c) => c.front === "¿Qué es mitosis?"));
    assert.ok(cards.every((c) => !c.back.includes("flowchart")));
    assert.ok(cards.some((c) => c.front === "Profase" || c.front.startsWith("Pasos:")));
  });

  it("keeps one card per idea and only the first paragraph under a heading", () => {
    const cards = cardsFromAnswer(
      "## La célula\n\nLa **célula** es la unidad básica de la vida.\n\n- **Núcleo**: guarda el ADN con la información genética.\n\nLa fotosíntesis es el proceso por el que las plantas fabrican glucosa con luz.",
      "Explicame la célula",
    );
    const fronts = cards.map((c) => c.front);
    assert.deepEqual(fronts, ["La célula", "¿Qué es núcleo?", "¿Qué es fotosíntesis?"]);
    assert.equal(cards[0].back, "La célula es la unidad básica de la vida.");
  });

  it("falls back to the question and a short summary", () => {
    const cards = cardsFromAnswer(
      "Depende del contexto. Primero mirá el enunciado. Después decidí.",
      "¿Cómo encaro un problema?",
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0].front, "¿Cómo encaro un problema?");
    assert.deepEqual(cardsFromAnswer("", ""), []);
  });

  it("caps the number and length of cards", () => {
    const md = Array.from(
      { length: 20 },
      (_, i) => `- Término ${i}: definición número ${i} bastante larga ${"x".repeat(600)}`,
    ).join("\n");
    const cards = cardsFromAnswer(md, "", 8);
    assert.equal(cards.length, 8);
    assert.ok(cards.every((c) => c.back.length <= BACK_MAX));
  });

  it("adds cards newest first, replaces same fronts and sanitizes storage", () => {
    let n = 0;
    const id = () => `c${++n}`;
    const first = addChatCards(
      [],
      [
        { front: "A", back: "uno" },
        { front: "B", back: "dos" },
      ],
      "Tema",
      1,
      id,
    );
    assert.equal(first.added, 2);
    const second = addChatCards(first.list, [{ front: "a", back: "uno nuevo" }], "Tema", 2, id);
    assert.equal(second.list.length, 2);
    assert.equal(second.list[0].back, "uno nuevo");
    assert.deepEqual(
      sanitizeChatCards([{ id: "x", front: "F", back: "B", at: "no" }, { nope: 1 }, "x"]),
      [{ id: "x", front: "F", back: "B", at: 0, source: "" }],
    );
  });

  it("puts chat cards in the study deck, unknown first, with filters", () => {
    const chat = [
      { id: "chat:1", front: "A", back: "uno" },
      { id: "chat:2", front: "B", back: "dos" },
    ];
    const favs = [{ id: "f1", q: "¿Q?", a: "Respuesta", at: 1 }];
    const deck = buildStudyDeck(chat, favs, [], ["chat:1"]);
    assert.deepEqual(
      deck.map((c) => c.id),
      ["chat:2", "fav:f1", "chat:1"],
    );
    assert.deepEqual(
      buildStudyDeck(chat, favs, [], [], "chat").map((c) => c.from),
      ["chat", "chat"],
    );
    assert.equal(buildStudyDeck(chat, favs, [], [], "error").length, 0);
  });
});
