/**
 * Fichas desde el chat (NEXO 2.6): turns one tutor explanation into study
 * cards on the device. No model call; practice works offline because the
 * cards live in localStorage. If the tutor answered in the "P: … / R: …"
 * format (the student can ask for it), those pairs are used as-is.
 */

export const CHAT_CARD_CAP = 150;
export const CARDS_PER_ANSWER = 8;
export const FRONT_MAX = 160;
export const BACK_MAX = 420;

export type DraftCard = { front: string; back: string };

export type ChatCard = DraftCard & {
  id: string;
  at: number;
  /** Conversation title or question the card came from. */
  source: string;
};

/** Prompt that asks the tutor to rewrite its last explanation as cards. */
export const CARDS_PROMPT =
  "Convertí tu explicación anterior en 6 fichas de estudio. Usá exactamente este formato, una ficha por bloque, sin nada más:\nP: pregunta corta\nR: respuesta corta (una o dos frases)";

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

function norm(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Markdown → plain lines the parser can read. Diagrams and charts are dropped. */
export function plainLines(markdown: string): string[] {
  return String(markdown ?? "")
    .replace(/```(?:mermaid|grafico)[\s\S]*?```/gi, "\n")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, f: string) => ` ${f.trim()} `)
    .replace(/\$([^$\n]+)\$/g, "$1")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ""));
}

function stripInline(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|[.,;:]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÑ0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstSentences(text: string, n: number) {
  return sentences(text).slice(0, n).join(" ");
}

/** "P: … / R: …" or "Pregunta: … / Respuesta: …" pairs. */
export function parseQaPairs(markdown: string): DraftCard[] {
  const lines = plainLines(markdown).map((line) =>
    stripInline(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")),
  );
  const cards: DraftCard[] = [];
  let front = "";
  let back = "";
  const flush = () => {
    if (front && back) cards.push({ front, back });
    front = "";
    back = "";
  };
  for (const line of lines) {
    const q = /^(?:P|Pregunta|Frente)\s*\d*\s*[:.)-]\s*(.+)$/i.exec(line);
    const a = /^(?:R|Respuesta|Atr[aá]s|Dorso)\s*\d*\s*[:.)-]\s*(.+)$/i.exec(line);
    if (q) {
      flush();
      front = q[1].trim();
    } else if (a && front) {
      back = a[1].trim();
    } else if (back && line.trim()) {
      back = `${back} ${line.trim()}`;
    } else if (!line.trim() && back) {
      flush();
    }
  }
  flush();
  return cards;
}

const DEF_VERBS =
  /^(.{3,60}?)\s+(es|son|significa|significan|se define como|se llama|se llaman|consiste en|sirve para|se refiere a)\s+(.{12,})$/i;
const STOP_STARTS =
  /^(esto|eso|esta|este|ese|esa|aquí|así|también|pero|y|o|entonces|por eso|es decir|en resumen|primero|después|luego|si|cuando|no|sí)\b/i;

/** "Fase luminosa" → "fase luminosa"; keeps "ADN" and "Ciclo de Calvin". */
function softLower(term: string) {
  const words = term.split(/\s+/);
  if (words.slice(1).some((w) => /^\p{Lu}/u.test(w))) return term;
  return /^\p{Lu}\p{Ll}/u.test(term) ? term[0].toLowerCase() + term.slice(1) : term;
}

function looksLikeTerm(term: string) {
  const words = term.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 7 && !/[?¿!]/.test(term) && !STOP_STARTS.test(term);
}

/**
 * Cards from one explanation (local). Order of preference:
 * 1. "P:/R:" pairs; 2. "**término**: definición" and "término: definición" items;
 * 3. headings with their first lines; 4. "X es Y" sentences; 5. a numbered
 * procedure as one card; 6. fallback: the question and a short summary.
 */
/** "¿Qué es la célula?" / "La célula" → "celula" (to spot two cards about one idea). */
function termKey(front: string) {
  const bare = front
    .replace(/^¿\s*/, "")
    .replace(/\?$/, "")
    .replace(/^(qué es|qué son|para qué sirve|para qué sirven|en qué consiste)\s+/i, "")
    .replace(/^(el|la|los|las|un|una|lo)\s+/i, "");
  return bare.split(/\s+/).length <= 4 ? norm(bare) : "";
}

export function cardsFromAnswer(
  markdown: string,
  question = "",
  max = CARDS_PER_ANSWER,
): DraftCard[] {
  const out: DraftCard[] = [];
  const seen = new Set<string>();
  const terms = new Set<string>();
  const push = (front: string, back: string) => {
    const f = clip(stripInline(front).replace(/[:\s]+$/, ""), FRONT_MAX);
    const b = clip(stripInline(back), BACK_MAX);
    if (f.length < 3 || b.length < 3) return;
    const key = norm(f);
    // One card per idea: "La célula" and "¿Qué es célula?" are the same card.
    const term = termKey(f);
    if (!key || seen.has(key) || norm(b) === key || (term && terms.has(term))) return;
    seen.add(key);
    if (term) terms.add(term);
    out.push({ front: f, back: b });
  };

  const pairs = parseQaPairs(markdown);
  if (pairs.length > 0) {
    for (const pair of pairs) {
      if (out.length >= max) break;
      push(pair.front, pair.back);
    }
    if (out.length > 0) return out;
  }

  const lines = plainLines(markdown);
  const steps: string[] = [];
  let heading = "";
  let headingBody = "";
  // Only the first paragraph under a heading belongs to its card.
  const flushHeading = () => {
    if (heading && headingBody) push(heading, firstSentences(headingBody, 2));
    heading = "";
    headingBody = "";
  };

  for (const rawLine of lines) {
    if (out.length >= max) break;
    const line = rawLine.trim();
    if (!line) {
      if (headingBody) flushHeading();
      continue;
    }
    const h = /^#{1,4}\s+(.+)$/.exec(line);
    if (h) {
      flushHeading();
      const title = stripInline(h[1]);
      if (looksLikeTerm(title.replace(/^\d+[.)]\s*/, "")))
        heading = title.replace(/^\d+[.)]\s*/, "");
      continue;
    }
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);
    const body = bullet ? bullet[1] : line;
    if (/^\d+[.)]\s+/.test(line)) steps.push(stripInline(body));
    if (bullet && headingBody) flushHeading();

    // "**Término**: definición" / "**Término** — definición"
    const bold = /^\*\*([^*]{2,70}?)(:?)\*\*\s*([:—–=-])?\s*(.{8,})$/.exec(body);
    if (bold && (bold[2] || bold[3])) {
      const term = stripInline(bold[1]).trim();
      if (looksLikeTerm(term)) {
        const front = /\d/.test(term) ? term : `¿Qué es ${softLower(term)}?`;
        push(front, bold[4]);
        continue;
      }
    }
    // "Término: definición" in a list item
    const colon = bullet ? /^([^:]{2,60}):\s+(.{8,})$/.exec(stripInline(body)) : null;
    if (colon && looksLikeTerm(colon[1])) {
      push(colon[1], colon[2]);
      continue;
    }
    if (heading && !bullet) {
      headingBody = headingBody ? `${headingBody} ${stripInline(body)}` : stripInline(body);
    }
  }
  flushHeading();

  if (out.length < max) {
    const text = lines
      .filter((line) => !/^\s*(#|[-*•]|\d+[.)]|\|)/.test(line))
      .map(stripInline)
      .join(" ");
    for (const sentence of sentences(text)) {
      if (out.length >= max) break;
      const match = DEF_VERBS.exec(sentence.replace(/[.!]+$/, ""));
      if (!match) continue;
      const term = match[1].replace(/^(el|la|los|las|un|una)\s+/i, "").trim();
      if (!looksLikeTerm(term)) continue;
      const verb = match[2].toLowerCase();
      const front =
        verb === "sirve para"
          ? `¿Para qué sirve ${softLower(term)}?`
          : verb.startsWith("consiste")
            ? `¿En qué consiste ${softLower(term)}?`
            : `¿Qué ${verb === "son" || verb === "significan" || verb === "se llaman" ? "son" : "es"} ${softLower(term)}?`;
      push(front, sentence);
    }
  }

  if (out.length < max && steps.length >= 3) {
    const topic = clip(stripInline(question), 90) || "este procedimiento";
    push(`Pasos: ${topic}`, steps.map((s, i) => `${i + 1}) ${s}`).join(" "));
  }

  if (out.length === 0) {
    const text = lines.map(stripInline).filter(Boolean).join(" ");
    const summary = firstSentences(text, 3);
    if (summary) push(clip(stripInline(question), FRONT_MAX) || "Idea principal", summary);
  }
  return out.slice(0, max);
}

export function sanitizeChatCards(value: unknown): ChatCard[] {
  if (!Array.isArray(value)) return [];
  const out: ChatCard[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<ChatCard>;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 80) continue;
    if (typeof item.front !== "string" || typeof item.back !== "string") continue;
    const front = clip(item.front, FRONT_MAX);
    const back = clip(item.back, BACK_MAX);
    if (!front || !back || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({
      id: item.id,
      front,
      back,
      at: typeof item.at === "number" && Number.isFinite(item.at) ? item.at : 0,
      source: typeof item.source === "string" ? clip(item.source, 120) : "",
    });
    if (out.length >= CHAT_CARD_CAP) break;
  }
  return out;
}

/**
 * Adds new cards (newest first). A card with the same front as an existing
 * one replaces it. Returns how many were added.
 */
export function addChatCards(
  list: ChatCard[],
  drafts: DraftCard[],
  source: string,
  now: number,
  makeId: () => string,
): { list: ChatCard[]; added: number } {
  const fresh: ChatCard[] = [];
  const keys = new Set<string>();
  for (const draft of drafts) {
    const front = clip(draft.front, FRONT_MAX);
    const back = clip(draft.back, BACK_MAX);
    const key = norm(front);
    if (!front || !back || !key || keys.has(key)) continue;
    keys.add(key);
    fresh.push({ id: makeId(), front, back, at: now, source: clip(source, 120) });
  }
  const kept = sanitizeChatCards(list).filter((card) => !keys.has(norm(card.front)));
  return { list: sanitizeChatCards([...fresh, ...kept]), added: fresh.length };
}
