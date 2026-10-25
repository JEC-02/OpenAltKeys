/*
 * OpenAltKeys — app.js
 * Bootstrap: detect which Google editor we are in, load its shortcut
 * database, apply stored settings and start the engine.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const loc = location.href;
  let app = null;
  if (/docs\.google\.com\/spreadsheets\//.test(loc)) app = "sheets";
  else if (/docs\.google\.com\/document\//.test(loc)) app = "docs";
  else if (/docs\.google\.com\/presentation\//.test(loc)) app = "slides";
  if (!app) return;

  const entries = window.OAK_DATA && window.OAK_DATA[app];
  if (!entries || !entries.length) return;

  const DEFAULTS = {
    enabled: true,
    sheets: true,
    docs: true,
    slides: true,
    f4Repeat: true,
    ctrlRowCol: true,
    f10Modes: true,
    headsUpGuard: true,
    disabledSeqs: "",
  };

  function engineSettings(s) {
    return {
      enabled: s.enabled !== false && s[app] !== false,
      f4Repeat: s.f4Repeat !== false,
      ctrlRowCol: s.ctrlRowCol !== false,
      f10Modes: s.f10Modes !== false,
      disabledSeqs: String(s.disabledSeqs || "")
        .split(/[\s,;]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    };
  }

  function start(settings) {
    const s = Object.assign({}, DEFAULTS, settings || {});
    window.OAKEngine.init(app, entries, engineSettings(s));
  }

  // storage may be unavailable (rare incognito edge) — start with defaults.
  try {
    chrome.storage.sync.get(DEFAULTS, (res) => {
      if (chrome.runtime.lastError) {
        start(null);
        return;
      }
      const s = res && Object.keys(res).length ? res : DEFAULTS;
      start(s);
    });
  } catch (e) {
    start(null);
  }

  // Tell the background worker the extension is alive in a tab — it clears
  // the install hint badge without any fragile MV3 timers (P2.14/P3).
  try { chrome.runtime.sendMessage({ type: "oak-activated", app: app }); } catch (e) { /* ignore */ }

  // Live-apply setting changes made in the popup / options page.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      chrome.storage.sync.get(DEFAULTS, (s) => {
        if (chrome.runtime.lastError) return;
        const full = engineSettings(s);
        window.OAKEngine.updateSettings(full);
        // Master switch off must also hide whatever overlay is on screen.
        if (full.enabled === false) {
          window.OAKEngine.closeTips();
          window.OAKOverlay?.hide();
        }
      });
    });
  } catch (e) {
    /* ignore */
  }
})();
