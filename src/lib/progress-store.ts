import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  applyActivity,
  emptyProgress,
  sanitizeProgress,
  type Activity,
  type ActivityResult,
  type LevelInfo,
  type Progress,
  type Unlock,
} from "@/lib/progress";

/** What the achievement overlay shows next (merged, so it never stacks up). */
export type Celebration = {
  unlocks: Unlock[];
  levelUp: LevelInfo | null;
};

type ProgressState = {
  progress: Progress;
  celebration: Celebration | null;
  record: (activity: Activity, now?: Date) => ActivityResult;
  dismiss: () => void;
};

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
      // Storage full: progress is small, conversations are trimmed elsewhere.
    }
  },
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: emptyProgress(),
      celebration: null,
      record: (activity, now = new Date()) => {
        const result = applyActivity(get().progress, activity, now);
        const previous = get().celebration;
        const unlocks = [...(previous?.unlocks ?? []), ...result.unlocked];
        const levelUp = result.levelUp ?? previous?.levelUp ?? null;
        set({
          progress: result.progress,
          celebration: unlocks.length > 0 || levelUp ? { unlocks, levelUp } : previous,
        });
        return result;
      },
      dismiss: () => set({ celebration: null }),
    }),
    {
      name: "nexo-progress",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ progress: state.progress }),
      merge: (persisted, current) => ({
        ...current,
        progress: sanitizeProgress((persisted as { progress?: unknown } | undefined)?.progress),
      }),
    },
  ),
);
