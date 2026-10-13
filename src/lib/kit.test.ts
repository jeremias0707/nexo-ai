import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKitRequest, cleanDiagram, parseKit } from "./kit.ts";

test("parse kit", () => {
  const r = parseKit(
    JSON.stringify({
      title: "Célula",
      summary: ["a", ""],
      cards: [
        { front: "¿Q?", back: "R" },
        { front: "", back: "x" },
      ],
      diagram: "```mermaid\nflowchart TD\nA-->B\n```",
    }),
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.kit.summary.length, 1);
    assert.equal(r.kit.cards.length, 1);
    assert.equal(r.kit.diagram, "flowchart TD\nA-->B");
  }
});
test("refusal", () => {
  const r = parseKit({ title: "No se lee", summary: [], cards: [], diagram: "" });
  assert.ok(!r.ok);
});
test("diagram filter", () => assert.equal(cleanDiagram("<script>"), ""));
test("request", () => {
  assert.ok(!checkKitRequest({}).ok);
  assert.ok(!checkKitRequest({ images: ["a", "b", "c", "d"] }).ok);
});
