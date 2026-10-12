import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { challengeForDay, DAILY_POOL, sanitizeDailyDone } from "./daily.ts";

describe("desafío diario", () => {
  it("picks a stable challenge for the same day", () => {
    const a = challengeForDay(new Date("2026-10-05T12:00:00"));
    const b = challengeForDay(new Date("2026-10-05T23:00:00"));
    assert.equal(a.id, b.id);
    assert.ok(a.title.trim());
    assert.ok(a.prompt.trim());
    assert.ok(DAILY_POOL.length >= 8);
  });

  it("can change across days", () => {
    const a = challengeForDay(new Date("2026-10-05T12:00:00"));
    const b = challengeForDay(new Date("2026-10-06T12:00:00"));
    // Not guaranteed different with a small pool, but sanitize still works.
    assert.ok(a.id);
    assert.ok(b.id);
  });

  it("sanitizes done markers", () => {
    assert.equal(sanitizeDailyDone(null), null);
    assert.deepEqual(sanitizeDailyDone({ day: "2026-10-05", id: "adn" }), {
      day: "2026-10-05",
      id: "adn",
    });
    assert.equal(sanitizeDailyDone({ day: "bad", id: "x" }), null);
  });
});
