// Sets the theme before first paint so there is no flash. Loaded as a blocking script from
// index.html; keep the key and colours in step with src/lib/theme.ts (theme.test.tsx checks it).
(() => {
  try {
    const saved = localStorage.getItem("kori.theme");
    const isDark =
      saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", isDark ? "#0E1022" : "#2F3A99");
  } catch {
    // Storage or matchMedia is unavailable: stay on the light default.
  }
})();
