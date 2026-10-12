import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Camera,
  CircleHelp,
  History,
  MessageSquarePlus,
  Check,
  Copy,
  FileText,
  ImageOff,
  Menu,
  Mic,
  Paperclip,
  Plus,
  Shuffle,
  RotateCcw,
  Square,
  Target,
  Settings,
  Star,
  Trophy,
  Volume2,
  Flag,
  Layers,
  CalendarDays,
  FileDown,
  GitCompare,
  Users,
  X,
} from "lucide-react";
import { ExamView } from "@/components/nexo/exam";
import {
  CardsView,
  FavoritesView,
  IdentityView,
  MenuIdentity,
  WeekView,
} from "@/components/nexo/local-screens";
import { SettingsView } from "@/components/nexo/settings";
import { PlanView } from "@/components/nexo/plan";
import { CompareView } from "@/components/nexo/compare";
import { GroupView } from "@/components/nexo/group";
import { ExportView } from "@/components/nexo/export-view";
import { FlashcardSheet, GoalCard, OralChip, TodayCards } from "@/components/nexo/study-ui";
import { cardsFromAnswer, CARDS_PROMPT, type DraftCard } from "@/lib/flashcards";
import { isOralReply } from "@/lib/settings";
import { rehydrateStudyStores, useGoalStore } from "@/lib/study-store";
import { useStudyTimer } from "@/lib/use-study-timer";
import { CelebrationOverlay, HudBar, ProfileView } from "@/components/nexo/progress-ui";
import { useMistakeCount } from "@/lib/use-mistakes";
import { useStreakLine } from "@/lib/use-progress";
import { Lesson } from "@/components/nexo/lesson";
import { Donate } from "@/components/nexo/donate";
import { Mark } from "@/components/nexo/mark";
import { useChatStore, type ChatMessage, type DocMeta } from "@/lib/chat-store";
import { describeDoc, type DocPayload } from "@/lib/document";
import { DOC_ACCEPT, readDocument } from "@/lib/document-client";
import { trimHistory } from "@/lib/history";
import { lastQuestion, lastThread, recentThreads, subjectStarter, timeAgo } from "@/lib/resume";
import { hasUncertainty, UNSURE_NOTICE } from "@/lib/uncertain";
import { APP_VERSION } from "@/lib/version";
import { prepareImage, type PreparedImage } from "@/lib/image-client";
import { useCardsStore, useFavoritesStore, useProfileStore, useWeekStore } from "@/lib/local-store";
import { useProgressStore } from "@/lib/progress-store";
import { nickCounts } from "@/lib/profile";
import { useSettingsStore } from "@/lib/settings-store";
import {
  appendDictation,
  canSpeak,
  dictationError,
  recognitionCtor,
  speak,
  type Recognition,
} from "@/lib/speech-client";
import { deviceHeaders, clearDeviceToken } from "@/lib/access-client";
import { FREE_CAPS } from "@/lib/access-constants";
import { challengeForDay, isDailyDone, markDailyDone, type DailyChallenge } from "@/lib/daily";
import { MISSIONS, pickMissions, type Mission } from "@/lib/missions";
import {
  SUBJECT_NONE,
  SUBJECTS,
  sanitizeSubject,
  subjectLabel,
  type SubjectChoice,
} from "@/lib/subjects";

type LinkState = "checking" | "online" | "offline";
type View =
  | "chat"
  | "profile"
  | "exam"
  | "review"
  | "settings"
  | "identity"
  | "favorites"
  | "cards"
  | "week"
  | "plan"
  | "compare"
  | "group"
  | "export";

type CardsDraft = { drafts: DraftCard[]; source: string; content: string };

export function NexoApp() {
  const threads = useChatStore((state) => state.threads);
  const activeId = useChatStore((state) => state.activeId);
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [examStage, setExamStage] = useState("config");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "search" | "write">("idle");
  const [error, setError] = useState<string | null>(null);
  const link = useLink();
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const [pendingDoc, setPendingDoc] = useState<DocPayload | null>(null);
  const [readingDoc, setReadingDoc] = useState(false);
  const [menu, setMenu] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceOut, setVoiceOut] = useState(false);
  const stopSpeakRef = useRef<(() => void) | null>(null);
  const [cardsDraft, setCardsDraft] = useState<CardsDraft | null>(null);
  const [compareSeed, setCompareSeed] = useState<{ answer: string; doc: DocPayload | null }>({
    answer: "",
    doc: null,
  });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }

  // Racha y metas: local study minutes; a short toast when today's goal is reached.
  useStudyTimer(busy, () => {
    const streak = useGoalStore.getState().goal.streak.current;
    showToast(
      `¡Meta diaria cumplida! Racha de estudio: ${streak} ${streak === 1 ? "día" : "días"}.`,
    );
  });

  // Grow the box for dictated text too, not only for typing.
  useEffect(() => {
    const node = fieldRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    setCanDictate(Boolean(recognitionCtor()));
    setVoiceOut(canSpeak());
    return () => {
      recRef.current?.abort();
      if (canSpeak()) window.speechSynthesis.cancel();
    };
  }, []);

  const theme = useSettingsStore((state) => state.theme);
  const textSize = useSettingsStore((state) => state.text);
  const explain = useSettingsStore((state) => state.explain);
  const reply = useSettingsStore((state) => state.reply);
  const [subject, setSubject] = useState<SubjectChoice>(SUBJECT_NONE);
  const [mobile, setMobile] = useState(false);
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [dailyDone, setDailyDone] = useState(false);

  useEffect(() => {
    try {
      setSubject(sanitizeSubject(localStorage.getItem("nexo-subject") ?? ""));
    } catch {
      setSubject(SUBJECT_NONE);
    }
    const mq = window.matchMedia("(max-width: 767px)");
    const syncMobile = () => setMobile(mq.matches);
    syncMobile();
    mq.addEventListener("change", syncMobile);
    const today = challengeForDay();
    setDaily(today);
    setDailyDone(isDailyDone(today.id));
    // Mobile defaults to short answers (simple) only if the user never changed explain.
    try {
      if (mq.matches && !localStorage.getItem("nexo-explain-touched")) {
        const current = useSettingsStore.getState().explain;
        if (current === "normal") useSettingsStore.getState().setExplain("simple");
      }
    } catch {
      // ignore
    }
    return () => mq.removeEventListener("change", syncMobile);
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([
        useChatStore.persist.rehydrate(),
        useProgressStore.persist.rehydrate(),
        useSettingsStore.persist.rehydrate(),
        useProfileStore.persist.rehydrate(),
        useFavoritesStore.persist.rehydrate(),
        useCardsStore.persist.rehydrate(),
        useWeekStore.persist.rehydrate(),
        rehydrateStudyStores(),
      ]);
      const settings = useSettingsStore.getState();
      if (settings.theme === "claro")
        useProgressStore.getState().record({ kind: "mark", mark: "claro" });
      const profile = useProfileStore.getState();
      if (profile.photo) useProgressStore.getState().record({ kind: "mark", mark: "photo" });
      if (nickCounts(profile.nick))
        useProgressStore.getState().record({ kind: "mark", mark: "nick" });
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.text = textSize;
  }, [theme, textSize]);

  const active = threads.find((thread) => thread.id === activeId) ?? null;

  // 2.7: reopening a conversation from the history brings back its subject.
  const activeSubject = active?.subject;
  useEffect(() => {
    if (activeSubject === undefined) return;
    setSubject(activeSubject);
    try {
      if (activeSubject) localStorage.setItem("nexo-subject", activeSubject);
      else localStorage.removeItem("nexo-subject");
    } catch {
      // ignore
    }
  }, [activeId, activeSubject]);
  const chatting = Boolean(active && active.messages.length > 0);
  // Older turns beyond the budget are not sent to the tutor; say so, quietly.
  const trimmed = active ? trimHistory(active.messages.filter(hasPayload)).dropped > 0 : false;

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    // The home screen is taller in 2.6 (goal, plan, class): start it at the top.
    if (!chatting) {
      node.scrollTop = 0;
      return;
    }
    if (!stickRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [active?.messages, busy, chatting]);

  function onScroll() {
    const node = scrollerRef.current;
    if (!node) return;
    stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      setAttachment(await prepareImage(file));
      fieldRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude abrir esa imagen.");
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function pickDocument(file: File | undefined) {
    if (!file) return;
    setError(null);
    setReadingDoc(true);
    try {
      setPendingDoc(await readDocument(file));
      fieldRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude leer ese archivo.");
    } finally {
      setReadingDoc(false);
      if (docRef.current) docRef.current.value = "";
    }
  }

  function toggleDictation() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor || busy) return;
    setError(null);
    const base = draft;
    const rec = new Ctor();
    rec.lang = "es-AR";
    rec.interimResults = true;
    // One phrase per tap: continuous mode repeats words on Android Chrome.
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let spoken = "";
      for (let i = 0; i < event.results.length; i += 1) spoken += event.results[i][0].transcript;
      setDraft(appendDictation(base, spoken));
    };
    rec.onerror = (event) => {
      const message = dictationError(event.error);
      if (message) setError(message);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const node = fieldRef.current;
      if (node) {
        node.style.height = "auto";
        node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
        node.focus();
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("No pude usar el dictado. Probá de nuevo o escribí la pregunta.");
    }
  }

  function toggleSpeak(message: ChatMessage) {
    if (speakingId === message.id) {
      stopSpeakRef.current?.();
      return;
    }
    stopSpeakRef.current?.();
    setSpeakingId(message.id);
    stopSpeakRef.current = speak(message.content, () => {
      setSpeakingId((current) => (current === message.id ? null : current));
    });
  }

  async function send(
    text: string,
    photo: PreparedImage | null = null,
    doc: DocPayload | null = null,
  ) {
    const content = text.trim();
    if ((!content && !photo && !doc) || busy || preparing || readingDoc) return;
    recRef.current?.abort();
    setError(null);
    setDraft("");
    setAttachment(null);
    setPendingDoc(null);
    if (fieldRef.current) fieldRef.current.style.height = "auto";
    stickRef.current = true;

    const store = useChatStore.getState();
    const threadId = store.ensureThread(content || (doc ? doc.name : "Foto de ejercicio"), subject);
    const docMeta: DocMeta | undefined = doc
      ? {
          name: doc.name,
          kind: doc.kind,
          pages: doc.pages,
          totalPages: doc.totalPages,
          truncated: doc.truncated,
        }
      : undefined;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      ...(photo ? { image: photo.thumb } : {}),
      ...(docMeta ? { doc: docMeta } : {}),
    };
    const assistantId = crypto.randomUUID();
    const previousDoc = store.threads.find((thread) => thread.id === threadId)?.doc;
    if (doc && docMeta)
      store.setDoc(threadId, { ...docMeta, text: doc.text, messageId: userMessage.id });
    store.appendMessage(threadId, userMessage);
    store.appendMessage(threadId, { id: assistantId, role: "assistant", content: "" });

    const thread = useChatStore.getState().threads.find((item) => item.id === threadId);
    const activeDoc = thread?.doc?.text ? thread.doc : undefined;
    const history = trimHistory(
      (thread?.messages ?? [])
        .filter((message) => message.id !== assistantId && hasPayload(message))
        .map((message) => {
          const isNew = message.id === userMessage.id;
          const docNote =
            !isNew && message.doc && !message.content.trim()
              ? `[adjuntó el documento «${message.doc.name}»]`
              : message.content;
          return {
            role: message.role,
            content: docNote,
            ...(isNew && photo ? { image: photo.full } : {}),
            ...(!isNew && message.role === "user" && (message.image || message.hadImage)
              ? { hadImage: true }
              : {}),
            ...(isNew && doc ? { newDocument: true } : {}),
          };
        }),
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
        headers: deviceHeaders({ "Content-Type": "application/json" }),
        signal: controller.signal,
        body: JSON.stringify({
          messages: history,
          explain,
          // Read at send time: plan/oral shortcuts switch the mode right before sending.
          ...(useSettingsStore.getState().reply !== "normal"
            ? { reply: useSettingsStore.getState().reply }
            : {}),
          ...(subject ? { subject } : {}),
          ...(mobile ? { mobile: true } : {}),
          ...(activeDoc
            ? {
                document: {
                  name: activeDoc.name,
                  kind: activeDoc.kind,
                  pages: activeDoc.pages,
                  totalPages: activeDoc.totalPages,
                  truncated: activeDoc.truncated,
                  text: activeDoc.text,
                },
              }
            : {}),
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (response.status === 401 && payload?.code === "access_required") {
          clearDeviceToken();
        }
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
      } else if (content.length >= 4 || photo || doc) {
        // XP only for answered questions (not errors, not cancelled ones).
        useProgressStore.getState().record({
          kind: "question",
          text: `${content} ${doc?.name ?? ""}`,
          photo: Boolean(photo),
          pdf: Boolean(doc),
        });
        useWeekStore.getState().note("questions");
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (!acc.trim()) useChatStore.getState().dropMessage(threadId, assistantId);
      } else {
        const message = err instanceof Error ? err.message : "No pude completar la explicación.";
        setError(message);
        if (acc.trim()) useChatStore.getState().patchMessage(threadId, assistantId, acc);
        else {
          useChatStore.getState().dropMessage(threadId, assistantId);
          if (photo || doc) {
            // Give the attachments back so a retry does not need to pick them again.
            useChatStore.getState().dropMessage(threadId, userMessage.id);
            if (doc) useChatStore.getState().setDoc(threadId, previousDoc);
            setAttachment(photo);
            setPendingDoc(doc);
            setDraft(content);
          }
        }
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
    setView("chat");
  }

  function chooseSubject(id: SubjectChoice) {
    setSubject(id);
    try {
      if (id) localStorage.setItem("nexo-subject", id);
      else localStorage.removeItem("nexo-subject");
    } catch {
      // ignore
    }
  }

  /** 2.7: reopen an earlier conversation exactly where it was (no chat is spent). */
  function resumeThread(id: string) {
    const thread = useChatStore.getState().threads.find((item) => item.id === id);
    if (!thread) return;
    useChatStore.getState().select(id);
    if (thread.subject !== undefined) chooseSubject(thread.subject);
    setDrawer(false);
    setError(null);
    setView("chat");
    focusField();
  }

  /** 2.7: subject shortcut. New chat focused on that subject; nothing is sent until you write. */
  function startSubject(id: SubjectChoice) {
    chooseSubject(id);
    useChatStore.getState().openFresh();
    setDrawer(false);
    setError(null);
    setView("chat");
    setDraft(subjectStarter(id));
    focusField();
  }

  function focusField() {
    window.setTimeout(() => {
      const node = fieldRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }, 60);
  }

  function continueTopic(title: string) {
    const clean = title.replace(/\s+/g, " ").trim() || "este tema";
    useChatStore.getState().openFresh();
    setView("chat");
    setDrawer(false);
    void send(
      `Seguimos con el tema «${clean}». Preguntame qué quiero repasar o explicame lo clave en pocas líneas.`,
    );
  }

  function openView(next: View) {
    setDrawer(false);
    setView(next);
  }

  /** From a study screen: back to the chat and ask (1 free chat). */
  function askFromTool(
    prompt: string,
    options: { oral?: boolean; fresh?: boolean; doc?: DocPayload } = {},
  ) {
    if (options.oral) useSettingsStore.getState().setReply("profe");
    setDrawer(false);
    setView("chat");
    if (busy || preparing || readingDoc) {
      // Never lose the prompt: leave it ready in the box.
      setDraft(prompt);
      return;
    }
    if (options.fresh) useChatStore.getState().openFresh();
    void send(prompt, null, options.doc ?? null);
  }

  function activeDocPayload(): DocPayload | null {
    const doc = active?.doc;
    if (!doc?.text) return null;
    return {
      name: doc.name,
      kind: doc.kind,
      pages: doc.pages,
      totalPages: doc.totalPages,
      truncated: doc.truncated,
      text: doc.text,
    };
  }

  function lastAnswer() {
    const list = active?.messages ?? [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const item = list[i];
      if (item.role === "assistant" && item.content.trim()) return item.content;
    }
    return "";
  }

  function openCompare(answer: string) {
    setCompareSeed({ answer, doc: activeDocPayload() });
    openView("compare");
  }

  function startOral() {
    useSettingsStore.getState().setReply("profe");
    setDrawer(false);
    setView("chat");
    if (!active || active.messages.length > 0) useChatStore.getState().openFresh();
    const topic = subject ? `${subjectLabel(subject)}: ` : "";
    setDraft(`Tomame oral de ${topic}`);
    window.setTimeout(() => {
      const node = fieldRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }, 60);
  }

  return (
    <div className="flex h-dvh bg-bg text-fg">
      <aside className="hidden w-64 shrink-0 border-r border-line md:flex">
        <Sidebar
          link={link}
          onFresh={fresh}
          onOpen={(next) => (next === "compare" ? openCompare(lastAnswer()) : openView(next))}
          view={view}
          onContinue={continueTopic}
          onOral={startOral}
        />
      </aside>

      <MobileDrawer open={drawer} onClose={() => setDrawer(false)}>
        <Sidebar
          link={link}
          onFresh={fresh}
          onOpen={(next) => (next === "compare" ? openCompare(lastAnswer()) : openView(next))}
          view={view}
          onContinue={continueTopic}
          onOral={startOral}
          onNavigate={() => setDrawer(false)}
        />
      </MobileDrawer>

      <section className="hud-surface flex min-w-0 flex-1 flex-col">
        {view === "profile" ? (
          <ProfileView onBack={() => setView("chat")} status={<HudStatus link={link} />} />
        ) : view === "identity" ? (
          <IdentityView onBack={() => setView("chat")} status={<HudStatus link={link} />} />
        ) : view === "favorites" ? (
          <FavoritesView onBack={() => setView("chat")} status={<HudStatus link={link} />} />
        ) : view === "cards" ? (
          <CardsView onBack={() => setView("chat")} status={<HudStatus link={link} />} />
        ) : view === "week" ? (
          <WeekView onBack={() => setView("chat")} status={<HudStatus link={link} />} />
        ) : view === "settings" ? (
          <SettingsView onBack={() => setView("chat")} status={<HudStatus link={link} />} />
        ) : view === "plan" ? (
          <PlanView
            onBack={() => setView("chat")}
            status={<HudStatus link={link} />}
            onAsk={(prompt, oral) => askFromTool(prompt, { oral, fresh: true })}
            onOpen={openView}
            lastAnswer={lastAnswer() || null}
            online={link === "online"}
          />
        ) : view === "compare" ? (
          <CompareView
            onBack={() => setView("chat")}
            status={<HudStatus link={link} />}
            initialAnswer={compareSeed.answer}
            threadDoc={compareSeed.doc}
            online={link === "online"}
            onAskAi={(prompt, doc) => {
              const inThread =
                active?.doc?.text && active.doc.text === doc.text && active.doc.name === doc.name;
              askFromTool(prompt, inThread ? {} : { fresh: true, doc });
            }}
          />
        ) : view === "group" ? (
          <GroupView
            onBack={() => setView("chat")}
            status={<HudStatus link={link} />}
            onAsk={(prompt) => askFromTool(prompt, { fresh: true })}
            online={link === "online"}
          />
        ) : view === "export" ? (
          <ExportView
            onBack={() => setView("chat")}
            status={<HudStatus link={link} />}
            thread={active}
            online={link === "online"}
            onAsk={(prompt) => askFromTool(prompt)}
          />
        ) : view === "exam" || view === "review" ? (
          <ExamView
            onClose={() => setView("chat")}
            onStage={setExamStage}
            boot={view === "review" ? "review" : "config"}
            status={<HudStatus link={link} />}
            online={link === "online"}
          />
        ) : (
          <>
            <header className="hud-header flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:px-5">
              <button
                type="button"
                className="tap hud-btn grid size-11 place-items-center rounded-md border border-line md:hidden"
                aria-label="Abrir conversaciones"
                onClick={() => setDrawer(true)}
              >
                <Menu className="size-5" strokeWidth={1.5} />
              </button>
              <span className="text-paper md:hidden">
                <Mark className="size-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xs leading-none font-semibold tracking-widest text-neon uppercase">
                  NEXO AI
                </p>
                <p className="mt-1 truncate text-sm leading-tight font-medium">
                  {active ? active.title : "Nueva conversación"}
                </p>
              </div>
              <HudStatus link={link} />
              {chatting ? (
                <button
                  type="button"
                  className="tap hud-btn grid size-11 place-items-center rounded-md border border-line"
                  aria-label="Tu perfil"
                  onClick={() => setView("profile")}
                >
                  <Trophy className="size-5" strokeWidth={1.5} />
                </button>
              ) : null}
              <button
                type="button"
                className="tap hud-btn grid size-11 place-items-center rounded-md border border-line"
                aria-label="Nueva conversación"
                onClick={fresh}
              >
                <Plus className="size-5" strokeWidth={1.5} />
              </button>
            </header>

            {chatting ? null : <HudBar onOpen={() => setView("profile")} />}

            <div ref={scrollerRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
              {chatting && active ? (
                <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 md:px-6">
                  {active.messages.map((message, index) => {
                    let question = "";
                    if (message.role === "assistant") {
                      for (let i = index - 1; i >= 0; i -= 1) {
                        const prev = active.messages[i];
                        if (prev?.role !== "user") continue;
                        question =
                          prev.content.trim() ||
                          prev.doc?.name ||
                          (prev.image || prev.hadImage ? "Foto" : "Pregunta");
                        break;
                      }
                    }
                    return (
                      <Message
                        key={message.id}
                        message={message}
                        question={question}
                        speaking={speakingId === message.id}
                        onSpeak={voiceOut ? () => toggleSpeak(message) : undefined}
                        onCards={() =>
                          setCardsDraft({
                            drafts: cardsFromAnswer(message.content, question),
                            source: question || active.title,
                            content: message.content,
                          })
                        }
                        onCompare={() => openCompare(message.content)}
                        streaming={
                          busy &&
                          index === active.messages.length - 1 &&
                          message.role === "assistant"
                        }
                        phase={phase}
                      />
                    );
                  })}
                </div>
              ) : (
                <Empty
                  onPick={(prompt) => void send(prompt)}
                  onExam={link === "online" ? () => setView("exam") : undefined}
                  onReview={() => setView("review")}
                  onPlan={() => setView("plan")}
                  onGroup={() => setView("group")}
                  onSettings={() => setView("settings")}
                  onOral={startOral}
                  subject={subject}
                  onSubject={chooseSubject}
                  onStartSubject={startSubject}
                  onResume={resumeThread}
                  daily={daily}
                  dailyDone={dailyDone}
                  onDaily={() => {
                    if (!daily) return;
                    markDailyDone(daily.id);
                    setDailyDone(true);
                    if (daily.subject) {
                      const next = sanitizeSubject(daily.subject);
                      setSubject(next);
                      try {
                        if (next) localStorage.setItem("nexo-subject", next);
                      } catch {
                        // ignore
                      }
                    }
                    void send(daily.prompt);
                  }}
                />
              )}
            </div>

            <form
              className="shrink-0 px-3 pt-2 pb-3 md:px-5"
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft, attachment, pendingDoc);
              }}
            >
              <div className="mx-auto max-w-2xl">
                {error ? (
                  <p className="mb-2 flex items-center gap-2 text-sm text-muted">
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-accent-r"
                      aria-hidden="true"
                    />
                    {error}
                  </p>
                ) : null}
                {trimmed && !error ? (
                  <p className="mb-2 text-xs text-faint">
                    Los mensajes más antiguos de esta conversación ya no se envían al tutor.
                  </p>
                ) : null}
                {attachment ? (
                  <div className="attach-preview mb-2 flex items-center gap-3">
                    <span className="relative">
                      <img
                        src={attachment.thumb}
                        alt="Foto adjunta"
                        className="block size-16 rounded-sm border border-neon/40 object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Quitar foto"
                        onClick={() => setAttachment(null)}
                        className="tap absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full border border-line bg-bg text-fg"
                      >
                        <X className="size-3.5" strokeWidth={2} />
                      </button>
                    </span>
                    <p className="min-w-0 font-mono text-xs leading-relaxed tracking-wider text-muted uppercase">
                      <span className="text-neon">Foto lista</span>
                      <span className="block normal-case tracking-normal text-faint">
                        Se envía con tu mensaje. Podés sumar qué necesitás.
                      </span>
                    </p>
                  </div>
                ) : null}
                {pendingDoc ? (
                  <div className="attach-preview mb-2 flex items-center gap-3">
                    <DocChip doc={pendingDoc} />
                    <button
                      type="button"
                      aria-label="Quitar documento"
                      onClick={() => setPendingDoc(null)}
                      className="tap grid size-9 shrink-0 place-items-center rounded-full border border-line text-fg"
                    >
                      <X className="size-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ) : active?.doc ? (
                  <div className="mb-2 flex items-center gap-2 text-xs leading-relaxed text-faint">
                    <FileText className="size-4 shrink-0 text-neon" strokeWidth={1.5} />
                    <p className="min-w-0 flex-1">
                      {active.doc.text ? (
                        <>
                          Usando <span className="text-muted">«{active.doc.name}»</span> en cada
                          pregunta
                          {active.doc.truncated ? " (solo una parte)" : ""}.
                        </>
                      ) : (
                        <>
                          «{active.doc.name}» ya no está guardado en este navegador. Adjuntalo de
                          nuevo para seguir preguntando sobre él.
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      aria-label="Quitar el documento de esta conversación"
                      onClick={() => useChatStore.getState().setDoc(active.id, undefined)}
                      className="tap grid size-9 shrink-0 place-items-center text-faint hover:text-fg"
                    >
                      <X className="size-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ) : null}
                {isOralReply(reply) ? (
                  <OralChip
                    mode={reply}
                    onExit={() => useSettingsStore.getState().setReply("normal")}
                  />
                ) : null}
                {listening ? (
                  <p className="mb-2 flex items-center gap-2 font-mono text-xs tracking-widest text-neon uppercase">
                    <span className="hud-dot size-1.5 rounded-full" aria-hidden="true" />
                    Escuchando…
                  </p>
                ) : null}
                <div className="hud-frame">
                  <div className="dock relative flex items-end gap-2 rounded-sm p-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void pickImage(event.target.files?.[0])}
                    />
                    <input
                      ref={docRef}
                      type="file"
                      accept={DOC_ACCEPT}
                      className="hidden"
                      onChange={(event) => void pickDocument(event.target.files?.[0])}
                    />
                    {menu ? (
                      <>
                        <button
                          type="button"
                          aria-label="Cerrar menú de adjuntos"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setMenu(false)}
                        />
                        <div
                          role="menu"
                          className="attach-menu absolute bottom-full left-0 z-20 mb-2 w-64 rounded-sm border border-line bg-bg-elev p-1.5 shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="tap flex h-12 w-full items-center gap-3 rounded-sm px-3 text-left text-sm text-fg hover:bg-bg-soft"
                            onClick={() => {
                              setMenu(false);
                              fileRef.current?.click();
                            }}
                          >
                            <Camera className="size-5 text-neon" strokeWidth={1.5} />
                            Foto del ejercicio
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="tap flex h-12 w-full items-center gap-3 rounded-sm px-3 text-left text-sm text-fg hover:bg-bg-soft"
                            onClick={() => {
                              setMenu(false);
                              docRef.current?.click();
                            }}
                          >
                            <FileText className="size-5 text-neon" strokeWidth={1.5} />
                            <span>
                              PDF o apunte
                              <span className="block text-xs text-faint">.pdf, .txt o .md</span>
                            </span>
                          </button>
                        </div>
                      </>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Adjuntar foto o documento"
                      title="Adjuntar foto o documento"
                      aria-haspopup="menu"
                      aria-expanded={menu}
                      disabled={busy || preparing || readingDoc}
                      onClick={() => setMenu((open) => !open)}
                      className={`tap hud-btn grid size-11 shrink-0 place-items-center rounded-sm border border-line text-muted disabled:text-faint ${
                        attachment || pendingDoc ? "border-neon/60 text-neon" : ""
                      } ${preparing || readingDoc ? "animate-pulse" : ""}`}
                    >
                      <Paperclip className="size-5" strokeWidth={1.5} />
                    </button>
                    <label className="sr-only" htmlFor="pregunta">
                      Pregunta
                    </label>
                    <textarea
                      id="pregunta"
                      ref={fieldRef}
                      rows={1}
                      value={draft}
                      placeholder={
                        listening
                          ? "Te escucho…"
                          : attachment
                            ? "¿Qué necesitás de la foto? (opcional)"
                            : pendingDoc
                              ? "¿Qué querés saber del documento? (opcional)"
                              : "Pregunta algo concreto"
                      }
                      className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-fg caret-neon outline-none placeholder:text-faint"
                      onChange={(event) => {
                        setDraft(event.target.value);
                        const node = event.target;
                        node.style.height = "auto";
                        node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void send(draft, attachment, pendingDoc);
                        }
                      }}
                    />
                    {canDictate ? (
                      <button
                        type="button"
                        aria-label={listening ? "Terminar dictado" : "Dictar la pregunta"}
                        title={listening ? "Terminar dictado" : "Dictar la pregunta"}
                        aria-pressed={listening}
                        disabled={busy}
                        onClick={toggleDictation}
                        className={`tap hud-btn grid size-11 shrink-0 place-items-center rounded-sm border text-muted disabled:text-faint ${
                          listening ? "mic-live border-neon/70 text-neon" : "border-line"
                        }`}
                      >
                        <Mic className="size-5" strokeWidth={1.5} />
                      </button>
                    ) : null}
                    <button
                      type={busy ? "button" : "submit"}
                      aria-label={busy ? "Detener" : "Enviar"}
                      disabled={
                        !busy &&
                        ((!draft.trim() && !attachment && !pendingDoc) || preparing || readingDoc)
                      }
                      onClick={busy ? stop : undefined}
                      className="tap send-btn grid size-11 shrink-0 place-items-center rounded-sm bg-neon text-ink disabled:bg-bg-soft disabled:text-faint"
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
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-faint">
                  {link === "online"
                    ? "En línea, con búsqueda web."
                    : link === "offline"
                      ? "Modelo no disponible."
                      : "Comprobando el modelo."}{" "}
                  El historial se queda en este navegador. Puede equivocarse.
                </p>
              </div>
            </form>
          </>
        )}
      </section>
      {cardsDraft ? (
        <FlashcardSheet
          drafts={cardsDraft.drafts}
          source={cardsDraft.source}
          onClose={() => setCardsDraft(null)}
          onSaved={(count) => {
            setCardsDraft(null);
            showToast(
              count > 0
                ? `${count} ${count === 1 ? "ficha guardada" : "fichas guardadas"} en Fichas.`
                : "Esas fichas ya estaban guardadas.",
            );
          }}
          onAskAi={
            link === "online"
              ? () => {
                  const content = cardsDraft.content;
                  setCardsDraft(null);
                  // Same thread: the tutor already has the explanation in the history.
                  askFromTool(
                    content === lastAnswer()
                      ? CARDS_PROMPT
                      : `${CARDS_PROMPT.replace("tu explicación anterior", "esta parte de tu explicación")}\n\n«${content.slice(0, 1200)}»`,
                  );
                }
              : undefined
          }
        />
      ) : null}
      {toast ? (
        <div
          role="status"
          className="g-fade pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4"
        >
          <p className="max-w-sm rounded-md border border-neon/50 bg-bg-elev px-4 py-2.5 text-center text-sm text-fg shadow-lg">
            {toast}
          </p>
        </div>
      ) : null}
      <CelebrationOverlay
        paused={
          busy ||
          ((view === "exam" || view === "review") &&
            examStage !== "result" &&
            examStage !== "config")
        }
        onProfile={() => openView("profile")}
      />
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

function HudStatus({ link }: { link: LinkState }) {
  const label = link === "online" ? "En línea" : link === "offline" ? "Sin modelo" : "Conectando";
  return (
    <p className="flex h-7 shrink-0 items-center gap-1.5 rounded-sm border border-line px-2 font-mono text-xs tracking-wider text-muted uppercase">
      <span
        className={`hud-dot size-1.5 rounded-full ${link === "offline" ? "off" : ""}`}
        aria-hidden="true"
      />
      <span className="hidden min-[380px]:inline">{label}</span>
      <span className="sr-only min-[380px]:hidden">{label}</span>
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
      <div
        className={`drawer-panel relative flex h-full w-[min(20rem,88vw)] border-r border-line bg-bg ${shown ? "open" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

function Sidebar({
  link,
  onFresh,
  onOpen,
  view,
  onNavigate,
  onContinue,
  onOral,
}: {
  link: LinkState;
  onFresh: () => void;
  onOpen: (view: View) => void;
  view: View;
  onNavigate?: () => void;
  onContinue?: (title: string) => void;
  onOral: () => void;
}) {
  const threads = useChatStore((state) => state.threads);
  const activeId = useChatStore((state) => state.activeId);
  const reply = useSettingsStore((state) => state.reply);
  const study: { id: View | "oral"; label: string; icon: typeof Plus }[] = [
    { id: "plan", label: "Plan", icon: CalendarDays },
    { id: "cards", label: "Fichas", icon: Layers },
    { id: "compare", label: "Comparar", icon: GitCompare },
    { id: "group", label: "Grupo", icon: Users },
    { id: "export", label: "Exportar", icon: FileDown },
    { id: "oral", label: "Modo oral", icon: Mic },
  ];

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
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onNavigate}
            className="tap grid size-11 place-items-center"
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3">
          <MenuIdentity onOpen={() => onOpen("identity")} />
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-current={view === "exam" ? "page" : undefined}
              className={`tap flex h-11 items-center justify-center gap-2 rounded-md border text-sm ${
                view === "exam"
                  ? "border-neon/60 text-neon"
                  : "border-line text-fg hover:bg-bg-soft"
              }`}
              onClick={() => onOpen("exam")}
              disabled={link !== "online"}
            >
              <Target className="size-4" strokeWidth={1.75} />
              Modo examen
            </button>
            <button
              type="button"
              aria-current={view === "profile" ? "page" : undefined}
              className={`tap flex h-11 items-center justify-center gap-2 rounded-md border text-sm ${
                view === "profile"
                  ? "border-neon/60 text-neon"
                  : "border-line text-fg hover:bg-bg-soft"
              }`}
              onClick={() => onOpen("profile")}
            >
              <Trophy className="size-4" strokeWidth={1.75} />
              Tu perfil
            </button>
          </div>
          <ReviewMenuButton onOpen={() => onOpen("review")} />
          <p className="px-1 pt-3 pb-1.5 text-xs text-faint">Estudio</p>
          <div className="grid grid-cols-2 gap-1.5">
            {study.map((item) => {
              const current =
                item.id === "oral" ? isOralReply(reply) && view === "chat" : view === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={current ? "page" : undefined}
                  className={`tap flex h-10 items-center gap-2 rounded-md border px-2.5 text-left text-[13px] ${
                    current ? "border-neon/60 text-neon" : "border-line text-fg hover:bg-bg-soft"
                  }`}
                  onClick={() => {
                    if (item.id === "oral") onOral();
                    else onOpen(item.id);
                    onNavigate?.();
                  }}
                >
                  <Icon className="size-4 shrink-0 text-neon" strokeWidth={1.75} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
          <details className="mt-2 rounded-md border border-line open:bg-bg-soft/40">
            <summary className="tap flex h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm text-fg">
              <span className="font-medium">Más</span>
              <span className="text-xs text-faint">favoritos, desafío, ajustes</span>
            </summary>
            <div className="flex flex-col gap-1 border-t border-line p-1.5">
              <button
                type="button"
                aria-current={view === "favorites" ? "page" : undefined}
                className={`tap flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm ${
                  view === "favorites"
                    ? "bg-paper text-ink"
                    : "text-muted hover:bg-bg-soft hover:text-fg"
                }`}
                onClick={() => onOpen("favorites")}
              >
                <Star className="size-4" strokeWidth={1.75} />
                Favoritos
              </button>
              <button
                type="button"
                aria-current={view === "week" ? "page" : undefined}
                className={`tap flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm ${
                  view === "week"
                    ? "bg-paper text-ink"
                    : "text-muted hover:bg-bg-soft hover:text-fg"
                }`}
                onClick={() => onOpen("week")}
              >
                <Flag className="size-4" strokeWidth={1.75} />
                Desafío
              </button>
              <button
                type="button"
                aria-current={view === "settings" ? "page" : undefined}
                className={`tap flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm ${
                  view === "settings"
                    ? "bg-paper text-ink"
                    : "text-muted hover:bg-bg-soft hover:text-fg"
                }`}
                onClick={() => onOpen("settings")}
              >
                <Settings className="size-4" strokeWidth={1.75} />
                Ajustes
              </button>
            </div>
          </details>
          <p className="px-1 pt-3 text-xs leading-relaxed text-faint">
            Gratis · {FREE_CAPS.chats} chats y {FREE_CAPS.exams} exámenes por día en este
            dispositivo. El historial vive solo en este navegador. · NEXO {APP_VERSION}
          </p>
        </div>

        <div className="mt-4 px-2 pb-4">
          <p className="px-3 pb-2 text-xs text-faint">Conversaciones</p>
          {threads.length === 0 ? (
            <p className="px-3 text-sm text-faint">Todavía no hay ninguna.</p>
          ) : (
            <ul className="flex flex-col">
              {threads.map((thread) => (
                <li key={thread.id} className="flex flex-col border-b border-line/60 last:border-0">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        useChatStore.getState().select(thread.id);
                        onOpen("chat");
                        onNavigate?.();
                      }}
                      className={`min-w-0 flex-1 truncate rounded-md px-3 py-2.5 text-left text-sm ${
                        thread.id === activeId
                          ? "bg-paper text-ink"
                          : "text-muted hover:bg-bg-soft hover:text-fg"
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
                  </div>
                  {onContinue && thread.messages.length > 0 ? (
                    <button
                      type="button"
                      className="tap mb-1 ml-3 self-start rounded-sm px-2 py-1 text-[11px] text-neon hover:bg-neon/10"
                      onClick={() => {
                        onContinue(thread.title);
                        onNavigate?.();
                      }}
                    >
                      Seguir con este tema
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-line px-2 py-2">
        <Donate />
      </div>
    </div>
  );
}

function ReviewMenuButton({ onOpen }: { onOpen: () => void }) {
  const count = useMistakeCount();
  if (count <= 0) return null;
  return (
    <button
      type="button"
      className="tap mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-neon/50 text-sm text-neon"
      onClick={onOpen}
    >
      <RotateCcw className="size-4" strokeWidth={1.75} />
      Repasar errores ({count})
    </button>
  );
}

function Empty({
  onPick,
  onExam,
  onReview,
  onPlan,
  onGroup,
  onSettings,
  onOral,
  subject,
  onSubject,
  onStartSubject,
  onResume,
  daily,
  dailyDone,
  onDaily,
}: {
  onPick: (prompt: string) => void;
  onExam?: () => void;
  onReview: () => void;
  onPlan: () => void;
  onGroup: () => void;
  onSettings: () => void;
  onOral: () => void;
  subject: SubjectChoice;
  onSubject: (id: SubjectChoice) => void;
  onStartSubject: (id: SubjectChoice) => void;
  onResume: (id: string) => void;
  daily: DailyChallenge | null;
  dailyDone: boolean;
  onDaily: () => void;
}) {
  const streakLine = useStreakLine();
  const missions = useMissions();
  const mistakeCount = useMistakeCount();
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="rise flex items-center gap-4">
        <span className="hud-frame grid size-16 place-items-center text-paper">
          <Mark className="size-12" />
        </span>
        <div className="font-mono text-xs leading-relaxed tracking-widest uppercase">
          <p className="text-neon">Tutor listo</p>
          <p className="text-faint">{streakLine ?? "Sesión nueva"}</p>
        </div>
      </div>
      <h1 className="rise rise-2 mt-8 font-display text-4xl leading-none font-semibold tracking-tight text-balance text-paper">
        Pregunta un tema<span className="text-neon">.</span>
      </h1>
      <p className="rise rise-2 mt-3 text-base leading-relaxed text-muted">
        Elige una misión rápida o escribe la tuya.
      </p>
      <ResumeCard onResume={onResume} />
      {daily ? (
        <button
          type="button"
          onClick={onDaily}
          className="rise rise-2 tap chip mt-5 flex w-full items-center gap-3 rounded-sm border border-neon/45 bg-neon/8 px-3 py-3 text-left"
        >
          <Flag className="size-5 shrink-0 text-neon" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] tracking-widest text-neon uppercase">
              Desafío diario{dailyDone ? " · listo" : ""}
            </span>
            <span className="mt-0.5 block truncate text-sm text-fg">{daily.title}</span>
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-wider text-faint uppercase">
            {dailyDone ? "Otra vez" : "Gratis"}
          </span>
        </button>
      ) : null}
      <GoalCard onSettings={onSettings} />
      <TodayCards onPlan={onPlan} onGroup={onGroup} />
      <div className="rise rise-2 mt-5">
        <p className="mb-2 font-mono text-xs tracking-widest text-faint uppercase">Materias</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSubject(SUBJECT_NONE)}
            className={`tap rounded-sm border px-2.5 py-1.5 text-xs ${
              !subject ? "border-neon/60 text-neon" : "border-line text-muted"
            }`}
          >
            Todas
          </button>
          {SUBJECTS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              onClick={() => onSubject(item.id === subject ? SUBJECT_NONE : item.id)}
              className={`tap rounded-sm border px-2.5 py-1.5 text-xs ${
                subject === item.id ? "border-neon/60 text-neon" : "border-line text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {subject ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onStartSubject(subject)}
              className="tap chip flex h-10 items-center gap-2 rounded-sm border border-neon/50 bg-neon/8 px-3 text-sm text-fg"
            >
              <MessageSquarePlus className="size-4 text-neon" strokeWidth={1.75} />
              Nuevo chat de {subjectLabel(subject)}
            </button>
            <span className="text-xs text-faint">El tutor responde enfocado en esa materia.</span>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-faint">
            Tocá una materia para abrir un chat enfocado en ella.
          </p>
        )}
      </div>
      <div className="rise rise-3 mt-8 mb-2.5 flex items-center justify-between gap-2">
        <p className="font-mono text-xs tracking-widest text-faint uppercase">Misiones rápidas</p>
        <button
          type="button"
          onClick={missions.shuffle}
          className="tap flex h-8 items-center gap-1.5 rounded-sm px-2 font-mono text-[11px] tracking-wider text-muted uppercase hover:text-neon"
        >
          <Shuffle className="size-3.5" strokeWidth={1.75} />
          Otras misiones
        </button>
      </div>
      <ul className="rise rise-3 grid grid-cols-2 gap-2">
        {missions.list.map((item, index) => (
          <li key={item.name}>
            <button
              type="button"
              onClick={() => onPick(item.prompt)}
              className="tap chip flex h-12 w-full items-center gap-2.5 rounded-sm border border-line bg-bg-elev/70 px-3 text-left text-sm text-muted"
            >
              <span className="chip-index font-mono text-xs text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="truncate">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {onExam ? (
        <button
          type="button"
          onClick={onExam}
          className="rise rise-3 tap chip mt-2 flex h-12 w-full items-center gap-2.5 rounded-sm border border-neon/40 bg-neon/5 px-3 text-left text-sm text-fg"
        >
          <Target className="size-4 text-neon" strokeWidth={1.75} />
          <span className="flex-1">Modo examen</span>
          <span className="font-mono text-[11px] tracking-wider text-neon uppercase">
            Hasta +150 XP
          </span>
        </button>
      ) : null}
      <div className="rise rise-3 mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPlan}
          className="tap chip flex h-12 w-full items-center gap-2.5 rounded-sm border border-line bg-bg-elev/70 px-3 text-left text-sm text-fg"
        >
          <CalendarDays className="size-4 shrink-0 text-neon" strokeWidth={1.75} />
          <span className="truncate">Plan de estudio</span>
        </button>
        <button
          type="button"
          onClick={onOral}
          className="tap chip flex h-12 w-full items-center gap-2.5 rounded-sm border border-line bg-bg-elev/70 px-3 text-left text-sm text-fg"
        >
          <Mic className="size-4 shrink-0 text-neon" strokeWidth={1.75} />
          <span className="truncate">Tomame oral</span>
        </button>
      </div>
      {mistakeCount > 0 ? (
        <button
          type="button"
          onClick={onReview}
          className="rise rise-3 tap chip mt-2 flex h-12 w-full items-center gap-2.5 rounded-sm border border-neon/40 bg-neon/5 px-3 text-left text-sm text-fg"
        >
          <RotateCcw className="size-4 text-neon" strokeWidth={1.75} />
          <span className="flex-1">Repasar errores ({mistakeCount})</span>
          <span className="font-mono text-[11px] tracking-wider text-neon uppercase">
            En este celu
          </span>
        </button>
      ) : null}
      <div className="rise rise-3 mt-6">
        <Donate variant="empty" />
      </div>
    </div>
  );
}

/** 2.7: "Seguir donde quedaste" + the last conversations, one tap to reopen. */
function ResumeCard({ onResume }: { onResume: (id: string) => void }) {
  const threads = useChatStore((state) => state.threads);
  const last = lastThread(threads);
  if (!last) return null;
  const others = recentThreads(threads, 4).filter((thread) => thread.id !== last.id);
  const question = lastQuestion(last);
  const tag = last.subject ? subjectLabel(last.subject) : null;
  return (
    <div className="rise rise-2 mt-6">
      <button
        type="button"
        onClick={() => onResume(last.id)}
        className="tap chip flex w-full items-center gap-3 rounded-sm border border-neon/45 bg-neon/8 px-3 py-3 text-left"
      >
        <History className="size-5 shrink-0 text-neon" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] tracking-widest text-neon uppercase">
            Seguir donde quedaste · {timeAgo(last.updatedAt)}
            {tag ? ` · ${tag}` : ""}
          </span>
          <span className="mt-0.5 block truncate text-sm text-fg">{last.title}</span>
          {question && question !== last.title ? (
            <span className="block truncate text-xs text-faint">Último: {question}</span>
          ) : null}
        </span>
        <span className="shrink-0 font-mono text-[10px] tracking-wider text-faint uppercase">
          Seguir
        </span>
      </button>
      {others.length > 0 ? (
        <ul className="mt-1.5 flex flex-col">
          {others.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onResume(thread.id)}
                className="tap flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-muted hover:bg-bg-soft hover:text-fg"
              >
                <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-faint">
                  {timeAgo(thread.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const MISSIONS_KEY = "nexo-missions-last";

/** 6 random quick missions per visit to the home screen (never the same set twice in a row). */
function useMissions() {
  // Deterministic first render (SSR); the random set is picked on mount.
  const [list, setList] = useState<Mission[]>(() =>
    MISSIONS.filter((_, i) => i % 9 === 0).slice(0, 6),
  );
  const shuffle = () => {
    let previous: string[] = [];
    try {
      previous = JSON.parse(localStorage.getItem(MISSIONS_KEY) ?? "[]") as string[];
    } catch {
      previous = [];
    }
    const next = pickMissions(Array.isArray(previous) ? previous : []);
    try {
      localStorage.setItem(MISSIONS_KEY, JSON.stringify(next.map((m) => m.name)));
    } catch {
      // storage full or blocked: still show the new set
    }
    setList(next);
  };
  useEffect(shuffle, []);
  return { list, shuffle };
}

function hasPayload(message: ChatMessage) {
  return Boolean(message.content.trim() || message.image || message.hadImage || message.doc);
}

function DocChip({ doc }: { doc: DocMeta }) {
  const partial =
    doc.truncated ||
    (doc.kind === "pdf" && doc.pages && doc.totalPages && doc.pages < doc.totalPages);
  return (
    <span className="doc-chip flex min-w-0 items-center gap-2.5 rounded-sm border border-neon/35 bg-bg-elev/80 px-3 py-2">
      <FileText className="size-5 shrink-0 text-neon" strokeWidth={1.5} />
      <span className="min-w-0">
        <span className="block truncate text-sm text-fg">{doc.name}</span>
        <span className="block font-mono text-xs text-faint">
          {describeDoc(doc)}
          {partial
            ? doc.kind === "pdf" && doc.pages
              ? ` · se leyeron ${doc.pages}`
              : " · recortado"
            : ""}
        </span>
      </span>
    </span>
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
  question,
  streaming,
  phase,
  speaking,
  onSpeak,
  onCards,
  onCompare,
}: {
  message: ChatMessage;
  question?: string;
  streaming: boolean;
  phase: "idle" | "search" | "write";
  speaking: boolean;
  onSpeak?: () => void;
  onCards?: () => void;
  onCompare?: () => void;
}) {
  const starred = useFavoritesStore((state) => state.items.some((item) => item.id === message.id));
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="msg-in flex justify-end">
        <div className="nexo-read flex max-w-[85%] flex-col items-end gap-2 rounded-md rounded-br-sm border border-neon/25 bg-neon/10 p-2 leading-relaxed text-fg">
          {message.image ? (
            <img
              src={message.image}
              alt="Foto del ejercicio"
              className="block max-h-64 w-auto max-w-full rounded-sm border border-line object-contain"
            />
          ) : message.hadImage ? (
            <span className="flex items-center gap-2 px-2 pt-1 font-mono text-xs text-faint">
              <ImageOff className="size-4" strokeWidth={1.5} />
              Foto enviada (ya no se guarda)
            </span>
          ) : null}
          {message.doc ? <DocChip doc={message.doc} /> : null}
          {message.content ? (
            <p className="px-2 py-1 whitespace-pre-wrap">{message.content}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <article className="msg-in min-w-0">
      <div className="mb-2 flex items-center justify-between text-paper">
        <span className="flex items-center gap-2">
          <Mark className="size-5" />
          <span className="font-display text-xs font-semibold tracking-widest text-faint uppercase">
            NEXO AI
          </span>
        </span>
      </div>
      <div className="assistant-rail border-l border-line pl-4">
        {message.content ? (
          <Lesson content={message.content} streaming={streaming} />
        ) : (
          <p className="flex h-7 items-center gap-2.5 font-mono text-xs tracking-widest text-muted uppercase">
            <span className="scan-bar" aria-hidden="true" />
            {phase === "search" ? "Buscando en la web" : "Consultando"}
          </p>
        )}
        {streaming && message.content ? <span className="caret" aria-hidden="true" /> : null}
        {!streaming && hasUncertainty(message.content) ? (
          <p className="mt-3 flex items-start gap-2 rounded-sm border border-accent-r/40 bg-accent-r/8 px-3 py-2 text-xs leading-relaxed text-fg">
            <CircleHelp className="mt-0.5 size-4 shrink-0 text-accent-r" strokeWidth={1.75} />
            {UNSURE_NOTICE}
          </p>
        ) : null}
        {message.sources && message.sources.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {message.sources.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="chip inline-flex h-11 items-center rounded-sm border border-line px-3 font-mono text-xs text-muted"
                >
                  {hostOf(url)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {message.content && !streaming ? (
        <div className="msg-actions mt-1 flex flex-wrap items-center pl-2">
          <button
            type="button"
            aria-pressed={starred}
            className={`tap hud-btn flex h-11 items-center gap-1.5 px-2 text-xs ${
              starred ? "text-neon" : "text-faint"
            }`}
            onClick={() =>
              useFavoritesStore.getState().toggle({
                id: message.id,
                q: question?.trim() || "Respuesta",
                a: message.content,
                at: Date.now(),
              })
            }
          >
            <Star
              className="size-3.5"
              strokeWidth={1.75}
              fill={starred ? "currentColor" : "none"}
            />
            {starred ? "Guardada" : "Favorito"}
          </button>
          {onSpeak ? (
            <button
              type="button"
              aria-pressed={speaking}
              className={`tap hud-btn flex h-11 items-center gap-1.5 px-2 text-xs ${
                speaking ? "text-neon" : "text-faint"
              }`}
              onClick={onSpeak}
            >
              {speaking ? (
                <Square className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Volume2 className="size-3.5" strokeWidth={1.75} />
              )}
              {speaking ? "Detener" : "Escuchar"}
            </button>
          ) : null}
          <button
            type="button"
            className="tap hud-btn flex h-11 items-center gap-1.5 px-2 text-xs text-faint"
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
          {onCards ? (
            <button
              type="button"
              className="tap hud-btn flex h-11 items-center gap-1.5 px-2 text-xs text-faint"
              onClick={onCards}
              title="Convertir esta explicación en fichas para practicar sin internet"
            >
              <Layers className="size-3.5" strokeWidth={1.75} />
              Fichas
            </button>
          ) : null}
          {onCompare ? (
            <button
              type="button"
              className="tap hud-btn flex h-11 items-center gap-1.5 px-2 text-xs text-faint"
              onClick={onCompare}
              title="Comparar esta respuesta con tu apunte (PDF)"
            >
              <GitCompare className="size-3.5" strokeWidth={1.75} />
              Comparar
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
