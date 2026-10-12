/**
 * NEXO 2.6 device-only stores: weekly plan, chat flashcards, daily goal and
 * group mode. All in localStorage; nothing is sent to a server except the
 * anonymous group score (see /api/group).
 */
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { addChatCards, sanitizeChatCards, type ChatCard, type DraftCard } from "@/lib/flashcards";
import { normalizeClassCode, sanitizeGroupState, type GroupResult } from "@/lib/group";
import { dayKey } from "@/lib/progress";
import {
  addStudySeconds,
  emptyGoal,
  sanitizeGoal,
  setGoalMinutes,
  type GoalState,
} from "@/lib/study-goal";
import { sanitizePlan, toggleTask, type StudyPlan } from "@/lib/study-plan";

const storage: StateStorage = {
  getItem: (name) => (typeof localStorage === "undefined" ? null : localStorage.getItem(name)),
  removeItem: (name) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(name);
  },
  setItem: (name, value) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(name, value);
    } catch {
      // Full storage: the change still applies for this visit.
    }
  },
};

type PlanState = {
  plan: StudyPlan | null;
  setPlan: (plan: StudyPlan | null) => void;
  toggle: (taskId: string) => void;
};

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: null,
      setPlan: (plan) => set({ plan }),
      toggle: (taskId) => {
        const plan = get().plan;
        if (plan) set({ plan: toggleTask(plan, taskId) });
      },
    }),
    {
      name: "nexo-plan",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ plan: state.plan }),
      merge: (persisted, current) => ({
        ...current,
        plan: sanitizePlan((persisted as { plan?: unknown } | undefined)?.plan),
      }),
    },
  ),
);

type ChatCardsState = {
  cards: ChatCard[];
  add: (drafts: DraftCard[], source: string) => number;
  remove: (id: string) => void;
};

function cardId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `chat:${crypto.randomUUID().slice(0, 18)}`
    : `chat:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const useChatCardsStore = create<ChatCardsState>()(
  persist(
    (set, get) => ({
      cards: [],
      add: (drafts, source) => {
        const { list, added } = addChatCards(get().cards, drafts, source, Date.now(), cardId);
        set({ cards: list });
        return added;
      },
      remove: (id) => set({ cards: get().cards.filter((card) => card.id !== id) }),
    }),
    {
      name: "nexo-chat-cards",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ cards: state.cards }),
      merge: (persisted, current) => ({
        ...current,
        cards: sanitizeChatCards((persisted as { cards?: unknown } | undefined)?.cards),
      }),
    },
  ),
);

type GoalStoreState = {
  goal: GoalState;
  /** Adds study seconds to today; true on the tick that reaches the goal. */
  tick: (seconds: number) => boolean;
  setGoal: (minutes: number) => void;
};

export const useGoalStore = create<GoalStoreState>()(
  persist(
    (set, get) => ({
      goal: emptyGoal(),
      tick: (seconds) => {
        const { state, reached } = addStudySeconds(get().goal, dayKey(new Date()), seconds);
        set({ goal: state });
        return reached;
      },
      setGoal: (minutes) => set({ goal: setGoalMinutes(get().goal, minutes, dayKey(new Date())) }),
    }),
    {
      name: "nexo-goal",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ goal: state.goal }),
      merge: (persisted, current) => ({
        ...current,
        goal: sanitizeGoal((persisted as { goal?: unknown } | undefined)?.goal, dayKey(new Date())),
      }),
    },
  ),
);

type GroupStoreState = {
  code: string | null;
  results: Record<string, GroupResult>;
  join: (code: string) => boolean;
  leave: () => void;
  save: (day: string, result: GroupResult) => void;
};

export const useGroupStore = create<GroupStoreState>()(
  persist(
    (set, get) => ({
      code: null,
      results: {},
      join: (raw) => {
        const code = normalizeClassCode(raw);
        if (!code) return false;
        set({ code });
        return true;
      },
      leave: () => set({ code: null }),
      save: (day, result) => {
        const next = sanitizeGroupState({
          code: get().code,
          results: { ...get().results, [day]: result },
        });
        set({ results: next.results });
      },
    }),
    {
      name: "nexo-group",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ code: state.code, results: state.results }),
      merge: (persisted, current) => ({ ...current, ...sanitizeGroupState(persisted) }),
    },
  ),
);

export async function rehydrateStudyStores() {
  await Promise.all([
    usePlanStore.persist.rehydrate(),
    useChatCardsStore.persist.rehydrate(),
    useGoalStore.persist.rehydrate(),
    useGroupStore.persist.rehydrate(),
  ]);
}
