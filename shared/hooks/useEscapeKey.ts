import { useEffect } from "react";

export const useEscapeKey = (onEscape: () => void) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onEscape]);
};

export default useEscapeKey;
