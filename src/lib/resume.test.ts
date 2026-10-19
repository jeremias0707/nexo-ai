import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lastQuestion, lastThread, recentThreads, subjectStarter, timeAgo } from "./resume.ts";

const t = (id: string, updatedAt: number, answered = true) => ({
  id,
  title: id,
  updatedAt,
  messages: [
    { role: "user" as const, content: `pregunta ${id}` },
    { role: "assistant" as const, content: answered ? "respuesta" : "" },
  ],
});

describe("seguir donde quedaste (2.7)", () => {
  it("picks the most recent answered conversation", () => {
    const list = [t("a", 1), t("b", 3), t("c", 5, false)];
    assert.equal(lastThread(list)?.id, "b");
    assert.deepEqual(
      recentThreads(list).map((x) => x.id),
      ["b", "a"],
    );
    assert.equal(lastThread([]), null);
  });

  it("formats time in Spanish", () => {
    const now = 10 * 86_400_000;
    assert.equal(timeAgo(now - 30_000, now), "recién");
    assert.equal(timeAgo(now - 5 * 60_000, now), "hace 5 min");
    assert.equal(timeAgo(now - 3 * 3_600_000, now), "hace 3 h");
    assert.equal(timeAgo(now - 86_400_000, now), "ayer");
    assert.equal(timeAgo(now - 4 * 86_400_000, now), "hace 4 días");
  });

  it("shows the last question and a subject starter", () => {
    assert.equal(lastQuestion(t("x", 1)), "pregunta x");
    assert.equal(subjectStarter("histo"), "Historia: ");
    assert.equal(subjectStarter(""), "");
  });
});
