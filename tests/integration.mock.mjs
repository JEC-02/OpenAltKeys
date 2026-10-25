/*
 * OpenAltKeys — browser integration test against a mock editor page.
 * Loads a test copy of the extension (manifest patched to run on
 * http://localhost:8901 and app.js patched to treat it as "sheets").
 * All paths are relative to the package — runs straight out of the ZIP.
 *
 * Run: node tests/integration.mock.mjs
 * (Linux without a display: xvfb-run node tests/integration.mock.mjs)
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
const EXT_TEST = join(EXT_SRC, ".oak-test-extension");
const PROFILE = join(EXT_SRC, ".oak-test-profile");
const PORT = 8901;

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log("  ✓ " + m); } else { failed++; console.error("  ✗ FAIL: " + m); } };

// ---- build test copy of the extension (only what the extension needs,
// so a node_modules/ from `npm install` is never copied in)
rmSync(EXT_TEST, { recursive: true, force: true });
rmSync(PROFILE, { recursive: true, force: true });
for (const item of ["manifest.json", "src", "icons"]) {
  cpSync(join(EXT_SRC, item), join(EXT_TEST, item), { recursive: true });
}

// 1) manifest: run content scripts on localhost too
const manifest = JSON.parse(readFileSync(join(EXT_TEST, "manifest.json"), "utf8"));
for (const cs of manifest.content_scripts) {
  cs.matches.push(`http://localhost:${PORT}/*`);
}
manifest.content_scripts = [manifest.content_scripts[0]]; // sheets set (data/sheets.js)
writeFileSync(join(EXT_TEST, "manifest.json"), JSON.stringify(manifest, null, 2));

// 2) app.js: treat localhost as sheets
let appJs = readFileSync(join(EXT_TEST, "src/content/app.js"), "utf8");
appJs = appJs.replace(
  'if (/docs\\.google\\.com\\/spreadsheets\\//.test(loc)) app = "sheets";',
  'if (/docs\\.google\\.com\\/spreadsheets\\//.test(loc) || /localhost/.test(loc)) app = "sheets";'
);
// Seed user-disabled sequences for T14 (v1.1.2 re-audit 3.1). "AW"
// (menu branch: Data ▸ Forecast) and "ASA" (leaf: Sort Ascending) are
// unused by T1–T13 — unlike "HV", which T3/T5 rely on. The content
// script's world is isolated, so page.evaluate can't reach the engine.
appJs = appJs.replace('disabledSeqs: "",', 'disabledSeqs: "AW,ASA",');
writeFileSync(join(EXT_TEST, "src/content/app.js"), appJs);

// ---- static server for the mock page
const html = readFileSync(join(ROOT, "mock-editor.html"), "utf8");
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(html);
});
await new Promise((r) => server.listen(PORT, r));

// ---- launch Chromium with the extension
const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT_TEST}`,
    `--load-extension=${EXT_TEST}`,
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1280,900",
  ],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(600);

const overlayRoot = () => page.$("#oak-overlay-root");

// ---- T1: bare Alt opens the key-tips
await page.keyboard.press("Alt");
await page.waitForTimeout(250);
ok(await overlayRoot(), "T1: Alt shows the key-tip overlay");
ok(await page.$("#oak-overlay-root .oak-bar"), "T1: ribbon strip rendered");

// ---- T2: Esc closes
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
ok(!(await overlayRoot()), "T2: Esc closes the overlay");

// ---- T3: typing HVV dispatches ctrl+shift+v
await page.evaluate(() => (window.__events = []));
await page.keyboard.press("Alt");
await page.keyboard.press("H");
await page.waitForTimeout(120);
ok(await page.$("#oak-overlay-root .oak-panel"), "T3a: panel mode after first letter");
await page.keyboard.press("V");
await page.waitForTimeout(120);
await page.keyboard.press("V");
await page.waitForTimeout(300);
const ev3 = await page.evaluate(() => window.__events);
ok(ev3.some((e) => e.includes("shift") && e.toLowerCase().includes("ctrl") && e.includes("v")), "T3b: Alt H V V dispatched ctrl+shift+v → " + ev3.join(" | "));
ok(!(await overlayRoot()), "T3c: overlay closed after leaf action");

// ---- T4: F4 repeats the last command
await page.evaluate(() => (window.__events = []));
await page.keyboard.press("F4");
await page.waitForTimeout(300);
const ev4 = await page.evaluate(() => window.__events);
ok(ev4.some((e) => e.includes("v")), "T4: F4 repeated the last command");

// ---- T5: menu path — Alt H V F (Paste Formulas → Edit ▸ Paste special ▸ Formulas only)
await page.evaluate(() => (window.__events = []));
await page.keyboard.press("Alt");
await page.keyboard.press("H");
await page.waitForTimeout(100);
await page.keyboard.press("V");
await page.waitForTimeout(100);
await page.keyboard.press("F");
await page.waitForTimeout(900);
const ev5 = await page.evaluate(() => window.__events);
ok(ev5.includes("menu-open:docs-edit-menu"), "T5a: Edit menu opened");
ok(ev5.includes("submenu-open:menu-pastespecial"), "T5b: Paste special submenu opened");
ok(ev5.includes("menuitem-click:formulas-only"), "T5c: clicked Formulas only");

// ---- T6: menu path with submenu — Alt H I R (Insert ▸ Rows ▸ Insert 1 row above → ctrl+alt+=)
await page.evaluate(() => (window.__events = []));
await page.keyboard.press("Alt");
await page.keyboard.press("H");
await page.waitForTimeout(80);
await page.keyboard.press("I");
await page.waitForTimeout(80);
await page.keyboard.press("R");
await page.waitForTimeout(600);
const ev6 = await page.evaluate(() => window.__events);
ok(ev6.some((e) => e.includes("=")) || ev6.some((e) => e.includes("Equal")), "T6: Alt H I R fired insert-rows shortcut → " + ev6.join(" | "));

// ---- T7: F10 cycles overlay modes
await page.keyboard.press("Alt");
await page.waitForTimeout(150);
ok(await overlayRoot(), "T7a: overlay back");
await page.keyboard.press("F10");
await page.waitForTimeout(100);
ok(await page.$("#oak-overlay-root.oak-ghost"), "T7b: F10 → ghost mode");
await page.keyboard.press("F10");
await page.waitForTimeout(100);
ok(await page.$("#oak-overlay-root.oak-hidden"), "T7c: F10 → hidden mode");
await page.keyboard.press("F10");
await page.waitForTimeout(100);
ok(await page.$("#oak-overlay-root:not(.oak-hidden)"), "T7d: F10 → shown again");
await page.keyboard.press("Escape");

// ---- T8: clicking a tab in the overlay feeds the key
await page.evaluate(() => (window.__events = []));
await page.keyboard.press("Alt");
await page.waitForTimeout(150);
const tabs = await page.$$("#oak-overlay-root .oak-tab");
if (tabs.length) {
  const homeTab = tabs.find(async () => true); // click first tab (File? — order is insertion: F first)
  await tabs[1].click(); // second = H Home
  await page.waitForTimeout(150);
  const hasPanel = await page.$("#oak-overlay-root .oak-panel");
  ok(hasPanel, "T8: clicking a badge walks into the tab");
}
await page.keyboard.press("Escape");

// ---- T9: unknown letter closes tips
await page.keyboard.press("Alt");
await page.waitForTimeout(120);
await page.keyboard.press("Q"); // no Q at top level in Sheets
await page.waitForTimeout(150);
ok(!(await overlayRoot()), "T9: unknown letter closes tips");

// ---- T11 (P1.13 regression): Alt held + key = native Google combo —
// the extension must NOT open tips and must NOT touch the event.
await page.evaluate(() => (window.__events = []));
await page.keyboard.down("Alt");
await page.keyboard.press("1"); // Google: rename sheet combo
await page.keyboard.up("Alt");
await page.waitForTimeout(250);
{
  const ev11 = await page.evaluate(() => window.__events);
  const altCombo = ev11.some((e) => e.includes("alt+") && /(^|\+)1$/.test(e.split(":")[1] || ""));
  ok(!(await overlayRoot()), "T11a: Alt+1 held-combo does NOT open key-tips");
  ok(altCombo, "T11b: the page received the native Alt+1 event → " + ev11.join(" | "));
}

// ---- T12 (P1.13 regression): a key with Alt still held while tips are
// active closes the tips and passes through untouched.
await page.keyboard.press("Alt");
await page.waitForTimeout(250);
ok(await overlayRoot(), "T12a: tips open after a discrete Alt tap");
await page.evaluate(() => (window.__events = []));
await page.keyboard.down("Alt");
await page.keyboard.press("/");
await page.keyboard.up("Alt");
await page.waitForTimeout(250);
{
  const ev12 = await page.evaluate(() => window.__events);
  ok(!(await overlayRoot()), "T12b: Alt+/ combo closed the tips (no consume)");
  ok(ev12.some((e) => e.includes("alt+/")), "T12c: Alt+/ passed through to the page → " + ev12.join(" | "));
}

// ---- T13 (re-audit 2.2): the overlay is keyboard reachable — Tab moves
// focus in, Tab cycles its controls, letters still drive the sequence
// while the overlay holds focus, Esc closes from inside.
await page.keyboard.press("Alt");
await page.waitForTimeout(200);
ok(await overlayRoot(), "T13a: tips open");
await page.keyboard.press("Tab");
await page.waitForTimeout(150);
{
  const focusedIn = () => page.evaluate(() => {
    const r = document.getElementById("oak-overlay-root");
    return !!(r && r.contains(document.activeElement));
  });
  ok(await focusedIn(), "T13b: Tab moved focus into the overlay");
  await page.keyboard.press("H"); // letters must keep walking the tips
  await page.waitForTimeout(150);
  ok(await page.$("#oak-overlay-root .oak-panel"), "T13c: letters still drive the tips with overlay focus");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  ok(await focusedIn(), "T13d: Tab cycles within the overlay (focus stays inside)");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  ok(!(await overlayRoot()), "T13e: Esc closes the tips from overlay focus");
}

// ---- T14 (v1.1.2 re-audit 3.1): user-disabled sequences are skipped on
// EVERY path — not just the page-level key handler. v1.1.2 let a disabled
// sequence run whenever focus sat inside the overlay (the overlay's
// keydown forwarder fed keys straight to the engine) and when its entry
// was CLICKED in the panel. The build above seeds disabledSeqs "AW,ASA".
{
  // a) keyboard, focus INSIDE the overlay, menu branch — the exact
  //    re-audit repro shape: letter → Tab → letter
  await page.evaluate(() => (window.__events = []));
  await page.keyboard.press("Alt");
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab"); // focus into the overlay
  await page.waitForTimeout(150);
  await page.keyboard.press("A");   // A (Data) itself is not disabled…
  await page.waitForTimeout(150);
  ok(await page.$("#oak-overlay-root .oak-panel"), "T14a: A panel opened (A is not disabled)");
  await page.keyboard.press("Tab"); // cycle focus between overlay controls
  await page.waitForTimeout(150);
  await page.keyboard.press("W");   // …but AW is: swallow + close, no advance
  await page.waitForTimeout(250);
  ok(!(await overlayRoot()), "T14b: disabled A W with overlay focus closed the tips");

  // b) keyboard, focus inside the overlay, LEAF branch — A S A (Sort
  //    Ascending) is disabled: nothing may be dispatched at all
  await page.evaluate(() => (window.__events = []));
  await page.keyboard.press("Alt");
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  await page.keyboard.press("A");
  await page.waitForTimeout(150);
  await page.keyboard.press("S");   // AS is not disabled…
  await page.waitForTimeout(150);
  ok(await page.$("#oak-overlay-root .oak-panel"), "T14c: A S panel opened (AS is not disabled)");
  await page.keyboard.press("A");   // …but ASA is: the leaf must NOT run
  await page.waitForTimeout(400);
  const ev14 = await page.evaluate(() => window.__events);
  ok(!(await overlayRoot()), "T14d: disabled A S A closed the tips");
  ok(!ev14.some((e) => e.startsWith("menu-") || e.toLowerCase().includes("sort")),
    "T14e: no sort menu was driven for the disabled leaf → " + ev14.join(" | "));

  // c) mouse: click the disabled W entry in the A panel
  await page.keyboard.press("Alt");
  await page.waitForTimeout(200);
  await page.keyboard.press("A");
  await page.waitForTimeout(200);
  const wRow = await page.$("#oak-overlay-root .oak-row:has(span.oak-k:text-is('W'))");
  ok(!!wRow, "T14f: the (disabled) W row is still listed in the A panel");
  if (wRow) {
    await wRow.click();
    await page.waitForTimeout(250);
  }
  ok(!(await overlayRoot()), "T14g: clicking the disabled W row skips it and closes the tips");

  // d) control: a NOT-disabled sequence still runs from overlay focus
  await page.evaluate(() => (window.__events = []));
  await page.keyboard.press("Alt");
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  await page.keyboard.press("H");
  await page.waitForTimeout(150);
  await page.keyboard.press("1"); // Bold — not disabled
  await page.waitForTimeout(300);
  const ev14d = await page.evaluate(() => window.__events);
  ok(ev14d.some((e) => e.toLowerCase().includes("ctrl") && e.includes("b")),
    "T14h: control — Alt H 1 still dispatches from overlay focus → " + ev14d.join(" | "));
}

// ---- T15 (v1.1.3 audit nit 3): the compact strip must never overflow in
// badges-only mode — v1.1.3's content overflowed its 760px cap by 26px and
// the "…F10 modes" hint tail ended under the close button. The v1.1.4 fix
// shortens the hint and lets it ellipsize (flex 0 1 auto) so tabs and the
// close ✕ always win the space race. The root is shrink-to-fit up to
// min(92vw, 760px): T15b–d check the default fit, T15e forces the cap by
// narrowing the viewport (92vw < content) and proves the hint yields.
{
  await page.keyboard.press("Alt");
  await page.waitForTimeout(200);
  await page.mouse.move(4, 4); // away from the strip → badges-only mode
  await page.waitForTimeout(250);
  const measure = () => page.evaluate(() => {
    const bar = document.querySelector("#oak-overlay-root .oak-bar");
    if (!bar) return null;
    const close = bar.querySelector(".oak-close");
    return {
      sw: bar.scrollWidth, cw: bar.clientWidth, bw: bar.getBoundingClientRect().width,
      closeRight: close ? close.offsetLeft + close.offsetWidth : -1,
      hint: (bar.querySelector(".oak-hint") || {}).textContent || "",
    };
  });
  let fit = await measure();
  ok(!!fit, "T15a: strip present");
  ok(fit && fit.cw <= 760, `T15b: strip within its 760px cap (width ${fit && fit.bw.toFixed(0)})`);
  ok(fit && fit.sw <= fit.cw + 1,
    `T15c: no horizontal overflow in badges-only mode (${fit && fit.sw} ≤ ${fit && fit.cw})`);
  ok(fit && fit.closeRight <= fit.cw + 1,
    `T15d: close ✕ fully visible without scrolling (right edge ${fit && fit.closeRight} ≤ ${fit && fit.cw})`);
  // Force the cap: 92vw (644px) < content → the bar clamps and the hint
  // must ellipsize instead of pushing tabs/close out (v1.1.4 CSS guard).
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(250);
  fit = await measure();
  ok(fit && fit.sw <= fit.cw + 1,
    `T15e: at 700px viewport the strip still fits — hint yields (${fit && fit.sw} ≤ ${fit && fit.cw})`);
  ok(fit && fit.closeRight <= fit.cw + 1,
    "T15f: close ✕ still fully visible at the clamped width");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

// ---- T16 (v1.1.5): Google Docs routes every keystroke through an offscreen
// same-origin iframe (.docs-texteventtarget-iframe) that holds keyboard focus
// while the document is edited. v1.1.4's document-level capture listeners
// never saw keys typed there — Alt tips worked in Sheets (focus:
// #waffle-rich-text-editor, top document) but not in Docs — and ["k", …]
// combos were dispatched at the top document, which Docs' in-frame handlers
// never saw either. v1.1.5 instruments every reachable same-origin frame
// (live, via MutationObserver) and resolves the focused document before
// dispatching. The frame is created dynamically here so the ENGINE's
// observer discovers it — exactly like the real Docs boot — and the frame's
// own recorder attaches after instrumentation, mirroring Google's listeners
// sitting behind ours for consumed keys.
{
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.id = "oak-test-textframe";
    f.className = "docs-texteventtarget-iframe"; // the real Docs class name
    // Visible but inert: same-origin, focusable target inside — the event
    // semantics are identical to the real offscreen frame.
    f.style.cssText =
      "position:fixed;left:6px;top:120px;width:140px;height:36px;border:1px solid #999;background:#fff";
    f.srcdoc =
      "<!DOCTYPE html><body><div id='tgt' tabindex='-1' style='font:12px monospace'>frame target</div></body>";
    document.body.appendChild(f);
  });
  // The engine re-sweeps frames on a 300ms debounce; give it time, then
  // attach the frame's recorder and move focus inside it.
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const d = document.getElementById("oak-test-textframe").contentDocument;
    d.addEventListener("keydown", (e) => {
      const mods =
        (e.ctrlKey ? "ctrl+" : "") + (e.altKey ? "alt+" : "") +
        (e.shiftKey ? "shift+" : "") + (e.metaKey ? "meta+" : "");
      parent.__events.push("frame-keydown:" + mods + e.key);
    }, true);
    d.getElementById("tgt").focus();
  });
  await page.waitForTimeout(150);
  const focusInFrame = await page.evaluate(() => {
    const f = document.getElementById("oak-test-textframe");
    return document.activeElement === f &&
      f.contentDocument.activeElement && f.contentDocument.activeElement.id === "tgt";
  });
  ok(focusInFrame, "T16 setup: keyboard focus inside the same-origin frame (Docs-style)");

  await page.evaluate(() => (window.__events = []));
  await page.keyboard.press("Alt");
  await page.waitForTimeout(250);
  ok(await overlayRoot(), "T16a: Alt opens the tips while focus is inside the frame (v1.1.5 fix)");

  await page.keyboard.press("H");
  await page.waitForTimeout(150);
  ok(await page.$("#oak-overlay-root .oak-panel"), "T16b: H walks the tree from frame focus");

  await page.keyboard.press("V");
  await page.waitForTimeout(120);
  await page.keyboard.press("V");
  await page.waitForTimeout(350);
  const ev16 = await page.evaluate(() => window.__events);
  ok(ev16.some((e) => /frame-keydown:ctrl\+shift\+v$/i.test(e)),
    "T16c: combos dispatch into the focused frame document (Docs dispatch) → " + ev16.join(" | "));
  ok(!ev16.some((e) => /:(h|v)$/i.test(e)),
    "T16d: letters consumed by the tips never reach the frame (no stray text)");
  ok(!ev16.some((e) => /^keydown:ctrl\+shift\+v$/i.test(e)),
    "T16e: exactly one dispatch — nothing duplicated at the top document");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  ok(!(await overlayRoot()), "T16f: Esc closes from frame focus");

  // Frame pointerdown must close the tips too (instrumented in-frame).
  await page.keyboard.press("Alt");
  await page.waitForTimeout(250);
  ok(await overlayRoot(), "T16g setup: tips reopened");
  await page.mouse.click(76, 138); // inside the visible test frame
  await page.waitForTimeout(200);
  ok(!(await overlayRoot()), "T16g: pointerdown inside the frame closes the tips");
  await page.evaluate(() => document.getElementById("oak-test-textframe").remove());
  await page.waitForTimeout(150);
}

// ---- T17 (v1.1.5): the real Google Docs failure — the text-event iframe is
// OFFSCREEN (class docs-texteventtarget-iframe-negative-top, y:-10000) and
// contains a contenteditable div that holds focus. Its rect in FRAME-LOCAL
// coordinates looks perfectly visible, so v1.1.4's isEditing() called it
// "actively editing" and closed the tips the moment a letter was pressed
// (Alt worked, Alt+H vanished). v1.1.5 walks the frame chain and requires
// top-page visibility. This replica reproduces the exact geometry.
{
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.id = "oak-test-offscreen-frame";
    f.className = "docs-texteventtarget-iframe docs-offscreen-z-index docs-texteventtarget-iframe-negative-top";
    f.style.cssText = "position:fixed;left:0;top:-10000px;width:625px;height:1px;border:0";
    f.srcdoc =
      "<!DOCTYPE html><body><div id='edit' contenteditable='true' style='width:625px;height:18px'></div></body>";
    document.body.appendChild(f);
  });
  await page.waitForTimeout(700); // engine re-sweep debounce
  await page.evaluate(() => {
    const d = document.getElementById("oak-test-offscreen-frame").contentDocument;
    d.addEventListener("keydown", (e) => {
      const mods =
        (e.ctrlKey ? "ctrl+" : "") + (e.altKey ? "alt+" : "") +
        (e.shiftKey ? "shift+" : "") + (e.metaKey ? "meta+" : "");
      parent.__events.push("off-frame-keydown:" + mods + e.key);
    }, true);
    d.getElementById("edit").focus();
  });
  await page.waitForTimeout(150);
  const geometry = await page.evaluate(() => {
    const f = document.getElementById("oak-test-offscreen-frame");
    const d = f.contentDocument;
    const el = d.getElementById("edit");
    const er = el.getBoundingClientRect();
    const fr = f.getBoundingClientRect();
    return {
      focused: document.activeElement === f && d.activeElement === el,
      editable: el.isContentEditable,
      elRectInFrame: [Math.round(er.width), Math.round(er.height)],
      frameTopInPage: Math.round(fr.top),
    };
  });
  ok(geometry.focused && geometry.editable, "T17 setup: focus in an offscreen frame's contenteditable div (real Docs geometry)");
  ok(geometry.elRectInFrame[0] > 0 && geometry.frameTopInPage < 0,
    `T17 setup: healthy local rect (${geometry.elRectInFrame.join("x")}) inside an offscreen frame (top ${geometry.frameTopInPage}) — the v1.1.4 trap`);

  await page.evaluate(() => (window.__events = []));
  await page.keyboard.press("Alt");
  await page.waitForTimeout(250);
  ok(await overlayRoot(), "T17a: Alt opens the tips from the offscreen editable frame");

  await page.keyboard.press("H");
  await page.waitForTimeout(200);
  ok(await page.$("#oak-overlay-root .oak-panel"),
    "T17b: H walks the tree — the offscreen editor is NOT 'actively editing' (v1.1.5 fix)");

  await page.keyboard.press("V");
  await page.waitForTimeout(120);
  await page.keyboard.press("V");
  await page.waitForTimeout(350);
  const ev17 = await page.evaluate(() => window.__events);
  ok(ev17.some((e) => /off-frame-keydown:ctrl\+shift\+v$/i.test(e)),
    "T17c: combos dispatch into the offscreen focused document → " + ev17.join(" | "));
  ok(!ev17.some((e) => /:(h|v)$/i.test(e)),
    "T17d: no letters leak into the offscreen editor");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  ok(!(await overlayRoot()), "T17e: Esc closes from the offscreen frame");
  await page.evaluate(() => document.getElementById("oak-test-offscreen-frame").remove());
  await page.waitForTimeout(100);

  // Slides geometry: the same text-event frame collapsed to a 1x1 box at
  // (0,-1). The inner contenteditable still reports ~960x18 in frame-local
  // coordinates — translate-only visibility math calls it visible; the
  // clip-to-frame-box step is what catches it (v1.1.5).
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.id = "oak-test-slides-frame";
    f.className = "docs-texteventtarget-iframe docs-offscreen-z-index docs-texteventtarget-iframe-negative-top";
    f.style.cssText = "position:fixed;left:0;top:-1px;width:1px;height:1px;border:0";
    f.srcdoc =
      "<!DOCTYPE html><body><div id='edit' contenteditable='true' style='width:960px;height:18px'></div></body>";
    document.body.appendChild(f);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() =>
    document.getElementById("oak-test-slides-frame").contentDocument.getElementById("edit").focus()
  );
  await page.waitForTimeout(150);
  await page.keyboard.press("Alt");
  await page.waitForTimeout(250);
  ok(await overlayRoot(), "T17g setup: tips open from the 1x1 Slides-geometry frame");
  await page.keyboard.press("H");
  await page.waitForTimeout(200);
  ok(await page.$("#oak-overlay-root .oak-panel"),
    "T17g: H walks the tree — a 1x1 clipped frame is not a visible editor (Slides geometry)");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById("oak-test-slides-frame").remove());
  await page.waitForTimeout(100);

  // Control: a VISIBLE frame's contenteditable IS editing — letters must
  // close the tips instead of being swallowed (P1.8 preserved for visible
  // editors like comment boxes in dialogs).
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.id = "oak-test-visible-frame";
    f.style.cssText = "position:fixed;left:6px;top:120px;width:200px;height:40px;border:1px solid #999;background:#fff";
    f.srcdoc = "<!DOCTYPE html><body><div id='edit' contenteditable='true' style='width:100%;height:20px'></div></body>";
    document.body.appendChild(f);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() =>
    document.getElementById("oak-test-visible-frame").contentDocument.getElementById("edit").focus()
  );
  await page.waitForTimeout(150);
  await page.keyboard.press("Alt");
  await page.waitForTimeout(250);
  ok(await overlayRoot(), "T17f setup: tips open with focus in a VISIBLE frame editor");
  await page.keyboard.press("H");
  await page.waitForTimeout(250);
  ok(!(await overlayRoot()),
    "T17f: a letter into a VISIBLE frame editor closes the tips (typing protection intact)");
  await page.evaluate(() => document.getElementById("oak-test-visible-frame").remove());
  await page.waitForTimeout(100);
}

// ---- T10: no page errors during the whole run
ok(errors.length === 0, "T10: no page errors " + (errors.length ? "→ " + errors[0] : ""));

console.log(`\nMock integration result: ${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
