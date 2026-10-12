/** Shared Stage A access constants (safe for client + server). */
export const DEVICE_HEADER = "x-nexo-device";

export type AccessCaps = {
  chats: number;
  exams: number;
  perMinute: number;
};

/** Must match rate-limit.server DAILY_* and MAX_HITS. */
export const FREE_CAPS: AccessCaps = {
  chats: 40,
  exams: 5,
  perMinute: 12,
};
