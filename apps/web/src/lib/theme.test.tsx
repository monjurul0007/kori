import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseThemePreference,
  resolveTheme,
  THEME_COLOR,
  THEME_STORAGE_KEY,
  useTheme,
} from "./theme";

type Listener = () => void;

/** A controllable `prefers-color-scheme` / width media query for jsdom. */
function mockMedia(initial: { dark: boolean; wide?: boolean }) {
  const state = { ...initial };
  const listeners = new Set<Listener>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes("prefers-color-scheme") ? state.dark : (state.wide ?? false);
    },
    media: query,
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    setDark(dark: boolean) {
      state.dark = dark;
      listeners.forEach((listener) => listener());
    },
  };
}

function runThemeScript() {
  new Function(readFileSync(resolve(__dirname, "../../public/theme-init.js"), "utf8"))();
}

const themeColor = () =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute("content");

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.head.innerHTML = '<meta name="theme-color" content="#2F3A99" />';
});

describe("resolveTheme", () => {
  it.each([
    ["system", true, "dark"],
    ["system", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
  ] as const)("%s with a dark system=%s gives %s", (preference, systemIsDark, expected) => {
    expect(resolveTheme(preference, systemIsDark)).toBe(expected);
  });
});

describe("parseThemePreference", () => {
  it.each([null, "", "purple"])("falls back to system for %j", (value) => {
    expect(parseThemePreference(value)).toBe("system");
  });

  it("keeps a valid choice", () => {
    expect(parseThemePreference("dark")).toBe("dark");
  });
});

describe("useTheme", () => {
  it("follows the system by default and reacts when it changes", () => {
    const media = mockMedia({ dark: false });
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");

    act(() => media.setDark(true));
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(themeColor()).toBe(THEME_COLOR.dark);
  });

  it("keeps an explicit choice when the system disagrees", () => {
    mockMedia({ dark: true });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("light"));
    expect(result.current.resolved).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(themeColor()).toBe(THEME_COLOR.light);
  });

  it("persists the choice", () => {
    mockMedia({ dark: false });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(renderHook(() => useTheme()).result.current.preference).toBe("dark");
  });

  it("keeps following the system, without throwing, when storage is blocked", () => {
    mockMedia({ dark: false });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(result.current.preference).toBe("system");
  });
});

describe("pre-paint script", () => {
  it("is loaded from index.html before the app script", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    const themeScript = html.indexOf('<script src="/theme-init.js"></script>');
    expect(themeScript).toBeGreaterThan(-1);
    expect(themeScript).toBeLessThan(html.indexOf("/src/main.tsx"));
  });

  it.each([
    ["dark", false, true],
    ["light", true, false],
    [null, true, true],
    [null, false, false],
  ] as const)("saved %s with a dark system=%s sets dark=%s", (saved, systemIsDark, isDark) => {
    mockMedia({ dark: systemIsDark });
    if (saved) localStorage.setItem(THEME_STORAGE_KEY, saved);
    runThemeScript();
    expect(document.documentElement.classList.contains("dark")).toBe(isDark);
    expect(themeColor()).toBe(isDark ? THEME_COLOR.dark : THEME_COLOR.light);
  });

  it("leaves the light default when storage throws", () => {
    mockMedia({ dark: true });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    runThemeScript();
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
