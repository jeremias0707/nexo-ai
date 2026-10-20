/**
 * NEXO: el manifest de la plataforma es genérico ("Grok App", negro, solo 180px).
 * Este middleware corre antes que grok-pwa.ts (orden alfabético) y responde la
 * misma URL con el manifest propio de NEXO (nombre, colores, íconos 192/512 y
 * maskable). Así el HTML tiene un solo <link rel="manifest"> y el inyector de
 * la plataforma no agrega otro. Sin service worker: nada se cachea offline.
 */
import nexoManifest from "../../public/manifest.webmanifest?raw";

interface NexoEvent {
  url: URL;
  req: { method: string };
}

export default function nexoManifestMiddleware(
  event: NexoEvent,
  next: () => unknown | Promise<unknown>,
): unknown {
  const method = (event.req.method ?? "GET").toUpperCase();
  const path = event.url.pathname;
  if (
    (method === "GET" || method === "HEAD") &&
    (path === "/__grok/manifest.webmanifest" || path === "/__grok/manifest.json")
  ) {
    return new Response(method === "HEAD" ? null : nexoManifest, {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }
  return next();
}
