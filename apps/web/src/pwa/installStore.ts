/**
 * Install state for the PWA, kept outside React so `beforeinstallprompt` (which can fire before
 * any component mounts) isn't missed.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallState {
  /** The captured Chromium install event, if any. */
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  iosHelpOpen: boolean;
}

const DISMISS_KEY = "kori.installDismissedAt";
export const DISMISS_DAYS = 30;

let state: InstallState = { deferred: null, installed: false, iosHelpOpen: false };
const listeners = new Set<() => void>();

function set(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const installStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  set,
  /** Test helper: forget everything captured so far. */
  reset() {
    state = { deferred: null, installed: false, iosHelpOpen: false };
    listeners.forEach((l) => l());
  },
};

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac, but has a touch screen.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isDismissed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && now - at < DISMISS_DAYS * 86_400_000;
  } catch (e) {
    console.warn("Couldn't read the install dismissal", e);
    return false;
  }
}

export function rememberDismissal(now = Date.now()) {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch (e) {
    console.warn("Couldn't remember the install dismissal", e);
  }
}

let listening = false;
/** Start capturing install events. Safe to call more than once. */
export function listenForInstall() {
  if (listening) return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    set({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => set({ installed: true, deferred: null }));
}
