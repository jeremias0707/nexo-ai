import { createFileRoute } from "@tanstack/react-router";
import {
  checkKitRequest,
  KIT_CHAT_WEIGHT,
  KIT_SCHEMA,
  kitSystemPrompt,
  kitUserPrompt,
  parseKit,
  type Kit,
} from "@/lib/kit";
import { globalBudgetAllows, requireDeviceAccess } from "@/lib/access.server";
import { runIfWithinQuota } from "@/lib/rate-limit.server";
import { structuredCall, UpstreamError } from "@/lib/xai.server";

const DEADLINE_MS = 55_000;

/** NEXO 3.0: notes (PDF or photos) → summary + flashcards + diagram. */
export const Route = createFileRoute("/api/kit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await requireDeviceAccess(request);
        if (!access.ok) return access.response;

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "No pude leer los apuntes." }, { status: 400 });
        }
        const checked = checkKitRequest(payload);
        if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });
        const kitRequest = checked.request;

        if (!globalBudgetAllows("chat")) {
          return Response.json(
            { error: "NEXO alcanzó el tope general de hoy. Probá mañana." },
            { status: 429 },
          );
        }

        return runIfWithinQuota(
          request,
          {
            weight: KIT_CHAT_WEIGHT,
            bucket: "chat",
            deviceKey: access.deviceKey,
            message: "Vas muy rápido: esperá un minuto y probá de nuevo.",
          },
          async () => {
            const apiKey = process.env.XAI_API_KEY;
            if (!apiKey) {
              return Response.json(
                { error: "NEXO AI no está disponible en este momento." },
                { status: 503 },
              );
            }
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]);
            const text = kitUserPrompt(kitRequest);
            const content = kitRequest.images
              ? [
                  ...kitRequest.images.map((url) => ({
                    type: "input_image" as const,
                    image_url: url,
                    detail: "high" as const,
                  })),
                  { type: "input_text" as const, text },
                ]
              : text;

            let kit: Kit | null = null;
            let error = "No pude armar el kit. Probá de nuevo.";
            try {
              const output = await structuredCall({
                apiKey,
                system: kitSystemPrompt(),
                content,
                name: "kit_estudio",
                schema: KIT_SCHEMA,
                maxTokens: 6000,
                temperature: 0.3,
                signal,
              });
              const parsed = parseKit(output);
              if (parsed.ok) kit = parsed.kit;
              else error = parsed.error;
            } catch (err) {
              if (err instanceof UpstreamError) {
                const imageRejected =
                  Boolean(kitRequest.images) && [400, 413, 415, 422].includes(err.status);
                return Response.json(
                  {
                    error:
                      err.status === 429
                        ? "El modelo está ocupado. Esperá un momento."
                        : imageRejected
                          ? "No pude leer alguna foto. Probá con fotos más nítidas (JPG o PNG)."
                          : "No pude armar el kit. Probá de nuevo.",
                  },
                  { status: err.status === 429 ? 429 : imageRejected ? 422 : 502 },
                );
              }
              return Response.json(
                {
                  error: request.signal.aborted
                    ? "Se canceló el pedido."
                    : "Tardó demasiado. Probá con menos fotos o un PDF más corto.",
                },
                { status: request.signal.aborted ? 499 : 504 },
              );
            }
            if (!kit) return Response.json({ error }, { status: 422 });
            return Response.json(kit, { headers: { "Cache-Control": "no-store" } });
          },
        );
      },
    },
  },
});
