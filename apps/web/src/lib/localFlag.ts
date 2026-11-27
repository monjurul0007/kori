import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "kori:local-flag-change";

/** Storage can be blocked (private windows), so a failed read means the flag is off. */
export function readLocalFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setLocalFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Nothing to save to: the flag stays off, and callers that need an in-session effect keep their own state.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A boolean kept in localStorage that re-renders every component reading it when it is set. */
export function useLocalFlag(key: string): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, () => readLocalFlag(key));
  const set = useCallback(() => setLocalFlag(key), [key]);
  return [value, set];
}
