/** Study cards built from favorites and saved mistakes. No model call. */
import type { Favorite } from "./favorites.ts";
import type { Mistake } from "./mistakes.ts";

export const DECK_CAP = 40;
export const KNOWN_CAP = 80;

export type StudyCard = {
  id: string;
  front: string;
  back: string;
  from: "favorito" | "error";
};

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function cardsFromFavorites(favorites: Favorite[]): StudyCard[] {
  return favorites
    .map((fav) => ({
      id: `fav:${fav.id}`,
      front: clip(fav.q, 280) || "Respuesta guardada",
      back: clip(fav.a, 700),
      from: "favorito" as const,
    }))
    .filter((card) => card.back);
}

export function cardsFromMistakes(mistakes: Mistake[]): StudyCard[] {
  return mistakes.map((mistake) => {
    const q = mistake.question;
    const answer =
      q.kind === "mc"
        ? q.options[q.answer] || ""
        : q.expected;
    const extra = q.explanation ? ` ${q.explanation}` : "";
    return {
      id: `err:${mistake.id}`,
      front: clip(q.prompt, 280),
      back: clip(`${answer}${extra}`, 700),
      from: "error" as const,
    };
  }).filter((card) => card.front && card.back);
}

/** Favorites first, then mistakes. One card per id, capped. */
export function buildDeck(favorites: Favorite[], mistakes: Mistake[]): StudyCard[] {
  const merged = [...cardsFromFavorites(favorites), ...cardsFromMistakes(mistakes)];
  const seen = new Set<string>();
  const deck: StudyCard[] = [];
  for (const card of merged) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    deck.push(card);
    if (deck.length >= DECK_CAP) break;
  }
  return deck;
}

export function sanitizeKnown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || !id.trim() || id.length > 120) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(-KNOWN_CAP);
}

/**
 * "La sabía" adds the id once. "No la sabía" removes it.
 * `first` is true only the first time that card is marked as known.
 */
export function applyReview(known: string[], id: string, knew: boolean) {
  const list = sanitizeKnown(known);
  const has = list.includes(id);
  if (knew) {
    if (has) return { known: list, first: false };
    return { known: sanitizeKnown([...list, id]), first: true };
  }
  return { known: list.filter((item) => item !== id), first: false };
}
