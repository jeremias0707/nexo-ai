/**
 * /diagrama#<base64url(utf-8 mermaid code)>: the Flutter app opens this page to
 * show a mermaid diagram. The code travels in the URL hash, which browsers never
 * send to the server.
 */
export const DIAGRAM_CODE_MAX = 8000;

export function encodeDiagram(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDiagram(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw || raw.length > DIAGRAM_CODE_MAX * 2) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const code = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return code.trim() && code.length <= DIAGRAM_CODE_MAX ? code : null;
  } catch {
    return null;
  }
}
