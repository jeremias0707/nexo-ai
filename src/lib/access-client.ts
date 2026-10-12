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

export function deviceHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = readDeviceToken();
  if (token) headers.set(DEVICE_HEADER, token);
  return headers;
}

export type AccessRedeemResult =
  | { ok: true; token: string; caps: AccessCaps }
  | { ok: false; status: number; error: string };

/** Redeem invite code (or soft preview register) and persist the device token. */
export async function redeemAccess(code: string): Promise<AccessRedeemResult> {
  let response: Response;
  try {
    response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
  } catch {
    return { ok: false, status: 0, error: "No pude conectar. Revisá tu internet." };
  }
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    token?: string;
    caps?: AccessCaps;
  };
  if (!response.ok || !data.token) {
    return {
      ok: false,
      status: response.status,
      error: data.error || "No pude activar el acceso.",
    };
  }
  writeDeviceToken(data.token);
  return { ok: true, token: data.token, caps: data.caps ?? FREE_CAPS };
}
