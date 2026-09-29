/** Starred answers. Local only: no model call. */

export const FAVORITE_CAP = 40;
const Q_MAX = 240;
const A_MAX = 700;

export type Favorite = {
  id: string;
  q: string;
  a: string;
  at: number;
};

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function sanitizeFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  const out: Favorite[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<Favorite>;
    if (typeof item.id !== "string" || !item.id.trim()) continue;
    if (typeof item.q !== "string" || typeof item.a !== "string") continue;
    const id = item.id.slice(0, 80);
    if (seen.has(id)) continue;
    const q = clip(item.q, Q_MAX);
    const a = clip(item.a, A_MAX);
    if (!a) continue;
    seen.add(id);
    const at = typeof item.at === "number" && Number.isFinite(item.at) ? item.at : 0;
    out.push({ id, q: q || "Respuesta", a, at });
    if (out.length >= FAVORITE_CAP) break;
  }
  return out;
}

/** Adds or removes by id. `added` is true only when a new star was saved. */
export function toggleFavorite(list: Favorite[], item: Favorite) {
  if (list.some((fav) => fav.id === item.id)) {
    return { list: list.filter((fav) => fav.id !== item.id), added: false };
  }
  const next = sanitizeFavorites([item, ...list]);
  return { list: next, added: next.some((fav) => fav.id === item.id) };
}
