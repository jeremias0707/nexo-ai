import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { online: Boolean(process.env.XAI_API_KEY), vision: true, docs: true },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
