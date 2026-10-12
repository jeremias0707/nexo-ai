/**
 * Exportar resumen (NEXO 2.6): a study summary built on the device from the
 * current conversation, the weekly plan, the daily goal, cards and recent
 * exams. Rendered as plain text (.txt) or as a simple PDF (see pdf.ts).
 * Nothing is uploaded.
 */

export type Block = { kind: "h1" | "h2" | "p" | "li" | "meta"; text: string };

export type SummaryInput = {
  date: string;
  nick?: string;
  conversation?: {
    title: string;
    messages: { role: "user" | "assistant"; content: string }[];
  } | null;
  plan?: {
    subject: string;
    examDayText: string;
    done: number;
    total: number;
    days: { label: string; tasks: { title: string; done: boolean }[] }[];
  } | null;
  goal?: {
    goal: number;
    todayMinutes: number;
    streak: number;
    best: number;
    weekMinutes: number;
  } | null;
  cards?: { front: string; back: string }[];
  exams?: { day: string; topic: string; nota: string; count: number }[];
  mistakes?: string[];
};

export const EXPORT_MESSAGE_MAX = 40;
export const EXPORT_CHARS_MAX = 60_000;

const TEX: Record<string, string> = {
  sqrt: "√",
  cdot: "·",
  times: "×",
  div: "÷",
  pi: "π",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  theta: "θ",
  Delta: "Δ",
  delta: "δ",
  lambda: "λ",
  mu: "μ",
  sigma: "σ",
  omega: "ω",
  Omega: "Ω",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  neq: "≠",
  approx: "≈",
  rightarrow: "→",
  to: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  infty: "∞",
  pm: "±",
  degree: "°",
  circ: "°",
  left: "",
  right: "",
  quad: " ",
  sum: "∑",
  int: "∫",
};

/** LaTeX formula → readable text ("C_6H_{12}O_6" → "C6H12O6", "\frac{a}{b}" → "(a)/(b)"). */
export function cleanFormula(formula: string) {
  let f = formula.trim();
  for (let i = 0; i < 3; i += 1) {
    f = f
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
  }
  return f
    .replace(/\\([A-Za-z]+)/g, (_, cmd: string) => TEX[cmd] ?? cmd)
    .replace(/_\{([^{}]*)\}/g, "$1")
    .replace(/_([A-Za-z0-9])/g, "$1")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/\\[,;! ]/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Markdown answer → readable plain paragraphs. Diagrams/charts become a note. */
export function markdownToPlain(markdown: string): string {
  return String(markdown ?? "")
    .replace(/```mermaid[\s\S]*?```/gi, "[Diagrama: miralo en la app]")
    .replace(/```grafico[\s\S]*?```/gi, "[Gráfico: miralo en la app]")
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, (_, code: string) => code.trim())
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, f: string) => cleanFormula(f))
    .replace(/\$([^$\n]+)\$/g, (_, f: string) => cleanFormula(f))
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function paragraphs(text: string, kind: "p" | "li" = "p"): Block[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith("• ") ? { kind: "li" as const, text: line.slice(2) } : { kind, text: line },
    );
}

export function summaryBlocks(input: SummaryInput): Block[] {
  const blocks: Block[] = [];
  blocks.push({ kind: "h1", text: "Resumen de estudio · NEXO AI" });
  blocks.push({ kind: "meta", text: `${input.date}${input.nick ? ` · ${input.nick}` : ""}` });

  if (input.goal) {
    const g = input.goal;
    blocks.push({ kind: "h2", text: "Racha y meta diaria" });
    blocks.push({
      kind: "li",
      text: `Meta: ${g.goal} minutos por día · hoy: ${g.todayMinutes} min`,
    });
    blocks.push({
      kind: "li",
      text: `Racha de estudio: ${g.streak} ${g.streak === 1 ? "día" : "días"} (mejor: ${g.best})`,
    });
    blocks.push({ kind: "li", text: `Últimos 7 días: ${g.weekMinutes} minutos` });
  }

  if (input.plan) {
    const p = input.plan;
    blocks.push({ kind: "h2", text: `Plan de estudio: ${p.subject}` });
    blocks.push({
      kind: "meta",
      text: `Examen: ${p.examDayText} · ${p.done}/${p.total} tareas hechas`,
    });
    for (const day of p.days) {
      blocks.push({ kind: "p", text: day.label });
      for (const task of day.tasks) {
        blocks.push({ kind: "li", text: `${task.done ? "[x]" : "[ ]"} ${task.title}` });
      }
    }
  }

  if (input.exams && input.exams.length > 0) {
    blocks.push({ kind: "h2", text: "Últimos exámenes de práctica" });
    for (const exam of input.exams.slice(0, 8)) {
      blocks.push({
        kind: "li",
        text: `${exam.day} · ${exam.topic} · nota ${exam.nota}/10 (${exam.count} preguntas)`,
      });
    }
  }

  if (input.mistakes && input.mistakes.length > 0) {
    blocks.push({ kind: "h2", text: "Para repasar (errores guardados)" });
    for (const m of input.mistakes.slice(0, 10)) blocks.push({ kind: "li", text: m });
  }

  if (input.cards && input.cards.length > 0) {
    blocks.push({ kind: "h2", text: `Fichas (${input.cards.length})` });
    for (const card of input.cards.slice(0, 40)) {
      blocks.push({ kind: "li", text: `${card.front} → ${card.back}` });
    }
  }

  if (input.conversation && input.conversation.messages.length > 0) {
    const c = input.conversation;
    blocks.push({ kind: "h2", text: `Conversación: ${c.title}` });
    let chars = 0;
    for (const message of c.messages.slice(-EXPORT_MESSAGE_MAX)) {
      const plain =
        message.role === "assistant" ? markdownToPlain(message.content) : message.content.trim();
      if (!plain) continue;
      chars += plain.length;
      if (chars > EXPORT_CHARS_MAX) {
        blocks.push({ kind: "meta", text: "(Se recortó el resto de la conversación.)" });
        break;
      }
      blocks.push({
        kind: "p",
        text: message.role === "user" ? `Pregunta: ${plain.split("\n")[0]}` : "NEXO:",
      });
      if (message.role === "user") {
        const rest = plain.split("\n").slice(1).join("\n");
        if (rest.trim()) blocks.push(...paragraphs(rest));
      } else {
        blocks.push(...paragraphs(plain));
      }
    }
  }

  if (blocks.length <= 2) {
    blocks.push({
      kind: "p",
      text: "Todavía no hay nada para resumir. Estudiá un rato con NEXO y volvé.",
    });
  }
  blocks.push({
    kind: "meta",
    text: "Hecho con NEXO AI. Puede tener errores: revisalo con tu apunte.",
  });
  return blocks;
}

export function blocksToText(blocks: Block[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.kind === "h1")
      lines.push(block.text.toUpperCase(), "=".repeat(Math.min(60, block.text.length)));
    else if (block.kind === "h2")
      lines.push("", block.text, "-".repeat(Math.min(60, block.text.length)));
    else if (block.kind === "li") lines.push(`• ${block.text}`);
    else lines.push(block.text);
  }
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

export function exportFileName(date: string, ext: "txt" | "pdf") {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "hoy";
  return `nexo-resumen-${safe}.${ext}`;
}
