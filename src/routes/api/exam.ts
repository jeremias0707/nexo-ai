import { createFileRoute } from "@tanstack/react-router";
import {
  checkExamRequest,
  EXAM_SCHEMA,
  examUserPrompt,
  parseExamOutput,
  type ExamPaper,
} from "@/lib/exam";
import { tooManyRequests } from "@/lib/rate-limit.server";
import { examSystemPrompt } from "@/lib/tutor.server";
import { clientIp, structuredCall, UpstreamError } from "@/lib/xai.server";

/** Exam generation is a big request: it counts as this many chat messages. */
const EXAM_WEIGHT = 3;
const DEADLINE_MS = 55_000;
/** Only retry a bad answer if there is still this much time left. */
const RETRY_MIN_MS = 20_000;

export const Route = createFileRoute("/api/exam")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "No pude leer el pedido de examen." }, { status: 400 });
        }
        const checked = checkExamRequest(payload);
        if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });
        const exam = checked.request;

        if (await tooManyRequests(clientIp(request), EXAM_WEIGHT)) {
          return Response.json(
            { error: "Demasiados pedidos seguidos. Esperá un minuto y armá el examen de nuevo." },
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

        const started = Date.now();
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]);
        const text = examUserPrompt(exam);
        const content = exam.image
          ? [
              { type: "input_image" as const, image_url: exam.image, detail: "high" as const },
              { type: "input_text" as const, text },
            ]
          : text;

        let paper: ExamPaper | null = null;
        let refusal = "";
        for (let attempt = 0; attempt < 2 && !paper; attempt += 1) {
          if (attempt > 0 && Date.now() - started > DEADLINE_MS - RETRY_MIN_MS) break;
          try {
            const output = await structuredCall({
              apiKey,
              system: examSystemPrompt(),
              content,
              name: "examen",
              schema: EXAM_SCHEMA,
              maxTokens: 8000,
              temperature: attempt === 0 ? 0.3 : 0.2,
              signal,
            });
            const parsed = parseExamOutput(output, exam.count);
            if (parsed.ok) {
              paper = parsed.paper;
            } else {
              // The model declined (empty list + reason in the title): don't retry.
              try {
                const data = JSON.parse(output) as { title?: unknown; questions?: unknown };
                if (
                  Array.isArray(data.questions) &&
                  data.questions.length === 0 &&
                  typeof data.title === "string"
                ) {
                  refusal = data.title.slice(0, 200);
                  break;
                }
              } catch {
                // fall through to the retry
              }
            }
          } catch (error) {
            if (error instanceof UpstreamError) {
              const imageRejected =
                Boolean(exam.image) && [400, 413, 415, 422].includes(error.status);
              return Response.json(
                {
                  error:
                    error.status === 429
                      ? "El modelo está ocupado. Esperá un momento."
                      : imageRejected
                        ? "No pude leer la foto. Probá con otra más nítida (JPG o PNG)."
                        : "No pude armar el examen. Probá de nuevo.",
                },
                { status: error.status === 429 ? 429 : imageRejected ? 422 : 502 },
              );
            }
            const timedOut = !request.signal.aborted;
            return Response.json(
              {
                error: timedOut
                  ? "El examen tardó demasiado. Probá con menos preguntas."
                  : "Se canceló el pedido.",
              },
              { status: timedOut ? 504 : 499 },
            );
          }
        }

        if (!paper) {
          return Response.json(
            {
              error: refusal
                ? `No pude armar ese examen: ${refusal}`
                : "No pude armar el examen. Probá de nuevo o con otro tema.",
            },
            { status: 422 },
          );
        }
        return Response.json(paper, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
