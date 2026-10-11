import path from "node:path";

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const THEME_COLOR = "#0c6e51"; // hsl(var(--primary)) in index.css

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The service worker re-checks for a new version on every page load and activates it.
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Kori",
        short_name: "Kori",
        description: "Personal expense and budget tracker",
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        display: "standalone",
        start_url: "/transactions",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // App shell only: no runtime caching, and /api is never answered by the shell.
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallbackDenylist: [/^\/api\//],
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
  },
});
