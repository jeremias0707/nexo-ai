import { useEffect, useState } from "react";
import { loadMistakes, subscribeMistakes } from "./mistakes.ts";

/** How many saved mistakes are on this device. 0 during SSR. */
export function useMistakeCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => setCount(loadMistakes().length);
    read();
    return subscribeMistakes(read);
  }, []);
  return count;
}
