import { useSyncExternalStore } from "react";

import { installStore, isDismissed, isIos, isStandalone, rememberDismissal } from "./installStore";

export interface InstallPrompt {
  /** Whether there's something to offer: an install event, or iOS instructions. */
  canPrompt: boolean;
  platform: "chromium" | "ios" | null;
  /** Chromium: show the browser's install dialog. iOS: open the instructions sheet. */
  prompt: () => Promise<void>;
  /** Hide the dashboard card for 30 days. */
  dismiss: () => void;
  /** The dashboard card was dismissed less than 30 days ago. */
  dismissed: boolean;
}

export function useInstallPrompt(): InstallPrompt {
  const s = useSyncExternalStore(installStore.subscribe, installStore.getSnapshot);
  const hidden = s.installed || isStandalone();
  const platform = hidden ? null : s.deferred ? "chromium" : isIos() ? "ios" : null;

  return {
    canPrompt: platform !== null,
    platform,
    dismissed: isDismissed(),
    async prompt() {
      if (platform === "ios") {
        installStore.set({ iosHelpOpen: true });
        return;
      }
      const event = s.deferred;
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      // An install event can only be used once.
      installStore.set({ deferred: null });
    },
    dismiss() {
      rememberDismissal();
      // Re-render subscribers so the card disappears now.
      installStore.set({});
    },
  };
}

export function useIosHelp() {
  const open = useSyncExternalStore(
    installStore.subscribe,
    () => installStore.getSnapshot().iosHelpOpen,
  );
  return { open, setOpen: (iosHelpOpen: boolean) => installStore.set({ iosHelpOpen }) };
}
