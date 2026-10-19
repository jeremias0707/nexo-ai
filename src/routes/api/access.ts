import { createFileRoute } from "@tanstack/react-router";
import { accessPublicStatus, issueDeviceId } from "@/lib/access.server";

export const Route = createFileRoute("/api/access")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(accessPublicStatus(), {
          headers: { "Cache-Control": "no-store" },
        }),
      // 3.0.2: no access code. Older apps still call this; any code is ignored.
      POST: async () => {
        const result = issueDeviceId();
        return Response.json(
          { token: result.token, caps: result.caps, free: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
