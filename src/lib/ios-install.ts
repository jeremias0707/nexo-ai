/** Detección pura para el aviso "Instalá NEXO" en Safari de iPhone. */
export const IOS_TIP_KEY = "nexo.iosTipDismissed";

export type IosEnv = {
  userAgent: string;
  maxTouchPoints?: number;
  platform?: string;
  /** navigator.standalone (solo iOS) */
  standalone?: boolean;
  /** matchMedia("(display-mode: standalone)").matches */
  displayStandalone?: boolean;
};

export function isIosDevice(env: IosEnv): boolean {
  const ua = env.userAgent;
  if (/iPhone|iPod|iPad/.test(ua)) return true;
  // iPadOS se presenta como Mac con pantalla táctil.
  return env.platform === "MacIntel" && (env.maxTouchPoints ?? 0) > 1;
}

/** Safari "de verdad": no Chrome/Firefox/Edge para iOS ni navegadores dentro de apps. */
export function isIosSafari(env: IosEnv): boolean {
  if (!isIosDevice(env)) return false;
  const ua = env.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|YaBrowser|DuckDuckGo/.test(ua)) return false;
  if (/FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp/.test(ua)) return false;
  return /Safari\//.test(ua) && /Version\//.test(ua);
}

export function isStandalone(env: IosEnv): boolean {
  return env.standalone === true || env.displayStandalone === true;
}

export function shouldShowIosTip(env: IosEnv, dismissed: boolean): boolean {
  return !dismissed && isIosSafari(env) && !isStandalone(env);
}
