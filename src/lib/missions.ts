/**
 * "Misiones rápidas" on the home screen: a pool of study prompts from which 6
 * are shown at random each time (one per subject when possible, never the
 * exact same set twice in a row). Prompts avoid facts that change over time.
 */
export type Mission = { name: string; subject: string; prompt: string };

export const MISSIONS: Mission[] = [
  // Matemática
  {
    subject: "matematica",
    name: "Derivada",
    prompt: "¿Qué es una derivada? Explicámelo en pocas líneas con un ejemplo.",
  },
  {
    subject: "matematica",
    name: "Ecuaciones",
    prompt: "¿Cómo resuelvo 3x − 5 = 10? Mostrame los pasos.",
  },
  {
    subject: "matematica",
    name: "Fracciones",
    prompt: "¿Cómo se suman fracciones con distinto denominador? Dame un ejemplo.",
  },
  {
    subject: "matematica",
    name: "Pitágoras",
    prompt: "Explicame el teorema de Pitágoras y cuándo se usa.",
  },
  {
    subject: "matematica",
    name: "Porcentajes",
    prompt: "¿Cómo calculo el 15 % de 240 y un descuento del 20 %?",
  },
  {
    subject: "matematica",
    name: "Función lineal",
    prompt: "¿Qué significan la pendiente y la ordenada en y = 2x + 1? Graficala.",
  },
  // Física
  {
    subject: "fisica",
    name: "Gravedad",
    prompt: "Corregí esta idea si hace falta: los objetos pesados caen más rápido.",
  },
  {
    subject: "fisica",
    name: "Newton",
    prompt: "Explicame las tres leyes de Newton con ejemplos de la vida diaria.",
  },
  {
    subject: "fisica",
    name: "Velocidad",
    prompt: "¿Cuál es la diferencia entre velocidad y aceleración?",
  },
  {
    subject: "fisica",
    name: "Energía",
    prompt: "¿Qué son la energía cinética y la potencial? Dame un ejemplo de cada una.",
  },
  {
    subject: "fisica",
    name: "Ley de Ohm",
    prompt: "Explicame la ley de Ohm y resolvé un ejemplo simple.",
  },
  // Química
  {
    subject: "quimica",
    name: "Átomo",
    prompt: "¿Cómo está formado un átomo? Protones, neutrones y electrones.",
  },
  {
    subject: "quimica",
    name: "Tabla periódica",
    prompt: "¿Cómo se lee la tabla periódica? Solo lo imprescindible.",
  },
  {
    subject: "quimica",
    name: "Enlaces",
    prompt: "¿Qué diferencia hay entre un enlace iónico y uno covalente?",
  },
  {
    subject: "quimica",
    name: "pH",
    prompt: "¿Qué mide el pH? Dame ejemplos de sustancias ácidas y básicas.",
  },
  {
    subject: "quimica",
    name: "Mezclas",
    prompt: "¿Qué diferencia hay entre una mezcla homogénea y una heterogénea?",
  },
  // Biología
  {
    subject: "biologia",
    name: "Célula",
    prompt: "Explicame la célula sin dar por sabido el vocabulario.",
  },
  {
    subject: "biologia",
    name: "Fotosíntesis",
    prompt: "¿Cómo funciona la fotosíntesis? Hacé un diagrama simple.",
  },
  { subject: "biologia", name: "Mitosis", prompt: "¿Qué diferencia hay entre mitosis y meiosis?" },
  {
    subject: "biologia",
    name: "ADN",
    prompt: "¿Qué es el ADN y para qué sirve? Explicalo simple.",
  },
  {
    subject: "biologia",
    name: "Ecosistemas",
    prompt: "¿Qué es una cadena alimentaria? Dame un ejemplo con productores y consumidores.",
  },
  {
    subject: "biologia",
    name: "Digestión",
    prompt: "Explicame el recorrido de la comida en el sistema digestivo.",
  },
  // Historia
  {
    subject: "historia",
    name: "Revolución de Mayo",
    prompt: "¿Qué pasó en la Revolución de Mayo de 1810? Resumilo.",
  },
  {
    subject: "historia",
    name: "Independencia",
    prompt: "¿Por qué se declaró la independencia en Tucumán en 1816?",
  },
  {
    subject: "historia",
    name: "San Martín",
    prompt: "¿Qué hizo San Martín en el cruce de los Andes? Los puntos clave.",
  },
  {
    subject: "historia",
    name: "Revolución Francesa",
    prompt: "¿Cuáles fueron las causas de la Revolución Francesa?",
  },
  {
    subject: "historia",
    name: "Primera Guerra",
    prompt: "Resumime las causas de la Primera Guerra Mundial.",
  },
  {
    subject: "historia",
    name: "Revolución Industrial",
    prompt: "¿Qué cambió con la Revolución Industrial? Hacé una línea de tiempo.",
  },
  // Geografía
  {
    subject: "geografia",
    name: "Relieve argentino",
    prompt: "¿Cuáles son las grandes regiones del relieve argentino?",
  },
  {
    subject: "geografia",
    name: "Clima",
    prompt: "¿Qué diferencia hay entre clima y tiempo atmosférico?",
  },
  {
    subject: "geografia",
    name: "Placas tectónicas",
    prompt: "¿Qué son las placas tectónicas y cómo causan los sismos?",
  },
  {
    subject: "geografia",
    name: "Coordenadas",
    prompt: "Explicame latitud y longitud con un ejemplo.",
  },
  {
    subject: "geografia",
    name: "Ciclo del agua",
    prompt: "Explicame el ciclo del agua con un diagrama.",
  },
  // Lengua
  {
    subject: "lengua",
    name: "Sujeto y predicado",
    prompt: "¿Cómo reconozco el sujeto y el predicado de una oración?",
  },
  {
    subject: "lengua",
    name: "Tildes",
    prompt: "Explicame las reglas de tildación: agudas, graves y esdrújulas.",
  },
  {
    subject: "lengua",
    name: "Texto argumentativo",
    prompt: "¿Cómo se arma un texto argumentativo? Estructura y un ejemplo corto.",
  },
  {
    subject: "lengua",
    name: "Figuras retóricas",
    prompt: "Explicame metáfora, comparación e hipérbole con ejemplos.",
  },
  {
    subject: "lengua",
    name: "Narrador",
    prompt: "¿Qué tipos de narrador hay? Dame un ejemplo de cada uno.",
  },
  // Inglés
  {
    subject: "ingles",
    name: "Present simple",
    prompt: "Explicame el present simple en inglés con ejemplos y errores comunes.",
  },
  {
    subject: "ingles",
    name: "Past simple",
    prompt: "¿Cómo se forma el past simple? Verbos regulares e irregulares.",
  },
  {
    subject: "ingles",
    name: "Present perfect",
    prompt: "¿Cuándo uso present perfect y cuándo past simple?",
  },
  {
    subject: "ingles",
    name: "Phrasal verbs",
    prompt: "Explicame qué son los phrasal verbs con 5 ejemplos comunes.",
  },
  // Programación
  {
    subject: "programacion",
    name: "Algoritmo",
    prompt: "¿Qué es un algoritmo? Dame un ejemplo de la vida diaria.",
  },
  {
    subject: "programacion",
    name: "Variables",
    prompt: "Explicame qué es una variable en programación con un ejemplo en Python.",
  },
  {
    subject: "programacion",
    name: "Bucles",
    prompt: "¿Qué es un bucle for? Mostrame un ejemplo simple en Python.",
  },
  {
    subject: "programacion",
    name: "Binario",
    prompt: "¿Cómo funciona el sistema binario? Pasá 13 a binario paso a paso.",
  },
  // Economía
  {
    subject: "economia",
    name: "Oferta y demanda",
    prompt: "Explicame la ley de oferta y demanda con un gráfico simple.",
  },
  {
    subject: "economia",
    name: "Inflación",
    prompt: "¿Qué es la inflación y por qué suben los precios? Explicalo simple.",
  },
  {
    subject: "economia",
    name: "Interés",
    prompt: "¿Qué diferencia hay entre interés simple y compuesto? Con un ejemplo.",
  },
  {
    subject: "economia",
    name: "Presupuesto",
    prompt: "¿Cómo armo un presupuesto personal simple? Pasos cortos.",
  },
];

export const MISSIONS_SHOWN = 6;

/**
 * Picks `count` missions: one per subject first (random subjects), never the
 * missions of `previous` when the pool allows it, so two sets in a row differ.
 */
export function pickMissions(
  previous: readonly string[] = [],
  random: () => number = Math.random,
  pool: readonly Mission[] = MISSIONS,
  count = MISSIONS_SHOWN,
): Mission[] {
  const shuffle = <T>(list: T[]) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const fresh = pool.filter((mission) => !previous.includes(mission.name));
  const source = fresh.length >= count ? fresh : [...pool];
  const picked: Mission[] = [];
  const subjects = new Set<string>();
  for (const mission of shuffle(source)) {
    if (picked.length >= count) break;
    if (subjects.has(mission.subject)) continue;
    subjects.add(mission.subject);
    picked.push(mission);
  }
  for (const mission of shuffle(source)) {
    if (picked.length >= count) break;
    if (!picked.includes(mission)) picked.push(mission);
  }
  return picked;
}
