import type { Page } from "@playwright/test";

import { expect, SIGNED_OUT_STATE, test, waitUntilSettled } from "./fixtures";
import { KNOWN_FINDINGS } from "./knownFindings";
import { ADD_BUTTON_NAME, LOGIN_ROUTE, SIGNED_IN_ROUTES, VIEWPORTS } from "./routes";

const TABLET_WIDTH = 768;
const SCREENS_WITH_SIDEWAYS_SCROLL_AT_TABLET = new Set(["/dashboard", "/transactions"]);

async function hasSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`layout, ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.describe("signed out", () => {
      test.use({ storageState: SIGNED_OUT_STATE });

      test(`${LOGIN_ROUTE.name} does not scroll sideways`, async ({ page }) => {
        await page.goto(LOGIN_ROUTE.path);
        await waitUntilSettled(page);
        expect(await hasSidewaysScroll(page)).toBe(false);
      });
    });

    for (const route of SIGNED_IN_ROUTES) {
      test(`${route.name} does not scroll sideways`, async ({ page }) => {
        test.fail(
          viewport.width === TABLET_WIDTH && SCREENS_WITH_SIDEWAYS_SCROLL_AT_TABLET.has(route.path),
          `${KNOWN_FINDINGS.sidewaysScrollAtTablet}: this screen is wider than the viewport`,
        );
        await page.goto(route.path);
        await waitUntilSettled(page);
        expect(await hasSidewaysScroll(page)).toBe(false);
      });
    }

    test("the Add sheet's Save button is visible without scrolling", async ({ page }) => {
      await page.goto("/dashboard");
      await waitUntilSettled(page);
      await page.getByRole("button", { name: ADD_BUTTON_NAME }).click();
      const sheet = page.getByRole("dialog", { name: /^New (expense|income)$/ });
      await expect(sheet).toBeVisible();

      const box = await sheet.getByRole("button", { name: /^Save/ }).boundingBox();
      expect(box).not.toBeNull();
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    });
  });
}

test("every screen has a title, and no two screens share one", async ({ page, browser }) => {
  const titles = new Map<string, string>();

  const signedOut = await browser.newContext({
    storageState: SIGNED_OUT_STATE,
    baseURL: test.info().project.use.baseURL,
  });
  const loginPage = await signedOut.newPage();
  await loginPage.goto(LOGIN_ROUTE.path);
  titles.set(LOGIN_ROUTE.name, await loginPage.title());
  await signedOut.close();

  for (const route of SIGNED_IN_ROUTES) {
    await page.goto(route.path);
    await waitUntilSettled(page);
    titles.set(route.name, await page.title());
  }

  const allTitles = [...titles.values()];
  expect(allTitles.filter((title) => title.trim() === "")).toEqual([]);
  expect(new Set(allTitles).size).toBe(allTitles.length);
});
