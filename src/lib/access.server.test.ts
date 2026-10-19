import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  GLOBAL_CHAT_MAX,
  GLOBAL_EXAM_MAX,
  accessPublicStatus,
  deviceKeyFor,
  globalBudgetAllows,
  issueDeviceId,
  requireDeviceAccess,
  resetAccessMemoryForTests,
  setAccessNowForTests,
} from "./access.server.ts";

describe("3.0.2: open access (no code)", { concurrency: false }, () => {
  afterEach(() => {
    resetAccessMemoryForTests();
    setAccessNowForTests(null);
  });

  it("costly routes never ask for a token", async () => {
    const none = await requireDeviceAccess(
      new Request("https://nexo.test/api/chat", { method: "POST" }),
    );
    assert.equal(none.ok, true);
    const withId = await requireDeviceAccess(
      new Request("https://nexo.test/api/chat", {
        method: "POST",
        headers: { "x-nexo-device": "abcdef0123456789abcdef" },
      }),
    );
    assert.equal(withId.ok, true);
    if (withId.ok) assert.equal(withId.deviceKey.length, 64);
  });

  it("device id: same id → same key, junk → shared bucket", async () => {
    const a = await deviceKeyFor("abcdef0123456789abcdef");
    assert.equal(a, await deviceKeyFor("abcdef0123456789abcdef"));
    assert.equal(await deviceKeyFor("short"), null);
    assert.equal(await deviceKeyFor("bad id with spaces 1234567"), null);
  });

  it("/api/access compatibility hands out a random id, no code involved", () => {
    const one = issueDeviceId();
    const two = issueDeviceId();
    assert.ok(one.token.length >= 32);
    assert.notEqual(one.token, two.token);
    assert.equal(one.caps.chats, null);
  });

  it("status says no access required and chats unlimited", () => {
    const status = accessPublicStatus();
    assert.equal(status.accessRequired, false);
    assert.equal(status.caps.chats, null);
    assert.equal(status.caps.exams, 5);
  });

  it("keeps the global safety caps", () => {
    for (let i = 0; i < GLOBAL_CHAT_MAX; i++) assert.equal(globalBudgetAllows("chat"), true);
    assert.equal(globalBudgetAllows("chat"), false);
    for (let i = 0; i < GLOBAL_EXAM_MAX; i++) assert.equal(globalBudgetAllows("exam"), true);
    assert.equal(globalBudgetAllows("exam"), false);
  });
});
