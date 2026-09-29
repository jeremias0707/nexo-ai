/** Nickname and avatar. Stored only on this device. Never sent to the tutor. */

export const DEFAULT_NICK = "Vos";
export const NICK_MAX = 24;
/** ~36 KB JPEG. Bigger photos are rejected so localStorage stays small. */
export const AVATAR_MAX_CHARS = 48_000;

export function sanitizeNick(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_NICK;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, NICK_MAX);
  return cleaned || DEFAULT_NICK;
}

export function nickCounts(nick: string) {
  return sanitizeNick(nick) !== DEFAULT_NICK;
}

export function sanitizeAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("data:image/jpeg;base64,")) return null;
  if (value.length < 32 || value.length > AVATAR_MAX_CHARS) return null;
  return value;
}
