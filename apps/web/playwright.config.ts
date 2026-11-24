import { defineConfig, devices } from "@playwright/test";

// The smoke test runs against a real stack (`make up`, http://localhost:8000), not the Vite dev server.
// Chromium only: WebKit needs extra system packages and a second browser download in CI, and it
// could not be proven stable for this card. Add an iPhone project once it can be.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8000",
    // Traces only when a test fails and is retried; the workflow uploads them only on failure.
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium-pixel-7", use: { ...devices["Pixel 7"] } }],
});
