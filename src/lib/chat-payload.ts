import { MESSAGE_MAX_CHARS, trimHistory, type Turn } from "./history.ts";
import { checkImageDataUrl, IMAGE_DEFAULT_PROMPT, IMAGE_EARLIER_NOTE } from "./image.ts";

// Cheap guard against absurd payloads; everything past it is trimmed, not rejected.
const MAX_INCOMING_MESSAGES = 200;

export type InputPart =
  { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" };

export type UpstreamTurn = Turn | { role: "user"; content: InputPart[] };

export type ParsedChat =
  { ok: true; input: UpstreamTurn[]; hasImage: boolean } | { ok: false; error: string };

const INVALID = "La pregunta no tiene un formato válido.";

/**
 * Parses the /api/chat body. Each message is `{ role, content, image?, hadImage? }`.
 * Only the latest user message may carry `image` (a data URL); any earlier turn
 * with a photo is forwarded as text plus IMAGE_EARLIER_NOTE, never re-sent.
 */
export function parseChatBody(body: unknown): ParsedChat {
  if (!body || typeof body !== "object") return { ok: false, error: INVALID };
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.messages) || record.messages.length === 0) {
    return { ok: false, error: INVALID };
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
    const hasImageField = turn.image !== undefined && turn.image !== null;
    if (turn.role === "user" && index === last && hasImageField) {
      const check = checkImageDataUrl(turn.image);
      if (!check.ok) return { ok: false, error: check.error };
      messages.push({ role: "user", content: content || IMAGE_DEFAULT_PROMPT, image: check.url });
      continue;
    }
    if (turn.role === "user" && (hasImageField || turn.hadImage === true)) {
      content = content ? `${content}\n${IMAGE_EARLIER_NOTE}` : IMAGE_EARLIER_NOTE;
    }
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
  return { ok: true, input, hasImage };
}
