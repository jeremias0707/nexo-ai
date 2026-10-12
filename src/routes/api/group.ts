import { createFileRoute } from "@tanstack/react-router";
import { requireDeviceAccess } from "@/lib/access.server";
import { classKey, normalizeClassCode } from "@/lib/group";
import { acceptableDay, groupRateAllows, groupStats, recordGroupScore } from "@/lib/group.server";

/**
 * Modo grupo counter. Same soft gate as the tutor (X-Nexo-Device), but it
 * never calls xAI and does not use the chat / exam quota.
 *   GET  /api/group?code=ABC123&day=YYYY-MM-DD → { done, perfect, average }
 *   POST /api/group { code, day, correct }      → same stats after saving
 */
async function guard(request: Request) {
  const access = await requireDeviceAccess(request);
  if (!access.ok) return { ok: false as const, response: access.response };
  if (!groupRateAllows(access.deviceKey)) {
    return {
      ok: false as const,
      response: Response.json({ error: "Demasiados pedidos. Esperá un minuto." }, { status: 429 }),
    };
  }
  return { ok: true as const, deviceKey: access.deviceKey };
}

const headers = { "Cache-Control": "no-store" };

export const Route = createFileRoute("/api/group")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await guard(request);
        if (!gate.ok) return gate.response;
        const url = new URL(request.url);
        const code = normalizeClassCode(url.searchParams.get("code"));
        const day = url.searchParams.get("day");
        if (!code || !acceptableDay(day)) {
          return Response.json({ error: "Código de clase o fecha inválidos." }, { status: 400 });
        }
        return Response.json(groupStats(await classKey(code), day), { headers });
      },
      POST: async ({ request }) => {
        const gate = await guard(request);
        if (!gate.ok) return gate.response;
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Pedido inválido." }, { status: 400 });
        }
        const record = (body ?? {}) as { code?: unknown; day?: unknown; correct?: unknown };
        const code = normalizeClassCode(record.code);
        if (!code || !acceptableDay(record.day)) {
          return Response.json({ error: "Código de clase o fecha inválidos." }, { status: 400 });
        }
        const correct = typeof record.correct === "number" ? record.correct : 0;
        const key = await classKey(code);
        const saved = recordGroupScore(key, record.day, gate.deviceKey, correct);
        return Response.json({ ...groupStats(key, record.day), saved }, { headers });
      },
    },
  },
});
