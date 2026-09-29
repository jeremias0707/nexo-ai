import type { ReactNode } from "react";
import { ChevronLeft, Settings } from "lucide-react";
import { useSettingsStore } from "@/lib/settings-store";
import type { ExplainDepth, TextSize, ThemeId } from "@/lib/settings";

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

export function SettingsView({ onBack, status }: { onBack: () => void; status: ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);
  const text = useSettingsStore((state) => state.text);
  const explain = useSettingsStore((state) => state.explain);

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
            onChange={(id) => useSettingsStore.getState().setTheme(id)}
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
            hint="Simple: frases cortas y un ejemplo de todos los días o de un juego. A fondo: los límites, el error típico y un poco más de profundidad."
            name="explica"
            value={explain}
            options={EXPLAIN_OPTIONS}
            onChange={(id) => useSettingsStore.getState().setExplain(id)}
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
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
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
