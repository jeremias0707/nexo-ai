import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  Flag,
  Layers,
  RotateCcw,
  Star,
  User,
} from "lucide-react";
import { buildDeck } from "@/lib/cards";
import { useCardsStore, useFavoritesStore, useProfileStore, useWeekStore } from "@/lib/local-store";
import { loadMistakes, subscribeMistakes } from "@/lib/mistakes";
import { prepareAvatar } from "@/lib/image-client";
import { DEFAULT_NICK } from "@/lib/profile";
import { levelFor, liveStreak, MEDALS } from "@/lib/progress";
import { useProgressStore } from "@/lib/progress-store";
import { missionFor, shareLines } from "@/lib/week";
import { useToday } from "@/lib/use-progress";

function ScreenHeader({
  title,
  onBack,
  status,
}: {
  title: string;
  onBack: () => void;
  status: ReactNode;
}) {
  return (
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
        <p className="mt-1 truncate text-sm leading-tight font-medium">{title}</p>
      </div>
      {status}
    </header>
  );
}

export function IdentityView({ onBack, status }: { onBack: () => void; status: ReactNode }) {
  const nick = useProfileStore((state) => state.nick);
  const photo = useProfileStore((state) => state.photo);
  const [draft, setDraft] = useState(nick);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(nick), [nick]);

  return (
    <>
      <ScreenHeader title="Perfil" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
          <div className="flex items-center gap-4">
            {photo ? (
              <img
                src={photo}
                alt=""
                className="size-16 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="hud-frame grid size-16 place-items-center text-neon">
                <User className="size-7" strokeWidth={1.5} />
              </span>
            )}
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold tracking-tight text-paper">
                {nick}
              </h1>
              <p className="mt-1.5 text-sm text-muted">Solo en este navegador. NEXO no lo manda.</p>
            </div>
          </div>

          <label className="block">
            <span className="g-label">Apodo</span>
            <input
              value={draft}
              maxLength={24}
              aria-label="Apodo"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => useProfileStore.getState().setNick(draft)}
              className="h-11 w-full rounded-md border border-line bg-bg-elev px-3 text-sm text-fg outline-none focus:border-neon/60"
              placeholder={DEFAULT_NICK}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="tap g-btn ghost h-11 cursor-pointer px-4 text-sm">
              {busy ? "Abriendo…" : photo ? "Cambiar foto" : "Elegir foto"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setBusy(true);
                  setError(null);
                  void prepareAvatar(file)
                    .then((url) => useProfileStore.getState().setPhoto(url))
                    .catch((err: unknown) =>
                      setError(err instanceof Error ? err.message : "No pude guardar la foto."),
                    )
                    .finally(() => setBusy(false));
                }}
              />
            </label>
            {photo ? (
              <button
                type="button"
                className="tap g-btn dim h-11 px-4 text-sm"
                onClick={() => useProfileStore.getState().setPhoto(null)}
              >
                Quitar foto
              </button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-muted">{error}</p> : null}
          <p className="text-xs leading-relaxed text-faint">
            La foto se achica y queda en este dispositivo. No se sube a ningún servidor.
          </p>
        </div>
      </div>
    </>
  );
}

export function MenuIdentity({ onOpen }: { onOpen: () => void }) {
  const nick = useProfileStore((state) => state.nick);
  const photo = useProfileStore((state) => state.photo);
  const letter = (nick.trim()[0] || "V").toUpperCase();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap mb-3 flex w-full items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-bg-soft"
    >
      {photo ? (
        <img src={photo} alt="" className="size-10 rounded-full border border-line object-cover" />
      ) : (
        <span className="grid size-10 place-items-center rounded-full border border-line font-display text-sm text-neon">
          {letter}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-paper">{nick}</span>
        <span className="block text-xs text-faint">Perfil</span>
      </span>
    </button>
  );
}

export function FavoritesView({ onBack, status }: { onBack: () => void; status: ReactNode }) {
  const items = useFavoritesStore((state) => state.items);
  return (
    <>
      <ScreenHeader title="Favoritos" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="hud-frame grid size-12 place-items-center text-neon">
              <Star className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold text-paper">Favoritos</h1>
              <p className="mt-1.5 text-sm text-muted">Respuestas que marcaste con la estrella.</p>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-faint">Todavía no marcaste ninguna. En el chat, tocá la estrella.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border border-line bg-bg-elev/60 p-3">
                  <p className="text-xs text-faint">{item.q}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg">{item.a}</p>
                  <button
                    type="button"
                    className="tap mt-2 text-xs text-muted hover:text-fg"
                    onClick={() =>
                      useFavoritesStore.getState().toggle({ ...item, at: item.at })
                    }
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export function CardsView({ onBack, status }: { onBack: () => void; status: ReactNode }) {
  const favorites = useFavoritesStore((state) => state.items);
  const known = useCardsStore((state) => state.known);
  const [mistakes, setMistakes] = useState(() => loadMistakes());
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const deck = buildDeck(favorites, mistakes);
  const card = deck[index] ?? null;

  useEffect(() => subscribeMistakes(() => setMistakes(loadMistakes())), []);
  useEffect(() => {
    if (index >= deck.length) setIndex(0);
  }, [deck.length, index]);

  function grade(knew: boolean) {
    if (!card) return;
    useCardsStore.getState().review(card.id, knew);
    setFlipped(false);
    setIndex((current) => (deck.length <= 1 ? 0 : (current + 1) % deck.length));
  }

  return (
    <>
      <ScreenHeader title="Fichas" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="hud-frame grid size-12 place-items-center text-neon">
              <Layers className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold text-paper">Fichas</h1>
              <p className="mt-1.5 text-sm text-muted">
                Armadas con tus favoritos y los errores guardados. Sin pedir nada al modelo.
              </p>
            </div>
          </div>
          {!card ? (
            <p className="text-sm text-faint">
              Marcá una respuesta con la estrella, o guardá un error del examen, para tener fichas.
            </p>
          ) : (
            <>
              <p className="font-mono text-xs tracking-wider text-faint uppercase">
                {index + 1} / {deck.length}
                {known.includes(card.id) ? " · la sabías" : ""}
                {card.from === "error" ? " · error" : " · favorito"}
              </p>
              <button
                type="button"
                className="tap min-h-48 rounded-md border border-line bg-bg-elev/70 p-5 text-left"
                onClick={() => setFlipped((value) => !value)}
                aria-pressed={flipped}
              >
                <p className="font-mono text-[11px] tracking-widest text-neon uppercase">
                  {flipped ? "Atrás" : "Frente"}
                </p>
                <p className="mt-3 text-base leading-relaxed text-fg">
                  {flipped ? card.back : card.front}
                </p>
                <p className="mt-4 text-xs text-faint">{flipped ? "Tocá para volver" : "Tocá para dar vuelta"}</p>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="tap g-btn ghost h-11 text-sm" onClick={() => grade(true)}>
                  La sabía
                </button>
                <button type="button" className="tap g-btn dim h-11 text-sm" onClick={() => grade(false)}>
                  No la sabía
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

async function shareCard(lines: string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#050608";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#3ee6f0";
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, 984, 1254);
  ctx.fillStyle = "#3ee6f0";
  ctx.font = "600 48px sans-serif";
  ctx.fillText(lines[0] ?? "NEXO AI", 96, 180);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "600 54px sans-serif";
  lines.slice(1).forEach((line, i) => {
    ctx.fillText(line, 96, 340 + i * 120);
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const file = new File([blob], "nexo-tarjeta.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "NEXO AI" });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nexo-tarjeta.png";
  link.click();
  URL.revokeObjectURL(url);
}

export function WeekView({ onBack, status }: { onBack: () => void; status: ReactNode }) {
  const week = useWeekStore((state) => state.week);
  const progress = useProgressStore((state) => state.progress);
  const today = useToday();
  const mission = missionFor(new Date());
  const current = week.weekId === mission.weekId ? week : { weekId: mission.weekId, n: 0, done: false };
  const info = levelFor(progress.xp);
  const streak = liveStreak(progress.streak, today);
  const medal =
    MEDALS.map((item) => item.id)
      .filter((id) => progress.medals[id])
      .map((id) => MEDALS.find((item) => item.id === id)?.name)
      .filter(Boolean)
      .at(-1) ?? null;

  return (
    <>
      <ScreenHeader title="Desafío" onBack={onBack} status={status} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="hud-frame grid size-12 place-items-center text-neon">
              <Flag className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold text-paper">
                Desafío de la semana
              </h1>
              <p className="mt-1.5 text-sm text-muted">De lunes a domingo. Se guarda en este navegador.</p>
            </div>
          </div>
          <div className="rounded-md border border-line bg-bg-elev/60 p-4">
            <p className="font-display text-lg text-paper">{mission.title}</p>
            <p className="mt-1 text-sm text-muted">{mission.detail}</p>
            <p className="mt-3 font-mono text-xs tracking-wider text-neon uppercase">
              {current.done ? "Listo" : `${Math.min(current.n, mission.need)} / ${mission.need}`}
              {" · "}
              {mission.weekId}
            </p>
          </div>
          <button
            type="button"
            className="tap g-btn ghost h-11 text-sm"
            onClick={() =>
              void shareCard(
                shareLines({
                  level: info.level,
                  levelName: info.name,
                  streak,
                  medal: medal ?? null,
                  mission: current.done ? `Desafío: ${mission.title}` : `En curso: ${mission.title}`,
                }),
              )
            }
          >
            <RotateCcw className="size-4" strokeWidth={1.75} />
            Compartir tarjeta
          </button>
          <p className="text-xs leading-relaxed text-faint">
            La tarjeta muestra tu nivel, la racha y una medalla. No usa el modelo.
          </p>
        </div>
      </div>
    </>
  );
}
