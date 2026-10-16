import { test } from "node:test";
import assert from "node:assert/strict";
import { capsLine, chatsUnlimited, currentCaps, FREE_CAPS } from "./access-constants.ts";

const BEFORE = Date.parse("2026-11-13T23:59:59-03:00");
const AT = Date.parse("2026-11-14T00:00:00-03:00");

test("unlimited chats before Nov 14 00:00 Buenos Aires, cap back after", () => {
  assert.equal(chatsUnlimited(BEFORE), true);
  assert.equal(chatsUnlimited(AT), false);
  // 00:00 in Buenos Aires is 03:00 UTC.
  assert.equal(chatsUnlimited(Date.parse("2026-11-14T03:00:00Z")), false);
  assert.equal(chatsUnlimited(Date.parse("2026-11-14T02:59:59Z")), true);
});

test("status caps", () => {
  const before = currentCaps(BEFORE);
  assert.equal(before.chats, null);
  assert.equal(before.exams, 5);
  assert.equal(before.perMinute, 12);
  assert.equal(before.unlimitedUntil, "2026-11-14T00:00:00-03:00");
  const after = currentCaps(AT);
  assert.equal(after.chats, FREE_CAPS.chats);
  assert.equal(after.chats, 40);
  assert.equal(after.unlimitedUntil, undefined);
});

test("UI line", () => {
  assert.match(capsLine(BEFORE), /sin límite hasta el 14 de noviembre/);
  assert.match(capsLine(AT), /40 chats y 5 exámenes/);
});
