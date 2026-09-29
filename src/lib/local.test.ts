import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyReview, buildDeck } from "./cards.ts";
import { sanitizeFavorites, toggleFavorite } from "./favorites.ts";
import { nickCounts, sanitizeAvatar, sanitizeNick } from "./profile.ts";
import { applyActivity, emptyProgress, MEDALS, XP } from "./progress.ts";
import { missionFor, shareLines, touchWeek, type WeekProgress } from "./week.ts";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("profile", () => {
  it("defaults the nickname and ignores junk photos", () => {
    assert.equal(sanitizeNick("   "), "Vos");
    assert.equal(sanitizeNick("  Jere  "), "Jere");
    assert.equal(nickCounts("Vos"), false);
    assert.equal(nickCounts("Jere"), true);
    assert.equal(sanitizeAvatar("https://x"), null);
    assert.equal(sanitizeAvatar("data:image/png;base64,aaaa"), null);
    const jpeg = `data:image/jpeg;base64,${"A".repeat(40)}`;
    assert.equal(sanitizeAvatar(jpeg), jpeg);
  });
});

describe("favorites", () => {
  it("stars and unstars without growing forever", () => {
    const item = { id: "a", q: "qué es", a: "una idea", at: 1 };
    const added = toggleFavorite([], item);
    assert.equal(added.added, true);
    assert.equal(added.list.length, 1);
    const removed = toggleFavorite(added.list, item);
    assert.equal(removed.added, false);
    assert.equal(removed.list.length, 0);
    assert.equal(sanitizeFavorites([{ id: "x", q: 1 }]).length, 0);
  });
});

describe("cards", () => {
  it("builds a deck from a favorite and counts a card once", () => {
    const deck = buildDeck([{ id: "m1", q: "pregunta", a: "respuesta", at: 1 }], []);
    assert.equal(deck.length, 1);
    assert.equal(deck[0].front, "pregunta");
    assert.equal(deck[0].back, "respuesta");
    const first = applyReview([], deck[0].id, true);
    assert.equal(first.first, true);
    const again = applyReview(first.known, deck[0].id, true);
    assert.equal(again.first, false);
    const lost = applyReview(again.known, deck[0].id, false);
    assert.deepEqual(lost.known, []);
  });
});

describe("week", () => {
  it("uses one mission for the whole Monday-Sunday week", () => {
    const mon = missionFor(at(2026, 9, 28));
    const sun = missionFor(at(2026, 10, 4));
    assert.equal(mon.weekId, sun.weekId);
    assert.equal(missionFor(at(2026, 10, 5)).weekId === mon.weekId, false);
  });
  it("finishes only when the counter reaches the need", () => {
    const start: WeekProgress = { weekId: "", n: 0, done: false };
    const date = at(2026, 9, 28);
    const mission = missionFor(date);
    let state = start;
    let done = false;
    for (let i = 0; i < mission.need; i += 1) {
      const step = touchWeek(state, date, mission.kind);
      state = step.progress;
      done = step.justDone;
    }
    assert.equal(done, true);
    assert.equal(state.done, true);
    const extra = touchWeek(state, date, mission.kind);
    assert.equal(extra.justDone, false);
    const lines = shareLines({
      level: 2,
      levelName: "Curioso",
      streak: 1,
      medal: "Apodo",
      mission: mission.title,
    });
    assert.equal(lines[0], "NEXO AI");
    assert.match(lines[2], /1 día/);
    assert.match(lines[3], /Apodo/);
  });
});

describe("local medals", () => {
  it("unlocks from marks without a model and pays the weekly challenge once", () => {
    let p = emptyProgress();
    const now = at(2026, 9, 29);
    const photo = applyActivity(p, { kind: "mark", mark: "photo" }, now);
    assert.ok(photo.unlocked.some((u) => u.id === "foto-perfil"));
    p = photo.progress;
    const again = applyActivity(p, { kind: "mark", mark: "photo" }, now);
    assert.equal(again.unlocked.length, 0);
    const week = applyActivity(again.progress, { kind: "mark", mark: "week" }, now);
    assert.equal(week.earned, XP.challenge);
    assert.ok(week.unlocked.some((u) => u.id === "desafio-semana"));
    assert.equal(new Set(MEDALS.map((m) => m.id)).size, MEDALS.length);
    assert.ok(MEDALS.length > 13);
  });
});
