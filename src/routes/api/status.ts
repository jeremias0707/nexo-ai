import { createFileRoute } from "@tanstack/react-router";
import { accessPublicStatus } from "@/lib/access.server";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            online: Boolean(process.env.XAI_API_KEY),
            vision: true,
            docs: true,
            diagrams: true,
            exam: true,
            ...accessPublicStatus(),
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
