/** Browser dictation (Web Speech API) and read-aloud (speechSynthesis). Free, on the device/browser. */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => Recognition;

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Spanish message for a SpeechRecognition error code, or null to stay quiet. */
export function dictationError(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "No tengo permiso para usar el micrófono. Permitilo en el candado de la barra de direcciones (o en los ajustes del navegador) y probá de nuevo.";
    case "audio-capture":
      return "No encontré un micrófono. Revisá que esté conectado.";
    case "network":
      return "El dictado necesita internet. Revisá la conexión y probá de nuevo.";
    case "no-speech":
      return "No te escuché. Tocá el micrófono y hablá cerca del teléfono.";
    case "language-not-supported":
      return "Este navegador no puede dictar en español.";
    case "aborted":
      return null;
    default:
      return "No pude usar el dictado. Probá de nuevo o escribí la pregunta.";
  }
}

/** Joins dictated text to what was already typed. */
export function appendDictation(base: string, spoken: string) {
  const clean = spoken.replace(/\s+/g, " ").trim();
  if (!clean) return base;
  if (!base.trim()) return clean.charAt(0).toUpperCase() + clean.slice(1);
  return `${base.replace(/\s+$/, "")} ${clean}`;
}

const MATH_WORDS: [RegExp, string][] = [
  [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, " $1 sobre $2 "],
  [/\\sqrt\{([^{}]*)\}/g, " raíz de $1 "],
  [/\^\{?2\}?/g, " al cuadrado "],
  [/\^\{?3\}?/g, " al cubo "],
  [/\^\{([^{}]*)\}/g, " a la $1 "],
  [/\^(\w)/g, " a la $1 "],
  [/_\{([^{}]*)\}/g, " sub $1 "],
  [/\\cdot|\\times/g, " por "],
  [/\\div/g, " dividido "],
  [/\\pm/g, " más menos "],
  [/\\leq?/g, " menor o igual que "],
  [/\\geq?/g, " mayor o igual que "],
  [/\\neq/g, " distinto de "],
  [/\\approx/g, " aproximadamente "],
  [/\\to|\\rightarrow/g, " tiende a "],
  [/\\infty/g, " infinito "],
  [/\\pi/g, " pi "],
  [/\\lim/g, " límite "],
  [/\\int/g, " integral "],
  [/\\sum/g, " sumatoria "],
  [/=/g, " igual a "],
  [/\+/g, " más "],
  [/(\s)-(\s)/g, "$1menos$2"],
  [/\\[a-zA-Z]+/g, " "],
  [/[{}]/g, " "],
];

function speakMath(math: string) {
  let out = math;
  for (const [pattern, words] of MATH_WORDS) out = out.replace(pattern, words);
  return ` ${out} `;
}

/** Plain text for read-aloud: no markdown, links, code or LaTeX symbols. */
export function speakableText(markdown: string) {
  return markdown
    .replace(/```mermaid[\s\S]*?(```|$)/g, " (ver el diagrama en pantalla) ")
    .replace(/```grafico[\s\S]*?(```|$)/g, " (ver el gráfico en pantalla) ")
    .replace(/```[\s\S]*?```/g, " (bloque de código) ")
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, math: string) => speakMath(math))
    .replace(/\$([^$\n]+?)\$/g, (_, math: string) => speakMath(math))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/^\s*\|?[-:| ]+\|[-:| ]*$/gm, " ")
    .replace(/\|/g, ", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, ".\n")
    .trim();
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Reads text aloud in Spanish; returns a stop function. */
export function speak(text: string, onEnd: () => void) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(speakableText(text));
  const voices = synth.getVoices();
  const voice =
    voices.find((v) => v.lang === "es-AR") ??
    voices.find((v) => v.lang === "es-US" || v.lang === "es-419") ??
    voices.find((v) => v.lang.startsWith("es"));
  utterance.lang = voice?.lang ?? "es-AR";
  if (voice) utterance.voice = voice;
  utterance.rate = 1;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
  return () => {
    synth.cancel();
    onEnd();
  };
}
