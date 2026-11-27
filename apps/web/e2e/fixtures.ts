import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { test as base, expect, type Page } from "@playwright/test";

// The CI user is created by the e2e workflow (or by hand for `make e2e`). Test-only credentials.
export const EMAIL = process.env.E2E_EMAIL ?? "e2e@kori.local";
export const PASSWORD = process.env.E2E_PASSWORD ?? "e2e-test-password";

export const SIGNED_OUT_STATE = { cookies: [], origins: [] };

export async function logIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

// Waits until the page has stopped loading data, so a check never runs against skeletons.
export async function waitUntilSettled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-label^="Loading"]')).toHaveCount(0);
}

// One login per worker instead of one per test. `storageState` is overridden below, so a spec can
// still opt out with `test.use({ storageState: SIGNED_OUT_STATE })`.
export const test = base.extend<object, { signedInStatePath: string }>({
  signedInStatePath: [
    async ({ browser }, provide, workerInfo) => {
      const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL });
      await logIn(await context.newPage());
      // Outside test-results/ and playwright-report/: CI uploads those, and this file holds a session cookie.
      const statePath = path.join(mkdtempSync(path.join(tmpdir(), "kori-e2e-")), "signed-in.json");
      await context.storageState({ path: statePath });
      await context.close();
      await provide(statePath);
    },
    { scope: "worker" },
  ],
  storageState: async ({ signedInStatePath }, provide) => {
    await provide(signedInStatePath);
  },
});

export { expect };
