/**
 * Generates the README media in docs/media/ from SEED DATA ONLY. Never point it at real data.
 *
 * Reproduce on a clean stack:
 *   make up                      # app + Postgres at http://localhost:8000
 *   make seed                    # demo@kori.local, six months of fake spending (prompts for a password)
 *   cd apps/web && pnpm exec playwright install chromium     # once
 *   SHOT_PASSWORD=<the demo password> pnpm screenshots
 * (CHROMIUM_PATH points at another Chromium binary, if you have one instead of the Playwright download.)
 *
 * Output:
 *   docs/media/*.png             phone screenshots (Pixel 7, light)
 *   docs/media/log-expense.gif   logging an expense and seeing it on the dashboard
 *
 * The GIF is stitched from screenshot frames with ffmpeg (needs `ffmpeg` on PATH); the exact command
 * is in `makeGif` below. Run `oxipng -o4 --strip safe docs/media/*.png` afterwards to shrink the
 * PNGs. The script refuses to run unless it targets demo@kori.local on localhost (override with
 * SHOT_I_KNOW_THIS_IS_DEMO=1 for a throwaway demo server). It sets demo budgets and three demo
 * recurring rules through the API, so the
 * budgets and recurring pages have something to show. It touches only the demo user.
 *
 * Runs on Node 22+ without a build step: `node --experimental-strip-types e2e/screenshots.ts`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices, type BrowserContext, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8000";
const EMAIL = process.env.SHOT_EMAIL ?? "demo@kori.local";
const PASSWORD = process.env.SHOT_PASSWORD;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/media");

if (!PASSWORD) {
  throw new Error("Set SHOT_PASSWORD to the demo user's password (see the header of this file).");
}

// Safety guard: this script replaces the user's budgets and deletes all their recurring rules, and
// it adds transactions. Only ever run it against a local demo stack, never real data.
const isLocal = ["localhost", "127.0.0.1"].includes(new URL(BASE).hostname);
if (!(EMAIL === "demo@kori.local" && isLocal) && process.env.SHOT_I_KNOW_THIS_IS_DEMO !== "1") {
  throw new Error(
    `Refusing to run: it needs SHOT_EMAIL=demo@kori.local on localhost (got ${EMAIL} at ${BASE}). ` +
      "It overwrites budgets and deletes recurring rules. Set SHOT_I_KNOW_THIS_IS_DEMO=1 only for a throwaway demo server.",
  );
}

const phone = devices["Pixel 7"];

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
}

async function api<T>(page: Page, method: string, url: string, data?: unknown): Promise<T> {
  // Unsafe methods need a JSON body and a matching Origin (CSRF defence).
  const res = await page.request.fetch(`${BASE}/api/v1${url}`, {
    method,
    data,
    headers: { Origin: BASE },
  });
  if (!res.ok()) throw new Error(`${method} ${url} -> ${res.status()} ${await res.text()}`);
  return res.status() === 204 ? (undefined as T) : ((await res.json()) as T);
}

interface Category {
  id: string;
  name: string;
  kind: string;
}

/** Two demo budgets and three demo recurring rules, so those pages are not empty. */
async function seedPlans(page: Page): Promise<void> {
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const cats = await api<Category[] | { items: Category[] }>(page, "GET", "/categories");
  const list = Array.isArray(cats) ? cats : cats.items;
  const id = (name: string) => {
    const found = list.find((c) => c.name === name);
    if (!found) throw new Error(`Category not found: ${name}`);
    return found.id;
  };

  await api(page, "PUT", "/budgets", { month, category_id: null, amount: "110000.00" });
  await api(page, "PUT", "/budgets", {
    month,
    category_id: id("Food & Dining"),
    amount: "14000.00",
  });
  await api(page, "PUT", "/budgets", { month, category_id: id("Transport"), amount: "9000.00" });
  await api(page, "PUT", "/budgets", {
    month,
    category_id: id("Groceries & Bazar"),
    amount: "32000.00",
  });

  const existing = await api<{ id: string }[] | { items: { id: string }[] }>(
    page,
    "GET",
    "/recurring-rules",
  );
  for (const rule of Array.isArray(existing) ? existing : existing.items) {
    await api(page, "DELETE", `/recurring-rules/${rule.id}`);
  }
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const first = new Date(today.getFullYear(), today.getMonth() + 1, 1, 12);
  const fri = new Date(today);
  fri.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
  const rules = [
    {
      name: "Rent",
      type: "expense",
      amount: "25000.00",
      category: "Rent",
      frequency: "monthly",
      start: first,
    },
    {
      name: "Salary",
      type: "income",
      amount: "120000.00",
      category: "Salary",
      frequency: "monthly",
      start: first,
    },
    {
      name: "Friday bazar",
      type: "expense",
      amount: "2500.00",
      category: "Groceries & Bazar",
      frequency: "weekly",
      start: fri,
    },
  ];
  for (const r of rules) {
    await api(page, "POST", "/recurring-rules", {
      name: r.name,
      type: r.type,
      amount: r.amount,
      category_id: id(r.category),
      frequency: r.frequency,
      interval: 1,
      start_on: iso(r.start),
    });
  }
}

/** A demo split: one shop, two categories. */
async function addSplitBazar(page: Page): Promise<void> {
  const list = await api<Category[] | { items: Category[] }>(page, "GET", "/categories");
  const cats = Array.isArray(list) ? list : list.items;
  const id = (name: string) => cats.find((c) => c.name === name)!.id;
  await api(page, "POST", "/transactions", {
    type: "expense",
    amount: "3800.00",
    occurred_on: new Date().toISOString().slice(0, 10),
    merchant: "Shwapno",
    lines: [
      { category_id: id("Groceries & Bazar"), amount: "2600.00" },
      { category_id: id("Shopping"), amount: "1200.00" },
    ],
  });
}

async function shoot(page: Page, file: string): Promise<void> {
  // Let fonts, charts and entry animations settle.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log(`wrote docs/media/${file}`);
}

async function screenshots(): Promise<void> {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const context = await browser.newContext({
    ...phone,
    baseURL: BASE,
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await login(page);
  await seedPlans(page);

  await page.goto("/dashboard");
  await shoot(page, "dashboard.png");

  await page.goto("/budgets");
  await page.getByRole("heading", { name: "Budgets" }).waitFor();
  await shoot(page, "budgets.png");

  await page.goto("/transactions");
  await page.getByRole("heading", { name: "Transactions" }).waitFor();
  const splits = page.getByRole("button", { name: /Split · \d categories/ });
  if ((await splits.count()) === 0) {
    // The seed puts splits on Fridays, so a month may have none yet. Add one bazar run.
    await addSplitBazar(page);
    await page.reload();
  }
  await splits.first().waitFor();
  await shoot(page, "transactions.png");

  // The form with a split: open the first split transaction.
  await page
    .getByRole("button", { name: /Split · \d categories/ })
    .first()
    .click();
  await page.getByRole("dialog", { name: "Edit transaction" }).waitFor();
  await page.getByRole("heading", { name: "Edit transaction" }).click(); // deselect the amount
  await shoot(page, "split-form.png");
  await page.keyboard.press("Escape");

  await page.goto("/settings/recurring");
  await page.getByText("Friday bazar").first().waitFor();
  await shoot(page, "recurring.png");

  await browser.close();
}

/**
 * The GIF is a sequence of screenshots taken while the script logs an expense, stitched by ffmpeg
 * (Playwright's own video recorder needs a bundled ffmpeg build that is not always installable).
 * Equivalent shell command, for frames/f%04d.png captured at about 10 per second:
 *   ffmpeg -framerate 10 -i frames/f%04d.png -vf "scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" docs/media/log-expense.gif
 */
function makeGif(framesDir: string, gif: string): void {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      "10",
      "-i",
      path.join(framesDir, "f%04d.png"),
      "-vf",
      "scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
      gif,
    ],
    { stdio: "inherit" },
  );
}

async function recordGif(): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), "kori-frames-"));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const context: BrowserContext = await browser.newContext({
    ...phone,
    baseURL: BASE,
    colorScheme: "light",
  });
  const page = await context.newPage();
  await login(page);

  // Capture a frame every ~100 ms in the background while the steps below run.
  let n = 0;
  let recording = true;
  const capture = (async () => {
    while (recording) {
      n += 1;
      await page.screenshot({ path: path.join(dir, `f${String(n).padStart(4, "0")}.png`) });
      await page.waitForTimeout(40);
    }
  })();

  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Add transaction" }).click();
  const sheet = page.getByRole("dialog", { name: "Add transaction" });
  await sheet.getByLabel("Amount (৳)").pressSequentially("180", { delay: 250 });
  await sheet.getByRole("radio", { name: "Food & Dining" }).click();
  await sheet.getByLabel("Merchant").pressSequentially("Coffee World", { delay: 90 });
  await page.waitForTimeout(500);
  await sheet.getByRole("button", { name: "Save" }).click();
  await sheet.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: /Coffee World/ })
    .first()
    .waitFor();
  await page.waitForTimeout(1800);

  recording = false;
  await capture;
  await browser.close();
  makeGif(dir, path.join(OUT, "log-expense.gif"));
  console.log("wrote docs/media/log-expense.gif");
  rmSync(dir, { recursive: true, force: true });
}

mkdirSync(OUT, { recursive: true });
await screenshots();
await recordGif();
