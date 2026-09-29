import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type ExplainDepth,
  type Settings,
  type TextSize,
  type ThemeId,
} from "@/lib/settings";

type SettingsState = Settings & {
  setTheme: (theme: ThemeId) => void;
  setText: (text: TextSize) => void;
  setExplain: (explain: ExplainDepth) => void;
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
      // Storage full or blocked: the choice still applies for this visit.
    }
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => set({ theme }),
      setText: (text) => set({ text }),
      setExplain: (explain) => set({ explain }),
    }),
    {
      name: "nexo-settings",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        theme: state.theme,
        text: state.text,
        explain: state.explain,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSettings(persisted),
      }),
    },
  ),
);
