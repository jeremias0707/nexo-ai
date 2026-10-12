import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  Layers,
  Mic,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { ScreenHeader } from "@/components/nexo/local-screens";
import { dayKey } from "@/lib/progress";
import { usePlanStore } from "@/lib/study-store";
import {
  buildPlan,
  countdownLine,
  dayLabel,
  dayLabelLong,
  parseTopics,
  PLAN_MINUTES,
  planProgress,
  todayIndex,
  topicsFromAnswer,
  topicsPrompt,
  type PlanMinutes,
  type PlanTask,
} from "@/lib/study-plan";
import { SUBJECTS } from "@/lib/subjects";

type Props = {
  onBack: () => void;
  status: ReactNode;
  /** Sends a prompt to the chat (one free chat). */
  onAsk: (prompt: string, oral?: boolean) => void;
  onOpen: (view: "cards" | "exam" | "review") => void;
  lastAnswer: string | null;
  online: boolean;
};

const KIND_ICON: Record<PlanTask["kind"], typeof BookOpen> = {
  aprender: BookOpen,
  repaso: RotateCcw,
  fichas: Layers,
  oral: Mic,
  examen: Target,
  final: Check,
};

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export function PlanView({ onBack, status, onAsk, onOpen, lastAnswer, online }: Props) {
  const plan = usePlanStore((state) => state.plan);
  const today = dayKey(new Date());
  const [editing, setEditing] = useState(!plan);
  const [subject, setSubject] = useState(plan?.subject ?? "");
  const [examDay, setExamDay] = useState(plan?.examDay ?? addDays(today, 6));
  const [topicsText, setTopicsText] = useState(plan?.topics.join("\n") ?? "");
  const [minutes, setMinutes] = useState<PlanMinutes>(plan?.minutes ?? 30);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const suggested = useMemo(() => (lastAnswer ? topicsFromAnswer(lastAnswer) : []), [lastAnswer]);
  const topicCount = parseTopics(topicsText).length;

  function create() {
    const built = buildPlan({
      subject,
      examDay,
      today,
      topics: parseTopics(topicsText),
      minutes,
    });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    setNote(built.note);
    usePlanStore.getState().setPlan(built.plan);
    setEditing(false);
  }

  if (editing || !plan) {
    return (
      <>
        <ScreenHeader title="Plan de estudio" onBack={onBack} status={status} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
            <div className="flex items-center gap-3">
              <span className="hud-frame grid size-12 place-items-center text-neon">
                <CalendarDays className="size-6" strokeWidth={1.5} />
              </span>
              <div>
                <h1 className="font-display text-2xl leading-none font-semibold text-paper">
                  Plan de estudio semanal
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Materia + fecha del examen → un plan de 5 a 7 días. Se arma en tu celu, gratis.
                </p>
              </div>
            </div>

            <fieldset>
              <legend className="g-label">Materia</legend>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={subject === item.hint}
                    onClick={() => setSubject(item.hint)}
                    className={`tap rounded-sm border px-2.5 py-1.5 text-xs ${
                      subject === item.hint ? "border-neon/60 text-neon" : "border-line text-muted"
                    }`}
                  >
                    {item.hint}
                  </button>
                ))}
              </div>
              <input
                aria-label="Materia"
                value={subject}
                maxLength={60}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="O escribila: Construcción de ciudadanía"
                className="mt-2 h-11 w-full rounded-md border border-line bg-bg-elev px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-neon/60"
              />
            </fieldset>

            <label className="block">
              <span className="g-label block">Fecha del examen</span>
              <input
                type="date"
                value={examDay}
                min={addDays(today, 1)}
                max={addDays(today, 120)}
                onChange={(event) => setExamDay(event.target.value)}
                className="date-input h-11 w-full rounded-md border border-line bg-bg-elev px-3 text-sm text-fg outline-none focus:border-neon/60"
              />
              {/^\d{4}-\d{2}-\d{2}$/.test(examDay) ? (
                <span className="mt-1.5 block text-xs text-faint">
                  {dayLabelLong(examDay)} · {countdownLine(examDay, today)}
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="g-label block">Temas (opcional, uno por línea)</span>
              <textarea
                value={topicsText}
                onChange={(event) => setTopicsText(event.target.value)}
                rows={5}
                placeholder={"La célula\nMitosis y meiosis\nADN"}
                className="block w-full resize-y rounded-md border border-line bg-bg-elev p-3 text-sm leading-relaxed text-fg outline-none placeholder:text-faint focus:border-neon/60"
              />
              <span className="mt-1.5 block text-xs text-faint">
                {topicCount > 0
                  ? `${topicCount} ${topicCount === 1 ? "tema" : "temas"}.`
                  : "Sin temas uso pasos generales."}{" "}
                Hasta 12.
              </span>
            </label>
            <div className="-mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="tap g-btn dim h-10 px-3 text-[11px]"
                disabled={!online || subject.trim().length < 2}
                onClick={() => onAsk(topicsPrompt(subject, examDay))}
                title="Usa 1 chat gratis"
              >
                <Sparkles className="size-3.5" strokeWidth={1.75} />
                Pedirle los temas a NEXO
              </button>
              {suggested.length > 0 ? (
                <button
                  type="button"
                  className="tap g-btn ghost h-10 px-3 text-[11px]"
                  onClick={() => setTopicsText(suggested.join("\n"))}
                >
                  Usar los {suggested.length} temas de la última respuesta
                </button>
              ) : null}
            </div>

            <fieldset>
              <legend className="g-label">Minutos por día</legend>
              <div
                className="grid grid-cols-4 gap-1.5"
                role="radiogroup"
                aria-label="Minutos por día"
              >
                {PLAN_MINUTES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={minutes === value}
                    className="g-opt"
                    onClick={() => setMinutes(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>

            {error ? (
              <p className="flex items-center gap-2 text-sm text-muted" role="alert">
                <span className="size-1.5 shrink-0 rounded-full bg-accent-r" aria-hidden="true" />
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <button type="button" className="g-btn primary w-full" onClick={create}>
                <CalendarDays className="size-4" strokeWidth={1.75} />
                {plan ? "Rehacer plan" : "Armar plan"}
              </button>
              {plan ? (
                <button
                  type="button"
                  className="g-btn dim h-11 w-full text-xs"
                  onClick={() => setEditing(false)}
                >
                  Volver a mi plan
                </button>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-faint">
              El plan se arma en este dispositivo, sin IA. «Pedir ayuda» en una tarea abre el chat y
              usa un chat gratis del día.
            </p>
          </div>
        </div>
      </>
    );
  }

  const progress = planProgress(plan);
  const current = todayIndex(plan, today);
  return (
    <>
      <ScreenHeader title="Plan de estudio" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
          <div className="hud-frame">
            <div className="g-card p-4">
              <p className="font-mono text-[11px] tracking-[0.16em] text-neon uppercase">
                {countdownLine(plan.examDay, today)}
              </p>
              <h1 className="mt-2 font-display text-2xl leading-tight font-semibold text-paper">
                {plan.subject}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Examen: {dayLabelLong(plan.examDay)} · {plan.minutes} min por día
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-neon"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-faint">
                {progress.done}/{progress.total} tareas hechas
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="g-btn dim h-10 text-[11px]"
                  onClick={() => setEditing(true)}
                >
                  Cambiar plan
                </button>
                {confirmDelete ? (
                  <button
                    type="button"
                    className="g-btn dim h-10 text-[11px] text-accent-r"
                    onClick={() => {
                      usePlanStore.getState().setPlan(null);
                      setConfirmDelete(false);
                      setEditing(true);
                    }}
                  >
                    Sí, borrar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="g-btn dim h-10 text-[11px]"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Borrar
                  </button>
                )}
              </div>
            </div>
          </div>
          {note ? <p className="text-sm text-muted">{note}</p> : null}
          {current >= plan.days.length ? (
            <p className="text-sm text-muted">
              El plan terminó. Si todavía falta para el examen, armá otro.
            </p>
          ) : null}

          <ol className="flex flex-col gap-3">
            {plan.days.map((day, index) => {
              const isToday = index === current;
              const past = index < current;
              const doneAll = day.tasks.every((task) => task.done);
              return (
                <li
                  key={day.day}
                  className={`rounded-md border p-3 ${
                    isToday ? "border-neon/50 bg-neon/5" : "border-line bg-bg-elev/50"
                  } ${past && !isToday ? "opacity-70" : ""}`}
                >
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-semibold tracking-wide text-paper">
                      Día {index + 1} · {dayLabel(day.day)}
                    </span>
                    <span
                      className={`font-mono text-[10px] tracking-widest uppercase ${isToday ? "text-neon" : "text-faint"}`}
                    >
                      {isToday ? "Hoy" : doneAll ? "Listo" : past ? "Pendiente" : ""}
                    </span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {day.tasks.map((task) => {
                      const Icon = KIND_ICON[task.kind];
                      return (
                        <li key={task.id} className="flex items-start gap-2.5">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={task.done}
                            aria-label={`Marcar «${task.title}» como hecha`}
                            onClick={() => usePlanStore.getState().toggle(task.id)}
                            className={`tap mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border ${
                              task.done
                                ? "border-neon bg-neon text-ink"
                                : "border-line-strong text-transparent"
                            }`}
                          >
                            <Check className="size-4" strokeWidth={2.5} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm leading-snug ${task.done ? "text-faint line-through" : "text-fg"}`}
                            >
                              <Icon
                                className="mr-1.5 inline size-3.5 -translate-y-px text-neon"
                                strokeWidth={1.75}
                              />
                              {task.title}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted">
                              {task.detail} <span className="text-faint">· {task.minutes} min</span>
                            </p>
                            <TaskAction task={task} online={online} onAsk={onAsk} onOpen={onOpen} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
          <p className="text-xs leading-relaxed text-faint">
            Guardado solo en este navegador. Marcá cada tarea cuando la termines.
          </p>
        </div>
      </div>
    </>
  );
}

function TaskAction({
  task,
  online,
  onAsk,
  onOpen,
}: {
  task: PlanTask;
  online: boolean;
  onAsk: Props["onAsk"];
  onOpen: Props["onOpen"];
}) {
  const cls =
    "tap mt-1.5 mr-2 inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-[11px]";
  const buttons: ReactNode[] = [];
  if (task.kind === "fichas") {
    buttons.push(
      <button
        key="f"
        type="button"
        className={`${cls} border-line text-muted hover:text-fg`}
        onClick={() => onOpen("cards")}
      >
        <Layers className="size-3.5" strokeWidth={1.75} />
        Abrir fichas
      </button>,
    );
  }
  if (task.kind === "examen") {
    buttons.push(
      <button
        key="e"
        type="button"
        className={`${cls} border-neon/50 text-neon disabled:opacity-40`}
        disabled={!online}
        onClick={() => onOpen("exam")}
      >
        <Target className="size-3.5" strokeWidth={1.75} />
        Modo examen
      </button>,
    );
  }
  if (task.kind === "repaso" && !task.prompt) {
    buttons.push(
      <button
        key="r"
        type="button"
        className={`${cls} border-line text-muted hover:text-fg`}
        onClick={() => onOpen("review")}
      >
        <RotateCcw className="size-3.5" strokeWidth={1.75} />
        Repasar errores
      </button>,
    );
  }
  if (task.prompt) {
    const oral = task.kind === "oral";
    buttons.push(
      <button
        key="p"
        type="button"
        className={`${cls} border-neon/40 text-neon disabled:opacity-40`}
        disabled={!online}
        title="Usa 1 chat gratis"
        onClick={() => onAsk(task.prompt, oral)}
      >
        {oral ? (
          <Mic className="size-3.5" strokeWidth={1.75} />
        ) : (
          <Sparkles className="size-3.5" strokeWidth={1.75} />
        )}
        {oral ? "Practicar oral" : "Pedir ayuda"}
      </button>,
    );
  }
  return buttons.length ? <div>{buttons}</div> : null;
}
