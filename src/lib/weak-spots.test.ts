import { test } from "node:test";
import assert from "node:assert/strict";
import { applyWeak, roundEvents, saysConfused, pickRound, roundTopic } from "./weak-spots.ts";

test("misses raise, hits lower and drop", () => {
  let l = applyWeak(
    [],
    [{ subject: "mate", topic: "Ecuaciones", delta: 2, source: "examen", sample: "2x+3=11" }],
    1,
  );
  assert.equal(l.length, 1);
  assert.equal(l[0].weight, 2);
  l = applyWeak(l, [{ subject: "mate", topic: "ecuaciones", delta: 1, source: "ficha" }], 2);
  assert.equal(l[0].weight, 3);
  assert.deepEqual(l[0].from, ["examen", "ficha"]);
  l = applyWeak(l, roundEvents(l, 4, 1), 3);
  assert.equal(l.length, 0);
});

test("lowering an unknown topic does nothing", () => {
  assert.equal(
    applyWeak([], [{ subject: "", topic: "Algo", delta: -1, source: "examen" }], 1).length,
    0,
  );
});

test("confusion detection", () => {
  assert.ok(saysConfused("No entendí"));
  assert.ok(saysConfused("che no me quedó claro"));
  assert.ok(!saysConfused("Entendí todo, gracias"));
});

test("round picks heaviest and builds topic", () => {
  const l = applyWeak(
    [],
    [
      { subject: "mate", topic: "Fracciones", delta: 1, source: "chat" },
      { subject: "histo", topic: "Revolución de Mayo", delta: 5, source: "examen" },
    ],
    1,
  );
  const r = pickRound(l, 1);
  assert.equal(r[0].topic, "Revolución de Mayo");
  assert.match(roundTopic(r), /Historia · Revolución de Mayo/);
});
