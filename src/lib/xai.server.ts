import { responseText } from "@/lib/exam";

export class UpstreamError extends Error {
  constructor(readonly status: number) {
    super(`xAI responded ${status}`);
  }
}

type Content =
  | string
  | (
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "high" }
    )[];

/**
 * One non-streaming grok-4.5 call with Structured Outputs (json_schema,
 * strict). Returns the text of the final message (a JSON string).
 */
export async function structuredCall(options: {
  apiKey: string;
  system: string;
  content: Content;
  name: string;
  schema: object;
  maxTokens: number;
  temperature: number;
  signal: AbortSignal;
}) {
  const upstream = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    signal: options.signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({
      model: "grok-4.5",
      stream: false,
      store: false,
      max_output_tokens: options.maxTokens,
      temperature: options.temperature,
      text: {
        format: { type: "json_schema", name: options.name, schema: options.schema, strict: true },
      },
      input: [
        { role: "system", content: options.system },
        { role: "user", content: options.content },
      ],
    }),
  });
  if (!upstream.ok) throw new UpstreamError(upstream.status);
  return responseText(await upstream.json());
}
