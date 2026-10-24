/* Control run: same public Google Sheet WITHOUT the extension.
   If the same "czd" page error appears, it comes from Google, not OpenAltKeys. */
import { chromium } from "playwright";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROFILE = join(ROOT, "..", ".oak-ctl-profile"); // package-relative, portable
rmSync(PROFILE, { recursive: true, force: true });
const URL = "https://docs.google.com/spreadsheets/d/1ZBY9j3ztNZhVM7_qR4ElHSePpQxlG6XKN3XmY6AB/edit";

const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--lang=en-US"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(14000);
console.log("control (no extension) page errors:", JSON.stringify(errors));
await browser.close();
