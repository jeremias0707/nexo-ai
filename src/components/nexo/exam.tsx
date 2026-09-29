import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  FileText,
  Minus,
  RotateCcw,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { describeDoc, type DocPayload } from "@/lib/document";
import { DOC_ACCEPT, readDocument } from "@/lib/document-client";
import {
  computeNota,
  correctText,
  difficultyLabel,
  EXAM_COUNTS,
  EXAM_DIFFICULTIES,
  EXAM_TOPIC_MAX,
  examMinutes,
  examXp,
  examXpMax,
  formatNota,
  givenText,
  gradeChoice,
  LETTERS,
  passed,
  type ExamAnswer,
  type ExamCount,
  type ExamDifficulty,
  type ExamPaper,
  type ExamSource,
  type GradeResult,
} from "@/lib/exam";
import {
  EMPTY_MISTAKES,
  foldMistakes,
  loadMistakes,
  mistakeButtonLabel,
  reviewPaper,
  saveMistakes,
} from "@/lib/mistakes";
import { useMistakeCount } from "@/lib/use-mistakes";
import { prepareImage, type PreparedImage } from "@/lib/image-client";
import { DAILY, dayKey } from "@/lib/progress";
import { useProgressStore } from "@/lib/progress-store";

type Stage = "config" | "loading" | "question" | "grading" | "result";

type Config = {
  topic: string;
  source: ExamSource;
  count: ExamCount;
  difficulty: ExamDifficulty;
};

const SOURCES: { id: ExamSource; label: string; icon: typeof Sparkles }[] = [
  { id: "tema", label: "Tema libre", icon: Sparkles },
  { id: "pdf", label: "Mis apuntes", icon: FileText },
  { id: "foto", label: "Foto", icon: Camera },
];

const TIMER_KEY = "nexo-exam-timer";

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function shortClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "No pude conectar con NEXO. Probá de nuevo.");
  return data;
}

export function ExamView({
  onClose,
  status,
  online,
  onStage,
  boot = "config",
}: {
  onStage?: (stage: string) => void;
  onClose: () => void;
  status: ReactNode;
  online: boolean;
  /** "review" opens the saved-mistakes exam immediately (menu / home). */
  boot?: "config" | "review";
}) {
  const [stage, setStage] = useState<Stage>("config");
  const [config, setConfig] = useState<Config>({
    topic: "",
    source: "tema",
    count: 10,
    difficulty: "media",
  });
  const [doc, setDoc] = useState<DocPayload | null>(null);
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [written, setWritten] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showTimer, setShowTimer] = useState(true);
  const [confirmExit, setConfirmExit] = useState(false);
  const [earned, setEarned] = useState(0);
  const [capped, setCapped] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const recordedRef = useRef(false);
  const [reviewing, setReviewing] = useState(false);
  const mistakeCount = useMistakeCount();
  const examsToday = useProgressStore((state) =>
    state.progress.daily.day === dayKey(new Date()) ? state.progress.daily.exams : 0,
  );

  useEffect(() => {
    setShowTimer(localStorage.getItem(TIMER_KEY) !== "off");
    if (boot === "review") beginReview();
    return () => abortRef.current?.abort();
    // boot is only read on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStage?.(stage);
  }, [stage, onStage]);

  useEffect(() => {
    if (stage !== "question") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [stage, startedAt]);

  const title = reviewing ? "Repaso de errores" : config.topic.trim() || paper?.title || "Examen";
  const subtitle = reviewing
    ? "Tus preguntas guardadas"
    : `${title} · ${difficultyLabel(config.difficulty)}`;
  const ready =
    online &&
    (config.source === "tema"
      ? config.topic.trim().length >= 2
      : config.source === "pdf"
        ? Boolean(doc)
        : Boolean(photo));

  function toggleTimer() {
    const next = !showTimer;
    setShowTimer(next);
    localStorage.setItem(TIMER_KEY, next ? "on" : "off");
  }

  async function pickDoc(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPicking(true);
    try {
      setDoc(await readDocument(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude leer ese archivo.");
    } finally {
      setPicking(false);
      if (docRef.current) docRef.current.value = "";
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPicking(true);
    try {
      setPhoto(await prepareImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude abrir esa imagen.");
    } finally {
      setPicking(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  function chooseSource(source: ExamSource) {
    setConfig((current) => ({ ...current, source }));
    setError(null);
    if (source === "pdf" && !doc) docRef.current?.click();
    if (source === "foto" && !photo) photoRef.current?.click();
  }

  function beginReview() {
    const next = reviewPaper(loadMistakes());
    if (!next) return;
    abortRef.current?.abort();
    recordedRef.current = false;
    setReviewing(true);
    setPaper(next);
    setAnswers([]);
    setIndex(0);
    setChoice(null);
    setWritten("");
    setError(null);
    setOpen(null);
    setEarned(0);
    setCapped(false);
    setStartedAt(Date.now());
    setElapsed(0);
    setConfirmExit(false);
    setStage("question");
  }

  async function start() {
    if (!ready) return;
    setReviewing(false);
    setError(null);
    setStage("loading");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await postJson<ExamPaper>(
        "/api/exam",
        {
          topic: config.topic.trim(),
          source: config.source,
          count: config.count,
          difficulty: config.difficulty,
          document: config.source === "pdf" ? doc : undefined,
          image: config.source === "foto" ? photo?.full : undefined,
        },
        controller.signal,
      );
      if (!Array.isArray(result.questions) || result.questions.length === 0) {
        throw new Error("No pude armar el examen. Probá de nuevo.");
      }
      setPaper(result);
      setAnswers([]);
      setIndex(0);
      setChoice(null);
      setWritten("");
      setOpen(null);
      recordedRef.current = false;
      setStartedAt(Date.now());
      setElapsed(0);
      setStage("question");
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "No pude armar el examen.");
      setStage("config");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function answer(skip: boolean) {
    if (!paper) return;
    const question = paper.questions[index];
    let entry: ExamAnswer;
    if (question.kind === "mc") {
      const given = skip ? null : choice;
      entry = { given, verdict: gradeChoice(question, given) };
    } else {
      const text = written.trim();
      entry = skip || !text ? { given: null, verdict: "incorrecta" } : { given: text };
    }
    const next = [...answers];
    next[index] = entry;
    setAnswers(next);
    setChoice(null);
    setWritten("");
    if (index + 1 < paper.questions.length) {
      setIndex(index + 1);
    } else {
      setElapsed(Date.now() - startedAt);
      void grade(next);
    }
  }

  async function grade(list: ExamAnswer[]) {
    if (!paper) return;
    const pending = paper.questions
      .map((question, i) => ({ question, i }))
      .filter(
        ({ question, i }) =>
          question.kind === "written" && list[i]?.given !== null && !list[i]?.verdict,
      );
    if (pending.length === 0) {
      finish(list);
      return;
    }
    setStage("grading");
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const graded = [...list];
      const topic = reviewing ? "Repaso de errores" : config.topic.trim() || paper.title;
      for (let start = 0; start < pending.length; start += 15) {
        const slice = pending.slice(start, start + 15);
        const { results } = await postJson<{ results: GradeResult[] }>(
          "/api/exam-grade",
          {
            topic,
            items: slice.map(({ question, i }) => ({
              prompt: question.prompt,
              expected: question.kind === "written" ? question.expected : "",
              answer: String(list[i].given),
            })),
          },
          controller.signal,
        );
        if (!Array.isArray(results) || results.length !== slice.length) {
          throw new Error("No pude corregir las respuestas escritas.");
        }
        slice.forEach(({ i }, n) => {
          const result = results[n];
          if (result)
            graded[i] = { ...graded[i], verdict: result.verdict, feedback: result.feedback };
        });
      }
      finish(graded);
    } catch (err) {
      if (controller.signal.aborted) return;
      setAnswers(list);
      setError(err instanceof Error ? err.message : "No pude corregir las respuestas escritas.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function finish(list: ExamAnswer[]) {
    if (!paper) return;
    setAnswers(list);
    const nota = computeNota(paper.questions, list);
    const firstWrong = paper.questions.findIndex((_, i) => list[i]?.verdict !== "correcta");
    setOpen(firstWrong === -1 ? null : firstWrong);
    saveMistakes(foldMistakes(loadMistakes(), paper.questions, list, Date.now()));
    if (!recordedRef.current) {
      recordedRef.current = true;
      const count = paper.questions.length;
      const difficulty = reviewing ? "media" : config.difficulty;
      const topic = reviewing ? "Repaso de errores" : config.topic.trim() || paper.title;
      // A long review is still practice: XP matches at most a 15-question exam.
      const xpCount = Math.min(count, 15);
      const xp = examXp(nota, xpCount, difficulty);
      const result = useProgressStore.getState().record({
        kind: "exam",
        topic,
        source: config.source,
        difficulty,
        count,
        correct: list.filter((a) => a.verdict === "correcta").length,
        nota,
        xp,
      });
      setEarned(result.earned);
      setCapped(result.earned === 0 && xp > 0);
    }
    setStage("result");
  }

  function requestClose() {
    if (stage === "question" || stage === "grading") {
      setConfirmExit(true);
      return;
    }
    abortRef.current?.abort();
    onClose();
  }

  function newExam() {
    setReviewing(false);
    setPaper(null);
    setAnswers([]);
    setError(null);
    setStage("config");
  }

  // Keyboard: A–D / 1–4 pick an option, Enter confirms.
  useEffect(() => {
    if (stage !== "question" || !paper) return;
    const question = paper.questions[index];
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement)
        return;
      if (question.kind !== "mc") return;
      const key = event.key.toLowerCase();
      const pick = "abcd".indexOf(key) >= 0 ? "abcd".indexOf(key) : "1234".indexOf(key);
      if (pick >= 0) setChoice(pick);
      if (key === "enter" && choice !== null) answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = (kicker: string, text: string, right: ReactNode, back: "x" | "back") => (
    <header className="hud-header flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:px-5">
      <button
        type="button"
        className="tap hud-btn grid size-11 place-items-center rounded-md border border-line"
        aria-label={back === "x" ? "Salir del examen" : "Volver"}
        onClick={requestClose}
      >
        {back === "x" ? (
          <X className="size-5" strokeWidth={1.5} />
        ) : (
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xs leading-none font-semibold tracking-widest text-neon uppercase">
          {kicker}
        </p>
        <p className="mt-1 truncate text-sm leading-tight font-medium">{text}</p>
      </div>
      {right}
    </header>
  );

  const hiddenInputs = (
    <>
      <input
        ref={docRef}
        type="file"
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => void pickDoc(e.target.files?.[0])}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickPhoto(e.target.files?.[0])}
      />
    </>
  );

  if (stage === "config" || stage === "loading") {
    const cappedToday = examsToday >= DAILY.exams;
    return (
      <>
        {header("NEXO AI", "Modo examen", status, "back")}
        {hiddenInputs}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 pt-[22px] pb-4">
            <p className="font-mono text-[11px] tracking-[0.16em] text-neon uppercase">
              Nueva misión
            </p>
            <h1 className="mt-2.5 font-display text-[32px] leading-none font-semibold text-fg">
              Armá tu examen<span className="text-neon">.</span>
            </h1>
            <p className="mt-2 mb-[22px] text-[14.5px] text-muted">
              Opción múltiple y respuestas cortas, corregidas al final con explicación.
            </p>

            <label htmlFor="exam-topic" className="g-label block">
              {config.source === "tema" ? "Tema" : "Tema (opcional)"}
            </label>
            <div className="hud-frame">
              <input
                id="exam-topic"
                className="dock h-12 w-full rounded-md bg-transparent px-3 text-base text-fg outline-none placeholder:text-faint"
                placeholder={
                  config.source === "tema"
                    ? "Ej: Revolución de Mayo (1810)"
                    : "Ej: capítulo 2, la célula"
                }
                maxLength={EXAM_TOPIC_MAX}
                value={config.topic}
                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void start();
                }}
                disabled={stage === "loading"}
              />
            </div>

            <p className="g-label mt-5">Fuente</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Fuente">
              {SOURCES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={config.source === item.id}
                  className="g-opt h-16 flex-col gap-1 text-[12.5px]"
                  onClick={() => chooseSource(item.id)}
                  disabled={stage === "loading"}
                >
                  <item.icon className="size-4" strokeWidth={1.75} />
                  {item.label}
                </button>
              ))}
            </div>
            {config.source === "pdf" ? (
              <SourceChip
                busy={picking}
                label={doc ? doc.name : "Elegí un PDF o apunte de texto"}
                detail={
                  doc
                    ? `${describeDoc(doc)}${doc.truncated ? " · se usa el comienzo" : ""}`
                    : "Las preguntas salen solo de ese material."
                }
                onPick={() => docRef.current?.click()}
                has={Boolean(doc)}
              />
            ) : null}
            {config.source === "foto" ? (
              <SourceChip
                busy={picking}
                thumb={photo?.thumb}
                label={photo ? "Foto lista" : "Sacá o elegí una foto de tus apuntes"}
                detail="Las preguntas salen solo de lo que se ve en la foto."
                onPick={() => photoRef.current?.click()}
                has={Boolean(photo)}
              />
            ) : null}

            <p className="g-label mt-5">Cantidad de preguntas</p>
            <div
              className="grid grid-cols-3 gap-1.5"
              role="radiogroup"
              aria-label="Cantidad de preguntas"
            >
              {EXAM_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={config.count === count}
                  className="g-opt"
                  onClick={() => setConfig({ ...config, count })}
                  disabled={stage === "loading"}
                >
                  {count}
                </button>
              ))}
            </div>

            <p className="g-label mt-5">Dificultad</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Dificultad">
              {EXAM_DIFFICULTIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={config.difficulty === item.id}
                  className="g-opt"
                  onClick={() => setConfig({ ...config, difficulty: item.id })}
                  disabled={stage === "loading"}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="g-card mt-5 bg-bg-elev/60 px-3.5 py-3 text-[13px] leading-normal text-muted">
              <span className="font-semibold text-fg">Cómo funciona:</span> NEXO arma las preguntas
              sobre tu tema, sin mostrar las respuestas. Al final ves tu nota, las correcciones y
              una explicación corta de cada error. Si te equivocás, la pregunta queda en este
              dispositivo para repasarla.
            </div>
            <div className="mt-[18px] flex items-center justify-between gap-2 font-mono text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <Clock className="size-[13px]" strokeWidth={1.75} />
                Unos {examMinutes(config.count)} minutos
              </span>
              <span
                className={`flex items-center gap-1.5 ${cappedToday ? "text-faint" : "text-neon"}`}
              >
                <Zap className="size-[13px]" strokeWidth={1.75} />
                {cappedToday
                  ? "Hoy ya sumaste XP con 3 exámenes"
                  : `Hasta +${examXpMax(config.count, config.difficulty)} XP`}
              </span>
            </div>
            {error ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted" role="alert">
                <span className="size-1.5 shrink-0 rounded-full bg-accent-r" aria-hidden="true" />
                {error}
              </p>
            ) : null}
            {!online ? (
              <p className="mt-4 text-sm text-faint">
                Modo examen necesita conexión con el modelo.
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 px-4 pt-3 pb-[18px]">
          <div className="mx-auto max-w-2xl">
            {stage === "loading" ? (
              <div className="flex flex-col gap-2">
                <div
                  className="scan-bar h-0.5 w-full overflow-hidden rounded-full bg-line"
                  aria-hidden="true"
                />
                <p
                  className="text-center font-mono text-xs tracking-wider text-muted uppercase"
                  role="status"
                >
                  Armando tu examen… puede tardar hasta un minuto
                </p>
                <button
                  type="button"
                  className="g-btn dim h-11 text-xs"
                  onClick={() => {
                    abortRef.current?.abort();
                    setStage("config");
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="g-btn primary w-full"
                  disabled={!ready}
                  onClick={() => void start()}
                >
                  <Target className="size-4" strokeWidth={1.75} />
                  Iniciar examen
                </button>
                {mistakeButtonLabel(mistakeCount) ? (
                  <button
                    type="button"
                    className="g-btn ghost mt-2 w-full text-xs tracking-[0.08em]"
                    onClick={beginReview}
                  >
                    <RotateCcw className="size-[13px]" strokeWidth={2} />
                    {mistakeButtonLabel(mistakeCount)}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  if (!paper) return null;

  if (stage === "question" || stage === "grading") {
    const question = paper.questions[Math.min(index, paper.questions.length - 1)];
    const total = paper.questions.length;
    const answered = answers.filter(Boolean).length;
    const canConfirm = question.kind === "mc" ? choice !== null : written.trim().length > 0;
    return (
      <>
        {header(
          reviewing ? "Repaso" : "Examen",
          subtitle,
          <button
            type="button"
            onClick={toggleTimer}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-sm border border-line px-2 font-mono text-xs tracking-wider text-muted"
            aria-label={showTimer ? "Ocultar reloj" : "Mostrar reloj"}
            title={showTimer ? "Ocultar reloj" : "Mostrar reloj"}
          >
            <Clock className="size-[13px]" strokeWidth={1.75} />
            {showTimer ? clock(elapsed) : "--:--"}
          </button>,
          "x",
        )}
        <div className="shrink-0 px-4 pt-3.5">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between">
              <span className="font-display text-[13px] font-semibold tracking-[0.16em] text-neon uppercase">
                Pregunta {Math.min(index + 1, total)}/{total}
              </span>
              <span className="font-mono text-[11px] text-faint">
                {answered} {answered === 1 ? "respondida" : "respondidas"}
              </span>
            </div>
            <div
              className="mt-2.5 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
              aria-hidden="true"
            >
              {paper.questions.map((q, i) => (
                <span
                  key={q.id}
                  className="h-[5px] rounded-[1px]"
                  style={{
                    background: i < answered ? "#3ee6f0" : i === index ? "#3ee6f066" : "#1c1c1c",
                    boxShadow: i < answered ? "0 0 6px #3ee6f0" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 pt-[26px] pb-4">
            {stage === "grading" ? (
              <div className="flex flex-col items-center gap-3 pt-10 text-center" role="status">
                {error ? (
                  <>
                    <p className="text-sm text-muted">{error}</p>
                    <div className="grid w-full grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="g-btn dim h-11 text-xs"
                        onClick={() => finish(answers)}
                      >
                        Ver nota sin escritas
                      </button>
                      <button
                        type="button"
                        className="g-btn primary h-11 text-xs"
                        onClick={() => void grade(answers)}
                      >
                        Reintentar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="scan-bar h-0.5 w-40 overflow-hidden rounded-full bg-line"
                      aria-hidden="true"
                    />
                    <p className="font-mono text-xs tracking-wider text-muted uppercase">
                      Corrigiendo tus respuestas…
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="hud-frame">
                  <div className="g-card px-4 py-[18px]">
                    <p className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
                      {question.kind === "mc" ? "Opción múltiple" : "Respuesta escrita"}
                    </p>
                    <p className="nexo-exam-prompt mt-2.5 text-xl leading-snug font-medium text-pretty text-fg">
                      {question.prompt}
                    </p>
                  </div>
                </div>
                {question.kind === "mc" ? (
                  <div
                    role="radiogroup"
                    aria-label="Opciones"
                    className="mt-2.5 flex flex-col gap-2.5"
                  >
                    {question.options.map((option, i) => (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={choice === i}
                        className="g-card g-answer"
                        onClick={() => setChoice(i)}
                      >
                        <span className="g-key">{LETTERS[i]}</span>
                        <span
                          className={`nexo-exam-body text-base ${choice === i ? "text-fg" : "text-muted"}`}
                        >
                          {option}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="hud-frame mt-3">
                    <textarea
                      aria-label="Tu respuesta"
                      className="nexo-exam-body dock block min-h-32 w-full resize-none rounded-md bg-transparent p-3 text-base text-fg outline-none placeholder:text-faint"
                      placeholder="Escribí tu respuesta en una o dos líneas…"
                      maxLength={1000}
                      value={written}
                      onChange={(e) => setWritten(e.target.value)}
                    />
                  </div>
                )}
                <p className="mx-0.5 mt-4 text-[12.5px] text-faint">
                  {question.kind === "mc"
                    ? "Elegí una opción y tocá confirmar. La corrección llega al final."
                    : "Escribí una respuesta corta. NEXO la corrige al final."}
                </p>
              </>
            )}
          </div>
        </div>
        {stage === "question" ? (
          <div className="shrink-0 px-4 pt-3 pb-[18px]">
            <div className="mx-auto grid max-w-2xl grid-cols-[1fr_2fr] gap-2">
              <button type="button" className="g-btn dim text-xs" onClick={() => answer(true)}>
                Saltar
              </button>
              <button
                type="button"
                className="g-btn primary"
                disabled={!canConfirm}
                onClick={() => answer(false)}
              >
                Confirmar
              </button>
            </div>
          </div>
        ) : null}
        {confirmExit ? (
          <ExitSheet
            onStay={() => setConfirmExit(false)}
            onLeave={() => {
              abortRef.current?.abort();
              setConfirmExit(false);
              onClose();
            }}
          />
        ) : null}
      </>
    );
  }

  // ---- Result ----
  const nota = computeNota(paper.questions, answers);
  const ok = passed(nota);
  const right = answers.filter((a) => a?.verdict === "correcta").length;
  const toReview = paper.questions.length - right;
  return (
    <>
      {header("Examen terminado", subtitle, status, "x")}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pt-4 pb-4">
          <div className="hud-frame">
            <div
              className="g-card flex items-center gap-4 p-4"
              style={{
                borderColor: ok ? "#3ecf8e55" : "#e85d4c55",
                background: `radial-gradient(80% 120% at 0% 0%,${ok ? "#3ecf8e14" : "#e85d4c14"},#0e0e0e 70%)`,
              }}
            >
              <div className="min-w-[92px] text-center">
                <p className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">Nota</p>
                <p className="mt-1 font-display text-[44px] leading-none font-semibold text-fg">
                  {formatNota(nota)}
                  <span className="text-[22px] text-muted">/10</span>
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`font-display text-xl font-semibold tracking-[0.14em] uppercase ${ok ? "text-accent-g" : "text-accent-r"}`}
                  style={{ textShadow: `0 0 12px ${ok ? "#3ecf8e66" : "#e85d4c66"}` }}
                >
                  {ok ? "Aprobado" : "Desaprobado"}
                </p>
                <p className="mt-1 mb-2 text-[12.5px] text-muted">
                  {right} bien · {toReview} para repasar · {shortClock(elapsed)} min
                </p>
                <span className="g-chip level h-7">+{earned} XP</span>
                {capped ? (
                  <p className="mt-1.5 text-[11px] text-faint">Límite diario de XP por exámenes.</p>
                ) : null}
              </div>
            </div>
          </div>
          <p className="g-label mt-5 mb-0.5">Preguntas</p>
          <ul>
            {paper.questions.map((question, i) => {
              const a = answers[i];
              const verdict = a?.verdict;
              const isOpen = open === i;
              return (
                <li key={question.id} className="border-b border-white/[0.08] py-[9px]">
                  <button
                    type="button"
                    className="flex w-full items-start gap-2.5 text-left"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <Mark verdict={verdict} />
                    <span className="w-[18px] pt-1 font-mono text-[11px] text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`nexo-exam-body flex-1 text-[13.5px] leading-snug ${verdict === "correcta" ? "text-muted" : "text-fg"}`}
                    >
                      {question.prompt}
                    </span>
                    <ChevronDown
                      className={`mt-0.5 size-[13px] shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={1.75}
                    />
                  </button>
                  {isOpen ? (
                    <div
                      className="mt-2.5 mb-0.5 ml-8 rounded-r-md border-l-2 px-3 py-2.5 text-[13px] leading-normal"
                      style={{
                        borderColor:
                          verdict === "correcta"
                            ? "#3ecf8e"
                            : verdict === "parcial"
                              ? "#f0b43e"
                              : "#e85d4c",
                        background:
                          verdict === "correcta"
                            ? "#3ecf8e0d"
                            : verdict === "parcial"
                              ? "#f0b43e0d"
                              : "#e85d4c0d",
                      }}
                    >
                      <p className="text-muted">
                        Tu respuesta:{" "}
                        <span
                          className={
                            verdict === "correcta"
                              ? "text-accent-g"
                              : verdict === "parcial"
                                ? "text-[#f0b43e]"
                                : "text-accent-r"
                          }
                        >
                          {givenText(question, a)}
                        </span>
                      </p>
                      {verdict !== "correcta" || question.kind === "written" ? (
                        <p className="mt-0.5 text-muted">
                          {question.kind === "mc" ? "Correcta" : "Respuesta esperada"}:{" "}
                          <span className="text-accent-g">{correctText(question)}</span>
                        </p>
                      ) : null}
                      {a?.feedback ? <p className="mt-1.5 text-fg">{a.feedback}</p> : null}
                      {question.explanation ? (
                        <p className="mt-1.5 text-fg">{question.explanation}</p>
                      ) : null}
                      {question.kind === "written" && a?.given !== null && !verdict ? (
                        <p className="mt-1.5 text-faint">
                          Esta respuesta no se pudo corregir y no cuenta para la nota.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="shrink-0 border-t border-white/[0.08] bg-bg px-4 pt-2.5 pb-[18px]">
        <div className="mx-auto max-w-2xl">
          {mistakeButtonLabel(mistakeCount) ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="g-btn ghost text-xs tracking-[0.06em]"
                onClick={beginReview}
              >
                <RotateCcw className="size-[13px]" strokeWidth={2} />
                {mistakeButtonLabel(mistakeCount)}
              </button>
              <button
                type="button"
                className="g-btn primary text-xs tracking-[0.08em] whitespace-nowrap"
                onClick={newExam}
              >
                <Target className="size-[13px]" strokeWidth={2} />
                Nuevo examen
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-center text-xs text-faint">{EMPTY_MISTAKES}</p>
              <button
                type="button"
                className="g-btn primary w-full text-xs tracking-[0.08em]"
                onClick={newExam}
              >
                <Target className="size-[13px]" strokeWidth={2} />
                Nuevo examen
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Mark({ verdict }: { verdict: ExamAnswer["verdict"] }) {
  const tone =
    verdict === "correcta"
      ? { c: "#3ecf8e", label: "Correcta" }
      : verdict === "parcial"
        ? { c: "#f0b43e", label: "Parcial" }
        : verdict === "incorrecta"
          ? { c: "#e85d4c", label: "Incorrecta" }
          : { c: "#8d8d8a", label: "Sin corregir" };
  const Icon = verdict === "correcta" ? Check : verdict === "incorrecta" ? X : Minus;
  return (
    <span
      className="grid size-[22px] shrink-0 place-items-center rounded-full"
      style={{ background: `${tone.c}22`, color: tone.c, border: `1px solid ${tone.c}88` }}
      title={tone.label}
    >
      <Icon className="size-[13px]" strokeWidth={2.5} aria-label={tone.label} />
    </span>
  );
}

function SourceChip({
  label,
  detail,
  thumb,
  has,
  busy,
  onPick,
}: {
  label: string;
  detail: string;
  thumb?: string;
  has: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <div className="g-card mt-2 flex items-center gap-3 px-3 py-2.5">
      {thumb ? (
        <img
          src={thumb}
          alt="Foto elegida"
          className="size-12 shrink-0 rounded-sm border border-neon/40 object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${has ? "text-fg" : "text-muted"}`}>
          {busy ? "Leyendo…" : label}
        </p>
        <p className="text-xs text-faint">{detail}</p>
      </div>
      <button
        type="button"
        className="g-btn dim h-9 shrink-0 px-3 text-[11px]"
        onClick={onPick}
        disabled={busy}
      >
        {has ? "Cambiar" : "Elegir"}
      </button>
    </div>
  );
}

function ExitSheet({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-title"
    >
      <button
        type="button"
        aria-label="Seguir con el examen"
        className="g-fade absolute inset-0 bg-ink/70"
        onClick={onStay}
      />
      <div className="g-fade relative w-full max-w-md rounded-t-2xl border border-line bg-bg-elev p-5">
        <p id="exit-title" className="font-display text-lg font-semibold text-fg">
          ¿Salir del examen?
        </p>
        <p className="mt-1 text-sm text-muted">Vas a perder las respuestas de este intento.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="g-btn dim h-11 text-xs" onClick={onLeave}>
            Salir
          </button>
          <button type="button" className="g-btn primary h-11 text-xs" onClick={onStay} autoFocus>
            Seguir
          </button>
        </div>
      </div>
    </div>
  );
}
