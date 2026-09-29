export const MODES = [
  { id: "cimientos", label: "Cimientos", hint: "Desde lo más simple" },
  { id: "socratico", label: "Socrático", hint: "Pregunta antes de cerrar" },
  { id: "pasos", label: "Pasos", hint: "Una secuencia corta" },
  { id: "examen", label: "Examen", hint: "Preguntas y corrección" },
] as const;

export const LEVELS = [
  { id: "basico", label: "Básico" },
  { id: "intermedio", label: "Intermedio" },
  { id: "avanzado", label: "Avanzado" },
] as const;

export type Mode = (typeof MODES)[number]["id"];
export type Level = (typeof LEVELS)[number]["id"];

export function modeLabel(id: Mode) {
  return MODES.find((mode) => mode.id === id)?.label ?? id;
}

export function levelLabel(id: Level) {
  return LEVELS.find((level) => level.id === id)?.label ?? id;
}
