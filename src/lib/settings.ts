/** Device-only preferences. Nothing here is an account or a server profile. */

export const THEMES = ["oscuro", "claro"] as const;
export const TEXT_SIZES = ["chico", "normal", "grande"] as const;
export const EXPLAINS = ["simple", "normal", "fondo"] as const;
/**
 * "guiado" = soft Socratic study mode (ask what they know first).
 * "oral" = answer the way you would say it in an oral exam (2.6).
 * "profe" = the tutor plays a teacher taking an oral exam, one question at a time (2.6).
 */
export const REPLIES = [
  "normal",
  "pasos",
  "preguntas",
  "examen",
  "guiado",
  "oral",
  "profe",
] as const;

/** Reply modes made for speaking practice (the chat shows a "Modo oral" chip). */
export const ORAL_REPLIES: readonly ReplyMode[] = ["oral", "profe"];

export function isOralReply(value: unknown): value is "oral" | "profe" {
  return (ORAL_REPLIES as readonly string[]).includes(String(value));
}

export type ThemeId = (typeof THEMES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
export type ExplainDepth = (typeof EXPLAINS)[number];
export type ReplyMode = (typeof REPLIES)[number];

export type Settings = {
  theme: ThemeId;
  text: TextSize;
  explain: ExplainDepth;
  reply: ReplyMode;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "oscuro",
  text: "normal",
  explain: "normal",
  reply: "normal",
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function sanitizeExplain(value: unknown): ExplainDepth {
  return oneOf(value, EXPLAINS, "normal");
}

export function sanitizeReply(value: unknown): ReplyMode {
  return oneOf(value, REPLIES, "normal");
}

export function sanitizeSettings(value: unknown): Settings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    theme: oneOf(record.theme, THEMES, "oscuro"),
    text: oneOf(record.text, TEXT_SIZES, "normal"),
    explain: sanitizeExplain(record.explain),
    reply: sanitizeReply(record.reply),
  };
}

/**
 * Extra line appended to the tutor system prompt. Empty for Normal so the
 * existing rules stay exactly as they are. Never replaces those rules.
 */
export function explainAddon(value: unknown): string {
  const depth = sanitizeExplain(value);
  if (depth === "simple") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): respondé en pocas frases cortas (como máximo un párrafo corto o 4–6 líneas). Un solo ejemplo de la vida cotidiana o de un videojuego. Sin relleno ni listas largas.";
  }
  if (depth === "fondo") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): incluí los límites del concepto, el error típico y un poco más de profundidad.";
  }
  return "";
}

/**
 * Extra line for the response shape. Empty for Normal so the tutor prompt
 * stays exactly as it is. Never replaces the rules, and never carries theme,
 * font, XP or the nickname.
 */
export function replyAddon(value: unknown): string {
  const mode = sanitizeReply(value);
  if (mode === "pasos") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): respondé en pasos numerados cortos. Cada paso dice qué hacer.";
  }
  if (mode === "preguntas") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): antes de explicar, hacé una sola pregunta para que piense. Después explicá.";
  }
  if (mode === "examen") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): respondé como si corrigieras un examen: veredicto corto, qué está bien y qué falta.";
  }
  if (mode === "oral") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): modo oral. Respondé como lo diría en voz alta un estudiante bien preparado en un examen oral: una primera frase que defina el tema; después 3 o 4 ideas en orden, unidas con conectores (primero, además, por eso, en conclusión); un ejemplo concreto y una frase de cierre. Frases cortas, fáciles de decir. Sin tablas, sin diagramas ni gráficos; si hay una fórmula, decí también cómo se lee en palabras. Al final, en una línea aparte, escribí «Te pueden repreguntar:» y una pregunta que haría un profesor.";
  }
  if (mode === "profe") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): simulá a un profesor tomando un examen oral, amable pero exigente. Si todavía no hay tema, preguntá de qué tema y nivel es el oral. Con un tema, hacé UNA sola pregunta de oral por vez y esperá la respuesta; no des la respuesta antes de que intente. Cuando el estudiante responda, corregí empezando con «Bien», «A medias» o «Mal», decí en una frase qué faltó o qué estuvo mal, sumá un tip corto (empezá con «Tip:») y después hacé la siguiente pregunta, un poco más difícil. Si pide la respuesta o dice que no sabe, explicala corto y seguí. Sin tablas ni diagramas.";
  }
  if (mode === "guiado") {
    return "\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): modo estudio guiado (socrático suave). Primero preguntá en una frase qué sabe o qué ya intentó sobre el tema. Esperá su respuesta antes de cerrar la explicación completa. Si ya contestó eso en el historial, seguí con una pista o el siguiente paso corto, sin soltar todo de golpe.";
  }
  return "";
}

/**
 * Shorter answers by default on mobile. Applied when the client says mobile
 * and the user did not pick "a fondo". Never replaces the main rules.
 */
export function mobileShortAddon(mobile: unknown, explain: unknown): string {
  if (mobile !== true) return "";
  if (sanitizeExplain(explain) === "fondo") return "";
  return "\n\nPedido para esta respuesta (pantalla chica; no reemplaza las reglas de arriba): priorizá respuestas cortas y fáciles de leer en el celular. Evitá párrafos largos; si hace falta más detalle, ofrecé ampliar al final en una frase.";
}
