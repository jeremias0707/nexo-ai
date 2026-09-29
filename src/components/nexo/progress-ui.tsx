import { useEffect } from "react";
import {
  BookOpen,
  Camera,
  ChevronLeft,
  Compass,
  FileText,
  Flame,
  GraduationCap,
  Images,
  Lock,
  MessageSquare,
  Moon,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { difficultyLabel, formatNota } from "@/lib/exam";
import { levelFor, liveStreak, MEDALS, medalProgress, type MedalIcon } from "@/lib/progress";
import { useProgressStore } from "@/lib/progress-store";
import { useToday } from "@/lib/use-progress";

const ICONS: Record<MedalIcon, LucideIcon> = {
  target: Target,
  file: FileText,
  camera: Camera,
  moon: Moon,
  flame: Flame,
  images: Images,
  compass: Compass,
  book: BookOpen,
  star: Star,
  graduation: GraduationCap,
  trophy: Trophy,
  message: MessageSquare,
  zap: Zap,
};

export function MedalGlyph({
  icon,
  className = "size-[22px]",
}: {
  icon: MedalIcon;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function XpBar({
  ratio,
  gain = 0,
  label,
}: {
  ratio: number;
  gain?: number;
  label?: string;
}) {
  const base = Math.max(0, Math.min(1, ratio - gain));
  return (
    <div
      className="g-xp"
      role="progressbar"
      aria-label={label ?? "Experiencia"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <i style={{ width: `${Math.round(ratio * 100)}%` }} />
      {gain > 0 ? (
        <i
          className="gain"
          style={{ left: `${base * 100}%`, width: `${Math.round(Math.min(gain, ratio) * 100)}%` }}
        />
      ) : null}
    </div>
  );
}

function xpLine(xp: number) {
  const info = levelFor(xp);
  return info.next === null ? `${xp} XP` : `${xp} / ${info.next} XP`;
}

/** Home HUD: streak flame, level badge, segmented XP bar. Opens the profile. */
export function HudBar({ onOpen }: { onOpen: () => void }) {
  const progress = useProgressStore((state) => state.progress);
  const today = useToday();
  const streak = liveStreak(progress.streak, today);
  const info = levelFor(progress.xp);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="g-hudbar block w-full shrink-0 text-left"
      aria-label={`Tu perfil: racha de ${streak} ${streak === 1 ? "día" : "días"}, nivel ${info.level} ${info.name}, ${progress.xp} XP`}
    >
      <span className="mx-auto block max-w-2xl">
        <span className="flex items-center justify-between gap-2">
          <span className={`g-chip ${streak > 0 ? "flame" : "cold"}`}>
            <span aria-hidden="true">🔥</span>
            {streak} {streak === 1 ? "día" : "días"}
          </span>
          <span className="g-chip level">
            Nivel {info.level} · {info.name}
          </span>
        </span>
        <span className="mt-2.5 block">
          <XpBar ratio={info.ratio} />
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px]">
          <span className="text-muted">{xpLine(progress.xp)}</span>
          <span className="text-faint">
            {info.next === null
              ? "Nivel máximo"
              : `${info.missing} XP para nivel ${info.level + 1}`}
          </span>
        </span>
      </span>
    </button>
  );
}

/**
 * "Logro desbloqueado" card. Non-blocking: tapping outside closes it, it
 * closes by itself after a few seconds, and it waits while an answer streams.
 */
export function CelebrationOverlay({
  paused,
  onProfile,
}: {
  paused: boolean;
  onProfile: () => void;
}) {
  const celebration = useProgressStore((state) => state.celebration);
  const dismiss = useProgressStore((state) => state.dismiss);
  const xp = useProgressStore((state) => state.progress.xp);
  const visible = Boolean(celebration) && !paused;

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(dismiss, 7000);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, celebration, dismiss]);

  if (!visible || !celebration) return null;
  const first = celebration.unlocks[0];
  const more = celebration.unlocks.length - 1;
  const info = levelFor(xp);
  const bonus = celebration.unlocks.reduce((sum, unlock) => sum + unlock.xp, 0);
  const span = info.next === null ? 1 : info.next - info.floor;
  const gainRatio = Math.min(info.ratio, bonus / span);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center px-[18px] pt-[22vh]"
      role="dialog"
      aria-modal="false"
      aria-labelledby="celebration-title"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="g-fade absolute inset-0"
        style={{
          background: "radial-gradient(60% 40% at 50% 38%,#3ee6f01f,transparent 70%),#05050594",
        }}
        onClick={dismiss}
      />
      <div className="hud-frame relative w-full max-w-sm">
        <div className="g-card g-celebrate">
          <p className="font-display text-xs font-semibold tracking-[0.16em] text-neon uppercase">
            {first ? "Logro desbloqueado" : "Subiste de nivel"}
          </p>
          <div className="g-medal-big">
            {first ? (
              <MedalGlyph icon={first.icon} className="size-10" />
            ) : (
              <span className="font-display text-4xl font-semibold">{info.level}</span>
            )}
          </div>
          <p
            id="celebration-title"
            className="font-display text-[26px] leading-tight font-semibold text-fg"
          >
            {first ? first.name : `Nivel ${info.level} · ${info.name}`}
          </p>
          <p className="mt-1.5 text-sm text-muted">
            {first ? `${first.done}. ¡Seguí así!` : "Sumaste XP estudiando. ¡Seguí así!"}
            {more > 0 ? ` Y ${more} ${more === 1 ? "logro más" : "logros más"}.` : ""}
          </p>
          {bonus > 0 ? (
            <div className="mt-3.5 flex justify-center">
              <span className="g-chip level h-8 text-sm">+{bonus} XP</span>
            </div>
          ) : null}
          <div className="mt-4 text-left">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted uppercase">
                Nivel {info.level} · {info.name}
              </span>
              <span className="text-neon">{xpLine(xp)}</span>
            </div>
            <XpBar ratio={info.ratio} gain={gainRatio} />
          </div>
          <div className="mt-[18px] grid grid-cols-2 gap-2">
            <button
              type="button"
              className="g-btn dim h-11 text-xs"
              onClick={() => {
                dismiss();
                onProfile();
              }}
            >
              Ver perfil
            </button>
            <button
              type="button"
              className="g-btn primary h-11 text-xs"
              onClick={dismiss}
              autoFocus
            >
              Seguir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SOURCE_LABEL = { tema: "Tema libre", pdf: "Apuntes", foto: "Foto" } as const;

export function ProfileView({ onBack, status }: { onBack: () => void; status: React.ReactNode }) {
  const progress = useProgressStore((state) => state.progress);
  const today = useToday();
  const info = levelFor(progress.xp);
  const streak = liveStreak(progress.streak, today);
  const unlocked = MEDALS.filter((medal) => progress.medals[medal.id]).length;

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
          <p className="mt-1 truncate text-sm leading-tight font-medium">Tu perfil</p>
        </div>
        {status}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pt-[18px] pb-8">
          <div className="flex items-center gap-3.5">
            <span className="hud-frame grid size-16 shrink-0 place-items-center rounded-[10px] border border-line bg-bg-elev">
              <span
                className="font-display text-[30px] leading-none font-semibold text-neon"
                style={{ textShadow: "0 0 12px #3ee6f088" }}
              >
                {info.level}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
                Nivel {info.level}
              </p>
              <p className="mt-1 font-display text-[26px] leading-none font-semibold text-fg uppercase">
                {info.name}
              </p>
              <p className="mt-1.5 text-[12.5px] text-muted">
                {info.next === null
                  ? "Llegaste al nivel máximo."
                  : `Próximo: nivel ${info.level + 1} · ${info.nextName}`}
              </p>
            </div>
          </div>
          <div className="mt-3.5">
            <XpBar ratio={info.ratio} />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
            <span className="text-muted">{xpLine(progress.xp)}</span>
            <span className="text-faint">
              {info.next === null ? "máximo" : `faltan ${info.missing}`}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat
              label="Racha actual"
              tone="flame"
              value={
                <>
                  🔥 {streak} <small className="text-xs">{streak === 1 ? "día" : "días"}</small>
                </>
              }
            />
            <Stat
              label="Mejor racha"
              value={
                <>
                  {progress.streak.best}{" "}
                  <small className="text-xs text-muted">
                    {progress.streak.best === 1 ? "día" : "días"}
                  </small>
                </>
              }
            />
            <Stat
              label="Exámenes"
              value={
                <>
                  {progress.stats.exams}{" "}
                  <small className="text-xs text-muted">
                    {progress.stats.exams === 1 ? "hecho" : "hechos"}
                  </small>
                </>
              }
            />
          </div>

          <div className="mt-[18px] mb-2 flex items-center justify-between">
            <p className="g-label m-0">Medallas</p>
            <span className="font-mono text-[11px] text-neon">
              {unlocked} / {MEDALS.length}
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {MEDALS.map((medal) => {
              const state = medalProgress(medal, progress);
              return (
                <li
                  key={medal.id}
                  className="g-card flex flex-col items-center gap-1.5 px-1.5 pt-2.5 pb-[9px] text-center"
                  style={
                    state.unlocked
                      ? { borderColor: "#3ee6f055", background: "#3ee6f00a" }
                      : undefined
                  }
                  aria-label={`${medal.name}: ${state.unlocked ? "desbloqueada" : `bloqueada, ${state.value} de ${state.target}`}`}
                >
                  <span className={`g-medal ${state.unlocked ? "on" : "off"}`}>
                    <MedalGlyph icon={medal.icon} />
                    {state.unlocked ? null : (
                      <span className="g-lock">
                        <Lock className="size-[13px]" strokeWidth={2} />
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex min-h-[29px] items-center text-xs leading-tight font-semibold ${state.unlocked ? "text-fg" : "text-muted"}`}
                  >
                    {medal.name}
                  </span>
                  <span className="min-h-[27px] text-[10.5px] leading-snug text-faint">
                    {state.unlocked ? medal.done : medal.hint}
                  </span>
                  {state.unlocked ? (
                    <span className="font-mono text-[9.5px] tracking-[0.1em] text-neon">
                      DESBLOQUEADA
                    </span>
                  ) : (
                    <span className="block w-full px-1">
                      <span className="font-mono text-[9.5px] text-faint">
                        {state.value}/{state.target}
                      </span>
                      <span className="mt-[3px] block h-[3px] rounded-sm bg-[#1c1c1c]">
                        <span
                          className="block h-[3px] rounded-sm bg-faint"
                          style={{ width: `${Math.round(state.ratio * 100)}%` }}
                        />
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {progress.exams.length > 0 ? (
            <>
              <p className="g-label mt-6">Últimos exámenes</p>
              <ul className="g-card divide-y divide-line px-3.5">
                {progress.exams.slice(0, 5).map((exam) => (
                  <li key={exam.at} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`font-display text-lg font-semibold ${exam.nota >= 6 ? "text-accent-g" : "text-accent-r"}`}
                    >
                      {formatNota(exam.nota)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">
                        {exam.topic || SOURCE_LABEL[exam.source]}
                      </span>
                      <span className="block font-mono text-[10.5px] text-faint uppercase">
                        {exam.correct}/{exam.count} bien · {difficultyLabel(exam.difficulty)} ·{" "}
                        {new Date(exam.at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </span>
                    {exam.xp > 0 ? (
                      <span className="font-mono text-[11px] text-neon">+{exam.xp} XP</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-6 text-xs leading-relaxed text-faint">
            Tu progreso se guarda solo en este navegador. Sin cuentas ni datos en el servidor.
          </p>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "flame" }) {
  return (
    <div
      className="g-card p-2.5"
      style={tone === "flame" ? { borderColor: "#f0b43e55", background: "#f0b43e0d" } : undefined}
    >
      <p className="g-label mb-1.5 text-[9.5px]">{label}</p>
      <p
        className={`font-display text-xl leading-none font-semibold ${tone === "flame" ? "text-[#f7d38a]" : "text-fg"}`}
      >
        {value}
      </p>
    </div>
  );
}
