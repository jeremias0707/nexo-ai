import {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_BASE64,
  IMAGE_MAX_FILE_BYTES,
  IMAGE_MAX_SIDE,
} from "@/lib/image";

export type PreparedImage = {
  /** Sent to the tutor once (max ~1280 px JPEG). Never persisted. */
  full: string;
  /** Small copy kept in the local history for the chat bubble. */
  thumb: string;
};

export const THUMB_MAX_SIDE = 480;
const THUMB_QUALITY = 0.65;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

function encode(img: HTMLImageElement, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  // JPEG has no alpha: paint white so transparent PNGs stay readable.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Downscales a picked photo to JPEG. Throws an Error with a Spanish message. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Ese archivo no es una imagen. Elegí una foto.");
  }
  if (file.size > IMAGE_MAX_FILE_BYTES) {
    throw new Error("La foto es demasiado pesada (máximo 25 MB).");
  }
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error("No pude abrir esa imagen. Probá con una foto JPG o PNG.");
  }
  let full = encode(img, IMAGE_MAX_SIDE, IMAGE_JPEG_QUALITY);
  if (full.length > IMAGE_MAX_BASE64) full = encode(img, 1024, 0.7);
  if (full.length > IMAGE_MAX_BASE64) {
    throw new Error("La imagen es demasiado pesada. Probá con una foto más chica.");
  }
  const thumb = encode(img, THUMB_MAX_SIDE, THUMB_QUALITY);
  return { full, thumb };
}
