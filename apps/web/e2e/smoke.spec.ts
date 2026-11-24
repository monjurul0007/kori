import { expect, test } from "@playwright/test";

// The CI user is created by the e2e workflow (or by hand for `make e2e`). Test-only credentials.
const EMAIL = process.env.E2E_EMAIL ?? "e2e@kori.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "e2e-test-password";

test("log in, add an expense and see it on the dashboard", async ({ page }) => {
  // A unique merchant per run, so a rerun against the same database never collides.
  const merchant = `E2E lunch ${process.env.GITHUB_RUN_ID ?? Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  const sheet = page.getByRole("dialog", { name: "Add transaction" });
  await sheet.getByLabel("Amount (৳)").fill("250");
  await sheet.getByRole("radio", { name: "Food & Dining" }).click();
  await sheet.getByLabel("Merchant").fill(merchant);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();

  // The dashboard refetches after the save: the row is in Recent transactions...
  const row = page.getByRole("button", { name: new RegExp(merchant) });
  await expect(row).toContainText("৳250");

  // ...and the month's spent total includes it. Whole taka only: no floats for money.
  const donut = page.getByRole("img", { name: /Spending by category, total ৳/ });
  await expect(donut).toBeVisible();
  const label = (await donut.getAttribute("aria-label")) ?? "";
  const whole = /total ৳([\d,]+)/.exec(label)?.[1] ?? "";
  expect(BigInt(whole.replaceAll(",", "") || "0")).toBeGreaterThanOrEqual(250n);
});
