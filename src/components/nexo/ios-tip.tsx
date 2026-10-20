import { useEffect, useState } from "react";
import { IOS_TIP_KEY, shouldShowIosTip } from "@/lib/ios-install";

/** Aviso descartable: solo en Safari de iPhone y cuando NEXO no está instalada. */
export function IosInstallTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(IOS_TIP_KEY) === "1";
    } catch {
      /* modo privado */
    }
    const nav = navigator as Navigator & { standalone?: boolean };
    setShow(
      shouldShowIosTip(
        {
          userAgent: nav.userAgent,
          platform: nav.platform,
          maxTouchPoints: nav.maxTouchPoints,
          standalone: nav.standalone,
          displayStandalone: window.matchMedia?.("(display-mode: standalone)").matches,
        },
        dismissed,
      ),
    );
  }, []);

  if (!show) return null;

  function close() {
    setShow(false);
    try {
      localStorage.setItem(IOS_TIP_KEY, "1");
    } catch {
      /* nada */
    }
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div
        role="status"
        data-testid="ios-install-tip"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-bg/95 px-4 py-3 text-sm text-fg shadow-lg backdrop-blur"
      >
        <img src="/icons/apple-touch-icon.png" alt="" className="size-9 shrink-0 rounded-[10px]" />
        <p className="flex-1 leading-snug">
          Instalá NEXO: tocá <b>Compartir</b>{" "}
          <svg aria-hidden="true" viewBox="0 0 24 24" className="inline size-4 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>{" "}
          y después <b>Agregar a inicio</b>
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar aviso"
          className="-mr-1 grid size-8 shrink-0 place-items-center rounded-full text-fg/60 hover:text-fg"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
