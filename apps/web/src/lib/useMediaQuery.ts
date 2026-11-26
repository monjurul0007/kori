import { useSyncExternalStore } from "react";

/** The width from which Kori uses its desktop layout. */
export const DESKTOP_QUERY = "(min-width: 768px)";

/** Tracks a CSS media query, e.g. `(min-width: 768px)`, and re-renders when it flips. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
