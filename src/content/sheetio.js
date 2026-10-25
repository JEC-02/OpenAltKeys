/*
 * OpenAltKeys — sheetio.js
 * Google Sheets I/O helpers for the extras (trace, goal seek, symbols).
 * Talks only to Google's public DOM: the name box (#t-name-box), the formula
 * bar (#t-formula-bar-input) and the selection status bar.
 *
 * Number parsing is locale-aware (P2.12): "1,000" vs "1,5" vs "1.000,5",
 * currency prefixes/suffixes and parenthesised negatives all parse the way
 * the displaying locale intended. Navigation via the name box is VERIFIED —
 * if the selection did not land where we asked, the operation aborts
 * instead of typing into the wrong cell (P1.6).
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const D = () => window.OAKDispatch;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- generic DOM helpers ---------- */

  function setVisibleValue(el, value) {
    // Native setter so Google's listeners observe the change.
    el.focus();
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* ---------- A1 reference helpers ---------- */

  const REF = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]{0,6})$/;

  function parseRef(ref) {
    const m = REF.exec(String(ref || "").trim().toUpperCase());
    if (!m) return null;
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    return { col, row: parseInt(m[2], 10), a1: m[0] };
  }

  function colLetters(n) {
    let s = "";
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  function refBelow(ref, n) {
    const p = parseRef(ref);
    if (!p) return null;
    return colLetters(p.col) + (p.row + (n || 1));
  }

  function refRight(ref, n) {
    const p = parseRef(ref);
    if (!p) return null;
    return colLetters(p.col + (n || 1)) + p.row;
  }

  /* ---------- locale-aware number parsing (P2.12) ---------- */

  const CURRENCY = "$€£¥₩₹₫₱₽₴₪₺₼₽﷼";

  // Parses the text a spreadsheet shows for a number:
  //   "1,000"  → 1000  (thousands groups)     "1,5"    → 1.5 (decimal comma)
  //   "1.000"  → 1000  (thousands groups)     "1.5"    → 1.5 (decimal point)
  //   "1.000,5"→ 1000.5 (both → last one wins)
  //   "€ 1.234,56" → 1234.56   "(1,5)" → -1.5   "1e3" → 1000
  // Returns null when the text is not a number.
  function parseNumber(text) {
    if (text === null || text === undefined) return null;
    let s = String(text).trim().replace(/\u2212/g, "-"); // unicode minus
    if (!s) return null;
    let paren = false;
    if (/^\(.*\)$/.test(s)) { paren = true; s = s.slice(1, -1).trim(); }
    // strip spaces (incl. nbsp / narrow nbsp) and currency signs around the digits
    s = s.replace(/[\s\u00a0\u202f]/g, "");
    s = s.replace(new RegExp("^(-?)[" + CURRENCY + "]+"), "$1");
    s = s.replace(new RegExp("[" + CURRENCY + "%]+$"), "");
    const m = /^(-?)([\d.,]*\d)(?:[eE]([-+]?\d+))?$/.exec(s);
    if (!m) return null;
    const sign = m[1] === "-";
    let body = m[2];
    const exp = m[3] ? parseInt(m[3], 10) : 0;
    let value;
    const lastComma = body.lastIndexOf(",");
    const lastDot = body.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      // both separators: the later one is the decimal separator
      const decSep = lastComma > lastDot ? "," : ".";
      const thouSep = decSep === "," ? "." : ",";
      body = body.split(thouSep).join("").replace(decSep, ".");
      value = parseFloat(body);
    } else if (lastComma >= 0) {
      // comma only: "1,000,000" (groups) vs "1,5" (decimal)
      if (/^\d{1,3}(,\d{3})+$/.test(body)) value = parseFloat(body.replace(/,/g, ""));
      else value = parseFloat(body.replace(/,/g, "."));
    } else if (lastDot >= 0) {
      // dot only: "1.000.000" (groups) vs "1.5" (decimal)
      if (/^\d{1,3}(\.\d{3})+$/.test(body)) value = parseFloat(body.replace(/\./g, ""));
      else value = parseFloat(body);
    } else {
      value = parseFloat(body);
    }
    if (!isFinite(value)) return null;
    if (exp) value = value * Math.pow(10, exp);
    // Excel-style double negative: "( -5 )" stays negative once.
    const negative = sign !== paren;
    return negative ? -value : value;
  }

  /* ---------- Google Sheets elements ---------- */

  function nameBox() {
    return document.querySelector("#t-name-box") ||
      document.querySelector("input[aria-label*='name box' i]");
  }

  function formulaBarInput() {
    return document.querySelector("#t-formula-bar-input") ||
      document.querySelector("#t-formula-bar-input-container");
  }

  // Text of the currently selected cell as shown in the formula bar.
  function formulaBarText() {
    const el = formulaBarInput();
    if (!el) return "";
    return (el.value !== undefined && typeof el.value === "string"
      ? el.value : el.textContent || "").trim();
  }

  // Selection as shown in the name box ("B2" or "A1:B4").
  function activeRef() {
    const nb = nameBox();
    if (!nb) return "";
    return String(nb.value || "").trim().toUpperCase();
  }

  /* ---------- actions ---------- */

  // Move the selection (or select a range like "A1:B4") via the name box.
  // VERIFIED (P1.6): the name box must show what we asked for afterwards,
  // otherwise we report failure — no blind typing into unknown cells.
  async function navigateTo(ref) {
    const want = String(ref || "").trim().toUpperCase();
    if (!want) return false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const nb = nameBox();
      if (!nb) { D()?.toast("Name box not found"); return false; }
      // leave any open editor first
      D()?.pressCombo("enter");
      await wait(60);
      nb.focus();
      setVisibleValue(nb, want);
      D()?.sendKey("enter", nb);
      await wait(220);
      if (activeRef() === want) return true;
    }
    D()?.toast("Couldn't select " + want + " — check the reference");
    return false;
  }

  // Type a value into a cell (ends with Enter so it commits).
  // Only runs after the selection was verified to be on `ref`.
  async function writeCell(ref, text) {
    // Extension-driven edit (Goal-Seek writeback, …): arm the heads-up
    // guard so a protected-range warning cannot stall the solver loop.
    try { window.OAKDialogGuard && window.OAKDialogGuard.arm(); } catch (e) { /* ignore */ }
    if (!(await navigateTo(ref))) return false;
    const chars = String(text).split("");
    for (const ch of chars) { D()?.sendKey(ch, document); await wait(8); }
    D()?.sendKey("enter", document);
    await wait(120);
    return true;
  }

  /* ---------- reading values via the status bar ---------- */

  const STATUS_SELECTORS = [
    "#docs-statistics .docs-statistics-sum",
    ".docs-statistics-sum",
    "#docs-statistics",
    "#summary-bars",
    ".docs-status-bar",
  ];

  function statusText() {
    for (const sel of STATUS_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && isVisible(el) && el.textContent.trim()) return el.textContent;
    }
    // fallback: any visible element whose id/class mentions statistics
    for (const el of document.querySelectorAll('[id*="statistic" i], [class*="statistic" i]')) {
      if (isVisible(el) && el.textContent.trim()) return el.textContent;
    }
    return "";
  }

  // Prefer the number labelled "Sum" (any locale label may precede it);
  // fall back only when the text holds exactly one number (P1.6).
  function readSum(text) {
    if (!text) return null;
    const s = String(text).replace(/\u2212/g, "-");
    const sumM = /sum\D*(-?[\d.,]+(?:[eE][-+]?\d+)?)/i.exec(s);
    if (sumM) return parseNumber(sumM[1]);
    const nums = s.match(/-?[\d.,]*\d/g) || [];
    const parsed = nums.map(parseNumber).filter((n) => n !== null);
    if (parsed.length === 1) return parsed[0];
    return null; // ambiguous or empty — never guess
  }

  // Kept for compatibility/tests.
  function firstNumber(text) {
    if (!text) return null;
    const m = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = parseFloat(m[0]);
    return isFinite(n) ? n : null;
  }

  // Read a cell's computed value: select REF and the (empty) cell below it,
  // then read the sum Google shows in the status bar.
  async function readCellBySum(ref) {
    const below = refBelow(ref, 1);
    if (!below) return null;
    if (!(await navigateTo(ref + ":" + below))) return null;
    await wait(250);
    return readSum(statusText());
  }

  // The solver's sum covers `ref` + ONE cell below, so exactly that cell
  // must be empty. Verified via the formula bar (locale-free).
  async function belowIsEmpty(ref) {
    const b1 = refBelow(ref, 1);
    if (!b1) return false;
    if (!(await navigateTo(b1))) return false;
    await wait(150);
    return formulaBarText() === "";
  }

  // Open Find & Replace pre-filled with `ref` (for dependent hunting).
  async function findReplaceOpen(ref) {
    D()?.pressCombo("ctrl+h");
    await wait(450);
    const input =
      document.querySelector("#docs-findinput") ||
      document.querySelector("input[aria-label*='find' i]") ||
      document.querySelector(".docs-dialog input[type='text']") ||
      document.querySelector(".docs-modalinputcontainer input");
    if (!input) return false;
    input.focus();
    setVisibleValue(input, String(ref).toUpperCase());
    return true;
  }

  window.OAKSheetIO = {
    parseRef, colLetters, refBelow, refRight, parseNumber,
    nameBox, formulaBarInput, formulaBarText, activeRef,
    navigateTo, writeCell,
    readCellBySum, belowIsEmpty, statusText, readSum, firstNumber,
    findReplaceOpen,
  };
})();
