import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  formatClassCode,
  GROUP_BANK,
  groupChallenge,
  groupShareText,
  newClassCode,
  normalizeClassCode,
  sanitizeGroupState,
  scoreGroup,
} from "./group.ts";
import {
  acceptableDay,
  GROUP_HITS_PER_MINUTE,
  groupRateAllows,
  groupStats,
  recordGroupScore,
  resetGroupMemoryForTests,
  setGroupNowForTests,
} from "./group.server.ts";

describe("group mode (local)", () => {
  it("normalizes class codes", () => {
    assert.equal(normalizeClassCode(" 3ro-b ñ2 "), "3ROBN2");
    assert.equal(normalizeClassCode("ab"), null);
    assert.equal(normalizeClassCode("A".repeat(11)), null);
    assert.equal(normalizeClassCode(42), null);
    assert.match(newClassCode(), /^[A-Z2-9]{6}$/);
    assert.equal(formatClassCode("ABC123"), "ABC-123");
    assert.equal(formatClassCode("3BBIO"), "3BBIO");
    assert.equal(formatClassCode("ABCD"), "ABCD");
  });

  it("gives the same 3 questions to the same code and day", () => {
    const a = groupChallenge("ABC123", "2026-10-05");
    const b = groupChallenge("ABC123", "2026-10-05");
    assert.deepEqual(a, b);
    assert.equal(a.questions.length, 3);
    assert.equal(new Set(a.questions.map((q) => q.subject)).size, 3);
    const other = groupChallenge("ABC123", "2026-10-06");
    assert.notDeepEqual(
      a.questions.map((q) => q.id),
      other.questions.map((q) => q.id),
    );
  });

  it("keeps every bank question valid and the right answer findable", () => {
    const ids = new Set<string>();
    for (const item of GROUP_BANK) {
      assert.ok(!ids.has(item.id), item.id);
      ids.add(item.id);
      assert.equal(new Set([item.right, ...item.wrong]).size, 4, item.id);
      assert.ok(item.why.length > 10);
    }
    for (let d = 1; d <= 28; d += 1) {
      const day = `2026-02-${String(d).padStart(2, "0")}`;
      for (const q of groupChallenge("CLASE1", day).questions) {
        const item = GROUP_BANK.find((b) => b.id === q.id)!;
        assert.equal(q.options[q.answer], item.right);
      }
    }
  });

  it("scores, shares and sanitizes", () => {
    const { questions } = groupChallenge("ABC123", "2026-10-05");
    assert.equal(
      scoreGroup(
        questions,
        questions.map((q) => q.answer),
      ),
      3,
    );
    assert.equal(scoreGroup(questions, [null, null, null]), 0);
    assert.match(groupShareText("ABC123", "lunes 5/10", 2, 3), /ABC-123.*2\/3/);
    const state = sanitizeGroupState({
      code: "abc123",
      results: { "2026-10-05": { code: "ABC123", answers: [1, 9, "x"], correct: 7 }, bad: {} },
    });
    assert.deepEqual(state, {
      code: "ABC123",
      results: { "2026-10-05": { code: "ABC123", answers: [1, null, null], correct: 3 } },
    });
  });
});

describe("group mode (server counter)", () => {
  afterEach(() => {
    resetGroupMemoryForTests();
    setGroupNowForTests(null);
  });

  it("accepts only today ±1 day", () => {
    setGroupNowForTests(() => Date.UTC(2026, 9, 5, 12));
    assert.equal(acceptableDay("2026-10-05"), true);
    assert.equal(acceptableDay("2026-10-04"), true);
    assert.equal(acceptableDay("2026-10-07"), false);
    assert.equal(acceptableDay("hoy"), false);
  });

  it("counts each device once per class and day (first try counts)", () => {
    assert.deepEqual(groupStats("k", "2026-10-05"), { done: 0, perfect: 0, average: null });
    recordGroupScore("k", "2026-10-05", "dev1", 3);
    recordGroupScore("k", "2026-10-05", "dev2", 1);
    recordGroupScore("k", "2026-10-05", "dev2", 2);
    recordGroupScore("k", "2026-10-05", "dev3", 99);
    assert.deepEqual(groupStats("k", "2026-10-05"), { done: 3, perfect: 2, average: 2.3 });
    assert.equal(groupStats("other", "2026-10-05").done, 0);
  });

  it("forgets old days when a new board is made", () => {
    setGroupNowForTests(() => Date.UTC(2026, 9, 5, 15));
    recordGroupScore("k", "2026-10-05", "dev1", 2);
    assert.equal(groupStats("k", "2026-10-05").done, 1);
    setGroupNowForTests(() => Date.UTC(2026, 9, 8, 15));
    recordGroupScore("k", "2026-10-08", "dev1", 3);
    assert.equal(groupStats("k", "2026-10-05").done, 0);
    assert.equal(groupStats("k", "2026-10-08").done, 1);
  });

  it("rate limits per device", () => {
    setGroupNowForTests(() => 1_000_000);
    for (let i = 0; i < GROUP_HITS_PER_MINUTE; i += 1) assert.equal(groupRateAllows("d"), true);
    assert.equal(groupRateAllows("d"), false);
    assert.equal(groupRateAllows("e"), true);
    setGroupNowForTests(() => 1_000_000 + 61_000);
    assert.equal(groupRateAllows("d"), true);
  });
});
