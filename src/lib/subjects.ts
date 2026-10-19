/**
 * School-subject shortcuts. Picking one only adjusts the tutor tone via an
 * addon; it never replaces the main rules and stays on the device.
 */

export const SUBJECTS = [
  { id: "mate", label: "Mate", hint: "Matemática" },
  { id: "histo", label: "Histo", hint: "Historia" },
  { id: "bio", label: "Bio", hint: "Biología" },
  { id: "fisica", label: "Física", hint: "Física" },
  { id: "quimica", label: "Química", hint: "Química" },
  { id: "lengua", label: "Lengua", hint: "Lengua y literatura" },
  { id: "ingles", label: "Inglés", hint: "Inglés" },
  { id: "geo", label: "Geo", hint: "Geografía" },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const SUBJECT_NONE = "" as const;
export type SubjectChoice = SubjectId | typeof SUBJECT_NONE;

const IDS = SUBJECTS.map((s) => s.id) as readonly SubjectId[];

export function sanitizeSubject(value: unknown): SubjectChoice {
  return typeof value === "string" && (IDS as readonly string[]).includes(value)
    ? (value as SubjectId)
    : SUBJECT_NONE;
}

export function subjectLabel(id: SubjectChoice) {
  if (!id) return null;
  return SUBJECTS.find((s) => s.id === id)?.hint ?? id;
}

/**
 * Extra line for the tutor when a school subject is selected. Empty when none.
 */
export function subjectAddon(value: unknown): string {
  const id = sanitizeSubject(value);
  if (!id) return "";
  const tone: Record<SubjectId, string> = {
    mate: "Estás ayudando con matemática de secundaria. Priorizá pasos claros, definí símbolos la primera vez y usá fórmulas entre $. Si falta un dato, pedilo antes de inventar.",
    histo:
      "Estás ayudando con historia de secundaria. Priorizá causas, consecuencias y fechas solo si las sabés con seguridad. Si no estás seguro de un dato, dilo.",
    bio: "Estás ayudando con biología de secundaria. Definí el vocabulario la primera vez y relacioná estructuras con funciones. No inventes nombres científicos.",
    fisica:
      "Estás ayudando con física de secundaria. Mostrá unidades, fórmulas entre $ y un ejemplo concreto. Si falta un dato, pedilo.",
    quimica:
      "Estás ayudando con química de secundaria. Cuidá balances, nomenclatura y estados. No inventes reacciones ni coeficientes.",
    lengua:
      "Estás ayudando con lengua y literatura de secundaria. Sé concreto con ejemplos de oraciones o fragmentos cortos. No inventes citas textuales.",
    ingles:
      "Estás ayudando con inglés de secundaria. Explicá en español y mostrá ejemplos en inglés. Corregí con claridad, sin inventar reglas raras.",
    geo: "Estás ayudando con geografía de secundaria. Priorizá conceptos (clima, relieve, población) y ubicaciones solo si las sabés. Si no, dilo.",
  };
  return `\n\nPedido para esta respuesta (no reemplaza las reglas de arriba): ${tone[id]}`;
}
