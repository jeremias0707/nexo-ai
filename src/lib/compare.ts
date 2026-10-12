/**
 * Comparar con el apunte (NEXO 2.6). Local, word-based comparison of an answer
 * (the student's or NEXO's) against the text of an attached PDF / notes file.
 * It does not "understand" meaning: it finds, for each sentence, the passage
 * of the notes that shares the most important words, flags numbers that do
 * not match, and lists key words of those pages that the answer never uses.
 * The AI review ("Revisar con NEXO") is a separate, optional chat request.
 */

export type MatchStatus = "coincide" | "parcial" | "no-esta" | "corta";

export type SentenceMatch = {
  sentence: string;
  status: MatchStatus;
  score: number;
  page: number | null;
  /** Best matching passage of the notes (trimmed). */
  quote: string;
  /** Words of the sentence that never appear in the notes. */
  unknown: string[];
  /** Numbers in the sentence that differ from the numbers of the passage. */
  numberDiff: { yours: string[]; notes: string[] } | null;
};

export type CompareResult = {
  sentences: SentenceMatch[];
  counts: { coincide: number; parcial: number; noEsta: number };
  /** 0–1, mean score of the counted sentences. */
  coverage: number;
  /** Important words from the matching pages that the answer does not use. */
  missing: { word: string; page: number | null }[];
};

export const COMPARE_ANSWER_MAX = 6000;

const STOP = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bajo bien cada casi " +
    "como con contra cual cuales cuando cuanto de del desde donde dos el ella ellas ello ellos en entre era " +
    "eran eres es esa esas ese eso esos esta estaba estado estan estar estas este esto estos fue fueron ha " +
    "habia han hasta hay hace hacen hacer la las le les lo los mas me mi mis mucho muy nada ni no nos nosotros " +
    "o otra otras otro otros para pero poco por porque que quien se sea segun ser si sido siempre sin sobre " +
    "solo son su sus tal tambien tan tanto te tiene tienen todo todos tu tus un una uno unos y ya yo " +
    "puede pueden cosa cosas forma vez veces parte decir dice ejemplo tipo etc pag pagina"
  ).split(/\s+/),
);

export function normalizeWord(word: string) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Very light stemming: drop a plural "s" and keep the first 6 letters. */
export function stem(word: string) {
  const w = normalizeWord(word);
  const base = w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;
  return base.slice(0, 6);
}

function words(text: string) {
  return text.match(/[\p{L}][\p{L}\p{N}]*|\d+(?:[.,]\d+)?/gu) ?? [];
}

/** Content words (stems) of a text, with a stem → surface map. */
export function contentStems(text: string, surface?: Map<string, string>) {
  const out: string[] = [];
  for (const word of words(text)) {
    if (/^\d/.test(word)) continue;
    const n = normalizeWord(word);
    if (n.length < 3 || STOP.has(n)) continue;
    const s = stem(word);
    out.push(s);
    if (surface && !surface.has(s)) surface.set(s, word.toLowerCase());
  }
  return out;
}

export function numbersIn(text: string) {
  return [...new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")))];
}

export function splitSentences(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((s) => s.length > 0);
}

type Passage = { page: number | null; text: string; stems: Set<string> };

/** Notes → overlapping passages of two sentences, each with its page. */
export function passagesOf(doc: string): Passage[] {
  const chunks: { page: number | null; text: string }[] = [];
  const parts = doc.split(/\[Página (\d+)\]/);
  if (parts.length === 1) chunks.push({ page: null, text: doc });
  else {
    if (parts[0].trim()) chunks.push({ page: null, text: parts[0] });
    for (let i = 1; i < parts.length; i += 2) {
      chunks.push({ page: Number(parts[i]), text: parts[i + 1] ?? "" });
    }
  }
  const passages: Passage[] = [];
  for (const chunk of chunks) {
    const list = splitSentences(chunk.text);
    for (let i = 0; i < list.length; i += 1) {
      const text = list[i] + (list[i + 1] ? ` ${list[i + 1]}` : "");
      const stems = new Set(contentStems(text));
      if (stems.size === 0) continue;
      passages.push({ page: chunk.page, text, stems });
    }
  }
  return passages;
}

function trimQuote(text: string, max = 240) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Markdown → plain text, so a NEXO answer can be compared too. */
export function plainAnswer(markdown: string) {
  return String(markdown ?? "")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\(p[áa]g\.?\s*\d+\)/gi, "")
    .replace(/[*_`#>$|]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function compareWithNotes(answer: string, doc: string): CompareResult {
  const text = plainAnswer(answer).slice(0, COMPARE_ANSWER_MAX);
  const passages = passagesOf(doc);
  // Document frequency of each stem across passages → rare words weigh more.
  const df = new Map<string, number>();
  for (const p of passages) for (const s of p.stems) df.set(s, (df.get(s) ?? 0) + 1);
  const total = Math.max(1, passages.length);
  const idf = (s: string) => Math.log(1 + total / (1 + (df.get(s) ?? 0)));
  const inDoc = (s: string) => df.has(s);

  const results: SentenceMatch[] = [];
  const matchedPassages: Passage[] = [];
  const answerStems = new Set<string>();

  for (const sentence of splitSentences(text)) {
    const surface = new Map<string, string>();
    const stems = [...new Set(contentStems(sentence, surface))];
    stems.forEach((s) => answerStems.add(s));
    if (stems.length < 2) {
      results.push({
        sentence,
        status: "corta",
        score: 0,
        page: null,
        quote: "",
        unknown: [],
        numberDiff: null,
      });
      continue;
    }
    const weightAll = stems.reduce((sum, s) => sum + idf(s), 0) || 1;
    let best: Passage | null = null;
    let bestScore = 0;
    for (const p of passages) {
      let hit = 0;
      for (const s of stems) if (p.stems.has(s)) hit += idf(s);
      const score = hit / weightAll;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    let status: MatchStatus =
      bestScore >= 0.6 ? "coincide" : bestScore >= 0.3 ? "parcial" : "no-esta";
    let numberDiff: SentenceMatch["numberDiff"] = null;
    if (best && status !== "no-esta") {
      const mine = numbersIn(sentence);
      const theirs = numbersIn(best.text);
      const wrong = mine.filter((n) => !theirs.includes(n));
      if (wrong.length > 0 && theirs.length > 0) {
        numberDiff = { yours: wrong, notes: theirs.filter((n) => !mine.includes(n)).slice(0, 4) };
        status = "parcial";
      }
      matchedPassages.push(best);
    }
    results.push({
      sentence,
      status,
      score: Math.round(bestScore * 100) / 100,
      page: best && status !== "no-esta" ? best.page : null,
      quote: best && status !== "no-esta" ? trimQuote(best.text) : "",
      unknown: stems
        .filter((s) => !inDoc(s))
        .map((s) => surface.get(s) ?? s)
        .slice(0, 6),
      numberDiff,
    });
  }

  // Key words of the matched passages that the answer never uses.
  const weight = new Map<string, { w: number; page: number | null; word: string }>();
  for (const p of matchedPassages) {
    const surface = new Map<string, string>();
    for (const s of contentStems(p.text, surface)) {
      if (answerStems.has(s)) continue;
      const word = surface.get(s) ?? s;
      if (word.length < 4) continue;
      const prev = weight.get(s);
      weight.set(s, {
        w: (prev?.w ?? 0) + idf(s),
        page: prev?.page ?? p.page,
        word: prev?.word ?? word,
      });
    }
  }
  const missing = [...weight.values()]
    .sort((a, b) => b.w - a.w)
    .slice(0, 8)
    .map(({ word, page }) => ({ word, page }));

  const counted = results.filter((r) => r.status !== "corta");
  const counts = {
    coincide: counted.filter((r) => r.status === "coincide").length,
    parcial: counted.filter((r) => r.status === "parcial").length,
    noEsta: counted.filter((r) => r.status === "no-esta").length,
  };
  const coverage = counted.length
    ? Math.round(
        (counted.reduce((sum, r) => sum + Math.min(1, r.score), 0) / counted.length) * 100,
      ) / 100
    : 0;
  return { sentences: results, counts, coverage, missing };
}

/** Chat prompt for the optional AI review (the notes travel as the chat document). */
export function compareAiPrompt(answer: string, docName: string) {
  const text = plainAnswer(answer).slice(0, 3500);
  return `Compará esta respuesta con el apunte adjunto «${docName}». Separá en tres partes cortas: «Coincide» (con la página), «Distinto del apunte» (qué dice el apunte en su lugar, con la página) y «Falta» (ideas importantes del apunte que no están). No inventes nada que no esté en el apunte.\n\nRespuesta:\n"""\n${text}\n"""`;
}
