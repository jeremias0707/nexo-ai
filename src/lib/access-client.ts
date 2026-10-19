/**
 * Client-side device token for Stage A access gate.
 * Stored only in this browser; sent as X-Nexo-Device on costly API calls.
 */
import { DEVICE_HEADER, type AccessCaps, FREE_CAPS } from "./access-constants";

const STORAGE_KEY = "nexo.deviceToken";

export { DEVICE_HEADER, FREE_CAPS };
export type { AccessCaps };

export function readDeviceToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
    return value.length >= 16 ? value : null;
  } catch {
    return null;
  }
}

export function writeDeviceToken(token: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Quota full: keep in-memory for this visit via callers that already hold it.
  }
}

export function clearDeviceToken() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 3.0.2: random id made on this device (no code). Only used to count exams per device. */
export function deviceId(): string {
  const existing = readDeviceToken();
  if (existing) return existing;
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  writeDeviceToken(id);
  return id;
}

export function deviceHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set(DEVICE_HEADER, deviceId());
  return headers;
}
