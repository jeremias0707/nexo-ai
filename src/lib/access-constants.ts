/** Shared Stage A access constants (safe for client + server). */
export const DEVICE_HEADER = "x-nexo-device";

export type AccessCaps = {
  /** null while chats are unlimited (see CHAT_UNLIMITED_UNTIL). */
  chats: number | null;
  exams: number;
  perMinute: number;
};

/** Must match rate-limit.server DAILY_* and MAX_HITS. */
export const FREE_CAPS: AccessCaps = {
  chats: 40,
  exams: 5,
  perMinute: 12,
};

/**
 * 3.0.1: no daily chat cap until this moment (Nov 14, 2026, 00:00 Buenos Aires).
 * From then on the 40/day cap comes back by itself, no new publish needed.
 * The exam cap (5/day) and the per-minute limit never change.
 */
export const CHAT_UNLIMITED_UNTIL = "2026-11-14T00:00:00-03:00";
export const CHAT_UNLIMITED_UNTIL_MS = Date.parse(CHAT_UNLIMITED_UNTIL);
export const CHAT_UNLIMITED_LABEL = "14 de noviembre";

export function chatsUnlimited(now: number = Date.now()) {
  return now < CHAT_UNLIMITED_UNTIL_MS;
}

/** Caps as they apply right now (chats: null while unlimited). */
export function currentCaps(now: number = Date.now()): AccessCaps & { unlimitedUntil?: string } {
  return chatsUnlimited(now)
    ? { ...FREE_CAPS, chats: null, unlimitedUntil: CHAT_UNLIMITED_UNTIL }
    : { ...FREE_CAPS };
}

/** Short line for the UI, e.g. under the menu or on the access screen. */
export function capsLine(now: number = Date.now()) {
  return chatsUnlimited(now)
    ? `chats sin límite hasta el ${CHAT_UNLIMITED_LABEL} y ${FREE_CAPS.exams} exámenes por día`
    : `${FREE_CAPS.chats} chats y ${FREE_CAPS.exams} exámenes por día`;
}
