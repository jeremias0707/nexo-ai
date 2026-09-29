import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MISSIONS, MISSIONS_SHOWN, pickMissions } from "./missions.ts";

describe("missions", () => {
  it("has a large pool with unique names across subjects", () => {
    assert.ok(MISSIONS.length >= 40 && MISSIONS.length <= 60);
    assert.equal(new Set(MISSIONS.map((m) => m.name)).size, MISSIONS.length);
    assert.ok(new Set(MISSIONS.map((m) => m.subject)).size >= 10);
    for (const m of MISSIONS) assert.ok(m.prompt.length > 10 && m.prompt.length < 200);
  });
  it("picks 6 distinct missions from different subjects", () => {
    const set = pickMissions();
    assert.equal(set.length, MISSIONS_SHOWN);
    assert.equal(new Set(set.map((m) => m.subject)).size, MISSIONS_SHOWN);
  });
  it("never repeats the previous set", () => {
    let previous: string[] = [];
    for (let i = 0; i < 50; i += 1) {
      const set = pickMissions(previous).map((m) => m.name);
      assert.ok(set.every((name) => !previous.includes(name)));
      previous = set;
    }
  });
  it("still works with a tiny pool", () => {
    const pool = MISSIONS.slice(0, 7);
    const set = pickMissions(
      pool.slice(0, 6).map((m) => m.name),
      Math.random,
      pool,
    );
    assert.equal(set.length, 6);
  });
});
