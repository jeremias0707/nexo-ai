/**
 * NEXO 3.0.2: no access code. Every route is open.
 *
 * Each browser/app keeps a random device id (header X-Nexo-Device) only so the
 * per-device limits (5 exams/day, 12 requests/minute) have something to count.
 * POST /api/access still exists for older apps: it hands out a new random id
 * and ignores any code sent.
 *
 * Honest limits: the id comes from the client, so a determined user can reset
 * it. The process-wide caps below are the real spend ceiling.
 */
import { randomBytes } from "node:crypto";
import { currentCaps, DEVICE_HEADER, FREE_CAPS, type AccessCaps } from "./access-constants.ts";

export { DEVICE_HEADER, FREE_CAPS };
export type { AccessCaps };

export const DEVICE_TOKEN_BYTES = 32;
/** Process-wide safety ceilings per rolling day. */
export const GLOBAL_CHAT_MAX = 2_000;
export const GLOBAL_EXAM_MAX = 200;

let globalChatHits: number[] = [];
let globalExamHits: number[] = [];
let nowForTests: (() => number) | null = null;

const DAY_MS = 24 * 60 * 60 * 1000;

export function setAccessNowForTests(now: (() => number) | null) {
  nowForTests = now;
}

export function resetAccessMemoryForTests() {
  globalChatHits = [];
  globalExamHits = [];
}

function nowMs() {
  return nowForTests ? nowForTests() : Date.now();
}

function pruneDay(list: number[]) {
  const cutoff = nowMs() - DAY_MS;
  return list.filter((t) => t > cutoff);
}

async function hashId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`nexo-device:${id}`),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compatibility for older apps: always returns a fresh random device id. */
export function issueDeviceId(): { ok: true; token: string; caps: AccessCaps } {
  return {
    ok: true,
    token: randomBytes(DEVICE_TOKEN_BYTES).toString("base64url"),
    caps: currentCaps(),
  };
}

/** Hash of a well-formed device id, or null (then the shared bucket is used). */
export async function deviceKeyFor(id: string | null | undefined): Promise<string | null> {
  const raw = (id ?? "").trim();
  if (raw.length < 16 || raw.length > 128 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  return hashId(raw);
}

export function readDeviceHeader(request: Request): string | null {
  return request.headers.get(DEVICE_HEADER)?.trim() || null;
}

/**
 * Costly routes call this for the per-device key. It never blocks (no access
 * code since 3.0.2); without a valid id the shared bucket applies.
 */
export async function requireDeviceAccess(
  request: Request,
): Promise<{ ok: true; deviceKey: string } | { ok: false; response: Response }> {
  const deviceKey = (await deviceKeyFor(readDeviceHeader(request))) ?? "";
  return { ok: true, deviceKey };
}

/** Process-wide safety ceiling (the real spend limit now that there is no code). */
export function globalBudgetAllows(bucket: "chat" | "exam" | "grade"): boolean {
  const t = nowMs();
  globalChatHits = pruneDay(globalChatHits);
  globalExamHits = pruneDay(globalExamHits);
  if (bucket === "exam") {
    if (globalExamHits.length >= GLOBAL_EXAM_MAX) return false;
    globalExamHits.push(t);
    return true;
  }
  if (globalChatHits.length >= GLOBAL_CHAT_MAX) return false;
  globalChatHits.push(t);
  return true;
}

export function accessPublicStatus() {
  return {
    accessRequired: false,
    accessConfigured: true,
    caps: currentCaps(),
    free: true,
  };
}
