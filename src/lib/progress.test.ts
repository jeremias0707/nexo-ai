import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyActivity,
  bumpStreak,
  DAILY,
  dayKey,
  daysBetween,
  detectSubjects,
  emptyProgress,
  levelFor,
  liveStreak,
  MEDALS,
  medalProgress,
  sanitizeProgress,
  XP,
} from "./progress.ts";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("calendar days", () => {
  it("uses the local day, not UTC", () => {
    assert.equal(dayKey(at(2026, 3, 9, 23, 59)), "2026-03-09");
    assert.equal(dayKey(at(2026, 3, 10, 0, 0)), "2026-03-10");
  });
  it("counts days across months, years and DST changes", () => {
    assert.equal(daysBetween("2026-01-31", "2026-02-01"), 1);
    assert.equal(daysBetween("2025-12-31", "2026-01-01"), 1);
    assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
    assert.equal(daysBetween("2026-10-31", "2026-11-02"), 2);
    assert.equal(daysBetween("2026-05-02", "2026-05-01"), -1);
  });
});

describe("streak", () => {
  it("starts, keeps on the same day, grows next day and resets after a gap", () => {
    let s = bumpStreak({ current: 0, best: 0, last: null }, "2026-09-01");
    assert.deepEqual(s, { current: 1, best: 1, last: "2026-09-01" });
    s = bumpStreak(s, "2026-09-01");
    assert.equal(s.current, 1);
    s = bumpStreak(s, "2026-09-02");
    s = bumpStreak(s, "2026-09-03");
    assert.equal(s.current, 3);
    s = bumpStreak(s, "2026-09-05");
    assert.deepEqual(s, { current: 1, best: 3, last: "2026-09-05" });
  });
  it("ignores a clock moved backwards", () => {
    const s = { current: 4, best: 4, last: "2026-09-10" };
    assert.equal(bumpStreak(s, "2026-09-08"), s);
  });
  it("shows 0 once a whole day was skipped", () => {
    const s = { current: 5, best: 9, last: "2026-09-10" };
    assert.equal(liveStreak(s, "2026-09-10"), 5);
    assert.equal(liveStreak(s, "2026-09-11"), 5);
    assert.equal(liveStreak(s, "2026-09-12"), 0);
  });
  it("crossing midnight counts as the next day", () => {
    let p = applyActivity(
      emptyProgress(),
      { kind: "question", text: "hola" },
      at(2026, 9, 1, 23, 58),
    ).progress;
    p = applyActivity(p, { kind: "question", text: "hola" }, at(2026, 9, 2, 0, 3)).progress;
    assert.equal(p.streak.current, 2);
  });
});

describe("levels", () => {
  it("maps XP to named levels", () => {
    assert.equal(levelFor(0).name, "Novato");
    assert.equal(levelFor(340).level, 3);
    assert.equal(levelFor(340).name, "Aprendiz");
    assert.equal(levelFor(340).missing, 160);
    assert.equal(levelFor(3700).name, "Estratega");
    const top = levelFor(99_999);
    assert.equal(top.name, "Leyenda");
    assert.equal(top.next, null);
    assert.equal(top.ratio, 1);
  });
});

describe("applyActivity", () => {
  it("gives XP for questions, photos and PDFs with daily caps", () => {
    let p = emptyProgress();
    const day = at(2026, 9, 1, 15);
    let total = 0;
    for (let i = 0; i < DAILY.questions + 5; i += 1) {
      const r = applyActivity(p, { kind: "question", text: "x" }, day);
      total += r.earned;
      p = r.progress;
    }
    assert.equal(total, DAILY.questions * XP.question);
    const photo = applyActivity(p, { kind: "question", text: "x", photo: true }, day);
    assert.equal(photo.earned, XP.photo); // question part capped, photo not yet
    const nextDay = applyActivity(
      photo.progress,
      { kind: "question", text: "x" },
      at(2026, 9, 2, 9),
    );
    assert.equal(nextDay.earned, XP.question);
  });
  it("unlocks medals once, with bonus XP", () => {
    const first = applyActivity(
      emptyProgress(),
      { kind: "question", text: "¿Qué es la fotosíntesis?" },
      at(2026, 9, 1, 15),
    );
    assert.deepEqual(
      first.unlocked.map((u) => u.id),
      ["primera-mision"],
    );
    assert.equal(first.gained, XP.question + XP.medal);
    const again = applyActivity(
      first.progress,
      { kind: "question", text: "otra" },
      at(2026, 9, 1, 16),
    );
    assert.equal(again.unlocked.length, 0);
    assert.equal(again.progress.stats.subjects.includes("biologia"), true);
  });
  it("detects night study and photos/PDF medals", () => {
    const r = applyActivity(
      emptyProgress(),
      { kind: "question", text: "x", photo: true, pdf: true },
      at(2026, 9, 1, 23, 30),
    );
    assert.deepEqual(r.unlocked.map((u) => u.id).sort(), [
      "nocturno",
      "primer-pdf",
      "primera-foto",
      "primera-mision",
    ]);
  });
  it("records exams, caps exam XP per day and reports level ups", () => {
    let p = emptyProgress();
    const exam = {
      kind: "exam" as const,
      topic: "Revolución de Mayo",
      source: "tema" as const,
      difficulty: "media" as const,
      count: 10,
      correct: 10,
      nota: 10,
      xp: 150,
    };
    const r1 = applyActivity(p, exam, at(2026, 9, 1, 10));
    assert.equal(r1.earned, 150);
    assert.ok(r1.unlocked.some((u) => u.id === "examen-perfecto"));
    assert.ok(r1.levelUp);
    p = r1.progress;
    p = applyActivity(p, exam, at(2026, 9, 1, 11)).progress;
    p = applyActivity(p, exam, at(2026, 9, 1, 12)).progress;
    const r4 = applyActivity(p, exam, at(2026, 9, 1, 13));
    assert.equal(r4.earned, 0);
    assert.equal(r4.progress.exams.length, 4);
    assert.equal(r4.progress.exams[0].xp, 0);
    assert.equal(r4.progress.stats.passed, 4);
    assert.ok(r4.progress.stats.subjects.includes("historia"));
  });
});

describe("medals and storage", () => {
  it("has unique ids and reports progress", () => {
    assert.equal(new Set(MEDALS.map((m) => m.id)).size, MEDALS.length);
    const p = emptyProgress();
    p.streak.best = 5;
    const streak7 = MEDALS.find((m) => m.id === "racha-7")!;
    assert.deepEqual(medalProgress(streak7, p), {
      value: 5,
      target: 7,
      ratio: 5 / 7,
      unlocked: false,
    });
  });
  it("repairs broken storage", () => {
    const p = sanitizeProgress({
      xp: -5,
      streak: { current: 3, best: 1, last: "bad" },
      medals: { fake: 1, "racha-7": 10 },
      stats: { subjects: ["historia", "nope", 3] },
    });
    assert.equal(p.xp, 0);
    assert.deepEqual(p.streak, { current: 3, best: 3, last: null });
    assert.deepEqual(Object.keys(p.medals), ["racha-7"]);
    assert.deepEqual(p.stats.subjects, ["historia"]);
    assert.deepEqual(sanitizeProgress(null), emptyProgress());
  });
  it("detects subjects without accents or case", () => {
    assert.deepEqual(detectSubjects("Explicame la FOTOSINTESIS"), ["biologia"]);
    assert.deepEqual(detectSubjects("resolver la ecuación y la Revolución de Mayo"), [
      "matematica",
      "historia",
    ]);
    assert.deepEqual(detectSubjects("hola"), []);
  });
});
