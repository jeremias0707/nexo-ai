/**
 * Stage A access gate for Grok host (no durable DB).
 *
 * Flow:
 *   1. Client POSTs the shared invite code to /api/access.
 *   2. Server mints a random device token and keeps it in process memory.
 *   3. Costly routes (/api/chat, /api/exam, /api/exam-grade) require
 *      header X-Nexo-Device with that token BEFORE calling xAI.
 *   4. Daily caps are keyed by a hash of the device token (per device).
 *
 * Limitations (honest):
 *   - Memory resets on server restart; tokens must be re-redeemed.
 *   - Not shared across multiple server instances.
 *   - Anyone with the invite code can mint devices (capped per day).
 *   - A leaked code is rotated by changing NEXO_ACCESS_CODE.
 *
 * Env:
 *   NEXO_ACCESS_CODE — optional shared invite when the host supports secrets.
 *   Grok Builder has no env secrets: without this var, soft-mint device tokens
 *   (any/empty code). Spend control is per-device + process-wide caps.
 *   Preview without GROK_PROJECT_ID also soft-registers.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { currentCaps, DEVICE_HEADER, FREE_CAPS, type AccessCaps } from "./access-constants.ts";
import { env, isWorkspacePreview } from "./env.server.ts";

export { DEVICE_HEADER, FREE_CAPS };
export type { AccessCaps };

export const DEVICE_TOKEN_BYTES = 32;
/** Max new device tokens minted per rolling day (process-wide). */
export const MAX_DEVICES_PER_DAY = 200;
/** Soft ceiling so a leaked code cannot burn unbounded Grok spend. */
export const GLOBAL_CHAT_MAX = 2_000;
export const GLOBAL_EXAM_MAX = 200;

type DeviceRecord = { token: string; createdAt: number; lastSeen: number };

const devices = new Map<string, DeviceRecord>();
let mintHits: number[] = [];
let globalChatHits: number[] = [];
let globalExamHits: number[] = [];
let nowForTests: (() => number) | null = null;

const DAY_MS = 24 * 60 * 60 * 1000;

export function setAccessNowForTests(now: (() => number) | null) {
  nowForTests = now;
}

export function resetAccessMemoryForTests() {
  devices.clear();
  mintHits = [];
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

/** True when published Grok (or any non-preview) must enforce the invite. */
export function accessGateRequired(): boolean {
  return !isWorkspacePreview();
}

export function configuredAccessCode(): string | null {
  return env("NEXO_ACCESS_CODE") ?? null;
}

/** Always ready on Grok: this host has no env secrets. If NEXO_ACCESS_CODE is set on a future host, redeem still enforces it. */
export function accessReady(): boolean {
  return true;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`nexo-device:${token}`),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function mintRawToken(): string {
  return randomBytes(DEVICE_TOKEN_BYTES).toString("base64url");
}

/**
 * Redeem invite code → device token.
 * Preview without NEXO_ACCESS_CODE: issues a token with empty/any code.
 */
export async function redeemAccessCode(
  code: string | null | undefined,
): Promise<
  { ok: true; token: string; caps: AccessCaps } | { ok: false; status: number; error: string }
> {
  const expected = configuredAccessCode();

  // Grok host cannot store secrets: without NEXO_ACCESS_CODE, soft-mint a device
  // token (any/empty code). Real spend control is per-device + global caps.
  if (expected) {
    const given = (code ?? "").trim();
    if (!given || !safeEqual(given, expected)) {
      return {
        ok: false,
        status: 401,
        error: "Código incorrecto. Pedile el acceso a quien te pasó NEXO.",
      };
    }
  }

  mintHits = pruneDay(mintHits);
  if (mintHits.length >= MAX_DEVICES_PER_DAY) {
    return {
      ok: false,
      status: 429,
      error: "Se alcanzó el máximo de dispositivos por hoy. Probá mañana.",
    };
  }

  const token = mintRawToken();
  const key = await hashToken(token);
  const t = nowMs();
  devices.set(key, { token, createdAt: t, lastSeen: t });
  mintHits.push(t);
  return { ok: true, token, caps: currentCaps() };
}

export async function verifyDeviceToken(token: string | null | undefined): Promise<string | null> {
  const raw = (token ?? "").trim();
  if (!raw || raw.length < 16 || raw.length > 128) return null;
  const key = await hashToken(raw);
  const row = devices.get(key);
  if (!row || row.token !== raw) return null;
  row.lastSeen = nowMs();
  return key;
}

export function readDeviceHeader(request: Request): string | null {
  return request.headers.get(DEVICE_HEADER)?.trim() || null;
}

/**
 * Guard for costly routes. Returns a Response to send immediately, or the
 * device key to use for per-device quotas.
 */
export async function requireDeviceAccess(
  request: Request,
): Promise<{ ok: true; deviceKey: string } | { ok: false; response: Response }> {
  if (!accessReady()) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "NEXO todavía no tiene el código de acceso configurado. Probá más tarde.",
        },
        { status: 503 },
      ),
    };
  }

  const deviceKey = await verifyDeviceToken(readDeviceHeader(request));
  if (!deviceKey) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Necesitás el código de acceso de NEXO para usar el tutor.",
          code: "access_required",
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, deviceKey };
}

/** Process-wide soft ceiling (extra safety if the invite leaks). */
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
    accessRequired: accessGateRequired() || Boolean(configuredAccessCode()),
    accessConfigured: accessReady(),
    caps: currentCaps(),
    free: true,
  };
}
