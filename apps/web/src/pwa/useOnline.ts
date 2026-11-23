import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export const OFFLINE_MESSAGE =
  "You're offline. You can look around, but changes won't save until you're back.";

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}
