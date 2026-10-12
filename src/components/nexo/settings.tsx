import type { ReactNode } from "react";
import { ChevronLeft, Settings } from "lucide-react";
import { useProgressStore } from "@/lib/progress-store";
import { useSettingsStore } from "@/lib/settings-store";
import type { ExplainDepth, ReplyMode, TextSize, ThemeId } from "@/lib/settings";
import { GOAL_CHOICES, type GoalMinutes } from "@/lib/study-goal";
import { useGoalStore } from "@/lib/study-store";

const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: "oscuro", label: "Oscuro" },
  { id: "claro", label: "Claro" },
];

const TEXT_OPTIONS: { id: TextSize; label: string }[] = [
  { id: "chico", label: "Chico" },
  { id: "normal", label: "Normal" },
  { id: "grande", label: "Grande" },
];

const EXPLAIN_OPTIONS: { id: ExplainDepth; label: string }[] = [
  { id: "simple", label: "Simple" },
  { id: "normal", label: "Normal" },
  { id: "fondo", label: "A fondo" },
];

const REPLY_OPTIONS: { id: ReplyMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "pasos", label: "Pasos" },
  { id: "preguntas", label: "Preguntas" },
  { id: "examen", label: "Examen" },
  { id: "guiado", label: "Guiado" },
  { id: "oral", label: "Oral" },
  { id: "profe", label: "Profe (oral)" },
];

const GOAL_OPTIONS = GOAL_CHOICES.map((m) => ({
  id: String(m) as `${GoalMinutes}`,
  label: `${m} min`,
}));

export function SettingsView({ onBack, status }: { onBack: () => void; status: ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);
  const text = useSettingsStore((state) => state.text);
  const explain = useSettingsStore((state) => state.explain);
  const reply = useSettingsStore((state) => state.reply);
  const goal = useGoalStore((state) => state.goal.goal);

  return (
    <>
      <header className="hud-header flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:px-5">
        <button
          type="button"
          className="tap hud-btn grid size-11 place-items-center rounded-md border border-line"
          aria-label="Volver"
          onClick={onBack}
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs leading-none font-semibold tracking-widest text-neon uppercase">
            NEXO AI
          </p>
          <p className="mt-1 truncate text-sm leading-tight font-medium">Ajustes</p>
        </div>
        {status}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="hud-frame grid size-12 place-items-center text-neon">
              <Settings className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold tracking-tight text-paper">
                Ajustes
              </h1>
              <p className="mt-1.5 text-sm text-muted">Quedan solo en este navegador.</p>
            </div>
          </div>

          <ChoiceGroup
            legend="Tema"
            hint="Oscuro es el look de siempre. Claro aclara el fondo."
            name="tema"
            value={theme}
            options={THEME_OPTIONS}
            onChange={(id) => {
              useSettingsStore.getState().setTheme(id);
              if (id === "claro")
                useProgressStore.getState().record({ kind: "mark", mark: "claro" });
            }}
          />
          <ChoiceGroup
            legend="Tamaño de letra"
            hint="Cambia el texto del chat y del examen."
            name="letra"
            value={text}
            options={TEXT_OPTIONS}
            onChange={(id) => useSettingsStore.getState().setText(id)}
          />
          <ChoiceGroup
            legend="Cómo explica"
            hint="Simple: pocas frases cortas (ideal en el celular) y un ejemplo. A fondo: los límites, el error típico y más profundidad. En el celular NEXO prioriza respuestas cortas salvo que elijas A fondo."
            name="explica"
            value={explain}
            options={EXPLAIN_OPTIONS}
            onChange={(id) => {
              try {
                localStorage.setItem("nexo-explain-touched", "1");
              } catch {
                // ignore
              }
              useSettingsStore.getState().setExplain(id);
            }}
          />
          <ChoiceGroup
            legend="Modo de respuesta"
            hint="Normal no cambia cómo responde. Pasos numera. Preguntas hace una pregunta antes de explicar. Examen corrige corto. Guiado es estudio socrático suave: primero pregunta qué sabés. Oral explica como lo dirías en un examen oral. Profe te toma oral: una pregunta por vez y te corrige con Bien, A medias o Mal."
            name="modo"
            value={reply}
            options={REPLY_OPTIONS}
            onChange={(id) => useSettingsStore.getState().setReply(id)}
          />
          <ChoiceGroup
            legend="Meta diaria de estudio"
            hint="Cuenta el tiempo que usás NEXO con la pantalla abierta (se pausa si no tocás nada por 3 minutos). Cumplir la meta suma un día a tu racha de estudio. Gratis, sin pagos."
            name="meta"
            value={String(goal) as `${GoalMinutes}`}
            options={GOAL_OPTIONS}
            onChange={(id) => useGoalStore.getState().setGoal(Number(id))}
          />
          <p className="text-xs leading-relaxed text-faint">
            NEXO manda esta preferencia con cada pregunta del chat. No hace falta una cuenta y no se
            guarda en un servidor.
          </p>
        </div>
      </div>
    </>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint: string;
  name: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <fieldset>
      <legend className="g-label">{legend}</legend>
      <div
        role="radiogroup"
        aria-label={legend}
        className="grid gap-2"
        style={{
          gridTemplateColumns:
            options.length > 3
              ? "repeat(2, minmax(0, 1fr))"
              : `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => {
          const on = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              name={name}
              aria-checked={on}
              className="g-opt"
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{hint}</p>
    </fieldset>
  );
}
