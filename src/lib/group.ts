/**
 * Modo grupo (NEXO 2.6). Everyone who types the same class code gets the same
 * 3 daily questions: the set is picked on the device from a fixed bank with a
 * seed made of the code and the date, so it works offline and costs nothing.
 * There is no chat, no names and no profiles. Optionally the server keeps an
 * anonymous count of how many devices of the class finished today (memory only).
 */

export const CLASS_CODE_MIN = 4;
export const CLASS_CODE_MAX = 10;
export const GROUP_QUESTIONS = 3;
export const GROUP_HISTORY_DAYS = 30;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type GroupQuestion = {
  id: string;
  subject: string;
  q: string;
  options: string[];
  answer: number;
  why: string;
};

type BankItem = {
  id: string;
  subject: string;
  q: string;
  right: string;
  wrong: [string, string, string];
  why: string;
};

/** Fixed, year-independent facts for secondary school. */
export const GROUP_BANK: BankItem[] = [
  {
    id: "m-porc",
    subject: "Mate",
    q: "¿Cuánto es el 25 % de 80?",
    right: "20",
    wrong: ["15", "25", "40"],
    why: "25 % es un cuarto: 80 ÷ 4 = 20.",
  },
  {
    id: "m-ecu",
    subject: "Mate",
    q: "Si 3x + 5 = 20, ¿cuánto vale x?",
    right: "5",
    wrong: ["3", "15", "25/3"],
    why: "3x = 15, entonces x = 5.",
  },
  {
    id: "m-pend",
    subject: "Mate",
    q: "¿Cuál es la pendiente de y = −2x + 7?",
    right: "−2",
    wrong: ["7", "2", "−7"],
    why: "En y = mx + b la pendiente es m, el número que multiplica a x.",
  },
  {
    id: "m-pita",
    subject: "Mate",
    q: "Un triángulo rectángulo tiene catetos 3 y 4. ¿Cuánto mide la hipotenusa?",
    right: "5",
    wrong: ["6", "7", "12"],
    why: "Pitágoras: 3² + 4² = 9 + 16 = 25, y √25 = 5.",
  },
  {
    id: "m-primo",
    subject: "Mate",
    q: "¿Cuál de estos números es primo?",
    right: "29",
    wrong: ["21", "27", "33"],
    why: "29 solo se divide por 1 y por 29. 21 = 3·7, 27 = 3·9, 33 = 3·11.",
  },
  {
    id: "m-pot",
    subject: "Mate",
    q: "¿Cuánto es (−3)²?",
    right: "9",
    wrong: ["−9", "−6", "6"],
    why: "(−3)·(−3) = 9: menos por menos da más.",
  },
  {
    id: "m-ang",
    subject: "Mate",
    q: "¿Cuánto suman los ángulos interiores de un triángulo?",
    right: "180°",
    wrong: ["90°", "270°", "360°"],
    why: "En cualquier triángulo los tres ángulos interiores suman 180°.",
  },
  {
    id: "h-1816",
    subject: "Historia",
    q: "¿En qué año se declaró la Independencia en Tucumán?",
    right: "1816",
    wrong: ["1806", "1810", "1853"],
    why: "El Congreso de Tucumán declaró la Independencia el 9 de julio de 1816.",
  },
  {
    id: "h-1810",
    subject: "Historia",
    q: "¿Qué se formó el 25 de mayo de 1810 en Buenos Aires?",
    right: "La Primera Junta",
    wrong: ["El Primer Triunvirato", "El Directorio", "El Congreso de Tucumán"],
    why: "El 25 de mayo de 1810 asumió la Primera Junta de gobierno.",
  },
  {
    id: "h-revfr",
    subject: "Historia",
    q: "¿En qué año empezó la Revolución Francesa?",
    right: "1789",
    wrong: ["1492", "1776", "1815"],
    why: "Se suele fechar con la toma de la Bastilla, el 14 de julio de 1789.",
  },
  {
    id: "h-gm1",
    subject: "Historia",
    q: "¿Qué hecho se toma como detonante de la Primera Guerra Mundial?",
    right: "El asesinato del archiduque Francisco Fernando",
    wrong: ["La invasión alemana a Polonia", "La caída del Muro de Berlín", "La Revolución Rusa"],
    why: "El asesinato en Sarajevo (1914) desató la guerra. La invasión a Polonia (1939) inicia la Segunda.",
  },
  {
    id: "h-1853",
    subject: "Historia",
    q: "¿En qué año se sancionó la Constitución Nacional argentina?",
    right: "1853",
    wrong: ["1810", "1816", "1912"],
    why: "Fue sancionada en 1853 en Santa Fe.",
  },
  {
    id: "b-cloro",
    subject: "Biología",
    q: "¿Qué organela realiza la fotosíntesis?",
    right: "El cloroplasto",
    wrong: ["La mitocondria", "El ribosoma", "El núcleo"],
    why: "El cloroplasto tiene clorofila y capta la luz. La mitocondria hace la respiración celular.",
  },
  {
    id: "b-adn",
    subject: "Biología",
    q: "¿Qué molécula guarda la información genética?",
    right: "El ADN",
    wrong: ["La glucosa", "El ATP", "El almidón"],
    why: "El ADN guarda las instrucciones genéticas. El ATP es energía; la glucosa y el almidón, azúcares.",
  },
  {
    id: "b-o2",
    subject: "Biología",
    q: "¿Qué gas liberan las plantas en la fotosíntesis?",
    right: "Oxígeno",
    wrong: ["Dióxido de carbono", "Nitrógeno", "Metano"],
    why: "Toman dióxido de carbono y agua, y liberan oxígeno.",
  },
  {
    id: "b-cel",
    subject: "Biología",
    q: "¿Cuál es la unidad básica de los seres vivos?",
    right: "La célula",
    wrong: ["El átomo", "El tejido", "El órgano"],
    why: "Todo ser vivo está formado por una o más células.",
  },
  {
    id: "b-proca",
    subject: "Biología",
    q: "¿Qué tipo de célula no tiene núcleo definido?",
    right: "La procariota",
    wrong: ["La eucariota animal", "La eucariota vegetal", "La neurona"],
    why: "En las procariotas (como las bacterias) el ADN no está dentro de un núcleo con membrana.",
  },
  {
    id: "f-newton",
    subject: "Física",
    q: "¿En qué unidad se mide la fuerza en el Sistema Internacional?",
    right: "Newton",
    wrong: ["Joule", "Watt", "Pascal"],
    why: "La fuerza se mide en newtons (N). Joule es energía, watt potencia y pascal presión.",
  },
  {
    id: "f-vel",
    subject: "Física",
    q: "Un auto recorre 120 km en 2 horas a velocidad constante. ¿Cuál es su velocidad?",
    right: "60 km/h",
    wrong: ["40 km/h", "120 km/h", "240 km/h"],
    why: "v = d ÷ t = 120 km ÷ 2 h = 60 km/h.",
  },
  {
    id: "f-ohm",
    subject: "Física",
    q: "Según la ley de Ohm, la tensión V es igual a…",
    right: "I · R",
    wrong: ["I ÷ R", "R ÷ I", "I + R"],
    why: "V = I · R: tensión = corriente por resistencia.",
  },
  {
    id: "f-g",
    subject: "Física",
    q: "¿Cuál es, aproximadamente, la aceleración de la gravedad en la Tierra?",
    right: "9,8 m/s²",
    wrong: ["1 m/s²", "4,9 m/s²", "98 m/s²"],
    why: "Cerca de la superficie es unos 9,8 m/s².",
  },
  {
    id: "f-ec",
    subject: "Física",
    q: "¿Cuál es la fórmula de la energía cinética?",
    right: "½ · m · v²",
    wrong: ["m · g · h", "m · a", "F · d"],
    why: "La cinética depende de la masa y de la velocidad al cuadrado. m·g·h es la potencial gravitatoria.",
  },
  {
    id: "q-na",
    subject: "Química",
    q: "¿Cuál es el símbolo químico del sodio?",
    right: "Na",
    wrong: ["S", "So", "Sd"],
    why: "Na viene del latín natrium. S es azufre.",
  },
  {
    id: "q-e",
    subject: "Química",
    q: "¿Qué carga eléctrica tiene el electrón?",
    right: "Negativa",
    wrong: ["Positiva", "Neutra", "Depende del átomo"],
    why: "El electrón es negativo, el protón positivo y el neutrón no tiene carga.",
  },
  {
    id: "q-ph",
    subject: "Química",
    q: "¿Qué pH tiene una solución neutra a 25 °C?",
    right: "7",
    wrong: ["0", "1", "14"],
    why: "Menos de 7 es ácido, más de 7 es básico y 7 es neutro.",
  },
  {
    id: "q-agua",
    subject: "Química",
    q: "¿Cuál es la fórmula del agua?",
    right: "H₂O",
    wrong: ["CO₂", "O₂", "H₂O₂"],
    why: "Dos hidrógenos y un oxígeno. H₂O₂ es agua oxigenada.",
  },
  {
    id: "q-z",
    subject: "Química",
    q: "¿Qué indica el número atómico (Z)?",
    right: "La cantidad de protones",
    wrong: ["La cantidad de neutrones", "La masa del átomo", "La cantidad de moléculas"],
    why: "Z es la cantidad de protones del núcleo y define al elemento.",
  },
  {
    id: "l-nucleo",
    subject: "Lengua",
    q: "En «Los chicos juegan en el patio», ¿cuál es el núcleo del sujeto?",
    right: "chicos",
    wrong: ["Los", "juegan", "patio"],
    why: "El sujeto es «Los chicos» y su núcleo es el sustantivo «chicos». «Juegan» es el núcleo del predicado.",
  },
  {
    id: "l-esdru",
    subject: "Lengua",
    q: "¿Cuál de estas palabras es esdrújula?",
    right: "música",
    wrong: ["canción", "árbol", "reloj"],
    why: "Mú-si-ca lleva el acento en la antepenúltima sílaba. Las esdrújulas siempre llevan tilde.",
  },
  {
    id: "l-adv",
    subject: "Lengua",
    q: "La palabra «rápidamente» es un…",
    right: "adverbio",
    wrong: ["adjetivo", "sustantivo", "verbo"],
    why: "Las palabras terminadas en -mente suelen ser adverbios de modo.",
  },
  {
    id: "l-meta",
    subject: "Lengua",
    q: "¿Qué recurso es «sus dientes eran perlas»?",
    right: "Metáfora",
    wrong: ["Hipérbole", "Onomatopeya", "Aliteración"],
    why: "Identifica dientes con perlas sin usar «como»; con «como» sería una comparación.",
  },
  {
    id: "l-fui",
    subject: "Lengua",
    q: "Completá: «Ayer yo ___ al cine».",
    right: "fui",
    wrong: ["voy", "iré", "vaya"],
    why: "«Ayer» pide pretérito perfecto simple: fui.",
  },
  {
    id: "i-went",
    subject: "Inglés",
    q: "What is the past simple of «go»?",
    right: "went",
    wrong: ["goed", "gone", "going"],
    why: "«Go» es irregular: go – went – gone.",
  },
  {
    id: "i-goes",
    subject: "Inglés",
    q: "«She ___ to school every day.»",
    right: "goes",
    wrong: ["go", "going", "gone"],
    why: "Present simple con he/she/it agrega -s o -es: goes.",
  },
  {
    id: "i-child",
    subject: "Inglés",
    q: "What is the plural of «child»?",
    right: "children",
    wrong: ["childs", "childes", "childrens"],
    why: "Es un plural irregular: child – children.",
  },
  {
    id: "i-than",
    subject: "Inglés",
    q: "«I am taller ___ my brother.»",
    right: "than",
    wrong: ["that", "then", "as"],
    why: "Los comparativos usan «than»: taller than.",
  },
  {
    id: "g-amaz",
    subject: "Geografía",
    q: "¿Cuál es el río más largo de Sudamérica?",
    right: "El Amazonas",
    wrong: ["El Paraná", "El Orinoco", "El Uruguay"],
    why: "El Amazonas es el más largo y caudaloso de Sudamérica.",
  },
  {
    id: "g-acon",
    subject: "Geografía",
    q: "¿Cuál es la montaña más alta de América?",
    right: "El Aconcagua",
    wrong: ["El Everest", "El Fitz Roy", "El Chimborazo"],
    why: "El Aconcagua (Mendoza) supera los 6900 m. El Everest está en Asia.",
  },
  {
    id: "g-ecua",
    subject: "Geografía",
    q: "¿Qué línea imaginaria divide la Tierra en hemisferio norte y sur?",
    right: "El ecuador",
    wrong: ["El meridiano de Greenwich", "El trópico de Capricornio", "El círculo polar antártico"],
    why: "El ecuador divide norte y sur; Greenwich divide este y oeste.",
  },
  {
    id: "g-atl",
    subject: "Geografía",
    q: "¿Qué océano baña la costa de Argentina?",
    right: "El Atlántico",
    wrong: ["El Pacífico", "El Índico", "El Ártico"],
    why: "La costa argentina está sobre el océano Atlántico.",
  },
  {
    id: "g-tiempo",
    subject: "Geografía",
    q: "El estado de la atmósfera en un lugar y momento determinados se llama…",
    right: "tiempo atmosférico",
    wrong: ["clima", "relieve", "latitud"],
    why: "El tiempo es de un momento; el clima es el promedio de muchos años.",
  },
];

/** "abc 12-3" → "ABC123". Null when too short or too long. */
export function normalizeClassCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (code.length < CLASS_CODE_MIN || code.length > CLASS_CODE_MAX) return null;
  return code;
}

export function newClassCode(random: () => number = Math.random) {
  let code = "";
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

/** "ABC123" → "ABC-123" (display only). Odd lengths stay as typed: "3BBIO". */
export function formatClassCode(code: string) {
  return code.length >= 6 && code.length % 2 === 0
    ? `${code.slice(0, code.length / 2)}-${code.slice(code.length / 2)}`
    : code;
}

/** FNV-1a 32-bit. */
export function hash32(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], random: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Same code + same day → same questions (and option order) on every device. */
export function groupChallenge(code: string, day: string, bank: BankItem[] = GROUP_BANK) {
  const random = seeded(hash32(`${code}|${day}`));
  const order = shuffle(bank, random);
  const picked: BankItem[] = [];
  const subjects = new Set<string>();
  for (const item of order) {
    if (picked.length >= GROUP_QUESTIONS) break;
    if (subjects.has(item.subject)) continue;
    subjects.add(item.subject);
    picked.push(item);
  }
  for (const item of order) {
    if (picked.length >= GROUP_QUESTIONS) break;
    if (!picked.includes(item)) picked.push(item);
  }
  const questions: GroupQuestion[] = picked.map((item) => {
    const options = shuffle([item.right, ...item.wrong], random);
    return {
      id: item.id,
      subject: item.subject,
      q: item.q,
      options,
      answer: options.indexOf(item.right),
      why: item.why,
    };
  });
  return { id: `${code}:${day}`, questions };
}

export function scoreGroup(questions: GroupQuestion[], answers: (number | null)[]) {
  return questions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0), 0);
}

export function groupShareText(code: string, dayText: string, correct: number, total: number) {
  return `NEXO · Clase ${formatClassCode(code)} · Desafío del ${dayText}: ${correct}/${total}. ¡Hacelo vos también con el mismo código!`;
}

export type GroupResult = { code: string; answers: (number | null)[]; correct: number };
export type GroupState = { code: string | null; results: Record<string, GroupResult> };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeGroupState(value: unknown): GroupState {
  if (!value || typeof value !== "object") return { code: null, results: {} };
  const raw = value as { code?: unknown; results?: unknown };
  const results: Record<string, GroupResult> = {};
  if (raw.results && typeof raw.results === "object") {
    const entries = Object.entries(raw.results as Record<string, unknown>)
      .filter(([day]) => DAY_RE.test(day))
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, GROUP_HISTORY_DAYS);
    for (const [day, entry] of entries) {
      if (!entry || typeof entry !== "object") continue;
      const r = entry as Record<string, unknown>;
      const code = normalizeClassCode(r.code);
      if (!code || !Array.isArray(r.answers)) continue;
      const answers = r.answers
        .slice(0, GROUP_QUESTIONS)
        .map((a) => (typeof a === "number" && Number.isInteger(a) && a >= 0 && a < 4 ? a : null));
      const correct =
        typeof r.correct === "number" && Number.isFinite(r.correct)
          ? Math.max(0, Math.min(GROUP_QUESTIONS, Math.floor(r.correct)))
          : 0;
      results[day] = { code, answers, correct };
    }
  }
  return { code: normalizeClassCode(raw.code), results };
}

/** Day key for the class code on the server (only the hash is kept). */
export async function classKey(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`nexo-class:${code}`),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
