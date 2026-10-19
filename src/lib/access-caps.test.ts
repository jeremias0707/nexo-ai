import { test } from "node:test";
import assert from "node:assert/strict";
import { capsLine, currentCaps } from "./access-constants.ts";

test("3.0.2 caps: no daily chat cap, 5 exams, 12 per minute", () => {
  const caps = currentCaps() as Record<string, unknown>;
  assert.equal(caps.chats, null);
  assert.equal(caps.exams, 5);
  assert.equal(caps.perMinute, 12);
  assert.equal("unlimitedUntil" in caps, false);
  assert.match(capsLine(), /chats sin límite y 5 exámenes por día/);
});
