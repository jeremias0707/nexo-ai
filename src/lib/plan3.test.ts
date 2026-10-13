import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, EMPTY_PLAN, snapshot, toggleDone, type PlanState } from "./plan3.ts";

const plan: PlanState = {
  ...EMPTY_PLAN,
  minutes: 45,
  exams: [
    {
      id: "a",
      subject: "Matemática",
      date: "2026-10-20",
      topics: ["Ecuaciones", "Funciones", "Fracciones"],
    },
    { id: "b", subject: "Historia", date: "2026-10-27", topics: [] },
  ],
};

test("plan reaches each exam with final and practice exam", () => {
  const s = buildSchedule(plan, "2026-10-13");
  assert.equal(s.days[0].day, "2026-10-13");
  assert.equal(s.days[s.days.length - 1].day, "2026-10-26");
  const d19 = s.days.find((d) => d.day === "2026-10-19")!;
  assert.ok(d19.tasks.some((t) => t.key === "a:final"));
  const d18 = s.days.find((d) => d.day === "2026-10-18")!;
  assert.ok(d18.tasks.some((t) => t.key === "a:examen"));
  assert.ok(s.days.every((d) => d.tasks.length >= 1));
  // every unit of exam a is scheduled before its date
  const keysA = s.days
    .filter((d) => d.day < "2026-10-20")
    .flatMap((d) => d.tasks.map((t) => t.key));
  for (const k of ["a:aprender:0", "a:aprender:1", "a:aprender:2", "a:errores"])
    assert.ok(keysA.includes(k), k);
});

test("missed tasks are re-planned from today", () => {
  const s1 = buildSchedule(plan, "2026-10-13");
  let p = snapshot(plan, s1, "2026-10-13");
  const first = s1.days[0].tasks[0].key;
  const second = s1.days[0].tasks[1].key;
  p = toggleDone(p, first);
  const s2 = buildSchedule(p, "2026-10-14");
  const keys = s2.days.flatMap((d) => d.tasks.map((t) => t.key));
  assert.ok(!keys.includes(first));
  assert.ok(keys.includes(second));
  assert.ok(s2.missed >= 1);
});

test("checking a task off keeps today's list", () => {
  const s1 = buildSchedule(plan, "2026-10-13");
  let p = snapshot(plan, s1, "2026-10-13");
  p = toggleDone(p, s1.days[0].tasks[0].key);
  const s2 = buildSchedule(p, "2026-10-13");
  assert.deepEqual(
    s2.days[0].tasks.map((t) => t.key),
    s1.days[0].tasks.map((t) => t.key),
  );
  const later = s2.days.slice(1).flatMap((d) => d.tasks.map((t) => t.key));
  for (const t of s1.days[0].tasks) assert.ok(!later.includes(t.key));
});
