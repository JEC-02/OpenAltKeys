/*
 * OpenAltKeys — overlay.js
 * The on-screen key-tip UI, in the spirit of the Microsoft Office ribbon
 * KeyTips: a slim badge bar appears when Alt (Option) is tapped, then a
 * grouped, filterable panel of next-letters while you type. F10 cycles
 * show → ghost → hidden. Fully clickable AND keyboard reachable: Tab
 * moves focus into the overlay and cycles its controls, Enter/Space
 * activate the focused control, Esc closes; plain letters keep driving
 * the key-tip sequence while the overlay holds focus. ARIA roles on
 * every control.
 *
 * Extras panels (trace list, goal-seek form, symbol palette) are ALWAYS
 * rendered fully visible — the ghost/hidden modes only apply to the
 * passive key-tip bar, never to an interactive dialog (P1.9).
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const Z = 2147483000;
  const rootId = "oak-overlay-root";

  const CSS = `
  #${rootId} { all: initial; }
  #${rootId} *, #${rootId} *::before, #${rootId} *::after { box-sizing: border-box; }
  #${rootId} {
    position: fixed;
    top: 64px; left: 50%;
    transform: translateX(-50%);
    z-index: ${Z};
    font-family: Arial, Helvetica, "Segoe UI", Roboto, sans-serif;
    color: #e8eaed;
    pointer-events: none;
    max-width: min(92vw, 760px);
  }
  #${rootId}.oak-ghost { opacity: .38; }
  #${rootId}.oak-ghost:hover { opacity: 1; }
  #${rootId}.oak-hidden { display: none; }
  /* v1.1.3 transient idle fade (engine armIdle): the same 38 % look as the
     F10 ghost, but lifted by any key/click/render — the user's own F10
     mode is never touched (engine gates this on mode === "show"). */
  #${rootId}.oak-idle-ghost { opacity: .38; transition: opacity .4s ease; }
  #${rootId}.oak-idle-ghost:hover { opacity: 1; }
  .oak-bar {
    pointer-events: auto;
    display: flex; flex-wrap: nowrap; align-items: center;
    gap: 4px 10px;
    background: rgba(24,26,32,.97);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 10px;
    padding: 5px 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,.45);
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: none;
  }
  .oak-bar::-webkit-scrollbar { display: none; }
  .oak-tab { display: flex; align-items: center; gap: 6px; cursor: pointer;
             padding: 2px 4px; border-radius: 6px; flex: 0 0 auto; }
  .oak-tab:hover, .oak-tab:focus-visible { background: rgba(255,255,255,.08); outline: none; }
  .oak-key {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 21px; height: 21px; padding: 0 3px;
    background: #fdf6d3; color: #2b2a1d;
    border: 1px solid #c9bd80; border-bottom-width: 2px;
    border-radius: 5px;
    font-size: 12px; font-weight: 700; line-height: 1;
  }
  .oak-key.digit { background: #d9e7ff; border-color: #93a9cf; color: #1d2b46; }
  /* Compact strip (v1.1.3): labels are hidden until the bar is hovered or
     keyboard-focused — a pure badge strip, like Office's own KeyTips. The
     hint may shrink to an ellipsis (never force overflow — v1.1.4 audit
     nit 3): tabs and the close button always win the space race. */
  .oak-tablabel { font-size: 12.5px; color: #cfd4dd; white-space: nowrap;
    max-width: 0; opacity: 0; overflow: hidden;
    transition: max-width .15s ease, opacity .15s ease; }
  .oak-bar:hover .oak-tablabel,
  .oak-bar:focus-within .oak-tablabel { max-width: 220px; opacity: 1; }
  .oak-hint { font-size: 11px; color: #9aa0a6; margin-left: 4px; white-space: nowrap;
    flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .oak-close { pointer-events: auto; margin-left: 2px; cursor: pointer;
    color: #9aa0a6; font-size: 14px; padding: 2px 8px; border-radius: 6px;
    position: sticky; right: 0; flex: 0 0 auto;
    background: rgba(24,26,32,.97); box-shadow: -8px 0 12px rgba(24,26,32,.9); }
  .oak-close:hover, .oak-close:focus-visible { background: rgba(255,255,255,.1); color: #fff; outline: none; }
  .oak-panel {
    pointer-events: auto;
    margin-top: 6px;
    background: rgba(24,26,32,.97);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 10px;
    padding: 10px 14px 12px;
    box-shadow: 0 10px 32px rgba(0,0,0,.5);
    max-height: min(40vh, 360px);
    overflow-y: auto;
  }
  .oak-panel::-webkit-scrollbar { width: 10px; }
  .oak-panel::-webkit-scrollbar-thumb { background: #4b5058; border-radius: 6px; }
  .oak-crumb { font-size: 12px; color: #8ab4f8; margin-bottom: 8px; letter-spacing: .4px; }
  .oak-crumb b { color: #cdd7f5; }
  .oak-filter {
    all: unset; box-sizing: border-box; width: 100%; margin-bottom: 8px;
    background: #1f2126; color: #e8eaed; border: 1px solid #5f6368;
    border-radius: 6px; padding: 5px 9px; font: 12.5px/1.3 Arial, sans-serif;
  }
  .oak-filter:focus { border-color: #8ab4f8; }
  .oak-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
              gap: 2px 18px; }
  .oak-group { margin: 6px 0 2px; font-size: 10.5px; text-transform: uppercase;
               letter-spacing: .8px; color: #9aa0a6; grid-column: 1 / -1; }
  .oak-row { display: flex; align-items: center; gap: 7px; padding: 3px 4px;
             border-radius: 6px; cursor: pointer; }
  .oak-row:hover, .oak-row:focus-visible { background: rgba(255,255,255,.08); outline: none; }
  .oak-row.oak-static { cursor: default; color: #9aa0a6; }
  .oak-row.oak-static:hover { background: none; }
  .oak-row .oak-k { display: inline-flex; align-items: center; justify-content: center;
      min-width: 21px; height: 21px; padding: 0 3px;
      background: #fdf6d3; color: #2b2a1d;
      border: 1px solid #c9bd80; border-bottom-width: 2px; border-radius: 4px;
      font-size: 11.5px; font-weight: 700; }
  .oak-row .oak-k.digit { background: #d9e7ff; border-color: #93a9cf; color: #1d2b46; }
  .oak-row .oak-l { font-size: 12.5px; color: #dfe3e9; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
  .oak-row .oak-more { color: #8ab4f8; font-size: 11px; margin-left: 1px; }
  .oak-list .oak-row .oak-l { font-size: 14px; font-family: "Segoe UI Symbol", "Noto Sans Symbols", Arial, sans-serif; }
  .oak-note { font-size: 11px; color: #9aa0a6; margin: 4px 0 6px; font-style: italic; }
  .oak-form { display: grid; grid-template-columns: 130px 1fr; gap: 8px 10px; align-items: center; margin: 4px 0; }
  .oak-form label { font-size: 12.5px; color: #cfd4dd; text-align: right; }
  .oak-form input {
    all: unset; box-sizing: border-box; width: 100%;
    background: #1f2126; color: #e8eaed; border: 1px solid #5f6368;
    border-radius: 6px; padding: 6px 9px; font: 13px/1.3 Arial, sans-serif;
  }
  .oak-form input:focus { border-color: #8ab4f8; }
  .oak-form input:disabled { opacity: .55; }
  .oak-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  .oak-btn { all: unset; cursor: pointer; padding: 6px 16px; border-radius: 6px;
             font: 12.5px Arial, sans-serif; }
  .oak-btn.primary { background: #8ab4f8; color: #202124; font-weight: 700; }
  .oak-btn.primary:hover { background: #aecbfa; }
  .oak-btn.plain { color: #cfd4dd; border: 1px solid #5f6368; }
  .oak-btn.plain:hover { background: rgba(255,255,255,.08); }
  .oak-btn:disabled { opacity: .5; cursor: default; }
  `;

  // Focusable controls of the current overlay (tabs, close, filter, rows,
  // form buttons) — used for keyboard reachability (re-audit 2.2).
  function focusablesIn(root) {
    return [...root.querySelectorAll("[tabindex='0'], button, input")]
      .filter((el) => !el.disabled && el.getClientRects().length > 0);
  }

  function ensureRoot() {
    let root = document.getElementById(rootId);
    if (root) return root;
    root = document.createElement("div");
    root.id = rootId;
    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);
    if (document.documentElement) document.documentElement.appendChild(root);
    // Keyboard reachability, for real (re-audit 2.2): while focus is
    // inside the overlay, Tab cycles its controls, Esc closes the tips,
    // and plain letters still walk the key-tip sequence (the engine's
    // own document handler ignores keys that originate in our UI, so
    // this listener is the one that forwards them).
    root.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const items = focusablesIn(root);
        if (!items.length) return; // nothing to cycle — default focus move
        e.preventDefault();
        const i = items.indexOf(document.activeElement);
        const n = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length];
        n.focus();
        return;
      }
      if (e.key === "Escape") {
        // Reaching this handler means the key-tips are open (extras panels
        // arm their own document-level Esc first, which fires earlier in
        // the capture chain and stops propagation).
        e.preventDefault();
        e.stopPropagation();
        window.OAKEngine?.closeTips();
        return;
      }
      // Plain letters/digits/Backspace keep driving the sequence — but
      // never steal typing from the overlay's own inputs (filter box,
      // form fields) or while an extras panel owns the overlay.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!window.OAKEngine || !window.OAKEngine.Engine ||
          !window.OAKEngine.Engine.active) return;
      let ch = null;
      if (/^Key[A-Z]$/.test(e.code || "")) ch = e.code.slice(3);
      else if (/^Digit[0-9]$/.test(e.code || "")) ch = e.code.slice(5);
      else if (/^[0-9a-z]$/i.test(e.key || "")) ch = e.key.toUpperCase();
      else if ((e.key || "") === "Backspace") ch = "BACKSPACE";
      if (!ch) return;
      e.preventDefault();
      e.stopPropagation();
      window.OAKEngine.feedKey(ch);
    }, true);
    return root;
  }

  function badgeKey(k) {
    return `<span class="oak-key${/^[0-9]$/.test(k) ? " digit" : ""}">${k}</span>`;
  }

  function activate(el, fn) {
    // keyboard reachability for every clickable (P2.13)
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    });
  }

  // Filter box wiring for panels & lists (P2.16 — the panel IS searchable).
  function attachFilter(panel, applyFilter) {
    const filter = document.createElement("input");
    filter.className = "oak-filter";
    filter.type = "search";
    filter.placeholder = "Filter…";
    filter.setAttribute("aria-label", "Filter list");
    filter.addEventListener("input", () => applyFilter(filter.value.trim().toLowerCase()));
    panel.appendChild(filter);
    return filter;
  }

  /* ---------- public API ---------- */

  const overlay = {
    mode: "show", // show | ghost | hidden

    cycleMode() {
      this.mode = this.mode === "show" ? "ghost" : this.mode === "ghost" ? "hidden" : "show";
      const root = document.getElementById(rootId);
      if (root) {
        root.classList.toggle("oak-ghost", this.mode === "ghost");
        root.classList.toggle("oak-hidden", this.mode === "hidden");
      }
      window.OAKDispatch?.toast(
        this.mode === "show" ? "Key-tips: shown" : this.mode === "ghost" ? "Key-tips: ghost" : "Key-tips: hidden (F10 to show)"
      );
      return this.mode;
    },

    // v1.1.3 transient idle ghost — driven by engine.armIdle/disarmIdle;
    // distinct from the user's F10 ghost (oak-ghost) so both can coexist.
    transientGhost(on) {
      const root = document.getElementById(rootId);
      if (root) root.classList.toggle("oak-idle-ghost", !!on);
    },

    // Level-0 ribbon strip: tabs = [{key, label, seq}]
    // Single row, horizontally scrollable, close pinned to the right (P2.2).
    showTabs(tabs, onPick, onClose) {
      const root = ensureRoot();
      root.classList.toggle("oak-ghost", this.mode === "ghost");
      root.classList.toggle("oak-hidden", this.mode === "hidden");
      root.innerHTML = "";
      root.appendChild(Object.assign(document.createElement("style"), { textContent: CSS }));
      const bar = document.createElement("div");
      bar.className = "oak-bar";
      bar.setAttribute("role", "tablist");
      bar.setAttribute("aria-label", "Office-style tabs");
      for (const t of tabs) {
        const el = document.createElement("div");
        el.className = "oak-tab";
        el.setAttribute("role", "tab");
        el.setAttribute("aria-label", t.label + " — " + t.key);
        el.innerHTML = `${badgeKey(t.key)}<span class="oak-tablabel">${t.label}</span>`;
        el.addEventListener("mousedown", (e) => e.preventDefault());
        const pick = () => onPick(t.key);
        el.addEventListener("click", (e) => { e.stopPropagation(); pick(); });
        activate(el, pick);
        bar.appendChild(el);
      }
      const hint = document.createElement("span");
      hint.className = "oak-hint";
      hint.textContent = "type letters · Esc · F10";
      bar.appendChild(hint);
      const close = document.createElement("span");
      close.className = "oak-close";
      close.textContent = "✕";
      close.title = "Close (Esc)";
      close.setAttribute("aria-label", "Close key-tips");
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        onClose();
      });
      activate(close, onClose);
      bar.appendChild(close);
      root.appendChild(bar);
    },

    // Level-1+ panel: entries = [{key, label, more, group}], crumb = "Alt H"
    // Filterable (P2.16).
    showPanel(crumb, entries, onPick) {
      const root = ensureRoot();
      // keep existing bar (strip), append/replace panel
      let panel = root.querySelector(".oak-panel");
      if (panel) panel.remove();
      panel = document.createElement("div");
      panel.className = "oak-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", crumb);
      const crumbEl = document.createElement("div");
      crumbEl.className = "oak-crumb";
      crumbEl.innerHTML = `<b>${crumb}</b> — keep typing, Esc to close`;
      panel.appendChild(crumbEl);

      const grid = document.createElement("div");
      grid.className = "oak-grid";
      const renderGrid = (q) => {
        grid.innerHTML = "";
        let lastGroup = null;
        let shown = 0;
        for (const e of entries) {
          const hay = (e.key + " " + e.label + " " + (e.group || "")).toLowerCase();
          if (q && !hay.includes(q)) continue;
          if (e.group && e.group !== lastGroup) {
            const g = document.createElement("div");
            g.className = "oak-group";
            g.textContent = e.group;
            grid.appendChild(g);
            lastGroup = e.group;
          }
          const row = document.createElement("div");
          row.className = "oak-row";
          row.innerHTML =
            `<span class="oak-k${/^[0-9]$/.test(e.key) ? " digit" : ""}">${e.key}</span>` +
            `<span class="oak-l">${e.label}</span>` +
            (e.more ? `<span class="oak-more">…</span>` : "");
          row.addEventListener("mousedown", (ev) => ev.preventDefault());
          const pick = () => onPick(e.key);
          row.addEventListener("click", (ev) => { ev.stopPropagation(); pick(); });
          activate(row, pick);
          grid.appendChild(row);
          shown++;
        }
        if (!shown) {
          const none = document.createElement("div");
          none.className = "oak-note";
          none.textContent = "No matches";
          grid.appendChild(none);
        }
      };
      attachFilter(panel, renderGrid);
      renderGrid("");
      panel.appendChild(grid);
      root.appendChild(panel);
      panel.scrollTop = 0;
    },

    hide() {
      this._disarmEsc();
      const root = document.getElementById(rootId);
      if (root) root.remove();
    },

    // Move focus into the overlay (first control, or last when fromEnd).
    // Returns false when nothing focusable is on screen (hidden mode) —
    // the caller then falls back to closing the tips.
    focusFirst(fromEnd) {
      const root = document.getElementById(rootId);
      if (!root) return false;
      const items = focusablesIn(root);
      if (!items.length) return false;
      items[fromEnd ? items.length - 1 : 0].focus();
      return true;
    },

    // Document-level Esc so standalone panels close even without focus.
    _armEsc(onEsc) {
      this._disarmEsc();
      this._escHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onEsc();
        }
      };
      document.addEventListener("keydown", this._escHandler, true);
    },
    _disarmEsc() {
      if (this._escHandler) {
        document.removeEventListener("keydown", this._escHandler, true);
        this._escHandler = null;
      }
    },

    // Standalone clickable list: items = [{label, sub?, group?, static?}]
    // opts = { note?, onClose? }. Always fully visible (P1.9) + filterable.
    showList(title, items, onPick, opts) {
      const root = ensureRoot();
      this._armEsc(() => this.hide());
      // Extras panels must never be ghosted or hidden (P1.9).
      root.classList.remove("oak-ghost", "oak-hidden");
      root.innerHTML = "";
      root.appendChild(Object.assign(document.createElement("style"), { textContent: CSS }));
      const panel = document.createElement("div");
      panel.className = "oak-panel oak-list";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", title);
      const crumbEl = document.createElement("div");
      crumbEl.className = "oak-crumb";
      crumbEl.innerHTML = `<b>${title}</b> — click an item · Esc closes`;
      panel.appendChild(crumbEl);
      if (opts && opts.note) {
        const note = document.createElement("div");
        note.className = "oak-note";
        note.textContent = opts.note;
        panel.appendChild(note);
      }
      const grid = document.createElement("div");
      grid.className = "oak-grid";
      const renderGrid = (q) => {
        grid.innerHTML = "";
        let lastGroup = null;
        let shown = 0;
        for (const it of items) {
          const hay = (it.label + " " + (it.sub || "") + " " + (it.group || "")).toLowerCase();
          if (q && !hay.includes(q)) continue;
          if (it.group && it.group !== lastGroup) {
            const g = document.createElement("div");
            g.className = "oak-group";
            g.textContent = it.group;
            grid.appendChild(g);
            lastGroup = it.group;
          }
          const row = document.createElement("div");
          row.className = "oak-row" + (it.static ? " oak-static" : "");
          row.innerHTML =
            `<span class="oak-l">${it.label}</span>` +
            (it.sub ? `<span class="oak-more">${it.sub}</span>` : "");
          if (!it.static) {
            row.addEventListener("mousedown", (ev) => ev.preventDefault());
            const pick = () => onPick(it.label, it);
            row.addEventListener("click", (ev) => { ev.stopPropagation(); pick(); });
            activate(row, pick);
          } else {
            row.removeAttribute("tabindex");
          }
          grid.appendChild(row);
          shown++;
        }
        if (!shown) {
          const none = document.createElement("div");
          none.className = "oak-note";
          none.textContent = "No matches";
          grid.appendChild(none);
        }
      };
      attachFilter(panel, renderGrid);
      renderGrid("");
      panel.appendChild(grid);
      const close = document.createElement("span");
      close.className = "oak-close";
      close.textContent = "✕";
      close.title = "Close (Esc)";
      close.setAttribute("aria-label", "Close " + title);
      close.style.cssText = "pointer-events:auto;position:absolute;top:8px;right:10px;cursor:pointer;color:#9aa0a6;font-size:14px;padding:2px 6px;border-radius:6px;";
      close.addEventListener("click", () => this.hide());
      activate(close, () => this.hide());
      panel.style.position = "relative";
      panel.appendChild(close);
      root.appendChild(panel);
      panel.scrollTop = 0;
    },

    // Standalone form: fields = [{name, label, value?, placeholder?}]
    // onSubmit(values) — Enter or OK submits, Esc/Cancel closes.
    // opts = { note?, okLabel?, cancelLabel?, onCancel?, busyLabel? }
    // While onSubmit's promise is pending the buttons are disabled, so a
    // command can never be started twice concurrently (P1.6).
    showForm(title, fields, onSubmit, opts) {
      const root = ensureRoot();
      const o = opts || {};
      const doClose = () => {
        this.hide();
        if (o.onCancel) o.onCancel();
      };
      this._armEsc(doClose);
      // Extras panels must never be ghosted or hidden (P1.9).
      root.classList.remove("oak-ghost", "oak-hidden");
      root.innerHTML = "";
      root.appendChild(Object.assign(document.createElement("style"), { textContent: CSS }));
      const panel = document.createElement("div");
      panel.className = "oak-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", title);
      const crumbEl = document.createElement("div");
      crumbEl.className = "oak-crumb";
      crumbEl.innerHTML = `<b>${title}</b>`;
      panel.appendChild(crumbEl);
      if (o.note) {
        const note = document.createElement("div");
        note.className = "oak-note";
        note.textContent = o.note;
        panel.appendChild(note);
      }
      const form = document.createElement("div");
      form.className = "oak-form";
      const inputs = {};
      for (const f of fields) {
        const label = document.createElement("label");
        label.textContent = f.label;
        form.appendChild(label);
        const input = document.createElement("input");
        input.type = "text";
        input.value = f.value || "";
        input.placeholder = f.placeholder || "";
        input.autocomplete = "off";
        input.spellcheck = false;
        inputs[f.name] = input;
        form.appendChild(input);
      }
      panel.appendChild(form);
      const btns = document.createElement("div");
      btns.className = "oak-buttons";
      const cancel = document.createElement("button");
      cancel.className = "oak-btn plain";
      cancel.textContent = o.cancelLabel || "Cancel";
      cancel.addEventListener("click", doClose);
      const ok = document.createElement("button");
      ok.className = "oak-btn primary";
      ok.textContent = o.okLabel || "OK";
      btns.append(cancel, ok);
      panel.appendChild(btns);
      root.appendChild(panel);

      let busy = false;
      const setBusy = (b) => {
        busy = b;
        ok.disabled = b;
        cancel.disabled = b;
        ok.textContent = b ? (o.busyLabel || "Working…") : (o.okLabel || "OK");
        for (const k of Object.keys(inputs)) inputs[k].disabled = b;
      };
      const submit = async () => {
        if (busy) return;
        setBusy(true);
        let keep = false;
        try {
          const vals = {};
          for (const f of fields) vals[f.name] = inputs[f.name].value;
          keep = await onSubmit(vals);
        } catch (e) {
          keep = false;
        }
        if (keep === false) {
          setBusy(false); // validation failed — let the user fix and retry
          return;
        }
        this.hide(); // success (or fire-and-forget) — close the form
      };
      ok.addEventListener("click", () => submit());
      // Enter in any input submits; Esc closes.
      panel.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") { e.stopPropagation(); doClose(); }
      });
      panel.tabIndex = -1;
      (inputs[fields[0] && fields[0].name] || panel).focus();
    },

    isVisible() {
      return !!document.getElementById(rootId);
    },
  };

  window.OAKOverlay = overlay;
})();
