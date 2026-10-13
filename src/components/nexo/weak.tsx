import { useState, type ReactNode } from "react";
import { Crosshair, Layers, MessageCircleQuestion, Target, Trash2 } from "lucide-react";
import { ScreenHeader } from "@/components/nexo/local-screens";
import { useWeakSpots } from "@/lib/use-weak-spots";
import { subjectLabel } from "@/lib/subjects";
import { clearWeak, WEAK_MAX, weightWord, type WeakSource } from "@/lib/weak-spots";

const FROM: Record<WeakSource, { label: string; Icon: typeof Target }> = {
  examen: { label: "Examen", Icon: Target },
  ficha: { label: "Fichas", Icon: Layers },
  chat: { label: "No entendí", Icon: MessageCircleQuestion },
};

/** 3.0: "Repasar mis errores" — the weak topics this device remembers. */
export function WeakView({
  onBack,
  status,
  online,
  onStart,
}: {
  onBack: () => void;
  status: ReactNode;
  online: boolean;
  onStart: () => void;
}) {
  const spots = useWeakSpots();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <ScreenHeader title="Repasar mis errores" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-neon uppercase">
              Repaso que se adapta
            </p>
            <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold text-fg">
              Lo que más te cuesta<span className="text-neon">.</span>
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
              NEXO anota lo que te salió mal en exámenes, las fichas que no sabías y cuando le decís
              «no entendí». Cada ronda te toma justo eso: si acertás, el tema baja; si fallás, sube.
            </p>
          </div>

          {spots.length === 0 ? (
            <div className="rounded-md border border-line bg-bg-elev/70 p-4 text-sm text-muted">
              Todavía no hay temas flojos. Hacé un examen, repasá fichas o preguntale algo a NEXO y
              cuando algo te cueste va a aparecer acá.
            </div>
          ) : (
            <>
              <button
                type="button"
                className="tap g-btn h-12 w-full gap-2 text-sm"
                onClick={onStart}
                disabled={!online}
              >
                <Crosshair className="size-4" strokeWidth={1.75} />
                Arrancar ronda de 5 preguntas
              </button>
              {!online ? (
                <p className="-mt-2 text-xs text-faint">Necesitás conexión para armar la ronda.</p>
              ) : (
                <p className="-mt-2 text-xs text-faint">
                  Usa los {Math.min(3, spots.length)} temas de más arriba. Cuenta como un examen del
                  cupo gratis.
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {spots.map((spot) => {
                  const subject = subjectLabel(spot.subject);
                  const pct = Math.max(6, Math.round((spot.weight / WEAK_MAX) * 100));
                  return (
                    <li
                      key={spot.id}
                      className="rounded-md border border-line bg-bg-elev/70 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {subject ? (
                            <p className="font-mono text-[10px] tracking-widest text-neon uppercase">
                              {subject}
                            </p>
                          ) : null}
                          <p className="text-sm break-words text-fg">{spot.topic}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] tracking-wider text-muted uppercase">
                          {weightWord(spot.weight)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-neon" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                        {spot.from.map((source) => {
                          const { label, Icon } = FROM[source];
                          return (
                            <span key={source} className="flex items-center gap-1">
                              <Icon className="size-3" strokeWidth={1.75} />
                              {label}
                            </span>
                          );
                        })}
                        <span>
                          {spot.misses} {spot.misses === 1 ? "fallo" : "fallos"} · {spot.hits}{" "}
                          {spot.hits === 1 ? "acierto" : "aciertos"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-faint">
                <span>Se guarda solo en este dispositivo.</span>
                {confirm ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className="tap h-9 rounded-sm border border-red-400/60 px-3 text-red-300"
                      onClick={() => {
                        clearWeak();
                        setConfirm(false);
                      }}
                    >
                      Sí, borrar todo
                    </button>
                    <button
                      type="button"
                      className="tap h-9 px-2"
                      onClick={() => setConfirm(false)}
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="tap flex h-9 items-center gap-1.5 px-2 hover:text-fg"
                    onClick={() => setConfirm(true)}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Borrar mis errores
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
