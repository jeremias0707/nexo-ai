import { createFileRoute } from "@tanstack/react-router";
import { parseChatBody } from "@/lib/chat-payload";
import { tooManyRequests } from "@/lib/rate-limit.server";
import { explainAddon, replyAddon } from "@/lib/settings";
import { systemPrompt } from "@/lib/tutor.server";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return "local";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "No pude leer la pregunta." }, { status: 400 });
        }

        const parsed = parseChatBody(payload);
        if (!parsed.ok) {
          return Response.json({ error: parsed.error }, { status: 400 });
        }

        if (await tooManyRequests(clientIp(request))) {
          return Response.json(
            { error: "Demasiadas preguntas seguidas. Espera un momento." },
            { status: 429 },
          );
        }

        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "NEXO AI no está disponible en este momento." },
            { status: 503 },
          );
        }

        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]);
        let upstream: Response;
        try {
          upstream = await fetch("https://api.x.ai/v1/responses", {
            method: "POST",
            signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "grok-4.5",
              stream: true,
              // xAI advises not storing server-side history when sending images.
              store: false,
              max_output_tokens: 1000,
              temperature: 0.4,
              tools: [{ type: "web_search" }],
              input: [
                { role: "system", content: systemPrompt() + explainAddon(parsed.explain) + replyAddon(parsed.reply) },
                ...parsed.input,
              ],
            }),
          });
        } catch {
          return Response.json(
            { error: "No pude alcanzar el modelo. Inténtalo de nuevo." },
            { status: 502 },
          );
        }

        if (!upstream.ok || !upstream.body) {
          const imageRejected = parsed.hasImage && [400, 413, 415, 422].includes(upstream.status);
          return Response.json(
            {
              error:
                upstream.status === 429
                  ? "El modelo está ocupado. Espera un momento."
                  : imageRejected
                    ? "No pude leer la imagen. Probá con otra foto (JPG o PNG, bien iluminada) o escribí el ejercicio."
                    : "No pude completar la explicación.",
            },
            { status: upstream.status === 429 ? 429 : imageRejected ? 422 : 502 },
          );
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = upstream.body.getReader();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let buffer = "";
            let announced = false;
            const cited: string[] = [];
            const found: string[] = [];
            const send = (payload: unknown) => {
              controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
            };
            const keep = (list: string[], url: string) => {
              if (!url.startsWith("https://") && !url.startsWith("http://")) return;
              if (list.includes(url) || list.length >= 4) return;
              list.push(url);
            };
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (!data || data === "[DONE]") continue;
                  let json: {
                    type?: string;
                    delta?: string;
                    annotation?: { url?: string };
                    item?: {
                      type?: string;
                      action?: { sources?: { url?: string }[] };
                    };
                  };
                  try {
                    json = JSON.parse(data) as typeof json;
                  } catch {
                    continue;
                  }
                  if (
                    !announced &&
                    (json.type === "response.web_search_call.searching" ||
                      json.type === "response.web_search_call.in_progress")
                  ) {
                    announced = true;
                    send({ k: "search" });
                  }
                  if (json.type === "response.output_text.delta" && json.delta) {
                    send({ k: "delta", t: json.delta });
                  }
                  if (
                    json.type === "response.output_text.annotation.added" &&
                    json.annotation?.url
                  ) {
                    keep(cited, json.annotation.url);
                  }
                  if (
                    json.type === "response.output_item.done" &&
                    json.item?.type === "web_search_call"
                  ) {
                    for (const source of json.item.action?.sources ?? []) {
                      if (source.url) keep(found, source.url);
                    }
                  }
                }
              }
              const sources = cited.length > 0 ? cited : found;
              if (sources.length > 0) send({ k: "sources", u: sources });
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
          cancel() {
            void reader.cancel();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
