/** Shared Stage A access constants (safe for client + server). */
export const DEVICE_HEADER = "x-nexo-device";

export type AccessCaps = {
  /** null = no daily chat cap. */
  chats: number | null;
  exams: number;
  perMinute: number;
};

/** Must match rate-limit.server DAILY_EXAM_MAX and MAX_HITS. chats: null = no daily cap (3.0.2). */
export const FREE_CAPS: AccessCaps = {
  chats: null,
  exams: 5,
  perMinute: 12,
};

/** Caps as /api/status reports them. */
export function currentCaps(): AccessCaps {
  return { ...FREE_CAPS };
}

/** Short line for the UI. */
export function capsLine() {
  return `chats sin límite y ${FREE_CAPS.exams} exámenes por día`;
}
