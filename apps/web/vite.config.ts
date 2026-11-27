import path from "node:path";

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults, defineConfig } from "vitest/config";

import { manifest } from "./src/pwa/manifest";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A waiting service worker shows an update toast; the Reload button activates it.
      registerType: "prompt",
      includeAssets: ["apple-touch-icon.png"],
      manifest,
      workbox: {
        // App shell only: no runtime caching, and /api is never answered by the shell.
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest,woff2}"],
        navigateFallbackDenylist: [/^\/api\//, /^\/internal\//],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    css: false,
    // Playwright specs under e2e/ run with `make e2e`, not Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
