import { createFileRoute } from "@tanstack/react-router";
import { accessPublicStatus, redeemAccessCode } from "@/lib/access.server";

export const Route = createFileRoute("/api/access")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(accessPublicStatus(), {
          headers: { "Cache-Control": "no-store" },
        }),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          payload = {};
        }
        const code =
          payload && typeof payload === "object" && "code" in payload
            ? String((payload as { code?: unknown }).code ?? "")
            : "";
        const result = await redeemAccessCode(code);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }
        return Response.json(
          { token: result.token, caps: result.caps, free: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
