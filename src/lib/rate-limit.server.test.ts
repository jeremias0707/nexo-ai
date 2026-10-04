import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import {
  DAILY_CHAT_MAX,
  DAILY_EXAM_MAX,
  MAX_HITS,
  WINDOW_MS,
  clientIp,
  resetRateLimitMemoryForTests,
  runIfWithinQuota,
  setRateLimitNowForTests,
  setRateLimitQueryForTests,
  tooManyRequests,
} from "./rate-limit.server.ts";

const IP = "203.0.113.20";
const DB = "postgres://rate-limit-test.invalid/nexo";

function vercelRequest(headers: Record<string, string>) {
  return new Request("https://nexo.test/api/chat", { method: "POST", headers });
}

describe("AI quota", { concurrency: false }, () => {
  const original = {
    DATABASE_URL: process.env.DATABASE_URL,
    VERCEL: process.env.VERCEL,
  };

  afterEach(() => {
    setRateLimitQueryForTests(null);
    setRateLimitNowForTests(null);
    resetRateLimitMemoryForTests();
    if (original.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original.DATABASE_URL;
    if (original.VERCEL === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = original.VERCEL;
  });

  it("ignores a spoofed X-Forwarded-For and uses only the Vercel platform IP", async () => {
    process.env.VERCEL = "1";
    const shared = "203.0.113.44";
    const a = clientIp(
      vercelRequest({
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": shared,
      }),
    );
    const b = clientIp(
      vercelRequest({
        "x-forwarded-for": "8.8.8.8, 1.1.1.1",
        "x-vercel-forwarded-for": `${shared}, 10.0.0.8`,
      }),
    );
    assert.equal(a, shared);
    assert.equal(b, shared);
    assert.equal(clientIp(vercelRequest({ "x-forwarded-for": "1.2.3.4" })), null);
    assert.equal(clientIp(vercelRequest({ "x-real-ip": "203.0.113.9" })), null);
    assert.equal(
      clientIp(vercelRequest({ "x-vercel-forwarded-for": "not-an-ip" })),
      null,
    );

    // Off Vercel (this Grok host), a client-supplied platform header is not trusted.
    delete process.env.VERCEL;
    assert.equal(
      clientIp(
        vercelRequest({
          "x-forwarded-for": "1.2.3.4",
          "x-vercel-forwarded-for": shared,
        }),
      ),
      null,
    );

    process.env.VERCEL = "1";
    process.env.DATABASE_URL = DB;
    const keys: unknown[] = [];
    setRateLimitQueryForTests(async (_text, params) => {
      keys.push(params?.[0]);
      return [{ recent: 0, day_n: 0 }];
    });
    let calls = 0;
    const model = async () => {
      calls += 1;
      return new Response("model");
    };
    const first = await runIfWithinQuota(
      vercelRequest({ "x-forwarded-for": "1.2.3.4", "x-vercel-forwarded-for": shared }),
      { message: "limit" },
      model,
    );
    const second = await runIfWithinQuota(
      vercelRequest({ "x-forwarded-for": "9.9.9.9", "x-vercel-forwarded-for": shared }),
      { message: "limit" },
      model,
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(calls, 2);
    assert.equal(keys[0], keys[1]);

    let spoofCalled = false;
    const spoofed = await runIfWithinQuota(
      vercelRequest({ "x-forwarded-for": "1.2.3.4" }),
      { message: "limit" },
      async () => {
        spoofCalled = true;
        return new Response("model");
      },
    );
    assert.equal(spoofed.status, 429);
    assert.equal(spoofCalled, false);
    assert.equal(keys.length, 2);
  });

  it("returns 429 and does not call the model when the DB check fails", async () => {
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = DB;
    setRateLimitQueryForTests(async () => {
      throw new Error("connection refused");
    });
    let called = false;
    const res = await runIfWithinQuota(
      vercelRequest({ "x-forwarded-for": "1.2.3.4", "x-vercel-forwarded-for": IP }),
      { bucket: "chat", message: "limit" },
      async () => {
        called = true;
        return new Response("model");
      },
    );
    assert.equal(res.status, 429);
    assert.equal(called, false);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "limit");
  });

  it("returns 429 and does not call the model when the DB module cannot be loaded", async () => {
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = DB;
    setRateLimitQueryForTests(null);
    let called = false;
    const res = await runIfWithinQuota(
      vercelRequest({ "x-forwarded-for": "8.8.8.8", "x-vercel-forwarded-for": IP }),
      { message: "limit" },
      async () => {
        called = true;
        return new Response("model");
      },
    );
    assert.equal(res.status, 429);
    assert.equal(called, false);
  });

  it("returns 429 and does not call the model when the DB check times out", async () => {
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = DB;
    setRateLimitQueryForTests(() => new Promise(() => {}));
    let called = false;
    const started = Date.now();
    const res = await runIfWithinQuota(
      vercelRequest({ "x-vercel-forwarded-for": IP }),
      { message: "limit" },
      async () => {
        called = true;
        return new Response("model");
      },
    );
    assert.equal(res.status, 429);
    assert.equal(called, false);
    assert.ok(Date.now() - started >= 1_400);
  });

  it("does not open the quota when DATABASE_URL is missing", async () => {
    process.env.VERCEL = "1";
    delete process.env.DATABASE_URL;
    let queries = 0;
    setRateLimitQueryForTests(async () => {
      queries += 1;
      return [{ recent: 0, day_n: 0 }];
    });
    let called = false;
    const res = await runIfWithinQuota(
      vercelRequest({ "x-vercel-forwarded-for": IP, "x-forwarded-for": "1.2.3.4" }),
      { message: "limit" },
      async () => {
        called = true;
        return new Response("model");
      },
    );
    assert.equal(res.status, 429);
    assert.equal(called, false);
    assert.equal(queries, 0);
    assert.equal(await tooManyRequests(IP, 1, "chat"), true);
    assert.equal(await tooManyRequests(IP, 3, "exam"), true);
  });

  it("fails closed on this host when there is no platform IP, even if a DB is configured", async () => {
    delete process.env.VERCEL;
    process.env.DATABASE_URL = DB;
    let queries = 0;
    setRateLimitQueryForTests(async () => {
      queries += 1;
      return [{ recent: 0, day_n: 0 }];
    });
    let called = false;
    const res = await runIfWithinQuota(
      vercelRequest({
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": IP,
      }),
      { message: "limit" },
      async () => {
        called = true;
        return new Response("model");
      },
    );
    assert.equal(res.status, 429);
    assert.equal(called, false);
    assert.equal(queries, 0);
  });

  it("caps chats at 40/day and exams at 5/day, and grading does not take an exam", async () => {
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = DB;
    let params: unknown[] = [];
    const script = { recent: 0, day_n: 0 };
    setRateLimitQueryForTests(async (_text, next) => {
      params = next ?? [];
      return [{ recent: script.recent, day_n: script.day_n }];
    });

    assert.equal(DAILY_CHAT_MAX, 40);
    assert.equal(DAILY_EXAM_MAX, 5);

    script.day_n = 39;
    assert.equal(await tooManyRequests(IP, 1, "chat"), false);
    assert.equal(params[3], 1);
    assert.equal(params[6], 40);
    assert.equal(params[7], 1);
    const chatDay = params[4];

    script.day_n = 40;
    assert.equal(await tooManyRequests(IP, 1, "chat"), true);

    script.day_n = 5;
    assert.equal(await tooManyRequests(IP, 1, "grade"), false);
    assert.equal(params[4], chatDay);
    assert.equal(params[6], 40);

    script.day_n = 4;
    assert.equal(await tooManyRequests(IP, 3, "exam"), false);
    assert.equal(params[3], 3);
    assert.equal(params[6], 5);
    assert.equal(params[7], 1);
    const examDay = params[4];
    assert.notEqual(examDay, chatDay);

    script.day_n = 5;
    assert.equal(await tooManyRequests(IP, 3, "exam"), true);

    script.recent = MAX_HITS;
    script.day_n = 0;
    assert.equal(await tooManyRequests(IP, 1, "chat"), true);
  });


  it("on the Grok host allows calls until the in-memory daily cap, and a spoofed X-Forwarded-For adds no quota", async () => {
    delete process.env.VERCEL;
    delete process.env.DATABASE_URL;
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("xAI must not be called");
    };
    try {
      let now = 1_700_000_000_000;
      setRateLimitNowForTests(() => now);
      let queries = 0;
      setRateLimitQueryForTests(async () => {
        queries += 1;
        return [{ recent: 0, day_n: 0 }];
      });

      let chats = 0;
      const chat = (xff: string) =>
        runIfWithinQuota(
          vercelRequest({ "x-forwarded-for": xff, "x-vercel-forwarded-for": IP }),
          { bucket: "chat", message: "limit" },
          async () => {
            chats += 1;
            return new Response("model");
          },
        );

      for (let i = 0; i < MAX_HITS; i++) {
        const res = await chat(`10.0.0.${i}`);
        assert.equal(res.status, 200);
      }
      const minuteBlocked = await chat("1.1.1.1");
      assert.equal(minuteBlocked.status, 429);
      assert.equal(chats, MAX_HITS);
      const minuteBody = (await minuteBlocked.json()) as { error: string };
      assert.equal(minuteBody.error, "limit");

      while (chats < DAILY_CHAT_MAX) {
        now += WINDOW_MS + 1;
        const res = await chat(`203.0.113.${chats}`);
        assert.equal(res.status, 200);
      }
      now += WINDOW_MS + 1;
      let spoofCalled = false;
      const spoofed = await runIfWithinQuota(
        vercelRequest({ "x-forwarded-for": "8.8.8.8", "x-vercel-forwarded-for": "198.51.100.9" }),
        { bucket: "chat", message: "limit" },
        async () => {
          spoofCalled = true;
          return new Response("model");
        },
      );
      assert.equal(spoofed.status, 429);
      assert.equal(spoofCalled, false);
      assert.equal(chats, DAILY_CHAT_MAX);

      let gradeCalled = false;
      const grade = await runIfWithinQuota(
        vercelRequest({ "x-forwarded-for": "9.9.9.9" }),
        { bucket: "grade", message: "limit" },
        async () => {
          gradeCalled = true;
          return new Response("grade");
        },
      );
      assert.equal(grade.status, 429);
      assert.equal(gradeCalled, false);

      let exams = 0;
      for (let i = 0; i < DAILY_EXAM_MAX; i++) {
        now += WINDOW_MS + 1;
        const res = await runIfWithinQuota(
          vercelRequest({ "x-forwarded-for": `198.51.100.${i}` }),
          { bucket: "exam", weight: 3, message: "limit" },
          async () => {
            exams += 1;
            return new Response("exam");
          },
        );
        assert.equal(res.status, 200);
      }
      now += WINDOW_MS + 1;
      let examSpoofCalled = false;
      const examBlocked = await runIfWithinQuota(
        vercelRequest({ "x-forwarded-for": "203.0.113.200" }),
        { bucket: "exam", weight: 3, message: "limit" },
        async () => {
          examSpoofCalled = true;
          return new Response("exam");
        },
      );
      assert.equal(examBlocked.status, 429);
      assert.equal(examSpoofCalled, false);
      assert.equal(exams, DAILY_EXAM_MAX);
      assert.equal(queries, 0);
      assert.equal(fetchCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not read X-Forwarded-For from the AI routes", () => {
    for (const file of ["chat.ts", "exam.ts", "exam-grade.ts"]) {
      const src = readFileSync(new URL(`../routes/api/${file}`, import.meta.url), "utf8");
      assert.equal(src.includes("x-forwarded-for"), false, file);
      assert.equal(src.includes("runIfWithinQuota"), true, file);
    }
    const exam = readFileSync(new URL("../routes/api/exam.ts", import.meta.url), "utf8");
    assert.match(exam, /bucket:\s*"exam"/);
    assert.match(exam, /weight:\s*EXAM_WEIGHT/);
    const grade = readFileSync(new URL("../routes/api/exam-grade.ts", import.meta.url), "utf8");
    assert.match(grade, /bucket:\s*"grade"/);
    const xai = readFileSync(new URL("./xai.server.ts", import.meta.url), "utf8");
    assert.equal(xai.includes("x-forwarded-for"), false);
    const status = readFileSync(new URL("../routes/api/status.ts", import.meta.url), "utf8");
    assert.equal(status.includes("rate-limit"), false);
    assert.match(status, /online:\s*Boolean\(process\.env\.XAI_API_KEY\)/);
  });
});
