/**
 * Rate limit for /api/chat, /api/exam and /api/exam-grade.
 *
 * Minute window: MAX_HITS accepted requests per WINDOW_MS (an exam counts as
 * several). Rolling daily cap:
 *   - 40 chats/day
 *   - 5 exams/day
 *   - /api/exam-grade does not add a second exam; it counts as one chat so a
 *     correction cannot bypass the daily chat cap.
 *
 * Durable path (DATABASE_URL set): hits live in `chat_rate_hits`
 * (migrations/0002_chat_rate_limit.sql), keyed by a trustworthy platform IP.
 * Minute rows and daily rows use different hashes of the same IP, so the raw IP
 * is never stored. Rows are kept for two days, then pruned. If that check
 * fails or times out, the expensive call is rejected (the route returns 429).
 *
 * Grok host (VERCEL unset and no DATABASE_URL): there is no platform IP and no
 * shared store. A best-effort in-memory cap still applies the same minute
 * window and daily budgets so the app stays up. See `tooManyInMemory`.
 * On Vercel without DATABASE_URL the call still fails closed: a per-instance
 * map would not be the shared limit that host is supposed to enforce.
 *
 * `@/lib/db` is imported lazily and only when DATABASE_URL is set: importing it
 * without one eagerly boots PGLite, which the production bundle cannot load.
 */
import { isIP } from "node:net";

export const WINDOW_MS = 60_000;
export const MAX_HITS = 12;
/** Free tier: 40 chats/day, rolling 24h, shared only via the database. */
export const DAILY_CHAT_MAX = 40;
/** Free tier: 5 exam generations/day. Grading does not consume one of these. */
export const DAILY_EXAM_MAX = 5;
const DAY_SECONDS = 24 * 60 * 60;
const RETAIN_SECONDS = 2 * DAY_SECONDS;
const DB_TIMEOUT_MS = 1_500;
const PRUNE_EVERY = 50;

export type RateBucket = "chat" | "exam" | "grade";

type Query = (text: string, params?: unknown[]) => Promise<{ recent: number; day_n: number }[]>;

/** Test seam. Production never sets this; the real check uses getSql(). */
let queryOverride: Query | null = null;

export function setRateLimitQueryForTests(query: Query | null) {
  queryOverride = query;
}

/**
 * Client IP for the shared database quota.
 *
 * `x-forwarded-for` is ignored: the client can set it. On Vercel (VERCEL=1)
 * the only platform address used is `x-vercel-forwarded-for`. This Grok host
 * does not set that, so the result is null. The in-memory cap does not key
 * off this value or off any client-supplied header.
 */
export function clientIp(request: Request): string | null {
  if (process.env.VERCEL !== "1") return null;
  const header = request.headers.get("x-vercel-forwarded-for");
  if (!header) return null;
  const first = header.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 64 || isIP(first) === 0) return null;
  return first;
}

let calls = 0;
let warned = false;

type MemoryScope = "minute" | "chat" | "exam";
type MemoryHit = { at: number; scope: MemoryScope };

/**
 * Best-effort cap for the Grok host only (no VERCEL, no DATABASE_URL).
 * One bucket for the whole process: there is no trustworthy client IP, and
 * a client-supplied X-Forwarded-For is not a key, so spoofing it does not
 * add quota. This cap resets if the server restarts and is not shared across
 * instances, so it is NOT a hard billing cap.
 */
let memoryHits: MemoryHit[] = [];
let nowForTests: (() => number) | null = null;

export function setRateLimitNowForTests(now: (() => number) | null) {
  nowForTests = now;
}

export function resetRateLimitMemoryForTests() {
  memoryHits = [];
}

function nowMs() {
  return nowForTests ? nowForTests() : Date.now();
}

function tooManyInMemory(weight: number, bucket: RateBucket) {
  const now = nowMs();
  const dayCutoff = now - DAY_SECONDS * 1000;
  memoryHits = memoryHits.filter((hit) => hit.at > dayCutoff);
  const daily = dailyBudget(bucket);
  const recent = memoryHits.filter(
    (hit) => hit.scope === "minute" && hit.at > now - WINDOW_MS,
  ).length;
  const dayN = memoryHits.filter((hit) => hit.scope === daily.scope).length;
  if (recent + weight > MAX_HITS || dayN + 1 > daily.max) return true;
  for (let i = 0; i < weight; i++) memoryHits.push({ at: now, scope: "minute" });
  memoryHits.push({ at: now, scope: daily.scope });
  return false;
}

async function hashKey(material: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function dailyBudget(bucket: RateBucket) {
  // Grade shares the chat cap and does not touch the exam cap.
  if (bucket === "exam") return { scope: "exam" as const, max: DAILY_EXAM_MAX };
  return { scope: "chat" as const, max: DAILY_CHAT_MAX };
}

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? "";
}

async function loadQuery(): Promise<Query> {
  if (queryOverride) return queryOverride;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  return (text, params) => sql.query<{ recent: number; day_n: number }>(text, params);
}

async function tooManyInDb(ip: string, weight: number, bucket: RateBucket) {
  const query = await loadQuery();
  const minuteKey = await hashKey(`nexo:${ip}`);
  const daily = dailyBudget(bucket);
  const dayKey = await hashKey(`nexo:day:${daily.scope}:${ip}`);
  const dayInc = 1;
  // Count the window and the daily bucket, and record this request only if
  // both still have room. Rejected requests are not recorded.
  const rows = await query(
    `with recent as (
       select count(*)::int as n from chat_rate_hits
       where client_key = $1 and hit_at > now() - make_interval(secs => $2)
     ), dayc as (
       select count(*)::int as n from chat_rate_hits
       where client_key = $5 and hit_at > now() - make_interval(secs => $6)
     ), ins_m as (
       insert into chat_rate_hits (client_key)
       select $1 from generate_series(1, $4::int)
       where (select n from recent) + $4::int <= $3
         and (select n from dayc) + $8::int <= $7
       returning 1
     ), ins_d as (
       insert into chat_rate_hits (client_key)
       select $5 from generate_series(1, $8::int)
       where (select n from recent) + $4::int <= $3
         and (select n from dayc) + $8::int <= $7
       returning 1
     )
     select (select n from recent) as recent,
            (select n from dayc) as day_n,
            (select count(*)::int from ins_m) as inserted_m,
            (select count(*)::int from ins_d) as inserted_d`,
    [minuteKey, WINDOW_MS / 1000, MAX_HITS, weight, dayKey, DAY_SECONDS, daily.max, dayInc],
  );
  calls += 1;
  if (calls % PRUNE_EVERY === 0) {
    void query("delete from chat_rate_hits where hit_at < now() - make_interval(secs => $1)", [
      RETAIN_SECONDS,
    ]).catch(() => undefined);
  }
  const row = rows[0];
  if (!row) throw new Error("rate limit DB returned no row");
  const recent = Number(row.recent);
  const dayN = Number(row.day_n);
  if (!Number.isFinite(recent) || !Number.isFinite(dayN)) {
    throw new Error("rate limit DB returned a bad count");
  }
  return recent + weight > MAX_HITS || dayN + dayInc > daily.max;
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("rate limit DB timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * True when this client must be rejected.
 * `weight` lets exam generation count as several hits in the minute window.
 * With DATABASE_URL, a null IP is rejected: we do not invent a key from a
 * client-supplied header. Without DATABASE_URL and without Vercel, the
 * in-memory cap applies instead of failing closed.
 */
export async function tooManyRequests(
  ip: string | null,
  weight = 1,
  bucket: RateBucket = "chat",
): Promise<boolean> {
  const hits = Math.max(1, Math.min(MAX_HITS, Math.floor(weight) || 1));
  if (!databaseUrl() && process.env.VERCEL !== "1") {
    return tooManyInMemory(hits, bucket);
  }
  if (!ip || !databaseUrl()) return true;
  try {
    return await withTimeout(tooManyInDb(ip, hits, bucket), DB_TIMEOUT_MS);
  } catch (error) {
    if (!warned) {
      warned = true;
      const reason = error instanceof Error ? error.name : "Error";
      console.warn(`[rate-limit] DB unavailable, rejecting request (${reason})`);
    }
    return true;
  }
}

/**
 * Runs `call` (the model request) only when quota allows it.
 * Otherwise returns 429 and does not call `call`.
 */
export async function runIfWithinQuota(
  request: Request,
  options: { weight?: number; bucket?: RateBucket; message: string },
  call: () => Promise<Response>,
): Promise<Response> {
  const limited = await tooManyRequests(
    clientIp(request),
    options.weight ?? 1,
    options.bucket ?? "chat",
  );
  if (limited) return Response.json({ error: options.message }, { status: 429 });
  return call();
}
