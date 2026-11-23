import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR_MS = 60 * 60 * 1000;
const TOAST_ID = "pwa-update";

/** Shows a persistent "new version" toast when a new service worker is waiting. */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // The browser checks on load; also check hourly and when the app comes back to the front.
      const check = () => void registration.update().catch(() => {});
      setInterval(check, HOUR_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast("A new version of Kori is ready", {
      id: TOAST_ID,
      duration: Infinity,
      action: { label: "Reload", onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
