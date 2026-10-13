import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpenText,
  Camera,
  FileText,
  Layers,
  Network,
  RefreshCw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { ScreenHeader } from "@/components/nexo/local-screens";
import { MermaidDiagram } from "@/components/nexo/diagram";
import { postJson } from "@/components/nexo/exam";
import { DOC_ACCEPT, readDocument } from "@/lib/document-client";
import type { DocPayload } from "@/lib/document";
import { prepareImage, type PreparedImage } from "@/lib/image-client";
import { KIT_MAX_PHOTOS, loadLastKit, saveLastKit, type Kit } from "@/lib/kit";
import { useChatCardsStore } from "@/lib/study-store";

export type KitExamPreset = {
  topic: string;
  source: "pdf" | "foto";
  document?: DocPayload;
  image?: string;
};

type Material = { doc: DocPayload | null; photos: PreparedImage[] };
type Done = Kit & { source: string; saved: number };

/** Memory only (never stored): lets the exam reuse the same notes after a view switch. */
let held: { material: Material; done: Done | null } = {
  material: { doc: null, photos: [] },
  done: null,
};

/** 3.0: "Apuntes a material de estudio". */
export function KitView({
  onBack,
  status,
  online,
  onExam,
  onCards,
}: {
  onBack: () => void;
  status: ReactNode;
  online: boolean;
  onExam: (preset: KitExamPreset) => void;
  onCards: () => void;
}) {
  const [material, setMaterial] = useState<Material>(held.material);
  const [done, setDone] = useState<Done | null>(held.done);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!held.done) {
      const last = loadLastKit();
      if (last) setDone({ ...last, saved: 0 });
    }
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    held = { material, done };
  }, [material, done]);

  const hasMaterial = Boolean(material.doc) || material.photos.length > 0;

  async function pickDoc(file: File | undefined) {
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const doc = await readDocument(file);
      setMaterial({ doc, photos: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude leer ese archivo.");
    } finally {
      setReading(false);
      if (docRef.current) docRef.current.value = "";
    }
  }

  async function pickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setReading(true);
    try {
      const room = KIT_MAX_PHOTOS - material.photos.length;
      const list = [...files].slice(0, Math.max(0, room));
      if (files.length > room) setError(`Entran hasta ${KIT_MAX_PHOTOS} fotos por kit.`);
      const prepared: PreparedImage[] = [];
      for (const file of list) prepared.push(await prepareImage(file));
      setMaterial((current) => ({ doc: null, photos: [...current.photos, ...prepared] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude abrir esa imagen.");
    } finally {
      setReading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  async function build() {
    if (!hasMaterial || busy) return;
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const kit = await postJson<Kit>(
        "/api/kit",
        material.doc ? { document: material.doc } : { images: material.photos.map((p) => p.full) },
        controller.signal,
      );
      const source = material.doc
        ? material.doc.name
        : `${material.photos.length} foto${material.photos.length > 1 ? "s" : ""} de apuntes`;
      const saved = kit.cards.length
        ? useChatCardsStore.getState().add(kit.cards, `Kit: ${kit.title}`)
        : 0;
      saveLastKit(kit, source);
      setDone({ ...kit, source, saved });
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : "No pude armar el kit.");
    } finally {
      setBusy(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function startOver() {
    setMaterial({ doc: null, photos: [] });
    setDone(null);
    setError(null);
  }

  function exam() {
    if (!done) return;
    if (material.doc) onExam({ topic: done.title, source: "pdf", document: material.doc });
    else if (material.photos[0])
      onExam({ topic: done.title, source: "foto", image: material.photos[0].full });
  }

  const inputs = (
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
        multiple
        className="hidden"
        onChange={(e) => void pickPhotos(e.target.files)}
      />
    </>
  );

  return (
    <>
      <ScreenHeader title="Apuntes a material" onBack={onBack} status={status} />
      {inputs}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
          {done ? (
            <Result
              done={done}
              canExam={hasMaterial && online}
              examHint={
                !hasMaterial
                  ? "Para el examen volvé a subir los apuntes (no se guardan)."
                  : !online
                    ? "Necesitás conexión para el examen."
                    : material.photos.length > 1
                      ? "El examen usa la primera foto. Usa 1 de tus 5 exámenes de hoy."
                      : "Usa 1 de tus 5 exámenes de hoy."
              }
              onExam={exam}
              onCards={onCards}
              onNew={startOver}
            />
          ) : (
            <>
              <div>
                <p className="font-mono text-[11px] tracking-[0.16em] text-neon uppercase">
                  Kit de estudio
                </p>
                <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold text-fg">
                  Subí tus apuntes<span className="text-neon">.</span>
                </h1>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
                  Con un toque NEXO te arma un resumen, fichas para repasar, un diagrama y un examen
                  de práctica, todo sacado de tus apuntes.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="g-opt h-20 flex-col gap-1.5 text-[13px]"
                  aria-pressed={Boolean(material.doc)}
                  onClick={() => docRef.current?.click()}
                  disabled={busy || reading}
                >
                  <FileText className="size-5 text-neon" strokeWidth={1.75} />
                  PDF o texto
                </button>
                <button
                  type="button"
                  className="g-opt h-20 flex-col gap-1.5 text-[13px]"
                  aria-pressed={material.photos.length > 0}
                  onClick={() => photoRef.current?.click()}
                  disabled={busy || reading || material.photos.length >= KIT_MAX_PHOTOS}
                >
                  <Camera className="size-5 text-neon" strokeWidth={1.75} />
                  Fotos del cuaderno
                  <span className="text-[11px] text-faint">hasta {KIT_MAX_PHOTOS}</span>
                </button>
              </div>

              {material.doc ? (
                <div className="flex items-center gap-3 rounded-md border border-line bg-bg-elev/70 px-3 py-2.5">
                  <FileText className="size-5 shrink-0 text-neon" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{material.doc.name}</span>
                    <span className="block text-xs text-faint">
                      {material.doc.pages
                        ? `${material.doc.pages} página${material.doc.pages > 1 ? "s" : ""} leídas`
                        : "Texto listo"}
                      {material.doc.truncated ? " · recortado" : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Quitar archivo"
                    className="tap grid size-9 place-items-center text-faint"
                    onClick={() => setMaterial({ doc: null, photos: [] })}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : null}

              {material.photos.length ? (
                <div className="flex flex-wrap gap-2">
                  {material.photos.map((photo, i) => (
                    <div
                      key={i}
                      className="relative size-24 overflow-hidden rounded-md border border-line"
                    >
                      <img
                        src={photo.thumb}
                        alt={`Foto ${i + 1}`}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Quitar foto ${i + 1}`}
                        className="tap absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-bg/80 text-fg"
                        onClick={() =>
                          setMaterial((m) => ({ ...m, photos: m.photos.filter((_, j) => j !== i) }))
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-300">{error}</p> : null}

              <button
                type="button"
                className="tap g-btn h-12 w-full gap-2 text-sm"
                disabled={!hasMaterial || busy || reading || !online}
                onClick={() => void build()}
              >
                <Sparkles className="size-4" strokeWidth={1.75} />
                {busy ? "Armando tu kit…" : reading ? "Leyendo…" : "Armar kit de estudio"}
              </button>
              <div className="rounded-md border border-line bg-bg-elev/50 px-3 py-2.5 text-xs leading-relaxed text-faint">
                <p className="text-muted">Qué gasta del cupo gratis:</p>
                <p>· Resumen + fichas + diagrama: 1 de tus 40 chats de hoy.</p>
                <p>· Examen de práctica (si lo hacés): 1 de tus 5 exámenes de hoy.</p>
                <p>Tus apuntes no se guardan: solo el resultado queda en este dispositivo.</p>
              </div>
              {!online ? (
                <p className="text-xs text-faint">Necesitás conexión para armar el kit.</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-line bg-bg-elev/70 p-4">
      <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-widest text-neon uppercase">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

function Result({
  done,
  canExam,
  examHint,
  onExam,
  onCards,
  onNew,
}: {
  done: Done;
  canExam: boolean;
  examHint: string;
  onExam: () => void;
  onCards: () => void;
  onNew: () => void;
}) {
  return (
    <>
      <div>
        <p className="font-mono text-[11px] tracking-[0.16em] text-neon uppercase">
          Kit listo · {done.source}
        </p>
        <h1 className="mt-2 font-display text-[26px] leading-tight font-semibold text-fg">
          {done.title}
          <span className="text-neon">.</span>
        </h1>
      </div>

      <Section icon={<BookOpenText className="size-3.5" />} title="Resumen">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-fg">
          {done.summary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Section>

      <Section icon={<Layers className="size-3.5" />} title={`Fichas (${done.cards.length})`}>
        <ul className="flex flex-col gap-2">
          {done.cards.slice(0, 3).map((card, i) => (
            <li key={i} className="rounded-sm border border-line px-3 py-2 text-sm">
              <p className="text-fg">{card.front}</p>
              <p className="mt-1 text-xs text-muted">{card.back}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-faint">
            {done.saved > 0
              ? `Se guardaron ${done.saved} en tus Fichas.`
              : "Ya están en tus Fichas."}
          </span>
          <button type="button" className="tap g-btn ghost h-10 px-4 text-xs" onClick={onCards}>
            Repasar fichas
          </button>
        </div>
      </Section>

      {done.diagram ? (
        <Section icon={<Network className="size-3.5" />} title="Diagrama">
          <MermaidDiagram code={done.diagram} />
        </Section>
      ) : null}

      <Section icon={<Target className="size-3.5" />} title="Examen de práctica">
        <p className="text-sm text-muted">10 preguntas sacadas de tus apuntes, con corrección.</p>
        <button
          type="button"
          className="tap g-btn mt-3 h-11 w-full gap-2 text-sm"
          disabled={!canExam}
          onClick={onExam}
        >
          <Target className="size-4" strokeWidth={1.75} />
          Hacer el examen
        </button>
        <p className="mt-2 text-xs text-faint">{examHint}</p>
      </Section>

      <button
        type="button"
        className="tap flex h-11 items-center justify-center gap-2 text-sm text-muted hover:text-fg"
        onClick={onNew}
      >
        <RefreshCw className="size-4" strokeWidth={1.75} />
        Armar otro kit
      </button>
    </>
  );
}
