/**
 * NEXO 2.7: the tutor writes a line starting with "No estoy seguro:" when it
 * doubts a fact (see the Honestidad block of the system prompt). The chat shows
 * a small notice under that answer so the student knows to double-check it.
 */
const UNSURE_LINE = /^[\s>*_]*No estoy segur[oa](?:\/a)?\s*[:.,-]/imu;

export function hasUncertainty(text: string) {
  return UNSURE_LINE.test(text);
}

export const UNSURE_NOTICE = "NEXO no está seguro de una parte: chequeala con tu profe o el libro.";
