import {
  DOC_MAX_CHARS,
  DOC_MAX_FILE_BYTES,
  DOC_MAX_PAGES,
  DOC_MIN_CHARS_PER_PAGE,
  type DocPayload,
} from "./document.ts";

export const DOC_ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

const SCANNED =
  "Este PDF parece escaneado: no tiene texto para leer. Sacale fotos a las páginas y mandalas con el botón de foto.";

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isText(file: File) {
  return file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(file.name);
}

/** Collapses the whitespace pdf.js leaves between text runs. */
export function tidy(text: string) {
  return text
    .replaceAll(String.fromCharCode(0), "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Joins page texts as "[Página N]" blocks within the character budget.
 * Pure, so it is shared by the PDF path and the tests.
 */
export function joinPages(pages: string[], totalPages: number, maxChars = DOC_MAX_CHARS) {
  let text = "";
  let used = 0;
  let truncated = totalPages > pages.length;
  for (let i = 0; i < pages.length; i += 1) {
    const block = `${i === 0 ? "" : "\n\n"}[Página ${i + 1}]\n${pages[i]}`;
    if (text.length + block.length > maxChars) {
      const room = maxChars - text.length;
      if (room > 200) {
        text += block.slice(0, room);
        used = i + 1;
      }
      truncated = true;
      break;
    }
    text += block;
    used = i + 1;
  }
  return { text, pages: used, truncated };
}

async function readPdf(file: File): Promise<DocPayload> {
  // Loaded only when someone attaches a PDF (keeps the chat bundle small).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    void task.destroy();
    if (err instanceof Error && err.name === "PasswordException") {
      throw new Error("Ese PDF tiene contraseña. Guardalo sin contraseña y probá de nuevo.");
    }
    throw new Error("No pude abrir ese PDF. Probá con otro archivo.");
  }
  try {
    const totalPages = doc.numPages;
    const limit = Math.min(totalPages, DOC_MAX_PAGES);
    const pages: string[] = [];
    let chars = 0;
    for (let n = 1; n <= limit; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let raw = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        raw += item.str + (item.hasEOL ? "\n" : " ");
      }
      const text = tidy(raw);
      pages.push(text);
      chars += text.length;
      page.cleanup();
      if (chars > DOC_MAX_CHARS * 1.2) break;
    }
    const letters = pages.join("").replace(/[^\p{L}\p{N}]/gu, "").length;
    if (letters < DOC_MIN_CHARS_PER_PAGE * Math.max(1, pages.length)) throw new Error(SCANNED);
    const joined = joinPages(pages, totalPages);
    return {
      name: file.name,
      kind: "pdf",
      pages: joined.pages,
      totalPages,
      truncated: joined.truncated,
      text: joined.text,
    };
  } finally {
    void task.destroy();
  }
}

async function readText(file: File): Promise<DocPayload> {
  const raw = tidy(await file.text());
  if (!raw) throw new Error("Ese archivo está vacío.");
  const truncated = raw.length > DOC_MAX_CHARS;
  return {
    name: file.name,
    kind: "text",
    truncated,
    text: truncated ? raw.slice(0, DOC_MAX_CHARS) : raw,
  };
}

/** Extracts the text of a PDF / .txt / .md file. Throws Errors with Spanish messages. */
export async function readDocument(file: File): Promise<DocPayload> {
  if (file.size > DOC_MAX_FILE_BYTES) {
    throw new Error("El archivo es demasiado pesado (máximo 30 MB).");
  }
  if (isPdf(file)) return readPdf(file);
  if (isText(file)) return readText(file);
  throw new Error("Solo puedo leer PDF o apuntes de texto (.txt, .md).");
}
