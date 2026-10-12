import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, LogOut, Share2, Sparkles, Users, X } from "lucide-react";
import { ScreenHeader } from "@/components/nexo/local-screens";
import { clearDeviceToken, deviceHeaders } from "@/lib/access-client";
import {
  formatClassCode,
  groupChallenge,
  groupShareText,
  newClassCode,
  scoreGroup,
} from "@/lib/group";
import { dayKey } from "@/lib/progress";
import { dayLabelLong } from "@/lib/study-plan";
import { useGroupStore } from "@/lib/study-store";

type Stats = { done: number; perfect: number; average: number | null };

async function groupFetch(method: "GET" | "POST", code: string, day: string, correct?: number) {
  const url =
    method === "GET" ? `/api/group?code=${encodeURIComponent(code)}&day=${day}` : "/api/group";
  const response = await fetch(url, {
    method,
    headers: deviceHeaders(),
    body: method === "POST" ? JSON.stringify({ code, day, correct }) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as Stats & { code?: string };
  if (response.status === 401 && data.code === "access_required") clearDeviceToken();
  if (!response.ok) throw new Error("sin-contador");
  return data;
}

export function GroupView({
  onBack,
  status,
  onAsk,
  online,
}: {
  onBack: () => void;
  status: ReactNode;
  onAsk: (prompt: string) => void;
  online: boolean;
}) {
  const code = useGroupStore((state) => state.code);
  const results = useGroupStore((state) => state.results);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const today = dayKey(new Date());
  const challenge = useMemo(() => (code ? groupChallenge(code, today) : null), [code, today]);
  const saved = code && results[today]?.code === code ? results[today] : null;
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    setAnswers(saved ? saved.answers : [null, null, null]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let cancel = false;
    groupFetch("GET", code, today)
      .then((data) => {
        if (!cancel) {
          setStats(data);
          setStatsError(false);
        }
      })
      .catch(() => {
        if (!cancel) setStatsError(true);
      });
    return () => {
      cancel = true;
    };
  }, [code, today]);

  function join(raw: string) {
    if (!useGroupStore.getState().join(raw)) {
      setError("El código tiene que tener de 4 a 10 letras o números.");
      return;
    }
    setError(null);
    setStats(null);
  }

  function finish() {
    if (!code || !challenge) return;
    const correct = scoreGroup(challenge.questions, answers);
    useGroupStore.getState().save(today, { code, answers, correct });
    groupFetch("POST", code, today, correct)
      .then((data) => {
        setStats(data);
        setStatsError(false);
      })
      .catch(() => setStatsError(true));
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  }

  async function share(text: string) {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ text, title: "NEXO AI" });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    void copy(text, "share");
  }

  return (
    <>
      <ScreenHeader title="Modo grupo" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="hud-frame grid size-12 place-items-center text-neon">
              <Users className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold text-paper">
                Modo grupo
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Mismo código de clase = mismo desafío del día. Sin chat y sin nombres.
              </p>
            </div>
          </div>

          {!code ? (
            <>
              <label className="block">
                <span className="g-label block">Código de clase</span>
                <div className="flex gap-2">
                  <input
                    value={draft}
                    maxLength={14}
                    autoCapitalize="characters"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") join(draft);
                    }}
                    placeholder="Ej: 4TOB25"
                    className="h-12 min-w-0 flex-1 rounded-md border border-line bg-bg-elev px-3 font-mono text-base tracking-widest text-fg uppercase outline-none placeholder:text-faint placeholder:normal-case focus:border-neon/60"
                  />
                  <button type="button" className="g-btn primary px-4" onClick={() => join(draft)}>
                    Unirme
                  </button>
                </div>
              </label>
              {error ? <p className="text-sm text-muted">{error}</p> : null}
              <button
                type="button"
                className="g-btn ghost w-full text-xs"
                onClick={() => {
                  const next = newClassCode();
                  join(next);
                  setCreated(true);
                }}
              >
                Crear un código nuevo para mi clase
              </button>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted">
                <li>Cada día hay 3 preguntas cortas de distintas materias.</li>
                <li>Todos los que usan el mismo código ven las mismas preguntas.</li>
                <li>Se responde sin internet y no gasta tus chats.</li>
                <li>Solo se cuenta, en anónimo, cuántos de la clase lo terminaron hoy.</li>
              </ul>
            </>
          ) : challenge ? (
            <>
              <div className="hud-frame">
                <div className="g-card flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] tracking-widest text-faint uppercase">
                      Tu clase
                    </p>
                    <p className="font-display text-2xl font-semibold tracking-widest text-paper">
                      {formatClassCode(code)}
                    </p>
                    {created ? (
                      <p className="text-xs text-neon">Pasale este código a tu clase.</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="tap hud-btn grid size-11 place-items-center rounded-md border border-line"
                    aria-label="Copiar código"
                    onClick={() => void copy(code, "code")}
                  >
                    {copied === "code" ? (
                      <Check className="size-4 text-neon" />
                    ) : (
                      <Copy className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="tap hud-btn grid size-11 place-items-center rounded-md border border-line"
                    aria-label="Salir de la clase"
                    onClick={() => {
                      useGroupStore.getState().leave();
                      setCreated(false);
                      setDraft("");
                    }}
                  >
                    <LogOut className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              <p className="g-label mt-1 mb-0">Desafío del {dayLabelLong(today)}</p>
              <ol className="flex flex-col gap-3">
                {challenge.questions.map((q, i) => {
                  const pickedIndex = answers[i];
                  return (
                    <li key={q.id} className="g-card p-3">
                      <p className="font-mono text-[10px] tracking-widest text-neon uppercase">
                        {i + 1}/3 · {q.subject}
                      </p>
                      <p className="mt-1.5 text-[15px] leading-snug text-fg">{q.q}</p>
                      <div
                        className="mt-2 grid gap-1.5"
                        role="radiogroup"
                        aria-label={`Pregunta ${i + 1}`}
                      >
                        {q.options.map((option, n) => {
                          const chosen = pickedIndex === n;
                          const right = saved && n === q.answer;
                          const wrong = saved && chosen && n !== q.answer;
                          return (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={chosen}
                              disabled={Boolean(saved)}
                              onClick={() =>
                                setAnswers((list) => list.map((a, k) => (k === i ? n : a)))
                              }
                              className={`tap flex min-h-11 items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm ${
                                right
                                  ? "border-accent-g/70 text-accent-g"
                                  : wrong
                                    ? "border-accent-r/70 text-accent-r"
                                    : chosen
                                      ? "border-neon/60 text-fg"
                                      : "border-line text-muted"
                              }`}
                            >
                              <span className="font-mono text-xs text-faint">{"ABCD"[n]}</span>
                              <span className="flex-1">{option}</span>
                              {right ? (
                                <Check className="size-4" />
                              ) : wrong ? (
                                <X className="size-4" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      {saved ? (
                        <div className="mt-2 text-xs leading-relaxed text-muted">
                          <p>{q.why}</p>
                          <button
                            type="button"
                            disabled={!online}
                            className="tap mt-1 inline-flex items-center gap-1 text-neon disabled:opacity-40"
                            onClick={() =>
                              onAsk(
                                `Explicame corto por qué en «${q.q}» la respuesta es «${q.options[q.answer]}».`,
                              )
                            }
                          >
                            <Sparkles className="size-3.5" strokeWidth={1.75} />
                            Preguntarle a NEXO (1 chat)
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              {saved ? (
                <div className="g-card p-3 text-center">
                  <p className="font-display text-3xl font-semibold text-paper">
                    {saved.correct}/3
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {stats && stats.done > 0
                      ? `${stats.done} de tu clase ${stats.done === 1 ? "lo hizo" : "lo hicieron"} hoy · promedio ${String(stats.average ?? 0).replace(".", ",")}/3`
                      : statsError
                        ? "No pude ver cuántos de tu clase lo hicieron. Tu resultado quedó guardado acá."
                        : "Sos de los primeros de tu clase en hacerlo hoy."}
                  </p>
                  <button
                    type="button"
                    className="g-btn ghost mt-3 w-full text-xs"
                    onClick={() =>
                      void share(groupShareText(code, dayLabelLong(today), saved.correct, 3))
                    }
                  >
                    <Share2 className="size-4" strokeWidth={1.75} />
                    {copied === "share" ? "Copiado" : "Compartir resultado"}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="g-btn primary w-full"
                    disabled={answers.some((a) => a === null)}
                    onClick={finish}
                  >
                    Terminar desafío
                  </button>
                  <p className="text-center text-xs text-faint">
                    {stats && stats.done > 0
                      ? `${stats.done} de tu clase ya lo ${stats.done === 1 ? "hizo" : "hicieron"} hoy.`
                      : "Respondé las 3 para ver el resultado."}
                  </p>
                </>
              )}
              <History results={results} code={code} today={today} />
              <p className="text-xs leading-relaxed text-faint">
                Sin chat ni perfiles. El servidor solo guarda en memoria un contador anónimo por
                clase (se borra al reiniciarse). Las preguntas salen del código y la fecha, sin IA.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function History({
  results,
  code,
  today,
}: {
  results: Record<string, { code: string; correct: number }>;
  code: string;
  today: string;
}) {
  const past = Object.entries(results)
    .filter(([day, r]) => day !== today && r.code === code)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 7);
  if (past.length === 0) return null;
  return (
    <div>
      <p className="g-label">Días anteriores</p>
      <ul className="flex flex-wrap gap-1.5">
        {past.map(([day, r]) => (
          <li
            key={day}
            className="rounded-sm border border-line px-2 py-1 font-mono text-[11px] text-muted"
          >
            {day.slice(8)}/{day.slice(5, 7)} · {r.correct}/3
          </li>
        ))}
      </ul>
    </div>
  );
}
