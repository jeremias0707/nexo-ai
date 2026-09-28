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

export const STARTERS = [
  { name: "Derivada", prompt: "¿Qué es una derivada? Explícalo en pocas líneas y di si simplificas de más." },
  { name: "Célula", prompt: "Explícame la célula sin dar por sabido el vocabulario." },
  { name: "Partitura", prompt: "¿Cómo se lee una partitura simple? Solo lo imprescindible." },
  { name: "Gravedad", prompt: "Corrige esta idea si hace falta: la gravedad empuja los objetos hacia abajo." },
  { name: "Frieren", prompt: "¿En qué año se estrenó el anime Frieren y cuántas temporadas tiene? Contrasta el dato y no lo inventes." },
  { name: "Dune", prompt: "¿Quién escribió Dune y en qué año se publicó el primer libro? Si no lo encuentras, dilo." },
] as const;

export function modeLabel(id: Mode) {
  return MODES.find((mode) => mode.id === id)?.label ?? id;
}

export function levelLabel(id: Level) {
  return LEVELS.find((level) => level.id === id)?.label ?? id;
}
