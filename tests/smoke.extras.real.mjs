/* Real (view-only) Google Sheet smoke test for the new extras features */
import { chromium } from "playwright";
import { rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const EXT = join(ROOT, "..");          // package root — portable, no absolute paths
const PROFILE = join(EXT, ".oak-extras-smoke");
const OUT_DIR = join(EXT, "tests-output");
// Public, view-only, third-party-maintained sheets (googlesheets4 example + Gapminder)
const SHEET_URLS = [
  "https://docs.google.com/spreadsheets/d/1U6Cf_qEOhiR9AZqTqS3mbMF3zt2db48ZP5v3rkrAEJY/edit",
  "https://docs.google.com/spreadsheets/d/11qDjnPu2BlFFegwpPl3CcyZtfiYT4R2seU_IcIcJkHM/edit",
];
const SHEET_URL = SHEET_URLS[0];
rmSync(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
    "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--window-size=1400,950", "--lang=en-US"],
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log("  ✓ " + m); } else { failed++; console.error("  ✗ FAIL: " + m); } };

await page.goto(SHEET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(12000);
if (page.url().includes("consent.")) {
  try { await page.click("button:has-text('Accept all')", { timeout: 5000 }); await page.waitForTimeout(8000); } catch {}
}
// Environment gate: public sheet unavailable → SKIP, not false-fail
if (!/\/spreadsheets\/d\/.+\/edit/.test(page.url())) {
  console.log("⚠ SKIP: no public test sheet reachable right now (environment issue, not a code failure)");
  console.log(`\nReal-sheet extras smoke: 0 passed, 0 failed, 8 skipped`);
  await ctx.close();
  process.exit(0);
}

const type = async (keys) => { for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(180); } };

try {
  // S1: Alt M P panel opens on the real sheet (formula cell or polite toast)
  await type(["Alt", "M", "P"]);
  await page.waitForTimeout(500);
  const toastOrPanel = await page.evaluate(() => ({
    panel: !!document.querySelector("#oak-overlay-root .oak-list"),
    toast: (document.getElementById("oak-toast") || {}).textContent || "",
  }));
  ok(toastOrPanel.panel || /formula|Select/i.test(toastOrPanel.toast),
    `S1: Alt M P responded gracefully (panel=${toastOrPanel.panel}, toast="${toastOrPanel.toast.slice(0, 40)}")`);
  await page.keyboard.press("Escape");

  // S2: Alt A W G form opens on the real sheet
  await type(["Alt", "A", "W", "G"]);
  await page.waitForTimeout(400);
  const form = await page.$("#oak-overlay-root .oak-form");
  ok(!!form, "S2: Alt A W G opened the Goal Seek form on real Google Sheets");
  if (form) {
    const prefill = await page.inputValue("#oak-overlay-root input").catch(() => "");
    console.log(`     set-cell prefill: "${prefill}"`);
    await page.click("#oak-overlay-root .oak-btn.plain"); // Cancel
    await page.waitForTimeout(250);
  }
  ok(!(await page.$("#oak-overlay-root")), "S2: Cancel closed the form");

  // S3: Alt N U palette opens; Esc closes
  await type(["Alt", "N", "U"]);
  await page.waitForTimeout(400);
  const pal = await page.$("#oak-overlay-root .oak-list");
  ok(!!pal, "S3: Alt N U opened the symbol palette on real Google Sheets");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok(!(await page.$("#oak-overlay-root")), "S3: Esc closed the palette");

  // S4: Alt M D — opens Find & Replace prefilled (or explains)
  await type(["Alt", "M", "D"]);
  await page.waitForTimeout(700);
  const findState = await page.evaluate(() => {
    const input = document.querySelector("#docs-findinput") ||
      document.querySelector("input[aria-label*='find' i]") ||
      document.querySelector(".docs-modalinputcontainer input");
    return { dialog: !!document.querySelector(".docs-dialog, [role='dialog']"), value: input ? input.value : null };
  });
  ok(findState.dialog || findState.value !== null,
    `S4: Find & Replace path exercised (dialog=${findState.dialog}, prefilled=${JSON.stringify(findState.value)})`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // S5: Alt M A A closes cleanly
  await type(["Alt", "M", "A", "A"]);
  await page.waitForTimeout(300);
  ok(!(await page.$("#oak-overlay-root")), "S5: Alt M A A clean close");

  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: join(OUT_DIR, "realsheet-extras-smoke.png") });
  // czd/Exd & friends are benign Google-internal errors on VIEW-ONLY sheets
  // (control run without the extension produced the same — see worklog).
  const realErrors = errors.filter((e) => !/^(czd|Exd|[A-Za-z]{1,4}d):?/.test(e) && !/ResizeObserver|onload|favicon|network|chunk|ERR_/.test(e));
  ok(realErrors.length === 0, `S6: no page errors (${realErrors.length})`);
  if (realErrors.length) console.log("     " + realErrors.slice(0, 3).join("\n     "));
} catch (e) {
  console.error("FATAL:", e.message);
  failed++;
}
console.log(`\nReal-sheet extras smoke: ${passed} passed, ${failed} failed`);
await ctx.close();
process.exit(failed ? 1 : 0);
