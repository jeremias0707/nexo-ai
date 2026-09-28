import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Check, Copy, Menu, Plus, Square, X } from "lucide-react";
import { Lesson } from "@/components/nexo/lesson";
import { Mark } from "@/components/nexo/mark";
import { useChatStore, type ChatMessage } from "@/lib/chat-store";
import { trimHistory } from "@/lib/history";
import { STARTERS } from "@/lib/tutor";

type LinkState = "checking" | "online" | "offline";

export function NexoApp() {
  const threads = useChatStore((state) => state.threads);
  const activeId = useChatStore((state) => state.activeId);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "search" | "write">("idle");
  const [error, setError] = useState<string | null>(null);
  const link = useLink();
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void useChatStore.persist.rehydrate();
  }, []);

  const active = threads.find((thread) => thread.id === activeId) ?? null;
  const chatting = Boolean(active && active.messages.length > 0);
  // Older turns beyond the budget are not sent to the tutor; say so, quietly.
  const trimmed = active
    ? trimHistory(active.messages.filter((message) => message.content.trim())).dropped > 0
    : false;

  useEffect(() => {
    if (!stickRef.current) return;
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [active?.messages, busy]);

  function onScroll() {
    const node = scrollerRef.current;
    if (!node) return;
    stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setDraft("");
    if (fieldRef.current) fieldRef.current.style.height = "auto";
    stickRef.current = true;

    const store = useChatStore.getState();
    const threadId = store.ensureThread(content);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    store.appendMessage(threadId, userMessage);
    store.appendMessage(threadId, { id: assistantId, role: "assistant", content: "" });

    const history = trimHistory(
      (useChatStore.getState().threads.find((thread) => thread.id === threadId)?.messages ?? [])
        .filter((message) => message.id !== assistantId && message.content.trim())
        .map((message) => ({ role: message.role, content: message.content })),
    ).messages;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setPhase("idle");
    let acc = "";
    let lineBuf = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "No pude completar la explicación.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuf += decoder.decode(value, { stream: true });
        const lines = lineBuf.split("\n");
        lineBuf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { k?: string; t?: string; u?: string[] };
          try {
            event = JSON.parse(line) as { k?: string; t?: string; u?: string[] };
          } catch {
            continue;
          }
          if (event.k === "search") setPhase("search");
          if (event.k === "delta" && event.t) {
            acc += event.t;
            setPhase("write");
            useChatStore.getState().patchMessage(threadId, assistantId, stripCites(acc));
          }
          if (event.k === "sources" && Array.isArray(event.u)) {
            useChatStore.getState().setSources(threadId, assistantId, event.u.slice(0, 4));
          }
        }
      }
      if (!acc.trim()) {
        useChatStore
          .getState()
          .patchMessage(threadId, assistantId, "No hubo respuesta. Prueba reformular la pregunta.");
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (!acc.trim()) useChatStore.getState().dropMessage(threadId, assistantId);
      } else {
        const message = err instanceof Error ? err.message : "No pude completar la explicación.";
        setError(message);
        if (acc.trim()) useChatStore.getState().patchMessage(threadId, assistantId, acc);
        else useChatStore.getState().dropMessage(threadId, assistantId);
      }
    } finally {
      setBusy(false);
      setPhase("idle");
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function fresh() {
    useChatStore.getState().openFresh();
    setDrawer(false);
    setError(null);
  }

  return (
    <div className="flex h-dvh bg-bg text-fg">
      <aside className="hidden w-64 shrink-0 border-r border-line md:flex">
        <Sidebar link={link} onFresh={fresh} />
      </aside>

      <MobileDrawer open={drawer} onClose={() => setDrawer(false)}>
        <Sidebar link={link} onFresh={fresh} onNavigate={() => setDrawer(false)} />
      </MobileDrawer>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:px-5">
          <button
            type="button"
            className="tap grid size-11 place-items-center rounded-md border border-line md:hidden"
            aria-label="Abrir conversaciones"
            onClick={() => setDrawer(true)}
          >
            <Menu className="size-5" strokeWidth={1.5} />
          </button>
          <span className="text-paper md:hidden">
            <Mark className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{active ? active.title : "Nueva conversación"}</p>
          </div>
          <Status link={link} compact />
          <button
            type="button"
            className="tap grid size-11 place-items-center rounded-md border border-line"
            aria-label="Nueva conversación"
            onClick={fresh}
          >
            <Plus className="size-5" strokeWidth={1.5} />
          </button>
        </header>

        <div ref={scrollerRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          {chatting && active ? (
            <div className="mx-auto flex max-w-2xl flex-col gap-7 px-4 py-8 md:px-6">
              {active.messages.map((message, index) => (
                <Message
                  key={message.id}
                  message={message}
                  streaming={busy && index === active.messages.length - 1 && message.role === "assistant"}
                  phase={phase}
                />
              ))}
            </div>
          ) : (
            <Empty onPick={(prompt) => void send(prompt)} />
          )}
        </div>

        <form
          className="shrink-0 px-3 pt-2 pb-3 md:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="mx-auto max-w-2xl">
            {error ? <p className="mb-2 text-sm text-muted">{error}</p> : null}
            {trimmed && !error ? (
              <p className="mb-2 text-xs text-faint">
                Los mensajes más antiguos de esta conversación ya no se envían al tutor.
              </p>
            ) : null}
            <div className="dock flex items-end gap-2 rounded-lg p-2">
              <label className="sr-only" htmlFor="pregunta">
                Pregunta
              </label>
              <textarea
                id="pregunta"
                ref={fieldRef}
                rows={1}
                value={draft}
                placeholder="Pregunta algo concreto"
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-fg outline-none placeholder:text-faint"
                onChange={(event) => {
                  setDraft(event.target.value);
                  const node = event.target;
                  node.style.height = "auto";
                  node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <button
                type={busy ? "button" : "submit"}
                aria-label={busy ? "Detener" : "Enviar"}
                disabled={!busy && !draft.trim()}
                onClick={busy ? stop : undefined}
                className="tap grid size-11 shrink-0 place-items-center rounded-md bg-paper text-ink disabled:opacity-40"
              >
                <span className="icon-slot">
                  <span className={busy ? "icon-on" : "icon-off"}>
                    <Square className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className={busy ? "icon-off" : "icon-on"}>
                    <ArrowUp className="size-5" strokeWidth={1.75} />
                  </span>
                </span>
              </button>
            </div>
            <p className="mt-2 text-xs text-faint">
              {link === "online"
                ? "En línea, con búsqueda web."
                : link === "offline"
                  ? "Modelo no disponible."
                  : "Comprobando el modelo."}{" "}
              El historial se queda en este navegador. Puede equivocarse.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}

function useLink(): LinkState {
  const [link, setLink] = useState<LinkState>("checking");
  useEffect(() => {
    let cancel = false;
    fetch("/api/status")
      .then((response) => response.json() as Promise<{ online?: boolean }>)
      .then((body) => {
        if (!cancel) setLink(body.online ? "online" : "offline");
      })
      .catch(() => {
        if (!cancel) setLink("offline");
      });
    return () => {
      cancel = true;
    };
  }, []);
  return link;
}

function Status({ link, compact = false }: { link: LinkState; compact?: boolean }) {
  const label = link === "online" ? "En línea" : link === "offline" ? "Sin modelo" : "Conectando";
  return (
    <p className={`flex items-center gap-2 text-xs text-muted ${compact ? "shrink-0" : ""}`}>
      <span
        className={`size-1.5 rounded-full ${link === "offline" ? "offline-dot" : "online-dot"}`}
        aria-hidden="true"
      />
      <span className={compact ? "hidden sm:inline" : ""}>{label}</span>
    </p>
  );
}

function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [present, setPresent] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setPresent(false), 250);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!present) return null;

  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <button
        type="button"
        aria-label="Cerrar menú"
        className={`absolute inset-0 bg-ink/70 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div className={`drawer-panel relative flex h-full w-[min(20rem,88vw)] border-r border-line bg-bg ${shown ? "open" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function Sidebar({
  link,
  onFresh,
  onNavigate,
}: {
  link: LinkState;
  onFresh: () => void;
  onNavigate?: () => void;
}) {
  const threads = useChatStore((state) => state.threads);
  const activeId = useChatStore((state) => state.activeId);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-4">
        <div className="flex min-w-0 items-center gap-3 text-paper">
          <Mark />
          <div className="min-w-0">
            <p className="font-serif text-2xl leading-none tracking-tight">NEXO AI</p>
            <div className="mt-2">
              <Status link={link} />
            </div>
          </div>
        </div>
        {onNavigate ? (
          <button type="button" aria-label="Cerrar" onClick={onNavigate} className="tap grid size-11 place-items-center">
            <X className="size-5" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      <div className="px-3">
        <button
          type="button"
          className="tap flex h-11 w-full items-center justify-center gap-2 rounded-md bg-paper text-sm font-medium text-ink"
          onClick={() => {
            onFresh();
            onNavigate?.();
          }}
        >
          <Plus className="size-4" strokeWidth={1.75} />
          Nueva conversación
        </button>
        <p className="px-1 pt-3 text-xs leading-relaxed text-faint">
          Las respuestas vienen de un modelo en línea. Esta lista solo vive en este navegador.
        </p>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <p className="px-3 pb-2 text-xs text-faint">Conversaciones</p>
        {threads.length === 0 ? (
          <p className="px-3 text-sm text-faint">Todavía no hay ninguna.</p>
        ) : (
          <ul className="flex flex-col">
            {threads.map((thread) => (
              <li key={thread.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    useChatStore.getState().select(thread.id);
                    onNavigate?.();
                  }}
                  className={`min-w-0 flex-1 truncate rounded-md px-3 py-2.5 text-left text-sm ${
                    thread.id === activeId ? "bg-paper text-ink" : "text-muted hover:bg-bg-soft hover:text-fg"
                  }`}
                >
                  {thread.title}
                </button>
                <button
                  type="button"
                  aria-label={`Borrar ${thread.title}`}
                  className="tap grid size-11 shrink-0 place-items-center text-faint hover:text-fg"
                  onClick={() => useChatStore.getState().remove(thread.id)}
                >
                  <X className="size-4" strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Empty({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col justify-center px-5 py-8">
      <div className="rise text-paper">
        <Mark className="size-14" />
      </div>
      <h1 className="rise rise-2 mt-5 font-serif text-4xl leading-tight text-balance text-paper">Pregunta un tema.</h1>
      <ul className="rise rise-3 mt-6 grid grid-cols-2 gap-1.5">
        {STARTERS.map((item) => (
          <li key={item.name}>
            <button
              type="button"
              onClick={() => onPick(item.prompt)}
              className="tap h-11 w-full rounded-md border border-line px-3 text-left text-sm text-muted hover:text-fg"
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function stripCites(text: string) {
  return text.replace(/\[\[\d+\]\]\((https?:\/\/[^)\s]+)\)/g, "");
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Message({
  message,
  streaming,
  phase,
}: {
  message: ChatMessage;
  streaming: boolean;
  phase: "idle" | "search" | "write";
}) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="msg-in flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-paper px-4 py-3 text-base leading-relaxed text-ink">{message.content}</p>
      </div>
    );
  }

  return (
    <article className="msg-in min-w-0">
      <div className="mb-2 flex items-center justify-between text-paper">
        <span className="flex items-center gap-2">
          <Mark className="size-5" />
          <span className="text-xs tracking-wide text-faint">NEXO AI</span>
        </span>
        {message.content && !streaming ? (
          <button
            type="button"
            className="tap flex h-11 items-center gap-1.5 px-2 text-xs text-faint hover:text-fg"
            onClick={() => {
              void navigator.clipboard.writeText(message.content).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              });
            }}
          >
            <span className="icon-slot">
              <span className={copied ? "icon-on" : "icon-off"}>
                <Check className="size-3.5" strokeWidth={1.75} />
              </span>
              <span className={copied ? "icon-off" : "icon-on"}>
                <Copy className="size-3.5" strokeWidth={1.75} />
              </span>
            </span>
            {copied ? "Copiado" : "Copiar"}
          </button>
        ) : null}
      </div>
      {message.content ? (
        <Lesson content={message.content} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="online-dot size-1.5 rounded-full" />
          {phase === "search" ? "Buscando en la web" : "Consultando"}
        </p>
      )}
      {streaming && message.content ? <span className="caret" aria-hidden="true" /> : null}
      {message.sources && message.sources.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {message.sources.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center rounded-md border border-line px-3 text-xs text-muted hover:text-fg"
              >
                {hostOf(url)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
