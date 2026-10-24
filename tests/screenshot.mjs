/* Capture store-compliant screenshots (1280×800) of OpenAltKeys running
 * in a real Google Sheet. The URL must be the FULL sheet id — a truncated
 * id shows a "file not found" page (audit P0.4). */
import { chromium } from "playwright";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const EXT = join(ROOT, "..");
const PROFILE = join(EXT, ".oak-shot-profile"); // package-relative, portable
const OUT = join(ROOT, "..", "docs");
rmSync(PROFILE, { recursive: true, force: true });
const URL = "https://docs.google.com/spreadsheets/d/1U6Cf_qEOhiR9AZqTqS3mbMF3zt2db48ZP5v3rkrAEJY/edit";
// fallback: Gapminder's own maintained dataset
const URL_FALLBACK = "https://docs.google.com/spreadsheets/d/11qDjnPu2BlFFegwpPl3CcyZtfiYT4R2seU_IcIcJkHM/edit";

const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 800 }, // CWS screenshot size
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--lang=en-US",
  ],
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(13000);
if (page.url().includes("consent.")) {
  try { await page.click("button:has-text('Accept all')", { timeout: 5000 }); await page.waitForTimeout(8000); } catch {}
}
// fallback sheet if the primary went away
if (!/\/spreadsheets\/d\/.+\/edit/.test(page.url())) {
  console.log("primary sheet unavailable — falling back");
  await page.goto(URL_FALLBACK, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(13000);
}

await page.keyboard.press("Alt");
await page.waitForTimeout(700);
// hover the strip so the store shot shows the labels — the compact strip
// (v1.1.3) keeps them hidden until hover or keyboard focus
await page.hover("#oak-overlay-root .oak-bar").catch(() => {});
await page.waitForTimeout(250);
await page.screenshot({ path: join(OUT, "screenshot-tabs.png") });
console.log("saved screenshot-tabs.png");

await page.keyboard.press("H");
await page.waitForTimeout(600);
// move the pointer away: the panel shot shows the default compact strip
await page.mouse.move(10, 700);
await page.waitForTimeout(250);
await page.screenshot({ path: join(OUT, "screenshot-panel.png") });
console.log("saved screenshot-panel.png");
await page.keyboard.press("Escape");

await browser.close();
console.log("done");
