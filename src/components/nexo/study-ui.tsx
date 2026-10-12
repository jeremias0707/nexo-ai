import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Layers, Mic, Sparkles, Users, X } from "lucide-react";
import type { DraftCard } from "@/lib/flashcards";
import { formatClassCode } from "@/lib/group";
import { goalToday, lastWeek } from "@/lib/study-goal";
import { countdownLine, todayIndex } from "@/lib/study-plan";
import { useChatCardsStore, useGoalStore, useGroupStore, usePlanStore } from "@/lib/study-store";
import { useToday } from "@/lib/use-progress";

/** Ring + week strip for "Racha y metas" (home screen). */
export function GoalCard({ onSettings }: { onSettings?: () => void }) {
  const goal = useGoalStore((state) => state.goal);
  const today = useToday();
  const info = goalToday(goal, today);
  const week = lastWeek(goal, today);
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="rise rise-2 mt-5 flex items-center gap-3 rounded-sm border border-line bg-bg-elev/70 px-3 py-3">
      <svg viewBox="0 0 48 48" className="size-12 shrink-0" aria-hidden="true">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-line"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - info.ratio)}
          transform="rotate(-90 24 24)"
          className={info.met ? "text-accent-g" : "text-neon"}
        />
        <text
          x="24"
          y="28"
          textAnchor="middle"
          className="fill-current text-fg"
          fontSize="12"
          fontWeight="600"
        >
          {Math.min(info.minutes, 99)}
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-widest text-neon uppercase">
          Meta diaria · {info.goal} min{info.met ? " · cumplida" : ""}
        </p>
        <p className="mt-0.5 text-sm text-fg">
          {info.met
            ? `Racha de estudio: ${info.streak} ${info.streak === 1 ? "día" : "días"}`
            : `${info.minutes} de ${info.goal} min hoy · racha ${info.streak} ${info.streak === 1 ? "día" : "días"}`}
        </p>
        <span className="mt-1.5 flex gap-1" aria-label="Últimos 7 días">
          {week.map((d) => (
            <span
              key={d.day}
              title={`${d.day}: ${d.minutes} min`}
              className={`h-1.5 flex-1 rounded-full ${d.met ? "bg-accent-g" : d.minutes > 0 ? "bg-neon/40" : "bg-line"}`}
            />
          ))}
        </span>
      </div>
      {onSettings ? (
        <button
          type="button"
          onClick={onSettings}
          className="tap shrink-0 self-start rounded-sm px-1.5 py-1 font-mono text-[10px] tracking-wider text-faint uppercase hover:text-fg"
        >
          Cambiar
        </button>
      ) : null}
    </div>
  );
}

/** Small home cards for the plan and the class challenge (only when set up). */
export function TodayCards({ onPlan, onGroup }: { onPlan: () => void; onGroup: () => void }) {
  const plan = usePlanStore((state) => state.plan);
  const code = useGroupStore((state) => state.code);
  const results = useGroupStore((state) => state.results);
  const today = useToday();
  const cards: ReactNode[] = [];
  if (plan) {
    const index = todayIndex(plan, today);
    const day = index >= 0 && index < plan.days.length ? plan.days[index] : null;
    const done = day ? day.tasks.filter((t) => t.done).length : 0;
    cards.push(
      <button
        key="plan"
        type="button"
        onClick={onPlan}
        className="tap chip flex w-full items-center gap-3 rounded-sm border border-line bg-bg-elev/70 px-3 py-2.5 text-left"
      >
        <CalendarDays className="size-5 shrink-0 text-neon" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] tracking-widest text-neon uppercase">
            Plan · {plan.subject}
          </span>
          <span className="block truncate text-sm text-fg">
            {day ? `Hoy: ${done}/${day.tasks.length} tareas` : countdownLine(plan.examDay, today)}
          </span>
        </span>
      </button>,
    );
  }
  if (code) {
    const doneToday = results[today]?.code === code;
    cards.push(
      <button
        key="group"
        type="button"
        onClick={onGroup}
        className="tap chip flex w-full items-center gap-3 rounded-sm border border-line bg-bg-elev/70 px-3 py-2.5 text-left"
      >
        <Users className="size-5 shrink-0 text-neon" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] tracking-widest text-neon uppercase">
            Clase {formatClassCode(code)}
          </span>
          <span className="block truncate text-sm text-fg">
            {doneToday
              ? `Desafío de hoy: ${results[today].correct}/3`
              : "Desafío de la clase pendiente"}
          </span>
        </span>
      </button>,
    );
  }
  if (cards.length === 0) return null;
  return <div className="rise rise-2 mt-2 flex flex-col gap-2">{cards}</div>;
}

/** Bottom sheet to review the cards made from one answer before saving them. */
export function FlashcardSheet({
  drafts,
  source,
  onClose,
  onSaved,
  onAskAi,
}: {
  drafts: DraftCard[];
  source: string;
  onClose: () => void;
  onSaved: (count: number) => void;
  onAskAi?: () => void;
}) {
  const [list, setList] = useState<DraftCard[]>(drafts);
  useEffect(() => setList(drafts), [drafts]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const valid = list.filter((c) => c.front.trim() && c.back.trim());

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fc-title"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="g-fade absolute inset-0 bg-ink/70"
        onClick={onClose}
      />
      <div className="g-fade relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-bg-elev md:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Layers className="size-5 text-neon" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p id="fc-title" className="font-display text-lg font-semibold text-fg">
              Fichas de esta explicación
            </p>
            <p className="text-xs text-faint">
              Editalas o borrá las que no sirvan. Quedan en este dispositivo.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="tap grid size-10 place-items-center text-faint hover:text-fg"
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {list.length === 0 ? (
            <p className="text-sm text-muted">
              No encontré ideas claras para fichas en esta respuesta.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {list.map((card, i) => (
                <li key={i} className="rounded-md border border-line p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-widest text-faint uppercase">
                      Ficha {i + 1}
                    </span>
                    <button
                      type="button"
                      aria-label={`Borrar ficha ${i + 1}`}
                      className="tap grid size-8 place-items-center text-faint hover:text-fg"
                      onClick={() => setList((l) => l.filter((_, k) => k !== i))}
                    >
                      <X className="size-4" strokeWidth={1.5} />
                    </button>
                  </div>
                  <label className="block">
                    <span className="sr-only">Frente</span>
                    <textarea
                      value={card.front}
                      rows={2}
                      maxLength={160}
                      onChange={(e) =>
                        setList((l) =>
                          l.map((c, k) => (k === i ? { ...c, front: e.target.value } : c)),
                        )
                      }
                      className="block w-full resize-none rounded-sm border border-line bg-bg p-2 text-sm font-medium text-fg outline-none focus:border-neon/60"
                    />
                  </label>
                  <label className="mt-1.5 block">
                    <span className="sr-only">Atrás</span>
                    <textarea
                      value={card.back}
                      rows={3}
                      maxLength={420}
                      onChange={(e) =>
                        setList((l) =>
                          l.map((c, k) => (k === i ? { ...c, back: e.target.value } : c)),
                        )
                      }
                      className="block w-full resize-y rounded-sm border border-line bg-bg p-2 text-sm text-muted outline-none focus:border-neon/60"
                    />
                  </label>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            className="g-btn primary w-full"
            disabled={valid.length === 0}
            onClick={() => onSaved(useChatCardsStore.getState().add(valid, source))}
          >
            Guardar {valid.length} {valid.length === 1 ? "ficha" : "fichas"}
          </button>
          {onAskAi ? (
            <button
              type="button"
              className="g-btn dim h-10 text-[11px]"
              onClick={onAskAi}
              title="Usa 1 chat gratis"
            >
              <Sparkles className="size-3.5" strokeWidth={1.75} />
              Pedirle a NEXO fichas mejores (1 chat)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Chip above the composer while an oral mode is on. */
export function OralChip({ mode, onExit }: { mode: "oral" | "profe"; onExit: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-sm border border-neon/40 bg-neon/8 px-2.5 py-1.5 text-xs text-fg">
      <Mic className="size-4 shrink-0 text-neon" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-neon">
          {mode === "profe" ? "Modo oral · Profe" : "Modo oral"}
        </span>{" "}
        <span className="text-muted">
          {mode === "profe"
            ? "NEXO te pregunta como en un oral. Respondé con el micrófono o escribiendo."
            : "Las respuestas salen como para decirlas en voz alta."}
        </span>
      </span>
      <button
        type="button"
        onClick={onExit}
        className="tap shrink-0 rounded-sm px-2 py-1 text-faint hover:text-fg"
      >
        Salir
      </button>
    </div>
  );
}
