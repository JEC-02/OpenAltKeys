/*
 * OpenAltKeys — engine.js
 * The Alt key-tip state machine.
 *
 *  • A discrete tap of Alt (press and release with no other key in between)
 *    → key-tips appear. Holding Alt while typing a letter is a native Google
 *    combo (Alt+/, Alt+1, Alt+Enter, Alt+H menus…) and is passed through
 *    untouched — the extension never breaks Google's own shortcuts.
 *  • Letters / digits (no other modifier) → walk the sequence tree.
 *  • Node kinds, mirroring Office ribbon behaviour:
 *      menu  – a heading with children, nothing runs;
 *      leaf  – an action with no children, runs immediately, tips close;
 *      open  – an action with children: runs now, tips stay open
 *              (e.g. opening a palette you can pick inside);
 *      defer – an action with children: waits DEFER_MS (or Enter) so a
 *              longer sequence can win, exactly like Office.
 *  • Esc closes. F10 cycles show → ghost → hidden (can be turned off).
 *  • F4 repeats the last command (Excel muscle memory) — but only while
 *    not editing text, so Sheets' native formula-bar F4 (absolute/relative
 *    toggle) keeps working.
 *  • Ctrl + +/− (Sheets only, not while editing): Excel-style picker —
 *    R row, C column. The row/column is selected first, because Google's
 *    Ctrl+Alt+= / − act on the selection.
 *  • Sequences whose prefix is listed in settings.disabledSeqs are
 *    IGNORED: every key of the sequence is swallowed and the tips close.
 *    A native pass-through is impossible mid-sequence (the letters before
 *    the match were already consumed by the tips, and Google's Alt
 *    shortcuts need Alt held), so letting the last key through could only
 *    type a stray character into the document.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const DEFER_MS = 1200;   // Office-style grace period for short sequences
  const IDLE_HIDE_MS = 12000;
  // v1.1.3 compact idle: fade to a ghost first (the same 38 % look as the
  // F10 ghost mode), then hide entirely — instead of parking at full
  // opacity for half a minute. Never applies while an extras panel owns
  // the overlay, and never overrides a user-chosen F10 ghost mode.
  const IDLE_GHOST_MS = 4000;

  const Engine = {
    app: null,          // "sheets" | "docs" | "slides"
    data: null,         // raw entry list for the current app
    tree: null,         // built trie
    active: false,
    prefix: "",
    node: null,
    deferTimer: null,
    deferAction: null,
    altArmed: false,    // second discrete Alt tap toggles tips closed (Office parity)
    altWaitOpen: false, // Alt keydown seen; tips open on keyup if no other key intervened
    idleTimer: null,
    idleGhostTimer: null, // transient idle fade (v1.1.3) — never overrides F10 ghost
    lastAction: null,   // for F4
    lastLabel: "",
    disabledSeqs: [],   // user-disabled sequence prefixes (["HV","FF",…])
    settings: {
      f4Repeat: true,
      ctrlRowCol: true,
      f10Modes: true,
      enabled: true,
    },
  };

  /* ---------- sequence tree ---------- */
  // Nodes: { key, label, group, action, children: Map, hasAction }
  // Entry: { seq: "HVV", label, group, action, mode?: "leaf"|"open"|"defer" }

  function buildTree(entries) {
    const root = { key: "", label: "", group: "", action: null, children: new Map() };
    for (const e of entries) {
      if (!e || !e.seq) continue;
      let node = root;
      for (const ch of e.seq) {
        const K = ch.toUpperCase();
        if (!node.children.has(K)) {
          node.children.set(K, {
            key: K,
            label: "",
            group: e.group || "",
            action: null,
            mode: null,
            children: new Map(),
          });
        }
        node = node.children.get(K);
      }
      // deeper label wins (more specific); keep group of the deepest entry
      node.label = e.label || node.label;
      if (e.group) node.group = e.group;
      if (e.action) {
        node.action = e.action;
        if (e.mode) node.mode = e.mode;
      }
    }
    fillLabels(root);
    return root;
  }

  // Intermediate nodes ("V" inside Home, say) have no data entry of their own.
  // Give them a human label inherited from their descendants (the group name
  // when available — "Clipboard", "Font", …) so the panel never shows blanks.
  function fillLabels(node) {
    if (node.label) {
      for (const [, child] of node.children) fillLabels(child);
      return node.label;
    }
    let group = "";
    let label = "";
    const walk = (n) => {
      if (!group && n.group) group = n.group;
      if (!label && n.label) label = n.label;
      if (group && label) return;
      for (const [, c] of n.children) {
        walk(c);
        if (group && label) return;
      }
    };
    walk(node);
    node.label = group || label || "";
    for (const [, child] of node.children) fillLabels(child);
    return node.label;
  }

  function resolveNodeKind(node, defaultDefer) {
    // returns "menu" | "leaf" | "open" | "defer"
    const hasKids = node.children.size > 0;
    const hasAct = !!node.action;
    if (!hasKids) return hasAct ? "leaf" : "menu";
    if (!hasAct) return "menu";
    if (node.mode === "open") return "open";
    if (node.mode === "defer") return "defer";
    if (node.mode === "leaf") return "leaf";
    return defaultDefer ? "defer" : "open";
  }

  /* ---------- disabled sequences (user opt-out) ---------- */

  // A sequence is disabled when any user token is a prefix of it
  // ("HV" disables HV and everything below it; "HVV" only that leaf).
  function matchDisabled(seq, tokens) {
    const list = tokens || Engine.disabledSeqs;
    const s = String(seq || "").toUpperCase();
    for (const t of list) {
      const tok = String(t || "").trim().toUpperCase();
      if (tok && s.startsWith(tok)) return tok;
    }
    return null;
  }

  /* ---------- overlay rendering ---------- */

  function tabsFromTree() {
    const tabs = [];
    for (const [k, node] of Engine.tree.children) {
      tabs.push({ key: k, label: node.label || k, seq: k });
    }
    return tabs;
  }

  function entriesFromNode(node) {
    const out = [];
    for (const [k, child] of node.children) {
      out.push({
        key: k,
        label: child.label || k,
        group: child.group || "",
        more: child.children.size > 0,
      });
    }
    return out;
  }

  function render() {
    if (!Engine.active) {
      window.OAKOverlay.hide();
      return;
    }
    if (Engine.prefix === "") {
      window.OAKOverlay.showTabs(tabsFromTree(), onPickKey, closeTips);
    } else {
      window.OAKOverlay.showPanel("Alt " + Engine.prefix, entriesFromNode(Engine.node), onPickKey);
    }
  }

  function onPickKey(k) {
    feedKey(k);
  }

  /* ---------- defer handling ---------- */

  function cancelDefer() {
    if (Engine.deferTimer) {
      clearTimeout(Engine.deferTimer);
      Engine.deferTimer = null;
      Engine.deferAction = null;
    }
  }

  function scheduleDefer(action, label) {
    cancelDefer();
    Engine.deferAction = action;
    Engine.deferLabel = label;
    Engine.deferTimer = setTimeout(async () => {
      Engine.deferTimer = null;
      const act = Engine.deferAction;
      const lbl = Engine.deferLabel;
      Engine.deferAction = null;
      if (act) await execute(act, true, lbl);
    }, DEFER_MS);
  }

  async function flushDefer() {
    const act = Engine.deferAction;
    const lbl = Engine.deferLabel;
    cancelDefer();
    if (act) {
      await execute(act, true, lbl);
      return true;
    }
    return false;
  }

  /* ---------- execution ---------- */

  async function execute(action, closeAfter, label) {
    if (!action) return;
    Engine.lastAction = action;
    Engine.lastLabel = label || Engine.lastLabel || "";
    let res = { ok: true };
    try {
      res = await window.OAKDispatch.runAction(action, {
        app: Engine.app,
        prefix: Engine.prefix,
        label: Engine.lastLabel,
      });
    } catch (e) {
      /* action executors swallow their own errors */
      res = { ok: false };
    }
    if (res && res.ok === false && Engine.settings.enabled) {
      // Visible failure instead of silence (P2.10): say what didn't run and,
      // when the UI language isn't English, why label-matched menus often fail.
      const lang = (document.documentElement && document.documentElement.lang) || "";
      const localeHint = !lang || /^en/i.test(lang)
        ? ""
        : " — menu labels match the English Google UI";
      window.OAKDispatch?.toast("✗ " + (label || "Command") + " didn't run" + localeHint);
    }
    if (closeAfter && Engine.active) closeTips();
  }

  /* ---------- key tip lifecycle ---------- */

  function openTips() {
    if (!Engine.tree || Engine.active) return;
    // An extras panel (trace list, goal-seek form) owns the overlay — never
    // wipe it by opening the ribbon tips on top.
    if (window.OAKOverlay && window.OAKOverlay.isVisible && window.OAKOverlay.isVisible()) return;
    Engine.active = true;
    Engine.prefix = "";
    Engine.node = Engine.tree;
    Engine.altArmed = false;
    render();
    armIdle();
  }

  function closeTips() {
    Engine.altArmed = false;
    // Extras panels (trace list, goal-seek form) close the tips themselves
    // and then own the overlay — later closeTips calls must not wipe them.
    if (!Engine.active) return;
    Engine.active = false;
    Engine.prefix = "";
    Engine.node = null;
    cancelDefer();
    disarmIdle();
    window.OAKOverlay.hide();
  }

  function armIdle() {
    disarmIdle();
    if (!Engine.active) return; // an extras panel owns the screen now
    // stage 1: transient fade-to-ghost — only in "show" mode, so a
    // user-chosen F10 ghost/hidden mode is never touched
    Engine.idleGhostTimer = setTimeout(() => {
      if (Engine.active && window.OAKOverlay && window.OAKOverlay.mode === "show" &&
          window.OAKOverlay.transientGhost) {
        window.OAKOverlay.transientGhost(true);
      }
    }, IDLE_GHOST_MS);
    // stage 2: close
    Engine.idleTimer = setTimeout(() => closeTips(), IDLE_HIDE_MS);
  }
  function disarmIdle() {
    if (Engine.idleTimer) clearTimeout(Engine.idleTimer);
    Engine.idleTimer = null;
    if (Engine.idleGhostTimer) clearTimeout(Engine.idleGhostTimer);
    Engine.idleGhostTimer = null;
    // lift only OUR transient fade — a user-chosen F10 ghost stays
    if (window.OAKOverlay && window.OAKOverlay.transientGhost) {
      window.OAKOverlay.transientGhost(false);
    }
  }

  /* ---------- walking ---------- */

  async function feedKey(k) {
    disarmIdle();
    Engine.altArmed = false; // a real key was fed: Alt is being used for a combo
    const upper = String(k).toUpperCase();
    if (upper === "ESCAPE") {
      closeTips();
      return;
    }
    if (upper === "ENTER") {
      const fired = await flushDefer();
      if (!fired) closeTips();
      return;
    }
    if (upper === "BACKSPACE") {
      // step back one letter, like re-typing — shared by the page keydown
      // handler and the overlay's focus mode (re-audit 2.2)
      if (Engine.prefix.length > 1) {
        Engine.prefix = Engine.prefix.slice(0, -1);
        let n = Engine.tree;
        for (const c of Engine.prefix) n = n.children.get(c);
        Engine.node = n;
        cancelDefer();
        render();
      } else {
        closeTips();
      }
      return;
    }
    // v1.1.3 re-audit residual — the disabled-sequence guard lives HERE, the
    // single choke point every input path funnels through: page keydown,
    // the overlay's focus-mode forwarder, and panel row clicks. Special
    // names (ESCAPE/ENTER/BACKSPACE) are handled above, so a disabled "B"
    // token can never break Backspace stepping.
    if (upper.length === 1 && matchDisabled(Engine.prefix + upper)) {
      closeTips();
      return;
    }
    const next = Engine.node.children.get(upper);
    if (!next) {
      // unknown letter — close like Office does
      closeTips();
      return;
    }
    Engine.prefix += upper;
    Engine.node = next;
    cancelDefer();

    const kind = resolveNodeKind(next, Engine.app !== "sheets");
    switch (kind) {
      case "menu":
        render();
        break;
      case "leaf":
        await execute(next.action, true, next.label);
        break;
      case "open":
        await execute(next.action, false, next.label);
        render(); // stay open for deeper picks
        break;
      case "defer":
        scheduleDefer(next.action, next.label);
        render();
        break;
    }
    armIdle();
  }

  /* ---------- key identification (e.code based, cross-platform) ---------- */

  function codeToChar(code, key) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
    if (code === "Equal" || code === "NumpadAdd") return "=";
    if (code === "Minus" || code === "NumpadSubtract") return "-";
    if (code === "Slash" || code === "NumpadDivide") return "/";
    // Fallback for exotic layouts: use e.key when it's a plain letter/digit
    if (key && /^[0-9a-z]$/i.test(key)) return key.toUpperCase();
    return null;
  }

  function isBareAlt(e) {
    return (
      (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight") &&
      !e.ctrlKey && !e.metaKey && !e.shiftKey &&
      !e.getModifierState?.("AltGraph") &&
      !e.repeat
    );
  }

  /* ---------- target classification ---------- */

  // Structural "this is a text entry element" check.
  function isTextEntry(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const t = el.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
  }

  // TRUE only when the user is ACTIVELY editing: a text-entry element that
  // actually renders with size. Google Sheets keeps a hidden zero-width
  // cell editor (#waffle-rich-text-editor) focused even while idle — that
  // is NOT editing, so Alt/F4/repeat must keep working there. A visible
  // formula bar, in-cell editor, comment box or the Docs page editor IS.
  function isEditing(el) {
    if (!isTextEntry(el)) return false;
    let r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    // Frame-aware visibility (v1.1.5): rects inside an iframe are FRAME-LOCAL
    // and their visible extent is CLIPPED to the frame's box. Google's
    // editors park keyboard focus in offscreen text-event iframes — Docs:
    // .docs-texteventtarget-iframe-negative-top at y:-10000; Slides: the
    // same frame collapsed to a 1x1 box at (0,-1). Their contenteditable
    // divs report healthy 600-900px rects in frame-local coordinates, which
    // v1.1.4 mistook for "user is actively typing in a visible editor" and
    // closed the tips on the first letter (Alt worked, Alt+H vanished).
    // Walk the frame chain, translate AND clip the rect to every frame's
    // box, then require a genuinely visible, user-sized editor.
    let doc = el.ownerDocument;
    for (let i = 0; i < 6; i++) {
      if (!doc || doc === document) break;
      const win = doc.defaultView;
      const frame = win && win.frameElement;
      if (!frame) break;
      const fr = frame.getBoundingClientRect();
      const left = Math.max(r.left + fr.left, fr.left);
      const top = Math.max(r.top + fr.top, fr.top);
      const right = Math.min(r.right + fr.left, fr.right);
      const bottom = Math.min(r.bottom + fr.top, fr.bottom);
      r = { left, top, right, bottom, width: right - left, height: bottom - top };
      if (r.width <= 0 || r.height <= 0) return false; // clipped away entirely
      doc = frame.ownerDocument;
    }
    return (
      r.width >= 8 && r.height >= 8 &&
      r.top < window.innerHeight && r.bottom > 0 &&
      r.left < window.innerWidth && r.right > 0
    );
  }

  function inOAKUI(el) {
    return !!(el && el.closest &&
      el.closest("#oak-overlay-root, #oak-picker, #oak-toast"));
  }

  /* ---------- Excel-parity insert/delete picker (Sheets only) ---------- */

  let pickerActive = false;
  function showRowColPicker(mode) {
    if (pickerActive) return; // never stack pickers (Ctrl+Plus twice)
    // Excel's Ctrl+Plus / Ctrl+Minus insert/delete dialog spirit:
    // small centered prompt: R = rows, C = columns (Esc cancels).
    pickerActive = true;
    const el = document.createElement("div");
    el.id = "oak-picker";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", mode === "insert" ? "Insert rows or columns" : "Delete rows or columns");
    el.style.cssText =
      "position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:2147483000;" +
      "background:rgba(24,26,32,.97);color:#e8eaed;border:1px solid rgba(255,255,255,.14);" +
      "border-radius:10px;padding:12px 16px;font:13px Arial,sans-serif;" +
      "box-shadow:0 8px 28px rgba(0,0,0,.45)";
    el.innerHTML =
      mode === "insert"
        ? "<b style='color:#8ab4f8'>Insert</b> &nbsp; <b>R</b> row above · <b>C</b> column left · Esc cancel"
        : "<b style='color:#8ab4f8'>Delete</b> &nbsp; <b>R</b> rows · <b>C</b> columns · Esc cancel";
    document.documentElement.appendChild(el);
    const onKey = (ev) => {
      const c = codeToChar(ev.code, ev.key);
      if (c === "R" || c === "C") {
        ev.preventDefault(); ev.stopImmediatePropagation();
        cleanup();
        window.OAKDispatch.runAction(
          ["x", "sheetsInsertDelete", c === "R" ? "row" : "col", mode]
        );
      } else if (ev.key === "Escape") {
        ev.preventDefault(); ev.stopImmediatePropagation();
        cleanup();
      }
    };
    function cleanup() {
      pickerActive = false;
      document.removeEventListener("keydown", onKey, true);
      el.remove();
    }
    document.addEventListener("keydown", onKey, true);
  }

  /* ---------- global key listener ---------- */

  function onKeyDown(e) {
    // Only react to real user input — synthetic events are ours (dispatch.js)
    // or the page's; intercepting them would break command execution.
    if (!e.isTrusted) return;
    if (!Engine.settings.enabled) return;

    // A key other than Alt while Alt is held = a native combo, not a tap.
    if (Engine.altWaitOpen && !isBareAlt(e)) Engine.altWaitOpen = false;

    // The extension's own UI (overlay, picker, toast) handles its own keys.
    if (inOAKUI(e.target)) return;

    // F10 — cycle overlay modes (Office parity). Opt-out via settings and
    // never hijacked while the user is actively editing text (P1.15).
    if (
      e.key === "F10" && !e.ctrlKey && !e.metaKey && !e.altKey &&
      Engine.settings.f10Modes !== false &&
      !isEditing(e.target)
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.OAKOverlay.cycleMode();
      return;
    }

    // F4 — repeat last command (Excel parity). Only when not actively
    // editing: in Sheets' formula bar / cell editor F4 is the native
    // absolute/relative toggle (P1.2). The idle grid's hidden zero-width
    // editor does NOT count as editing.
    if (
      e.key === "F4" && !e.ctrlKey && !e.metaKey && !e.altKey &&
      Engine.settings.f4Repeat && Engine.lastAction &&
      !isEditing(e.target)
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      execute(Engine.lastAction, false, Engine.lastLabel);
      return;
    }

    // Excel-style Ctrl+Plus / Ctrl+Minus insert & delete — Sheets only
    // (on Docs/Slides these combos are browser zoom and pass through),
    // never while editing, never stacked (P1.3).
    if (
      Engine.app === "sheets" && Engine.settings.ctrlRowCol && !pickerActive &&
      (e.ctrlKey || e.metaKey) && !e.altKey &&
      !isEditing(e.target)
    ) {
      const isPlus = e.key === "+" || e.key === "=" || e.code === "Equal" ||
        e.code === "NumpadAdd";
      const isMinus = e.key === "-" || e.code === "Minus" || e.code === "NumpadSubtract";
      if (isPlus || isMinus) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showRowColPicker(isPlus ? "insert" : "delete");
        return;
      }
    }

    // Activation arm: a bare Alt keydown may become a "tap Alt" — the tips
    // open on keyUP only if no other key intervened, so real Alt-combos
    // (Alt+/, Alt+1, Alt+Enter, Alt+H…) always reach Google untouched (P1.13).
    // Activation is allowed regardless of focus — typing protection happens
    // at consumption time (letters into a visible editor are never consumed).
    if (!Engine.active) {
      if (isBareAlt(e)) {
        Engine.altWaitOpen = true; // no preventDefault: the keydown stays native
      }
      return; // never touch anything else while inactive
    }

    // ---- key-tips are active ----

    // A second, discrete Alt press arms the toggle-close on its keyup.
    if (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight") {
      e.preventDefault();
      Engine.altArmed = true;
      return;
    }

    // Any key with Alt/Ctrl/Meta/AltGraph held → a native Google combo:
    // close the tips and pass it through completely untouched (P1.13).
    if (e.altKey || e.ctrlKey || e.metaKey || e.getModifierState?.("AltGraph")) {
      closeTips();
      return;
    }

    // Focus is in a VISIBLE text field (formula bar, comment, open cell
    // editor, the Docs page editor): stop swallowing letters — close the
    // tips and let the user type (P1.8). The idle grid's hidden zero-width
    // editor does not count.
    if (isEditing(e.target)) {
      closeTips();
      return;
    }

    const ch = codeToChar(e.code, e.key);
    if (ch) {
      // User-disabled sequence prefixes are IGNORED (P2.21): the
      // completing key is swallowed too and the tips close — nothing
      // reaches the page. The letters before the match were already
      // consumed by the tips, so a native pass-through here could only
      // leak a stray character into the document (re-audit 2.1: Alt H V
      // with "HV" disabled used to start editing the cell with "V").
      const next = Engine.node.children.get(ch);
      if (next && matchDisabled(Engine.prefix + ch)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeTips();
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      feedKey(ch);
      return;
    }
    if (ch === null && (e.key === "=" || e.key === "-")) {
      // exotic layouts where code lookup failed
      e.preventDefault();
      e.stopImmediatePropagation();
      feedKey(e.key);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopImmediatePropagation();
      feedKey("ENTER");
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeTips();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      e.stopImmediatePropagation();
      feedKey("BACKSPACE"); // step-back logic lives in feedKey (shared)
      return;
    }

    // Tab — hand focus to the overlay so its controls are keyboard
    // reachable: they cycle with Tab, activate with Enter/Space, and Esc
    // returns to the page (re-audit 2.2 — the overlay's claim is now
    // real). When nothing is focusable (hidden mode), close instead.
    if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const focused = !!(
        window.OAKOverlay && window.OAKOverlay.focusFirst &&
        window.OAKOverlay.focusFirst(e.shiftKey)
      );
      if (focused) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      closeTips();
      return; // Tab keeps travelling natively
    }

    // Everything else (arrows, space…) closes the tips and passes through
    if (["Shift", "CapsLock", "Dead"].includes(e.key)) return;
    closeTips();
  }

  // Alt keyup — two jobs:
  //  1. a bare Alt tap (no other key in between, no other modifier) opens tips;
  //  2. a second discrete tap while tips are open toggles them closed.
  // Holding Alt for a combo (Alt+H…) is disarmed by the keydown listener.
  function onKeyUpGlobal(e) {
    if (!e.isTrusted) return;
    if (e.key !== "Alt" && e.code !== "AltLeft" && e.code !== "AltRight") return;
    const clean =
      !e.ctrlKey && !e.metaKey && !e.shiftKey &&
      !e.getModifierState?.("AltGraph");
    if (Engine.altWaitOpen) {
      Engine.altWaitOpen = false;
      if (clean && !Engine.active && Engine.settings.enabled) {
        e.preventDefault(); // keep the browser's Alt-menu focus out of the way
        openTips();
      }
      return;
    }
    if (Engine.active && Engine.altArmed) {
      Engine.altArmed = false;
      if (clean) closeTips();
    }
  }

  /* ---------- same-origin frame instrumentation ----------
   * Google Docs routes every keystroke through an offscreen, hidden
   * same-origin iframe (.docs-texteventtarget-iframe) that holds keyboard
   * focus the whole time the document is being edited. Events inside an
   * iframe never bubble across the frame boundary, so the document-level
   * capture listeners below would never see them — Alt tips worked in
   * Sheets (focus: #waffle-rich-text-editor, top document) but not in
   * Docs. Fix: attach the same capture listeners inside every reachable
   * same-origin frame, discovered live — Docs recreates its text-event
   * frame on mode switches, so a MutationObserver re-sweeps. Cross-origin
   * frames are skipped by construction (contentDocument is unreachable).
   * Synthetic events stay ours (isTrusted gate) — nothing changes for
   * command execution.
   */

  const instrumentedDocs = new WeakSet();
  let frameSweepTimer = 0;

  function onPagePointerDown(e) {
    if (!e.isTrusted || !Engine.active) return;
    if (inOAKUI(e.target)) return;
    closeTips();
  }

  function onPageFocusIn(e) {
    if (!Engine.active) return;
    if (inOAKUI(e.target) || !isEditing(e.target)) return;
    closeTips();
  }

  function instrumentFrameDoc(doc) {
    if (!doc || instrumentedDocs.has(doc)) return;
    try {
      doc.addEventListener("keydown", onKeyDown, true);
      doc.addEventListener("keyup", onKeyUpGlobal, true);
      doc.addEventListener("pointerdown", onPagePointerDown, true);
      doc.addEventListener("focusin", onPageFocusIn, true);
      instrumentedDocs.add(doc);
    } catch (err) {
      /* detached or being replaced — the next sweep retries */
    }
  }

  function sweepFrames(rootDoc) {
    const seen = new Set();
    (function walk(doc) {
      if (!doc || seen.has(doc)) return;
      seen.add(doc);
      let frames = [];
      try { frames = doc.querySelectorAll("iframe"); } catch (err) { return; }
      for (const f of frames) {
        let d = null;
        try { d = f.contentDocument; } catch (err) { /* cross-origin */ }
        if (!d) continue; // cross-origin or not yet committed
        instrumentFrameDoc(d);
        walk(d); // nested same-origin frames
      }
    })(rootDoc || document);
  }

  function scheduleFrameSweep() {
    clearTimeout(frameSweepTimer);
    frameSweepTimer = setTimeout(() => sweepFrames(document), 300);
  }

  /* ---------- bootstrap ---------- */

  function init(app, entries, settings) {
    Engine.app = app;
    Engine.data = entries;
    Engine.tree = buildTree(entries);
    Object.assign(Engine.settings, settings || {});
    if (Array.isArray(Engine.settings.disabledSeqs)) {
      Engine.disabledSeqs = Engine.settings.disabledSeqs;
    }
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUpGlobal, true);
    // Clicking into the page closes the tips (only window-blur used to).
    document.addEventListener("pointerdown", onPagePointerDown, true);
    // Focus landing in a visible text field also closes them (P1.8).
    document.addEventListener("focusin", onPageFocusIn, true);
    // If the page focus moves (user clicks a dialog), close tips politely.
    window.addEventListener("blur", () => {
      if (Engine.active) closeTips();
    });
    // Same-origin iframes (Docs' hidden text-event frame, live dialogs):
    // instrument what exists now and watch for frames added later.
    sweepFrames(document);
    try {
      new MutationObserver(scheduleFrameSweep).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (err) { /* MutationObserver is everywhere MV3 runs */ }
  }

  function updateSettings(s) {
    Object.assign(Engine.settings, s || {});
    if (Array.isArray(Engine.settings.disabledSeqs)) {
      Engine.disabledSeqs = Engine.settings.disabledSeqs;
    }
    if (Engine.settings.enabled === false) {
      closeTips();
      window.OAKOverlay?.hide();
    }
  }

  window.OAKEngine = {
    init, updateSettings, buildTree, resolveNodeKind, closeTips, feedKey,
    matchDisabled, Engine,
  };
})();
