// Renders the PNG app icons from the SVG sources with Playwright's Chromium.
// Usage (from apps/web): node scripts/build-icons.mjs  (set CHROME=/path/to/chromium to use another browser)
// Sources: public/icon.svg (a copy of docs/brand/kori-logo-coin-k.svg) and
// docs/brand/kori-logo-coin-k-maskable.svg. Outputs go to public/.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.resolve(root, "../../docs/brand");

const jobs = [
  { svg: path.join(brand, "kori-logo-coin-k.svg"), size: 192, out: "icon-192.png" },
  { svg: path.join(brand, "kori-logo-coin-k.svg"), size: 512, out: "icon-512.png" },
  {
    svg: path.join(brand, "kori-logo-coin-k-maskable.svg"),
    size: 512,
    out: "icon-maskable-512.png",
  },
  {
    svg: path.join(brand, "kori-logo-coin-k.svg"),
    size: 180,
    out: "apple-touch-icon.png",
    flatten: true,
  },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
try {
  for (const { svg, size, out, flatten } of jobs) {
    const markup = (await readFile(svg, "utf8")).replace(/<\?xml[^>]*\?>/, "");
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    // iOS fills transparent corners with black, so the touch icon is a full-bleed tile.
    const body = flatten ? markup.replace(/rx="30"/, "") : markup;
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${body}`,
    );
    const png = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await writeFile(path.join(root, "public", out), png);
    await page.close();
    console.log(`public/${out} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
