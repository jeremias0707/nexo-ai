import { createFileRoute } from "@tanstack/react-router";
import {
  checkGradeRequest,
  GRADE_SCHEMA,
  gradeUserPrompt,
  parseGradeOutput,
  type GradeResult,
} from "@/lib/exam";
import { runIfWithinQuota } from "@/lib/rate-limit.server";
import { gradeSystemPrompt } from "@/lib/tutor.server";
import { structuredCall, UpstreamError } from "@/lib/xai.server";

export const Route = createFileRoute("/api/exam-grade")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "No pude leer las respuestas." }, { status: 400 });
        }
        const checked = checkGradeRequest(payload);
        if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

        return runIfWithinQuota(
          request,
          {
            bucket: "grade",
            message: "Demasiados pedidos seguidos. Esperá un momento y reintentá.",
          },
          async () => {
            const apiKey = process.env.XAI_API_KEY;
            if (!apiKey) {
              return Response.json(
                { error: "NEXO AI no está disponible en este momento." },
                { status: 503 },
              );
            }

            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
            let results: GradeResult[] | null = null;
            for (let attempt = 0; attempt < 2 && !results; attempt += 1) {
              try {
                const output = await structuredCall({
                  apiKey,
                  system: gradeSystemPrompt(),
                  content: gradeUserPrompt(checked.items, checked.topic),
                  name: "correccion",
                  schema: GRADE_SCHEMA,
                  maxTokens: 3000,
                  temperature: 0.1,
                  signal,
                });
                results = parseGradeOutput(output, checked.items.length);
              } catch (error) {
                const status = error instanceof UpstreamError && error.status === 429 ? 429 : 502;
                return Response.json(
                  {
                    error:
                      status === 429
                        ? "El modelo está ocupado. Esperá un momento."
                        : "No pude corregir las respuestas.",
                  },
                  { status },
                );
              }
            }
            if (!results)
              return Response.json({ error: "No pude corregir las respuestas." }, { status: 502 });
            return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
          },
        );
      },
    },
  },
});
