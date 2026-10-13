import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  Crosshair,
  Layers,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { ScreenHeader } from "@/components/nexo/local-screens";
import { dayLabel, dayLabelLong } from "@/lib/study-plan";
import { SUBJECTS } from "@/lib/subjects";
import {
  addDays,
  leftLabel,
  nextExams,
  PLAN3_EXAMS_MAX,
  PLAN3_MINUTES,
  savePlan3,
  splitTopics,
  taskPrompt,
  toggleDone,
  type PlanState,
  type Task,
  type TaskKind,
} from "@/lib/plan3";
import { usePlan3 } from "@/lib/use-plan3";

export type PlanTarget = "cards" | "weak" | "kit" | "exam";

export const KIND_ICON: Record<TaskKind, typeof BookOpen> = {
  apuntes: Sparkles,
  aprender: BookOpen,
  fichas: Layers,
  repaso: RotateCcw,
  errores: Crosshair,
  examen: Target,
  final: Check,
};

const ACTION: Record<TaskKind, string> = {
  apuntes: "Abrir Apuntes",
  aprender: "Explicámelo",
  fichas: "Abrir fichas",
  repaso: "Repasar con NEXO",
  errores: "Repasar mis errores",
  examen: "Hacer examen",
  final: "Repaso rápido",
};

export type TaskHandlers = {
  onAsk: (prompt: string) => void;
  onOpen: (target: PlanTarget, topic?: string) => void;
};

export function runTask(task: Task, h: TaskHandlers) {
  if (task.kind === "fichas") return h.onOpen("cards");
  if (task.kind === "errores") return h.onOpen("weak");
  if (task.kind === "apuntes") return h.onOpen("kit");
  if (task.kind === "examen") return h.onOpen("exam", task.subject);
  h.onAsk(taskPrompt(task));
}

export function TaskRow({
  task,
  done,
  onToggle,
  handlers,
  compact,
}: {
  task: Task;
  done: boolean;
  onToggle: () => void;
  handlers: TaskHandlers;
  compact?: boolean;
}) {
  const Icon = KIND_ICON[task.kind];
  return (
    <li className="flex items-start gap-3 rounded-sm border border-line bg-bg-elev/70 px-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
        onClick={onToggle}
        className={`tap mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border ${
          done ? "border-neon bg-neon/20 text-neon" : "border-line text-transparent"
        }`}
      >
        <Check className="size-4" strokeWidth={2.25} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-widest text-neon uppercase">
          {task.subject} · {task.minutes} min{task.moved ? " · pasó de otro día" : ""}
        </p>
        <p className={`text-sm ${done ? "text-faint line-through" : "text-fg"}`}>
          <Icon className="mr-1.5 inline size-3.5 text-neon" strokeWidth={1.75} />
          {task.title}
        </p>
        {!compact && !done ? (
          <button
            type="button"
            className="tap mt-1 text-xs text-neon hover:underline"
            onClick={() => runTask(task, handlers)}
          >
            {ACTION[task.kind]} →
          </button>
        ) : null}
      </div>
    </li>
  );
}

function update(plan: PlanState, patch: Partial<PlanState>) {
  savePlan3({ ...plan, ...patch });
}

async function askNotify(plan: PlanState) {
  if (typeof Notification === "undefined") return;
  const result =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  update(plan, { notify: result === "granted" });
}

/** 3.0: plan with several subjects and exam dates. */
export function Plan3View({
  onBack,
  status,
  handlers,
}: {
  onBack: () => void;
  status: ReactNode;
  handlers: TaskHandlers;
}) {
  const { plan, schedule, today } = usePlan3();
  const [adding, setAdding] = useState(false);
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(addDays(today, 7));
  const [topics, setTopics] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (!plan || !schedule) return null;
  const exams = nextExams(plan, today);
  const showForm = adding || plan.exams.length === 0;
  const done = new Set(plan.done);

  function addExam() {
    if (!plan) return;
    const name = subject.trim();
    if (name.length < 2) return setError("Escribí o elegí la materia.");
    if (!date || date <= today)
      return setError("La fecha del examen tiene que ser después de hoy.");
    if (plan.exams.length >= PLAN3_EXAMS_MAX)
      return setError(`Entran hasta ${PLAN3_EXAMS_MAX} exámenes.`);
    update(plan, {
      todayTasks: [],
      exams: [
        ...plan.exams,
        { id: `e${Date.now().toString(36)}`, subject: name, date, topics: splitTopics(topics) },
      ],
    });
    setSubject("");
    setTopics("");
    setError(null);
    setAdding(false);
  }

  const visible = all ? schedule.days : schedule.days.slice(0, 7);

  return (
    <>
      <ScreenHeader title="Plan de estudio" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-neon uppercase">
              Tu plan hasta cada examen
            </p>
            <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold text-fg">
              Organizá tus exámenes<span className="text-neon">.</span>
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
              Cargá materias y fechas. NEXO reparte qué estudiar cada día y, si un día no llegás, lo
              vuelve a acomodar. Se arma en tu dispositivo: no gasta cupo.
            </p>
          </div>

          {exams.length ? (
            <ul className="flex flex-col gap-2">
              {exams.map((exam) => (
                <li
                  key={exam.id}
                  className="flex items-center gap-3 rounded-md border border-line bg-bg-elev/70 px-3 py-2.5"
                >
                  <CalendarDays className="size-5 shrink-0 text-neon" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{exam.subject}</span>
                    <span className="block truncate text-xs text-faint">
                      {dayLabelLong(exam.date)} · {leftLabel(exam.left)}
                      {exam.topics.length ? ` · ${exam.topics.length} temas` : " · sin temas"}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Borrar examen de ${exam.subject}`}
                    className="tap grid size-9 place-items-center text-faint hover:text-fg"
                    onClick={() =>
                      update(plan, {
                        exams: plan.exams.filter((e) => e.id !== exam.id),
                        todayTasks: [],
                      })
                    }
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showForm ? (
            <div className="flex flex-col gap-3 rounded-md border border-neon/40 bg-neon/5 p-4">
              <p className="g-label">Materia</p>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubject(s.hint)}
                    className={`tap rounded-sm border px-2.5 py-1.5 text-xs ${
                      subject === s.hint ? "border-neon/60 text-neon" : "border-line text-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <input
                aria-label="Materia"
                className="h-11 rounded-md border border-line bg-transparent px-3 text-base text-fg outline-none placeholder:text-faint"
                placeholder="O escribila (ej.: Construcción de Ciudadanía)"
                value={subject}
                maxLength={40}
                onChange={(e) => setSubject(e.target.value)}
              />
              <label className="g-label" htmlFor="plan3-date">
                Fecha del examen
              </label>
              <input
                id="plan3-date"
                type="date"
                min={addDays(today, 1)}
                className="h-11 rounded-md border border-line bg-transparent px-3 text-base text-fg outline-none [color-scheme:dark]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <label className="g-label" htmlFor="plan3-topics">
                Temas (opcional, uno por línea o separados por coma)
              </label>
              <textarea
                id="plan3-topics"
                rows={3}
                className="rounded-md border border-line bg-transparent px-3 py-2 text-base text-fg outline-none placeholder:text-faint"
                placeholder="Ecuaciones, funciones, fracciones"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
              />
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <div className="flex gap-2">
                <button type="button" className="tap g-btn h-11 flex-1 text-sm" onClick={addExam}>
                  Agregar examen
                </button>
                {plan.exams.length ? (
                  <button
                    type="button"
                    className="tap g-btn dim h-11 px-4 text-sm"
                    onClick={() => setAdding(false)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="tap flex h-11 items-center justify-center gap-2 rounded-md border border-line text-sm text-fg hover:bg-bg-soft"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" strokeWidth={1.75} />
              Agregar otro examen
            </button>
          )}

          <div>
            <p className="g-label">¿Cuánto podés estudiar por día?</p>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {PLAN3_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={plan.minutes === m}
                  className="g-opt h-10 text-xs"
                  onClick={() => update(plan, { minutes: m, todayTasks: [] })}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          {schedule.missed > 0 ? (
            <p className="rounded-md border border-neon/40 bg-neon/5 px-3 py-2 text-sm text-fg">
              Reacomodé {schedule.missed} {schedule.missed === 1 ? "tarea" : "tareas"} que quedaron
              pendientes. Tranqui, siguen en el plan.
            </p>
          ) : null}

          {visible.map((day) => (
            <section key={day.day}>
              <p className="mb-2 font-mono text-[11px] tracking-widest text-faint uppercase">
                {day.day === today ? "Hoy toca" : dayLabel(day.day)}
                {" · "}
                {day.tasks.filter((t) => done.has(t.key)).length}/{day.tasks.length}
              </p>
              <ul className="flex flex-col gap-2">
                {day.tasks.map((task) => (
                  <TaskRow
                    key={task.key}
                    task={task}
                    done={done.has(task.key)}
                    compact={day.day !== today}
                    onToggle={() => savePlan3(toggleDone(plan, task.key))}
                    handlers={handlers}
                  />
                ))}
              </ul>
            </section>
          ))}
          {schedule.days.length > 7 ? (
            <button
              type="button"
              className="tap h-10 text-sm text-muted hover:text-fg"
              onClick={() => setAll((v) => !v)}
            >
              {all ? "Ver menos días" : `Ver los ${schedule.days.length} días`}
            </button>
          ) : null}

          {plan.exams.length && typeof Notification !== "undefined" ? (
            <button
              type="button"
              className="tap flex items-center gap-2 self-start text-xs text-faint hover:text-fg"
              onClick={() => (plan.notify ? update(plan, { notify: false }) : void askNotify(plan))}
            >
              <Bell className="size-3.5" strokeWidth={1.75} />
              {plan.notify
                ? "Recordatorio activado (te aviso al abrir NEXO si hay tareas). Tocá para apagar."
                : "Activar recordatorio del navegador (gratis)"}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** Home card: "Hoy toca" with today's tasks. */
export function TodayPlanCard({
  onPlan,
  handlers,
}: {
  onPlan: () => void;
  handlers: TaskHandlers;
}) {
  const { plan, schedule, today } = usePlan3();
  const pendingToday =
    schedule && schedule.days[0]?.day === today
      ? schedule.days[0].tasks.filter((t) => !plan?.done.includes(t.key)).length
      : 0;
  useEffect(() => {
    // Optional reminder: only when the student turned it on, once a day, when NEXO opens.
    if (!plan?.notify || plan.notifiedDay === today || pendingToday === 0) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification("NEXO · Hoy toca", {
        body: `Tenés ${pendingToday} ${pendingToday === 1 ? "tarea" : "tareas"} de estudio para hoy.`,
        icon: "/favicon.svg",
      });
    } catch {
      // Some phones only allow notifications from an installed app.
    }
    savePlan3({ ...plan, notifiedDay: today });
  }, [plan, pendingToday, today]);
  if (!plan || !schedule) return null;
  const day = schedule.days[0]?.day === today ? schedule.days[0] : null;
  const exams = nextExams(plan, today);
  if (!exams.length) {
    return (
      <button
        type="button"
        onClick={onPlan}
        className="rise rise-2 tap chip mt-5 flex w-full items-center gap-3 rounded-sm border border-line bg-bg-elev/70 px-3 py-3 text-left"
      >
        <CalendarDays className="size-5 shrink-0 text-neon" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] tracking-widest text-neon uppercase">
            Plan de estudio
          </span>
          <span className="block text-sm text-fg">
            Cargá tus exámenes y NEXO te dice qué estudiar cada día
          </span>
        </span>
      </button>
    );
  }
  const done = new Set(plan.done);
  const tasks = day?.tasks ?? [];
  const count = tasks.filter((t) => done.has(t.key)).length;
  return (
    <div className="rise rise-2 mt-5 rounded-sm border border-neon/45 bg-neon/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-widest text-neon uppercase">
          Hoy toca · {count}/{tasks.length}
        </p>
        <button type="button" className="tap text-xs text-muted hover:text-fg" onClick={onPlan}>
          Ver plan →
        </button>
      </div>
      {tasks.length ? (
        <ul className="flex flex-col gap-1.5">
          {tasks.slice(0, 3).map((task) => (
            <TaskRow
              key={task.key}
              task={task}
              done={done.has(task.key)}
              onToggle={() => savePlan3(toggleDone(plan, task.key))}
              handlers={handlers}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Hoy no hay tareas. ¡Descansá!</p>
      )}
      <p className="mt-2 text-xs text-faint">
        Próximo: {exams[0].subject} {leftLabel(exams[0].left)}
        {tasks.length > 3 ? ` · +${tasks.length - 3} tareas más` : ""}
      </p>
    </div>
  );
}
