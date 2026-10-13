import { useEffect, useState } from "react";
import { loadWeak, subscribeWeak, type WeakSpot } from "./weak-spots.ts";

/** Weak topics on this device, heaviest first. Empty during SSR. */
export function useWeakSpots() {
  const [spots, setSpots] = useState<WeakSpot[]>([]);
  useEffect(() => {
    const read = () => setSpots(loadWeak());
    read();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "nexo-weak-spots") read();
    };
    window.addEventListener("storage", onStorage);
    const off = subscribeWeak(read);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return spots;
}
