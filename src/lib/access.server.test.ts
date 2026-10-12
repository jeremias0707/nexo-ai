import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  GLOBAL_CHAT_MAX,
  MAX_DEVICES_PER_DAY,
  accessGateRequired,
  accessReady,
  globalBudgetAllows,
  redeemAccessCode,
  requireDeviceAccess,
  resetAccessMemoryForTests,
  setAccessNowForTests,
  verifyDeviceToken,
} from "./access.server.ts";

describe("Stage A access gate", { concurrency: false }, () => {
  const original = {
    NEXO_ACCESS_CODE: process.env.NEXO_ACCESS_CODE,
    GROK_PROJECT_ID: process.env.GROK_PROJECT_ID,
  };

  afterEach(() => {
    resetAccessMemoryForTests();
    setAccessNowForTests(null);
    for (const key of ["NEXO_ACCESS_CODE", "GROK_PROJECT_ID"] as const) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("soft-redeems in preview without a configured code", async () => {
    delete process.env.GROK_PROJECT_ID;
    delete process.env.NEXO_ACCESS_CODE;
    assert.equal(accessGateRequired(), false);
    assert.equal(accessReady(), true);
    const result = await redeemAccessCode("");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const key = await verifyDeviceToken(result.token);
    assert.ok(key);
  });

  it("rejects wrong code when NEXO_ACCESS_CODE is set", async () => {
    delete process.env.GROK_PROJECT_ID;
    process.env.NEXO_ACCESS_CODE = "nexo-secreto";
    const bad = await redeemAccessCode("otro");
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.equal(bad.status, 401);
    const good = await redeemAccessCode("nexo-secreto");
    assert.equal(good.ok, true);
  });

  it("requires a device token on costly routes", async () => {
    delete process.env.GROK_PROJECT_ID;
    process.env.NEXO_ACCESS_CODE = "nexo-secreto";
    const denied = await requireDeviceAccess(new Request("https://nexo.test/api/chat", { method: "POST" }));
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.response.status, 401);

    const minted = await redeemAccessCode("nexo-secreto");
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    const allowed = await requireDeviceAccess(
      new Request("https://nexo.test/api/chat", {
        method: "POST",
        headers: { "x-nexo-device": minted.token },
      }),
    );
    assert.equal(allowed.ok, true);
  });

  it("caps device mints per day", async () => {
    delete process.env.GROK_PROJECT_ID;
    process.env.NEXO_ACCESS_CODE = "nexo-secreto";
    let now = 1_700_000_000_000;
    setAccessNowForTests(() => now);
    for (let i = 0; i < MAX_DEVICES_PER_DAY; i++) {
      const result = await redeemAccessCode("nexo-secreto");
      assert.equal(result.ok, true, `mint ${i}`);
    }
    const over = await redeemAccessCode("nexo-secreto");
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.status, 429);
  });

  it("enforces a process-wide soft ceiling", () => {
    let now = 1_700_000_000_000;
    setAccessNowForTests(() => now);
    for (let i = 0; i < GLOBAL_CHAT_MAX; i++) {
      assert.equal(globalBudgetAllows("chat"), true);
    }
    assert.equal(globalBudgetAllows("chat"), false);
  });

  it("soft-redeems on published Grok host without access code env", async () => {
    process.env.GROK_PROJECT_ID = "proj-test";
    delete process.env.NEXO_ACCESS_CODE;
    assert.equal(accessGateRequired(), true);
    assert.equal(accessReady(), true);
    const result = await redeemAccessCode("cualquier");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const key = await verifyDeviceToken(result.token);
    assert.ok(key);
  });
});
