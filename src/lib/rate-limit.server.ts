/**
 * Sliding-window rate limit for /api/chat: MAX_HITS accepted requests per
 * WINDOW_MS per client.
 *
 * Durable path: when a real Postgres (Neon, via DATABASE_URL) is configured,
 * hits live in `chat_rate_hits` (migrations/0002_chat_rate_limit.sql), so the
 * limit holds across every serverless instance. Without DATABASE_URL the local
 * PGLite fallback is in-memory and per-instance — no better than a Map and much
 * heavier to boot — so we use the in-memory limiter directly. Any DB error or
 * slow response also falls back to memory so chat never breaks because of it.
 *
 * `@/lib/db` is imported lazily and only when DATABASE_URL is set: importing it
 * without one eagerly boots PGLite, which the production bundle cannot load.
 */
export const WINDOW_MS = 60_000;
export const MAX_HITS = 12;
const DB_TIMEOUT_MS = 1_500;
const PRUNE_EVERY = 50;
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

// ---- In-memory fallback (per instance) ----------------------------------

const memoryHits = new Map<string, number[]>();

function tooManyInMemory(key: string, now = Date.now()) {
  const recent = (memoryHits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  const limited = recent.length >= MAX_HITS;
  if (!limited) recent.push(now);
  memoryHits.set(key, recent);
  // Keep the map bounded on long-lived instances.
  if (memoryHits.size > 5_000) {
    for (const [other, stamps] of memoryHits) {
      if (stamps.every((stamp) => now - stamp >= WINDOW_MS)) memoryHits.delete(other);
    }
  }
  return limited;
}

// ---- Durable (Postgres) path ----------------------------------------------

let calls = 0;
let warned = false;

async function hashKey(ip: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nexo:${ip}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function tooManyInDb(ip: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const key = await hashKey(ip);
  const seconds = WINDOW_MS / 1000;
  // Count recent hits and record this one only if under the limit, in one
  // round trip. Rejected requests are not recorded (same as the memory path).
  const rows = await sql.query<{ recent: number }>(
    `with recent as (
       select count(*)::int as n from chat_rate_hits
       where client_key = $1 and hit_at > now() - make_interval(secs => $2)
     ), ins as (
       insert into chat_rate_hits (client_key)
       select $1 where (select n from recent) < $3
       returning 1
     )
     select (select n from recent) as recent`,
    [key, seconds, MAX_HITS],
  );
  calls += 1;
  if (calls % PRUNE_EVERY === 0) {
    void sql
      .query("delete from chat_rate_hits where hit_at < now() - make_interval(secs => $1)", [
        seconds * 5,
      ])
      .catch(() => undefined);
  }
  return Number(rows[0]?.recent ?? 0) >= MAX_HITS;
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

/** True when this client already used its quota for the current window. */
export async function tooManyRequests(ip: string): Promise<boolean> {
  if (!hasDatabaseUrl) return tooManyInMemory(ip);
  try {
    return await withTimeout(tooManyInDb(ip), DB_TIMEOUT_MS);
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn("[rate-limit] DB unavailable, using in-memory fallback:", error);
    }
    return tooManyInMemory(ip);
  }
}
