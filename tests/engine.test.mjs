/*
 * OpenAltKeys — engine + data integrity tests (Node, no dependencies)
 * Run: node tests/engine.test.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("  ✗ FAIL: " + msg);
  }
}
function section(name) {
  console.log("— " + name);
}

// Load a classic script into a sandboxed window.
function loadScript(rel, win) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const fn = new Function("window", "document", "chrome", "navigator", "module", src);
  fn(win, win.document, undefined, { platform: "Win32" }, undefined);
}

const win = { document: { addEventListener() {}, getElementById: () => null, querySelector: () => null } };

// ---- data files load cleanly and expose arrays
section("data files");
loadScript("src/data/sheets.js", win);
loadScript("src/data/docs.js", win);
loadScript("src/data/slides.js", win);
const DATA = win.OAK_DATA;
ok(DATA && Array.isArray(DATA.sheets), "sheets data is an array");
ok(Array.isArray(DATA.docs), "docs data is an array");
ok(Array.isArray(DATA.slides), "slides data is an array");

const COUNTS = { sheets: DATA.sheets.length, docs: DATA.docs.length, slides: DATA.slides.length };
const STATS = {};
for (const app of ["sheets", "docs", "slides"]) {
  let shortcuts = 0, guides = 0, tabs = 0;
  for (const e of DATA[app]) {
    if (!e.action) tabs++;
    else if (e.action[0] === "t") guides++;
    else shortcuts++;
  }
  STATS[app] = { total: DATA[app].length, shortcuts, guides, tabs };
}
console.log("  entry counts:", COUNTS, "→", STATS);
ok(COUNTS.sheets >= 120, "sheets has ≥ 120 sequences");
ok(COUNTS.docs >= 60, "docs has ≥ 60 sequences");
ok(COUNTS.slides >= 80, "slides has ≥ 80 sequences");
const TOTAL = COUNTS.sheets + COUNTS.docs + COUNTS.slides;
ok(TOTAL >= 280, "total ≥ 280 sequences (got " + TOTAL + ")");

// ---- README ↔ data parity (P2.4): the published numbers must match reality
section("README count parity");
{
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  for (const app of ["sheets", "docs", "slides"]) {
    const label = app === "sheets" ? "Sheets" : app === "docs" ? "Docs" : "Slides";
    const re = new RegExp("\\|\\s*Google " + label +
      "\\s*\\|\\s*(\\d+) sequences — (\\d+) shortcuts, (\\d+) guides");
    const m = re.exec(readme);
    ok(!!m, "README lists counts for " + label);
    if (m) {
      const s = STATS[app];
      ok(parseInt(m[1], 10) === s.total, `${label} total: README ${m[1]} == data ${s.total}`);
      ok(parseInt(m[2], 10) === s.shortcuts, `${label} shortcuts: README ${m[2]} == data ${s.shortcuts}`);
      ok(parseInt(m[3], 10) === s.guides, `${label} guides: README ${m[3]} == data ${s.guides}`);
    }
  }
  // version consistency (P0.5): manifest == README zip reference
  const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
  ok(readme.includes("openaltkeys-v" + manifest.version + ".zip"),
    "README references the current zip (openaltkeys-v" + manifest.version + ".zip)");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  ok(pkg.version === manifest.version, "package.json version == manifest version");
  ok(manifest.description.length <= 132,
    "store description ≤ 132 chars (" + manifest.description.length + ")");
  ok(!!manifest.short_name, "manifest has short_name");
  ok(!("license" in manifest) && !("author" in manifest),
    "no non-standard manifest keys (license/author removed)");
}

// ---- engine loads and builds trees
section("engine tree builder");
loadScript("src/content/engine.js", win);
const OAK = win.OAKEngine;
ok(OAK && typeof OAK.buildTree === "function", "engine exposes buildTree");
ok(typeof OAK.matchDisabled === "function", "engine exposes matchDisabled");

for (const app of ["sheets", "docs", "slides"]) {
  const tree = OAK.buildTree(DATA[app]);
  ok(!!tree, app + " tree builds");

  // every tab entry is a direct child
  const tabs = DATA[app].filter((e) => e.seq.length === 1 && !e.action);
  for (const t of tabs) ok(tree.children.has(t.seq), app + " tab " + t.seq + " in tree");

  // every action entry resolves to a node with an action
  let missing = 0;
  for (const e of DATA[app]) {
    if (!e.action) continue;
    let n = tree;
    for (const c of e.seq) n = n.children.get(c);
    if (!n || !n.action) {
      missing++;
      console.error("    no action at " + app + " seq " + e.seq);
    }
  }
  ok(missing === 0, app + ": all action entries reachable (" + missing + " missing)");

  // no duplicate sequences with conflicting actions
  const seen = new Map();
  let dups = 0;
  for (const e of DATA[app]) {
    if (seen.has(e.seq)) {
      dups++;
      console.error("    duplicate seq " + e.seq + " in " + app);
    }
    seen.set(e.seq, e);
  }
  ok(dups === 0, app + ": no duplicate sequences");

  // P2.1: no blank intermediate labels — every node with children shows a
  // human label ("Clipboard", "Font", …), never "V …" style blanks.
  let blanks = 0;
  const walk = (n, path) => {
    if (path && n.children.size > 0 && !n.label) {
      blanks++;
      console.error("    blank intermediate label at " + app + " " + path);
    }
    for (const [k, c] of n.children) walk(c, path + k);
  };
  walk(tree, "");
  ok(blanks === 0, app + ": no blank intermediate labels (" + blanks + ")");
}

// ---- node kind resolution semantics
section("node kind semantics");
const t = OAK.buildTree([
  { seq: "H", label: "Home" },                    // menu
  { seq: "HVV", label: "Paste Values", action: ["k", "x"] },  // leaf
  { seq: "HH", label: "Fill", action: ["c", "x"] },           // open/defer w/ children
  { seq: "HHN", label: "No Fill", action: ["x", "y"] },
]);
ok(OAK.resolveNodeKind(t.children.get("H"), false) === "menu", "no-action node with children → menu");
ok(OAK.resolveNodeKind(t.children.get("H").children.get("V").children.get("V"), false) === "leaf", "action without children → leaf");
ok(OAK.resolveNodeKind(t.children.get("H").children.get("H"), false) === "open", "action with children defaults open");
ok(OAK.resolveNodeKind(t.children.get("H").children.get("H"), true) === "defer", "defer flag respected");
const t2 = OAK.buildTree([{ seq: "A", label: "a", action: ["k", "x"], mode: "leaf" }, { seq: "AB", label: "b", action: ["k", "y"] }]);
ok(OAK.resolveNodeKind(t2.children.get("A"), false) === "leaf", "explicit mode leaf wins");
ok(OAK.resolveNodeKind(t2.children.get("A"), true) === "leaf", "explicit mode leaf beats defaultDefer");

// intermediate labels inherit the group ("Clipboard" for V under H)
{
  const tree = OAK.buildTree([
    { seq: "H", label: "Home" },
    { seq: "HVP", label: "Paste", group: "Clipboard", action: ["k", "v"] },
  ]);
  const vNode = tree.children.get("H").children.get("V");
  ok(vNode.label === "Clipboard", "intermediate node inherits group label (got " + JSON.stringify(vNode.label) + ")");
}

// ---- disabled sequences (P2.21)
section("disabled sequence matching");
ok(OAK.matchDisabled("HVV", ["HVV"]) === "HVV", "exact token disables");
ok(OAK.matchDisabled("HVV", ["HV"]) === "HV", "prefix token disables subtree");
ok(OAK.matchDisabled("HV", ["HVV"]) === null, "partial walk is not disabled");
ok(OAK.matchDisabled("WFF", ["HVV", "FF"]) === null, "unrelated sequences unaffected");
ok(OAK.matchDisabled("HVF", ["hvf"]) === "HVF", "tokens are case-insensitive");
ok(OAK.matchDisabled("HVV", [""]) === null, "empty tokens ignored");

// ---- feedKey disabled guard (v1.1.3): the single-choke-point check in
// feedKey() — a ONE-LETTER key that completes a disabled prefix closes the
// tips on every input path (page keydown, overlay focus forwarder, panel
// clicks). Special names (ESCAPE/ENTER/BACKSPACE) are longer than one
// char, so they can never trip the guard — Backspace stepping is safe
// even when "H" is disabled.
section("feedKey disabled guard");
const guard = (prefix, key, tokens) =>
  (String(key).length === 1 && OAK.matchDisabled(prefix + key, tokens)) || null;
ok(guard("", "A", ["AW"]) === null,
  "walking into a disabled prefix is fine — only the completing key trips");
ok(guard("A", "W", ["AW"]) === "AW",
  "completing key of a disabled menu branch is caught (overlay-focus path)");
ok(guard("AS", "A", ["ASA"]) === "ASA",
  "completing key of a disabled leaf is caught (panel-click path)");
ok(guard("A", "W", ["ASA"]) === null,
  "a disabled leaf in another subtree does not block A W");
ok(guard("H", "BACKSPACE", ["H"]) === null &&
   guard("H", "ENTER", ["H"]) === null &&
   guard("H", "ESCAPE", ["H"]) === null,
  "special names never trip the guard (Backspace/Enter/Esc stay functional)");

// ---- sequence charset: only A-Z 0-9 and =
section("sequence charset");
const bad = [];
for (const app of ["sheets", "docs", "slides"]) {
  for (const e of DATA[app]) {
    if (!/^[A-Z0-9=]+$/.test(e.seq)) bad.push(app + ":" + e.seq);
  }
}
ok(bad.length === 0, "all sequences use A-Z 0-9 = (" + bad.join(", ") + ")");

// ---- action specs well-formed (no dead +kinds anymore, P2.22)
section("action spec sanity");
const VALID = new Set(["k", "m", "c", "s", "x", "t"]);
let badActions = 0;
for (const app of ["sheets", "docs", "slides"]) {
  for (const e of DATA[app]) {
    if (!e.action) continue;
    if (!Array.isArray(e.action) || !VALID.has(e.action[0])) {
      badActions++;
      console.error("    bad action at " + app + " " + e.seq + ": " + JSON.stringify(e.action));
    }
    if (e.action[0] === "k" && typeof e.action[1] !== "string") badActions++;
    if (e.action[0] === "m" && e.action.length < 3) badActions++;
  }
}
ok(badActions === 0, "all action specs well-formed");

// ---- flagship sequences
section("flagship sequences (Sheets)");
const sheetsSeqs = new Set(DATA.sheets.map((e) => e.seq));
for (const s of ["HVV", "HVF", "HVT", "HVB", "HVR", "HFP", "HOI", "HOA", "WFF", "WFR", "WFC",
  "HIR", "HDR", "HBA", "HBS", "HBN", "HMC", "HMM", "HMU", "HP", "HK", "ESV", "EST", "AGG"]) {
  ok(sheetsSeqs.has(s), "Sheets has " + s);
}
const sheetsBySeq = Object.fromEntries(DATA.sheets.map((e) => [e.seq, e]));
ok(sheetsBySeq.HIR.action[1] === "sheetsInsertDelete" && sheetsBySeq.HIR.action.includes("row"),
  "HIR selects the row before inserting (P1.14)");
ok(sheetsBySeq.HDR.action[1] === "sheetsInsertDelete", "HDR selects the row before deleting (P1.14)");
ok(sheetsBySeq.FP.action[0] === "x" && sheetsBySeq.FP.action[1] === "printPage",
  "Sheets Print uses real window.print() (P1.1)");
ok(new Set([sheetsBySeq.NC1.action[2], sheetsBySeq.NN1.action[2],
  sheetsBySeq.NQ.action[2], sheetsBySeq.ND.action[2]]).size === 4,
  "chart entries pick distinct chart types (P1.12)");

section("flagship sequences (Docs)");
const docsSeqs = new Set(DATA.docs.map((e) => e.seq));
for (const s of ["HX", "HC", "HVT", "HFP", "H1", "H2", "H3", "HL1", "HL2", "NP", "NL", "NC2", "ST", "RS", "RW", "M", "ML", "MM"]) {
  ok(docsSeqs.has(s), "Docs has " + s);
}

section("flagship sequences (Slides)");
const slidesSeqs = new Set(DATA.slides.map((e) => e.seq));
const slidesBySeq = Object.fromEntries(DATA.slides.map((e) => [e.seq, e]));
for (const s of ["HI", "HD", "NX", "NSH", "KT", "WQ", "JDPC", "JDAAL", "JDAAC", "JDAFF",
  "JDAH", "JDAV", "HGG", "HGU", "AA", "SB", "SC", "SH", "DP"]) {
  ok(slidesSeqs.has(s), "Slides has " + s);
}
// P2.7: PowerPoint-accurate tab letters, wrong mapping removed
ok(slidesBySeq.A.label === "Animations", "Slides A = Animations (PowerPoint)");
ok(slidesBySeq.D.label === "Draw", "Slides D = Draw (PowerPoint)");
ok(slidesBySeq.S.label === "Slide Show", "Slides S = Slide Show (PowerPoint)");
for (const gone of ["AOR", "AAL", "AOK", "AG", "AU", "DN", "DD", "DB", "DL", "DT"]) {
  ok(!slidesSeqs.has(gone), "Slides wrong-mapping entry " + gone + " removed");
}
ok(slidesBySeq.FP.action[1] === "printPage", "Slides Print uses real window.print()");

// ---- macOS modifier translation (P1.4)
section("dispatch mac translation");
{
  // load dispatch.js with a mac-ish navigator and a stubbed KeyboardEvent
  const events = [];
  const winMac = {
    document: { dispatchEvent(ev) { events.push(ev); } },
    navigator: { platform: "MacIntel" },
    KeyboardEvent: class { constructor(type, init) { Object.assign(this, { type }, init); } },
    Event: class { constructor(t, i) { Object.assign(this, { type: t }, i); } },
    HTMLInputElement: class {},
    OAKMenus: { realClick() {} },
  };
  const src = readFileSync(join(ROOT, "src/content/dispatch.js"), "utf8");
  new Function("window", "document", "navigator", src)(winMac, winMac.document, winMac.navigator);
  const T = winMac.OAKDispatch.__test;
  ok(T.IS_MAC === true, "mac platform detected");
  const mods = (arr) => [...arr].sort().join(",");
  ok(mods(T.translateMods(new Set(["control"]), "ctrl+c")) === "meta", "mac: ctrl+c → Cmd+C");
  ok(mods(T.translateMods(new Set(["control", "shift"]), "ctrl+shift+v")) === "meta,shift",
    "mac: ctrl+shift+v → Cmd+Shift+V");
  ok(mods(T.translateMods(new Set(["control", "alt"]), "ctrl+alt+equal")) === "alt,meta",
    "mac: ctrl+alt+= (insert row) → Cmd+Option (Google's documented ⌘⌥=)");
  ok(mods(T.translateMods(new Set(["control", "alt"]), "ctrl+alt+minus")) === "alt,meta",
    "mac: ctrl+alt+- (delete row) → Cmd+Option (⌘⌥−)");
  ok(mods(T.translateMods(new Set(["control", "alt"]), "ctrl+alt+g")) === "alt,meta",
    "mac: ctrl+alt+g → Cmd+Option+G");
  // Re-audit 2.3: per-combo Mac overrides, exactly as Google documents them
  ok(T.macDocumented("alt+shift+5", "docs") === "meta+shift+x",
    "mac: Docs strikethrough alt+shift+5 → Cmd+Shift+X");
  ok(T.macDocumented("alt+shift+5", "slides") === "meta+shift+x",
    "mac: Slides strikethrough alt+shift+5 → Cmd+Shift+X");
  ok(T.macDocumented("alt+shift+7", "sheets") === "alt+shift+7",
    "mac: Sheets outer border alt+shift+7 stays Option+Shift+7");
  ok(T.macDocumented("alt+shift+1", "sheets") === "alt+shift+1",
    "mac: Sheets top border alt+shift+1 stays Option+Shift+1");
  ok(T.macDocumented("alt+1", "sheets") === "alt+1",
    "mac: Sheets rename alt+1 keeps Option (undocumented on Mac — mirrors Windows)");
  ok(T.macDocumented("alt+/", "sheets") === "alt+/",
    "mac: tool finder alt+/ stays Option+/ (⌘/ is the shortcut-help overlay)");
  ok(T.macDocumented("ctrl+h", "sheets") === "meta+shift+h",
    "mac: find & replace ctrl+h → Cmd+Shift+H");
  ok(T.macDocumented("ctrl+space", "sheets") === "ctrl+space",
    "mac: select column ctrl+space keeps physical Ctrl");
  ok(T.macDocumented("ctrl+shift+4", "sheets") === "ctrl+shift+4",
    "mac: currency format ctrl+shift+4 keeps physical Ctrl");
  ok(T.macDocumented("ctrl+shift+7", "docs") === null,
    "mac: Docs numbered list ctrl+shift+7 uses the default ⌘⇧7 translation");
  ok(T.macDocumented("ctrl+m", "slides") === "ctrl+m",
    "mac: Slides new slide ctrl+m keeps physical Ctrl (Google's Mac doc)");
  ok(T.macDocumented("ctrl+shift+f", "docs") === "ctrl+shift+f",
    "mac: compact controls ctrl+shift+f keeps physical Ctrl");
  ok(T.macDocumented("ctrl+alt+equal", "sheets") === null,
    "mac: insert row uses the default ⌘⌥ translation (no override needed)");
  ok(T.macDocumented("ctrl+c", "") === null, "mac: plain ctrl+c uses the default ⌘C translation");
  ok(T.charKeyInfo("enter").code === "Enter", "charKeyInfo resolves named-key codes (P2.11)");
  ok(T.charKeyInfo("delete").code === "Delete", "charKeyInfo resolves delete");
  ok(T.isClipboardCombo("ctrl+shift+v") && T.isClipboardCombo("ctrl+c") && !T.isClipboardCombo("ctrl+b"),
    "clipboard family detection");

  const winWin = {
    document: { dispatchEvent() {} },
    navigator: { platform: "Win32" },
    KeyboardEvent: class { constructor(t, i) { Object.assign(this, { type: t }, i); } },
    Event: class { constructor(t, i) { Object.assign(this, { type: t }, i); } },
    HTMLInputElement: class {},
    OAKMenus: { realClick() {} },
  };
  new Function("window", "document", "navigator", src)(winWin, winWin.document, winWin.navigator);
  const T2 = winWin.OAKDispatch.__test;
  ok(T2.IS_MAC === false, "windows platform detected");
  ok(mods(T2.translateMods(new Set(["control"]), "ctrl+c")) === "control", "windows: ctrl stays ctrl");
}

console.log("");
console.log(`Result: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
