import { checkDocument, DOC_DEFAULT_PROMPT, documentContext, type DocPayload } from "./document.ts";
import { MESSAGE_MAX_CHARS, trimHistory, type Turn } from "./history.ts";
import { checkImageDataUrl, IMAGE_DEFAULT_PROMPT, IMAGE_EARLIER_NOTE } from "./image.ts";
import { sanitizeExplain, sanitizeReply, type ExplainDepth, type ReplyMode } from "./settings.ts";
import { sanitizeSubject, type SubjectChoice } from "./subjects.ts";

// Cheap guard against absurd payloads; everything past it is trimmed, not rejected.
const MAX_INCOMING_MESSAGES = 200;

export type InputPart =
  { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" };

export type UpstreamTurn = Turn | { role: "user"; content: InputPart[] };

export type ParsedChat =
  | {
      ok: true;
      input: UpstreamTurn[];
      hasImage: boolean;
      document: DocPayload | null;
      explain: ExplainDepth;
      reply: ReplyMode;
      subject: SubjectChoice;
      mobile: boolean;
    }
  | { ok: false; error: string };

const INVALID = "La pregunta no tiene un formato válido.";

/**
 * Parses the /api/chat body:
 *   { messages, document?, explain?, reply?, subject?, mobile? }
 * `explain` / `reply` / `subject` are optional preference hints.
 * `mobile` (boolean) asks for shorter answers on small screens.
 * Theme, font, XP and nickname are ignored even if a client sends them.
 */
export function parseChatBody(body: unknown): ParsedChat {
  if (!body || typeof body !== "object") return { ok: false, error: INVALID };
  const record = body as Record<string, unknown>;
  const explain = sanitizeExplain(record.explain);
  const reply = sanitizeReply(record.reply);
  const subject = sanitizeSubject(record.subject);
  const mobile = record.mobile === true;
  if (!Array.isArray(record.messages) || record.messages.length === 0) {
    return { ok: false, error: INVALID };
  }
  let document: DocPayload | null = null;
  if (record.document !== undefined && record.document !== null) {
    const check = checkDocument(record.document);
    if (!check.ok) return { ok: false, error: check.error };
    document = check.doc;
  }
  const items = record.messages.slice(-MAX_INCOMING_MESSAGES);
  const last = items.length - 1;
  const messages: (Turn & { image?: string })[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as unknown;
    if (!item || typeof item !== "object") return { ok: false, error: INVALID };
    const turn = item as Record<string, unknown>;
    if (turn.role !== "user" && turn.role !== "assistant") return { ok: false, error: INVALID };
    if (typeof turn.content !== "string") return { ok: false, error: INVALID };
    let content = turn.content.trim().slice(0, MESSAGE_MAX_CHARS);
    const isLatest = turn.role === "user" && index === last;
    const fallback =
      document && turn.newDocument === true ? DOC_DEFAULT_PROMPT : IMAGE_DEFAULT_PROMPT;
    const hasImageField = turn.image !== undefined && turn.image !== null;
    if (isLatest && hasImageField) {
      const check = checkImageDataUrl(turn.image);
      if (!check.ok) return { ok: false, error: check.error };
      messages.push({ role: "user", content: content || fallback, image: check.url });
      continue;
    }
    if (turn.role === "user" && (hasImageField || turn.hadImage === true)) {
      content = content ? `${content}\n${IMAGE_EARLIER_NOTE}` : IMAGE_EARLIER_NOTE;
    }
    if (!content && isLatest && document && turn.newDocument === true) content = DOC_DEFAULT_PROMPT;
    if (!content) continue;
    messages.push({ role: turn.role, content });
  }
  if (messages[messages.length - 1]?.role !== "user") return { ok: false, error: INVALID };

  const kept = trimHistory(messages).messages;
  let hasImage = false;
  const input: UpstreamTurn[] = kept.map((message) => {
    if (message.image) {
      hasImage = true;
      return {
        role: "user",
        content: [
          { type: "input_image", image_url: message.image, detail: "high" },
          { type: "input_text", text: message.content },
        ],
      };
    }
    return { role: message.role, content: message.content };
  });
  if (document) input.unshift({ role: "user", content: documentContext(document) });
  return { ok: true, input, hasImage, document, explain, reply, subject, mobile };
}
