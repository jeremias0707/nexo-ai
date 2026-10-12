import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Download, FileDown, Sparkles } from "lucide-react";
import { ScreenHeader } from "@/components/nexo/local-screens";
import type { Thread } from "@/lib/chat-store";
import {
  blocksToText,
  exportFileName,
  summaryBlocks,
  type SummaryInput,
} from "@/lib/export-summary";
import { formatNota } from "@/lib/exam";
import { useProfileStore } from "@/lib/local-store";
import { loadMistakes } from "@/lib/mistakes";
import { blocksToPdf } from "@/lib/pdf";
import { dayKey } from "@/lib/progress";
import { useProgressStore } from "@/lib/progress-store";
import { goalToday, weekMinutes } from "@/lib/study-goal";
import { dayLabel, dayLabelLong, planProgress } from "@/lib/study-plan";
import { useChatCardsStore, useGoalStore, usePlanStore } from "@/lib/study-store";

type Part = "chat" | "plan" | "goal" | "cards" | "exams";

const PARTS: { id: Part; label: string }[] = [
  { id: "chat", label: "Conversación abierta" },
  { id: "plan", label: "Plan de estudio" },
  { id: "goal", label: "Racha y meta diaria" },
  { id: "cards", label: "Fichas del chat" },
  { id: "exams", label: "Exámenes y errores" },
];

function download(name: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ExportView({
  onBack,
  status,
  thread,
  online,
  onAsk,
}: {
  onBack: () => void;
  status: ReactNode;
  thread: Thread | null;
  online: boolean;
  onAsk: (prompt: string) => void;
}) {
  const hasChat = Boolean(thread && thread.messages.some((m) => m.content.trim()));
  const [parts, setParts] = useState<Record<Part, boolean>>({
    chat: hasChat,
    plan: true,
    goal: true,
    cards: true,
    exams: true,
  });
  const [copied, setCopied] = useState(false);
  const plan = usePlanStore((state) => state.plan);
  const goal = useGoalStore((state) => state.goal);
  const cards = useChatCardsStore((state) => state.cards);
  const progress = useProgressStore((state) => state.progress);
  const nick = useProfileStore((state) => state.nick);
  const today = dayKey(new Date());

  const blocks = useMemo(() => {
    const info = goalToday(goal, today);
    const input: SummaryInput = {
      date: dayLabelLong(today),
      nick: nick && nick !== "Vos" ? nick : undefined,
      conversation:
        parts.chat && thread
          ? {
              title: thread.title,
              messages: thread.messages
                .filter((m) => m.content.trim())
                .map((m) => ({ role: m.role, content: m.content })),
            }
          : null,
      plan:
        parts.plan && plan
          ? {
              subject: plan.subject,
              examDayText: dayLabelLong(plan.examDay),
              ...planProgress(plan),
              days: plan.days.map((d) => ({
                label: dayLabel(d.day),
                tasks: d.tasks.map((t) => ({ title: t.title, done: t.done })),
              })),
            }
          : null,
      goal: parts.goal
        ? {
            goal: info.goal,
            todayMinutes: info.minutes,
            streak: info.streak,
            best: info.best,
            weekMinutes: weekMinutes(goal, today),
          }
        : null,
      cards: parts.cards ? cards.map((c) => ({ front: c.front, back: c.back })) : [],
      exams: parts.exams
        ? [...progress.exams]
            .sort((a, b) => b.at - a.at)
            .map((e) => ({ day: e.day, topic: e.topic, nota: formatNota(e.nota), count: e.count }))
        : [],
      mistakes: parts.exams ? loadMistakes().map((m) => m.question.prompt) : [],
    };
    return summaryBlocks(input);
  }, [parts, thread, plan, goal, cards, progress, nick, today]);
  const text = useMemo(() => blocksToText(blocks), [blocks]);

  return (
    <>
      <ScreenHeader title="Exportar resumen" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="hud-frame grid size-12 place-items-center text-neon">
              <FileDown className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold text-paper">
                Exportar resumen
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Bajalo como texto o PDF. Se arma en tu dispositivo.
              </p>
            </div>
          </div>
          <fieldset>
            <legend className="g-label">Qué incluir</legend>
            <div className="flex flex-col gap-1.5">
              {PARTS.map((part) => {
                const disabled = part.id === "chat" && !hasChat;
                return (
                  <label
                    key={part.id}
                    className={`tap flex min-h-11 items-center gap-3 rounded-md border border-line px-3 text-sm ${disabled ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-neon)]"
                      checked={parts[part.id] && !disabled}
                      disabled={disabled}
                      onChange={(event) =>
                        setParts((p) => ({ ...p, [part.id]: event.target.checked }))
                      }
                    />
                    <span className="flex-1 text-fg">{part.label}</span>
                    {part.id === "chat" && thread ? (
                      <span className="max-w-[45%] truncate text-xs text-faint">
                        {thread.title}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {hasChat ? (
            <button
              type="button"
              className="g-btn dim h-10 text-[11px]"
              disabled={!online}
              title="Usa 1 chat gratis"
              onClick={() =>
                onAsk(
                  "Resumime esta conversación para estudiar: las ideas clave en una lista corta y 3 preguntas de repaso al final.",
                )
              }
            >
              <Sparkles className="size-3.5" strokeWidth={1.75} />
              Pedirle a NEXO un resumen primero (1 chat)
            </button>
          ) : null}
          <div>
            <p className="g-label">Vista previa</p>
            <pre className="max-h-72 overflow-auto rounded-md border border-line bg-bg-elev p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-muted">
              {text}
            </pre>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="g-btn primary text-xs"
              onClick={() =>
                download(
                  exportFileName(today, "pdf"),
                  new Uint8Array(blocksToPdf(blocks)),
                  "application/pdf",
                )
              }
            >
              <Download className="size-4" strokeWidth={1.75} />
              PDF
            </button>
            <button
              type="button"
              className="g-btn ghost text-xs"
              onClick={() =>
                download(exportFileName(today, "txt"), text, "text/plain;charset=utf-8")
              }
            >
              <Download className="size-4" strokeWidth={1.75} />
              Texto
            </button>
          </div>
          <button
            type="button"
            className="g-btn dim h-11 text-xs"
            onClick={() =>
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              })
            }
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" strokeWidth={1.75} />}
            {copied ? "Copiado" : "Copiar texto"}
          </button>
          <p className="text-xs leading-relaxed text-faint">
            El PDF usa letra estándar: algunos símbolos de fórmulas se escriben con letras (por
            ejemplo «raíz» o «&lt;=»). Diagramas y gráficos quedan como una nota.
          </p>
        </div>
      </div>
    </>
  );
}
