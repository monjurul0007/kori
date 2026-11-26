import { useEffect, useSyncExternalStore } from "react";

import { useMediaQuery } from "@/lib/useMediaQuery";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

// The inline script in index.html repeats these three values so the theme is set before first
// paint; theme.test.ts keeps the two in step.
export const THEME_STORAGE_KEY = "kori.theme";
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#2F3A99", dark: "#0E1022" };
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const THEME_CHANGE_EVENT = "kori-theme-change";

export function parseThemePreference(value: string | null): ThemePreference {
  return THEME_PREFERENCES.find((preference) => preference === value) ?? "system";
}

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  if (preference === "system") return systemIsDark ? "dark" : "light";
  return preference;
}

/** Storage can be blocked (private windows), so a failed read means "follow the system". */
function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function storeThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Nothing to save to: the choice can't stick, so the theme keeps following the system.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function subscribeToPreference(onChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribeToPreference, readThemePreference);
  const systemIsDark = useMediaQuery(DARK_SCHEME_QUERY);
  const resolved = resolveTheme(preference, systemIsDark);

  useEffect(() => applyTheme(resolved), [resolved]);

  return { preference, resolved, setPreference: storeThemePreference };
}
