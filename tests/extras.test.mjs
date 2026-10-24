/*
 * OpenAltKeys — unit tests for extras.js (formula ref parsing, goal-seek
 * solver) + handler-registry integrity + sheetio number parsing.
 * Run: node tests/extras.test.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log("  ✓ " + m); } else { failed++; console.error("  ✗ FAIL: " + m); } };
const section = (s) => console.log("— " + s);

// ---- minimal browser-ish global for loading the content scripts ----
const win = { OAK_CUSTOM: {}, OAK_DATA: {} };
global.window = win;
global.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({ style: {}, appendChild: () => {}, addEventListener: () => {} }),
};
global.chrome = { storage: { sync: { get: (d, cb) => cb({}), onChanged: { addListener: () => {} } } } };

for (const f of ["../src/data/sheets.js", "../src/content/sheetio.js", "../src/content/extras.js", "../src/content/dispatch.js"]) {
  (0, eval)(readFileSync(join(ROOT, f), "utf8"));
}
const Extras = win.OAKExtras;
const IO = win.OAKSheetIO;
// dispatch.js registers the built-in printPage handler + all OAK_CUSTOM ones
const hasHandler = (name) =>
  typeof win.OAK_CUSTOM[name] === "function" ||
  (win.OAKDispatch && win.OAKDispatch.__test && win.OAKDispatch.__test.hasCustom(name));

/* ---- parseRefs ---- */
section("parseRefs");
{
  const r = Extras.parseRefs("=A1+B2");
  ok(r.length === 2 && r[0].ref === "A1" && r[1].ref === "B2" && !r[0].range, "singles");
}
{
  const r = Extras.parseRefs("=SUM(A1:A3)*2");
  ok(r.length === 1 && r[0].ref === "A1:A3" && r[0].range, "range collapsed to one entry");
}
{
  const r = Extras.parseRefs("=SUM(A1:A3,B2)+C3");
  ok(r.length === 3 && r.map((x) => x.ref).join(",") === "A1:A3,B2,C3", "range + singles mix");
}
{
  // P1.10 fix: cross-sheet refs are now KEPT (with their sheet) and jumpable
  const r = Extras.parseRefs("=Sheet2!A1+A2");
  ok(r.length === 2 && r[0].ref === "Sheet2!A1" && r[0].sheet === "Sheet2" &&
    r[1].ref === "A2", "plain cross-sheet ref kept: " + JSON.stringify(r));
}
{
  const r = Extras.parseRefs("='My Sheet'!B2+C1");
  ok(r.length === 2 && r[0].ref === "'My Sheet'!B2" && r[1].ref === "C1",
    "quoted cross-sheet ref kept: " + JSON.stringify(r));
}
{
  const r = Extras.parseRefs("=Sheet3!A1:B2+D4");
  ok(r.length === 2 && r[0].ref === "Sheet3!A1:B2" && r[0].range &&
    r[1].ref === "D4", "cross-sheet range kept");
}
{
  // P1.10 fix: whole-column and open-ended ranges parse now
  const r = Extras.parseRefs("=SUM(A:A)");
  ok(r.length === 1 && r[0].ref === "A:A" && r[0].wholeCol && r[0].jump === "A1",
    "whole-column range parses (jump A1): " + JSON.stringify(r));
}
{
  const r = Extras.parseRefs("=SUM($A:$B)+C1");
  ok(r.length === 2 && r[0].ref === "A:B" && r[1].ref === "C1",
    "absolute whole-column range: " + JSON.stringify(r));
}
{
  const r = Extras.parseRefs("=A1:B");
  ok(r.length === 1 && r[0].ref === "A1:B" && r[0].jump === "A1",
    "open-ended range parses (jump A1): " + JSON.stringify(r));
}
{
  const r = Extras.parseRefs("=A1:B2+C3"); // open-range must NOT swallow A1:B2
  ok(r.length === 2 && r[0].ref === "A1:B2", "full range wins over open-ended");
}
{
  const r = Extras.parseRefs('="literal A1 text"&B1');
  ok(r.length === 1 && r[0].ref === "B1", "refs inside string literals ignored");
}
{
  const r = Extras.parseRefs("=LOG10(100)+ATAN2(1,1)+B2");
  ok(r.length === 1 && r[0].ref === "B2", "function names with digits (LOG10/ATAN2) not refs");
}
{
  const r = Extras.parseRefs("=1E5+A1");
  ok(r.length === 1 && r[0].ref === "A1", "scientific notation not a ref");
}
{
  const r = Extras.parseRefs("=$A$1+B$2");
  ok(r.length === 2 && r[0].ref === "$A$1" && r[1].ref === "B$2",
    "absolute refs parsed, $ kept for display/jump (name box accepts $A$1): " + JSON.stringify(r));
}
ok(Extras.parseRefs("no formula").length === 0, "plain text → no refs");
ok(Extras.parseRefs("").length === 0, "empty → no refs");

/* ---- solveGoal ---- */
section("solveGoal");
{
  const evals = [];
  const res = await Extras.solveGoal({
    f: async (x) => { evals.push(x); return 2 * x + 1; },
    goal: 101, x0: 1,
  });
  ok(Math.abs(res.x - 50) < 1e-6, `linear solved exactly (x=${res.x})`);
  ok(evals.length <= 8, `linear solved in few evals (${evals.length})`);
}
{
  const res = await Extras.solveGoal({ f: async (x) => x * x, goal: 9, x0: 1 });
  ok(Math.abs(res.x - 3) < 1e-4, `quadratic solved (x=${res.x.toFixed(6)})`);
}
{
  const res = await Extras.solveGoal({ f: async (x) => x * x * x - 2 * x - 5, goal: 0, x0: 1 });
  ok(Math.abs(res.x - 2.094553) < 1e-3, `cubic solved numerically (x=${res.x.toFixed(6)})`);
}
{
  let threw = null;
  try { await Extras.solveGoal({ f: async () => 5, goal: -3, x0: 1 }); }
  catch (e) { threw = e; }
  ok(threw && /sign change/.test(threw.message), "no-solution throws with reason");
}
{
  let threw = null;
  try { await Extras.solveGoal({ f: async (x) => (x < 0 ? null : 2 * x), goal: 10, x0: -5 }); }
  catch (e) { threw = e; }
  ok(threw && /unreadable/.test(threw.message), "unreadable cell value aborts cleanly");
}
{
  const evals = [];
  const res = await Extras.solveGoal({
    f: async (x) => { evals.push(1); return x * 2; },
    goal: 4, x0: 1, maxEvals: 8,
  });
  ok(Math.abs(res.x - 2) < 1e-9, "small budget: exact hit found (x=2)");
  ok(evals.length <= 8, `eval budget respected (${evals.length} evals)`);
}
{
  let threw = null;
  try { await Extras.solveGoal({ f: async (x) => x + 1000, goal: 5, x0: 0, maxEvals: 6 }); }
  catch (e) { threw = e; }
  ok(threw, "exhausted budget throws a controlled error");
}
{
  // P1.6 fix: cancellation stops the solver cleanly
  let calls = 0;
  let threw = null;
  try {
    await Extras.solveGoal({
      f: async (x) => { calls++; return 2 * x + 1; },
      goal: 101, x0: 1,
      isCancelled: () => calls >= 2,
    });
  } catch (e) { threw = e; }
  ok(threw && threw.message === "cancelled", `cancel mid-solve throws 'cancelled' (after ${calls} evals)`);
  ok(calls <= 3, "cancelled solver stops early");
}

/* ---- handler registry integrity: every "x" handler in sheets data exists ---- */
section("handler registry");
{
  const missing = [];
  for (const e of win.OAK_DATA.sheets) {
    if (e.action && e.action[0] === "x" && !hasHandler(e.action[1])) {
      missing.push(e.seq + " → " + e.action[1]);
    }
  }
  ok(missing.length === 0, "all sheets x-handlers registered (" + (missing.join(", ") || "none missing") + ")");
  for (const h of ["tracePrec", "traceDep", "traceClear", "goalSeek", "symbolPicker",
    "sheetsInsertDelete", "sheetsFillReset", "sheetsChartEditor", "sheetsCtx", "printPage"]) {
    ok(hasHandler(h), "handler " + h + " registered");
  }
}

/* ---- sheetio helpers ---- */
section("sheetio helpers");
{
  ok(IO.parseRef("B2").col === 2 && IO.parseRef("B2").row === 2, "parseRef B2");
  ok(IO.parseRef("$AA$10").col === 27 && IO.parseRef("$AA$10").row === 10, "parseRef $AA$10");
  ok(IO.parseRef("$AA$10").a1 === "$AA$10", "parseRef keeps $ in a1 (P3 fix)");
  ok(IO.parseRef("LOG") === null, "no row digits → not a ref");
  ok(IO.parseRef("LOG10") !== null, "LOG10 is a syntactically valid far cell (paren disambiguates in formulas)");
  ok(IO.refBelow("B2") === "B3", "refBelow");
  ok(IO.refBelow("B99") === "B100", "refBelow rollover");
  ok(IO.refRight("B2") === "C2", "refRight");
  ok(IO.colLetters(27) === "AA", "colLetters 27 → AA");
}

/* ---- locale-aware number parsing (P2.12) ---- */
section("parseNumber");
{
  ok(IO.parseNumber("1,000") === 1000, "1,000 → 1000 (thousands)");
  ok(IO.parseNumber("1,000,000") === 1000000, "1,000,000 → 1000000");
  ok(IO.parseNumber("1,5") === 1.5, "1,5 → 1.5 (decimal comma)");
  ok(IO.parseNumber("1.5") === 1.5, "1.5 → 1.5 (decimal point)");
  ok(IO.parseNumber("1.000") === 1000, "1.000 → 1000 (dot as thousands sep)");
  ok(IO.parseNumber("1.000,5") === 1000.5, "1.000,5 → 1000.5");
  ok(IO.parseNumber("1,000.5") === 1000.5, "1,000.5 → 1000.5");
  ok(IO.parseNumber("€ 1.234,56") === 1234.56, "€ 1.234,56 → 1234.56");
  ok(IO.parseNumber("$1,234.56") === 1234.56, "$1,234.56 → 1234.56");
  ok(IO.parseNumber("(1,5)") === -1.5, "(1,5) → -1.5 (parenthesised negative)");
  ok(IO.parseNumber("-5") === -5, "-5 → -5");
  ok(IO.parseNumber("−5") === -5, "unicode minus −5 → -5");
  ok(IO.parseNumber("60") === 60, "plain 60");
  ok(IO.parseNumber("1e3") === 1000, "1e3 → 1000");
  ok(IO.parseNumber("50%") === 50, "50% → 50");
  ok(IO.parseNumber("") === null, "empty → null");
  ok(IO.parseNumber("abc") === null, "text → null");
  ok(IO.parseNumber(null) === null, "null → null");
}

/* ---- readSum: prefer the Sum-labelled number (P1.6) ---- */
section("readSum");
{
  ok(IO.readSum("Sum: 60") === 60, "Sum: 60");
  ok(IO.readSum("Count: 3   Sum: 45.5") === 45.5, "Sum picked over Count");
  ok(IO.readSum("Sum: 1,5") === 1.5, "localized decimal in Sum");
  ok(IO.readSum("總和：1,234") === 1234, "non-English label, single number");
  ok(IO.readSum("60") === 60, "single bare number");
  ok(IO.readSum("") === null, "empty → null");
  ok(IO.readSum("Count: 2 Average: 6 Max: 10") === null, "ambiguous stats without Sum → null (never guess)");
  ok(IO.firstNumber("Sum: 123.5") === 123.5, "firstNumber kept for compatibility");
}

console.log(`\nExtras unit result: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
