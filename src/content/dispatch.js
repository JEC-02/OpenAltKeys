/*
 * OpenAltKeys — dispatch.js
 * Executes one action in the host Google Workspace app. Dispatch cascade:
 *   ["k",  "ctrl+shift+v"]              → synthetic keyboard events
 *   ["m",  "insert", "Rows", "…above"]  → native menu navigation (menus.js)
 *   ["c",  "aria-candidates|…"]         → click toolbar button by aria-label
 *   ["s",  "freeze"]                    → tool finder (Alt+/) search
 *   ["x",  function(ctx){…}]            → custom handler (registered by name)
 *   ["t",  "Message"]                   → show a guidance toast only
 *
 * On macOS every combo is sent the way Google's own help pages document
 * it for Mac: "ctrl" becomes Command where Google uses it (copy, paste,
 * print, headings, comments…), insert/delete rows & columns go out as
 * Cmd+Option+= / −, Find & Replace as Cmd+Shift+H, strikethrough as
 * Cmd+Shift+X, and the tool finder opens with Option+/. Combos whose Mac
 * form keeps the physical Ctrl or Option key (select column Ctrl+Space,
 * number formats Ctrl+Shift+1..6, show-formulas Ctrl+`, compact controls
 * Ctrl+Shift+F, new slide Ctrl+M, Sheets borders Option+Shift+1..7) are
 * sent unchanged — see macDocumented() below, unit-tested against
 * Google's current documentation.
 *
 * Browser-security honesty: synthetic key events are untrusted, so
 * browser-level clipboard and print cannot be driven by them. Clipboard
 * entries still send the combo (the apps' own key handlers may accept it)
 * and then tell the user the real keys to press; printing uses a real
 * window.print() call instead of a synthetic Ctrl+P.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- platform (macOS Cmd translation) ---------- */

  const IS_MAC = (() => {
    try {
      const p = ((navigator.platform || "") + " " +
        ((navigator.userAgentData && navigator.userAgentData.platform) || "")).toLowerCase();
      return p.includes("mac");
    } catch (e) {
      return false;
    }
  })();

  // App context for the per-combo Mac translation ("sheets" | "docs" |
  // "slides"), set by runAction() — custom handlers that call
  // pressCombo()/sendKey() directly inherit it from the enclosing runAction.
  let currentApp = "";

  // Google's documented Mac equivalents for combos whose naive Ctrl→Cmd /
  // Alt→Cmd swap would be wrong (re-checked against the current Google
  // Workspace help pages — engine.test.mjs pins every entry).
  // Pure function (unit-tested). Returns the combo string to send
  // as-documented, or null when the default translation should apply.
  function macDocumented(combo, app) {
    const c = String(combo).replace(/\s/g, "").toLowerCase();
    // --- Google's Mac docs keep the physical Ctrl key for these ---
    if (c === "ctrl+space") return "ctrl+space";             // select column
    if (c === "ctrl+`" || c === "ctrl+~") return c;           // show all formulas
    if (c === "ctrl+shift+f") return "ctrl+shift+f";         // compact controls
    if (c === "ctrl+m" && app === "slides") return "ctrl+m"; // new slide
    if (app === "sheets" && /^ctrl\+shift\+[1-9]$/.test(c)) return c; // formats 1..6
    // --- Google's Mac docs keep the physical Option key ---
    if (c === "alt+/") return "alt+/";                       // tool finder
    if (app === "sheets" && /^alt(\+shift)?\+[1-9]$/.test(c)) return c; // borders ⌥⇧1..7, rename ⌥1
    // --- a different combo entirely on Mac ---
    if (c === "ctrl+h") return "meta+shift+h";               // find & replace ⌘⇧H
    if (c === "alt+shift+5" && app !== "sheets") return "meta+shift+x"; // strikethrough ⌘⇧X
    return null;
  }

  // Pure function (unit-tested): given the parsed modifier set + combo
  // string, return the modifier set to actually send on this platform.
  // (Per-combo exceptions live in macDocumented(), applied in sendKey.)
  function translateMods(mods, combo) {
    if (!IS_MAC) return mods;
    if (mods.has("control") && mods.has("alt")) {
      const m = new Set(mods);
      m.delete("control"); m.add("meta");      // insert/delete rows & columns: ⌘⌥= / ⌘⌥−
      return m;
    }
    if (mods.has("control")) {
      const m = new Set(mods);
      m.delete("control"); m.add("meta");      // Ctrl+C → ⌘C etc.
      return m;
    }
    if (mods.has("alt")) {
      const m = new Set(mods);                 // Alt-based → ⌘-based, except
      m.delete("alt"); m.add("meta");          // where macDocumented() overrides
      return m;
    }
    return mods;
  }

  /* ---------- synthetic keyboard events ---------- */

  // Parse "ctrl+alt+shift+=" style tokens into event fields.
  const KEY_ALIAS = {
    "ctrl": "Control", "control": "Control",
    "alt": "Alt", "option": "Alt",
    "shift": "Shift", "meta": "Meta", "cmd": "Meta", "command": "Meta",
    "up": "ArrowUp", "down": "ArrowDown", "left": "ArrowLeft", "right": "ArrowRight",
    "enter": "Enter", "return": "Enter", "esc": "Escape", "escape": "Escape",
    "tab": "Tab", "space": " ", "spacebar": " ", "backspace": "Backspace",
    "delete": "Delete", "del": "Delete", "home": "Home", "end": "End",
    "pageup": "PageUp", "pagedown": "PageDown",
    "equal": "=", "equals": "=", "plus": "+", "minus": "-", "dash": "-",
    "comma": ",", "period": ".", "dot": ".", "backtick": "`", "grave": "`",
    "lbracket": "[", "rbracket": "]", "backslash": "\\", "slash": "/",
    "f1": "F1", "f2": "F2", "f3": "F3", "f4": "F4", "f5": "F5", "f6": "F6",
    "f7": "F7", "f8": "F8", "f9": "F9", "f10": "F10", "f11": "F11", "f12": "F12",
  };

  const CODE_ALIAS = {
    "=": "Equal", "+": "Equal", "-": "Minus",
    "Enter": "Enter", "Tab": "Tab", "Escape": "Escape", "Backspace": "Backspace",
    "ArrowLeft": "ArrowLeft", "ArrowRight": "ArrowRight",
    "ArrowUp": "ArrowUp", "ArrowDown": "ArrowDown",
    "Delete": "Delete", "Home": "Home", "End": "End",
    "PageUp": "PageUp", "PageDown": "PageDown",
    "F1": "F1", "F2": "F2", "F3": "F3", "F4": "F4", "F5": "F5",
    "F6": "F6", "F7": "F7", "F8": "F8", "F9": "F9", "F10": "F10",
    "F11": "F11", "F12": "F12",
  };

  // Chrome's real keyCode values for punctuation, arrows and F-keys.
  const KEYCODES = {
    ";": 186, "=": 187, ",": 188, "-": 189, ".": 190, "/": 191, "`": 192,
    "[": 219, "\\": 220, "]": 221, "'": 222,
    "ArrowLeft": 37, "ArrowUp": 38, "ArrowRight": 39, "ArrowDown": 40,
    "Enter": 13, "Tab": 9, "Escape": 27, "Backspace": 8, "Delete": 46,
    "Home": 36, "End": 35, "PageUp": 33, "PageDown": 34, " ": 32,
    "F1": 112, "F2": 113, "F3": 114, "F4": 115, "F5": 116, "F6": 117,
    "F7": 118, "F8": 119, "F9": 120, "F10": 121, "F11": 122, "F12": 123,
  };

  function charKeyInfo(ch) {
    // 0-9 a-z get a code name.
    if (/^[0-9]$/.test(ch)) return { code: "Digit" + ch, keyCode: ch.charCodeAt(0) };
    if (/^[a-z]$/i.test(ch)) return { code: "Key" + ch.toUpperCase(), keyCode: ch.toUpperCase().charCodeAt(0) };
    // Named keys arrive as lower-case tokens ("enter", "delete") but the
    // alias tables hold the canonical capitalised names — resolve first,
    // then look up (P2.11: code used to come out empty for these).
    const K = KEY_ALIAS[ch] || ch;
    if (CODE_ALIAS[K]) return { code: CODE_ALIAS[K], keyCode: KEYCODES[K] || KEYCODES[ch] || 0 };
    if (CODE_ALIAS[ch]) return { code: CODE_ALIAS[ch], keyCode: KEYCODES[ch] || 0 };
    if (/^F[0-9]{1,2}$/.test(K)) return { code: K, keyCode: KEYCODES[K] || 0 };
    return { code: "", keyCode: KEYCODES[K] || KEYCODES[ch] || ch.charCodeAt(0) || 0 };
  }

  function fireKeyEvent(target, type, spec) {
    const ev = new KeyboardEvent(type, {
      key: spec.key,
      code: spec.code,
      keyCode: spec.keyCode,
      which: spec.keyCode,
      ctrlKey: spec.ctrl,
      altKey: spec.alt,
      shiftKey: spec.shift,
      metaKey: spec.meta,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    target.dispatchEvent(ev);
  }

  function sendKey(combo, target) {
    const t = target || document;
    // On macOS, combos Google documents differently from the naive
    // modifier swap are sent exactly as documented (macDocumented).
    const documented = IS_MAC ? macDocumented(combo, currentApp) : null;
    if (documented) combo = documented;
    const parts = combo.split("+").map((s) => s.trim()).filter(Boolean);
    const main = parts[parts.length - 1];
    let mods = new Set(parts.slice(0, -1).map((p) => (KEY_ALIAS[p] || p).toLowerCase()));
    if (!documented) mods = translateMods(mods, combo);
    const key = KEY_ALIAS[main] || main;
    const { code } = charKeyInfo(main);
    const spec = {
      key,
      code,
      keyCode: 0,
      ctrl: mods.has("control"),
      alt: mods.has("alt"),
      shift: mods.has("shift"),
      meta: mods.has("meta"),
    };
    if (/^[0-9]$/.test(main)) spec.keyCode = main.charCodeAt(0);
    else if (/^[a-z]$/i.test(main)) spec.keyCode = main.toUpperCase().charCodeAt(0);
    else spec.keyCode = KEYCODES[main] || KEYCODES[key] || 0;
    fireKeyEvent(t, "keydown", spec);
    fireKeyEvent(t, "keyup", spec);
  }

  // Fire a combo at the element Google's editors listen on.
  // Single dispatch only: one document, where the editors bind their
  // keyboard handlers. Dispatching to the active element as well would make
  // events bubble through document handlers twice and double-execute.
  // WHICH document matters: Google Docs keeps focus (and its key
  // handlers) inside an offscreen same-origin iframe — a combo fired at
  // the top document would never be seen there. Resolve the document that
  // holds focus and dispatch into that one; fall back to the top document
  // whenever focus is not inside a reachable frame (Sheets: always).
  function focusedDocument() {
    let doc = document;
    for (let i = 0; i < 6; i++) {
      const ae = doc.activeElement;
      if (!ae || ae.tagName !== "IFRAME") break;
      let inner = null;
      try { inner = ae.contentDocument; } catch (err) { break; }
      if (!inner) break;
      doc = inner;
    }
    return doc;
  }

  function pressCombo(combo) {
    sendKey(combo, focusedDocument());
  }

  async function pressCombos(combos, gapMs = 40) {
    for (const c of combos) {
      pressCombo(c);
      await wait(gapMs);
    }
  }

  /* ---------- toolbar buttons ---------- */

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function clickToolbar(candidates) {
    const wanted = candidates.split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const scopes = [
      document.querySelector("#docs-toolbar"),
      document.querySelector(".docs-toolbar"),
      document.body,
    ].filter(Boolean);
    for (const scope of scopes) {
      const btns = scope.querySelectorAll(
        "button, div[role='button'], .goog-toolbar-button, .docs-toolbar-button, [aria-label]"
      );
      for (const b of btns) {
        if (b.closest("[aria-hidden='true']")) continue;
        const aria = (b.getAttribute("aria-label") || "").trim().toLowerCase();
        const tooltip = (b.getAttribute("data-tooltip") || "").trim().toLowerCase();
        if (!aria && !tooltip) continue;
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (wanted.some((w) => aria === w || aria.startsWith(w + " ") || tooltip === w || tooltip.startsWith(w + " "))) {
          window.OAKMenus.realClick(b);
          return true;
        }
      }
    }
    return false;
  }

  /* ---------- tool finder (Alt+/) search ---------- */

  // Never type the query into these (P1.5): the formula bar, the name box,
  // or anything labelled like them.
  function isForbiddenTarget(el) {
    if (!el) return true;
    if (el.id === "t-formula-bar-input" || el.id === "t-name-box" ||
      el.id === "t-formula-bar-input-container") return true;
    const aria = (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("aria-describedby") || "");
    return /formula|name box/i.test(aria);
  }

  async function searchCommand(query) {
    // Alt+/ focuses Google's "tool finder" (formerly search the menus).
    sendKey("alt+/", focusedDocument());
    await wait(400); // wait for the search box to appear & focus
    const fdoc = focusedDocument();
    let input =
      fdoc.activeElement &&
      (fdoc.activeElement.tagName === "INPUT" || fdoc.activeElement.tagName === "TEXTAREA") &&
      !isForbiddenTarget(fdoc.activeElement)
        ? fdoc.activeElement
        : null;
    if (!input) {
      input = document.querySelector(
        "input[aria-label*='earch'], input.docs-toolfinder-input, input[aria-label*='ind in menu' i]"
      );
    }
    if (!input || isForbiddenTarget(input) || !isVisible(input)) return false;
    input.focus();
    // set value through native setter so Google's listeners see it
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // type the query
    for (const ch of query) {
      setter.call(input, input.value + ch);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(15);
    }
    await wait(500); // results load asynchronously
    // press Enter on the first result
    sendKey("enter", input);
    await wait(300);
    // Honest verdict (P2.10): a command ran only if the finder closed
    // or a results menu opened. No more unconditional success.
    const closed = !document.body.contains(input) || !isVisible(input);
    const menuOpen = [...document.querySelectorAll(".goog-menu")].some(
      (m) => isVisible(m)
    );
    return closed || menuOpen;
  }

  /* ---------- toasts ---------- */

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById("oak-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "oak-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.style.cssText = [
        "position:fixed",
        "left:50%",
        "bottom:48px",
        "transform:translateX(-50%)",
        "background:rgba(32,33,36,.94)",
        "color:#e8eaed",
        "padding:10px 18px",
        "border-radius:8px",
        "font:13px/1.4 Arial,sans-serif",
        "z-index:2147483647",
        "box-shadow:0 4px 14px rgba(0,0,0,.35)",
        "transition:opacity .18s",
        "pointer-events:none",
        "max-width:70vw",
      ].join(";");
      document.documentElement.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = "0";
    }, 2600);
  }

  /* ---------- custom handlers registry ---------- */

  const customHandlers = new Map();
  function registerCustom(name, fn) {
    customHandlers.set(name, fn);
  }

  // Built-in handler shared by every app: print via a real window.print()
  // call — synthetic Ctrl+P can never open the browser's print dialog.
  registerCustom("printPage", async function () {
    window.print();
    return true;
  });

  /* ---------- clipboard honesty (P1.1) ---------- */

  // Untrusted key events cannot drive the browser-level clipboard. The apps'
  // own key handlers may still accept them, so we send the combo and then
  // tell the user the real keys in case nothing happened.
  function isClipboardCombo(combo) {
    return /^(ctrl|cmd|meta)(\+shift)?\+[cvx]$/.test(String(combo).replace(/\s/g, ""));
  }

  function prettyCombo(combo) {
    return IS_MAC
      ? combo.replace(/ctrl|cmd|meta/, "⌘").replace(/\+/g, "").replace(/shift/, "⇧")
      : combo.replace(/\+/g, "+").replace("ctrl", "Ctrl").replace("shift", "Shift");
  }

  /* ---------- action executor ---------- */

  // Runs an action spec. Returns { ok } — false means "verifiably did not
  // run", so the engine can surface a failure toast (P2.10).
  async function runAction(spec, ctx) {
    if (!spec) return { ok: false };
    currentApp = (ctx && ctx.app) || ""; // Mac combo translation context
    const kind = spec[0];
    const type = kind;
    let ok = false;
    // Google Sheets: arm the heads-up guard so Google's protected-range
    // warning ("…Edit anyway?") cannot stall a keyboard-driven command.
    // Guides ("t") show text only — nothing to confirm. Docs and Slides
    // load no guard, so the call is a safe no-op there (P1.7).
    if (type !== "t") {
      try { window.OAKDialogGuard && window.OAKDialogGuard.arm(); } catch (e) { /* ignore */ }
    }
    try {
      switch (type) {
        case "k": {
          const combos = String(spec[1]).split(/\s*,\s*/).filter(Boolean);
          await pressCombos(combos);
          ok = true; // fire-and-forget: synthetic keys cannot be verified
          if (isClipboardCombo(combos[0])) {
            const label = (ctx && ctx.label) || "Command";
            toast(
              label + ": if nothing happened, press " + prettyCombo(combos[0]) +
              " yourself — browser security blocks synthetic clipboard keys"
            );
          }
          break;
        }
        case "m":
          ok = await window.OAKMenus.runMenuPath(spec[1], spec.slice(2));
          break;
        case "c":
          ok = clickToolbar(spec[1]);
          if (!ok && spec[2]) ok = await searchCommand(spec[2]);
          break;
        case "s":
          ok = await searchCommand(spec[1]);
          break;
        case "x": {
          const fn = customHandlers.get(spec[1]);
          if (fn) ok = !!(await fn(ctx || {}, spec.slice(2)));
          break;
        }
        case "t":
          toast(spec[1] || "Not available here");
          ok = true;
          break;
      }
    } catch (e) {
      ok = false;
    }
    return { ok };
  }

  // Register the app-specific handlers defined in the data files.
  if (window.OAK_CUSTOM) {
    for (const [name, fn] of Object.entries(window.OAK_CUSTOM)) {
      registerCustom(name, fn);
    }
  }

  window.OAKDispatch = {
    sendKey,
    pressCombo,
    pressCombos,
    clickToolbar,
    searchCommand,
    toast,
    registerCustom,
    runAction,
    wait,
    __test: { translateMods, macDocumented, charKeyInfo, isClipboardCombo, IS_MAC, hasCustom: (n) => customHandlers.has(n) },
  };
})();
