/*
 * OpenAltKeys — end-to-end command battery against a functional mock
 * spreadsheet (tests/mock-sheet.html). Verifies REAL command effects:
 * bold, autosum, autofit, trace precedents, goal seek, symbols.
 * All paths are relative to the package — runs straight out of the ZIP.
 *
 * Run: node tests/integration.mocksheet.mjs
 * (Linux without a display: xvfb-run node tests/integration.mocksheet.mjs)
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const EXT_SRC = join(ROOT, "..");
// Test copy + profile live INSIDE the package as dot-dirs, so the suite
// is portable (no absolute paths) and never ships in the release ZIPs.
const EXT_TEST = join(EXT_SRC, ".oak-test2-extension");
const PROFILE = join(EXT_SRC, ".oak-test2-profile");
const OUT_DIR = join(EXT_SRC, "tests-output");
const PORT = 8902;

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log("  ✓ " + m); } else { failed++; console.error("  ✗ FAIL: " + m); } };

// ---- build test copy of the extension (only what the extension needs,
// so a node_modules/ from `npm install` is never copied in)
rmSync(EXT_TEST, { recursive: true, force: true });
rmSync(PROFILE, { recursive: true, force: true });
for (const item of ["manifest.json", "src", "icons"]) {
  cpSync(join(EXT_SRC, item), join(EXT_TEST, item), { recursive: true });
}

const manifest = JSON.parse(readFileSync(join(EXT_TEST, "manifest.json"), "utf8"));
for (const cs of manifest.content_scripts) cs.matches.push(`http://localhost:${PORT}/*`);
manifest.content_scripts = [manifest.content_scripts[0]];
writeFileSync(join(EXT_TEST, "manifest.json"), JSON.stringify(manifest, null, 2));

let appJs = readFileSync(join(EXT_TEST, "src/content/app.js"), "utf8");
appJs = appJs.replace(
  'if (/docs\\.google\\.com\\/spreadsheets\\//.test(loc)) app = "sheets";',
  'if (/docs\\.google\\.com\\/spreadsheets\\//.test(loc) || /localhost/.test(loc)) app = "sheets";'
);
// Seed a user-disabled sequence for the B9 regression (re-audit 2.1).
// Must happen here — the content script's world is isolated, so
// page.evaluate can't reach OAKEngine.updateSettings from the page.
appJs = appJs.replace('disabledSeqs: "",', 'disabledSeqs: "HV",');
writeFileSync(join(EXT_TEST, "src/content/app.js"), appJs);

const html = readFileSync(join(ROOT, "mock-sheet.html"), "utf8");
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(html);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT_TEST}`,
    `--load-extension=${EXT_TEST}`,
    "--no-sandbox", "--disable-gpu", "--window-size=1280,900",
  ],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(600);

const state = () => page.evaluate(() => window.__state);
const type = async (keys) => { for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(140); } };
const clickCell = async (ref) => { await page.click(`td[data-ref='${ref}']`); await page.waitForTimeout(80); };

try {
  /* ---- B1: Alt H 1 → Bold ---- */
  await clickCell("B2");
  await type(["Alt", "H", "1"]);
  await page.waitForTimeout(250);
  let st = await state();
  ok(st.cells.B2 && st.cells.B2.bold === true, "B1: Alt H 1 bolded B2");

  /* ---- B2: Alt = → AutoSum ---- */
  await clickCell("A4");
  await type(["Alt", "="]);
  await page.waitForTimeout(700);
  st = await state();
  ok(st.cells.A4 && st.cells.A4.raw === "=SUM(A1:A3)", "B2: Alt = inserted =SUM(A1:A3)");
  const a4disp = await page.evaluate(() => document.querySelector("td[data-ref='A4']").textContent);
  ok(a4disp === "60", `B2: AutoSum computed 60 (got ${a4disp})`);

  /* ---- B3: Alt H O I → AutoFit column ---- */
  await clickCell("C2");
  await type(["Alt", "H", "O", "I"]);
  await page.waitForTimeout(900);
  st = await state();
  ok(st.colWidth.C > 0, `B3: Alt H O I set column C width (${st.colWidth.C}px)`);
  ok(st.events.some((e) => e.startsWith("resize-fit")), "B3: fit-to-data dialog driven");

  /* ---- B4: Alt M P → Trace Precedents ---- */
  await clickCell("D2"); // =SUM(A1:A3)*2
  await type(["Alt", "M", "P"]);
  await page.waitForTimeout(300);
  const listPanel = await page.$("#oak-overlay-root .oak-list");
  ok(!!listPanel, "B4: Alt M P opened the precedents list");
  const listText = (await page.textContent("#oak-overlay-root")) || "";
  ok(listText.includes("A1:A3"), "B4: list shows the A1:A3 range");
  // click the range row → navigates
  await page.click("#oak-overlay-root .oak-row:has-text('A1:A3')");
  await page.waitForTimeout(600);
  st = await state();
  ok(st.selA === "A1" && st.selB === "A3", `B4: clicking A1:A3 selected it (${st.selA}:${st.selB})`);

  /* ---- B5: Alt M P on a text cell → polite toast, no panel ---- */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await clickCell("B1"); // "Price"
  await type(["Alt", "M", "P"]);
  await page.waitForTimeout(250);
  ok(!(await page.$("#oak-overlay-root .oak-list")), "B5: no panel for a non-formula cell");
  const toast5 = await page.textContent("#oak-toast").catch(() => "");
  ok(/no formula/i.test(toast5 || ""), "B5: helpful toast shown");

  /* ---- B6: Alt A W G → Goal Seek ---- */
  await clickCell("C2"); // =B2*2, B2=25 → 50; goal 100 → B2=50
  await type(["Alt", "A", "W", "G"]);
  await page.waitForTimeout(300);
  ok(!!(await page.$("#oak-overlay-root .oak-form")), "B6: Alt A W G opened the Goal Seek form");
  const setInput = async (i, val) =>
    page.fill(`#oak-overlay-root .oak-form input >> nth=${i}`, val);
  ok((await page.inputValue("#oak-overlay-root input")) === "C2", "B6: Set cell prefilled with C2");
  await setInput(1, "100");
  await setInput(2, "B2");
  await page.click("#oak-overlay-root .oak-btn.primary");
  // Wait for the SOLVED toast — the solver's last action — so the background
  // writeback is guaranteed finished before the next scenario.
  let solvedToast = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500);
    const t = await page.textContent("#oak-toast").catch(() => "");
    if (/Solved|failed/i.test(t || "")) { solvedToast = t; break; }
  }
  await page.waitForTimeout(400); // form hides right after the toast
  st = await state();
  ok(/Solved/i.test(solvedToast || ""), `B6: solver finished ("${(solvedToast || "").slice(0, 50)}")`);
  ok(st.cells.B2 && Math.abs(parseFloat(st.cells.B2.raw) - 50) < 0.01,
    `B6: Goal Seek set B2 = ${st.cells.B2 && st.cells.B2.raw} (target 50)`);
  const c2disp = await page.evaluate(() => document.querySelector("td[data-ref='C2']").textContent);
  ok(c2disp === "100" || parseFloat(c2disp) === 100, `B6: C2 now displays 100 (got ${c2disp})`);

  /* ---- B7: Alt N U → Symbol palette ---- */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await clickCell("E5");
  await type(["Alt", "N", "U"]);
  await page.waitForTimeout(300);
  ok(!!(await page.$("#oak-overlay-root .oak-list")), "B7: Alt N U opened the symbol palette");
  await page.click("#oak-overlay-root .oak-row:has-text('€')");
  await page.waitForTimeout(400);
  st = await state();
  ok(st.cells.E5 && st.cells.E5.raw === "€", `B7: € typed into E5 (got ${JSON.stringify(st.cells.E5 && st.cells.E5.raw)})`);

  /* ---- B9: user-disabled sequence is ignored — no stray keystroke ---- */
  // The test build seeds disabledSeqs "HV" (app.js patch above), so
  // Alt H V must be swallowed whole: nothing typed, tips closed.
  // Re-audit 2.1: the completing key used to leak into the grid and
  // start editing the cell with "V" pre-filled. The control uses
  // Alt H 1 — a different Home branch that is NOT disabled.
  // (Escape first: B7's symbol palette still owns the overlay, and the
  // engine never opens the ribbon tips on top of an extras panel.)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(!(await page.$("#oak-overlay-root")), "B9: B7's palette closed before the scenario");
  await clickCell("B4");
  await type(["Alt", "H", "V"]);
  await page.waitForTimeout(300);
  st = await state();
  ok(st.editing === null,
    `B9: disabled Alt H V did not start editing (got ${JSON.stringify(st.editing)})`);
  ok(!(st.cells.B4 && st.cells.B4.raw === "V"),
    `B9: no stray "V" typed into B4 (got ${JSON.stringify(st.cells.B4 && st.cells.B4.raw)})`);
  ok(!(await page.$("#oak-overlay-root")), "B9: tips closed after the ignored sequence");
  await type(["Alt", "H", "1"]);
  await page.waitForTimeout(250);
  st = await state();
  ok(st.cells.B4 && st.cells.B4.bold === true, "B9: control — Alt H 1 (not disabled) still works");

  /* ---- B8: Esc hygiene + no errors ---- */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(!(await page.$("#oak-overlay-root")), "B8: Esc closed everything");
  const realErrors = errors.filter((e) => !/ResizeObserver/.test(e));
  ok(realErrors.length === 0, "B8: no page errors across the whole battery");
  if (realErrors.length) console.log("     " + realErrors.slice(0, 3).join("\n     "));

  /* screenshot for the report (kept outside the shipped tree) */
  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: join(OUT_DIR, "mocksheet-after-battery.png") });
} catch (e) {
  console.error("FATAL:", e.message);
  failed++;
}

console.log(`\nMock-sheet integration result: ${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
