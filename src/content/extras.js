/*
 * OpenAltKeys — extras.js
 * The "beyond shortcuts" tools that make Alt-keys a full power-user kit:
 *
 *   • Alt M P  Trace Precedents — lists the refs used by the active formula
 *              (including cross-sheet refs and column ranges), click one to
 *              jump to it.
 *   • Alt M D  Find Dependents — opens Find & Replace pre-filled with the
 *              active cell ref so formulas using it can be located.
 *   • Alt M A A  Close audit panels.
 *   • Alt A W G  Goal Seek — solve "set cell = value by changing cell"
 *              entirely through Google's public UI (name box + status bar).
 *              Verified navigation, cancellation, single-run locking and a
 *              checked restore of the original value.
 *   • Alt N U  Symbol palette — click a symbol to type it into the cell.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const IO = () => window.OAKSheetIO;
  const D = () => window.OAKDispatch;
  const OV = () => window.OAKOverlay;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* =============================================================
   * Formula reference parsing (pure functions — unit tested)
   * ============================================================= */

  const REF_SRC = "\\$?[A-Za-z]{1,3}\\$?[1-9][0-9]{0,6}";
  const RANGE_RE = new RegExp("^((" + REF_SRC + ")\\s*:\\s*(" + REF_SRC + "))");
  const SINGLE_RE = new RegExp("^(" + REF_SRC + ")");
  // Whole-column / whole-row ranges: A:A, $A:$B, 1:1
  const COLRANGE_RE = /^\$?([A-Za-z]{1,3})\s*:\s*\$?([A-Za-z]{1,3})(?![A-Za-z0-9_!(])/;
  const ROWRANGE_RE = /^\$?([1-9][0-9]{0,6})\s*:\s*\$?([1-9][0-9]{0,6})(?![A-Za-z0-9_!(])/;
  // Open-ended range: A1:B (no row on the right side)
  const OPENRANGE_RE = new RegExp("^((" + REF_SRC + ")\\s*:\\s*\\$?([A-Za-z]{1,3}))(?![A-Za-z0-9_!(])");
  const BEFORE_OK = (ch) => !ch || /[^A-Za-z0-9_$!]/.test(ch);

  // Sheet-qualified refs: Sheet2!A1  'My Sheet'!B2  Sheet3!A1:B2
  const SHEET_PLAIN_RE = new RegExp("^([A-Za-z_][A-Za-z0-9_.]*)!(" + REF_SRC + ")");

  // Returns [{ ref, jump, range, sheet, wholeCol }]
  //   ref  — display label ("A1", "A1:B4", "A:A", "Sheet2!A1", "'My S'!B2")
  //   jump — what to type into the name box to navigate there
  // in formula order, duplicates removed. Skips "…" string literals.
  function parseRefs(formula) {
    const out = [];
    const seen = new Set();
    const src = String(formula || "");
    let inString = false;
    let i = 0;
    const push = (ref, extra) => {
      const key = ref.toUpperCase().replace(/\$/g, "").replace(/^'(.*)'$/, "$1");
      if (!seen.has(key)) { seen.add(key); out.push(Object.assign({ ref, jump: ref, range: false, sheet: null }, extra)); }
    };
    while (i < src.length) {
      const ch = src[i];
      if (ch === '"') { inString = !inString; i++; continue; }
      if (inString) { i++; continue; }
      if (ch === "'") { // quoted sheet name 'Sheet 2'!A1 — keep as a cross-sheet ref
        let j = i + 1;
        while (j < src.length && src[j] !== "'") j++;
        // doubled '' escapes a quote inside the name
        while (src[j] === "'" && src[j + 1] === "'") j += 2;
        if (src[j] === "'") {
          const rest = src.slice(j + 1);
          const refM = new RegExp("^!\\s*(" + REF_SRC + ")").exec(rest);
          if (refM && BEFORE_OK(src[i - 1])) {
            const name = src.slice(i, j + 1); // 'My Sheet'
            push(name + "!" + refM[1], { sheet: name });
            i = j + 1 + refM[0].length;
            continue;
          }
        }
        i++;
        continue;
      }
      if (!/[A-Za-z0-9$]/.test(ch)) { i++; continue; }
      if (!BEFORE_OK(src[i - 1])) { i++; continue; }
      const rest = src.slice(i);
      let m;
      // whole-column range A:A / A:B
      m = COLRANGE_RE.exec(rest);
      if (m) {
        const c1 = m[1].toUpperCase(), c2 = m[2].toUpperCase();
        push(c1 + ":" + c2, { range: true, wholeCol: true, jump: c1 + "1" });
        i += m[0].length;
        continue;
      }
      // whole-row range 1:1 (only when not part of a bigger ref)
      m = ROWRANGE_RE.exec(rest);
      if (m && /^\d/.test(rest)) {
        push(m[1] + ":" + m[2], { range: true, wholeRow: true, jump: "A" + m[1] });
        i += m[0].length;
        continue;
      }
      // sheet-qualified single/range ref Sheet2!A1 / Sheet2!A1:B2
      m = SHEET_PLAIN_RE.exec(rest);
      if (m && !/^\d/.test(m[1])) {
        const after = rest.slice(m[0].length);
        const rangeM = new RegExp("^\\s*:\\s*(" + REF_SRC + ")").exec(after);
        const ref = m[1] + "!" + m[2] + (rangeM ? ":" + rangeM[1] : "");
        push(ref, { sheet: m[1], range: !!rangeM });
        i += m[0].length + (rangeM ? rangeM[0].length : 0);
        continue;
      }
      // open-ended range A1:B
      m = OPENRANGE_RE.exec(rest);
      if (m) {
        const ref = m[1].replace(/\s+/g, "").toUpperCase();
        push(ref, { range: true, jump: m[2].toUpperCase() });
        i += m[0].length;
        continue;
      }
      // ordinary range A1:B4
      m = RANGE_RE.exec(rest);
      if (m) {
        push(m[1].replace(/\s+/g, "").toUpperCase(), { range: true });
        i += m[0].length;
        continue;
      }
      // ordinary single ref A1
      m = SINGLE_RE.exec(rest);
      if (m) {
        // next char after the ref must not extend it (function name, digit…)
        const after = src[i + m[0].length];
        if (!after || !/[0-9A-Za-z_(]/.test(after)) {
          push(m[1].toUpperCase(), { range: false });
          i += m[0].length;
          continue;
        }
      }
      i++;
    }
    return out;
  }

  /* =============================================================
   * Goal Seek solver (pure function — unit tested)
   * ============================================================= */

  // Finds x with f(x) ≈ goal. evals: [{x, y}] history appended in place so
  // the UI can show progress. opts.isCancelled() is polled before every
  // evaluation so a cancel click stops the solver cleanly. Throws
  // { message } on failure (including "cancelled").
  async function solveGoal(opts) {
    const f = opts.f, goal = opts.goal, x0 = opts.x0;
    const tol = opts.tol !== undefined ? opts.tol : 1e-6;
    const maxEvals = opts.maxEvals || 22;
    const evals = opts.evals || [];
    const cancelled = opts.isCancelled || (() => false);

    async function ev(x) {
      if (cancelled()) throw { message: "cancelled" };
      if (evals.length >= maxEvals) throw { message: "iteration budget reached" };
      const y = await f(x);
      if (typeof y !== "number" || !isFinite(y)) throw { message: "cell value unreadable" };
      evals.push({ x, y });
      return y;
    }

    let y0 = await ev(x0);
    if (Math.abs(y0 - goal) <= tol) return { x: x0, y: y0, evals };

    // ---- bracket: geometric probes around x0 (deduped) ----
    const probes = [];
    const seenX = new Set([Math.round(x0 * 1e9)]);
    const addProbe = (x) => {
      const k = Math.round(x * 1e9);
      if (!seenX.has(k)) { seenX.add(k); probes.push(x); }
    };
    const base = Math.max(1, Math.abs(x0) * 0.5);
    for (const mag of [base, Math.abs(x0) || 1, 1, 10, 100, 1e3, 1e4, 1e5, 1e6]) {
      addProbe(x0 + mag);
      addProbe(x0 - mag);
    }
    let lo = null, hi = null, ylo = null, yhi = null;
    for (const x of probes) {
      if (evals.length >= maxEvals - 6) break;
      const y = await ev(x);
      const d = y - goal;
      const d0 = y0 - goal;
      if (d === 0) return { x, y, evals };
      if ((d < 0) !== (d0 < 0)) {
        lo = Math.min(x0, x); hi = Math.max(x0, x);
        ylo = lo === x0 ? y0 : y; yhi = lo === x0 ? y : y0;
        if (lo === x) { ylo = y; yhi = y0; }
        break;
      }
    }
    if (lo === null) throw { message: "no sign change found — no solution nearby" };

    // ---- Illinois (false position with endpoint halving): superlinear and
    // immune to the endpoint stagnation plain secant suffers on convex f ----
    let flo = ylo - goal, fhi = yhi - goal;
    const itersLeft = maxEvals - evals.length; // fixed bound (evals grows in-loop)
    for (let k = 0; k < itersLeft; k++) {
      let x;
      if (fhi !== flo) x = hi - (fhi * (hi - lo)) / (fhi - flo);
      else x = (lo + hi) / 2;
      if (!isFinite(x) || x < lo || x > hi) x = (lo + hi) / 2; // safeguard
      const y = await ev(x);
      const f = y - goal;
      if (Math.abs(f) <= tol) return { x, y, evals };
      if ((f < 0) === (flo < 0)) { lo = x; flo = f; fhi /= 2; }
      else { hi = x; fhi = f; flo /= 2; }
      if (hi - lo < 1e-9 * Math.max(1, Math.abs(lo))) break;
    }
    // best effort answer
    const best = evals.slice().sort((a, b) => Math.abs(a.y - goal) - Math.abs(b.y - goal))[0];
    if (best && Math.abs(best.y - goal) <= Math.max(1e-3, Math.abs(goal) * 1e-4)) {
      return { x: best.x, y: best.y, evals, approximate: true };
    }
    throw { message: "did not converge" };
  }

  /* =============================================================
   * Custom handlers (registered for dispatch "x")
   * ============================================================= */

  // ---- Alt M P : Trace Precedents ----
  // Handlers that already showed the user a meaningful toast return TRUE
  // ("handled"); FALSE is reserved for silent failures, for which the engine
  // shows the generic "didn't run" toast (P2.10).
  window.OAK_CUSTOM.tracePrec = async function () {
    const io = IO();
    window.OAKEngine?.closeTips?.(); // this panel owns the overlay now
    const ref = io.activeRef();
    const formula = io.formulaBarText();
    if (!formula.startsWith("=")) {
      D()?.toast(ref ? `${ref} has no formula — select a formula cell` : "Select a formula cell first");
      return true;
    }
    const refs = parseRefs(formula);
    if (!refs.length) { D()?.toast("No cell references found in the formula"); return true; }
    const MAX = 40;
    const items = refs.slice(0, MAX).map((r) => ({
      label: r.ref,
      sub: r.sheet ? "cross-sheet" : r.range ? (r.wholeCol ? "columns" : "range") : "cell",
      group: "References — click to jump",
      jump: r.jump,
    }));
    if (refs.length > MAX) {
      items.push({ label: `+${refs.length - MAX} more…`, sub: "not shown", static: true });
    }
    OV()?.showList(`Precedents of ${ref || "cell"}`, items, (label, item) => {
      if (!item || item.static) return;
      io.navigateTo(item.jump || label).then((ok) => {
        D()?.toast(ok ? "Jumped to " + item.jump : "Could not jump to " + item.jump);
      });
    }, { note: formula.slice(0, 90) });
    return true;
  };

  // ---- Alt M D : Find Dependents (search launcher) ----
  window.OAK_CUSTOM.traceDep = async function () {
    const io = IO();
    const ref = io.activeRef();
    if (!ref || ref.includes(":")) {
      D()?.toast("Select a single cell first (its dependents will be searched)");
      return true;
    }
    const ok = await io.findReplaceOpen(ref);
    D()?.toast(ok
      ? `Searching formulas for ${ref} — pick "Also search within formulas", then Find`
      : "Find & Replace did not open");
    return ok;
  };

  // ---- Alt M A A : close audit panels ----
  window.OAK_CUSTOM.traceClear = async function () {
    OV()?.hide();
    D()?.toast("Audit panels closed");
    return true;
  };

  /* ---- Alt A W G : Goal Seek ---- */

  let goalSeekRunning = false; // single-run lock (P1.6)

  window.OAK_CUSTOM.goalSeek = async function () {
    const io = IO();
    if (goalSeekRunning) {
      D()?.toast("Goal Seek is already running — press Esc to cancel it");
      return true;
    }
    window.OAKEngine?.closeTips?.(); // the form owns the overlay now
    const current = io.activeRef();
    const ctl = { cancelled: false };
    OV()?.showForm("Goal Seek (Excel Alt A W G)", [
      { name: "set", label: "Set cell", value: current && !current.includes(":") ? current : "", placeholder: "B4" },
      { name: "to", label: "To value", value: "", placeholder: "1000" },
      { name: "by", label: "By changing cell", value: "", placeholder: "B1" },
    ], async (vals) => {
      const setRef = String(vals.set || "").trim().toUpperCase();
      const byRef = String(vals.by || "").trim().toUpperCase();
      const goal = io.parseNumber(vals.to);
      if (!io.parseRef(setRef) || !io.parseRef(byRef) || goal === null || !isFinite(goal)) {
        D()?.toast("Fill all fields with a cell ref (B4) and a number");
        return false;
      }
      if (setRef === byRef) { D()?.toast("Set cell and changing cell must differ"); return false; }
      // The form itself is the confirmation: Set / To / By are on screen and
      // Solve is a deliberate click (P1.6 "no confirmation" fixed).
      await runGoalSeek(setRef, goal, byRef, ctl);
      return true;
    }, {
      note: "Runs through the sheet UI — keep the cell directly below the set cell empty",
      okLabel: "Solve",
      busyLabel: "Solving…",
      onCancel: () => { ctl.cancelled = true; }, // Esc/Cancel aborts the solver
    });
    return true;
  };

  async function runGoalSeek(setRef, goal, byRef, ctl) {
    const io = IO();
    goalSeekRunning = true;
    try {
      // sanity: the cell directly below the set cell must be empty — that is
      // the cell the status-bar Sum reads together with the set cell.
      if (!(await io.belowIsEmpty(setRef))) {
        D()?.toast("The cell directly below " + setRef + " must be empty (values are read via the status bar)");
        return;
      }

      // the changing cell must currently hold a plain number
      if (!(await io.navigateTo(byRef))) return;
      await wait(150);
      const curText = io.formulaBarText();
      const x0 = io.parseNumber(curText);
      if (x0 === null || !isFinite(x0)) {
        D()?.toast(byRef + " must contain a number (not a formula)");
        return;
      }

      D()?.toast("Goal Seek: reading " + setRef + " …");
      const evals = [];
      const f = async (x) => {
        if (!(await io.writeCell(byRef, String(x)))) {
          throw { message: "could not write " + byRef };
        }
        const y = await io.readCellBySum(setRef);
        if (evals.length % 3 === 0 || evals.length < 3) {
          D()?.toast(`Goal Seek: try ${evals.length + 1} → ${setRef} = ${y ?? "?"}`);
        }
        return y;
      };

      let res = null, err = null;
      try { res = await solveGoal({ f, goal, x0, evals, isCancelled: () => ctl.cancelled }); }
      catch (e) { err = e && e.message ? e.message : "failed"; }

      if (ctl.cancelled && !res) {
        const okRestore = await io.writeCell(byRef, String(x0));
        D()?.toast(okRestore
          ? "Goal Seek cancelled — original value restored"
          : "Goal Seek cancelled — could NOT restore " + byRef + " to " + x0 + ", please undo (Ctrl+Z)");
        return;
      }

      if (res) {
        const finalX = Math.round(res.x * 1e6) / 1e6;
        const okWrite = await io.writeCell(byRef, String(finalX));
        D()?.toast(okWrite
          ? `Solved: ${byRef} = ${finalX} → ${setRef} ≈ ${Math.round(res.y * 1e4) / 1e4}` +
            (res.approximate ? " (approx.)" : "")
          : "Solved, but writing " + byRef + " failed — press Ctrl+Z if the sheet changed");
      } else {
        // failed solve → restore the original value and SAY whether it worked (P1.6)
        const okRestore = await io.writeCell(byRef, String(x0));
        D()?.toast(okRestore
          ? "Goal Seek failed (" + err + ") — original value restored"
          : "Goal Seek failed (" + err + ") — could NOT restore " + byRef + " to " + x0 + ", press Ctrl+Z");
      }
    } finally {
      goalSeekRunning = false;
    }
  }

  /* =============================================================
   * Symbol palette (Alt N U)
   * ============================================================= */

  const SYMBOLS = [
    { group: "Greek", items: "α β γ δ ε θ λ μ π σ φ ω Γ Δ Θ Λ Π Σ Φ Ω".split(" ") },
    { group: "Math", items: "± × ÷ ≠ ≈ ≤ ≥ ≪ ≫ √ ∑ ∏ ∞ ∝ ∈ ∉ ⊂ ∅ ⇒ ⇔ ¬ °".split(" ") },
    { group: "Superscript / fraction", items: "¹ ² ³ ⁴ ⁿ ½ ⅓ ¼ ¾ ‰".split(" ") },
    { group: "Arrows", items: "→ ← ↑ ↓ ↔ ↵ ⇒ ⇐ ➜".split(" ") },
    { group: "Currency", items: "€ £ ¥ ¢ ₱ ₩ ₹ ₫".split(" ") },
    { group: "Text", items: "© ® ™ • § ¶ † ‡ ′ ″ … – — “ ” ‘ ’".split(" ") },
    { group: "Checkboxes", items: "✓ ✔ ✗ ✘ ☐ ☑ ☰ ① ② ③".split(" ") },
  ];

  window.OAK_CUSTOM.symbolPicker = async function () {
    window.OAKEngine?.closeTips?.(); // the palette owns the overlay now
    const flat = [];
    for (const cat of SYMBOLS) {
      for (const s of cat.items) flat.push({ label: s, group: cat.group });
    }
    OV()?.showList("Symbols — click to type into the cell", flat, (sym) => {
      insertSymbol(sym);
    }, { note: "The symbol is typed into the active cell (Enter commits as usual). Type in the Filter box to search." });
    return true;
  };

  // Insert with verification (P1.7): use a real editing command, never a
  // blind synthetic-Unicode hail-mary, and only report success when the
  // editor content actually changed.
  async function insertSymbol(sym) {
    const D2 = D();
    let ae = document.activeElement;
    let openedEditor = false;
    const editable = (el) =>
      !!el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    if (!editable(ae)) {
      // No editor open — enter edit mode on the grid first (F2), like a user.
      D2.pressCombo("f2");
      await wait(320);
      ae = document.activeElement;
      openedEditor = true;
    }
    if (!editable(ae)) {
      D2.toast(`Couldn't type ${sym} — click into a cell or the formula bar first`);
      return false;
    }
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, sym); // works for
      // contentEditable AND focused input/textarea in Chromium
    } catch (e) {
      inserted = false;
    }
    if (!inserted && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) {
      const before = ae.value;
      const start = ae.selectionStart == null ? ae.value.length : ae.selectionStart;
      const end = ae.selectionEnd == null ? start : ae.selectionEnd;
      ae.setRangeText(sym, start, end, "end");
      ae.dispatchEvent(new Event("input", { bubbles: true }));
      inserted = ae.value !== before;
    }
    if (!inserted) {
      D2.toast(`Couldn't type ${sym} — the editor didn't accept it`);
      return false;
    }
    if (openedEditor) {
      // We opened the cell editor ourselves — commit like the old behavior.
      await wait(60);
      D2.sendKey("enter", document);
      D2.toast(`Typed ${sym}`);
    } else {
      D2.toast(`Inserted ${sym} — Enter commits`);
    }
    return true;
  }

  /* ---------- pure exports for tests ---------- */

  window.OAKExtras = { parseRefs, solveGoal, SYMBOLS };
})();
