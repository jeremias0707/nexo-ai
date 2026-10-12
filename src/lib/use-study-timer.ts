import { useEffect, useRef } from "react";
import { IDLE_AFTER_MS } from "@/lib/study-goal";
import { useGoalStore } from "@/lib/study-store";

const TICK_MS = 15_000;

/**
 * Counts study time for "Racha y metas": only while the tab is visible and
 * the person touched, typed or scrolled in the last 3 minutes (or an answer
 * is streaming). Local only.
 */
export function useStudyTimer(busy: boolean, onReached?: () => void) {
  const busyRef = useRef(busy);
  const reachedRef = useRef(onReached);
  busyRef.current = busy;
  reachedRef.current = onReached;

  useEffect(() => {
    let last = Date.now();
    let lastTick = Date.now();
    const mark = () => {
      last = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, mark, { passive: true }));
    document.addEventListener("scroll", mark, { passive: true, capture: true });
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTick) / 1000);
      lastTick = now;
      if (document.visibilityState !== "visible") return;
      if (now - last > IDLE_AFTER_MS && !busyRef.current) return;
      if (useGoalStore.getState().tick(elapsed)) reachedRef.current?.();
    }, TICK_MS);
    const onVisible = () => {
      lastTick = Date.now();
      if (document.visibilityState === "visible") mark();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, mark));
      document.removeEventListener("scroll", mark, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
