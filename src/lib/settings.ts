/** Device-only preferences. Nothing here is an account or a server profile. */

export const THEMES = ["oscuro", "claro"] as const;
export const TEXT_SIZES = ["chico", "normal", "grande"] as const;
export const EXPLAINS = ["simple", "normal", "fondo"] as const;

export type ThemeId = (typeof THEMES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
export type ExplainDepth = (typeof EXPLAINS)[number];

export type Settings = {
  theme: ThemeId;
  text: TextSize;
  explain: ExplainDepth;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "oscuro",
  text: "normal",
  explain: "normal",
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function sanitizeExplain(value: unknown): ExplainDepth {
  return oneOf(value, EXPLAINS, "normal");
}

export function sanitizeSettings(value: unknown): Settings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    theme: oneOf(record.theme, THEMES, "oscuro"),
    text: oneOf(record.text, TEXT_SIZES, "normal"),
    explain: sanitizeExplain(record.explain),
  };
}

/**
 * Extra line appended to the tutor system prompt. Empty for Normal so the
 * existing rules stay exactly as they are. Never replaces those rules.
 */
export function explainAddon(value: unknown): string {
  const depth = sanitizeExplain(value);
  if (depth === "simple") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): usá frases cortas y un ejemplo de la vida cotidiana o de un videojuego.";
  }
  if (depth === "fondo") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): incluí los límites del concepto, el error típico y un poco más de profundidad.";
  }
  return "";
}
