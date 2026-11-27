import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, SIGNED_OUT_STATE, test, waitUntilSettled } from "./fixtures";
import { DASHBOARD_DEFINITION_LIST, NOT_FOUND_NUMERAL_CONTRAST } from "./knownFindings";
import { ADD_BUTTON_NAME, LOGIN_ROUTE, SIGNED_IN_ROUTES } from "./routes";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);
const COLOR_SCHEMES = ["light", "dark"] as const;

interface KnownExemptions {
  skippedRules?: readonly string[];
  excludedSelector?: string;
}

async function expectNoBlockingViolations(
  page: Page,
  exemptions: KnownExemptions = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (exemptions.skippedRules) builder = builder.disableRules([...exemptions.skippedRules]);
  if (exemptions.excludedSelector) builder = builder.exclude(exemptions.excludedSelector);
  const { violations } = await builder.analyze();
  const blocking = violations
    .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""))
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
  expect(blocking).toEqual([]);
}

function knownExemptionsFor(path: string, colorScheme: string): KnownExemptions {
  if (path === DASHBOARD_DEFINITION_LIST.path) return DASHBOARD_DEFINITION_LIST;
  const isLightNotFound =
    path === NOT_FOUND_NUMERAL_CONTRAST.path &&
    colorScheme === NOT_FOUND_NUMERAL_CONTRAST.colorScheme;
  return isLightNotFound ? NOT_FOUND_NUMERAL_CONTRAST : {};
}

for (const colorScheme of COLOR_SCHEMES) {
  test.describe(`axe, ${colorScheme} theme`, () => {
    // Animations make contrast checks flaky: axe could sample a half-faded colour.
    test.use({ colorScheme, reducedMotion: "reduce" });

    test.describe("signed out", () => {
      test.use({ storageState: SIGNED_OUT_STATE });

      test(`${LOGIN_ROUTE.name} has no serious violations`, async ({ page }) => {
        await page.goto(LOGIN_ROUTE.path);
        await waitUntilSettled(page);
        await expectNoBlockingViolations(page);
      });
    });

    for (const route of SIGNED_IN_ROUTES) {
      test(`${route.name} has no serious violations`, async ({ page }) => {
        await page.goto(route.path);
        await waitUntilSettled(page);
        await expectNoBlockingViolations(page, knownExemptionsFor(route.path, colorScheme));
      });
    }

    test("the Add transaction sheet has no serious violations", async ({ page }) => {
      await page.goto("/dashboard");
      await waitUntilSettled(page);
      await page.getByRole("button", { name: ADD_BUTTON_NAME }).click();
      await expect(page.getByRole("dialog", { name: /^New (expense|income)$/ })).toBeVisible();
      await expectNoBlockingViolations(page);
    });

    test("the Filters sheet has no serious violations", async ({ page }) => {
      await page.goto("/transactions");
      await waitUntilSettled(page);
      await page.getByRole("button", { name: "Filters" }).click();
      await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
      await expectNoBlockingViolations(page);
    });

    test("the Budget sheet has no serious violations", async ({ page }) => {
      await page.goto("/budgets");
      await waitUntilSettled(page);
      // Every category offers "Set <name> budget" until it has one, so the first match opens the sheet.
      await page
        .getByRole("button", { name: /^Set .+ budget$/ })
        .first()
        .click();
      await expect(page.getByRole("dialog", { name: /budget$/ })).toBeVisible();
      await expectNoBlockingViolations(page);
    });
  });
}
