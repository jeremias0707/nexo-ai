/**
 * Photo-of-an-exercise input, shared by the client (what it sends) and
 * /api/chat (what it accepts). One image per message, only on the latest user
 * turn; older turns that had a photo are sent as text plus IMAGE_EARLIER_NOTE.
 */
export const IMAGE_MAX_SIDE = 1280;
export const IMAGE_JPEG_QUALITY = 0.8;
/** Base64 payload cap (characters of the data URL). Keeps the request under 4.5 MB. */
export const IMAGE_MAX_BASE64 = 4 * 1024 * 1024;
/** Picked file cap before downscaling (phone photos are usually 2–8 MB). */
export const IMAGE_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const IMAGE_EARLIER_NOTE = "[imagen enviada antes]";
export const IMAGE_DEFAULT_PROMPT = "Explicame paso a paso el ejercicio de la foto.";

const DATA_URL = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/]+={0,2})$/;

export type ImageCheck = { ok: true; url: string } | { ok: false; error: string };

/** Validates a base64 image data URL (JPEG or PNG, under the size cap). */
export function checkImageDataUrl(value: unknown): ImageCheck {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    return { ok: false, error: "La imagen no tiene un formato válido. Usá una foto JPG o PNG." };
  }
  if (value.length > IMAGE_MAX_BASE64) {
    return { ok: false, error: "La imagen es demasiado pesada. Probá con una foto más chica." };
  }
  const match = DATA_URL.exec(value);
  if (!match) {
    return { ok: false, error: "La imagen no tiene un formato válido. Usá una foto JPG o PNG." };
  }
  const kind = match[1] === "png" ? "png" : "jpeg";
  return { ok: true, url: `data:image/${kind};base64,${match[2]}` };
}
