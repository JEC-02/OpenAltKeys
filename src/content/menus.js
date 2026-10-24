/*
 * OpenAltKeys — menus.js
 * Navigates Google Workspace (Docs/Sheets/Slides) native Closure menus.
 * Google's editors expose a menu bar of buttons (#docs-file-menu, …) that
 * open .goog-menu containers holding .goog-menuitem rows. We open menus,
 * wait for lazy construction, match items by aria-label / text and click.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- menu bar buttons ---------- */

  const KNOWN_MENU_IDS = {
    file: ["docs-file-menu"],
    edit: ["docs-edit-menu"],
    view: ["docs-view-menu"],
    insert: ["docs-insert-menu"],
    format: ["docs-format-menu"],
    data: ["docs-data-menu"],
    tools: ["docs-tools-menu"],
    extensions: ["docs-extensions-menu", "docs-add-ons-menu"],
    help: ["docs-help-menu"],
    // Slides-only menus
    slide: ["docs-slide-menu"],
    arrange: ["docs-arrange-menu"],
  };

  function menuBarButtons() {
    const bar =
      document.getElementById("docs-menubar") ||
      document.querySelector(".docs-menubar, [role='menubar']");
    if (!bar) return [];
    return [...bar.querySelectorAll("button, [role='menuitem'], div[aria-haspopup]")].filter(
      (b) => b.offsetParent !== null || b.getBoundingClientRect().width > 0
    );
  }

  // Find the menu-bar button by key ("file", "edit", …) or literal id.
  function findMenuButton(menuKey) {
    const ids = KNOWN_MENU_IDS[menuKey] || [menuKey];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    // Fallback: match by visible text ("File", "Insert", …)
    const wanted = menuKey.charAt(0).toUpperCase() + menuKey.slice(1);
    for (const b of menuBarButtons()) {
      const t = (b.getAttribute("aria-label") || b.innerText || "").trim().toLowerCase();
      if (t === wanted.toLowerCase() || t.startsWith(wanted.toLowerCase() + " ")) return b;
    }
    return null;
  }

  /* ---------- visible menu items ---------- */

  function visibleMenus() {
    return [...document.querySelectorAll(".goog-menu")].filter((m) => {
      const s = getComputedStyle(m);
      return (
        s.display !== "none" &&
        s.visibility !== "hidden" &&
        m.getBoundingClientRect().width > 0
      );
    });
  }

  // `want` label matching:
  //   "Page break"      exact label (mnemonic suffix tolerated)
  //   "^Editing"        starts-with
  //   "!Headers"        exact and NOT a submenu
  //   "A|B"             candidates (any match wins)
  function itemMatches(item, want) {
    const labelEl = item.querySelector("[aria-label]");
    const aria = (
      labelEl ? labelEl.getAttribute("aria-label") : item.innerText || ""
    ).trim();
    const text = (item.innerText || "").trim();
    let w = want;
    let wantSubmenu = true;
    if (w[0] === "!") {
      wantSubmenu = false;
      w = w.slice(1);
    }
    if (!wantSubmenu && item.classList.contains("goog-submenu")) return false;
    const lowA = aria.toLowerCase();
    const lowT = text.toLowerCase();
    for (const cand0 of w.split("|")) {
      const cand = cand0.trim().toLowerCase();
      if (!cand) continue;
      let prefix = null;
      if (cand[0] === "^") prefix = cand.slice(1);
      const c = prefix === null ? cand : prefix;
      if (lowA === c || lowT === c) return true;
      if (prefix !== null) {
        if (lowA.startsWith(c + " ") || lowT.startsWith(c + " ")) return true;
      } else {
        // tolerate a single trailing suffix word (mnemonic, count, …)
        if (
          (lowA.startsWith(c + " ") && !lowA.slice(c.length + 1).includes(" ")) ||
          (lowT.startsWith(c + " ") && !lowT.slice(c.length + 1).includes(" "))
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function findItem(wants, usedMenus) {
    const menus = visibleMenus();
    // Prefer menus we have not consumed yet (avoids hidden duplicates).
    const ordered = [
      ...menus.filter((m) => !usedMenus.has(m)),
      ...menus.filter((m) => usedMenus.has(m)),
    ];
    for (const m of ordered) {
      for (const item of m.querySelectorAll(".goog-menuitem")) {
        if (item.closest(".goog-menu") !== m) continue;
        if (item.classList.contains("goog-menuitem-disabled")) continue;
        if (wants.some((w) => itemMatches(item, w))) return { item, menu: m };
      }
    }
    return null;
  }

  // Menus are built lazily the first time they open — poll up to 2s.
  async function waitForItem(wants, usedMenus, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = findItem(wants, usedMenus);
      if (found) return found;
      if (Date.now() >= deadline) return null;
      await wait(50);
    }
  }

  /* ---------- clicking helpers ---------- */

  function realClick(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };
    try {
      el.dispatchEvent(new PointerEvent("pointerover", opts));
      el.dispatchEvent(new MouseEvent("mouseover", opts));
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.focus?.();
      el.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));
    } catch (e) {
      el.click?.();
    }
  }

  function pressEscape() {
    const t = document.activeElement || document.body;
    for (const type of ["keydown", "keyup"]) {
      t.dispatchEvent(
        new KeyboardEvent(type, {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }

  function closeMenus() {
    pressEscape();
    pressEscape();
  }

  // Ensure no menu is open before we start a new navigation.
  async function settleMenus() {
    for (let i = 0; i < 10 && visibleMenus().length; i++) {
      closeMenus();
      await wait(60);
    }
  }

  /* ---------- high level navigation ---------- */

  // Open a top-level menu by key/id, then click through `steps`
  // (each step: label string with candidates "A|B", possibly a submenu row).
  // Returns true when every step completed.
  async function runMenuPath(menuKey, steps, opts = {}) {
    const btn = findMenuButton(menuKey);
    if (!btn) return false;
    await settleMenus();
    realClick(btn);
    const used = new Set();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const wants = Array.isArray(step) ? step : String(step).split("|").map((s) => s.trim());
      // "|" inside a single string is a candidate list; normalize.
      const candidates = [];
      for (const w of wants) {
        if (w.includes("|") && !w.startsWith("!") && !w.startsWith("^")) {
          candidates.push(...w.split("|").map((s) => s.trim()));
        } else candidates.push(w);
      }
      const found = await waitForItem(candidates, used);
      if (!found) {
        closeMenus();
        return false;
      }
      used.add(found.menu);
      const isSub = found.item.classList.contains("goog-submenu");
      const isLast = i === steps.length - 1;
      realClick(found.item);
      if (isSub && !isLast) {
        // give the submenu time to open
        await wait(160);
      } else {
        await wait(60);
      }
    }
    return true;
  }

  window.OAKMenus = {
    findMenuButton,
    visibleMenus,
    realClick,
    pressEscape,
    closeMenus,
    runMenuPath,
    wait,
  };
})();
