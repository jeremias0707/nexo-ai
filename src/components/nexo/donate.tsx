import { Coffee, ExternalLink } from "lucide-react";
import { useId, useState } from "react";
import { DONATE_TEXT, DONATE_URL } from "@/lib/donate";

/**
 * "Apoyá a NEXO": a quiet toggle that reveals a short note and the Mercado Pago
 * link. Never opens on its own and never interrupts the chat.
 */
export function Donate({ variant = "sidebar" }: { variant?: "sidebar" | "empty" }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const compact = variant === "empty";
  return (
    <div className={compact ? "donate donate-empty" : "donate"}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={
          compact
            ? "tap inline-flex h-11 items-center gap-2 font-mono text-xs tracking-widest text-faint uppercase hover:text-neon"
            : "tap flex h-11 w-full items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-bg-soft hover:text-fg"
        }
      >
        <Coffee className="size-4 text-neon" strokeWidth={1.75} />
        Apoyá a NEXO
      </button>
      {open ? (
        <div
          id={panelId}
          className={`donate-panel rounded-md border border-neon/30 bg-bg-elev p-3 ${compact ? "mt-1" : "mx-1 mt-1"}`}
        >
          <p className="text-sm leading-relaxed text-fg">{DONATE_TEXT}</p>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-3 flex h-11 items-center justify-center gap-2 rounded-md border border-neon/60 text-sm font-medium text-neon hover:bg-neon/10"
          >
            Donar con Mercado Pago
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
          </a>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Se abre Mercado Pago en otra pestaña. NEXO no ve ni guarda tus datos de pago.
          </p>
        </div>
      ) : null}
    </div>
  );
}
