import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Level, Mode } from "@/lib/tutor";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

export type Thread = {
  id: string;
  title: string;
  mode: Mode;
  level: Level;
  messages: ChatMessage[];
  updatedAt: number;
};

type ChatState = {
  threads: Thread[];
  activeId: string | null;
  mode: Mode;
  level: Level;
  setMode: (mode: Mode) => void;
  setLevel: (level: Level) => void;
  openFresh: () => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  ensureThread: (title: string) => string;
  appendMessage: (threadId: string, message: ChatMessage) => void;
  patchMessage: (threadId: string, messageId: string, content: string) => void;
  setSources: (threadId: string, messageId: string, sources: string[]) => void;
  dropMessage: (threadId: string, messageId: string) => void;
};

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 52 ? `${clean.slice(0, 52).trim()}…` : clean || "Conversación";
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      threads: [],
      activeId: null,
      mode: "cimientos",
      level: "intermedio",
      setMode: (mode) => {
        const { activeId } = get();
        set((state) => ({
          mode,
          threads: state.threads.map((thread) =>
            thread.id === activeId ? { ...thread, mode } : thread,
          ),
        }));
      },
      setLevel: (level) => {
        const { activeId } = get();
        set((state) => ({
          level,
          threads: state.threads.map((thread) =>
            thread.id === activeId ? { ...thread, level } : thread,
          ),
        }));
      },
      openFresh: () => set({ activeId: null }),
      select: (id) => {
        const thread = get().threads.find((item) => item.id === id);
        if (!thread) return;
        set({ activeId: id, mode: thread.mode, level: thread.level });
      },
      remove: (id) =>
        set((state) => ({
          threads: state.threads.filter((thread) => thread.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        })),
      ensureThread: (title) => {
        const current = get().activeId;
        if (current && get().threads.some((thread) => thread.id === current)) return current;
        const id = crypto.randomUUID();
        const thread: Thread = {
          id,
          title: titleFrom(title),
          mode: get().mode,
          level: get().level,
          messages: [],
          updatedAt: Date.now(),
        };
        set((state) => ({
          activeId: id,
          threads: [thread, ...state.threads].slice(0, 30),
        }));
        return id;
      },
      appendMessage: (threadId, message) =>
        set((state) => ({
          threads: state.threads.map((thread) => {
            if (thread.id !== threadId) return thread;
            const messages = [...thread.messages, message].slice(-80);
            const title =
              thread.messages.length === 0 && message.role === "user"
                ? titleFrom(message.content)
                : thread.title;
            return { ...thread, messages, title, updatedAt: Date.now() };
          }),
        })),
      patchMessage: (threadId, messageId, content) =>
        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  updatedAt: Date.now(),
                  messages: thread.messages.map((message) =>
                    message.id === messageId ? { ...message, content } : message,
                  ),
                }
              : thread,
          ),
        })),
      setSources: (threadId, messageId, sources) =>
        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  messages: thread.messages.map((message) =>
                    message.id === messageId ? { ...message, sources } : message,
                  ),
                }
              : thread,
          ),
        })),
      dropMessage: (threadId, messageId) =>
        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  messages: thread.messages.filter((message) => message.id !== messageId),
                }
              : thread,
          ),
        })),
    }),
    {
      name: "nexo-threads",
      skipHydration: true,
      partialize: (state) => ({
        threads: state.threads,
        activeId: state.activeId,
        mode: state.mode,
        level: state.level,
      }),
    },
  ),
);
