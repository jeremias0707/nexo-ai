import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { applyReview, sanitizeKnown } from "@/lib/cards";
import { sanitizeFavorites, toggleFavorite, type Favorite } from "@/lib/favorites";
import { nickCounts, sanitizeAvatar, sanitizeNick } from "@/lib/profile";
import { useProgressStore } from "@/lib/progress-store";
import { sanitizeWeek, touchWeek, type WeekKind, type WeekProgress } from "@/lib/week";

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

type ProfileState = {
  nick: string;
  photo: string | null;
  setNick: (nick: string) => void;
  setPhoto: (photo: string | null) => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      nick: "Vos",
      photo: null,
      setNick: (nick) => {
        const next = sanitizeNick(nick);
        set({ nick: next });
        if (nickCounts(next)) useProgressStore.getState().record({ kind: "mark", mark: "nick" });
      },
      setPhoto: (photo) => {
        const next = sanitizeAvatar(photo);
        set({ photo: next });
        if (next) useProgressStore.getState().record({ kind: "mark", mark: "photo" });
      },
    }),
    {
      name: "nexo-profile",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ nick: state.nick, photo: state.photo }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as { nick?: unknown; photo?: unknown };
        return { ...current, nick: sanitizeNick(raw.nick), photo: sanitizeAvatar(raw.photo) };
      },
    },
  ),
);

type FavState = {
  items: Favorite[];
  toggle: (item: Favorite) => boolean;
  has: (id: string) => boolean;
};

export const useFavoritesStore = create<FavState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (id) => get().items.some((item) => item.id === id),
      toggle: (item) => {
        const { list, added } = toggleFavorite(get().items, item);
        set({ items: list });
        useProgressStore.getState().record({ kind: "mark", mark: added ? "favorite" : "unfavorite" });
        if (added) useWeekStore.getState().note("favorites");
        return added;
      },
    }),
    {
      name: "nexo-favorites",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => ({
        ...current,
        items: sanitizeFavorites((persisted as { items?: unknown } | undefined)?.items),
      }),
    },
  ),
);

type KnownState = {
  known: string[];
  /** Returns true the first time this card is marked as known. */
  review: (id: string, knew: boolean) => boolean;
};

export const useCardsStore = create<KnownState>()(
  persist(
    (set, get) => ({
      known: [],
      review: (id, knew) => {
        const { known, first } = applyReview(get().known, id, knew);
        set({ known });
        if (first) {
          useProgressStore.getState().record({ kind: "mark", mark: "card" });
          useWeekStore.getState().note("cards");
        }
        return first;
      },
    }),
    {
      name: "nexo-cards",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ known: state.known }),
      merge: (persisted, current) => ({
        ...current,
        known: sanitizeKnown((persisted as { known?: unknown } | undefined)?.known),
      }),
    },
  ),
);

type WeekState = {
  week: WeekProgress;
  note: (kind: WeekKind, now?: Date) => boolean;
};

export const useWeekStore = create<WeekState>()(
  persist(
    (set, get) => ({
      week: { weekId: "", n: 0, done: false },
      note: (kind, now = new Date()) => {
        const { progress, justDone } = touchWeek(get().week, now, kind);
        set({ week: progress });
        if (justDone) useProgressStore.getState().record({ kind: "mark", mark: "week" }, now);
        return justDone;
      },
    }),
    {
      name: "nexo-week",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ week: state.week }),
      merge: (persisted, current) => ({
        ...current,
        week: sanitizeWeek((persisted as { week?: unknown } | undefined)?.week),
      }),
    },
  ),
);
