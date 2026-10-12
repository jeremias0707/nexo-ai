/**
 * Tiny text-only PDF writer (NEXO 2.6 "Exportar resumen"). No dependencies:
 * standard Helvetica fonts with WinAnsi encoding (covers Spanish: á é í ó ú
 * ñ ü ¿ ¡ « »). Characters outside it are replaced by close ASCII or "?".
 */
import type { Block } from "./export-summary.ts";

// Helvetica / Helvetica-Bold advance widths (1/1000 em) for ASCII 32–126.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

const WIN_EXTRA: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "‰": 0x89,
  "‹": 0x8b,
  Œ: 0x8c,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "™": 0x99,
  "›": 0x9b,
  œ: 0x9c,
};
const EXTRA_WIDTH: Record<number, number> = {
  0x80: 556,
  0x82: 222,
  0x84: 333,
  0x85: 1000,
  0x89: 1000,
  0x8b: 333,
  0x8c: 1000,
  0x91: 222,
  0x92: 222,
  0x93: 333,
  0x94: 333,
  0x95: 350,
  0x96: 556,
  0x97: 1000,
  0x99: 1000,
  0x9b: 333,
  0x9c: 944,
  0xa0: 278,
  0xa1: 333,
  0xaa: 370,
  0xab: 556,
  0xb0: 400,
  0xb2: 333,
  0xb3: 333,
  0xb7: 278,
  0xba: 365,
  0xbb: 556,
  0xbd: 834,
  0xbf: 611,
  0xd7: 584,
  0xf7: 584,
};
const REPLACE: Record<string, string> = {
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "↔": "<->",
  "√": "raíz ",
  π: "pi",
  "∞": "infinito",
  Δ: "Delta ",
  α: "alfa",
  β: "beta",
  γ: "gamma",
  θ: "theta",
  λ: "lambda",
  μ: "mu",
  σ: "sigma",
  Ω: "Ohm",
  ω: "omega",
  "∑": "suma ",
  "∫": "integral ",
  "−": "-",
  "⋅": "·",
  "∙": "·",
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "⁴": "^4",
  "⁵": "^5",
  ⁿ: "^n",
  "✓": "[x]",
  "✔": "[x]",
  "✗": "x",
  "✖": "x",
  "\u00a0": " ",
  "\u200b": "",
};

/** Text → WinAnsi bytes as a binary string (one char per byte). */
export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of String(text ?? "")) {
    const code = ch.codePointAt(0) ?? 63;
    if (ch === "\t") out += "    ";
    else if (code < 32) continue;
    else if (code <= 126) out += ch;
    else if (WIN_EXTRA[ch] !== undefined) out += String.fromCharCode(WIN_EXTRA[ch]);
    else if (code >= 160 && code <= 255) out += ch;
    else if (REPLACE[ch] !== undefined) out += toWinAnsi(REPLACE[ch]);
    else {
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      out +=
        base && base !== ch && [...base].every((c) => (c.codePointAt(0) ?? 999) <= 255)
          ? base
          : "?";
    }
  }
  return out;
}

function charWidth(byte: number, bold: boolean) {
  const table = bold ? HELV_BOLD : HELV;
  if (byte >= 32 && byte <= 126) return table[byte - 32];
  if (EXTRA_WIDTH[byte] !== undefined) return byte === 0xbf && bold ? 611 : EXTRA_WIDTH[byte];
  if (byte >= 0xc0) {
    const base = String.fromCharCode(byte).normalize("NFD")[0];
    const b = base.charCodeAt(0);
    if (b >= 32 && b <= 126) return table[b - 32];
  }
  return 556;
}

export function textWidth(encoded: string, size: number, bold = false) {
  let w = 0;
  for (let i = 0; i < encoded.length; i += 1) w += charWidth(encoded.charCodeAt(i), bold);
  return (w * size) / 1000;
}

/** Greedy word wrap on encoded text; very long words are split. */
export function wrapEncoded(
  encoded: string,
  size: number,
  maxWidth: number,
  bold = false,
): string[] {
  const words = encoded.split(/ +/);
  const lines: string[] = [];
  let line = "";
  for (let word of words) {
    while (textWidth(word, size, bold) > maxWidth) {
      let cut = word.length - 1;
      while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > maxWidth) cut -= 1;
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, bold) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function escapePdf(encoded: string) {
  return encoded.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const STYLE: Record<
  Block["kind"],
  { size: number; bold: boolean; gray: boolean; before: number; indent: number }
> = {
  h1: { size: 18, bold: true, gray: false, before: 0, indent: 0 },
  h2: { size: 13, bold: true, gray: false, before: 12, indent: 0 },
  p: { size: 11, bold: false, gray: false, before: 4, indent: 0 },
  li: { size: 11, bold: false, gray: false, before: 2, indent: 14 },
  meta: { size: 9.5, bold: false, gray: true, before: 2, indent: 0 },
};

type Placed = { x: number; y: number; size: number; bold: boolean; gray: boolean; text: string };

/** Lays out blocks into pages of positioned lines. */
export function layout(blocks: Block[]): Placed[][] {
  const pages: Placed[][] = [[]];
  let y = PAGE_H - MARGIN;
  const bottom = MARGIN + 24;
  for (const block of blocks) {
    const style = STYLE[block.kind];
    const leading = style.size * 1.38;
    const width = PAGE_W - MARGIN * 2 - style.indent;
    const lines = wrapEncoded(toWinAnsi(block.text), style.size, width, style.bold);
    y -= style.before;
    // Keep a heading with at least two lines of what follows.
    const need = block.kind === "h2" ? leading * 3 : leading;
    if (y - need < bottom) {
      pages.push([]);
      y = PAGE_H - MARGIN;
    }
    lines.forEach((text, i) => {
      if (y - leading < bottom) {
        pages.push([]);
        y = PAGE_H - MARGIN;
      }
      y -= leading;
      const page = pages[pages.length - 1];
      if (block.kind === "li" && i === 0) {
        page.push({
          x: MARGIN + 3,
          y,
          size: style.size,
          bold: false,
          gray: false,
          text: String.fromCharCode(0x95),
        });
      }
      page.push({
        x: MARGIN + style.indent,
        y,
        size: style.size,
        bold: style.bold,
        gray: style.gray,
        text,
      });
    });
  }
  return pages;
}

/** Builds the PDF file bytes. */
export function blocksToPdf(blocks: Block[], title = "Resumen de estudio"): Uint8Array {
  const pages = layout(blocks);
  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then page + content pairs.
  const firstPage = 6;
  pages.forEach((_, i) => pageIds.push(firstPage + i * 2));

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = `<< /Title (${escapePdf(toWinAnsi(title))}) /Producer (NEXO AI) >>`;

  pages.forEach((placed, i) => {
    const ops: string[] = [];
    for (const line of placed) {
      ops.push(
        `BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${line.gray ? "0.42 0.42 0.42" : "0.08 0.08 0.08"} rg 1 0 0 1 ${line.x.toFixed(2)} ${line.y.toFixed(2)} Tm (${escapePdf(line.text)}) Tj ET`,
      );
    }
    const footer = toWinAnsi(`NEXO AI · página ${i + 1} de ${pages.length}`);
    const fw = textWidth(footer, 8.5);
    ops.push(
      `BT /F1 8.5 Tf 0.5 0.5 0.5 rg 1 0 0 1 ${((PAGE_W - fw) / 2).toFixed(2)} ${(MARGIN - 20).toFixed(2)} Tm (${escapePdf(footer)}) Tj ET`,
    );
    const stream = ops.join("\n");
    const pageId = pageIds[i];
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
