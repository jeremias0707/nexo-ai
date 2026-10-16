import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Mark } from "@/components/nexo/mark";
import { readDeviceToken, redeemAccess } from "@/lib/access-client";
import { capsLine } from "@/lib/access-constants";

type GateState = "checking" | "needs" | "ready" | "blocked";

/**
 * Blocks the tutor until the device has a redeemed access token.
 * Soft preview (no accessRequired from /api/status): auto-redeems once.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [required, setRequired] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const existing = readDeviceToken();
      let accessRequired = true;
      let accessConfigured = true;
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as {
            accessRequired?: boolean;
            accessConfigured?: boolean;
          };
          accessRequired = json.accessRequired !== false;
          accessConfigured = json.accessConfigured !== false;
        }
      } catch {
        // Offline: if we already have a token, let the app paint; API will fail later.
      }
      if (cancelled) return;
      setRequired(accessRequired);
      if (!accessConfigured && accessRequired) {
        setState("blocked");
        return;
      }
      if (existing) {
        setState("ready");
        return;
      }
      if (!accessRequired) {
        const soft = await redeemAccess("");
        if (cancelled) return;
        if (soft.ok) {
          setState("ready");
          return;
        }
      }
      setState("needs");
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await redeemAccess(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState("ready");
  }

  if (state === "ready") return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 text-sm text-muted">
        Abriendo NEXO…
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <Shell>
        <h1 className="font-serif text-3xl tracking-tight text-paper">NEXO AI</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Todavía no está listo el código de acceso en el servidor. Probá más tarde o avisale a
          quien administra NEXO.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-serif text-3xl tracking-tight text-paper">NEXO AI</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Es gratis, por dispositivo: {capsLine()}. Para cuidar el uso del modelo, pedí el código de
        acceso a quien te compartió NEXO.
      </p>
      <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="text-xs tracking-wide text-faint uppercase" htmlFor="nexo-access-code">
          Código de acceso
        </label>
        <input
          id="nexo-access-code"
          name="code"
          autoComplete="one-time-code"
          className="h-12 rounded-md border border-line bg-bg-elev px-3 text-base text-paper outline-none focus:border-neon"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={required ? "Pegá el código" : "Opcional en esta vista previa"}
          disabled={busy}
        />
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || (required && !code.trim())}
          className="tap mt-1 flex h-12 items-center justify-center rounded-md bg-paper text-sm font-medium text-ink disabled:opacity-50"
        >
          {busy ? "Activando…" : "Entrar"}
        </button>
      </form>
      <p className="mt-6 text-xs leading-relaxed text-faint">
        El código desbloquea este dispositivo. No es una cuenta: no pedimos mail ni contraseña. El
        historial sigue guardándose solo en tu navegador.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-bg-elev p-6 shadow-lg">
        <div className="mb-4 text-neon">
          <Mark />
        </div>
        {children}
      </div>
    </div>
  );
}
