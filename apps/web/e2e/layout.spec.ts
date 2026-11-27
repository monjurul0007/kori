import type { Page } from "@playwright/test";

import { expect, SIGNED_OUT_STATE, test, waitUntilSettled } from "./fixtures";
import { TABLET_OVERFLOW } from "./knownFindings";
import { ADD_BUTTON_NAME, LOGIN_ROUTE, SIGNED_IN_ROUTES, VIEWPORTS } from "./routes";

/** How many pixels the page is wider than the viewport; 0 means it does not scroll sideways. */
async function sidewaysExcessPixels(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  );
}

function allowedExcessPixels(path: string, viewportWidth: number): number {
  if (viewportWidth !== TABLET_OVERFLOW.viewportWidth) return 0;
  return TABLET_OVERFLOW.maxExcessPixelsByPath[path] ?? 0;
}

for (const viewport of VIEWPORTS) {
  test.describe(`layout, ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.describe("signed out", () => {
      test.use({ storageState: SIGNED_OUT_STATE });

      test(`${LOGIN_ROUTE.name} does not scroll sideways`, async ({ page }) => {
        await page.goto(LOGIN_ROUTE.path);
        await waitUntilSettled(page);
        expect(await sidewaysExcessPixels(page)).toBe(0);
      });
    });

    for (const route of SIGNED_IN_ROUTES) {
      test(`${route.name} does not scroll sideways`, async ({ page }) => {
        await page.goto(route.path);
        await waitUntilSettled(page);
        expect(await sidewaysExcessPixels(page)).toBeLessThanOrEqual(
          allowedExcessPixels(route.path, viewport.width),
        );
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
  await waitUntilSettled(loginPage);
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
