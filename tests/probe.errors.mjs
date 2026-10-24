/* Isolate which step triggers Google's "czd" page error, with stack traces. */
import { chromium } from "playwright";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const EXT = join(ROOT, "..");
const PROFILE = join(EXT, ".oak-probe-profile"); // package-relative, portable
rmSync(PROFILE, { recursive: true, force: true });
const URL = "https://docs.google.com/spreadsheets/d/1ZBY9j3ztNZhVM7_qR4ElHSePpQxlG6XKN3XmY6AB/edit";

const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--lang=en-US",
  ],
});
const page = await browser.newPage();
page.on("pageerror", (e) => {
  console.log("PAGEERROR:", e.message);
  console.log("STACK:", (e.stack || "").split("\n").slice(0, 6).join("\n"));
  console.log("---");
});
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(14000);

const step = async (name, fn) => {
  const before = errCount;
  await fn();
  await page.waitForTimeout(900);
  console.log(`after ${name}: errors so far = ${errCount}`);
};
let errCount = 0;
page.on("pageerror", () => errCount++);

await step("Alt (overlay)", () => page.keyboard.press("Alt"));
await step("H (panel)", () => page.keyboard.press("H"));
await step("V (paste submenu)", () => page.keyboard.press("V"));
await step("V (paste values = ctrl+shift+v)", () => page.keyboard.press("V"));
await page.waitForTimeout(1200);
await step("Alt again", () => page.keyboard.press("Alt"));
await step("H", () => page.keyboard.press("H"));
await step("I (insert group)", () => page.keyboard.press("I"));
await step("R (insert rows = ctrl+alt+=)", () => page.keyboard.press("R"));
await page.keyboard.press("Escape");

console.log("\nfinal error count:", errCount);
await browser.close();
