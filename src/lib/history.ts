/**
 * Conversation budget shared by the client (what it sends) and /api/chat (what
 * it forwards to the model). Older turns are dropped instead of rejecting the
 * request; the latest user message is always kept.
 */
export const HISTORY_MAX_MESSAGES = 20;
export const HISTORY_MAX_CHARS = 24_000;
export const MESSAGE_MAX_CHARS = 6_000;

export type Turn = { role: "user" | "assistant"; content: string };

export function trimHistory<T extends Turn>(
  messages: T[],
  maxMessages = HISTORY_MAX_MESSAGES,
  maxChars = HISTORY_MAX_CHARS,
): { messages: T[]; dropped: number } {
  const lastUser = messages.map((message) => message.role).lastIndexOf("user");
  if (lastUser === -1) return { messages: [], dropped: messages.length };

  const kept: T[] = [messages[lastUser]];
  let chars = messages[lastUser].content.length;
  for (let i = lastUser - 1; i >= 0 && kept.length < maxMessages; i -= 1) {
    chars += messages[i].content.length;
    if (chars > maxChars) break;
    kept.unshift(messages[i]);
  }
  // Start the window on a user turn so the model never sees an orphan reply.
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();

  return { messages: kept, dropped: messages.length - kept.length };
}
