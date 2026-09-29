import { useEffect, useState } from "react";
import { dayKey, liveStreak, xpToday } from "@/lib/progress";
import { useProgressStore } from "@/lib/progress-store";

/** Today's key, refreshed every minute so the streak rolls over at midnight. */
export function useToday() {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setToday(dayKey(new Date())), 60_000);
    const onFocus = () => setToday(dayKey(new Date()));
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return today;
}

/** Small line for the empty screen: "Racha activa · hoy +40 XP". */
export function useStreakLine() {
  const progress = useProgressStore((state) => state.progress);
  const today = useToday();
  const streak = liveStreak(progress.streak, today);
  const gained = xpToday(progress, today);
  if (streak > 0 && gained > 0) return `Racha activa · hoy +${gained} XP`;
  if (streak > 0) return "Estudiá hoy para seguir la racha";
  return null;
}
