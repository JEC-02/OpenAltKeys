/*
 * OpenAltKeys — dialogguard.js (Google Sheets only)
 * Auto-confirms Google's "Heads up!" protected-range warning when — and
 * only when — the edit was triggered by an OpenAltKeys command.
 *
 * The warning (Data ▸ Protect a sheet or range ▸ "Show a warning"):
 *   "Heads up! You're trying to edit part of this sheet that shouldn't be
 *    changed accidentally. Edit anyway?"   [OK] [Cancel]
 *    ☑ Don't show this again for 5 minutes
 * pops on EVERY edit of a warned range — merging cells, typing, pasting,
 * Goal-Seek writebacks… Google offers no permanent off switch (the owner
 * can only remove or restrict the protection), so keyboard-driven merges
 * stall behind a mouse-only dialog.
 *
 * How this guard stays honest (P1.7):
 *   • ARMED, NOT ALWAYS-ON. It arms for 12 s and exactly ONE dialog each
 *     time OpenAltKeys itself executes an action (dispatch runAction /
 *     sheetio writeCell). A warning from YOUR OWN typing, menu clicks or
 *     macros is never touched — Google's safety net stays fully intact
 *     for everything the extension did not explicitly run.
 *   • TEXT-MATCHED, NOT BLIND. Only dialogs whose text matches the known
 *     warning (plus a defensive slow-merge variant) are confirmed, and
 *     only via an exact-label OK-style button. "Cancel" and every other
 *     dialog (delete confirmations, share prompts, …) are never clicked.
 *   • NEVER touches the "Don't show this again for 5 minutes" checkbox —
 *     your native warning behavior between commands is unchanged.
 *   • It tells you: every auto-confirm shows a toast, so a silent
 *     confirmation can never surprise you (honesty rule, P2.10).
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const ARM_WINDOW_MS = 12000;   // how long an arm stays valid
  const MIN_CLICK_GAP_MS = 1000; // never hammer the dialog buttons
  const VERIFY_RETRY_MS = 700;   // re-check the dialog closed after a click
  const TICK_MS = 400;           // armed-mode rescan interval (belt+suspenders)

  let enabled = true;   // "headsUpGuard" setting (default on)
  let armedUntil = 0;
  let budget = 0;       // dialogs this arm may confirm: exactly one
  let lastClickAt = 0;
  let ticker = null;

  // Dialogs we already clicked (never twice) / retried and gave up on.
  const clicked = new WeakSet();
  const unstoppable = new WeakSet();

  /* =============================================================
   * Pure matchers (unit tested — see extras.test.mjs)
   * ============================================================= */

  // Does this dialog text look like Google's edit warning?
  function isHeadsUpWarning(text) {
    const t = String(text || "").replace(/\s+/g, " ").toLowerCase();
    if (!t) return false;
    // Protected-range warning, current + documented variants:
    // "heads up! you're trying to edit part of this sheet that shouldn't
    //  be changed accidentally. edit anyway?"  (also "should not be
    //  changed", "you are trying", older embeds without the title)
    if (/edit anyway/.test(t) && /should(?:n'?t| not) be changed/.test(t)) return true;
    if (/heads? ?up/.test(t) && /edit anyway/.test(t)) return true;
    // Defensive future variant: merging in a very large sheet warns it
    // may take minutes. Title + merge + duration/size words, all required.
    if (/heads? ?up/.test(t) && /\bmerg(?:e|es|ing)\b/.test(t) &&
        /(minute|while|might take|may take|could take|large)/.test(t)) return true;
    return false;
  }

  // Exact-label OK-style buttons we may click. Nothing fuzzy: a button
  // that is not on this list is never clicked.
  const CONFIRM_LABELS = [
    "edit anyway", "ok", "merge anyway", "merge cells", "merge",
    "continue", "yes", "got it",
  ];
  const DENY_LABEL_RE = /(cancel|don'?t|do not|never|close|dismiss|\bno\b|stop|abort)/;

  function normalizeLabel(s) {
    return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  // May this button label be used to confirm the warning?
  function isConfirmLabel(label) {
    const s = normalizeLabel(label);
    if (!s || s.length > 24) return false;
    if (DENY_LABEL_RE.test(s)) return false;
    return CONFIRM_LABELS.indexOf(s) !== -1;
  }

  /* =============================================================
   * DOM layer (defensive: this file also loads in the Node unit stub)
   * ============================================================= */

  const HAS_DOM = typeof MutationObserver !== "undefined" &&
    typeof document !== "undefined" && !!document.documentElement;

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    try {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (e) {
      return false;
    }
  }

  function dialogCandidates() {
    try {
      return document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"], .modal-dialog, .docs-dialog, .docs-restart-dialog'
      );
    } catch (e) {
      return [];
    }
  }

  // Pick the button to confirm with. Exact labels only; among several
  // matches prefer Google's primary-action hints.
  function pickConfirmButton(dlg) {
    let btns;
    try {
      btns = dlg.querySelectorAll("button, [role='button']");
    } catch (e) {
      return null;
    }
    let first = null;
    for (const b of btns) {
      if (b.closest(".oak-overlay-root, #oak-toast")) continue; // never our own UI
      if (b.disabled || b.getAttribute("aria-disabled") === "true") continue;
      const label = normalizeLabel(
        b.getAttribute("aria-label") || b.textContent || ""
      );
      if (!isConfirmLabel(label)) continue;
      if (!visible(b)) continue;
      if (!first) first = b;
      // primary-action hints seen in Google's dialogs (Closure + Material)
      const cls = String(b.className || "");
      if (/goog-buttonset-default|button-primary|VfPpkd-LgbsSe-OWXEXe-k8QpJ|action\b/.test(cls)) {
        return b;
      }
      if (b.getAttribute("autofocus") !== null) return b;
    }
    return first;
  }

  function clickButton(btn) {
    try {
      if (window.OAKMenus && typeof window.OAKMenus.realClick === "function") {
        window.OAKMenus.realClick(btn); // pointer+mouse sequence (proven path)
      } else {
        btn.click();
      }
      return true;
    } catch (e) {
      try { btn.click(); return true; } catch (e2) { return false; }
    }
  }

  function confirmDialog(dlg) {
    if (!enabled || budget <= 0 || Date.now() > armedUntil) return;
    const btn = pickConfirmButton(dlg);
    if (!btn) return; // buttons not wired yet — next scan retries
    const now = Date.now();
    if (now - lastClickAt < MIN_CLICK_GAP_MS) return; // too soon, retry later
    budget--;
    lastClickAt = now;
    clicked.add(dlg);
    clickButton(btn);
    try {
      window.OAKDispatch && window.OAKDispatch.toast(
        'Heads-up warning auto-confirmed (OK pressed for you)'
      );
    } catch (e) { /* toast is best-effort */ }
    // Verify it actually closed; one retry, then hands off for good.
    setTimeout(function () {
      try {
        if (document.contains(dlg) && visible(dlg) && !unstoppable.has(dlg)) {
          const again = pickConfirmButton(dlg);
          if (again) clickButton(again);
          else unstoppable.add(dlg);
        }
      } catch (e) { /* ignore */ }
    }, VERIFY_RETRY_MS);
  }

  function scan() {
    if (!enabled || budget <= 0 || Date.now() > armedUntil) {
      stopTickerIfIdle();
      return;
    }
    for (const dlg of dialogCandidates()) {
      // A closed dialog earns a fresh start: Google (and our mock) can
      // reuse one element for the NEXT warning — Alt H M M twice must
      // auto-confirm twice (P1.7 regression: permanent blacklisting).
      if (!visible(dlg)) {
        clicked.delete(dlg);
        unstoppable.delete(dlg);
        continue;
      }
      if (clicked.has(dlg) || unstoppable.has(dlg)) continue;
      let text = "";
      try { text = dlg.textContent || ""; } catch (e) { continue; }
      if (!isHeadsUpWarning(text)) continue;
      confirmDialog(dlg);
      return; // one dialog per scan
    }
  }

  function stopTickerIfIdle() {
    if (ticker && (budget <= 0 || Date.now() > armedUntil || !enabled)) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  /* =============================================================
   * Public surface
   * ============================================================= */

  // Called by dispatch.runAction / sheetio.writeCell right before an
  // OpenAltKeys-driven edit. One arm = one confirmable dialog.
  function arm() {
    if (!enabled) return;
    armedUntil = Date.now() + ARM_WINDOW_MS;
    budget = 1;
    if (HAS_DOM && !ticker) ticker = setInterval(scan, TICK_MS);
  }

  window.OAKDialogGuard = {
    arm: arm,
    __test: {
      isHeadsUpWarning: isHeadsUpWarning,
      isConfirmLabel: isConfirmLabel,
      CONFIRM_LABELS: CONFIRM_LABELS,
    },
  };

  /* ---------- settings (live-applied, same pattern as app.js) ---------- */
  try {
    chrome.storage.sync.get({ headsUpGuard: true }, function (res) {
      if (chrome.runtime.lastError) return;
      enabled = !res || res.headsUpGuard !== false;
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "sync" || !changes.headsUpGuard) return;
      enabled = changes.headsUpGuard.newValue !== false;
      if (!enabled) { budget = 0; armedUntil = 0; stopTickerIfIdle(); }
    });
  } catch (e) { /* storage unavailable (rare incognito edge) — stay on */ }

  /* ---------- observer ---------- */
  if (HAS_DOM) {
    let scheduled = false;
    const schedule = function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () { scheduled = false; scan(); }, 50);
    };
    try {
      new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "aria-hidden", "hidden"],
      });
    } catch (e) { /* never break the page over the guard */ }
  }
})();
