import { useRef, useState, type ReactNode } from "react";
import { FileSearch, FileText, Sparkles } from "lucide-react";
import { ScreenHeader } from "@/components/nexo/local-screens";
import {
  compareAiPrompt,
  compareWithNotes,
  plainAnswer,
  type CompareResult,
  type MatchStatus,
} from "@/lib/compare";
import { describeDoc, type DocPayload } from "@/lib/document";
import { DOC_ACCEPT, readDocument } from "@/lib/document-client";

const TONE: Record<MatchStatus, { label: string; color: string }> = {
  coincide: { label: "Coincide con el apunte", color: "#3ecf8e" },
  parcial: { label: "Parecido: revisalo", color: "#f0b43e" },
  "no-esta": { label: "No está en el apunte", color: "#e85d4c" },
  corta: { label: "Muy corta para comparar", color: "#8d8d8a" },
};

function pageText(page: number | null) {
  return page ? ` (pág. ${page})` : "";
}

export function CompareView({
  onBack,
  status,
  initialAnswer,
  threadDoc,
  online,
  onAskAi,
}: {
  onBack: () => void;
  status: ReactNode;
  initialAnswer: string;
  threadDoc: DocPayload | null;
  online: boolean;
  /** Opens the chat with the notes attached and asks for an AI review (1 chat). */
  onAskAi: (prompt: string, doc: DocPayload) => void;
}) {
  const [answer, setAnswer] = useState(() => plainAnswer(initialAnswer));
  const [doc, setDoc] = useState<DocPayload | null>(threadDoc);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      setDoc(await readDocument(file));
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude leer ese archivo.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function run() {
    if (!doc) {
      setError("Primero elegí el PDF o apunte.");
      return;
    }
    if (answer.trim().length < 10) {
      setError("Escribí o pegá una respuesta un poco más larga.");
      return;
    }
    setError(null);
    setResult(compareWithNotes(answer, doc.text));
  }

  return (
    <>
      <ScreenHeader title="Comparar con el apunte" onBack={onBack} status={status} />
      <input
        ref={fileRef}
        type="file"
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="hud-frame grid size-12 place-items-center text-neon">
              <FileSearch className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold text-paper">
                Comparar con el apunte
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Pegá tu respuesta (o una de NEXO) y mirá qué coincide con tu PDF y qué no.
              </p>
            </div>
          </div>

          <div className="g-card flex items-center gap-3 px-3 py-2.5">
            <FileText className="size-5 shrink-0 text-neon" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm ${doc ? "text-fg" : "text-muted"}`}>
                {reading ? "Leyendo…" : doc ? doc.name : "Elegí un PDF o apunte (.pdf, .txt, .md)"}
              </p>
              <p className="text-xs text-faint">
                {doc
                  ? `${describeDoc(doc)}${doc.truncated ? " · solo una parte" : ""}`
                  : "Se lee en tu dispositivo."}
              </p>
            </div>
            <button
              type="button"
              className="g-btn dim h-9 shrink-0 px-3 text-[11px]"
              disabled={reading}
              onClick={() => fileRef.current?.click()}
            >
              {doc ? "Cambiar" : "Elegir"}
            </button>
          </div>

          <label className="block">
            <span className="g-label block">Respuesta a comparar</span>
            <textarea
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                setResult(null);
              }}
              rows={7}
              maxLength={6000}
              placeholder="Ej: La Primera Junta se formó el 25 de mayo de 1810…"
              className="block w-full resize-y rounded-md border border-line bg-bg-elev p-3 text-sm leading-relaxed text-fg outline-none placeholder:text-faint focus:border-neon/60"
            />
          </label>

          {error ? (
            <p className="flex items-center gap-2 text-sm text-muted" role="alert">
              <span className="size-1.5 shrink-0 rounded-full bg-accent-r" aria-hidden="true" />
              {error}
            </p>
          ) : null}
          <button type="button" className="g-btn primary w-full" onClick={run} disabled={reading}>
            <FileSearch className="size-4" strokeWidth={1.75} />
            Comparar (gratis, sin internet)
          </button>

          {result ? (
            <section aria-label="Resultado" className="flex flex-col gap-3">
              <div className="g-card p-3">
                <p className="text-sm text-fg">
                  <span className="text-accent-g">{result.counts.coincide} coinciden</span> ·{" "}
                  <span className="text-[#f0b43e]">{result.counts.parcial} parecidas</span> ·{" "}
                  <span className="text-accent-r">{result.counts.noEsta} no están</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-accent-g"
                    style={{ width: `${Math.round(result.coverage * 100)}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-[11px] text-faint">
                  Parecido al apunte: {Math.round(result.coverage * 100)} %
                </p>
              </div>
              <ol className="flex flex-col gap-2">
                {result.sentences.map((item, i) => {
                  const tone = TONE[item.status];
                  return (
                    <li
                      key={i}
                      className="rounded-r-md border-l-2 px-3 py-2 text-sm leading-relaxed"
                      style={{ borderColor: tone.color, background: `${tone.color}0f` }}
                    >
                      <p className="text-fg">{item.sentence}</p>
                      <p
                        className="mt-1 font-mono text-[10.5px] tracking-wider uppercase"
                        style={{ color: tone.color }}
                      >
                        {tone.label}
                        {item.status !== "no-esta" ? pageText(item.page) : ""}
                      </p>
                      {item.numberDiff ? (
                        <p className="mt-1 text-xs text-fg">
                          Dato distinto: vos ponés <b>{item.numberDiff.yours.join(", ")}</b>
                          {item.numberDiff.notes.length > 0 ? (
                            <>
                              ; el apunte dice <b>{item.numberDiff.notes.join(", ")}</b>
                            </>
                          ) : null}
                          .
                        </p>
                      ) : null}
                      {item.quote && item.status !== "coincide" ? (
                        <p className="mt-1 text-xs text-muted">
                          Apunte{pageText(item.page)}: «{item.quote}»
                        </p>
                      ) : null}
                      {item.status !== "corta" && item.unknown.length > 0 ? (
                        <p className="mt-1 text-xs text-faint">
                          No aparecen en el apunte: {item.unknown.join(", ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              {result.missing.length > 0 ? (
                <div>
                  <p className="g-label">Del apunte y no lo mencionaste</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {result.missing.map((item) => (
                      <li
                        key={item.word}
                        className="rounded-sm border border-line px-2 py-1 text-xs text-muted"
                      >
                        {item.word}
                        {item.page ? <span className="text-faint"> · pág. {item.page}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs leading-relaxed text-faint">
                Esta comparación mira palabras, no el sentido: si dijiste lo mismo con otras
                palabras puede marcarlo como distinto. Para una revisión más fina, pedísela a NEXO.
              </p>
              {doc ? (
                <button
                  type="button"
                  className="g-btn ghost w-full text-xs"
                  disabled={!online}
                  onClick={() => onAskAi(compareAiPrompt(answer, doc.name), doc)}
                >
                  <Sparkles className="size-4" strokeWidth={1.75} />
                  Revisar con NEXO (usa 1 chat)
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
